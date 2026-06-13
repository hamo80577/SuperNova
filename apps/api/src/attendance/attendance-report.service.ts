import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  AssignmentStatus,
  AttendanceCalculatedStatus,
  AttendanceImportBatchStatus,
  AttendancePersonRole,
  Prisma,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceDailyReportAnalytics,
  AttendanceDailyReportFilterOptions,
  AttendanceDailyReportQuery,
  AttendanceDailyReportResponse,
  AttendanceDailyReportRow,
  AttendanceDailyReportSummary,
  AttendanceMetricDelta
} from "./attendance-report.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const dailyReportSelect = {
  id: true,
  shopperId: true,
  personRole: true,
  identifierType: true,
  identifierValue: true,
  personNameSnapshot: true,
  userId: true,
  shiftDate: true,
  pickerNameSnapshot: true,
  sourceDesignation: true,
  sourceLocation: true,
  sourceSubDivision: true,
  reportedVendorId: true,
  reportedChainId: true,
  reportedLocationCode: true,
  reportedLocationName: true,
  reportedLocationRaw: true,
  locationMappingStatus: true,
  shiftName: true,
  scheduledStartTime: true,
  scheduledEndTime: true,
  actualCheckinTime: true,
  actualCheckoutTime: true,
  actualWorkDurationHours: true,
  calculatedStatus: true,
  rawLateMins: true,
  chargeableLateMins: true,
  lateBucket: true,
  leaveType: true,
  isWorkingDay: true,
  isUnder8Hours: true,
  isOver15Hours: true,
  issuesCount: true
} satisfies Prisma.AttendanceDailyRecordSelect;

const dailyFilterOptionSelect = {
  calculatedStatus: true,
  reportedChainId: true,
  reportedLocationCode: true,
  reportedLocationName: true,
  reportedLocationRaw: true,
  sourceLocation: true,
  sourceSubDivision: true
} satisfies Prisma.AttendanceDailyRecordSelect;

const dailySummarySelect = {
  userId: true,
  calculatedStatus: true,
  rawLateMins: true,
  chargeableLateMins: true,
  lateBucket: true,
  actualWorkDurationHours: true,
  isOnLeave: true,
  isOffDay: true,
  isUnder8Hours: true,
  isOver15Hours: true
} satisfies Prisma.AttendanceDailyRecordSelect;

type AttendanceDailyReportRecord = Prisma.AttendanceDailyRecordGetPayload<{
  select: typeof dailyReportSelect;
}>;

type AttendanceDailySummaryRecord = Prisma.AttendanceDailyRecordGetPayload<{
  select: typeof dailySummarySelect;
}>;

type AttendanceDailyFilterOptionRecord =
  Prisma.AttendanceDailyRecordGetPayload<{
    select: typeof dailyFilterOptionSelect;
  }>;

type AttendanceReportActor = Pick<AuthenticatedUser, "id" | "role">;

type AttendanceDailyReportScope =
  | { kind: "ALL" }
  | { kind: "PICKER"; userId: string }
  | { kind: "REPORTED_CHAINS"; chainIds: string[] }
  | { kind: "CHAMP_SCOPED"; vendorIds: string[]; champUserId: string };

@Injectable()
export class AttendanceReportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getDailyReport(
    query: AttendanceDailyReportQuery,
    actor: AttendanceReportActor
  ): Promise<AttendanceDailyReportResponse> {
    const periodMonth = normalizePeriodMonth(query.periodMonth);
    const pagination = normalizePagination(query);
    const fallbackRange = buildAnalyticsRange(periodMonth, query);
    const reportScope = await this.resolveDailyReportScope(actor);
    const activeBatch = await this.prisma.attendanceImportBatch.findFirst({
      where: {
        periodMonth,
        status: AttendanceImportBatchStatus.ACTIVE
      },
      orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }]
    });

    if (!activeBatch) {
      return {
        periodMonth,
        activeBatchId: null,
        coverageStartDate: null,
        coverageEndDate: null,
        expectedCoverageEndDate: null,
        analytics: emptyAnalytics(fallbackRange),
        filterOptions: emptyFilterOptions(),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalRows: 0,
          totalPages: 0
        },
        summary: emptySummary(),
        rows: []
      };
    }

    const analyticsRange = buildAnalyticsRange(periodMonth, query, {
      coverageEndDate: activeBatch.coverageEndDate,
      coverageStartDate: activeBatch.coverageStartDate
    });
    const listWhere = buildDailyReportWhere(activeBatch.id, query, reportScope);
    const currentAnalyticsWhere = buildDailyAnalyticsWhere(
      activeBatch.id,
      analyticsRange.dateFrom,
      analyticsRange.dateTo,
      query,
      reportScope
    );
    const previousAnalyticsWhere = buildDailyAnalyticsWhere(
      activeBatch.id,
      analyticsRange.comparisonDateFrom,
      analyticsRange.comparisonDateTo,
      query,
      reportScope
    );
    const chainOptionsWhere = buildFilterOptionWhere(
      activeBatch.id,
      query,
      {
        includeBranch: false,
        includeChain: false,
        includeStatus: false
      },
      reportScope
    );
    const branchOptionsWhere = buildFilterOptionWhere(
      activeBatch.id,
      query,
      {
        includeBranch: false,
        includeChain: true,
        includeStatus: false
      },
      reportScope
    );
    const statusOptionsWhere = buildFilterOptionWhere(
      activeBatch.id,
      query,
      {
        includeBranch: true,
        includeChain: true,
        includeStatus: false
      },
      reportScope
    );
    const totalRows = await this.prisma.attendanceDailyRecord.count({
      where: listWhere
    });
    const [
      rows,
      currentAnalyticsRecords,
      previousAnalyticsRecords,
      chainOptionRecords,
      branchOptionRecords,
      statusOptionRecords
    ] =
      await Promise.all([
      this.prisma.attendanceDailyRecord.findMany({
        where: listWhere,
        select: dailyReportSelect,
        orderBy: buildDailyOrderBy(query),
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: currentAnalyticsWhere,
        select: dailySummarySelect
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: previousAnalyticsWhere,
        select: dailySummarySelect
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: chainOptionsWhere,
        select: dailyFilterOptionSelect
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: branchOptionsWhere,
        select: dailyFilterOptionSelect
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where: statusOptionsWhere,
        select: dailyFilterOptionSelect
      })
    ]);

    return {
      periodMonth,
      activeBatchId: activeBatch.id,
      coverageStartDate: formatDateOnlyOrNull(activeBatch.coverageStartDate),
      coverageEndDate: formatDateOnlyOrNull(activeBatch.coverageEndDate),
      expectedCoverageEndDate: formatDateOnlyOrNull(
        activeBatch.expectedCoverageEndDate
      ),
      analytics: buildAnalytics(
        analyticsRange,
        currentAnalyticsRecords,
        previousAnalyticsRecords
      ),
      filterOptions: buildFilterOptions({
        branchRecords: branchOptionRecords,
        chainRecords: chainOptionRecords,
        statusRecords: statusOptionRecords
      }),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / pagination.pageSize)
      },
      summary: summarizeDailyRecords(currentAnalyticsRecords),
      rows: rows.map(toDailyReportRow)
    };
  }

  private async resolveDailyReportScope(
    actor: AttendanceReportActor
  ): Promise<AttendanceDailyReportScope> {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN) {
      return { kind: "ALL" };
    }

    if (actor.role === UserRole.PICKER) {
      return { kind: "PICKER", userId: actor.id };
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      const chainAssignments =
        await this.prisma.chainAreaManagerAssignment.findMany({
          where: {
            areaManagerId: actor.id,
            status: AssignmentStatus.ACTIVE
          },
          select: { chainId: true }
        });
      const chainIds = uniqueStrings(
        chainAssignments.map((assignment) => assignment.chainId)
      );

      return { kind: "REPORTED_CHAINS", chainIds };
    }

    if (actor.role === UserRole.CHAMP) {
      const vendorAssignments =
        await this.prisma.vendorChampAssignment.findMany({
          where: {
            champId: actor.id,
            status: AssignmentStatus.ACTIVE
          },
          select: { vendorId: true }
        });
      const vendorIds = uniqueStrings(
        vendorAssignments.map((assignment) => assignment.vendorId)
      );

      // A champ sees PICKER attendance in their assigned branches plus their
      // own CHAMP attendance — never other champs' attendance.
      return { kind: "CHAMP_SCOPED", vendorIds, champUserId: actor.id };
    }

    throw new ForbiddenException("You do not have permission for this action.");
  }
}

function buildDailyReportWhere(
  importBatchId: string,
  query: AttendanceDailyReportQuery,
  reportScope: AttendanceDailyReportScope
): Prisma.AttendanceDailyRecordWhereInput {
  const where: Prisma.AttendanceDailyRecordWhereInput = {
    importBatchId,
    importBatch: {
      is: {
        status: AttendanceImportBatchStatus.ACTIVE
      }
    }
  };
  applyDailyReportScope(where, reportScope);

  if (query.dateFrom || query.dateTo) {
    where.shiftDate = {};
    if (query.dateFrom) {
      where.shiftDate.gte = parseDateOnly(query.dateFrom, "dateFrom");
    }
    if (query.dateTo) {
      where.shiftDate.lte = parseDateOnly(query.dateTo, "dateTo");
    }
  }

  if (query.shopperId?.trim()) {
    // The query param is still called "shopperId" for compatibility, but it
    // applies to the generic identifierValue (Champ ibsId) as well as the
    // legacy shopperId. Added via AND so it composes with scope + pickerSearch.
    const identifier = query.shopperId.trim();
    addDailyAnd(where, {
      OR: [
        { identifierValue: { contains: identifier, mode: "insensitive" } },
        { shopperId: { contains: identifier, mode: "insensitive" } }
      ]
    });
  }

  if (query.pickerSearch?.trim()) {
    const search = query.pickerSearch.trim();
    where.OR = [
      {
        personNameSnapshot: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        pickerNameSnapshot: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        sourceName: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        identifierValue: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        shopperId: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        reportedLocationName: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        reportedLocationRaw: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        reportedLocationCode: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        sourceLocation: {
          contains: search,
          mode: "insensitive"
        }
      }
    ];
  }

  applyDailyFacetFilters(where, query);

  return where;
}

function buildFilterOptionWhere(
  importBatchId: string,
  query: AttendanceDailyReportQuery,
  options: {
    includeBranch: boolean;
    includeChain: boolean;
    includeStatus: boolean;
  },
  reportScope: AttendanceDailyReportScope
) {
  return buildDailyReportWhere(importBatchId, {
    ...query,
    branch: options.includeBranch ? query.branch : undefined,
    chain: options.includeChain ? query.chain : undefined,
    status: options.includeStatus ? query.status : undefined
  }, reportScope);
}

function applyDailyFacetFilters(
  where: Prisma.AttendanceDailyRecordWhereInput,
  query?: AttendanceDailyReportQuery
) {
  if (!query) {
    return;
  }

  if (query.branch?.trim()) {
    const branch = query.branch.trim();
    addDailyAnd(where, {
      OR: [
        { reportedLocationName: { contains: branch, mode: "insensitive" } },
        { reportedLocationRaw: { contains: branch, mode: "insensitive" } },
        { reportedLocationCode: { contains: branch, mode: "insensitive" } },
        { sourceLocation: { contains: branch, mode: "insensitive" } }
      ]
    });
  }

  if (query.chain?.trim()) {
    addDailyAnd(where, {
      reportedChainId: {
        contains: query.chain.trim(),
        mode: "insensitive"
      }
    });
  }

  if (query.status) {
    where.calculatedStatus = query.status;
  }

  if (query.role) {
    where.personRole = query.role;
  }

  if (query.lateOnly === true) {
    where.isLate = true;
  }

  if (query.absentOnly === true) {
    where.isAbsent = true;
  }

  if (query.onLeaveOnly === true) {
    where.isOnLeave = true;
  }
}

function buildDailyAnalyticsWhere(
  importBatchId: string,
  dateFrom: string,
  dateTo: string,
  query: AttendanceDailyReportQuery | undefined,
  reportScope: AttendanceDailyReportScope
): Prisma.AttendanceDailyRecordWhereInput {
  const where: Prisma.AttendanceDailyRecordWhereInput = {
    importBatchId,
    importBatch: {
      is: {
        status: AttendanceImportBatchStatus.ACTIVE
      }
    },
    shiftDate: {
      gte: parseDateOnly(dateFrom, "dateFrom"),
      lte: parseDateOnly(dateTo, "dateTo")
    }
  };
  applyDailyReportScope(where, reportScope);

  applyDailyFacetFilters(where, query);

  return where;
}

function applyDailyReportScope(
  where: Prisma.AttendanceDailyRecordWhereInput,
  reportScope: AttendanceDailyReportScope
) {
  if (reportScope.kind === "PICKER") {
    where.userId = reportScope.userId;
  }

  if (reportScope.kind === "REPORTED_CHAINS") {
    where.reportedChainId = { in: reportScope.chainIds };
  }

  if (reportScope.kind === "CHAMP_SCOPED") {
    // Pickers reported in the champ's assigned branches OR the champ's own
    // attendance. Added via AND so it composes with search/facet filters
    // without being overwritten by the pickerSearch OR clause.
    addDailyAnd(where, {
      OR: [
        {
          personRole: AttendancePersonRole.PICKER,
          reportedVendorId: { in: reportScope.vendorIds }
        },
        {
          personRole: AttendancePersonRole.CHAMP,
          userId: reportScope.champUserId
        }
      ]
    });
  }
}

function addDailyAnd(
  where: Prisma.AttendanceDailyRecordWhereInput,
  condition: Prisma.AttendanceDailyRecordWhereInput
) {
  const existing = where.AND;

  if (Array.isArray(existing)) {
    where.AND = [...existing, condition];
    return;
  }

  if (existing) {
    where.AND = [existing, condition];
    return;
  }

  where.AND = [condition];
}

function buildDailyOrderBy(
  query: AttendanceDailyReportQuery
): Prisma.AttendanceDailyRecordOrderByWithRelationInput[] {
  const direction = query.sortDirection === "desc" ? "desc" : "asc";
  const sortFieldByKey = {
    date: "shiftDate",
    hours: "actualWorkDurationHours",
    location: "reportedLocationName",
    name: "personNameSnapshot",
    status: "calculatedStatus"
  } satisfies Record<
    NonNullable<AttendanceDailyReportQuery["sortBy"]>,
    keyof Prisma.AttendanceDailyRecordOrderByWithRelationInput
  >;
  const field = query.sortBy ? sortFieldByKey[query.sortBy] : null;
  const order: Prisma.AttendanceDailyRecordOrderByWithRelationInput[] = [];

  if (field) {
    order.push({
      [field]: direction
    } as Prisma.AttendanceDailyRecordOrderByWithRelationInput);
  }

  order.push(
    { shiftDate: "asc" },
    { personNameSnapshot: "asc" },
    { identifierValue: "asc" }
  );

  return order;
}

function buildAnalyticsRange(
  periodMonth: string,
  query: AttendanceDailyReportQuery,
  coverage?: {
    coverageStartDate: Date | null;
    coverageEndDate: Date | null;
  }
): AttendanceDailyReportAnalytics["range"] {
  const fallbackStart =
    formatDateOnlyOrNull(coverage?.coverageStartDate ?? null) ??
    firstDayOfPeriodMonth(periodMonth);
  const fallbackEnd =
    formatDateOnlyOrNull(coverage?.coverageEndDate ?? null) ??
    lastDayOfPeriodMonth(periodMonth);
  const hasDateFrom = Boolean(query.dateFrom);
  const hasDateTo = Boolean(query.dateTo);
  let dateFrom = query.dateFrom ?? (hasDateTo ? query.dateTo! : fallbackStart);
  let dateTo = query.dateTo ?? (hasDateFrom ? query.dateFrom! : fallbackEnd);
  let parsedFrom = parseDateOnly(dateFrom, "dateFrom");
  let parsedTo = parseDateOnly(dateTo, "dateTo");

  if (parsedFrom > parsedTo) {
    [parsedFrom, parsedTo] = [parsedTo, parsedFrom];
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  const days = differenceInDays(parsedFrom, parsedTo) + 1;
  const comparisonDateTo = addDays(parsedFrom, -1);
  const comparisonDateFrom = addDays(comparisonDateTo, -(days - 1));

  return {
    dateFrom,
    dateTo,
    days,
    comparisonDateFrom: formatDateOnly(comparisonDateFrom),
    comparisonDateTo: formatDateOnly(comparisonDateTo)
  };
}

function buildAnalytics(
  range: AttendanceDailyReportAnalytics["range"],
  currentRecords: AttendanceDailySummaryRecord[],
  previousRecords: AttendanceDailySummaryRecord[]
): AttendanceDailyReportAnalytics {
  const current = summarizeAnalyticsRecords(currentRecords);
  const previous = summarizeAnalyticsRecords(previousRecords);

  return {
    range,
    pickerCount: current.pickerCount,
    attendanceRate: {
      attendCount: current.attendCount,
      delta: buildRateDelta(
        current.attendanceRate,
        previous.attendanceRate,
        previous.totalShifts
      ),
      totalShifts: current.totalShifts,
      value: current.attendanceRate
    },
    attendanceMix: {
      absent: segment(current.absentCount, current.totalShifts),
      attend: segment(current.attendCount, current.totalShifts),
      onLeave: segment(current.onLeaveCount, current.totalShifts)
    },
    lateBuckets: {
      late1: segment(current.late1Count, current.totalLateCount),
      late2: segment(current.late2Count, current.totalLateCount),
      late3: segment(current.late3Count, current.totalLateCount),
      totalLateCount: current.totalLateCount
    },
    averageLogHours: {
      attendedShiftCount: current.attendedShiftCount,
      delta: buildPercentDelta(current.averageLogHours, previous.averageLogHours),
      formattedValue: formatHoursMetric(current.averageLogHours),
      value: current.averageLogHours
    },
    performance: {
      problemMix: {
        absent: segment(current.problemAbsentCount, current.totalShifts),
        all: segment(current.problemShiftCount, current.totalShifts),
        late: segment(current.problemLateCount, current.totalShifts),
        over15: segment(current.problemOver15Count, current.totalShifts),
        under8: segment(current.problemUnder8Count, current.totalShifts)
      },
      problemShiftCount: {
        delta: buildPercentDelta(
          current.problemShiftCount,
          previous.problemShiftCount
        ),
        value: current.problemShiftCount
      },
      validShiftRate: {
        delta: buildRateDelta(
          current.validShiftRate,
          previous.validShiftRate,
          previous.totalShifts
        ),
        totalShifts: current.totalShifts,
        validShiftCount: current.validShiftCount,
        value: current.validShiftRate
      }
    },
    shiftQuality: {
      cleanShiftRate: {
        delta: buildRateDelta(
          current.validShiftRate,
          previous.validShiftRate,
          previous.totalShifts
        ),
        totalShifts: current.totalShifts,
        value: current.validShiftRate
      },
      counts: {
        cleanShifts: {
          delta: buildPercentDelta(
            current.validShiftCount,
            previous.validShiftCount
          ),
          value: current.validShiftCount
        },
        errorShifts: {
          delta: buildPercentDelta(
            current.problemShiftCount,
            previous.problemShiftCount
          ),
          value: current.problemShiftCount
        },
        totalShifts: {
          delta: buildPercentDelta(current.totalShifts, previous.totalShifts),
          value: current.totalShifts
        }
      }
    },
    workStatusRates: {
      absent: statusRateSegment(
        current.absentCount,
        current.totalShifts,
        previous.absentCount,
        previous.totalShifts
      ),
      all: statusRateSegment(
        current.attendCount,
        current.totalShifts,
        previous.attendCount,
        previous.totalShifts
      ),
      lateOver15: statusRateSegment(
        current.problemLateCount,
        current.totalShifts,
        previous.problemLateCount,
        previous.totalShifts
      ),
      onLeave: statusRateSegment(
        current.onLeaveCount,
        current.totalShifts,
        previous.onLeaveCount,
        previous.totalShifts
      ),
      onTime: statusRateSegment(
        current.onTimeCount,
        current.totalShifts,
        previous.onTimeCount,
        previous.totalShifts
      )
    }
  };
}

function emptyAnalytics(
  range: AttendanceDailyReportAnalytics["range"]
): AttendanceDailyReportAnalytics {
  return buildAnalytics(range, [], []);
}

function buildFilterOptions({
  branchRecords,
  chainRecords,
  statusRecords
}: {
  branchRecords: AttendanceDailyFilterOptionRecord[];
  chainRecords: AttendanceDailyFilterOptionRecord[];
  statusRecords: AttendanceDailyFilterOptionRecord[];
}): AttendanceDailyReportFilterOptions {
  const statusSet = new Set<AttendanceCalculatedStatus>();
  const branchSet = new Set<string>();
  const chainSet = new Set<string>();

  for (const record of statusRecords) {
    statusSet.add(record.calculatedStatus);
  }
  for (const record of branchRecords) {
    addCleanOption(
      branchSet,
      record.reportedLocationName ??
        record.reportedLocationRaw ??
        record.reportedLocationCode ??
        record.sourceLocation
    );
  }
  for (const record of chainRecords) {
    addCleanOption(chainSet, record.reportedChainId);
  }

  return {
    branches: Array.from(branchSet).sort((left, right) =>
      left.localeCompare(right)
    ),
    chains: Array.from(chainSet).sort((left, right) =>
      left.localeCompare(right)
    ),
    statuses: Object.values(AttendanceCalculatedStatus).filter((status) =>
      statusSet.has(status)
    )
  };
}

function emptyFilterOptions(): AttendanceDailyReportFilterOptions {
  return {
    branches: [],
    chains: [],
    statuses: []
  };
}

function addCleanOption(target: Set<string>, value: string | null) {
  const normalized = value?.trim();
  if (normalized) {
    target.add(normalized);
  }
}

function summarizeAnalyticsRecords(records: AttendanceDailySummaryRecord[]) {
  const summary = records.reduce(
    (state, record) => {
      const isAttend =
        record.calculatedStatus === AttendanceCalculatedStatus.ON_TIME ||
        record.calculatedStatus === AttendanceCalculatedStatus.LATE;
      const isAbsent =
        record.calculatedStatus === AttendanceCalculatedStatus.ABSENT;
      const isOnLeave =
        record.isOnLeave ||
        record.isOffDay ||
        record.calculatedStatus === AttendanceCalculatedStatus.ANNUAL_LEAVE ||
        record.calculatedStatus === AttendanceCalculatedStatus.MEDICAL_LEAVE ||
        record.calculatedStatus === AttendanceCalculatedStatus.OTHER_LEAVE ||
        record.calculatedStatus === AttendanceCalculatedStatus.OFF_DAY;
      const actualHours = decimalToNumberOrNull(record.actualWorkDurationHours);
      const isProblemLate = (record.rawLateMins ?? 0) > 15;
      const isProblem =
        isAbsent || isProblemLate || record.isUnder8Hours || record.isOver15Hours;

      state.totalShifts += 1;
      state.pickerIds.add(record.userId);

      if (isAttend) {
        state.attendCount += 1;
      }
      if (record.calculatedStatus === AttendanceCalculatedStatus.ON_TIME) {
        state.onTimeCount += 1;
      }
      if (isAbsent) {
        state.absentCount += 1;
      }
      if (isOnLeave) {
        state.onLeaveCount += 1;
      }
      if (record.lateBucket === "LATE_1") {
        state.late1Count += 1;
      }
      if (record.lateBucket === "LATE_2") {
        state.late2Count += 1;
      }
      if (record.lateBucket === "LATE_3") {
        state.late3Count += 1;
      }
      if (isAttend && actualHours !== null) {
        state.attendedShiftCount += 1;
        state.attendedHoursTotal += actualHours;
      }
      if (isProblem) {
        state.problemShiftCount += 1;
      }
      if (isAbsent) {
        state.problemAbsentCount += 1;
      }
      if (isProblemLate) {
        state.problemLateCount += 1;
      }
      if (record.isUnder8Hours) {
        state.problemUnder8Count += 1;
      }
      if (record.isOver15Hours) {
        state.problemOver15Count += 1;
      }

      return state;
    },
    {
      absentCount: 0,
      attendCount: 0,
      attendedHoursTotal: 0,
      attendedShiftCount: 0,
      late1Count: 0,
      late2Count: 0,
      late3Count: 0,
      onLeaveCount: 0,
      onTimeCount: 0,
      pickerIds: new Set<string>(),
      problemAbsentCount: 0,
      problemLateCount: 0,
      problemOver15Count: 0,
      problemShiftCount: 0,
      problemUnder8Count: 0,
      totalShifts: 0
    }
  );
  const validShiftCount = summary.totalShifts - summary.problemShiftCount;

  return {
    ...summary,
    attendanceRate: percentage(summary.attendCount, summary.totalShifts),
    averageLogHours:
      summary.attendedShiftCount > 0
        ? roundMetric(summary.attendedHoursTotal / summary.attendedShiftCount)
        : null,
    totalLateCount: summary.late1Count + summary.late2Count + summary.late3Count,
    pickerCount: summary.pickerIds.size,
    validShiftCount,
    validShiftRate: percentage(validShiftCount, summary.totalShifts)
  };
}

function segment(count: number, total: number) {
  return {
    count,
    percentage: percentage(count, total)
  };
}

function statusRateSegment(
  currentCount: number,
  currentTotal: number,
  previousCount: number,
  previousTotal: number
) {
  const currentPercentage = percentage(currentCount, currentTotal);
  const previousPercentage = percentage(previousCount, previousTotal);

  return {
    count: currentCount,
    delta: buildRateDelta(currentPercentage, previousPercentage, previousTotal),
    percentage: currentPercentage
  };
}

function buildRateDelta(
  currentRate: number,
  previousRate: number,
  previousTotal: number
): AttendanceMetricDelta {
  if (previousTotal === 0) {
    return neutralDelta("percentage_point");
  }

  return deltaFromValue(currentRate - previousRate, "percentage_point");
}

function buildPercentDelta(
  currentValue: number | null,
  previousValue: number | null
): AttendanceMetricDelta {
  if (currentValue === null || previousValue === null || previousValue === 0) {
    return neutralDelta("percent");
  }

  return deltaFromValue(
    ((currentValue - previousValue) / previousValue) * 100,
    "percent"
  );
}

function deltaFromValue(
  rawValue: number,
  unit: AttendanceMetricDelta["unit"]
): AttendanceMetricDelta {
  const value = roundMetric(rawValue);
  const direction =
    value > 0 ? "up" : value < 0 ? "down" : "flat";
  const prefix = value > 0 ? "+" : "";

  return {
    direction,
    label: `${prefix}${formatMetricNumber(value)}%`,
    unit,
    value
  };
}

function neutralDelta(unit: AttendanceMetricDelta["unit"]): AttendanceMetricDelta {
  return {
    direction: "neutral",
    label: "--",
    unit,
    value: null
  };
}

function percentage(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return roundMetric((count / total) * 100);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizePeriodMonth(periodMonth: string | undefined): string {
  if (!periodMonth) {
    throw new BadRequestException("periodMonth is required.");
  }

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new BadRequestException("periodMonth must use YYYY-MM format.");
  }

  return periodMonth;
}

function normalizePagination(query: AttendanceDailyReportQuery) {
  const page = clampInteger(query.page, DEFAULT_PAGE, 1, 1_000_000);
  const pageSize = clampInteger(
    query.pageSize,
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE
  );

  return { page, pageSize };
}

function clampInteger(
  value: number | string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const normalized =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (!Number.isInteger(normalized)) {
    return fallback;
  }

  return Math.min(Math.max(normalized as number, min), max);
}

function parseDateOnly(value: string, fieldName: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldName} is invalid.`);
  }

  return parsed;
}

function firstDayOfPeriodMonth(periodMonth: string) {
  return `${periodMonth}-01`;
}

function lastDayOfPeriodMonth(periodMonth: string) {
  const [yearText, monthText] = periodMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return formatDateOnly(new Date(Date.UTC(year, month, 0)));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function differenceInDays(start: Date, end: Date) {
  const dayInMs = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / dayInMs);
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMetricNumber(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

function formatHoursMetric(value: number | null) {
  return value === null ? "--" : `${formatMetricNumber(value)}h`;
}

function summarizeDailyRecords(
  records: AttendanceDailySummaryRecord[]
): AttendanceDailyReportSummary {
  return records.reduce<AttendanceDailyReportSummary>((summary, record) => {
    summary.totalRows += 1;
    summary.totalRawLateMins += record.rawLateMins ?? 0;
    summary.totalChargeableLateMins += record.chargeableLateMins ?? 0;

    if (record.calculatedStatus === AttendanceCalculatedStatus.ON_TIME) {
      summary.onTimeCount += 1;
    }
    if (record.calculatedStatus === AttendanceCalculatedStatus.LATE) {
      summary.lateCount += 1;
    }
    if (record.calculatedStatus === AttendanceCalculatedStatus.ABSENT) {
      summary.absentCount += 1;
    }
    if (record.isOnLeave) {
      summary.leaveCount += 1;
    }
    if (record.isOffDay) {
      summary.offDayCount += 1;
    }
    if (record.isUnder8Hours) {
      summary.under8HoursCount += 1;
    }
    if (record.isOver15Hours) {
      summary.over15HoursCount += 1;
    }

    return summary;
  }, emptySummary());
}

function emptySummary(): AttendanceDailyReportSummary {
  return {
    totalRows: 0,
    onTimeCount: 0,
    lateCount: 0,
    absentCount: 0,
    leaveCount: 0,
    offDayCount: 0,
    totalRawLateMins: 0,
    totalChargeableLateMins: 0,
    under8HoursCount: 0,
    over15HoursCount: 0
  };
}

function toDailyReportRow(
  record: AttendanceDailyReportRecord
): AttendanceDailyReportRow {
  return {
    id: record.id,
    shopperId: record.shopperId,
    personRole: record.personRole,
    identifierType: record.identifierType,
    identifierValue: record.identifierValue,
    personName: record.personNameSnapshot,
    userId: record.userId,
    shiftDate: formatDateOnly(record.shiftDate),
    pickerName: record.pickerNameSnapshot,
    sourceDesignation: record.sourceDesignation,
    sourceLocation: record.sourceLocation,
    sourceSubDivision: record.sourceSubDivision,
    reportedVendorId: record.reportedVendorId,
    reportedChainId: record.reportedChainId,
    reportedLocationCode: record.reportedLocationCode,
    reportedLocationName: record.reportedLocationName,
    reportedLocationRaw: record.reportedLocationRaw,
    locationMappingStatus: record.locationMappingStatus,
    shiftName: record.shiftName,
    scheduledStartTime: record.scheduledStartTime,
    scheduledEndTime: record.scheduledEndTime,
    actualCheckinTime: formatTimeOnlyOrNull(record.actualCheckinTime),
    actualCheckoutTime: formatTimeOnlyOrNull(record.actualCheckoutTime),
    actualWorkDurationHours: decimalToNumberOrNull(record.actualWorkDurationHours),
    calculatedStatus: record.calculatedStatus,
    rawLateMins: record.rawLateMins,
    chargeableLateMins: record.chargeableLateMins,
    lateBucket: record.lateBucket,
    leaveType: record.leaveType,
    isWorkingDay: record.isWorkingDay,
    isUnder8Hours: record.isUnder8Hours,
    isOver15Hours: record.isOver15Hours,
    issuesCount: record.issuesCount
  };
}

function formatDateOnlyOrNull(value: Date | null) {
  return value ? formatDateOnly(value) : null;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTimeOnlyOrNull(value: Date | null) {
  if (!value) {
    return null;
  }

  return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
}

function decimalToNumberOrNull(value: Prisma.Decimal | number | null) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
