import {
  BadRequestException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStep,
  AssignmentStatus,
  AttendanceImportBatchStatus,
  ChainStatus,
  EmploymentStatus,
  OrdersKpiImportBatchStatus,
  OrdersKpiVendorMatchStatus,
  Prisma,
  RequestStatus,
  VendorStatus
} from "@prisma/client";

import { OrdersKpisTargetSettingsService } from "../orders-kpis/orders-kpis-target-settings.service";
import type { OrdersKpiTargetSettingsResponse } from "../orders-kpis/orders-kpis.types";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminPerformanceSummaryQueryDto } from "./dto/admin-performance-summary-query.dto";

export type AdminPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME"
  | "NO_KPI";

export interface AdminAreaManagerRankRow {
  rank: number;
  areaManagerId: string;
  areaManagerName: string;
  chainsCount: number;
  branchesCount: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminChampRankRow {
  rank: number;
  champId: string;
  champName: string;
  branchesCount: number;
  totalPickers: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminBranchRankRow {
  rank: number;
  vendorId: string;
  vendorName: string;
  chainId: string;
  chainName: string;
  champName?: string | null;
  totalPickers: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminTopPickerRow {
  rank: number;
  pickerId: string;
  pickerName: string;
  shopperId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  chainId?: string | null;
  chainName?: string | null;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminPerformanceSummary {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  filters: {
    selectedChainId: string | null;
    selectedVendorId: string | null;
    chains: Array<{
      chainId: string;
      chainName: string;
    }>;
    branches: Array<{
      vendorId: string;
      vendorName: string;
      chainId: string;
      chainName: string;
    }>;
  };
  scopeTotals: {
    chainsCount: number;
    branchesCount: number;
    areaManagersCount: number;
    champsCount: number;
    pickersCount: number;
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
  ticketsSummary: {
    available: boolean;
    totalTickets?: number;
    openedInPeriod?: number;
    closedInPeriod?: number;
    openNow?: number;
    waitingMyAction?: number;
    rejectedOrCancelled?: number;
    reason?: string;
  };
  areaManagersRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    rows: AdminAreaManagerRankRow[];
    totalRows: number;
    reason?: string;
  };
  champsRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    rows: AdminChampRankRow[];
    totalRows: number;
    reason?: string;
  };
  branchesRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    rows: AdminBranchRankRow[];
    totalRows: number;
    reason?: string;
  };
  topPickers: {
    available: boolean;
    basis: "UHO_ONLY_WITH_MINIMUM_ORDERS";
    minOrdersRequired: number;
    rows: AdminTopPickerRow[];
    totalEligible: number;
    reason?: string;
  };
}

const chainSelect = {
  id: true,
  chainName: true
} satisfies Prisma.ChainSelect;

const vendorSelect = {
  id: true,
  vendorName: true,
  chainId: true,
  chain: {
    select: {
      id: true,
      chainName: true
    }
  }
} satisfies Prisma.VendorSelect;

const areaManagerAssignmentSelect = {
  areaManagerId: true,
  chainId: true,
  areaManager: {
    select: {
      id: true,
      nameEn: true
    }
  }
} satisfies Prisma.ChainAreaManagerAssignmentSelect;

const champAssignmentSelect = {
  champId: true,
  vendorId: true,
  champ: {
    select: {
      id: true,
      nameEn: true
    }
  }
} satisfies Prisma.VendorChampAssignmentSelect;

const pickerAssignmentSelect = {
  pickerId: true,
  vendorId: true,
  picker: {
    select: {
      id: true,
      nameEn: true,
      shopperId: true
    }
  }
} satisfies Prisma.PickerBranchAssignmentSelect;

const ordersKpiSelect = {
  kpiDate: true,
  matchedVendorId: true,
  matchedChainId: true,
  userId: true,
  totalOrders: true,
  unhealthyOrders: true,
  orderNotOnTime: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

const attendanceSelect = {
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

type ChainRow = Prisma.ChainGetPayload<{ select: typeof chainSelect }>;
type VendorRow = Prisma.VendorGetPayload<{ select: typeof vendorSelect }>;
type AreaManagerAssignmentRow =
  Prisma.ChainAreaManagerAssignmentGetPayload<{
    select: typeof areaManagerAssignmentSelect;
  }>;
type ChampAssignmentRow = Prisma.VendorChampAssignmentGetPayload<{
  select: typeof champAssignmentSelect;
}>;
type PickerAssignmentRow = Prisma.PickerBranchAssignmentGetPayload<{
  select: typeof pickerAssignmentSelect;
}>;
type OrdersKpiRow = Prisma.OrdersKpiDailyRecordGetPayload<{
  select: typeof ordersKpiSelect;
}>;
type AttendanceRow = Prisma.AttendanceDailyRecordGetPayload<{
  select: typeof attendanceSelect;
}>;

type ParsedPeriod = {
  dateFrom: string;
  dateTo: string;
  dateFromValue: Date;
  dateToValue: Date;
  dateToExclusive: Date;
  daysInclusive: number;
};

type ResolvedFilters = {
  selectedChainId: string | null;
  selectedVendorId: string | null;
};

type ScopeContext = {
  metricChains: ChainRow[];
  metricBranches: VendorRow[];
  areaManagerAssignments: AreaManagerAssignmentRow[];
  champAssignments: ChampAssignmentRow[];
  pickerAssignments: PickerAssignmentRow[];
  areaManagerIds: string[];
  champIds: string[];
  pickerIds: string[];
  scopedUserIds: string[];
};

type OrdersTotals = {
  totalOrders: number;
  unhealthyOrders: number;
  orderNotOnTime: number;
};

type AttendanceTotals = {
  totalShifts: number;
  cleanShifts: number;
  issueShifts: number;
  lateCount: number;
  absentCount: number;
  under8Count: number;
  over15Count: number;
};

type RankableRow = {
  name: string;
  unhealthyRate: number | null;
};

const openRequestStatuses = [
  RequestStatus.PENDING_CHAMP,
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
];

@Injectable()
export class AdminPerformanceSummaryService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OrdersKpisTargetSettingsService)
    private readonly targetSettingsService: OrdersKpisTargetSettingsService
  ) {}

  async getSummary(
    query: AdminPerformanceSummaryQueryDto
  ): Promise<AdminPerformanceSummary> {
    const period = parsePeriod(query);
    const filters = await this.resolveFilters(query);
    const selectorChains = await this.findSelectorChains();
    const selectorBranches = await this.findSelectorBranches(
      filters.selectedChainId
    );
    const metricBranches = selectMetricBranches(
      selectorBranches,
      filters.selectedVendorId
    );
    const metricChains = selectMetricChains(
      selectorChains,
      filters.selectedChainId
    );
    const scope = await this.buildScope(metricChains, metricBranches);
    const targetSettings =
      await this.targetSettingsService.getTargetSettingsForReport();
    const [kpiRecords, attendanceRecords, ticketsSummary] = await Promise.all([
      this.findConfirmedKpis(scope, period),
      this.findActiveAttendance(scope, period),
      this.buildTicketsSummary(scope, filters, period)
    ]);
    const minOrdersRequired = minimumOrdersForTopPickers(period.daysInclusive);

    return {
      period: {
        dateFrom: period.dateFrom,
        dateTo: period.dateTo
      },
      filters: {
        selectedChainId: filters.selectedChainId,
        selectedVendorId: filters.selectedVendorId,
        chains: selectorChains.map(toChainOption),
        branches: selectorBranches.map(toBranchOption)
      },
      scopeTotals: {
        chainsCount: scope.metricChains.length,
        branchesCount: scope.metricBranches.length,
        areaManagersCount: scope.areaManagerIds.length,
        champsCount: scope.champIds.length,
        pickersCount: scope.pickerIds.length
      },
      ordersKpi: buildOrdersKpiSummary(kpiRecords, targetSettings),
      attendance: buildAttendanceSummary(attendanceRecords),
      ticketsSummary,
      areaManagersRanking: buildAreaManagerRanking({
        scope,
        kpiRecords,
        attendanceRecords,
        targetSettings,
        minOrdersRequired
      }),
      champsRanking: buildChampRanking({
        scope,
        kpiRecords,
        attendanceRecords,
        targetSettings,
        minOrdersRequired
      }),
      branchesRanking: buildBranchRanking({
        scope,
        kpiRecords,
        attendanceRecords,
        targetSettings,
        minOrdersRequired
      }),
      topPickers: buildTopPickers({
        scope,
        kpiRecords,
        attendanceRecords,
        targetSettings,
        minOrdersRequired
      })
    };
  }

  private async resolveFilters(
    query: AdminPerformanceSummaryQueryDto
  ): Promise<ResolvedFilters> {
    const requestedChainId = normalizeOptionalId(query.chainId);
    const selectedVendorId = normalizeOptionalId(query.vendorId);
    const [chain, vendor] = await Promise.all([
      requestedChainId
        ? this.prisma.chain.findUnique({
            where: { id: requestedChainId },
            select: chainSelect
          })
        : null,
      selectedVendorId
        ? this.prisma.vendor.findUnique({
            where: { id: selectedVendorId },
            select: vendorSelect
          })
        : null
    ]);

    if (requestedChainId && !chain) {
      throw new BadRequestException("The selected chain is invalid.");
    }
    if (selectedVendorId && !vendor) {
      throw new BadRequestException("The selected branch is invalid.");
    }
    if (requestedChainId && vendor && vendor.chainId !== requestedChainId) {
      throw new BadRequestException(
        "The selected branch does not belong to the selected chain."
      );
    }

    return {
      selectedChainId: requestedChainId ?? vendor?.chainId ?? null,
      selectedVendorId
    };
  }

  private findSelectorChains() {
    return this.prisma.chain.findMany({
      where: { status: ChainStatus.ACTIVE },
      orderBy: { chainName: "asc" },
      select: chainSelect
    });
  }

  private findSelectorBranches(selectedChainId: string | null) {
    return this.prisma.vendor.findMany({
      where: {
        status: VendorStatus.ACTIVE,
        ...(selectedChainId ? { chainId: selectedChainId } : {})
      },
      orderBy: { vendorName: "asc" },
      select: vendorSelect
    });
  }

  private async buildScope(
    metricChains: ChainRow[],
    metricBranches: VendorRow[]
  ): Promise<ScopeContext> {
    const chainIds = metricChains.map((chain) => chain.id);
    const vendorIds = metricBranches.map((branch) => branch.id);
    const [
      areaManagerAssignments,
      champAssignments,
      pickerAssignments
    ] = await Promise.all([
      this.findAreaManagerAssignments(chainIds),
      this.findChampAssignments(vendorIds),
      this.findPickerAssignments(vendorIds)
    ]);
    const areaManagerIds = uniqueStrings(
      areaManagerAssignments.map((assignment) => assignment.areaManagerId)
    );
    const champIds = uniqueStrings(
      champAssignments.map((assignment) => assignment.champId)
    );
    const pickerIds = uniqueStrings(
      pickerAssignments.map((assignment) => assignment.pickerId)
    );

    return {
      metricChains,
      metricBranches,
      areaManagerAssignments,
      champAssignments,
      pickerAssignments,
      areaManagerIds,
      champIds,
      pickerIds,
      scopedUserIds: uniqueStrings([...pickerIds, ...champIds])
    };
  }

  private findAreaManagerAssignments(chainIds: string[]) {
    if (!chainIds.length) {
      return Promise.resolve([] as AreaManagerAssignmentRow[]);
    }

    return this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        status: AssignmentStatus.ACTIVE,
        chainId: { in: chainIds }
      },
      select: areaManagerAssignmentSelect
    });
  }

  private findChampAssignments(vendorIds: string[]) {
    if (!vendorIds.length) {
      return Promise.resolve([] as ChampAssignmentRow[]);
    }

    return this.prisma.vendorChampAssignment.findMany({
      where: {
        status: AssignmentStatus.ACTIVE,
        vendorId: { in: vendorIds }
      },
      select: champAssignmentSelect
    });
  }

  private findPickerAssignments(vendorIds: string[]) {
    if (!vendorIds.length) {
      return Promise.resolve([] as PickerAssignmentRow[]);
    }

    return this.prisma.pickerBranchAssignment.findMany({
      where: {
        status: AssignmentStatus.ACTIVE,
        vendorId: { in: vendorIds },
        picker: {
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        }
      },
      select: pickerAssignmentSelect
    });
  }

  private findConfirmedKpis(scope: ScopeContext, period: ParsedPeriod) {
    const vendorIds = scope.metricBranches.map((branch) => branch.id);
    if (!vendorIds.length) {
      return Promise.resolve([] as OrdersKpiRow[]);
    }

    return this.prisma.ordersKpiDailyRecord.findMany({
      where: {
        kpiDate: {
          gte: period.dateFromValue,
          lt: period.dateToExclusive
        },
        matchedVendorId: { in: vendorIds },
        vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
        sourceBatch: {
          is: { status: OrdersKpiImportBatchStatus.CONFIRMED }
        }
      },
      select: ordersKpiSelect
    });
  }

  private findActiveAttendance(scope: ScopeContext, period: ParsedPeriod) {
    if (!scope.scopedUserIds.length) {
      return Promise.resolve([] as AttendanceRow[]);
    }

    return this.prisma.attendanceDailyRecord.findMany({
      where: {
        userId: { in: scope.scopedUserIds },
        shiftDate: {
          gte: period.dateFromValue,
          lt: period.dateToExclusive
        },
        importBatch: {
          is: { status: AttendanceImportBatchStatus.ACTIVE }
        }
      },
      select: attendanceSelect
    });
  }

  private async buildTicketsSummary(
    scope: ScopeContext,
    filters: ResolvedFilters,
    period: ParsedPeriod
  ): Promise<AdminPerformanceSummary["ticketsSummary"]> {
    const scopeWhere = buildRequestScopeWhere(scope, filters);
    if (!scopeWhere) {
      return {
        available: false,
        reason: "No operational scope is available."
      };
    }

    const createdInPeriod = {
      gte: period.dateFromValue,
      lt: period.dateToExclusive
    };
    const completedInPeriod = {
      gte: period.dateFromValue,
      lt: period.dateToExclusive
    };
    const [
      totalTickets,
      closedInPeriod,
      rejectedOrCancelled,
      openNow,
      waitingMyAction
    ] = await Promise.all([
      this.prisma.request.count({
        where: { AND: [scopeWhere, { createdAt: createdInPeriod }] }
      }),
      this.prisma.request.count({
        where: {
          AND: [
            scopeWhere,
            {
              status: {
                in: [RequestStatus.APPROVED, RequestStatus.COMPLETED]
              },
              completedAt: completedInPeriod
            }
          ]
        }
      }),
      this.prisma.request.count({
        where: {
          AND: [
            scopeWhere,
            {
              status: {
                in: [RequestStatus.REJECTED, RequestStatus.CANCELLED]
              },
              createdAt: createdInPeriod
            }
          ]
        }
      }),
      this.prisma.request.count({
        where: {
          AND: [scopeWhere, { status: { in: openRequestStatuses } }]
        }
      }),
      this.prisma.request.count({
        where: {
          AND: [
            scopeWhere,
            {
              status: RequestStatus.PENDING_ADMIN,
              currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL
            }
          ]
        }
      })
    ]);

    return {
      available: true,
      totalTickets,
      openedInPeriod: totalTickets,
      closedInPeriod,
      openNow,
      waitingMyAction,
      rejectedOrCancelled
    };
  }
}

function selectMetricBranches(
  selectorBranches: VendorRow[],
  selectedVendorId: string | null
) {
  if (!selectedVendorId) {
    return selectorBranches;
  }

  return selectorBranches.filter((branch) => branch.id === selectedVendorId);
}

function selectMetricChains(
  selectorChains: ChainRow[],
  selectedChainId: string | null
) {
  if (selectedChainId) {
    return selectorChains.filter((chain) => chain.id === selectedChainId);
  }

  return selectorChains;
}

function toChainOption(chain: ChainRow) {
  return {
    chainId: chain.id,
    chainName: chain.chainName
  };
}

function toBranchOption(branch: VendorRow) {
  return {
    vendorId: branch.id,
    vendorName: branch.vendorName,
    chainId: branch.chainId,
    chainName: branch.chain.chainName
  };
}

function buildOrdersKpiSummary(
  records: OrdersKpiRow[],
  targetSettings: OrdersKpiTargetSettingsResponse
): AdminPerformanceSummary["ordersKpi"] {
  const totals = summarizeOrders(records);
  const unhealthyRate = percentage(
    totals.unhealthyOrders,
    totals.totalOrders
  );

  if (totals.totalOrders <= 0) {
    return {
      available: false,
      target: buildTargetSummary(null, targetSettings),
      reason: "No confirmed KPI records are available for this period."
    };
  }

  return {
    available: true,
    totalOrders: totals.totalOrders,
    unhealthyOrders: totals.unhealthyOrders,
    unhealthyRate,
    orderNotOnTime: totals.orderNotOnTime,
    orderNotOnTimeRate: percentage(
      totals.orderNotOnTime,
      totals.totalOrders
    ),
    target: buildTargetSummary(unhealthyRate, targetSettings),
    trend: buildOrdersTrend(records)
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

function buildOrdersTrend(records: OrdersKpiRow[]) {
  const recordsByDate = groupBy(records, (record) => dateKey(record.kpiDate));

  return Array.from(recordsByDate)
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, dailyRecords]) => {
      const totals = summarizeOrders(dailyRecords);

      return {
        date,
        unhealthyRate:
          percentage(totals.unhealthyOrders, totals.totalOrders) ?? 0,
        totalOrders: totals.totalOrders,
        unhealthyOrders: totals.unhealthyOrders
      };
    });
}

function buildAttendanceSummary(
  records: AttendanceRow[]
): AdminPerformanceSummary["attendance"] {
  const totals = summarizeAttendance(records);

  if (totals.totalShifts <= 0) {
    return {
      available: false,
      includedRoles: ["PICKER", "CHAMP"],
      reason: "No active attendance records are available for this period."
    };
  }

  return {
    available: true,
    attendanceHealthRate: percentage(
      totals.cleanShifts,
      totals.totalShifts
    ),
    totalShifts: totals.totalShifts,
    cleanShifts: totals.cleanShifts,
    issueShifts: totals.issueShifts,
    totalShiftErrors:
      totals.lateCount +
      totals.absentCount +
      totals.under8Count +
      totals.over15Count,
    lateCount: totals.lateCount,
    absentCount: totals.absentCount,
    under8Count: totals.under8Count,
    over15Count: totals.over15Count,
    includedRoles: ["PICKER", "CHAMP"]
  };
}

function buildAreaManagerRanking(options: {
  scope: ScopeContext;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AdminPerformanceSummary["areaManagersRanking"] {
  const rows = uniqueBy(
    options.scope.areaManagerAssignments,
    (assignment) => assignment.areaManagerId
  ).map((assignment) => {
    const chainIds = uniqueStrings(
      options.scope.areaManagerAssignments
        .filter(
          (candidate) =>
            candidate.areaManagerId === assignment.areaManagerId
        )
        .map((candidate) => candidate.chainId)
    );
    const branches = options.scope.metricBranches.filter((branch) =>
      chainIds.includes(branch.chainId)
    );
    const vendorIds = branches.map((branch) => branch.id);
    const scopedUserIds = userIdsForVendors(options.scope, vendorIds);

    return buildAreaManagerRow({
      assignment,
      chainIds,
      branchesCount: branches.length,
      kpiRecords: filterKpisByVendors(options.kpiRecords, vendorIds),
      attendanceRecords: filterAttendanceByUsers(
        options.attendanceRecords,
        scopedUserIds
      ),
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    });
  });

  const rankedRows = rankRows(rows, (row) => ({
    name: row.areaManagerName,
    unhealthyRate: row.unhealthyRate
  }));

  return rankingContainer(rankedRows);
}

function buildAreaManagerRow(options: {
  assignment: AreaManagerAssignmentRow;
  chainIds: string[];
  branchesCount: number;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): Omit<AdminAreaManagerRankRow, "rank"> {
  const kpiTotals = summarizeOrders(options.kpiRecords);
  const attendanceTotals = summarizeAttendance(options.attendanceRecords);
  const unhealthyRate = percentage(
    kpiTotals.unhealthyOrders,
    kpiTotals.totalOrders
  );
  const attendanceHealthRate = percentage(
    attendanceTotals.cleanShifts,
    attendanceTotals.totalShifts
  );

  return {
    areaManagerId: options.assignment.areaManagerId,
    areaManagerName: options.assignment.areaManager.nameEn,
    chainsCount: options.chainIds.length,
    branchesCount: options.branchesCount,
    totalOrders: kpiTotals.totalOrders,
    unhealthyRate,
    attendanceHealthRate,
    status: assessStatus({
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    })
  };
}

function buildChampRanking(options: {
  scope: ScopeContext;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AdminPerformanceSummary["champsRanking"] {
  const rows = uniqueBy(
    options.scope.champAssignments,
    (assignment) => assignment.champId
  ).map((assignment) => {
    const vendorIds = uniqueStrings(
      options.scope.champAssignments
        .filter((candidate) => candidate.champId === assignment.champId)
        .map((candidate) => candidate.vendorId)
    );
    const pickerIds = pickerIdsForVendors(options.scope, vendorIds);
    const attendanceUserIds = uniqueStrings([
      assignment.champId,
      ...pickerIds
    ]);

    return buildChampRow({
      assignment,
      vendorIds,
      pickerIds,
      kpiRecords: filterKpisByVendors(options.kpiRecords, vendorIds),
      attendanceRecords: filterAttendanceByUsers(
        options.attendanceRecords,
        attendanceUserIds
      ),
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    });
  });

  const rankedRows = rankRows(rows, (row) => ({
    name: row.champName,
    unhealthyRate: row.unhealthyRate
  }));

  return rankingContainer(rankedRows);
}

function buildChampRow(options: {
  assignment: ChampAssignmentRow;
  vendorIds: string[];
  pickerIds: string[];
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): Omit<AdminChampRankRow, "rank"> {
  const kpiTotals = summarizeOrders(options.kpiRecords);
  const attendanceTotals = summarizeAttendance(options.attendanceRecords);
  const unhealthyRate = percentage(
    kpiTotals.unhealthyOrders,
    kpiTotals.totalOrders
  );
  const attendanceHealthRate = percentage(
    attendanceTotals.cleanShifts,
    attendanceTotals.totalShifts
  );

  return {
    champId: options.assignment.champId,
    champName: options.assignment.champ.nameEn,
    branchesCount: options.vendorIds.length,
    totalPickers: options.pickerIds.length,
    totalOrders: kpiTotals.totalOrders,
    unhealthyRate,
    attendanceHealthRate,
    status: assessStatus({
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    })
  };
}

function buildBranchRanking(options: {
  scope: ScopeContext;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AdminPerformanceSummary["branchesRanking"] {
  const rows = options.scope.metricBranches.map((branch) => {
    const pickerIds = pickerIdsForVendors(options.scope, [branch.id]);
    const champAssignments = options.scope.champAssignments.filter(
      (assignment) => assignment.vendorId === branch.id
    );
    const attendanceUserIds = uniqueStrings([
      ...pickerIds,
      ...champAssignments.map((assignment) => assignment.champId)
    ]);

    return buildBranchRow({
      branch,
      pickerIds,
      champName: champAssignments[0]?.champ.nameEn ?? null,
      kpiRecords: filterKpisByVendors(options.kpiRecords, [branch.id]),
      attendanceRecords: filterAttendanceByUsers(
        options.attendanceRecords,
        attendanceUserIds
      ),
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    });
  });
  const rankedRows = rankRows(rows, (row) => ({
    name: row.vendorName,
    unhealthyRate: row.unhealthyRate
  }));

  return rankingContainer(rankedRows);
}

function buildBranchRow(options: {
  branch: VendorRow;
  pickerIds: string[];
  champName: string | null;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): Omit<AdminBranchRankRow, "rank"> {
  const kpiTotals = summarizeOrders(options.kpiRecords);
  const attendanceTotals = summarizeAttendance(options.attendanceRecords);
  const unhealthyRate = percentage(
    kpiTotals.unhealthyOrders,
    kpiTotals.totalOrders
  );
  const attendanceHealthRate = percentage(
    attendanceTotals.cleanShifts,
    attendanceTotals.totalShifts
  );

  return {
    vendorId: options.branch.id,
    vendorName: options.branch.vendorName,
    chainId: options.branch.chainId,
    chainName: options.branch.chain.chainName,
    champName: options.champName,
    totalPickers: options.pickerIds.length,
    totalOrders: kpiTotals.totalOrders,
    unhealthyRate,
    attendanceHealthRate,
    status: assessStatus({
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    })
  };
}

function buildTopPickers(options: {
  scope: ScopeContext;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AdminPerformanceSummary["topPickers"] {
  const branchById = new Map(
    options.scope.metricBranches.map((branch) => [branch.id, branch])
  );
  const candidates = uniqueBy(
    options.scope.pickerAssignments,
    (assignment) => assignment.pickerId
  ).map((assignment) => {
    const pickerKpis = options.kpiRecords.filter(
      (record) => record.userId === assignment.pickerId
    );
    const pickerAttendance = options.attendanceRecords.filter(
      (record) => record.userId === assignment.pickerId
    );
    const branch = branchById.get(assignment.vendorId);

    return buildTopPickerRow({
      assignment,
      branch,
      kpiRecords: pickerKpis,
      attendanceRecords: pickerAttendance,
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    });
  });
  const eligible = candidates.filter(
    (picker) => picker.totalOrders >= options.minOrdersRequired
  );
  const rankedEligible = rankRows(eligible, (row) => ({
    name: row.pickerName,
    unhealthyRate: row.unhealthyRate
  }));

  return {
    available: rankedEligible.length > 0,
    basis: "UHO_ONLY_WITH_MINIMUM_ORDERS",
    minOrdersRequired: options.minOrdersRequired,
    rows: rankedEligible.slice(0, 10),
    totalEligible: rankedEligible.length,
    reason: rankedEligible.length
      ? undefined
      : "No Pickers meet the minimum confirmed-order threshold."
  };
}

function buildTopPickerRow(options: {
  assignment: PickerAssignmentRow;
  branch: VendorRow | undefined;
  kpiRecords: OrdersKpiRow[];
  attendanceRecords: AttendanceRow[];
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): Omit<AdminTopPickerRow, "rank"> {
  const kpiTotals = summarizeOrders(options.kpiRecords);
  const attendanceTotals = summarizeAttendance(options.attendanceRecords);
  const unhealthyRate = percentage(
    kpiTotals.unhealthyOrders,
    kpiTotals.totalOrders
  );
  const attendanceHealthRate = percentage(
    attendanceTotals.cleanShifts,
    attendanceTotals.totalShifts
  );

  return {
    pickerId: options.assignment.pickerId,
    pickerName: options.assignment.picker.nameEn,
    shopperId: options.assignment.picker.shopperId,
    vendorId: options.branch?.id ?? null,
    vendorName: options.branch?.vendorName ?? null,
    chainId: options.branch?.chainId ?? null,
    chainName: options.branch?.chain.chainName ?? null,
    totalOrders: kpiTotals.totalOrders,
    unhealthyRate,
    attendanceHealthRate,
    status: assessStatus({
      totalOrders: kpiTotals.totalOrders,
      unhealthyRate,
      attendanceHealthRate,
      issueShifts: attendanceTotals.issueShifts,
      targetSettings: options.targetSettings,
      minOrdersRequired: options.minOrdersRequired
    })
  };
}

function rankingContainer<T>(
  rows: T[]
): {
  available: boolean;
  basis: "UHO_ONLY";
  rows: T[];
  totalRows: number;
  reason?: string;
} {
  return {
    available: rows.length > 0,
    basis: "UHO_ONLY",
    rows,
    totalRows: rows.length,
    reason: rows.length ? undefined : "No scoped ranking rows are available."
  };
}

function rankRows<T>(
  rows: Array<Omit<T, "rank">>,
  getRankable: (row: Omit<T, "rank">) => RankableRow
): T[] {
  return [...rows]
    .sort((left, right) =>
      compareUhoThenName(getRankable(left), getRankable(right))
    )
    .map((row, index) => ({ ...row, rank: index + 1 }) as T);
}

function compareUhoThenName(left: RankableRow, right: RankableRow) {
  if (left.unhealthyRate === null) {
    return right.unhealthyRate === null
      ? left.name.localeCompare(right.name)
      : 1;
  }
  if (right.unhealthyRate === null) {
    return -1;
  }

  return (
    left.unhealthyRate - right.unhealthyRate ||
    left.name.localeCompare(right.name)
  );
}

function assessStatus(options: {
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  issueShifts: number;
  targetSettings: OrdersKpiTargetSettingsResponse;
  minOrdersRequired: number;
}): AdminPerformanceStatus {
  if (options.totalOrders <= 0) {
    return "NO_KPI";
  }
  if (options.totalOrders < options.minOrdersRequired) {
    return "LOW_VOLUME";
  }

  const configured = options.targetSettings.source === "SAVED";
  const target = configured
    ? options.targetSettings.targets.uhoRateTarget
    : null;
  const uhoOutOfTarget =
    target !== null &&
    options.unhealthyRate !== null &&
    options.unhealthyRate > target;
  if (
    uhoOutOfTarget ||
    (options.attendanceHealthRate !== null &&
      options.attendanceHealthRate < 70)
  ) {
    return "NEEDS_ACTION";
  }

  const uhoNearTarget =
    target !== null &&
    options.unhealthyRate !== null &&
    options.unhealthyRate >= target * 0.9;
  if (
    uhoNearTarget ||
    (options.attendanceHealthRate !== null &&
      options.attendanceHealthRate < 85) ||
    options.issueShifts > 0
  ) {
    return "WATCH";
  }

  return "IN_TARGET";
}

function summarizeOrders(records: OrdersKpiRow[]): OrdersTotals {
  return records.reduce(
    (totals, record) => ({
      totalOrders: totals.totalOrders + record.totalOrders,
      unhealthyOrders:
        totals.unhealthyOrders + record.unhealthyOrders,
      orderNotOnTime:
        totals.orderNotOnTime + record.orderNotOnTime
    }),
    {
      totalOrders: 0,
      unhealthyOrders: 0,
      orderNotOnTime: 0
    }
  );
}

function summarizeAttendance(records: AttendanceRow[]): AttendanceTotals {
  const totals: AttendanceTotals = {
    totalShifts: 0,
    cleanShifts: 0,
    issueShifts: 0,
    lateCount: 0,
    absentCount: 0,
    under8Count: 0,
    over15Count: 0
  };

  for (const record of records) {
    addAttendanceRecord(totals, record);
  }

  return totals;
}

function addAttendanceRecord(
  totals: AttendanceTotals,
  record: AttendanceRow
) {
  const absent = record.isAbsent || record.calculatedStatus === "ABSENT";
  const late = record.isLate || record.calculatedStatus === "LATE";
  const issue =
    absent ||
    late ||
    record.isUnder8Hours ||
    record.isOver15Hours ||
    record.issuesCount > 0;
  const attended =
    !absent &&
    (record.isOnTime ||
      late ||
      record.isUnder8Hours ||
      record.isOver15Hours ||
      record.calculatedStatus === "ON_TIME");

  if (attended || absent || issue) {
    totals.totalShifts += 1;
    if (issue) {
      totals.issueShifts += 1;
    } else {
      totals.cleanShifts += 1;
    }
  }
  if (late) totals.lateCount += 1;
  if (absent) totals.absentCount += 1;
  if (record.isUnder8Hours) totals.under8Count += 1;
  if (record.isOver15Hours) totals.over15Count += 1;
}

function buildRequestScopeWhere(
  scope: ScopeContext,
  filters: ResolvedFilters
): Prisma.RequestWhereInput | null {
  if (filters.selectedVendorId) {
    return {
      OR: [
        { sourceVendorId: filters.selectedVendorId },
        { destinationVendorId: filters.selectedVendorId }
      ]
    };
  }

  const chainIds = scope.metricChains.map((chain) => chain.id);
  const vendorIds = scope.metricBranches.map((branch) => branch.id);
  const conditions: Prisma.RequestWhereInput[] = [];

  if (chainIds.length) {
    conditions.push(
      { sourceChainId: { in: chainIds } },
      { destinationChainId: { in: chainIds } }
    );
  }
  if (vendorIds.length) {
    conditions.push(
      { sourceVendorId: { in: vendorIds } },
      { destinationVendorId: { in: vendorIds } }
    );
  }

  return conditions.length ? { OR: conditions } : null;
}

function userIdsForVendors(scope: ScopeContext, vendorIds: string[]) {
  return uniqueStrings([
    ...pickerIdsForVendors(scope, vendorIds),
    ...scope.champAssignments
      .filter((assignment) => vendorIds.includes(assignment.vendorId))
      .map((assignment) => assignment.champId)
  ]);
}

function pickerIdsForVendors(scope: ScopeContext, vendorIds: string[]) {
  return uniqueStrings(
    scope.pickerAssignments
      .filter((assignment) => vendorIds.includes(assignment.vendorId))
      .map((assignment) => assignment.pickerId)
  );
}

function filterKpisByVendors(
  records: OrdersKpiRow[],
  vendorIds: string[]
) {
  return records.filter(
    (record) =>
      record.matchedVendorId !== null &&
      vendorIds.includes(record.matchedVendorId)
  );
}

function filterAttendanceByUsers(
  records: AttendanceRow[],
  userIds: string[]
) {
  return records.filter((record) => userIds.includes(record.userId));
}

function parsePeriod(
  query: AdminPerformanceSummaryQueryDto
): ParsedPeriod {
  const dateFromValue = parseDateOnly(query.dateFrom, "dateFrom");
  const dateToValue = parseDateOnly(query.dateTo, "dateTo");

  if (dateFromValue.getTime() > dateToValue.getTime()) {
    throw new BadRequestException(
      "dateFrom must be before or equal to dateTo."
    );
  }

  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    dateFromValue,
    dateToValue,
    dateToExclusive: addUtcDays(dateToValue, 1),
    daysInclusive: daysBetweenInclusive(dateFromValue, dateToValue)
  };
}

function parseDateOnly(value: string | undefined, fieldName: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(
      fieldName + " must use YYYY-MM-DD format."
    );
  }

  const parsed = new Date(value + "T00:00:00.000Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(fieldName + " must be a valid date.");
  }

  return parsed;
}

function normalizeOptionalId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function minimumOrdersForTopPickers(daysInclusive: number) {
  if (daysInclusive <= 1) return 5;
  if (daysInclusive <= 7) return 20;
  if (daysInclusive <= 31) return 60;
  return 180;
}

function daysBetweenInclusive(dateFrom: Date, dateTo: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.floor(
      (dateTo.getTime() - dateFrom.getTime()) / millisecondsPerDay
    ) + 1
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 10_000) / 100;
}

function groupBy<T>(
  values: T[],
  getKey: (value: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const entry of values) {
    const key = getKey(entry);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  return groups;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const uniqueValues = new Map<string, T>();

  for (const entry of values) {
    if (!uniqueValues.has(getKey(entry))) {
      uniqueValues.set(getKey(entry), entry);
    }
  }

  return Array.from(uniqueValues.values());
}
