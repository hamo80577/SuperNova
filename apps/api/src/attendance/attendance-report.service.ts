import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AttendanceCalculatedStatus,
  AttendanceImportBatchStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceDailyReportQuery,
  AttendanceDailyReportResponse,
  AttendanceDailyReportRow,
  AttendanceDailyReportSummary
} from "./attendance-report.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const dailyReportSelect = {
  id: true,
  shopperId: true,
  userId: true,
  shiftDate: true,
  pickerNameSnapshot: true,
  sourceDesignation: true,
  sourceLocation: true,
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

const dailySummarySelect = {
  calculatedStatus: true,
  rawLateMins: true,
  chargeableLateMins: true,
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

@Injectable()
export class AttendanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyReport(
    query: AttendanceDailyReportQuery
  ): Promise<AttendanceDailyReportResponse> {
    const periodMonth = normalizePeriodMonth(query.periodMonth);
    const pagination = normalizePagination(query);
    const activeBatch = await this.prisma.attendanceImportBatch.findFirst({
      where: {
        periodMonth,
        status: AttendanceImportBatchStatus.ACTIVE
      },
      orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }]
    });

    if (!activeBatch) {
      return emptyReportResponse(periodMonth, pagination.page, pagination.pageSize);
    }

    const where = buildDailyRecordWhere(query, periodMonth, activeBatch.id);
    const [totalRows, summaryRows, rows] = await Promise.all([
      this.prisma.attendanceDailyRecord.count({ where }),
      this.prisma.attendanceDailyRecord.findMany({
        where,
        select: dailySummarySelect
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where,
        select: dailyReportSelect,
        orderBy: [
          { shiftDate: "asc" },
          { pickerNameSnapshot: "asc" },
          { shopperId: "asc" }
        ],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
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
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / pagination.pageSize))
      },
      summary: summarizeRows(summaryRows, totalRows),
      rows: rows.map(mapDailyReportRow)
    };
  }
}

function buildDailyRecordWhere(
  query: AttendanceDailyReportQuery,
  periodMonth: string,
  activeBatchId: string
): Prisma.AttendanceDailyRecordWhereInput {
  const and: Prisma.AttendanceDailyRecordWhereInput[] = [];
  const dateFrom = query.dateFrom
    ? dateOnlyToUtcDate(query.dateFrom, "dateFrom")
    : null;
  const dateTo = query.dateTo ? dateOnlyToUtcDate(query.dateTo, "dateTo") : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new BadRequestException("dateFrom cannot be after dateTo.");
  }

  if (dateFrom || dateTo) {
    and.push({
      shiftDate: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {})
      }
    });
  }

  const shopperId = cleanText(query.shopperId);
  if (shopperId) {
    and.push({
      shopperId: {
        contains: shopperId,
        mode: "insensitive"
      }
    });
  }

  const pickerSearch = cleanText(query.pickerSearch);
  if (pickerSearch) {
    and.push({
      OR: [
        {
          pickerNameSnapshot: {
            contains: pickerSearch,
            mode: "insensitive"
          }
        },
        {
          shopperId: {
            contains: pickerSearch,
            mode: "insensitive"
          }
        }
      ]
    });
  }

  if (query.status) {
    and.push({ calculatedStatus: query.status });
  }

  if (isTruthyBoolean(query.lateOnly)) {
    and.push({ calculatedStatus: AttendanceCalculatedStatus.LATE });
  }

  if (isTruthyBoolean(query.absentOnly)) {
    and.push({ calculatedStatus: AttendanceCalculatedStatus.ABSENT });
  }

  if (isTruthyBoolean(query.onLeaveOnly)) {
    and.push({ isOnLeave: true });
  }

  return {
    importBatchId: activeBatchId,
    periodMonth,
    importBatch: {
      is: {
        status: AttendanceImportBatchStatus.ACTIVE
      }
    },
    ...(and.length ? { AND: and } : {})
  };
}

function summarizeRows(
  rows: AttendanceDailySummaryRecord[],
  totalRows: number
): AttendanceDailyReportSummary {
  return rows.reduce(
    (summary, row) => {
      if (row.calculatedStatus === AttendanceCalculatedStatus.ON_TIME) {
        summary.onTimeCount += 1;
      }

      if (row.calculatedStatus === AttendanceCalculatedStatus.LATE) {
        summary.lateCount += 1;
      }

      if (row.calculatedStatus === AttendanceCalculatedStatus.ABSENT) {
        summary.absentCount += 1;
      }

      if (row.isOnLeave) {
        summary.leaveCount += 1;
      }

      if (row.isOffDay) {
        summary.offDayCount += 1;
      }

      if (row.isUnder8Hours) {
        summary.under8HoursCount += 1;
      }

      if (row.isOver15Hours) {
        summary.over15HoursCount += 1;
      }

      summary.totalRawLateMins += row.rawLateMins ?? 0;
      summary.totalChargeableLateMins += row.chargeableLateMins ?? 0;

      return summary;
    },
    emptySummary(totalRows)
  );
}

function mapDailyReportRow(
  row: AttendanceDailyReportRecord
): AttendanceDailyReportRow {
  return {
    id: row.id,
    pickerName: row.pickerNameSnapshot,
    shopperId: row.shopperId,
    userId: row.userId,
    shiftDate: formatDateOnly(row.shiftDate),
    shiftName: row.shiftName,
    scheduledStartTime: row.scheduledStartTime,
    scheduledEndTime: row.scheduledEndTime,
    actualCheckinTime: formatTimeOnlyOrNull(row.actualCheckinTime),
    actualCheckoutTime: formatTimeOnlyOrNull(row.actualCheckoutTime),
    actualWorkDurationHours: decimalToNumberOrNull(row.actualWorkDurationHours),
    calculatedStatus: row.calculatedStatus,
    rawLateMins: row.rawLateMins,
    chargeableLateMins: row.chargeableLateMins,
    lateBucket: row.lateBucket,
    leaveType: row.leaveType,
    isWorkingDay: row.isWorkingDay,
    isUnder8Hours: row.isUnder8Hours,
    isOver15Hours: row.isOver15Hours,
    sourceLocation: row.sourceLocation,
    sourceDesignation: row.sourceDesignation,
    issuesCount: row.issuesCount
  };
}

function normalizePeriodMonth(value: string | undefined) {
  const periodMonth = cleanText(value);

  if (!periodMonth) {
    throw new BadRequestException(
      "periodMonth is required for attendance daily reports."
    );
  }

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new BadRequestException("periodMonth must use YYYY-MM format.");
  }

  return periodMonth;
}

function normalizePagination(query: AttendanceDailyReportQuery) {
  const page = clampPositiveInt(query.page, DEFAULT_PAGE);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    clampPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE)
  );

  return { page, pageSize };
}

function clampPositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function emptyReportResponse(
  periodMonth: string,
  page: number,
  pageSize: number
): AttendanceDailyReportResponse {
  return {
    periodMonth,
    activeBatchId: null,
    coverageStartDate: null,
    coverageEndDate: null,
    expectedCoverageEndDate: null,
    pagination: {
      page,
      pageSize,
      totalRows: 0,
      totalPages: 1
    },
    summary: emptySummary(0),
    rows: []
  };
}

function emptySummary(totalRows: number): AttendanceDailyReportSummary {
  return {
    totalRows,
    onTimeCount: 0,
    lateCount: 0,
    absentCount: 0,
    leaveCount: 0,
    offDayCount: 0,
    under8HoursCount: 0,
    over15HoursCount: 0,
    totalRawLateMins: 0,
    totalChargeableLateMins: 0
  };
}

function dateOnlyToUtcDate(value: string, fieldName: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return date;
}

function formatDateOnlyOrNull(value: Date | null) {
  return value ? formatDateOnly(value) : null;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTimeOnlyOrNull(value: Date | null) {
  return value ? value.toISOString().slice(11, 16) : null;
}

function decimalToNumberOrNull(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
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

function cleanText(value: string | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function isTruthyBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  return value?.trim().toLowerCase() === "true";
}
