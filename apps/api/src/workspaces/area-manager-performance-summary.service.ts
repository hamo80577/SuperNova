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
  EmploymentStatus,
  OrdersKpiImportBatchStatus,
  OrdersKpiVendorMatchStatus,
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { OrdersKpisTargetSettingsService } from "../orders-kpis/orders-kpis-target-settings.service";
import { DashboardCacheReadThroughService } from "../dashboard-cache/dashboard-cache-read-through.service";
import type { OrdersKpiTargetSettingsResponse } from "../orders-kpis/orders-kpis.types";
import { PrismaService } from "../prisma/prisma.service";
import type { AreaManagerPerformanceSummaryQueryDto } from "./dto/area-manager-performance-summary-query.dto";

export type AreaManagerPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME"
  | "NO_KPI";

export interface AreaManagerPerformanceSummary {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  scope: {
    areaManagerId: string;
    areaManagerName: string;
    selectedChainId: string | null;
    chains: Array<{
      chainId: string;
      chainName: string;
    }>;
    totals: {
      chainsCount: number;
      branchesCount: number;
      champsCount: number;
      pickersCount: number;
    };
  };
  ordersKpi: {
    available: boolean;
    totalOrders?: number;
    unhealthyOrders?: number;
    unhealthyRate?: number | null;
    orderNotOnTime?: number;
    orderNotOnTimeRate?: number | null;
    target?: {
      configured: boolean;
      unhealthyRateTarget?: number | null;
      status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET";
    };
    trend?: Array<{
      date: string;
      unhealthyRate: number;
      totalOrders: number;
      unhealthyOrders: number;
    }>;
    reason?: string;
  };
  attendance: {
    available: boolean;
    attendanceHealthRate?: number | null;
    totalShifts?: number;
    cleanShifts?: number;
    issueShifts?: number;
    totalShiftErrors?: number;
    lateCount?: number;
    absentCount?: number;
    under8Count?: number;
    over15Count?: number;
    includedRoles: Array<"PICKER" | "CHAMP">;
    reason?: string;
  };
  latestRequests: {
    available: boolean;
    rows: Array<{
      id: string;
      type: string;
      targetUserName?: string | null;
      targetShopperId?: string | null;
      branchName?: string | null;
      chainName?: string | null;
      requestedByName?: string | null;
      status: string;
      ageLabel?: string;
      createdAt: string;
    }>;
    totalOpenInScope?: number;
    reason?: string;
  };
  areaManagersRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    currentAreaManager: AreaManagerRankRow | null;
    rows: AreaManagerRankRow[];
    reason?: string;
  };
  branchesPerformance: {
    available: boolean;
    rows: BranchPerformanceRow[];
    totalRows: number;
    reason?: string;
  };
  champsPerformance: {
    available: boolean;
    rows: ChampPerformanceRow[];
    totalRows: number;
    reason?: string;
  };
}

export interface AreaManagerRankRow {
  rank: number;
  areaManagerId: string;
  areaManagerName: string;
  chainsCount: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  isCurrentUser: boolean;
  status?: AreaManagerPerformanceStatus;
}

export interface BranchPerformanceRow {
  vendorId: string;
  vendorName: string;
  chainId: string;
  chainName: string;
  champName?: string | null;
  totalOrders: number;
  totalPickers: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AreaManagerPerformanceStatus;
  reasonLabels: string[];
}

export interface ChampPerformanceRow {
  champId: string;
  champName: string;
  branchesCount: number;
  totalPickers: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AreaManagerPerformanceStatus;
  reasonLabels: string[];
}

const chainAreaManagerScopeInclude = {
  areaManager: true,
  chain: {
    include: {
      vendors: {
        include: {
          pickerAssignments: {
            where: {
              status: AssignmentStatus.ACTIVE,
              picker: {
                accountStatus: AccountStatus.ACTIVE,
                employmentStatus: EmploymentStatus.ACTIVE
              }
            },
            include: { picker: true }
          },
          champAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: { champ: true }
          }
        }
      }
    }
  }
} satisfies Prisma.ChainAreaManagerAssignmentInclude;

const requestInclude = {
  createdBy: true,
  targetUser: true,
  sourceChain: true,
  sourceVendor: { include: { chain: true } },
  destinationChain: true,
  destinationVendor: { include: { chain: true } }
} satisfies Prisma.RequestInclude;

const ordersKpiSummarySelect = {
  kpiDate: true,
  matchedVendorId: true,
  matchedChainId: true,
  totalOrders: true,
  unhealthyOrders: true,
  orderNotOnTime: true,
  qcFailedOrders: true,
  partialRefund: true,
  outOfStock: true,
  priceModified: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

const attendanceSummarySelect = {
  userId: true,
  shiftDate: true,
  calculatedStatus: true,
  isOnTime: true,
  isLate: true,
  isAbsent: true,
  isUnder8Hours: true,
  isOver15Hours: true,
  issuesCount: true
} satisfies Prisma.AttendanceDailyRecordSelect;

type AreaManagerAssignmentWithScope = Prisma.ChainAreaManagerAssignmentGetPayload<{
  include: typeof chainAreaManagerScopeInclude;
}>;
type RequestWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;
type OrdersKpiSummaryRecord = Prisma.OrdersKpiDailyRecordGetPayload<{
  select: typeof ordersKpiSummarySelect;
}>;
type AttendanceSummaryRecord = Prisma.AttendanceDailyRecordGetPayload<{
  select: typeof attendanceSummarySelect;
}>;
type ScopedPickerAssignment = {
  pickerId: string;
  pickerName: string;
};
type ScopedChampAssignment = {
  champId: string;
  champName: string;
};
type ScopedBranch = {
  vendorId: string;
  vendorName: string;
  chainId: string;
  chainName: string;
  pickerAssignments: ScopedPickerAssignment[];
  champAssignments: ScopedChampAssignment[];
};
type ScopeContext = {
  chains: Array<{ chainId: string; chainName: string }>;
  branches: ScopedBranch[];
  pickerIds: string[];
  champIds: string[];
  scopedUserIds: string[];
};
type ParsedPeriod = {
  dateFrom: string;
  dateTo: string;
  dateFromValue: Date;
  dateToValue: Date;
  dateToExclusive: Date;
};

const dashboardRowsLimit = 8;
const rankingRowsLimit = 5;
const minOrdersPerCompletedDay = 50;
const closedRequestStatuses = [
  RequestStatus.REJECTED,
  RequestStatus.CANCELLED,
  RequestStatus.COMPLETED
];
const performanceStatusWeight: Record<AreaManagerPerformanceStatus, number> = {
  NEEDS_ACTION: 0,
  WATCH: 1,
  LOW_VOLUME: 2,
  NO_KPI: 3,
  IN_TARGET: 4
};

@Injectable()
export class AreaManagerPerformanceSummaryService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OrdersKpisTargetSettingsService)
    private readonly targetSettingsService: OrdersKpisTargetSettingsService,
    @Inject(DashboardCacheReadThroughService)
    private readonly dashboardCache: DashboardCacheReadThroughService
  ) {}

  async getSummary(
    areaManagerId: string,
    query: AreaManagerPerformanceSummaryQueryDto
  ): Promise<AreaManagerPerformanceSummary> {
    return this.dashboardCache.getOrCalculate({
      role: UserRole.AREA_MANAGER,
      userId: areaManagerId,
      query,
      calculate: () => this.calculateSummary(areaManagerId, query)
    });
  }

  async calculateSummary(
    areaManagerId: string,
    query: AreaManagerPerformanceSummaryQueryDto
  ): Promise<AreaManagerPerformanceSummary> {
    const period = parsePeriod(query);
    const selectedChainId = normalizeOptionalId(query.chainId);
    const areaManager = await this.prisma.user.findUnique({
      where: { id: areaManagerId },
      select: { id: true, nameEn: true, role: true }
    });

    if (!areaManager) {
      throw new NotFoundException("Area Manager was not found.");
    }

    if (areaManager.role !== UserRole.AREA_MANAGER) {
      throw new ForbiddenException("Only Area Managers can access this summary.");
    }

    const assignedScope = await this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        areaManagerId,
        status: AssignmentStatus.ACTIVE
      },
      include: chainAreaManagerScopeInclude
    });
    const scopedAssignments = selectAssignedScope(
      assignedScope,
      selectedChainId
    );
    const scope = buildScopeContext(scopedAssignments);
    const vendorIds = scope.branches.map((branch) => branch.vendorId);
    const targetSettings =
      await this.targetSettingsService.getTargetSettingsForReport();
    const minOrdersRequired = minimumOrdersRequiredForPeriod(period);

    const [ordersKpiRecords, attendanceRecords, latestRequests, totalOpenInScope] =
      await Promise.all([
        this.findConfirmedOrdersKpis(vendorIds, period),
        this.findActiveAttendance(scope.scopedUserIds, period),
        this.findLatestRequests(scope),
        this.countOpenRequests(scope)
      ]);

    const allRankingAssignments =
      await this.prisma.chainAreaManagerAssignment.findMany({
        where: { status: AssignmentStatus.ACTIVE },
        include: chainAreaManagerScopeInclude
      });
    const rankingContext = buildRankingContexts(allRankingAssignments);
    const rankingKpiRecords = await this.findConfirmedOrdersKpisByChain(
      rankingContext.chainIds,
      period
    );
    const rankingAttendanceRecords = await this.findActiveAttendance(
      rankingContext.userIds,
      period
    );

    return {
      period: {
        dateFrom: period.dateFrom,
        dateTo: period.dateTo
      },
      scope: {
        areaManagerId: areaManager.id,
        areaManagerName: areaManager.nameEn,
        selectedChainId,
        chains: scope.chains,
        totals: {
          chainsCount: scope.chains.length,
          branchesCount: scope.branches.length,
          champsCount: scope.champIds.length,
          pickersCount: scope.pickerIds.length
        }
      },
      ordersKpi: buildOrdersKpiSummary(ordersKpiRecords, targetSettings),
      attendance: buildAttendanceSummary(attendanceRecords),
      latestRequests: buildLatestRequestsSummary(
        latestRequests,
        totalOpenInScope
      ),
      areaManagersRanking: buildAreaManagersRanking({
        areaManagerId,
        rankingContext,
        kpiRecords: rankingKpiRecords,
        attendanceRecords: rankingAttendanceRecords,
        targetSettings,
        minOrdersRequired
      }),
      branchesPerformance: buildBranchesPerformance({
        branches: scope.branches,
        kpiRecords: ordersKpiRecords,
        attendanceRecords,
        targetSettings,
        minOrdersRequired
      }),
      champsPerformance: buildChampsPerformance({
        branches: scope.branches,
        kpiRecords: ordersKpiRecords,
        attendanceRecords,
        targetSettings,
        minOrdersRequired
      })
    };
  }

  private findConfirmedOrdersKpis(vendorIds: string[], period: ParsedPeriod) {
    if (vendorIds.length === 0) {
      return Promise.resolve([] as OrdersKpiSummaryRecord[]);
    }

    return this.prisma.ordersKpiDailyRecord.findMany({
      where: {
        matchedVendorId: { in: vendorIds },
        vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
        kpiDate: { gte: period.dateFromValue, lt: period.dateToExclusive },
        sourceBatch: { is: { status: OrdersKpiImportBatchStatus.CONFIRMED } }
      },
      select: ordersKpiSummarySelect
    });
  }

  private findConfirmedOrdersKpisByChain(
    chainIds: string[],
    period: ParsedPeriod
  ) {
    if (chainIds.length === 0) {
      return Promise.resolve([] as OrdersKpiSummaryRecord[]);
    }

    return this.prisma.ordersKpiDailyRecord.findMany({
      where: {
        matchedChainId: { in: chainIds },
        vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
        kpiDate: { gte: period.dateFromValue, lt: period.dateToExclusive },
        sourceBatch: { is: { status: OrdersKpiImportBatchStatus.CONFIRMED } }
      },
      select: ordersKpiSummarySelect
    });
  }

  private findActiveAttendance(userIds: string[], period: ParsedPeriod) {
    if (userIds.length === 0) {
      return Promise.resolve([] as AttendanceSummaryRecord[]);
    }

    return this.prisma.attendanceDailyRecord.findMany({
      where: {
        userId: { in: userIds },
        shiftDate: { gte: period.dateFromValue, lte: endOfUtcDate(period.dateToValue) },
        importBatch: { is: { status: AttendanceImportBatchStatus.ACTIVE } }
      },
      select: attendanceSummarySelect
    });
  }

  private async findLatestRequests(scope: ScopeContext) {
    const where = buildRequestScopeWhere(scope);
    if (!where) {
      return [];
    }

    return this.prisma.request.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
      take: 6
    });
  }

  private async countOpenRequests(scope: ScopeContext) {
    const where = buildRequestScopeWhere(scope);
    if (!where) {
      return 0;
    }

    return this.prisma.request.count({
      where: {
        ...where,
        status: { notIn: closedRequestStatuses }
      }
    });
  }
}

function parsePeriod(query: AreaManagerPerformanceSummaryQueryDto): ParsedPeriod {
  const dateFromValue = parseDateOnly(query.dateFrom, "dateFrom");
  const dateToValue = parseDateOnly(query.dateTo, "dateTo");

  if (dateFromValue.getTime() > dateToValue.getTime()) {
    throw new BadRequestException("dateFrom must be before or equal to dateTo.");
  }

  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    dateFromValue,
    dateToValue,
    dateToExclusive: addUtcDays(dateToValue, 1)
  };
}

function parseDateOnly(value: string | undefined, fieldName: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return parsed;
}

function normalizeOptionalId(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function selectAssignedScope(
  assignments: AreaManagerAssignmentWithScope[],
  selectedChainId: string | null
) {
  const sortedAssignments = [...assignments].sort((left, right) =>
    left.chain.chainName.localeCompare(right.chain.chainName)
  );

  if (!selectedChainId) {
    return sortedAssignments;
  }

  const selected = sortedAssignments.filter(
    (assignment) => assignment.chainId === selectedChainId
  );

  if (selected.length === 0) {
    throw new ForbiddenException("You do not have access to this chain.");
  }

  return selected;
}

function buildScopeContext(assignments: AreaManagerAssignmentWithScope[]) {
  const chainMap = new Map<string, { chainId: string; chainName: string }>();
  const branchMap = new Map<string, ScopedBranch>();

  for (const assignment of assignments) {
    chainMap.set(assignment.chainId, {
      chainId: assignment.chainId,
      chainName: assignment.chain.chainName
    });

    for (const vendor of assignment.chain.vendors) {
      const existing = branchMap.get(vendor.id);
      const branch =
        existing ??
        {
          vendorId: vendor.id,
          vendorName: vendor.vendorName,
          chainId: assignment.chainId,
          chainName: assignment.chain.chainName,
          pickerAssignments: [],
          champAssignments: []
        };

      branch.pickerAssignments = uniqueBy(
        [
          ...branch.pickerAssignments,
          ...vendor.pickerAssignments
            .filter((pickerAssignment) => pickerAssignment.status === AssignmentStatus.ACTIVE)
            .map((pickerAssignment) => ({
              pickerId: pickerAssignment.pickerId,
              pickerName: pickerAssignment.picker.nameEn
            }))
        ],
        (pickerAssignment) => pickerAssignment.pickerId
      );
      branch.champAssignments = uniqueBy(
        [
          ...branch.champAssignments,
          ...vendor.champAssignments
            .filter((champAssignment) => champAssignment.status === AssignmentStatus.ACTIVE)
            .map((champAssignment) => ({
              champId: champAssignment.champId,
              champName: champAssignment.champ.nameEn
            }))
        ],
        (champAssignment) => champAssignment.champId
      );

      branchMap.set(vendor.id, branch);
    }
  }

  const branches = Array.from(branchMap.values()).sort((left, right) =>
    left.vendorName.localeCompare(right.vendorName)
  );
  const pickerIds = uniqueStrings(
    branches.flatMap((branch) =>
      branch.pickerAssignments.map((assignment) => assignment.pickerId)
    )
  );
  const champIds = uniqueStrings(
    branches.flatMap((branch) =>
      branch.champAssignments.map((assignment) => assignment.champId)
    )
  );

  return {
    chains: Array.from(chainMap.values()).sort((left, right) =>
      left.chainName.localeCompare(right.chainName)
    ),
    branches,
    pickerIds,
    champIds,
    scopedUserIds: uniqueStrings([...pickerIds, ...champIds])
  } satisfies ScopeContext;
}

function buildOrdersKpiSummary(
  records: OrdersKpiSummaryRecord[],
  targetSettings: OrdersKpiTargetSettingsResponse
): AreaManagerPerformanceSummary["ordersKpi"] {
  const totals = summarizeOrdersKpi(records);
  const target = buildTargetSummary(
    percentage(totals.unhealthyOrders, totals.totalOrders),
    targetSettings
  );

  if (totals.totalOrders <= 0) {
    return {
      available: false,
      target,
      reason: "No confirmed Orders KPI records are available for this period."
    };
  }

  return {
    available: true,
    totalOrders: totals.totalOrders,
    unhealthyOrders: totals.unhealthyOrders,
    unhealthyRate: percentage(totals.unhealthyOrders, totals.totalOrders),
    orderNotOnTime: totals.orderNotOnTime,
    orderNotOnTimeRate: percentage(totals.orderNotOnTime, totals.totalOrders),
    target,
    trend: buildOrdersKpiTrend(records)
  };
}

function buildTargetSummary(
  unhealthyRate: number | null,
  targetSettings: OrdersKpiTargetSettingsResponse
) {
  const configured = targetSettings.source === "SAVED";
  const unhealthyRateTarget = configured
    ? targetSettings.targets.uhoRateTarget
    : null;

  return {
    configured,
    unhealthyRateTarget,
    status:
      !configured || unhealthyRate === null || unhealthyRateTarget === null
        ? ("NO_TARGET" as const)
        : unhealthyRate <= unhealthyRateTarget
          ? ("IN_TARGET" as const)
          : ("OUT_OF_TARGET" as const)
  };
}

function buildAttendanceSummary(
  records: AttendanceSummaryRecord[]
): AreaManagerPerformanceSummary["attendance"] {
  const totals = summarizeAttendanceRecords(records);

  if (totals.totalShifts <= 0) {
    return {
      available: false,
      includedRoles: ["PICKER", "CHAMP"],
      reason: "No active attendance records are available for this period."
    };
  }

  return {
    available: true,
    attendanceHealthRate: percentage(totals.cleanShifts, totals.totalShifts),
    totalShifts: totals.totalShifts,
    cleanShifts: totals.cleanShifts,
    issueShifts: totals.issueShifts,
    totalShiftErrors:
      totals.lateCount +
      totals.absentCount +
      totals.under8HoursCount +
      totals.over15HoursCount,
    lateCount: totals.lateCount,
    absentCount: totals.absentCount,
    under8Count: totals.under8HoursCount,
    over15Count: totals.over15HoursCount,
    includedRoles: ["PICKER", "CHAMP"]
  };
}

function buildLatestRequestsSummary(
  requests: RequestWithRelations[],
  totalOpenInScope: number
): AreaManagerPerformanceSummary["latestRequests"] {
  const rows = requests.map((request) => ({
    id: request.id,
    type: request.type,
    targetUserName: request.targetUser?.nameEn ?? null,
    targetShopperId: request.targetUser?.shopperId ?? null,
    branchName:
      request.destinationVendor?.vendorName ??
      request.sourceVendor?.vendorName ??
      null,
    chainName:
      request.destinationChain?.chainName ??
      request.sourceChain?.chainName ??
      request.destinationVendor?.chain.chainName ??
      request.sourceVendor?.chain.chainName ??
      null,
    requestedByName: request.createdBy?.nameEn ?? null,
    status: request.status,
    ageLabel: requestAgeLabel(request.createdAt),
    createdAt: request.createdAt.toISOString()
  }));

  return {
    available: rows.length > 0,
    rows,
    totalOpenInScope,
    reason: rows.length ? undefined : "No recent scoped requests are available."
  };
}

function buildBranchesPerformance({
  branches,
  kpiRecords,
  attendanceRecords,
  targetSettings,
  minOrdersRequired
}: {
  branches: ScopedBranch[];
  kpiRecords: OrdersKpiSummaryRecord[];
  attendanceRecords: AttendanceSummaryRecord[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AreaManagerPerformanceSummary["branchesPerformance"] {
  const rows = branches.map((branch) => {
    const branchKpis = kpiRecords.filter(
      (record) => record.matchedVendorId === branch.vendorId
    );
    const kpiTotals = summarizeOrdersKpi(branchKpis);
    const branchUserIds = uniqueStrings([
      ...branch.pickerAssignments.map((assignment) => assignment.pickerId),
      ...branch.champAssignments.map((assignment) => assignment.champId)
    ]);
    const attendanceTotals = summarizeAttendanceRecords(
      attendanceRecords.filter((record) => branchUserIds.includes(record.userId))
    );
    const unhealthyRate = percentage(
      kpiTotals.unhealthyOrders,
      kpiTotals.totalOrders
    );
    const attendanceHealthRate = percentage(
      attendanceTotals.cleanShifts,
      attendanceTotals.totalShifts
    );
    const assessment = assessPerformance({
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings,
      minOrdersRequired
    });

    return {
      vendorId: branch.vendorId,
      vendorName: branch.vendorName,
      chainId: branch.chainId,
      chainName: branch.chainName,
      champName: branch.champAssignments[0]?.champName ?? null,
      totalOrders: kpiTotals.totalOrders,
      totalPickers: branch.pickerAssignments.length,
      unhealthyRate,
      attendanceHealthRate,
      status: assessment.status,
      reasonLabels: assessment.reasonLabels
    } satisfies BranchPerformanceRow;
  });
  const sortedRows = rows.sort(comparePerformanceRows).slice(0, dashboardRowsLimit);

  return {
    available: rows.length > 0,
    rows: sortedRows,
    totalRows: rows.length,
    reason: rows.length ? undefined : "No scoped branches are available."
  };
}

function buildChampsPerformance({
  branches,
  kpiRecords,
  attendanceRecords,
  targetSettings,
  minOrdersRequired
}: {
  branches: ScopedBranch[];
  kpiRecords: OrdersKpiSummaryRecord[];
  attendanceRecords: AttendanceSummaryRecord[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AreaManagerPerformanceSummary["champsPerformance"] {
  const branchesByChamp = new Map<string, ScopedBranch[]>();
  const champNames = new Map<string, string>();

  for (const branch of branches) {
    for (const champAssignment of branch.champAssignments) {
      const existing = branchesByChamp.get(champAssignment.champId) ?? [];
      existing.push(branch);
      branchesByChamp.set(champAssignment.champId, existing);
      champNames.set(champAssignment.champId, champAssignment.champName);
    }
  }

  const rows = Array.from(branchesByChamp, ([champId, champBranches]) => {
    const vendorIds = champBranches.map((branch) => branch.vendorId);
    const champKpis = kpiRecords.filter(
      (record) =>
        typeof record.matchedVendorId === "string" &&
        vendorIds.includes(record.matchedVendorId)
    );
    const kpiTotals = summarizeOrdersKpi(champKpis);
    const pickerIds = uniqueStrings(
      champBranches.flatMap((branch) =>
        branch.pickerAssignments.map((assignment) => assignment.pickerId)
      )
    );
    const champUserIds = uniqueStrings([champId, ...pickerIds]);
    const attendanceTotals = summarizeAttendanceRecords(
      attendanceRecords.filter((record) => champUserIds.includes(record.userId))
    );
    const unhealthyRate = percentage(
      kpiTotals.unhealthyOrders,
      kpiTotals.totalOrders
    );
    const attendanceHealthRate = percentage(
      attendanceTotals.cleanShifts,
      attendanceTotals.totalShifts
    );
    const assessment = assessPerformance({
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings,
      minOrdersRequired
    });

    return {
      champId,
      champName: champNames.get(champId) ?? "Unknown Champ",
      branchesCount: champBranches.length,
      totalPickers: pickerIds.length,
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      status: assessment.status,
      reasonLabels: assessment.reasonLabels
    } satisfies ChampPerformanceRow;
  });
  const sortedRows = rows.sort(comparePerformanceRows).slice(0, dashboardRowsLimit);

  return {
    available: rows.length > 0,
    rows: sortedRows,
    totalRows: rows.length,
    reason: rows.length ? undefined : "No scoped Champs are available."
  };
}

function buildAreaManagersRanking({
  areaManagerId,
  rankingContext,
  kpiRecords,
  attendanceRecords,
  targetSettings,
  minOrdersRequired
}: {
  areaManagerId: string;
  rankingContext: ReturnType<typeof buildRankingContexts>;
  kpiRecords: OrdersKpiSummaryRecord[];
  attendanceRecords: AttendanceSummaryRecord[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AreaManagerPerformanceSummary["areaManagersRanking"] {
  const rows = rankingContext.areaManagers.map((areaManager) => {
    const kpis = kpiRecords.filter(
      (record) =>
        typeof record.matchedChainId === "string" &&
        areaManager.chainIds.includes(record.matchedChainId)
    );
    const totals = summarizeOrdersKpi(kpis);
    const attendanceTotals = summarizeAttendanceRecords(
      attendanceRecords.filter((record) => areaManager.userIds.includes(record.userId))
    );
    const unhealthyRate = percentage(totals.unhealthyOrders, totals.totalOrders);
    const attendanceHealthRate = percentage(
      attendanceTotals.cleanShifts,
      attendanceTotals.totalShifts
    );
    const assessment = assessPerformance({
      totalOrders: totals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings,
      minOrdersRequired
    });

    return {
      rank: 0,
      areaManagerId: areaManager.areaManagerId,
      areaManagerName: areaManager.areaManagerName,
      chainsCount: areaManager.chainIds.length,
      totalOrders: totals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      isCurrentUser: areaManager.areaManagerId === areaManagerId,
      status: assessment.status
    } satisfies AreaManagerRankRow;
  });
  const rankedRows = rows
    .sort((left, right) => {
      const leftHasKpi = left.totalOrders > 0;
      const rightHasKpi = right.totalOrders > 0;

      if (leftHasKpi !== rightHasKpi) {
        return leftHasKpi ? -1 : 1;
      }

      if (!leftHasKpi && !rightHasKpi) {
        return left.areaManagerName.localeCompare(right.areaManagerName);
      }

      return (
        (left.unhealthyRate ?? Number.MAX_SAFE_INTEGER) -
          (right.unhealthyRate ?? Number.MAX_SAFE_INTEGER) ||
        left.areaManagerName.localeCompare(right.areaManagerName)
      );
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const currentAreaManager =
    rankedRows.find((row) => row.areaManagerId === areaManagerId) ?? null;
  const topRows = rankedRows.slice(0, rankingRowsLimit);
  const rowsWithCurrent =
    currentAreaManager &&
    !topRows.some((row) => row.areaManagerId === currentAreaManager.areaManagerId)
      ? [...topRows, currentAreaManager]
      : topRows;

  return {
    available: rankedRows.length > 0,
    basis: "UHO_ONLY",
    currentAreaManager,
    rows: rowsWithCurrent,
    reason: rankedRows.length
      ? undefined
      : "No active Area Manager chain assignments are available."
  };
}

function buildRankingContexts(assignments: AreaManagerAssignmentWithScope[]) {
  const byAreaManager = new Map<
    string,
    {
      areaManagerId: string;
      areaManagerName: string;
      chainIds: string[];
      userIds: string[];
    }
  >();

  for (const assignment of assignments) {
    if (assignment.areaManager.role !== UserRole.AREA_MANAGER) {
      continue;
    }

    const context = byAreaManager.get(assignment.areaManagerId) ?? {
      areaManagerId: assignment.areaManagerId,
      areaManagerName: assignment.areaManager.nameEn,
      chainIds: [],
      userIds: []
    };
    const scope = buildScopeContext([assignment]);
    context.chainIds = uniqueStrings([...context.chainIds, assignment.chainId]);
    context.userIds = uniqueStrings([...context.userIds, ...scope.scopedUserIds]);
    byAreaManager.set(assignment.areaManagerId, context);
  }

  const areaManagers = Array.from(byAreaManager.values()).filter(
    (areaManager) => areaManager.chainIds.length > 0
  );

  return {
    areaManagers,
    chainIds: uniqueStrings(
      areaManagers.flatMap((areaManager) => areaManager.chainIds)
    ),
    userIds: uniqueStrings(
      areaManagers.flatMap((areaManager) => areaManager.userIds)
    )
  };
}

function buildRequestScopeWhere(scope: ScopeContext): Prisma.RequestWhereInput | null {
  const conditions: Prisma.RequestWhereInput[] = [];
  const chainIds = scope.chains.map((chain) => chain.chainId);
  const vendorIds = scope.branches.map((branch) => branch.vendorId);

  if (chainIds.length > 0) {
    conditions.push(
      { sourceChainId: { in: chainIds } },
      { destinationChainId: { in: chainIds } }
    );
  }

  if (vendorIds.length > 0) {
    conditions.push(
      { sourceVendorId: { in: vendorIds } },
      { destinationVendorId: { in: vendorIds } }
    );
  }

  if (conditions.length === 0) {
    return null;
  }

  return {
    type: { not: RequestType.DEDUCTION },
    OR: conditions
  };
}

function assessPerformance({
  totalOrders,
  unhealthyRate,
  attendanceHealthRate,
  issueShifts,
  targetSettings,
  minOrdersRequired
}: {
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  issueShifts: number;
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}) {
  const reasonLabels: string[] = [];
  const hasTarget = targetSettings.source === "SAVED";
  const uhoTarget = hasTarget ? targetSettings.targets.uhoRateTarget : null;

  if (totalOrders <= 0) {
    return {
      status: "NO_KPI" as const,
      reasonLabels: ["No KPI records"]
    };
  }

  if (minOrdersRequired > 0 && totalOrders < minOrdersRequired) {
    return {
      status: "LOW_VOLUME" as const,
      reasonLabels: [`Below minimum ${minOrdersRequired} orders`]
    };
  }

  if (hasTarget && uhoTarget !== null && unhealthyRate !== null) {
    if (unhealthyRate > uhoTarget) {
      reasonLabels.push("UHO out of target");
    } else if (unhealthyRate >= uhoTarget * 0.9) {
      reasonLabels.push("UHO close to target");
    }
  }

  if (attendanceHealthRate !== null && attendanceHealthRate < 70) {
    reasonLabels.push("Attendance health very low");
  } else if (
    attendanceHealthRate !== null &&
    (attendanceHealthRate < 85 || issueShifts > 0)
  ) {
    reasonLabels.push("Attendance health needs watch");
  }

  if (
    reasonLabels.includes("UHO out of target") ||
    reasonLabels.includes("Attendance health very low")
  ) {
    return {
      status: "NEEDS_ACTION" as const,
      reasonLabels
    };
  }

  if (reasonLabels.length > 0) {
    return {
      status: "WATCH" as const,
      reasonLabels
    };
  }

  return {
    status: "IN_TARGET" as const,
    reasonLabels: ["In target"]
  };
}

function comparePerformanceRows(
  left: BranchPerformanceRow | ChampPerformanceRow,
  right: BranchPerformanceRow | ChampPerformanceRow
) {
  return (
    performanceStatusWeight[left.status] - performanceStatusWeight[right.status] ||
    (right.unhealthyRate ?? -1) - (left.unhealthyRate ?? -1) ||
    right.totalOrders - left.totalOrders
  );
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

function buildOrdersKpiTrend(records: OrdersKpiSummaryRecord[]) {
  return Array.from(groupBy(records, (record) => dateKey(record.kpiDate)))
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, dailyRecords]) => {
      const totals = summarizeOrdersKpi(dailyRecords);

      return {
        date,
        unhealthyRate: percentage(totals.unhealthyOrders, totals.totalOrders) ?? 0,
        totalOrders: totals.totalOrders,
        unhealthyOrders: totals.unhealthyOrders
      };
    });
}

function summarizeAttendanceRecords(records: AttendanceSummaryRecord[]) {
  let totalShifts = 0;
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

    if (attended || absent || issue) {
      totalShifts += 1;

      if (issue) {
        issueShifts += 1;
      } else {
        cleanShifts += 1;
      }
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

function minimumOrdersRequiredForPeriod(period: ParsedPeriod) {
  const today = startOfUtcDate(new Date());
  let lastCompletedDate = period.dateToValue;

  if (period.dateToValue.getTime() >= today.getTime()) {
    lastCompletedDate = addUtcDays(today, -1);
  }

  if (lastCompletedDate.getTime() < period.dateFromValue.getTime()) {
    return 0;
  }

  return daysInclusive(period.dateFromValue, lastCompletedDate) * minOrdersPerCompletedDay;
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

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

function startOfUtcDate(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function daysInclusive(dateFrom: Date, dateTo: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.floor(
      (startOfUtcDate(dateTo).getTime() - startOfUtcDate(dateFrom).getTime()) /
        millisecondsPerDay
    ) + 1
  );
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

function roundTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const byKey = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values());
}
