import { Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  AttendanceArchiveStatus,
  AttendanceMatchedRole,
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceBranchesQueryDto,
  AttendanceChainsQueryDto,
  AttendanceOverviewQueryDto,
  AttendanceUserDailyQueryDto,
  AttendanceUsersQueryDto
} from "./dto/attendance-report-query.dto";

const activePickerWhere = {
  status: AssignmentStatus.ACTIVE,
  picker: {
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    role: UserRole.PICKER
  }
} satisfies Prisma.PickerBranchAssignmentWhereInput;

const pendingRequestStatuses = [
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
];
const summaryOnlyDailyMessage =
  "Daily detail is no longer stored for this month. Monthly summary is available.";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAdminOverview() {
    const [
      totalChains,
      activeChains,
      totalVendors,
      activeVendors,
      usersByRole,
      usersByAccountStatus,
      usersByEmploymentStatus,
      usersByBlockStatus,
      requestsByType,
      requestsByStatus,
      pendingApprovalsCount,
      pendingAdminFinalActionsCount,
      profileCompletionSummary,
      archivedPickers,
      temporaryBlockArchivedUsers,
      permanentBlockArchivedUsers,
      noBlockArchivedUsers,
      activePickerAssignments,
      topVendorsRaw
    ] = await this.prisma.$transaction([
      this.prisma.chain.count(),
      this.prisma.chain.count({ where: { status: ChainStatus.ACTIVE } }),
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: VendorStatus.ACTIVE } }),
      this.prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
        orderBy: { role: "asc" }
      }),
      this.prisma.user.groupBy({
        by: ["accountStatus"],
        _count: { _all: true },
        orderBy: { accountStatus: "asc" }
      }),
      this.prisma.user.groupBy({
        by: ["employmentStatus"],
        _count: { _all: true },
        orderBy: { employmentStatus: "asc" }
      }),
      this.prisma.user.groupBy({
        by: ["blockStatus"],
        _count: { _all: true },
        orderBy: { blockStatus: "asc" }
      }),
      this.prisma.request.groupBy({
        by: ["type"],
        _count: { _all: true },
        orderBy: { type: "asc" }
      }),
      this.prisma.request.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      this.prisma.requestApproval.count({
        where: { status: ApprovalStatus.PENDING }
      }),
      this.prisma.request.count({
        where: {
          status: RequestStatus.PENDING_ADMIN,
          currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
          approvals: {
            some: {
              step: ApprovalStep.ADMIN_FINAL_APPROVAL,
              status: ApprovalStatus.PENDING
            }
          }
        }
      }),
      this.prisma.user.groupBy({
        by: ["profileStatus"],
        where: { role: UserRole.PICKER },
        _count: { _all: true },
        orderBy: { profileStatus: "asc" }
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.PICKER,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.user.count({
        where: {
          blockStatus: BlockStatus.TEMPORARY_BLOCK,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.user.count({
        where: {
          blockStatus: BlockStatus.PERMANENT_BLOCK,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.user.count({
        where: {
          blockStatus: BlockStatus.NO_BLOCK,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.pickerBranchAssignment.findMany({
        where: activePickerWhere,
        include: { vendor: { include: { chain: true } } }
      }),
      this.prisma.pickerBranchAssignment.groupBy({
        by: ["vendorId"],
        where: activePickerWhere,
        _count: { _all: true },
        orderBy: { _count: { vendorId: "desc" } },
        take: 8
      })
    ]);

    const topVendorIds = topVendorsRaw.map((item) => item.vendorId);
    const topVendors = topVendorIds.length
      ? await this.prisma.vendor.findMany({
          where: { id: { in: topVendorIds } },
          include: { chain: true }
        })
      : [];
    const vendorById = new Map(topVendors.map((vendor) => [vendor.id, vendor]));
    const chainCounts = new Map<
      string,
      { chain: ReturnType<typeof toChainSummary>; activePickerCount: number }
    >();

    activePickerAssignments.forEach((assignment) => {
      const chain = assignment.vendor.chain;
      const current = chainCounts.get(chain.id);
      chainCounts.set(chain.id, {
        chain: toChainSummary(chain),
        activePickerCount: (current?.activePickerCount ?? 0) + 1
      });
    });

    return {
      scopeSummary: { scope: "SYSTEM" },
      cards: {
        totalChains,
        activeChains,
        totalVendors,
        activeVendors,
        activePickers: activePickerAssignments.length,
        archivedDeactivatedPickers: archivedPickers,
        pendingApprovals: pendingApprovalsCount,
        pendingAdminFinalActions: pendingAdminFinalActionsCount
      },
      breakdowns: {
        usersByRole: enumCounts(UserRole, usersByRole, "role"),
        usersByAccountStatus: enumCounts(
          AccountStatus,
          usersByAccountStatus,
          "accountStatus"
        ),
        usersByEmploymentStatus: enumCounts(
          EmploymentStatus,
          usersByEmploymentStatus,
          "employmentStatus"
        ),
        usersByBlockStatus: enumCounts(
          BlockStatus,
          usersByBlockStatus,
          "blockStatus"
        ),
        requestsByType: enumCounts(RequestType, requestsByType, "type"),
        requestsByStatus: enumCounts(RequestStatus, requestsByStatus, "status"),
        profileCompletion: enumCounts(
          ProfileStatus,
          profileCompletionSummary,
          "profileStatus"
        ),
        archiveBlockSummary: {
          archivedUsers: archivedPickers,
          temporaryBlock: temporaryBlockArchivedUsers,
          permanentBlock: permanentBlockArchivedUsers,
          noBlockAmongArchived: noBlockArchivedUsers
        }
      },
      tables: {
        topChainsByActivePickerCount: Array.from(chainCounts.values())
          .sort((left, right) => right.activePickerCount - left.activePickerCount)
          .slice(0, 8),
        topVendorsByActivePickerCount: topVendorsRaw.map((item) => ({
          vendor: vendorById.get(item.vendorId)
            ? toVendorSummary(vendorById.get(item.vendorId)!)
            : null,
          activePickerCount: groupCount(item)
        }))
      }
    };
  }

  async getAttendanceMonths() {
    const [userGroups, branchGroups, chainGroups, dailyGroups, archiveRows] =
      await Promise.all([
        this.prisma.attendanceMonthlyUserSummary.groupBy({
          by: ["monthKey"],
          _count: { _all: true },
          orderBy: { monthKey: "desc" }
        }),
        this.prisma.attendanceMonthlyBranchSummary.groupBy({
          by: ["monthKey"],
          _count: { _all: true },
          orderBy: { monthKey: "desc" }
        }),
        this.prisma.attendanceMonthlyChainSummary.groupBy({
          by: ["monthKey"],
          _count: { _all: true },
          orderBy: { monthKey: "desc" }
        }),
        this.prisma.attendanceDailyRecord.groupBy({
          by: ["monthKey"],
          _count: { _all: true },
          orderBy: { monthKey: "desc" }
        }),
        this.prisma.attendanceMonthlyUserSummary.findMany({
          select: { monthKey: true, archiveStatus: true },
          orderBy: { monthKey: "desc" }
        })
      ]);

    const monthKeys = new Set<string>();
    const userCounts = countGroupsByMonth(userGroups);
    const branchCounts = countGroupsByMonth(branchGroups);
    const chainCounts = countGroupsByMonth(chainGroups);
    const dailyCounts = countGroupsByMonth(dailyGroups);
    const archiveByMonth = new Map<string, AttendanceArchiveStatus>();

    [userCounts, branchCounts, chainCounts, dailyCounts].forEach((counts) => {
      counts.forEach((_, monthKey) => monthKeys.add(monthKey));
    });
    archiveRows.forEach((row) => {
      monthKeys.add(row.monthKey);
      archiveByMonth.set(
        row.monthKey,
        mostRestrictiveArchiveStatus(
          archiveByMonth.get(row.monthKey),
          row.archiveStatus
        )
      );
    });

    return {
      items: Array.from(monthKeys)
        .sort((left, right) => right.localeCompare(left))
        .map((monthKey) => {
          const dailyRecordsCount = dailyCounts.get(monthKey) ?? 0;
          const userSummaryCount = userCounts.get(monthKey) ?? 0;

          return {
            monthKey,
            userSummaryCount,
            branchSummaryCount: branchCounts.get(monthKey) ?? 0,
            chainSummaryCount: chainCounts.get(monthKey) ?? 0,
            dailyRecordsCount,
            archiveStatus: resolveMonthArchiveStatus({
              archiveStatus: archiveByMonth.get(monthKey),
              dailyRecordsCount,
              monthKey,
              userSummaryCount
            }),
            summaryOnly: userSummaryCount > 0 && dailyRecordsCount === 0
          };
        })
    };
  }

  async getAttendanceOverview(query: AttendanceOverviewQueryDto) {
    const monthKey = resolveMonthKey(query.monthKey);
    const userWhere = attendanceUserWhere({
      chainId: query.chainId,
      monthKey,
      vendorId: query.vendorId
    });
    const branchWhere = attendanceBranchWhere({
      chainId: query.chainId,
      monthKey,
      vendorId: query.vendorId
    });
    const chainWhere = attendanceChainWhere({
      chainId: query.chainId,
      monthKey
    });
    const [userSummaries, branchSummaries, chainSummaries, dailyRecordsCount] =
      await Promise.all([
        this.prisma.attendanceMonthlyUserSummary.findMany({ where: userWhere }),
        this.prisma.attendanceMonthlyBranchSummary.findMany({
          where: branchWhere
        }),
        this.prisma.attendanceMonthlyChainSummary.findMany({
          where: chainWhere
        }),
        this.prisma.attendanceDailyRecord.count({ where: { monthKey } })
      ]);
    const totals = sumAttendanceMetrics(userSummaries);
    const pickerSummaries = userSummaries.filter(
      (summary) => summary.role === AttendanceMatchedRole.PICKER
    );
    const champSummaries = userSummaries.filter(
      (summary) => summary.role === AttendanceMatchedRole.CHAMP
    );
    const chainCount = query.vendorId
      ? new Set(branchSummaries.map((summary) => summary.chainId)).size
      : chainSummaries.length;
    const dailyRecordsAvailable =
      dailyRecordsCount > 0 ||
      userSummaries.some((summary) => summary.sourceDailyRecordsAvailable);

    return {
      monthKey,
      archiveStatus: resolveMonthArchiveStatus({
        archiveStatus: mostRestrictiveArchiveStatusFromRows(userSummaries),
        dailyRecordsCount,
        monthKey,
        userSummaryCount: userSummaries.length
      }),
      totalPickers: pickerSummaries.length,
      totalChamps: champSummaries.length,
      totalCreatedShifts: totals.totalCreatedShifts,
      totalShiftsNeeded: totals.totalShiftsNeeded,
      totalMissingShifts: totals.missingShifts,
      workedShiftCount: totals.workedShiftCount,
      absentCount: totals.absentCount,
      onLeaveCount: totals.onLeaveCount,
      annualLeaveCount: totals.annualLeaveCount,
      medicalLeaveCount: totals.medicalLeaveCount,
      offDayCount: totals.offDayCount,
      lateMinutesTotal: totals.lateMinutesTotal,
      lateLevel1Over15Count: totals.lateLevel1Over15Count,
      lateLevel2From31To45Count: totals.lateLevel2From31To45Count,
      lateLevel3Over45Count: totals.lateLevel3Over45Count,
      under8HoursCount: totals.under8HoursCount,
      over15HoursCount: totals.over15HoursCount,
      branchCount: branchSummaries.length,
      chainCount,
      summaryOnly: userSummaries.length > 0 && !dailyRecordsAvailable,
      dailyRecordsAvailable
    };
  }

  async getAttendanceChainSummaries(query: AttendanceChainsQueryDto) {
    const monthKey = resolveMonthKey(query.monthKey);
    const summaries = await this.prisma.attendanceMonthlyChainSummary.findMany({
      where: attendanceChainWhere({ monthKey }),
      include: { chain: true },
      orderBy: [{ missingShifts: "desc" }, { chainId: "asc" }]
    });

    return {
      monthKey,
      items: summaries.map((summary) => ({
        chainId: summary.chainId,
        chainName: summary.chain.chainName,
        branchCount: summary.branchCount,
        pickerCount: summary.pickerCount,
        totalCreatedShifts: summary.totalCreatedShifts,
        totalShiftsNeeded: summary.totalShiftsNeeded,
        missingShifts: summary.missingShifts,
        absentCount: summary.absentCount,
        lateLevel1Over15Count: summary.lateLevel1Over15Count,
        under8HoursCount: summary.under8HoursCount,
        over15HoursCount: summary.over15HoursCount
      }))
    };
  }

  async getAttendanceBranchSummaries(query: AttendanceBranchesQueryDto) {
    const monthKey = resolveMonthKey(query.monthKey);
    const summaries = await this.prisma.attendanceMonthlyBranchSummary.findMany({
      where: attendanceBranchWhere({ chainId: query.chainId, monthKey }),
      include: {
        chain: true,
        vendor: { include: { chain: true } }
      },
      orderBy: [{ missingShifts: "desc" }, { vendorId: "asc" }]
    });

    return {
      monthKey,
      items: summaries.map((summary) => ({
        vendorId: summary.vendorId,
        vendorName: summary.vendor.vendorName,
        vendorExternalId: summary.vendor.vendorExternalId,
        chainId: summary.chainId,
        chainName: summary.chain.chainName,
        pickerCount: summary.pickerCount,
        totalCreatedShifts: summary.totalCreatedShifts,
        totalShiftsNeeded: summary.totalShiftsNeeded,
        missingShifts: summary.missingShifts,
        absentCount: summary.absentCount,
        lateLevel1Over15Count: summary.lateLevel1Over15Count,
        under8HoursCount: summary.under8HoursCount,
        over15HoursCount: summary.over15HoursCount
      }))
    };
  }

  async getAttendanceUserSummaries(query: AttendanceUsersQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where = attendanceUserWhere({
      chainId: query.chainId,
      monthKey: resolveMonthKey(query.monthKey),
      role: query.role,
      search: query.search,
      vendorId: query.vendorId
    });
    const [total, summaries] = await Promise.all([
      this.prisma.attendanceMonthlyUserSummary.count({ where }),
      this.prisma.attendanceMonthlyUserSummary.findMany({
        where,
        include: attendanceUserSummaryInclude,
        orderBy: [{ role: "asc" }, { identifier: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: summaries.map(toAttendanceUserSummaryResponse),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getAttendanceUserDailyDetails(
    userId: string,
    query: AttendanceUserDailyQueryDto
  ) {
    const [summaries, records] = await Promise.all([
      this.prisma.attendanceMonthlyUserSummary.findMany({
        where: { monthKey: query.monthKey, userId },
        include: attendanceUserSummaryInclude,
        take: 1
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: { matchedUserId: userId, monthKey: query.monthKey },
        include: {
          assignmentChain: true,
          assignmentVendor: true
        },
        orderBy: { attendanceDate: "asc" }
      })
    ]);
    const summary = summaries[0]
      ? toAttendanceUserSummaryResponse(summaries[0])
      : null;

    if (records.length === 0) {
      return {
        dailyRecordsAvailable: false,
        message: summaryOnlyDailyMessage,
        summary,
        records: []
      };
    }

    return {
      dailyRecordsAvailable: true,
      message: null,
      summary,
      records: records.map((record) => ({
        attendanceDate: record.attendanceDate,
        status: record.status,
        shiftName: record.shiftName,
        scheduledStartAt: record.scheduledStartAt,
        scheduledEndAt: record.scheduledEndAt,
        actualCheckInAt: record.actualCheckInAt,
        actualCheckOutAt: record.actualCheckOutAt,
        actualWorkDurationHours: decimalToNumber(
          record.actualWorkDurationHours
        ),
        lateMinutes: record.lateMinutes,
        lateLevel1Over15: record.lateLevel1Over15,
        lateLevel2From31To45: record.lateLevel2From31To45,
        lateLevel3Over45: record.lateLevel3Over45,
        isAbsent: record.isAbsent,
        isOnLeave: record.isOnLeave,
        isAnnualLeave: record.isAnnualLeave,
        isMedicalLeave: record.isMedicalLeave,
        isOffDay: record.isOffDay,
        isUnder8Hours: record.isUnder8Hours,
        isOver15Hours: record.isOver15Hours,
        assignmentVendor: record.assignmentVendor
          ? {
              id: record.assignmentVendor.id,
              vendorName: record.assignmentVendor.vendorName,
              vendorExternalId: record.assignmentVendor.vendorExternalId
            }
          : null,
        assignmentChain: record.assignmentChain
          ? {
              id: record.assignmentChain.id,
              chainName: record.assignmentChain.chainName
            }
          : null
      }))
    };
  }

  async getAreaManagerOverview(areaManagerId: string) {
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: { areaManagerId, status: AssignmentStatus.ACTIVE },
      include: {
        chain: {
          include: {
            vendors: {
              include: {
                pickerAssignments: {
                  where: activePickerWhere,
                  include: { picker: true }
                },
                champAssignments: {
                  where: {
                    status: AssignmentStatus.ACTIVE,
                    champ: { accountStatus: AccountStatus.ACTIVE }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const chainIds = assignments.map((assignment) => assignment.chainId);
    const vendorIds = assignments.flatMap((assignment) =>
      assignment.chain.vendors.map((vendor) => vendor.id)
    );

    const [
      requestsByType,
      requestsByStatus,
      pendingApprovals,
      profileCompletionSummary,
      archiveBlockSummary
    ] = chainIds.length
      ? await this.prisma.$transaction([
          this.prisma.request.groupBy({
            by: ["type"],
            where: {
              OR: [
                { sourceChainId: { in: chainIds } },
                { destinationChainId: { in: chainIds } }
              ]
            },
            _count: { _all: true },
            orderBy: { type: "asc" }
          }),
          this.prisma.request.groupBy({
            by: ["status"],
            where: {
              OR: [
                { sourceChainId: { in: chainIds } },
                { destinationChainId: { in: chainIds } }
              ]
            },
            _count: { _all: true },
            orderBy: { status: "asc" }
          }),
          this.prisma.requestApproval.count({
            where: {
              status: ApprovalStatus.PENDING,
              approverId: areaManagerId,
              request: {
                currentStep: { not: null },
                status: { in: pendingRequestStatuses }
              }
            }
          }),
          this.prisma.user.groupBy({
            by: ["profileStatus"],
            where: {
              role: UserRole.PICKER,
              accountStatus: AccountStatus.ACTIVE,
              employmentStatus: EmploymentStatus.ACTIVE,
              pickerBranchAssignments: {
                some: {
                  vendorId: { in: vendorIds },
                  status: AssignmentStatus.ACTIVE
                }
              }
            },
            _count: { _all: true },
            orderBy: { profileStatus: "asc" }
          }),
          this.prisma.user.groupBy({
            by: ["blockStatus"],
            where: {
              role: UserRole.PICKER,
              pickerBranchAssignments: {
                some: { vendorId: { in: vendorIds } }
              },
              OR: [
                { accountStatus: { not: AccountStatus.ACTIVE } },
                { employmentStatus: { not: EmploymentStatus.ACTIVE } }
              ]
            },
            _count: { _all: true },
            orderBy: { blockStatus: "asc" }
          })
        ])
      : [[], [], 0, [], []];

    const chains = assignments.map((assignment) => {
      const vendors = assignment.chain.vendors.map((vendor) => ({
        vendor: toVendorSummary(vendor),
        activePickerCount: vendor.pickerAssignments.length,
        activeChampCount: vendor.champAssignments.length
      }));

      return {
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
      scopeSummary: {
        assignedChains: chains.length,
        assignedVendors: vendorIds.length
      },
      cards: {
        chains: chains.length,
        vendors: vendorIds.length,
        activePickers: chains.reduce(
          (total, chain) => total + chain.activePickerCount,
          0
        ),
        activeChamps: chains.reduce(
          (total, chain) => total + chain.activeChampCount,
          0
        ),
        pendingApprovals,
        openActions: pendingApprovals
      },
      breakdowns: {
        requestsByType: enumCounts(RequestType, requestsByType, "type"),
        requestsByStatus: enumCounts(RequestStatus, requestsByStatus, "status"),
        profileCompletion: enumCounts(
          ProfileStatus,
          profileCompletionSummary,
          "profileStatus"
        ),
        archiveBlockSummary: enumCounts(
          BlockStatus,
          archiveBlockSummary,
          "blockStatus"
        )
      },
      tables: {
        chains,
        vendors: chains.flatMap((chain) =>
          chain.vendors.map((vendor) => ({
            ...vendor,
            chain: chain.chain
          }))
        )
      }
    };
  }

  async getChampOverview(champId: string) {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId, status: AssignmentStatus.ACTIVE },
      include: {
        vendor: {
          include: {
            chain: true,
            pickerAssignments: {
              where: activePickerWhere,
              include: { picker: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const vendorIds = assignments.map((assignment) => assignment.vendorId);
    const [
      requestsByType,
      requestsByStatus,
      openSubmittedRequests,
      profileCompletionSummary,
      newHiresCompleted,
      transfersCompleted,
      offboardingCompleted
    ] = await this.prisma.$transaction([
      this.prisma.request.groupBy({
        by: ["type"],
        where: { createdById: champId },
        _count: { _all: true },
        orderBy: { type: "asc" }
      }),
      this.prisma.request.groupBy({
        by: ["status"],
        where: { createdById: champId },
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          status: { in: pendingRequestStatuses }
        }
      }),
      this.prisma.user.groupBy({
        by: ["profileStatus"],
        where: {
          role: UserRole.PICKER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE,
          pickerBranchAssignments: {
            some: {
              vendorId: { in: vendorIds },
              status: AssignmentStatus.ACTIVE
            }
          }
        },
        _count: { _all: true },
        orderBy: { profileStatus: "asc" }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          type: RequestType.NEW_HIRE,
          status: RequestStatus.COMPLETED
        }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          type: RequestType.TRANSFER,
          status: RequestStatus.COMPLETED
        }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          type: RequestType.RESIGNATION,
          status: RequestStatus.COMPLETED
        }
      })
    ]);

    const branches = assignments.map((assignment) => ({
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain),
      activePickerCount: assignment.vendor.pickerAssignments.length
    }));

    return {
      scopeSummary: {
        assignedBranches: branches.length
      },
      cards: {
        assignedBranches: branches.length,
        activePickers: branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        ),
        openSubmittedRequests,
        completedOutcomes:
          newHiresCompleted + transfersCompleted + offboardingCompleted
      },
      breakdowns: {
        profileCompletion: enumCounts(
          ProfileStatus,
          profileCompletionSummary,
          "profileStatus"
        ),
        requestsByType: enumCounts(RequestType, requestsByType, "type"),
        requestsByStatus: enumCounts(RequestStatus, requestsByStatus, "status"),
        workflowOutcomes: {
          newHiresCompleted,
          transfersCompleted,
          offboardingCompleted
        }
      },
      tables: {
        branches
      }
    };
  }
}

type GroupCountRow = Record<string, unknown> & {
  _count?: true | { _all?: number };
};

function enumCounts(
  enumObject: Record<string, string>,
  rows: GroupCountRow[],
  key: string
) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const groupKey = row[key];

    if (typeof groupKey === "string") {
      counts.set(groupKey, groupCount(row));
    }
  });

  return Object.values(enumObject).map((value) => ({
    key: value,
    count: counts.get(value) ?? 0
  }));
}

function groupCount(row: GroupCountRow) {
  return typeof row._count === "object" ? row._count._all ?? 0 : 0;
}

const attendanceUserSummaryInclude = {
  assignmentChain: true,
  assignmentVendor: { include: { chain: true } },
  user: true
} satisfies Prisma.AttendanceMonthlyUserSummaryInclude;

type AttendanceUserSummaryRow =
  Prisma.AttendanceMonthlyUserSummaryGetPayload<{
    include: typeof attendanceUserSummaryInclude;
  }>;

type AttendanceMetricRow = {
  absentCount: number;
  annualLeaveCount: number;
  lateLevel1Over15Count: number;
  lateLevel2From31To45Count: number;
  lateLevel3Over45Count: number;
  lateMinutesTotal: number;
  medicalLeaveCount: number;
  missingShifts: number;
  offDayCount: number;
  onLeaveCount: number;
  over15HoursCount: number;
  totalCreatedShifts: number;
  totalShiftsNeeded: number;
  under8HoursCount: number;
  workedShiftCount: number;
};

type MonthCountGroup = GroupCountRow & {
  monthKey?: string;
};

function resolveMonthKey(monthKey?: string) {
  return monthKey ?? new Date().toISOString().slice(0, 7);
}

function attendanceUserWhere(input: {
  chainId?: string;
  monthKey: string;
  role?: AttendanceMatchedRole;
  search?: string;
  vendorId?: string;
}) {
  const where: Prisma.AttendanceMonthlyUserSummaryWhereInput = {
    monthKey: input.monthKey
  };
  const search = input.search?.trim();

  if (input.chainId) {
    where.assignmentChainId = input.chainId;
  }

  if (input.vendorId) {
    where.assignmentVendorId = input.vendorId;
  }

  if (input.role) {
    where.role = input.role;
  }

  if (search) {
    where.OR = [
      { identifier: { contains: search, mode: "insensitive" } },
      { user: { nameEn: { contains: search, mode: "insensitive" } } }
    ];
  }

  return where;
}

function attendanceBranchWhere(input: {
  chainId?: string;
  monthKey: string;
  vendorId?: string;
}) {
  const where: Prisma.AttendanceMonthlyBranchSummaryWhereInput = {
    monthKey: input.monthKey
  };

  if (input.chainId) {
    where.chainId = input.chainId;
  }

  if (input.vendorId) {
    where.vendorId = input.vendorId;
  }

  return where;
}

function attendanceChainWhere(input: { chainId?: string; monthKey: string }) {
  const where: Prisma.AttendanceMonthlyChainSummaryWhereInput = {
    monthKey: input.monthKey
  };

  if (input.chainId) {
    where.chainId = input.chainId;
  }

  return where;
}

function sumAttendanceMetrics(rows: AttendanceMetricRow[]) {
  return rows.reduce(
    (totals, row) => ({
      absentCount: totals.absentCount + row.absentCount,
      annualLeaveCount: totals.annualLeaveCount + row.annualLeaveCount,
      lateLevel1Over15Count:
        totals.lateLevel1Over15Count + row.lateLevel1Over15Count,
      lateLevel2From31To45Count:
        totals.lateLevel2From31To45Count + row.lateLevel2From31To45Count,
      lateLevel3Over45Count:
        totals.lateLevel3Over45Count + row.lateLevel3Over45Count,
      lateMinutesTotal: totals.lateMinutesTotal + row.lateMinutesTotal,
      medicalLeaveCount: totals.medicalLeaveCount + row.medicalLeaveCount,
      missingShifts: totals.missingShifts + row.missingShifts,
      offDayCount: totals.offDayCount + row.offDayCount,
      onLeaveCount: totals.onLeaveCount + row.onLeaveCount,
      over15HoursCount: totals.over15HoursCount + row.over15HoursCount,
      totalCreatedShifts:
        totals.totalCreatedShifts + row.totalCreatedShifts,
      totalShiftsNeeded: totals.totalShiftsNeeded + row.totalShiftsNeeded,
      under8HoursCount: totals.under8HoursCount + row.under8HoursCount,
      workedShiftCount: totals.workedShiftCount + row.workedShiftCount
    }),
    {
      absentCount: 0,
      annualLeaveCount: 0,
      lateLevel1Over15Count: 0,
      lateLevel2From31To45Count: 0,
      lateLevel3Over45Count: 0,
      lateMinutesTotal: 0,
      medicalLeaveCount: 0,
      missingShifts: 0,
      offDayCount: 0,
      onLeaveCount: 0,
      over15HoursCount: 0,
      totalCreatedShifts: 0,
      totalShiftsNeeded: 0,
      under8HoursCount: 0,
      workedShiftCount: 0
    }
  );
}

function toAttendanceUserSummaryResponse(row: AttendanceUserSummaryRow) {
  const chain = row.assignmentChain ?? row.assignmentVendor?.chain ?? null;

  return {
    id: row.id,
    monthKey: row.monthKey,
    userId: row.userId,
    displayName: row.user.nameEn,
    displayNameAr: row.user.nameAr,
    identifier: row.identifier,
    role: row.role,
    branch: row.assignmentVendor
      ? {
          id: row.assignmentVendor.id,
          vendorName: row.assignmentVendor.vendorName,
          vendorExternalId: row.assignmentVendor.vendorExternalId
        }
      : null,
    chain: chain
      ? {
          id: chain.id,
          chainName: chain.chainName
        }
      : null,
    totalCreatedShifts: row.totalCreatedShifts,
    totalShiftsNeeded: row.totalShiftsNeeded,
    missingShifts: row.missingShifts,
    workedShiftCount: row.workedShiftCount,
    absentCount: row.absentCount,
    onLeaveCount: row.onLeaveCount,
    annualLeaveCount: row.annualLeaveCount,
    medicalLeaveCount: row.medicalLeaveCount,
    offDayCount: row.offDayCount,
    lateLevel1Over15Count: row.lateLevel1Over15Count,
    lateLevel2From31To45Count: row.lateLevel2From31To45Count,
    lateLevel3Over45Count: row.lateLevel3Over45Count,
    under8HoursCount: row.under8HoursCount,
    over15HoursCount: row.over15HoursCount,
    sourceDailyRecordsAvailable: row.sourceDailyRecordsAvailable,
    archiveStatus: row.archiveStatus
  };
}

function decimalToNumber(value: Prisma.Decimal | number | null) {
  return value === null ? null : Number(value);
}

function countGroupsByMonth(rows: MonthCountGroup[]) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    if (typeof row.monthKey === "string") {
      counts.set(row.monthKey, groupCount(row));
    }
  });

  return counts;
}

function mostRestrictiveArchiveStatus(
  current: AttendanceArchiveStatus | undefined,
  next: AttendanceArchiveStatus
) {
  const order = [
    AttendanceArchiveStatus.DETAILED,
    AttendanceArchiveStatus.SUMMARY_ONLY,
    AttendanceArchiveStatus.COMPRESSED
  ];

  if (!current) {
    return next;
  }

  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function mostRestrictiveArchiveStatusFromRows(
  rows: Array<{ archiveStatus: AttendanceArchiveStatus }>
) {
  return rows.reduce<AttendanceArchiveStatus | undefined>(
    (current, row) => mostRestrictiveArchiveStatus(current, row.archiveStatus),
    undefined
  );
}

function resolveMonthArchiveStatus(input: {
  archiveStatus?: AttendanceArchiveStatus;
  dailyRecordsCount: number;
  monthKey: string;
  userSummaryCount: number;
}) {
  if (input.userSummaryCount === 0 && input.dailyRecordsCount === 0) {
    return "EMPTY";
  }

  if (input.dailyRecordsCount > 0) {
    return input.monthKey === resolveMonthKey() ? "ACTIVE_MTD" : "DETAILED";
  }

  if (input.archiveStatus === AttendanceArchiveStatus.COMPRESSED) {
    return "COMPRESSED";
  }

  return "SUMMARY_ONLY";
}
