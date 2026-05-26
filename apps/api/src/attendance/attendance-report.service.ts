import { BadRequestException, Inject, Injectable } from "@nestjs/common";
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
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

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
      return {
        periodMonth,
        activeBatchId: null,
        coverageStartDate: null,
        coverageEndDate: null,
        expectedCoverageEndDate: null,
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

    const where = buildDailyReportWhere(activeBatch.id, query);
    const totalRows = await this.prisma.attendanceDailyRecord.count({ where });
    const [rows, summaryRecords] = await Promise.all([
      this.prisma.attendanceDailyRecord.findMany({
        where,
        select: dailyReportSelect,
        orderBy: [{ shiftDate: "asc" }, { pickerNameSnapshot: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.attendanceDailyRecord.findMany({
        where,
        select: dailySummarySelect
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
        totalPages: Math.ceil(totalRows / pagination.pageSize)
      },
      summary: summarizeDailyRecords(summaryRecords),
      rows: rows.map(toDailyReportRow)
    };
  }
}

function buildDailyReportWhere(
  importBatchId: string,
  query: AttendanceDailyReportQuery
): Prisma.AttendanceDailyRecordWhereInput {
  const where: Prisma.AttendanceDailyRecordWhereInput = {
    importBatchId,
    importBatch: {
      is: {
        status: AttendanceImportBatchStatus.ACTIVE
      }
    }
  };

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
    where.shopperId = {
      contains: query.shopperId.trim(),
      mode: "insensitive"
    };
  }

  if (query.pickerSearch?.trim()) {
    const search = query.pickerSearch.trim();
    where.OR = [
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
        shopperId: {
          contains: search,
          mode: "insensitive"
        }
      }
    ];
  }

  if (query.status) {
    where.calculatedStatus = query.status;
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

  return where;
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
    userId: record.userId,
    shiftDate: formatDateOnly(record.shiftDate),
    pickerName: record.pickerNameSnapshot,
    sourceDesignation: record.sourceDesignation,
    sourceLocation: record.sourceLocation,
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
