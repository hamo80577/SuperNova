import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  AttendanceImportBatchStatus,
  ChainStatus,
  DeductionCaseStatus,
  EmploymentStatus,
  OrdersKpiImportBatchStatus,
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  Prisma,
  RequestStatus,
  RequestType,
  User,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { OrdersKpisTargetSettingsService } from "../orders-kpis/orders-kpis-target-settings.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  requestInclude as workspaceRequestInclude,
  type RequestWithRelations
} from "../requests/request-includes";
import { toRequestSummary } from "../requests/request-response.utils";
import { AnnualLeaveBalanceService } from "../users/annual-leave-balance.service";
import { toSafeUser } from "../users/dto/safe-user.dto";
import type { ChampPerformanceSummaryQueryDto } from "./dto/champ-performance-summary-query.dto";
import type { PickerPerformanceSummaryQueryDto } from "./dto/picker-performance-summary-query.dto";

const activePickerAssignmentInclude = {
  vendor: {
    include: {
      chain: true
    }
  }
} satisfies Prisma.PickerBranchAssignmentInclude;

const champBranchInclude = {
  vendor: {
    include: {
      chain: true,
      pickerAssignments: {
        where: {
          status: AssignmentStatus.ACTIVE,
          picker: {
            accountStatus: AccountStatus.ACTIVE,
            employmentStatus: EmploymentStatus.ACTIVE
          }
        },
        include: { picker: true },
        orderBy: { createdAt: "desc" as const }
      }
    }
  }
} satisfies Prisma.VendorChampAssignmentInclude;

const areaManagerChainInclude = {
  chain: {
    include: {
      vendors: {
        orderBy: { createdAt: "desc" as const },
        include: {
          pickerAssignments: {
            where: {
              status: AssignmentStatus.ACTIVE,
              picker: {
                accountStatus: AccountStatus.ACTIVE,
                employmentStatus: EmploymentStatus.ACTIVE
              }
            },
            include: { picker: true },
            orderBy: { createdAt: "desc" as const }
          },
          champAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: { champ: true },
            orderBy: { createdAt: "desc" as const }
          }
        }
      }
    }
  }
} satisfies Prisma.ChainAreaManagerAssignmentInclude;

const activePickerRankingAssignmentInclude = {
  picker: true,
  vendor: {
    include: {
      chain: true
    }
  }
} satisfies Prisma.PickerBranchAssignmentInclude;

const attendanceSummarySelect = {
  userId: true,
  shiftDate: true,
  calculatedStatus: true,
  isOnTime: true,
  isLate: true,
  isAbsent: true,
  isUnder8Hours: true,
  isOver15Hours: true,
  issuesCount: true,
  lateBucket: true
} satisfies Prisma.AttendanceDailyRecordSelect;

const ordersKpiSummarySelect = {
  userId: true,
  kpiDate: true,
  matchedVendorId: true,
  matchedChainId: true,
  sourceShopperId: true,
  sourcePickerKey: true,
  pickerNameSnapshot: true,
  pickerMatchStatus: true,
  totalOrders: true,
  unhealthyOrders: true,
  orderNotOnTime: true,
  qcFailedOrders: true,
  partialRefund: true,
  outOfStock: true,
  priceModified: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

type ChampBranchAssignment = Prisma.VendorChampAssignmentGetPayload<{
  include: typeof champBranchInclude;
}>;

type ActivePickerRankingAssignment = Prisma.PickerBranchAssignmentGetPayload<{
  include: typeof activePickerRankingAssignmentInclude;
}>;

type AttendanceSummaryRecord = Prisma.AttendanceDailyRecordGetPayload<{
  select: typeof attendanceSummarySelect;
}>;

type OrdersKpiSummaryRecord = Prisma.OrdersKpiDailyRecordGetPayload<{
  select: typeof ordersKpiSummarySelect;
}>;

type OrdersKpiTargetSettingsForSummary = Awaited<
  ReturnType<OrdersKpisTargetSettingsService["getTargetSettingsForReport"]>
>;

type AnnualLeaveBalanceForSummary = Awaited<
  ReturnType<AnnualLeaveBalanceService["getForUser"]>
>;

type PendingLifecycleRequestSummary = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  currentStep: string | null;
  createdAt: Date;
};

const pendingRequestStatuses = [
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
];

const rankingOrderThresholds = {
  LAST_WEEK: 20,
  THIS_MONTH: 60,
  THIS_QUARTER: 180,
  CUSTOM: 60
} as const;

type PickerPerformancePeriodLabel = keyof typeof rankingOrderThresholds;

type PickerRankReason = "LOW_ORDER_VOLUME" | "NO_KPI_RECORDS" | "NOT_IN_SCOPE";

type PickerRankingMetric = {
  pickerId: string;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number;
  attendanceRate: number | null;
};

type BranchRankingMetric = {
  vendorId: string;
  chainId: string | null;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number;
  attendanceHealthRate: number | null;
};

type PickerPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME";

const pickerPerformanceStatusWeight: Record<PickerPerformanceStatus, number> = {
  NEEDS_ACTION: 0,
  WATCH: 1,
  LOW_VOLUME: 2,
  IN_TARGET: 3
};

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrdersKpisTargetSettingsService)
    private readonly ordersKpiTargetSettingsService: OrdersKpisTargetSettingsService,
    @Inject(AnnualLeaveBalanceService)
    private readonly annualLeaveBalanceService: AnnualLeaveBalanceService
  ) {}

  async getPickerWorkspace(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const pickerAssignment = await this.prisma.pickerBranchAssignment.findFirst({
      where: { pickerId: userId, status: AssignmentStatus.ACTIVE },
      include: activePickerAssignmentInclude
    });

    const [champAssignment, areaManagerAssignment] = pickerAssignment
      ? await this.prisma.$transaction([
          this.prisma.vendorChampAssignment.findFirst({
            where: {
              vendorId: pickerAssignment.vendorId,
              status: AssignmentStatus.ACTIVE
            },
            include: { champ: true }
          }),
          this.prisma.chainAreaManagerAssignment.findFirst({
            where: {
              chainId: pickerAssignment.vendor.chainId,
              status: AssignmentStatus.ACTIVE
            },
            include: { areaManager: true }
          })
        ])
      : [null, null];

    return {
      profile: toSafeUser(user),
      profileCompletion: this.getProfileCompletion(user),
      currentAssignment: pickerAssignment
        ? {
            id: pickerAssignment.id,
            status: pickerAssignment.status,
            startDate: pickerAssignment.startDate,
            endDate: pickerAssignment.endDate
          }
        : null,
      branch: pickerAssignment ? toVendorSummary(pickerAssignment.vendor) : null,
      chain: pickerAssignment ? toChainSummary(pickerAssignment.vendor.chain) : null,
      champ: champAssignment ? toUserSummary(champAssignment.champ) : null,
      areaManager: areaManagerAssignment
        ? toUserSummary(areaManagerAssignment.areaManager)
        : null
    };
  }

  async getPickerPerformanceSummary(
    userId: string,
    query: PickerPerformanceSummaryQueryDto
  ) {
    const period = parsePickerPerformancePeriod(query);
    const user = await this.getUserOrThrow(userId);
    const pickerAssignment = await this.prisma.pickerBranchAssignment.findFirst({
      where: { pickerId: userId, status: AssignmentStatus.ACTIVE },
      include: activePickerAssignmentInclude
    });

    const [champAssignment, areaManagerAssignment] = pickerAssignment
      ? await this.prisma.$transaction([
          this.prisma.vendorChampAssignment.findFirst({
            where: {
              vendorId: pickerAssignment.vendorId,
              status: AssignmentStatus.ACTIVE
            },
            include: { champ: true }
          }),
          this.prisma.chainAreaManagerAssignment.findFirst({
            where: {
              chainId: pickerAssignment.vendor.chainId,
              status: AssignmentStatus.ACTIVE
            },
            include: { areaManager: true }
          })
        ])
      : [null, null];

    const [
      attendanceRecords,
      previousAttendanceRecords,
      pickerKpiRecords,
      targetSettings,
      activeAssignments,
      effectiveDeductionCases,
      annualLeaveBalance
    ] = await Promise.all([
      this.prisma.attendanceDailyRecord.findMany({
        where: activeAttendanceWhere(userId, period.dateFromValue, period.dateToValue),
        select: attendanceSummarySelect
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: activeAttendanceWhere(
          userId,
          period.previousDateFromValue,
          period.previousDateToValue
        ),
        select: attendanceSummarySelect
      }),
      this.prisma.ordersKpiDailyRecord.findMany({
        where: ordersKpiWhereForUsers(
          [userId],
          period.dateFromValue,
          period.dateToExclusiveValue
        ),
        select: ordersKpiSummarySelect
      }),
      this.ordersKpiTargetSettingsService.getTargetSettingsForReport(),
      this.prisma.pickerBranchAssignment.findMany({
        where: {
          status: AssignmentStatus.ACTIVE,
          picker: {
            role: UserRole.PICKER,
            accountStatus: AccountStatus.ACTIVE,
            employmentStatus: EmploymentStatus.ACTIVE
          }
        },
        include: activePickerRankingAssignmentInclude
      }),
      this.prisma.deductionCase.findMany({
        where: {
          targetUserId: userId,
          status: DeductionCaseStatus.EFFECTIVE,
          incidentDate: {
            gte: period.dateFromValue,
            lte: endOfUtcDate(period.dateToValue)
          }
        },
        select: { deductionDays: true }
      }),
      this.annualLeaveBalanceService.getForUser(
        {
          id: user.id,
          role: user.role,
          joiningDate: user.joiningDate
        },
        period.dateToValue
      )
    ]);

    const uniqueActiveAssignments = uniquePickerAssignments(activeAssignments);
    const activePickerIds = uniqueActiveAssignments.map(
      (assignment) => assignment.pickerId
    );
    const [
      rankingKpiRecords,
      rankingAttendanceRecords,
      previousRankingKpiRecords,
      previousRankingAttendanceRecords
    ] = activePickerIds.length
      ? await Promise.all([
          this.prisma.ordersKpiDailyRecord.findMany({
            where: ordersKpiWhereForUsers(
              activePickerIds,
              period.dateFromValue,
              period.dateToExclusiveValue
            ),
            select: ordersKpiSummarySelect
          }),
          this.prisma.attendanceDailyRecord.findMany({
            where: activeAttendanceWhere(
              activePickerIds,
              period.dateFromValue,
              period.dateToValue
            ),
            select: attendanceSummarySelect
          }),
          this.prisma.ordersKpiDailyRecord.findMany({
            where: ordersKpiWhereForUsers(
              activePickerIds,
              period.previousDateFromValue,
              addUtcDays(period.previousDateToValue, 1)
            ),
            select: ordersKpiSummarySelect
          }),
          this.prisma.attendanceDailyRecord.findMany({
            where: activeAttendanceWhere(
              activePickerIds,
              period.previousDateFromValue,
              period.previousDateToValue
            ),
            select: attendanceSummarySelect
          })
        ])
      : [[], [], [], []];

    const pickerKpi = summarizeOrdersKpi(pickerKpiRecords);
    const rankingMetrics = buildRankingMetrics(
      uniqueActiveAssignments,
      rankingKpiRecords,
      rankingAttendanceRecords
    );
    const previousRankingMetrics = buildRankingMetrics(
      uniqueActiveAssignments,
      previousRankingKpiRecords,
      previousRankingAttendanceRecords
    );
    const minOrders = rankingOrderThresholds[period.label];

    return {
      period: {
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        label: period.label
      },
      identity: {
        pickerName: user.nameEn,
        role: "PICKER",
        shopperId: user.shopperId,
        branchName: pickerAssignment?.vendor.vendorName ?? null,
        chainName: pickerAssignment?.vendor.chain.chainName ?? null,
        areaManagerName: areaManagerAssignment?.areaManager.nameEn ?? null,
        champName: champAssignment?.champ.nameEn ?? null
      },
      attendance: buildAttendanceSummary(
        attendanceRecords,
        previousAttendanceRecords
      ),
      ordersKpi: buildOrdersKpiSummary(pickerKpi, targetSettings, pickerKpiRecords),
      ranking: buildPickerRankingSummary({
        activeAssignments: uniqueActiveAssignments,
        currentAssignment: pickerAssignment,
        currentPickerId: userId,
        metricsByPickerId: rankingMetrics,
        previousMetricsByPickerId: previousRankingMetrics,
        minOrders
      }),
      deductions: {
        available: true,
        totalEffectiveDays: roundTwoDecimals(
          effectiveDeductionCases.reduce(
            (sum, item) => sum + decimalToNumber(item.deductionDays),
            0
          )
        ),
        effectiveCasesCount: effectiveDeductionCases.length,
        pendingHiddenByPolicy: true
      },
      annualLeave: buildAnnualLeaveSummary(annualLeaveBalance)
    };
  }

  async getChampWorkspace(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const branchData = await this.getChampBranches(userId);

    return {
      champ: toUserSummary(user),
      branches: branchData.branches,
      totals: {
        branches: branchData.branches.length,
        activePickers: branchData.branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        ),
        pendingRequests: branchData.totals.pendingRequests,
        recentRequests: branchData.totals.recentRequests
      },
      placeholders: {
        requests: "Request history is visible here; lifecycle forms launch from a selected Branch context.",
        actions: "New Hire, Resignation, and Transfer remain request-based and Branch-contextual."
      }
    };
  }

  async getChampPerformanceSummary(
    userId: string,
    query: ChampPerformanceSummaryQueryDto
  ) {
    const period = parseChampPerformancePeriod(query);
    const champ = await this.getUserOrThrow(userId);
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId: userId, status: AssignmentStatus.ACTIVE },
      include: champBranchInclude
    });
    const sortedAssignments = sortChampAssignmentsByBranchName(assignments);
    const selectedAssignment = resolveChampSelectedAssignment(
      sortedAssignments,
      query.vendorId
    );
    const branches = sortedAssignments.map(toChampPerformanceBranchOption);

    if (!selectedAssignment) {
      return emptyChampPerformanceSummary(champ.nameEn, period, branches);
    }

    const selectedVendorId = selectedAssignment.vendorId;
    const selectedPickerAssignments =
      selectedAssignment.vendor.pickerAssignments;
    const selectedPickerIds = selectedPickerAssignments.map(
      (assignment) => assignment.pickerId
    );
    const minBranchOrders = branchRankingMinOrdersForRange(
      period.dateFromValue,
      period.dateToValue
    );
    const minPickerOrders = pickerRankingMinOrdersForRange(period.days);

    const [
      areaManagerAssignment,
      attendanceRecords,
      selectedBranchKpiRecords,
      rankingKpiRecords,
      targetSettings,
      recentRequests
    ] = await Promise.all([
      this.prisma.chainAreaManagerAssignment.findFirst({
        where: {
          chainId: selectedAssignment.vendor.chainId,
          status: AssignmentStatus.ACTIVE
        },
        include: { areaManager: true }
      }),
      selectedPickerIds.length
        ? this.prisma.attendanceDailyRecord.findMany({
            where: activeAttendanceWhere(
              selectedPickerIds,
              period.dateFromValue,
              period.dateToValue
            ),
            select: attendanceSummarySelect
          })
        : Promise.resolve([]),
      this.prisma.ordersKpiDailyRecord.findMany({
        where: ordersKpiWhereForVendors(
          [selectedVendorId],
          period.dateFromValue,
          period.dateToExclusiveValue
        ),
        select: ordersKpiSummarySelect
      }),
      this.prisma.ordersKpiDailyRecord.findMany({
        where: ordersKpiWhereForBranchRanking(
          period.dateFromValue,
          period.dateToExclusiveValue
        ),
        select: ordersKpiSummarySelect
      }),
      this.ordersKpiTargetSettingsService.getTargetSettingsForReport(),
      this.prisma.request.findMany({
        where: {
          type: { not: RequestType.DEDUCTION },
          OR: [
            { sourceVendorId: selectedVendorId },
            { destinationVendorId: selectedVendorId }
          ]
        },
        include: workspaceRequestInclude,
        orderBy: { createdAt: "desc" },
        take: 6
      })
    ]);

    const attendance = buildChampAttendanceSummary(attendanceRecords);
    const selectedKpi = summarizeOrdersKpi(selectedBranchKpiRecords);
    const ordersKpi = buildChampOrdersKpiSummary(
      selectedKpi,
      targetSettings,
      selectedBranchKpiRecords
    );

    return {
      period: {
        dateFrom: period.dateFrom,
        dateTo: period.dateTo
      },
      scope: {
        champName: champ.nameEn,
        selectedVendorId,
        selectedBranch: {
          vendorId: selectedAssignment.vendorId,
          vendorName: selectedAssignment.vendor.vendorName,
          chainId: selectedAssignment.vendor.chainId,
          chainName: selectedAssignment.vendor.chain.chainName,
          areaManagerName:
            areaManagerAssignment?.areaManager.nameEn ?? null,
          activePickersCount: selectedPickerAssignments.length
        },
        branches
      },
      quickActions: buildChampQuickActions(selectedVendorId),
      attendance,
      ordersKpi,
      branchRanking: buildBranchRankingSummary({
        records: rankingKpiRecords,
        selectedVendorId,
        selectedChainId: selectedAssignment.vendor.chainId,
        selectedAttendanceHealthRate: attendance.attendanceHealthRate ?? null,
        minOrdersRequired: minBranchOrders
      }),
      pickerPerformance: buildPickerPerformanceSummaryRows({
        assignments: selectedPickerAssignments,
        attendanceRecords,
        kpiRecords: selectedBranchKpiRecords,
        minOrders: minPickerOrders,
        targetSettings
      }),
      recentRequests: buildChampRecentRequests(recentRequests)
    };
  }

  async getChampBranches(userId: string) {
    await this.getUserOrThrow(userId);
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId: userId, status: AssignmentStatus.ACTIVE },
      include: champBranchInclude,
      orderBy: { createdAt: "desc" }
    });
    const pendingRequestsByTargetUserId =
      await this.getPendingLifecycleRequestsByTargetUserId(
        assignments.flatMap((assignment) =>
          assignment.vendor.pickerAssignments.map(
            (pickerAssignment) => pickerAssignment.pickerId
          )
        )
      );

    const branches = await Promise.all(
      assignments.map((assignment) =>
        this.toChampBranchSummary(
          assignment,
          userId,
          pendingRequestsByTargetUserId
        )
      )
    );

    return {
      branches,
      totals: {
        branches: branches.length,
        activePickers: branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        ),
        pendingRequests: branches.reduce(
          (total, branch) => total + branch.pendingRequestCount,
          0
        ),
        recentRequests: branches.reduce(
          (total, branch) => total + branch.recentRequestCount,
          0
        )
      }
    };
  }

  async getChampBranchDetail(userId: string, vendorId: string) {
    await this.getUserOrThrow(userId);
    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: { champId: userId, vendorId, status: AssignmentStatus.ACTIVE },
      include: champBranchInclude
    });

    if (!assignment) {
      throw new NotFoundException("Assigned Branch was not found.");
    }

    const [
      areaManagerAssignment,
      recentRequests,
      recentRequestCount,
      pendingRequestCount
    ] = await this.prisma.$transaction([
      this.prisma.chainAreaManagerAssignment.findFirst({
        where: {
          chainId: assignment.vendor.chainId,
          status: AssignmentStatus.ACTIVE
        },
        include: { areaManager: true }
      }),
      this.prisma.request.findMany({
        where: { createdById: userId, sourceVendorId: vendorId },
        include: workspaceRequestInclude,
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      this.prisma.request.count({
        where: { createdById: userId, sourceVendorId: vendorId }
      }),
      this.prisma.request.count({
        where: {
          createdById: userId,
          sourceVendorId: vendorId,
          status: { in: pendingRequestStatuses }
        }
      })
    ]);

    const pendingRequestsByTargetUserId =
      await this.getPendingLifecycleRequestsByTargetUserId(
        assignment.vendor.pickerAssignments.map(
          (pickerAssignment) => pickerAssignment.pickerId
        )
      );
    const branch = this.mapChampBranchAssignment(
      assignment,
      pendingRequestsByTargetUserId
    );

    return {
      ...branch,
      areaManagerAssignment: areaManagerAssignment
        ? {
            id: areaManagerAssignment.id,
            status: areaManagerAssignment.status,
            startDate: areaManagerAssignment.startDate,
            endDate: areaManagerAssignment.endDate
          }
        : null,
      areaManager: areaManagerAssignment
        ? toUserSummary(areaManagerAssignment.areaManager)
        : null,
      recentRequests: recentRequests.map(toRequestSummary),
      recentRequestCount,
      pendingRequestCount
    };
  }

  async getAreaManagerWorkspace(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: { areaManagerId: userId, status: AssignmentStatus.ACTIVE },
      include: areaManagerChainInclude,
      orderBy: { createdAt: "desc" }
    });
    const pendingRequestsByTargetUserId =
      await this.getPendingLifecycleRequestsByTargetUserId(
        assignments.flatMap((assignment) =>
          assignment.chain.vendors.flatMap((vendor) => [
            ...vendor.pickerAssignments.map(
              (pickerAssignment) => pickerAssignment.pickerId
            ),
            ...vendor.champAssignments.map(
              (champAssignment) => champAssignment.champId
            )
          ])
        )
      );

    const usersById = new Map<string, ReturnType<typeof toUserSummary>>();
    const chains = assignments.map((assignment) => {
      const vendors = assignment.chain.vendors.map((vendor) => {
        const pickers = vendor.pickerAssignments.map((pickerAssignment) => {
          const picker = toUserSummary(pickerAssignment.picker);
          usersById.set(picker.id, picker);

          return {
            assignment: {
              id: pickerAssignment.id,
              status: pickerAssignment.status,
              startDate: pickerAssignment.startDate
            },
            picker,
            pendingRequest: pendingRequestsByTargetUserId.get(picker.id) ?? null
          };
        });
        const champs = vendor.champAssignments.map((champAssignment) => {
          const champ = toUserSummary(champAssignment.champ);
          usersById.set(champ.id, champ);

          return {
            assignment: {
              id: champAssignment.id,
              status: champAssignment.status,
              startDate: champAssignment.startDate
            },
            champ,
            pendingRequest: pendingRequestsByTargetUserId.get(champ.id) ?? null
          };
        });

        return {
          vendor: toVendorSummary(vendor),
          activePickerCount: pickers.length,
          activeChampCount: champs.length,
          pickers,
          champs
        };
      });

      return {
        assignment: {
          id: assignment.id,
          status: assignment.status,
          startDate: assignment.startDate
        },
        chain: toChainSummary(assignment.chain),
        vendorCount: vendors.length,
        activePickerCount: vendors.reduce(
          (total, vendor) => total + vendor.activePickerCount,
          0
        ),
        activeChampCount: vendors.reduce(
          (total, vendor) => total + vendor.activeChampCount,
          0
        ),
        vendors
      };
    });

    return {
      areaManager: toUserSummary(user),
      chains,
      usersUnderMe: Array.from(usersById.values()),
      totals: {
        chains: chains.length,
        vendors: chains.reduce((total, chain) => total + chain.vendorCount, 0),
        activePickers: chains.reduce(
          (total, chain) => total + chain.activePickerCount,
          0
        ),
        activeChamps: chains.reduce(
          (total, chain) => total + chain.activeChampCount,
          0
        )
      },
      placeholders: {
        requests: "Request visibility is scoped to assigned Chains.",
        approvals: "Approval ownership is derived from active Chain Area Manager assignments."
      }
    };
  }

  async getAdminWorkspace() {
    const [
      chains,
      activeChains,
      vendors,
      activeVendors,
      users,
      activeUsers,
      activePickerAssignments,
      activeChampAssignments,
      activeAreaManagerAssignments,
      recentChains,
      recentVendors,
      recentUsers
    ] = await this.prisma.$transaction([
      this.prisma.chain.count(),
      this.prisma.chain.count({ where: { status: ChainStatus.ACTIVE } }),
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: VendorStatus.ACTIVE } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { accountStatus: AccountStatus.ACTIVE } }),
      this.prisma.pickerBranchAssignment.count({
        where: { status: AssignmentStatus.ACTIVE }
      }),
      this.prisma.vendorChampAssignment.count({
        where: { status: AssignmentStatus.ACTIVE }
      }),
      this.prisma.chainAreaManagerAssignment.count({
        where: { status: AssignmentStatus.ACTIVE }
      }),
      this.prisma.chain.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      this.prisma.vendor.findMany({
        include: { chain: true },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    return {
      totals: {
        chains,
        activeChains,
        vendors,
        activeVendors,
        users,
        activeUsers,
        activePickerAssignments,
        activeChampAssignments,
        activeAreaManagerAssignments
      },
      recent: {
        chains: recentChains.map(toChainSummary),
        vendors: recentVendors.map(toVendorSummary),
        users: recentUsers.map(toUserSummary)
      },
      placeholders: {
        pendingAdminActions:
          "Pending Admin lifecycle actions are available from /admin/pending-actions."
      }
    };
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("Current user was not found.");
    }

    return user;
  }

  private async toChampBranchSummary(
    assignment: ChampBranchAssignment,
    champId: string,
    pendingRequestsByTargetUserId: Map<string, PendingLifecycleRequestSummary>
  ) {
    const [recentRequestCount, pendingRequestCount] = await this.prisma.$transaction([
      this.prisma.request.count({
        where: { createdById: champId, sourceVendorId: assignment.vendorId }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          sourceVendorId: assignment.vendorId,
          status: { in: pendingRequestStatuses }
        }
      })
    ]);

    return {
      ...this.mapChampBranchAssignment(assignment, pendingRequestsByTargetUserId),
      recentRequestCount,
      pendingRequestCount
    };
  }

  private mapChampBranchAssignment(
    assignment: ChampBranchAssignment,
    pendingRequestsByTargetUserId: Map<string, PendingLifecycleRequestSummary>
  ) {
    const pickers = assignment.vendor.pickerAssignments.map((pickerAssignment) => ({
      assignment: {
        id: pickerAssignment.id,
        status: pickerAssignment.status,
        startDate: pickerAssignment.startDate,
        endDate: pickerAssignment.endDate
      },
      picker: toUserSummary(pickerAssignment.picker),
      pendingRequest:
        pendingRequestsByTargetUserId.get(pickerAssignment.pickerId) ?? null
    }));

    return {
      assignment: {
        id: assignment.id,
        status: assignment.status,
        startDate: assignment.startDate,
        endDate: assignment.endDate
      },
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain),
      activePickerCount: pickers.length,
      pickers
    };
  }

  private async getPendingLifecycleRequestsByTargetUserId(targetUserIds: string[]) {
    const uniqueTargetUserIds = Array.from(new Set(targetUserIds));

    if (!uniqueTargetUserIds.length) {
      return new Map<string, PendingLifecycleRequestSummary>();
    }

    const requests = await this.prisma.request.findMany({
      where: {
        targetUserId: { in: uniqueTargetUserIds },
        type: { in: [RequestType.RESIGNATION, RequestType.TRANSFER] },
        status: { in: pendingRequestStatuses }
      },
      select: {
        id: true,
        type: true,
        status: true,
        currentStep: true,
        targetUserId: true,
        createdAt: true
      },
      orderBy: [{ targetUserId: "asc" }, { createdAt: "desc" }]
    });
    const mapped = new Map<string, PendingLifecycleRequestSummary>();

    for (const request of requests) {
      if (!request.targetUserId || mapped.has(request.targetUserId)) {
        continue;
      }

      mapped.set(request.targetUserId, {
        id: request.id,
        type: request.type,
        status: request.status,
        currentStep: request.currentStep,
        createdAt: request.createdAt
      });
    }

    return mapped;
  }

  private getProfileCompletion(user: User) {
    const missingFields = [
      ["nationalId", user.nationalId],
      ["address", user.address],
      ["dateOfBirth", user.dateOfBirth],
      ["joiningDate", user.joiningDate]
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    return {
      status: user.profileStatus,
      missingFields
    };
  }
}

function parsePickerPerformancePeriod(query: PickerPerformanceSummaryQueryDto) {
  const dateFromValue = parseDateOnly(query.dateFrom, "dateFrom");
  const dateToValue = parseDateOnly(query.dateTo, "dateTo");

  if (dateToValue < dateFromValue) {
    throw new BadRequestException("dateTo must be on or after dateFrom.");
  }

  const periodDays = inclusiveDays(dateFromValue, dateToValue);
  const previousDateToValue = addUtcDays(dateFromValue, -1);
  const previousDateFromValue = addUtcDays(previousDateToValue, 1 - periodDays);

  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    label: query.period ?? periodLabelForRange(dateFromValue, dateToValue),
    dateFromValue,
    dateToValue,
    dateToExclusiveValue: addUtcDays(dateToValue, 1),
    previousDateFromValue,
    previousDateToValue
  };
}

function parseChampPerformancePeriod(query: ChampPerformanceSummaryQueryDto) {
  const dateFromValue = parseDateOnly(query.dateFrom, "dateFrom");
  const dateToValue = parseDateOnly(query.dateTo, "dateTo");

  if (dateToValue < dateFromValue) {
    throw new BadRequestException("dateTo must be on or after dateFrom.");
  }

  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    dateFromValue,
    dateToValue,
    dateToExclusiveValue: addUtcDays(dateToValue, 1),
    days: inclusiveDays(dateFromValue, dateToValue)
  };
}

function periodLabelForRange(
  dateFrom: Date,
  dateTo: Date
): PickerPerformancePeriodLabel {
  const days = inclusiveDays(dateFrom, dateTo);
  const fromDay = dateFrom.getUTCDate();
  const sameMonth =
    dateFrom.getUTCFullYear() === dateTo.getUTCFullYear() &&
    dateFrom.getUTCMonth() === dateTo.getUTCMonth();
  const startsQuarter =
    fromDay === 1 && [0, 3, 6, 9].includes(dateFrom.getUTCMonth());

  if (startsQuarter && days >= 75) {
    return "THIS_QUARTER";
  }

  if (fromDay === 1 && sameMonth) {
    return "THIS_MONTH";
  }

  if (days <= 7) {
    return "LAST_WEEK";
  }

  if (days >= 75) {
    return "THIS_QUARTER";
  }

  return "CUSTOM";
}

function parseDateOnly(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return date;
}

function addUtcDays(date: Date, days: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      0,
      0,
      0,
      0
    )
  );
}

function inclusiveDays(dateFrom: Date, dateTo: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((dateTo.getTime() - dateFrom.getTime()) / msPerDay) + 1;
}

function endOfUtcDate(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function activeAttendanceWhere(
  userId: string | string[],
  dateFrom: Date,
  dateTo: Date
): Prisma.AttendanceDailyRecordWhereInput {
  return {
    userId: Array.isArray(userId) ? { in: userId } : userId,
    shiftDate: { gte: dateFrom, lte: endOfUtcDate(dateTo) },
    importBatch: { is: { status: AttendanceImportBatchStatus.ACTIVE } }
  };
}

function ordersKpiWhereForUsers(
  userIds: string[],
  dateFrom: Date,
  dateToExclusive: Date
): Prisma.OrdersKpiDailyRecordWhereInput {
  return {
    userId: { in: userIds },
    pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_PICKER,
    kpiDate: { gte: dateFrom, lt: dateToExclusive },
    sourceBatch: { is: { status: OrdersKpiImportBatchStatus.CONFIRMED } }
  };
}

function ordersKpiWhereForVendors(
  vendorIds: string[],
  dateFrom: Date,
  dateToExclusive: Date
): Prisma.OrdersKpiDailyRecordWhereInput {
  return {
    matchedVendorId: { in: vendorIds },
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    kpiDate: { gte: dateFrom, lt: dateToExclusive },
    sourceBatch: { is: { status: OrdersKpiImportBatchStatus.CONFIRMED } }
  };
}

function ordersKpiWhereForBranchRanking(
  dateFrom: Date,
  dateToExclusive: Date
): Prisma.OrdersKpiDailyRecordWhereInput {
  return {
    matchedVendorId: { not: null },
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    kpiDate: { gte: dateFrom, lt: dateToExclusive },
    sourceBatch: { is: { status: OrdersKpiImportBatchStatus.CONFIRMED } }
  };
}

function buildAttendanceSummary(
  records: AttendanceSummaryRecord[],
  previousRecords: AttendanceSummaryRecord[]
) {
  const current = summarizeAttendanceRecords(records);
  const previous = summarizeAttendanceRecords(previousRecords);
  const attendanceHealthRate = percentage(
    current.cleanShifts,
    current.totalShifts
  );
  const previousAttendanceHealthRate = percentage(
    previous.cleanShifts,
    previous.totalShifts
  );
  const attendanceHealthRateDelta =
    attendanceHealthRate === null || previousAttendanceHealthRate === null
      ? null
      : roundTwoDecimals(attendanceHealthRate - previousAttendanceHealthRate);

  return {
    available: current.totalShifts > 0,
    attendanceRate: attendanceHealthRate,
    previousAttendanceRate: previousAttendanceHealthRate,
    attendanceRateDelta: attendanceHealthRateDelta,
    attendanceHealthRate,
    previousAttendanceHealthRate,
    attendanceHealthRateDelta,
    presenceRate: percentage(current.attendedShifts, current.scheduledShifts),
    totalShifts: current.totalShifts,
    cleanShifts: current.cleanShifts,
    issueShifts: current.issueShifts,
    series: buildAttendanceTrend(records),
    scheduledShifts: current.scheduledShifts,
    attendedShifts: current.attendedShifts,
    totalShiftErrors:
      current.lateCount +
      current.absentCount +
      current.under8HoursCount +
      current.over15HoursCount,
    lateCount: current.lateCount,
    absentCount: current.absentCount,
    under8Count: current.under8HoursCount,
    over15Count: current.over15HoursCount,
    under8HoursCount: current.under8HoursCount,
    over15HoursCount: current.over15HoursCount
  };
}

function summarizeAttendanceRecords(records: AttendanceSummaryRecord[]) {
  let totalShifts = 0;
  let scheduledShifts = 0;
  let attendedShifts = 0;
  let cleanShifts = 0;
  let issueShifts = 0;
  let lateCount = 0;
  let absentCount = 0;
  let under8HoursCount = 0;
  let over15HoursCount = 0;

  for (const record of records) {
    const attended = isAttendedShift(record);
    const absent = isAbsentShift(record);
    const issue = isIssueShift(record);

    if (attended || absent) {
      scheduledShifts += 1;
    }

    if (attended || absent || issue) {
      totalShifts += 1;

      if (issue) {
        issueShifts += 1;
      } else {
        cleanShifts += 1;
      }
    }

    if (attended) {
      attendedShifts += 1;
    }

    if (isLateShift(record)) {
      lateCount += 1;
    }

    if (absent) {
      absentCount += 1;
    }

    if (record.isUnder8Hours) {
      under8HoursCount += 1;
    }

    if (record.isOver15Hours) {
      over15HoursCount += 1;
    }
  }

  return {
    totalShifts,
    scheduledShifts,
    attendedShifts,
    cleanShifts,
    issueShifts,
    lateCount,
    absentCount,
    under8HoursCount,
    over15HoursCount
  };
}

function isAttendedShift(record: AttendanceSummaryRecord) {
  if (isAbsentShift(record)) {
    return false;
  }

  return (
    record.isOnTime ||
    record.isLate ||
    record.isUnder8Hours ||
    record.isOver15Hours ||
    record.calculatedStatus === "ON_TIME" ||
    record.calculatedStatus === "LATE"
  );
}

function isAbsentShift(record: AttendanceSummaryRecord) {
  return record.isAbsent || record.calculatedStatus === "ABSENT";
}

function isIssueShift(record: AttendanceSummaryRecord) {
  return (
    isAbsentShift(record) ||
    isLateShift(record) ||
    record.isUnder8Hours ||
    record.isOver15Hours ||
    record.issuesCount > 0
  );
}

function isLateShift(record: AttendanceSummaryRecord) {
  return record.isLate || record.calculatedStatus === "LATE";
}

function buildAttendanceTrend(records: AttendanceSummaryRecord[]) {
  return Array.from(groupBy(records, (record) => dateKey(record.shiftDate)))
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, dailyRecords]) => {
      const summary = summarizeAttendanceRecords(dailyRecords);

      return {
        date,
        totalShifts: summary.totalShifts,
        cleanShifts: summary.cleanShifts,
        issueShifts: summary.issueShifts,
        attendanceHealthRate: percentage(
          summary.cleanShifts,
          summary.totalShifts
        ),
        totalShiftErrors:
          summary.lateCount +
          summary.absentCount +
          summary.under8HoursCount +
          summary.over15HoursCount
      };
    });
}

function summarizeOrdersKpi(records: OrdersKpiSummaryRecord[]) {
  return records.reduce(
    (summary, record) => ({
      totalOrders: summary.totalOrders + record.totalOrders,
      unhealthyOrders: summary.unhealthyOrders + record.unhealthyOrders,
      orderNotOnTime: summary.orderNotOnTime + record.orderNotOnTime,
      qcFailedOrders: summary.qcFailedOrders + record.qcFailedOrders,
      partialRefund: summary.partialRefund + record.partialRefund,
      outOfStock: summary.outOfStock + record.outOfStock,
      priceModified: summary.priceModified + record.priceModified
    }),
    {
      totalOrders: 0,
      unhealthyOrders: 0,
      orderNotOnTime: 0,
      qcFailedOrders: 0,
      partialRefund: 0,
      outOfStock: 0,
      priceModified: 0
    }
  );
}

function buildOrdersKpiSummary(
  summary: ReturnType<typeof summarizeOrdersKpi>,
  targetSettings: OrdersKpiTargetSettingsForSummary,
  records: OrdersKpiSummaryRecord[] = []
) {
  const unhealthyRate = percentage(summary.unhealthyOrders, summary.totalOrders);
  const orderNotOnTimeRate = percentage(
    summary.orderNotOnTime,
    summary.totalOrders
  );
  const targetAvailable = targetSettings.source === "SAVED";
  const unhealthyRateTarget = targetAvailable
    ? targetSettings.targets.uhoRateTarget
    : null;

  return {
    available: summary.totalOrders > 0,
    totalOrders: summary.totalOrders,
    unhealthyOrders: summary.unhealthyOrders,
    unhealthyRate,
    orderNotOnTime: summary.orderNotOnTime,
    orderNotOnTimeRate,
    qcFailedOrders: summary.qcFailedOrders,
    partialRefund: summary.partialRefund,
    outOfStock: summary.outOfStock,
    priceModified: summary.priceModified,
    series: buildOrdersKpiTrend(records),
    target: {
      configured: targetAvailable,
      unhealthyRateTarget,
      status:
        !targetAvailable || unhealthyRate === null || unhealthyRateTarget === null
          ? "NO_TARGET"
          : unhealthyRate <= unhealthyRateTarget
            ? "IN_TARGET"
            : "OUT_OF_TARGET"
    }
  };
}

function buildOrdersKpiTrend(records: OrdersKpiSummaryRecord[]) {
  return Array.from(groupBy(records, (record) => dateKey(record.kpiDate)))
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, dailyRecords]) => {
      const summary = summarizeOrdersKpi(dailyRecords);

      return {
        date,
        totalOrders: summary.totalOrders,
        unhealthyOrders: summary.unhealthyOrders,
        unhealthyRate: percentage(summary.unhealthyOrders, summary.totalOrders)
      };
    });
}

function uniquePickerAssignments(assignments: ActivePickerRankingAssignment[]) {
  const byPickerId = new Map<string, ActivePickerRankingAssignment>();

  for (const assignment of assignments) {
    if (!byPickerId.has(assignment.pickerId)) {
      byPickerId.set(assignment.pickerId, assignment);
    }
  }

  return Array.from(byPickerId.values());
}

function buildRankingMetrics(
  activeAssignments: ActivePickerRankingAssignment[],
  kpiRecords: OrdersKpiSummaryRecord[],
  attendanceRecords: AttendanceSummaryRecord[]
) {
  const assignmentPickerIds = new Set(
    activeAssignments.map((assignment) => assignment.pickerId)
  );
  const kpiByPickerId = groupBy(
    kpiRecords.filter(
      (record): record is OrdersKpiSummaryRecord & { userId: string } =>
        typeof record.userId === "string" && assignmentPickerIds.has(record.userId)
    ),
    (record) => record.userId
  );
  const attendanceByPickerId = groupBy(attendanceRecords, (record) => record.userId);
  const metrics = new Map<string, PickerRankingMetric>();

  for (const [pickerId, records] of kpiByPickerId) {
    const kpi = summarizeOrdersKpi(records);
    const attendance = summarizeAttendanceRecords(
      attendanceByPickerId.get(pickerId) ?? []
    );

    metrics.set(pickerId, {
      pickerId,
      totalOrders: kpi.totalOrders,
      unhealthyOrders: kpi.unhealthyOrders,
      unhealthyRate: percentage(kpi.unhealthyOrders, kpi.totalOrders) ?? 0,
      attendanceRate: percentage(
        attendance.attendedShifts,
        attendance.scheduledShifts
      )
    });
  }

  return metrics;
}

function buildPickerRankingSummary({
  activeAssignments,
  currentAssignment,
  currentPickerId,
  metricsByPickerId,
  previousMetricsByPickerId,
  minOrders
}: {
  activeAssignments: ActivePickerRankingAssignment[];
  currentAssignment: {
    pickerId: string;
    vendorId: string;
    vendor: { chainId: string };
  } | null;
  currentPickerId: string;
  metricsByPickerId: Map<string, PickerRankingMetric>;
  previousMetricsByPickerId: Map<string, PickerRankingMetric>;
  minOrders: number;
}) {
  const branchAssignments = currentAssignment
    ? activeAssignments.filter(
        (assignment) => assignment.vendorId === currentAssignment.vendorId
      )
    : [];
  const chainAssignments = currentAssignment
    ? activeAssignments.filter(
        (assignment) =>
          assignment.vendor.chainId === currentAssignment.vendor.chainId
      )
    : [];

  return {
    basis: "UHO_VOLUME_AWARE",
    minOrders,
    branch: buildRankSummary(
      branchAssignments,
      currentPickerId,
      metricsByPickerId,
      previousMetricsByPickerId,
      minOrders
    ),
    chain: buildRankSummary(
      chainAssignments,
      currentPickerId,
      metricsByPickerId,
      previousMetricsByPickerId,
      minOrders
    ),
    allTeam: buildRankSummary(
      activeAssignments,
      currentPickerId,
      metricsByPickerId,
      previousMetricsByPickerId,
      minOrders
    )
  };
}

function buildRankSummary(
  assignments: ActivePickerRankingAssignment[],
  currentPickerId: string,
  metricsByPickerId: Map<string, PickerRankingMetric>,
  previousMetricsByPickerId: Map<string, PickerRankingMetric>,
  minOrders: number
) {
  const scopePickerIds = new Set(
    assignments.map((assignment) => assignment.pickerId)
  );
  const currentMetric = metricsByPickerId.get(currentPickerId);
  const eligible = buildEligibleRankingMetrics(
    assignments,
    metricsByPickerId,
    minOrders
  );

  if (!scopePickerIds.has(currentPickerId)) {
    return unrankedSummary(
      "NOT_IN_SCOPE",
      "Not ranked - not in scope",
      eligible.length,
      minOrders,
      currentMetric
    );
  }

  if (!currentMetric) {
    return unrankedSummary(
      "NO_KPI_RECORDS",
      "Not ranked - no KPI records",
      eligible.length,
      minOrders,
      null
    );
  }

  if (currentMetric.totalOrders < minOrders) {
    return unrankedSummary(
      "LOW_ORDER_VOLUME",
      "Not ranked - low order volume",
      eligible.length,
      minOrders,
      currentMetric
    );
  }

  const rank = eligible.findIndex((metric) => metric.pickerId === currentPickerId) + 1;
  const previousRank = rankInScope(
    assignments,
    currentPickerId,
    previousMetricsByPickerId,
    minOrders
  );

  return {
    ranked: true,
    rank,
    previousRank,
    rankChange: previousRank === null ? null : previousRank - rank,
    totalEligible: eligible.length,
    displayLabel: `#${rank} / ${eligible.length}`,
    percentile: Math.ceil((rank / Math.max(eligible.length, 1)) * 100),
    percentileLabel: `Top ${Math.ceil((rank / Math.max(eligible.length, 1)) * 100)}%`,
    reason: null,
    minOrders,
    totalOrders: currentMetric.totalOrders,
    unhealthyOrders: currentMetric.unhealthyOrders,
    unhealthyRate: roundTwoDecimals(currentMetric.unhealthyRate),
    attendanceRate: currentMetric.attendanceRate
  };
}

function buildEligibleRankingMetrics(
  assignments: ActivePickerRankingAssignment[],
  metricsByPickerId: Map<string, PickerRankingMetric>,
  minOrders: number
) {
  return assignments
    .map((assignment) => metricsByPickerId.get(assignment.pickerId) ?? null)
    .filter(
      (metric): metric is PickerRankingMetric =>
        metric !== null && metric.totalOrders >= minOrders
    )
    .sort(compareRankingMetrics);
}

function rankInScope(
  assignments: ActivePickerRankingAssignment[],
  currentPickerId: string,
  metricsByPickerId: Map<string, PickerRankingMetric>,
  minOrders: number
) {
  const eligible = buildEligibleRankingMetrics(
    assignments,
    metricsByPickerId,
    minOrders
  );
  const rankIndex = eligible.findIndex(
    (metric) => metric.pickerId === currentPickerId
  );

  return rankIndex === -1 ? null : rankIndex + 1;
}

function compareRankingMetrics(
  left: PickerRankingMetric,
  right: PickerRankingMetric
) {
  const rateDiff = left.unhealthyRate - right.unhealthyRate;

  if (Math.abs(rateDiff) > 0.5) {
    return rateDiff;
  }

  if (left.totalOrders !== right.totalOrders) {
    return right.totalOrders - left.totalOrders;
  }

  if (rateDiff !== 0) {
    return rateDiff;
  }

  return (
    (right.attendanceRate ?? -1) - (left.attendanceRate ?? -1) ||
    left.pickerId.localeCompare(right.pickerId)
  );
}

function unrankedSummary(
  reason: PickerRankReason,
  displayLabel: string,
  totalEligible: number,
  minOrders: number,
  metric: PickerRankingMetric | null | undefined
) {
  return {
    ranked: false,
    rank: null,
    previousRank: null,
    rankChange: null,
    totalEligible,
    displayLabel,
    percentile: null,
    percentileLabel: null,
    reason,
    minOrders,
    totalOrders: metric?.totalOrders ?? 0,
    unhealthyOrders: metric?.unhealthyOrders ?? 0,
    unhealthyRate: metric ? roundTwoDecimals(metric.unhealthyRate) : null,
    attendanceRate: metric?.attendanceRate ?? null
  };
}

function buildAnnualLeaveSummary(balance: AnnualLeaveBalanceForSummary) {
  return {
    available: balance.eligibilityStatus === "ELIGIBLE",
    eligibilityStatus: balance.eligibilityStatus,
    balanceDays: roundTwoDecimals(
      balance.carriedBalanceDays + balance.currentYearAccruedDays
    ),
    takenDays: balance.annualTakenThisYear,
    remainingDays: balance.remainingDays,
    message: balance.message
  };
}

function sortChampAssignmentsByBranchName(assignments: ChampBranchAssignment[]) {
  return [...assignments].sort((left, right) =>
    left.vendor.vendorName.localeCompare(right.vendor.vendorName, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function resolveChampSelectedAssignment(
  assignments: ChampBranchAssignment[],
  vendorId?: string
) {
  if (!vendorId) {
    return assignments[0] ?? null;
  }

  const assignment = assignments.find((item) => item.vendorId === vendorId);

  if (!assignment) {
    throw new ForbiddenException("You do not have access to this Branch.");
  }

  return assignment;
}

function toChampPerformanceBranchOption(assignment: ChampBranchAssignment) {
  return {
    vendorId: assignment.vendorId,
    vendorName: assignment.vendor.vendorName,
    chainId: assignment.vendor.chainId,
    chainName: assignment.vendor.chain.chainName
  };
}

function emptyChampPerformanceSummary(
  champName: string,
  period: ReturnType<typeof parseChampPerformancePeriod>,
  branches: ReturnType<typeof toChampPerformanceBranchOption>[]
) {
  return {
    period: {
      dateFrom: period.dateFrom,
      dateTo: period.dateTo
    },
    scope: {
      champName,
      selectedVendorId: null,
      selectedBranch: null,
      branches
    },
    quickActions: buildDisabledChampQuickActions(),
    attendance: {
      available: false,
      reason: "No assigned Branch is available."
    },
    ordersKpi: {
      available: false,
      reason: "No assigned Branch is available."
    },
    branchRanking: {
      available: false,
      basis: "UHO_VOLUME_AWARE",
      minOrdersRequired: branchRankingMinOrdersForRange(
        period.dateFromValue,
        period.dateToValue
      ),
      reason: "No assigned Branch is available."
    },
    pickerPerformance: {
      available: false,
      rows: [],
      totalRows: 0,
      reason: "No assigned Branch is available."
    },
    recentRequests: {
      available: false,
      rows: [],
      reason: "No assigned Branch is available."
    }
  };
}

function buildChampQuickActions(vendorId: string) {
  return {
    newHire: {
      enabled: true,
      href: `/champ/branches/${vendorId}/new-hire`
    },
    transfer: {
      enabled: true,
      href: `/champ/branches/${vendorId}/transfer`
    },
    deduction: {
      enabled: true,
      href: "/deductions"
    },
    resignation: {
      enabled: true,
      href: `/champ/branches/${vendorId}/resignation`
    }
  };
}

function buildDisabledChampQuickActions() {
  return {
    newHire: { enabled: false },
    transfer: { enabled: false },
    deduction: { enabled: false },
    resignation: { enabled: false }
  };
}

function branchRankingMinOrdersForRange(
  dateFrom: Date,
  dateTo: Date,
  now = new Date()
) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const lastCompletedDay = addUtcDays(today, -1);
  const effectiveDateTo =
    dateTo > lastCompletedDay ? lastCompletedDay : dateTo;

  if (effectiveDateTo < dateFrom) {
    return 0;
  }

  return inclusiveDays(dateFrom, effectiveDateTo) * 50;
}

function pickerRankingMinOrdersForRange(days: number) {
  if (days <= 1) return 5;
  if (days <= 7) return 20;
  if (days <= 31) return 60;
  return 180;
}

function buildChampAttendanceSummary(records: AttendanceSummaryRecord[]) {
  const summary = summarizeAttendanceRecords(records);

  if (summary.totalShifts <= 0) {
    return {
      available: false,
      reason: "No active attendance shifts are available for this period."
    };
  }

  return {
    available: true,
    attendanceHealthRate: percentage(summary.cleanShifts, summary.totalShifts),
    totalShifts: summary.totalShifts,
    cleanShifts: summary.cleanShifts,
    issueShifts: summary.issueShifts,
    totalShiftErrors:
      summary.lateCount +
      summary.absentCount +
      summary.under8HoursCount +
      summary.over15HoursCount,
    lateCount: summary.lateCount,
    absentCount: summary.absentCount,
    under8Count: summary.under8HoursCount,
    over15Count: summary.over15HoursCount
  };
}

function buildChampOrdersKpiSummary(
  summary: ReturnType<typeof summarizeOrdersKpi>,
  targetSettings: OrdersKpiTargetSettingsForSummary,
  records: OrdersKpiSummaryRecord[]
) {
  if (summary.totalOrders <= 0) {
    return {
      available: false,
      reason: "No confirmed Orders KPI records are available for this period."
    };
  }

  const unhealthyRate = percentage(summary.unhealthyOrders, summary.totalOrders);
  const orderNotOnTimeRate = percentage(
    summary.orderNotOnTime,
    summary.totalOrders
  );
  const targetAvailable = targetSettings.source === "SAVED";
  const unhealthyRateTarget = targetAvailable
    ? targetSettings.targets.uhoRateTarget
    : null;

  return {
    available: true,
    totalOrders: summary.totalOrders,
    unhealthyOrders: summary.unhealthyOrders,
    unhealthyRate,
    orderNotOnTime: summary.orderNotOnTime,
    orderNotOnTimeRate,
    target: {
      configured: targetAvailable,
      unhealthyRateTarget,
      status:
        !targetAvailable || unhealthyRate === null || unhealthyRateTarget === null
          ? "NO_TARGET"
          : unhealthyRate <= unhealthyRateTarget
            ? "IN_TARGET"
            : "OUT_OF_TARGET"
    },
    trend: buildOrdersKpiTrend(records).map((point) => ({
      date: point.date,
      unhealthyRate: point.unhealthyRate ?? 0,
      totalOrders: point.totalOrders,
      unhealthyOrders: point.unhealthyOrders
    }))
  };
}

function buildBranchRankingSummary({
  records,
  selectedAttendanceHealthRate,
  selectedChainId,
  selectedVendorId,
  minOrdersRequired
}: {
  records: OrdersKpiSummaryRecord[];
  selectedAttendanceHealthRate: number | null;
  selectedChainId: string;
  selectedVendorId: string;
  minOrdersRequired: number;
}) {
  const metrics = buildBranchRankingMetrics(
    records,
    selectedVendorId,
    selectedAttendanceHealthRate
  );
  const chainMetrics = metrics.filter(
    (metric) => metric.chainId === selectedChainId
  );
  const chain = buildBranchRankSummary(
    chainMetrics,
    selectedVendorId,
    minOrdersRequired
  );
  const allBranches = buildBranchRankSummary(
    metrics,
    selectedVendorId,
    minOrdersRequired
  );

  return {
    available: chain.reason !== "NO_KPI_RECORDS",
    basis: "UHO_VOLUME_AWARE",
    minOrdersRequired,
    chain,
    allBranches
  };
}

function buildBranchRankingMetrics(
  records: OrdersKpiSummaryRecord[],
  selectedVendorId: string,
  selectedAttendanceHealthRate: number | null
) {
  return Array.from(
    groupBy(
      records.filter(
        (
          record
        ): record is OrdersKpiSummaryRecord & {
          matchedVendorId: string;
        } => typeof record.matchedVendorId === "string"
      ),
      (record) => record.matchedVendorId
    )
  ).map(([vendorId, vendorRecords]) => {
    const summary = summarizeOrdersKpi(vendorRecords);

    return {
      vendorId,
      chainId: vendorRecords[0]?.matchedChainId ?? null,
      totalOrders: summary.totalOrders,
      unhealthyOrders: summary.unhealthyOrders,
      unhealthyRate: percentage(summary.unhealthyOrders, summary.totalOrders) ?? 0,
      attendanceHealthRate:
        vendorId === selectedVendorId ? selectedAttendanceHealthRate : null
    };
  });
}

function buildBranchRankSummary(
  metrics: BranchRankingMetric[],
  selectedVendorId: string,
  minOrdersRequired: number
) {
  const selectedMetric = metrics.find(
    (metric) => metric.vendorId === selectedVendorId
  );
  const eligible = metrics
    .filter((metric) => metric.totalOrders >= minOrdersRequired)
    .sort(compareBranchRankingMetrics);

  if (!selectedMetric) {
    return {
      ranked: false,
      totalEligible: eligible.length,
      reason: "NO_KPI_RECORDS" as const,
      totalOrders: 0,
      unhealthyRate: null
    };
  }

  if (selectedMetric.totalOrders < minOrdersRequired) {
    return {
      ranked: false,
      totalEligible: eligible.length,
      reason: "LOW_ORDER_VOLUME" as const,
      totalOrders: selectedMetric.totalOrders,
      unhealthyRate: roundTwoDecimals(selectedMetric.unhealthyRate)
    };
  }

  const rank = eligible.findIndex(
    (metric) => metric.vendorId === selectedVendorId
  ) + 1;

  return {
    ranked: true,
    rank,
    totalEligible: eligible.length,
    totalOrders: selectedMetric.totalOrders,
    unhealthyRate: roundTwoDecimals(selectedMetric.unhealthyRate),
    displayLabel: `#${rank} / ${eligible.length}`
  };
}

function compareBranchRankingMetrics(
  left: BranchRankingMetric,
  right: BranchRankingMetric
) {
  const rateDiff = left.unhealthyRate - right.unhealthyRate;

  if (Math.abs(rateDiff) > 0.5) {
    return rateDiff;
  }

  if (left.totalOrders !== right.totalOrders) {
    return right.totalOrders - left.totalOrders;
  }

  if (rateDiff !== 0) {
    return rateDiff;
  }

  return (
    (right.attendanceHealthRate ?? -1) - (left.attendanceHealthRate ?? -1) ||
    left.vendorId.localeCompare(right.vendorId)
  );
}

function buildPickerPerformanceSummaryRows({
  assignments,
  attendanceRecords,
  kpiRecords,
  minOrders,
  targetSettings
}: {
  assignments: ChampBranchAssignment["vendor"]["pickerAssignments"];
  attendanceRecords: AttendanceSummaryRecord[];
  kpiRecords: OrdersKpiSummaryRecord[];
  minOrders: number;
  targetSettings: OrdersKpiTargetSettingsForSummary;
}) {
  const kpiByPickerId = groupBy(
    kpiRecords.filter(
      (record): record is OrdersKpiSummaryRecord & { userId: string } =>
        typeof record.userId === "string" &&
        record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_PICKER
    ),
    (record) => record.userId
  );
  const assignmentByPickerId = new Map(
    assignments.map((assignment) => [assignment.pickerId, assignment])
  );
  const attendanceByPickerId = groupBy(attendanceRecords, (record) => record.userId);
  const rankMap = buildPickerPerformanceRankMap(
    kpiByPickerId,
    attendanceByPickerId,
    minOrders
  );
  const target =
    targetSettings.source === "SAVED" ? targetSettings.targets.uhoRateTarget : null;
  const rows = Array.from(kpiByPickerId.entries())
    .map(([pickerId, pickerKpiRecords]) => {
      const assignment = assignmentByPickerId.get(pickerId);
      const firstKpiRecord = pickerKpiRecords[0];
      const kpi = summarizeOrdersKpi(pickerKpiRecords);
      const attendance = summarizeAttendanceRecords(
        attendanceByPickerId.get(pickerId) ?? []
      );
      const attendanceHealthRate = percentage(
        attendance.cleanShifts,
        attendance.totalShifts
      );
      const totalShiftErrors =
        attendance.lateCount +
        attendance.absentCount +
        attendance.under8HoursCount +
        attendance.over15HoursCount;
      const unhealthyRate = percentage(kpi.unhealthyOrders, kpi.totalOrders);
      const status = resolvePickerPerformanceStatus({
        attendanceHealthRate,
        issueShifts: attendance.issueShifts,
        minOrders,
        target,
        totalOrders: kpi.totalOrders,
        totalShiftErrors,
        unhealthyRate
      });
      const assignmentMismatch = !assignment;
      const reasonLabels = pickerPerformanceReasonLabels({
        attendanceHealthRate,
        minOrders,
        status,
        target,
        totalOrders: kpi.totalOrders,
        totalShiftErrors,
        unhealthyRate
      });

      if (assignmentMismatch) {
        reasonLabels.push("Wrong Branch assignment");
      }

      return {
        rank: rankMap.get(pickerId) ?? null,
        userId: pickerId,
        pickerName:
          assignment?.picker.nameEn ??
          firstKpiRecord?.pickerNameSnapshot ??
          firstKpiRecord?.sourcePickerKey ??
          pickerId,
        shopperId:
          assignment?.picker.shopperId ??
          firstKpiRecord?.sourceShopperId ??
          null,
        totalOrders: kpi.totalOrders,
        unhealthyOrders: kpi.unhealthyOrders,
        unhealthyRate,
        attendanceHealthRate,
        issueShifts: attendance.issueShifts,
        totalShiftErrors,
        status,
        assignmentMismatch,
        assignmentMismatchReason: assignmentMismatch
          ? "WRONG_BRANCH_ASSIGNMENT"
          : null,
        reasonLabels
      };
    })
    .sort(comparePickerPerformanceRows);

  return {
    available: rows.length > 0,
    rows,
    totalRows: rows.length,
    reason: rows.length
      ? undefined
      : "No confirmed Picker KPI records are available for this Branch."
  };
}

function buildPickerPerformanceRankMap(
  kpiByPickerId: Map<string, OrdersKpiSummaryRecord[]>,
  attendanceByPickerId: Map<string, AttendanceSummaryRecord[]>,
  minOrders: number
) {
  const metrics = Array.from(kpiByPickerId.entries())
    .map(([pickerId, records]) => {
      const kpi = summarizeOrdersKpi(records);
      const attendance = summarizeAttendanceRecords(
        attendanceByPickerId.get(pickerId) ?? []
      );

      if (kpi.totalOrders < minOrders) {
        return null;
      }

      return {
        pickerId,
        totalOrders: kpi.totalOrders,
        unhealthyOrders: kpi.unhealthyOrders,
        unhealthyRate: percentage(kpi.unhealthyOrders, kpi.totalOrders) ?? 0,
        attendanceRate: percentage(attendance.cleanShifts, attendance.totalShifts)
      };
    })
    .filter((metric): metric is PickerRankingMetric => metric !== null)
    .sort(compareRankingMetrics);
  const rankMap = new Map<string, number>();

  metrics.forEach((metric, index) => {
    rankMap.set(metric.pickerId, index + 1);
  });

  return rankMap;
}

function resolvePickerPerformanceStatus({
  attendanceHealthRate,
  issueShifts,
  minOrders,
  target,
  totalOrders,
  totalShiftErrors,
  unhealthyRate
}: {
  attendanceHealthRate: number | null;
  issueShifts: number;
  minOrders: number;
  target: number | null;
  totalOrders: number;
  totalShiftErrors: number;
  unhealthyRate: number | null;
}): PickerPerformanceStatus {
  if (totalOrders < minOrders) {
    return "LOW_VOLUME";
  }

  if (
    (target !== null && unhealthyRate !== null && unhealthyRate > target) ||
    (attendanceHealthRate !== null && attendanceHealthRate < 70) ||
    totalShiftErrors >= 3
  ) {
    return "NEEDS_ACTION";
  }

  if (
    (target !== null && unhealthyRate !== null && unhealthyRate >= target * 0.9) ||
    (attendanceHealthRate !== null && attendanceHealthRate < 85) ||
    issueShifts > 0
  ) {
    return "WATCH";
  }

  return "IN_TARGET";
}

function pickerPerformanceReasonLabels({
  attendanceHealthRate,
  minOrders,
  status,
  target,
  totalOrders,
  totalShiftErrors,
  unhealthyRate
}: {
  attendanceHealthRate: number | null;
  minOrders: number;
  status: PickerPerformanceStatus;
  target: number | null;
  totalOrders: number;
  totalShiftErrors: number;
  unhealthyRate: number | null;
}) {
  const reasons: string[] = [];

  if (totalOrders < minOrders) {
    reasons.push(`${totalOrders} of ${minOrders} required orders`);
  }

  if (target !== null && unhealthyRate !== null && unhealthyRate > target) {
    reasons.push("Out of UHO target");
  } else if (
    target !== null &&
    unhealthyRate !== null &&
    unhealthyRate >= target * 0.9
  ) {
    reasons.push("Near UHO target");
  }

  if (attendanceHealthRate !== null && attendanceHealthRate < 70) {
    reasons.push("Attendance health low");
  } else if (attendanceHealthRate !== null && attendanceHealthRate < 85) {
    reasons.push("Attendance watch");
  }

  if (totalShiftErrors > 0) {
    reasons.push(`${totalShiftErrors} shift issues`);
  }

  if (!reasons.length && status === "IN_TARGET") {
    reasons.push("In target");
  }

  return reasons;
}

function comparePickerPerformanceRows(
  left: {
    rank: number | null;
    totalOrders: number;
    unhealthyRate: number | null;
    attendanceHealthRate: number | null;
    status: PickerPerformanceStatus;
  },
  right: {
    rank: number | null;
    totalOrders: number;
    unhealthyRate: number | null;
    attendanceHealthRate: number | null;
    status: PickerPerformanceStatus;
  }
) {
  return (
    (left.rank ?? Number.MAX_SAFE_INTEGER) -
      (right.rank ?? Number.MAX_SAFE_INTEGER) ||
    pickerPerformanceStatusWeight[left.status] -
      pickerPerformanceStatusWeight[right.status] ||
    (left.unhealthyRate ?? Number.MAX_SAFE_INTEGER) -
      (right.unhealthyRate ?? Number.MAX_SAFE_INTEGER) ||
    right.totalOrders - left.totalOrders ||
    (right.attendanceHealthRate ?? -1) - (left.attendanceHealthRate ?? -1)
  );
}

function buildChampRecentRequests(requests: RequestWithRelations[]) {
  const rows = requests.map((request) => ({
    id: request.id,
    type: request.type,
    targetUserName: request.targetUser?.nameEn ?? null,
    targetShopperId: request.targetUser?.shopperId ?? null,
    requestedByName: request.createdBy.nameEn,
    status: request.status,
    ageLabel: requestAgeLabel(request.createdAt),
    createdAt: request.createdAt.toISOString()
  }));

  return {
    available: rows.length > 0,
    rows,
    reason: rows.length ? undefined : "No recent Branch requests are available."
  };
}

function requestAgeLabel(createdAt: Date) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
  );

  if (days === 0) {
    return "Today";
  }

  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K) {
  const grouped = new Map<K, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const values = grouped.get(key) ?? [];
    values.push(item);
    grouped.set(key, values);
  }

  return grouped;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return roundTwoDecimals((numerator / denominator) * 100);
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return Number(value);
}

function roundTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
