import { createHash } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AttendanceImportBatchStatus,
  AttendanceIssueSeverity,
  AttendanceMatchStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import type {
  AttendanceCalculationInputRow,
  AttendanceCalculationIssue
} from "./attendance-calculation.types";
import {
  AttendanceImportConfirmOptions,
  AttendanceImportConfirmResult,
  AttendanceImportPreviewOptions,
  AttendanceImportPreviewResult
} from "./attendance-import.types";
import { AttendanceParserService } from "./attendance-parser.service";
import type {
  AttendanceMatchedUser,
  AttendanceParsedRow,
  AttendancePreviewIssue
} from "./attendance-preview.types";
import { AttendanceUserLookupService } from "./attendance-user-lookup.service";
import { AttendanceValidatorService } from "./attendance-validator.service";

type AttendancePersistedIssue =
  | AttendancePreviewIssue
  | AttendanceCalculationIssue;

type AttendancePrismaTransaction = Prisma.TransactionClient;

@Injectable()
export class AttendanceImportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AttendanceParserService)
    private readonly parser: AttendanceParserService,
    @Inject(AttendanceValidatorService)
    private readonly validator: AttendanceValidatorService,
    @Inject(AttendanceCalculationService)
    private readonly calculator: AttendanceCalculationService,
    @Inject(AttendanceUserLookupService)
    private readonly userLookup: AttendanceUserLookupService
  ) {}

  async previewImport(
    buffer: Buffer,
    options: AttendanceImportPreviewOptions
  ): Promise<AttendanceImportPreviewResult> {
    assertAttendanceImportActor(options.actor);

    if (buffer.length === 0) {
      throw new BadRequestException("Attendance file is required.");
    }

    const now = normalizeDateTime(options.now);
    const uploadDate = options.uploadDate ?? now;
    const workbook = await this.parser.parseWorkbook(buffer);
    const preview = await this.validator.validateWorkbook(buffer, {
      uploadDate,
      rowsPreviewLimit: options.rowsPreviewLimit,
      userLookup: this.userLookup
    });

    const usersByShopperId = await this.loadUsersByShopperId(workbook.rows);
    const validationIssueCounts = countIssuesByRow(preview.issues);
    const calculationRows =
      preview.canConfirm && preview.periodMonth
        ? buildCalculationRows(
            preview.periodMonth,
            workbook.rows,
            usersByShopperId,
            validationIssueCounts
          )
        : [];
    const calculationResult =
      preview.canConfirm && preview.periodMonth
        ? this.calculator.calculate({
            periodMonth: preview.periodMonth,
            calculatedAt: now,
            rows: calculationRows
          })
        : {
            dailyRecords: [],
            monthlySummaries: [],
            issues: []
          };
    const combinedIssues: AttendancePersistedIssue[] = [
      ...preview.issues,
      ...calculationResult.issues
    ];
    const hasCalculationErrors = calculationResult.issues.some(
      (issue) => issue.severity === AttendanceIssueSeverity.ERROR
    );
    const status =
      preview.canConfirm && preview.periodMonth && !hasCalculationErrors
        ? AttendanceImportBatchStatus.VALIDATED
        : AttendanceImportBatchStatus.FAILED;

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.attendanceImportBatch.create({
        data: {
          periodMonth: preview.periodMonth ?? periodMonthFromUploadDate(uploadDate),
          fileName: normalizeFileName(options.fileName),
          fileHash: hashBuffer(buffer),
          uploadedByUserId: options.actor.id,
          uploadedAt: now,
          status,
          rowCount: preview.rowCount,
          egyptRows: preview.egyptRows,
          matchedPickerRows: preview.matchedPickerRows,
          unmatchedRows: preview.unmatchedRows,
          excludedNonPickerRows: preview.excludedNonPickerRows,
          excludedNonEgyptRows: preview.nonEgyptRows,
          errorRows: preview.errorRows,
          warningRows: preview.warningRows,
          coverageStartDate: dateOnlyToUtcDateOrNull(preview.coverageStartDate),
          coverageEndDate: dateOnlyToUtcDateOrNull(preview.coverageEndDate),
          expectedCoverageEndDate: dateOnlyToUtcDateOrNull(
            preview.expectedCoverageEndDate
          ),
          replaceOfBatchId: null,
          confirmedByUserId: null,
          confirmedAt: null
        }
      });

      if (combinedIssues.length > 0) {
        await tx.attendanceImportIssue.createMany({
          data: combinedIssues.map((issue) => ({
            batchId: createdBatch.id,
            rowNumber: issue.rowNumber,
            shopperId: issue.shopperId,
            severity: issue.severity,
            issueCode: issue.issueCode,
            fieldName: issue.fieldName,
            message: issue.message,
            resolutionStatus: issue.resolutionStatus
          }))
        });
      }

      if (status === AttendanceImportBatchStatus.VALIDATED) {
        if (calculationResult.dailyRecords.length > 0) {
          await tx.attendanceDailyRecord.createMany({
            data: calculationResult.dailyRecords.map((record) =>
              mapDailyRecordForCreate(createdBatch.id, record)
            )
          });
        }

        if (calculationResult.monthlySummaries.length > 0) {
          await tx.attendancePickerMonthlySummary.createMany({
            data: calculationResult.monthlySummaries.map((summary) =>
              mapMonthlySummaryForCreate(createdBatch.id, summary)
            )
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: options.actor.id,
          action:
            status === AttendanceImportBatchStatus.VALIDATED
              ? "ATTENDANCE_IMPORT_PREVIEW_CREATED"
              : "ATTENDANCE_IMPORT_FAILED_VALIDATION",
          entityType: "AttendanceImportBatch",
          entityId: createdBatch.id,
          oldValue: Prisma.JsonNull,
          newValue: toAuditJson({
            periodMonth: createdBatch.periodMonth,
            batchId: createdBatch.id,
            coverageStartDate: preview.coverageStartDate,
            coverageEndDate: preview.coverageEndDate,
            expectedCoverageEndDate: preview.expectedCoverageEndDate,
            rowCount: preview.rowCount,
            errorRows: preview.errorRows,
            warningRows: preview.warningRows,
            status
          }),
          ipAddress: options.ipAddress ?? null,
          userAgent: options.userAgent ?? null
        }
      });

      return createdBatch;
    });

    return {
      batchId: batch.id,
      status,
      canConfirm: status === AttendanceImportBatchStatus.VALIDATED,
      preview: {
        ...preview,
        canConfirm: status === AttendanceImportBatchStatus.VALIDATED,
        issues: combinedIssues
      },
      dailyRecordCount: calculationResult.dailyRecords.length,
      monthlySummaryCount: calculationResult.monthlySummaries.length,
      issueCount: combinedIssues.length
    };
  }

  async confirmImport(
    batchId: string,
    options: AttendanceImportConfirmOptions
  ): Promise<AttendanceImportConfirmResult> {
    assertAttendanceImportActor(options.actor);

    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new NotFoundException("Attendance import batch was not found.");
    }

    assertConfirmableBatch(batch);

    const confirmedAt = normalizeDateTime(options.now);

    return this.prisma.$transaction(async (tx) => {
      const previousActive = await tx.attendanceImportBatch.findFirst({
        where: {
          periodMonth: batch.periodMonth,
          status: AttendanceImportBatchStatus.ACTIVE,
          id: {
            not: batch.id
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (previousActive) {
        await tx.attendanceImportBatch.update({
          where: { id: previousActive.id },
          data: {
            status: AttendanceImportBatchStatus.REPLACED
          }
        });
      }

      const activatedBatch = await tx.attendanceImportBatch.update({
        where: { id: batch.id },
        data: {
          status: AttendanceImportBatchStatus.ACTIVE,
          replaceOfBatchId: previousActive?.id ?? null,
          confirmedByUserId: options.actor.id,
          confirmedAt
        }
      });

      await writeConfirmAuditLogs(tx, {
        actorUserId: options.actor.id,
        batchId: activatedBatch.id,
        periodMonth: activatedBatch.periodMonth,
        coverageStartDate: formatDateOnlyOrNull(activatedBatch.coverageStartDate),
        coverageEndDate: formatDateOnlyOrNull(activatedBatch.coverageEndDate),
        expectedCoverageEndDate: formatDateOnlyOrNull(
          activatedBatch.expectedCoverageEndDate
        ),
        rowCount: activatedBatch.rowCount,
        errorRows: activatedBatch.errorRows,
        warningRows: activatedBatch.warningRows,
        previousActiveBatchId: previousActive?.id ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null
      });

      return {
        batchId: activatedBatch.id,
        periodMonth: activatedBatch.periodMonth,
        status: activatedBatch.status,
        previousActiveBatchId: previousActive?.id ?? null,
        confirmedAt: activatedBatch.confirmedAt?.toISOString() ?? confirmedAt.toISOString()
      };
    });
  }

  private async loadUsersByShopperId(rows: AttendanceParsedRow[]) {
    const shopperIds = Array.from(
      new Set(rows.map((row) => row.identifier).filter(Boolean) as string[])
    );
    const users = await this.userLookup.findByShopperIds(shopperIds);
    return new Map(users.map((user) => [user.shopperId, user]));
  }
}

function assertAttendanceImportActor(actor: { role: UserRole }) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException("You do not have permission for this action.");
  }
}

function assertConfirmableBatch(batch: {
  status: AttendanceImportBatchStatus;
  errorRows: number;
}) {
  if (batch.errorRows > 0) {
    throw new BadRequestException(
      "Attendance import batch has blocking validation errors."
    );
  }

  if (batch.status !== AttendanceImportBatchStatus.VALIDATED) {
    throw new BadRequestException(
      "Only validated attendance import batches can be confirmed."
    );
  }
}

function buildCalculationRows(
  periodMonth: string,
  parsedRows: AttendanceParsedRow[],
  usersByShopperId: Map<string, AttendanceMatchedUser>,
  validationIssueCounts: Map<number, number>
): AttendanceCalculationInputRow[] {
  return parsedRows
    .map((row): AttendanceCalculationInputRow | null => {
      if (!row.identifier || !row.shiftDate || !isEgypt(row.division)) {
        return null;
      }

      const user = usersByShopperId.get(row.identifier);

      if (!user || user.role !== UserRole.PICKER) {
        return null;
      }

      return {
        periodMonth,
        shiftDate: row.shiftDate,
        shopperId: row.identifier,
        userId: user.id,
        pickerNameSnapshot: user.nameEn,
        sourceName: row.sourceName,
        sourceDesignation: row.sourceDesignation,
        division: row.division ?? "",
        sourceSubDivision: row.sourceSubDivision,
        sourceLocation: row.sourceLocation,
        sourceLocationCode: row.sourceLocationCode,
        shiftName: row.shiftName,
        scheduledStartTime: row.scheduledStartTime,
        scheduledEndTime: row.scheduledEndTime,
        scheduledShiftHours: row.scheduledShiftHours,
        breakDurationMins: row.breakDurationMins,
        actualCheckinTime: row.actualCheckinTime,
        actualCheckoutTime: row.actualCheckoutTime,
        actualWorkDurationHours: row.actualWorkDurationHours,
        sourceStatus: row.sourceStatus,
        matchStatus: AttendanceMatchStatus.MATCHED_PICKER,
        rawRowNumber: row.rawRowNumber,
        issuesCount: validationIssueCounts.get(row.rawRowNumber) ?? 0
      };
    })
    .filter((row): row is AttendanceCalculationInputRow => row !== null);
}

function countIssuesByRow(issues: AttendancePersistedIssue[]) {
  const counts = new Map<number, number>();

  for (const issue of issues) {
    if (issue.rowNumber !== null) {
      counts.set(issue.rowNumber, (counts.get(issue.rowNumber) ?? 0) + 1);
    }
  }

  return counts;
}

function mapDailyRecordForCreate(
  importBatchId: string,
  record: import("./attendance-calculation.types").AttendanceDailyCalculationRecord
): Prisma.AttendanceDailyRecordCreateManyInput {
  return {
    importBatchId,
    periodMonth: record.periodMonth,
    shiftDate: dateOnlyToUtcDate(record.shiftDate, "shiftDate"),
    shopperId: record.shopperId,
    userId: record.userId,
    pickerNameSnapshot: record.pickerNameSnapshot,
    sourceName: record.sourceName,
    sourceDesignation: record.sourceDesignation,
    division: record.division,
    sourceSubDivision: record.sourceSubDivision,
    sourceLocation: record.sourceLocation,
    sourceLocationCode: record.sourceLocationCode,
    shiftName: record.shiftName,
    scheduledStartTime: record.scheduledStartTime,
    scheduledEndTime: record.scheduledEndTime,
    scheduledStartAt: isoDateTimeToDateOrNull(
      record.scheduledStartAt,
      "scheduledStartAt"
    ),
    scheduledEndAt: isoDateTimeToDateOrNull(
      record.scheduledEndAt,
      "scheduledEndAt"
    ),
    scheduledShiftHours: decimalOrNull(record.scheduledShiftHours),
    breakDurationMins: record.breakDurationMins,
    actualCheckinTime: timeOnlyToDateOrNull(
      record.shiftDate,
      record.actualCheckinTime,
      "actualCheckinTime"
    ),
    actualCheckoutTime: timeOnlyToDateOrNull(
      record.shiftDate,
      record.actualCheckoutTime,
      "actualCheckoutTime"
    ),
    actualWorkDurationHours: decimalOrNull(record.actualWorkDurationHours),
    sourceStatus: record.sourceStatus,
    calculatedStatus: record.calculatedStatus,
    rawLateMins: record.rawLateMins,
    graceMins: record.graceMins,
    chargeableLateMins: record.chargeableLateMins,
    lateBucket: record.lateBucket,
    isLate: record.isLate,
    isOnTime: record.isOnTime,
    isAbsent: record.isAbsent,
    isOffDay: record.isOffDay,
    isOnLeave: record.isOnLeave,
    leaveType: record.leaveType,
    isAnnualLeave: record.isAnnualLeave,
    isMedicalLeave: record.isMedicalLeave,
    isWorkingDay: record.isWorkingDay,
    isUnder8Hours: record.isUnder8Hours,
    isOver15Hours: record.isOver15Hours,
    matchStatus: record.matchStatus,
    rawRowNumber: record.rawRowNumber,
    rowHash: record.rowHash,
    issuesCount: record.issuesCount
  };
}

function mapMonthlySummaryForCreate(
  sourceBatchId: string,
  summary: import("./attendance-calculation.types").AttendancePickerMonthlyCalculationSummary
): Prisma.AttendancePickerMonthlySummaryCreateManyInput {
  return {
    sourceBatchId,
    periodMonth: summary.periodMonth,
    shopperId: summary.shopperId,
    userId: summary.userId,
    pickerNameSnapshot: summary.pickerNameSnapshot,
    totalScheduledRows: summary.totalScheduledRows,
    totalWorkingDays: summary.totalWorkingDays,
    onTimeDays: summary.onTimeDays,
    lateDays: summary.lateDays,
    totalRawLateMins: summary.totalRawLateMins,
    totalChargeableLateMins: summary.totalChargeableLateMins,
    late1Count: summary.late1Count,
    late2Count: summary.late2Count,
    late3Count: summary.late3Count,
    absentCount: summary.absentCount,
    leaveCount: summary.leaveCount,
    annualLeaveCount: summary.annualLeaveCount,
    medicalLeaveCount: summary.medicalLeaveCount,
    otherLeaveCount: summary.otherLeaveCount,
    offDayCount: summary.offDayCount,
    under8HoursCount: summary.under8HoursCount,
    over15HoursCount: summary.over15HoursCount,
    firstShiftDate: dateOnlyToUtcDateOrNull(summary.firstShiftDate),
    lastShiftDate: dateOnlyToUtcDateOrNull(summary.lastShiftDate),
    lastCalculatedAt: isoDateTimeToDate(summary.lastCalculatedAt, "lastCalculatedAt")
  };
}

async function writeConfirmAuditLogs(
  tx: AttendancePrismaTransaction,
  metadata: {
    actorUserId: string;
    batchId: string;
    periodMonth: string;
    coverageStartDate: string | null;
    coverageEndDate: string | null;
    expectedCoverageEndDate: string | null;
    rowCount: number;
    errorRows: number;
    warningRows: number;
    previousActiveBatchId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  const auditValue = toAuditJson(metadata);

  await tx.auditLog.create({
    data: {
      actorUserId: metadata.actorUserId,
      action: "ATTENDANCE_IMPORT_CONFIRMED",
      entityType: "AttendanceImportBatch",
      entityId: metadata.batchId,
      oldValue: Prisma.JsonNull,
      newValue: auditValue,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    }
  });

  if (metadata.previousActiveBatchId) {
    await tx.auditLog.create({
      data: {
        actorUserId: metadata.actorUserId,
        action: "ATTENDANCE_IMPORT_REPLACED_ACTIVE_BATCH",
        entityType: "AttendanceImportBatch",
        entityId: metadata.batchId,
        oldValue: Prisma.JsonNull,
        newValue: auditValue,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      }
    });
  }
}

function normalizeFileName(fileName: string) {
  const normalized = fileName.trim();
  return normalized || "attendance-import.xlsx";
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isEgypt(division: string | null) {
  return division?.trim().toUpperCase() === "EGYPT";
}

function normalizeDateTime(value: Date | string | undefined) {
  if (value instanceof Date) {
    assertValidDate(value, "now");
    return value;
  }

  if (typeof value === "string") {
    return isoDateTimeToDate(value, "now");
  }

  return new Date();
}

function periodMonthFromUploadDate(uploadDate: Date | string) {
  if (uploadDate instanceof Date) {
    assertValidDate(uploadDate, "uploadDate");
    return `${uploadDate.getFullYear()}-${pad(uploadDate.getMonth() + 1)}`;
  }

  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(uploadDate);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return isoDateTimeToDate(uploadDate, "uploadDate").toISOString().slice(0, 7);
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

function dateOnlyToUtcDateOrNull(value: string | null) {
  return value ? dateOnlyToUtcDate(value, "date") : null;
}

function isoDateTimeToDate(value: string, fieldName: string) {
  const date = new Date(value);
  assertValidDate(date, fieldName);
  return date;
}

function isoDateTimeToDateOrNull(value: string | null, fieldName: string) {
  return value ? isoDateTimeToDate(value, fieldName) : null;
}

function timeOnlyToDateOrNull(
  shiftDate: string,
  time: string | null,
  fieldName: string
) {
  if (!time) {
    return null;
  }

  if (!/^(\d{2}):(\d{2})$/.test(time)) {
    throw new BadRequestException(`${fieldName} must use HH:mm format.`);
  }

  return isoDateTimeToDate(`${shiftDate}T${time}:00.000Z`, fieldName);
}

function decimalOrNull(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

function assertValidDate(date: Date, fieldName: string) {
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }
}

function formatDateOnlyOrNull(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toAuditJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
