import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AttendanceArchiveStatus,
  AttendanceImportMode,
  AttendanceImportStatus,
  AttendanceIssueSeverity,
  AttendanceIssueType,
  AttendanceMatchedRole,
  Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { AttendanceAssignmentSnapshotService } from "./attendance-assignment-snapshot.service";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceIssueService } from "./attendance-issue.service";
import { AttendanceMatcherService } from "./attendance-matcher.service";
import { AttendanceParserService } from "./attendance-parser.service";
import {
  AttendanceSummaryService,
  toMonthKey
} from "./attendance-summary.service";
import type {
  AttendanceImportSummary,
  AttendanceIssueDraft,
  AttendanceSummaryRecord,
  ParsedAttendanceRow
} from "./attendance.types";

type ImportAttendanceFromBufferInput = {
  buffer: Buffer;
  fileName: string;
  periodFrom: Date;
  periodTo: Date;
  mode: AttendanceImportMode;
  createdById: string;
  referenceDate?: Date;
};

type RecalculateAttendanceSummariesInput = {
  periodFrom: Date;
  periodTo: Date;
  createdById: string;
  referenceDate?: Date;
};

@Injectable()
export class AttendanceImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttendanceParserService)
    private readonly parser: AttendanceParserService,
    @Inject(AttendanceMatcherService)
    private readonly matcher: AttendanceMatcherService,
    @Inject(AttendanceCalculationService)
    private readonly calculation: AttendanceCalculationService,
    @Inject(AttendanceAssignmentSnapshotService)
    private readonly assignmentSnapshot: AttendanceAssignmentSnapshotService,
    @Inject(AttendanceSummaryService)
    private readonly summaries: AttendanceSummaryService,
    @Inject(AttendanceIssueService)
    private readonly issueService: AttendanceIssueService
  ) {}

  async importAttendanceFromBuffer(
    input: ImportAttendanceFromBufferInput
  ): Promise<AttendanceImportSummary> {
    this.assertImportMode(input.mode);
    this.assertPeriod(input.periodFrom, input.periodTo);

    const batch = await this.prisma.attendanceImportBatch.create({
      data: {
        mode: input.mode,
        status: AttendanceImportStatus.PENDING,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        createdById: input.createdById,
        fileName: input.fileName,
        fileHash: createHash("sha256").update(input.buffer).digest("hex")
      }
    });

    try {
      await this.prisma.attendanceImportBatch.update({
        where: { id: batch.id },
        data: {
          status: AttendanceImportStatus.PROCESSING,
          startedAt: new Date()
        }
      });

      const parseResult = await this.parser.parseAttendanceBuffer(input.buffer);
      const processed = await this.processRows({
        rows: parseResult.rows,
        parseIssues: parseResult.issues,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        referenceDate: input.referenceDate ?? new Date()
      });
      const finalStatus =
        processed.warningCount > 0 || processed.errorCount > 0
          ? AttendanceImportStatus.COMPLETED_WITH_WARNINGS
          : AttendanceImportStatus.COMPLETED;

      await this.persistImportResult(batch.id, input, processed, finalStatus);

      return {
        batchId: batch.id,
        status: finalStatus,
        totalRows: parseResult.rows.length,
        egyptRows: processed.egyptRows,
        ignoredRows: processed.ignoredRows,
        processedRows: processed.processedRows,
        matchedPickers: processed.matchedPickers,
        matchedChamps: processed.matchedChamps,
        unmatchedIdentifiers: processed.unmatchedIdentifiers,
        duplicateRows: processed.duplicateRows,
        warningsCount: processed.warningCount,
        errorsCount: processed.errorCount,
        dailyRecordsStored: processed.dailyRecords.length,
        userSummariesStored: processed.summaryResult.userSummaries.length,
        branchSummariesRebuilt: processed.summaryResult.branchSummaries.length,
        chainSummariesRebuilt: processed.summaryResult.chainSummaries.length
      };
    } catch (error) {
      await this.prisma.attendanceImportBatch.update({
        where: { id: batch.id },
        data: {
          status: AttendanceImportStatus.FAILED,
          completedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : "Attendance import failed."
        }
      });
      throw error;
    }
  }

  async recalculateSummariesForPeriod(input: RecalculateAttendanceSummariesInput) {
    this.assertPeriod(input.periodFrom, input.periodTo);
    const batch = await this.prisma.attendanceImportBatch.create({
      data: {
        mode: AttendanceImportMode.RECALCULATE_ONLY,
        status: AttendanceImportStatus.PROCESSING,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        createdById: input.createdById,
        startedAt: new Date()
      }
    });

    const records = await this.prisma.attendanceDailyRecord.findMany({
      where: {
        attendanceDate: {
          gte: input.periodFrom,
          lte: input.periodTo
        }
      },
      include: { matchedUser: { select: { joiningDate: true } } }
    });
    const summaryRecords: AttendanceSummaryRecord[] = records.map((record) => ({
      userId: record.matchedUserId,
      identifier: record.identifier,
      role: record.matchedUserRole,
      matchKeyType: record.matchKeyType,
      monthKey: record.monthKey,
      attendanceDate: record.attendanceDate,
      assignmentVendorId: record.assignmentVendorId,
      assignmentChainId: record.assignmentChainId,
      actualWorkDurationHours: record.actualWorkDurationHours
        ? Number(record.actualWorkDurationHours)
        : null,
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
      isWorkedShift: record.isWorkedShift,
      userJoiningDate: record.matchedUser.joiningDate
    }));
    const summaryResult = this.summaries.buildMonthlySummaries({
      records: summaryRecords,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      referenceDate: input.referenceDate ?? new Date()
    });
    const monthKeys = this.summaries.monthKeysBetween(input.periodFrom, input.periodTo);

    await this.prisma.$transaction(async (tx) => {
      await this.replaceSummaries(tx, monthKeys, batch.id, summaryResult);
      await tx.attendanceImportBatch.update({
        where: { id: batch.id },
        data: {
          status: AttendanceImportStatus.COMPLETED,
          processedRows: records.length,
          userSummariesStored: summaryResult.userSummaries.length,
          branchSummariesRebuilt: summaryResult.branchSummaries.length,
          chainSummariesRebuilt: summaryResult.chainSummaries.length,
          completedAt: new Date()
        }
      });
    });

    return {
      batchId: batch.id,
      userSummariesStored: summaryResult.userSummaries.length,
      branchSummariesRebuilt: summaryResult.branchSummaries.length,
      chainSummariesRebuilt: summaryResult.chainSummaries.length
    };
  }

  private async processRows(input: {
    rows: ParsedAttendanceRow[];
    parseIssues: AttendanceIssueDraft[];
    periodFrom: Date;
    periodTo: Date;
    referenceDate: Date;
  }) {
    const issues: AttendanceIssueDraft[] = [...input.parseIssues];
    const egyptRows = input.rows.filter((row) => isEgypt(row.division));
    const eligibleRows = egyptRows.filter(
      (row) =>
        row.attendanceDate &&
        row.attendanceDate >= input.periodFrom &&
        row.attendanceDate <= input.periodTo
    );
    const duplicateRows = this.detectDuplicateRows(eligibleRows, issues);
    const matchResults = await this.matcher.matchIdentifiers(
      eligibleRows.map((row) => row.identifier)
    );
    const dailyRecords: Prisma.AttendanceDailyRecordCreateManyInput[] = [];
    const summaryRecords: AttendanceSummaryRecord[] = [];
    let matchedPickers = 0;
    let matchedChamps = 0;
    let unmatchedIdentifiers = 0;

    for (const row of eligibleRows) {
      if (!row.attendanceDate) continue;
      const match = matchResults.get(row.identifier);

      if (!match || match.outcome === "UNMATCHED_IDENTIFIER") {
        unmatchedIdentifiers += 1;
        issues.push(
          this.issueService.build({
            severity: AttendanceIssueSeverity.WARNING,
            type: AttendanceIssueType.UNMATCHED_IDENTIFIER,
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            attendanceDate: row.attendanceDate,
            message: `No SuperNova Picker or Champ matched identifier ${row.identifier}.`
          })
        );
        continue;
      }

      if (match.outcome === "AMBIGUOUS_IDENTIFIER_MATCH") {
        issues.push(
          this.issueService.build({
            severity: AttendanceIssueSeverity.ERROR,
            type: AttendanceIssueType.AMBIGUOUS_IDENTIFIER_MATCH,
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            attendanceDate: row.attendanceDate,
            message: `Identifier ${row.identifier} matched more than one supported SuperNova user.`
          })
        );
        continue;
      }

      if (match.outcome === "UNSUPPORTED_ROLE" || !match.user || !match.matchedRole) {
        issues.push(
          this.issueService.build({
            severity: AttendanceIssueSeverity.WARNING,
            type: AttendanceIssueType.UNSUPPORTED_ROLE,
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            attendanceDate: row.attendanceDate,
            message: `Identifier ${row.identifier} belongs to a role that is not calculated for attendance.`
          })
        );
        continue;
      }

      const snapshot =
        match.matchedRole === AttendanceMatchedRole.PICKER
          ? await this.assignmentSnapshot.resolvePickerSnapshot(
              match.user.id,
              row.attendanceDate
            )
          : { assignmentVendorId: null, assignmentChainId: null };

      if (
        match.matchedRole === AttendanceMatchedRole.PICKER &&
        !snapshot.assignmentVendorId
      ) {
        issues.push(
          this.issueService.build({
            severity: AttendanceIssueSeverity.WARNING,
            type: AttendanceIssueType.MISSING_ASSIGNMENT,
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            attendanceDate: row.attendanceDate,
            message: `Picker ${row.identifier} has no active Branch assignment on the attendance date.`
          })
        );
      }

      const metrics = this.calculation.calculateDailyMetrics({
        status: row.rawStatus,
        shiftName: row.shiftName,
        scheduledStartAt: row.scheduledStartAt,
        actualCheckInAt: row.actualCheckInAt,
        actualWorkDurationHours: row.actualWorkDurationHours
      });
      const monthKey = toMonthKey(row.attendanceDate);
      const archiveStatus = this.summaries.archiveStatusForMonth(
        monthKey,
        input.referenceDate
      );

      if (match.matchedRole === AttendanceMatchedRole.PICKER) matchedPickers += 1;
      if (match.matchedRole === AttendanceMatchedRole.CHAMP) matchedChamps += 1;

      summaryRecords.push({
        userId: match.user.id,
        identifier: row.identifier,
        role: match.matchedRole,
        matchKeyType: match.matchKeyType!,
        monthKey,
        attendanceDate: row.attendanceDate,
        assignmentVendorId: snapshot.assignmentVendorId,
        assignmentChainId: snapshot.assignmentChainId,
        actualWorkDurationHours: row.actualWorkDurationHours,
        lateMinutes: metrics.lateMinutes,
        lateLevel1Over15: metrics.lateLevel1Over15,
        lateLevel2From31To45: metrics.lateLevel2From31To45,
        lateLevel3Over45: metrics.lateLevel3Over45,
        isAbsent: metrics.isAbsent,
        isOnLeave: metrics.isOnLeave,
        isAnnualLeave: metrics.isAnnualLeave,
        isMedicalLeave: metrics.isMedicalLeave,
        isOffDay: metrics.isOffDay,
        isUnder8Hours: metrics.isUnder8Hours,
        isOver15Hours: metrics.isOver15Hours,
        isWorkedShift: metrics.isWorkedShift,
        userJoiningDate: match.user.joiningDate
      });

      if (archiveStatus === AttendanceArchiveStatus.DETAILED) {
        dailyRecords.push({
          importBatchId: "",
          identifier: row.identifier,
          matchedUserId: match.user.id,
          matchedUserRole: match.matchedRole,
          matchKeyType: match.matchKeyType!,
          attendanceDate: row.attendanceDate,
          monthKey,
          division: row.division,
          rawName: row.rawName,
          rawDesignation: row.rawDesignation,
          rawLocation: row.rawLocation,
          rawStatus: row.rawStatus,
          status: metrics.status,
          shiftName: row.shiftName,
          scheduledStartAt: row.scheduledStartAt,
          scheduledEndAt: row.scheduledEndAt,
          actualCheckInAt: row.actualCheckInAt,
          actualCheckOutAt: row.actualCheckOutAt,
          actualWorkDurationHours: row.actualWorkDurationHours,
          lateMinutes: metrics.lateMinutes,
          lateLevel1Over15: metrics.lateLevel1Over15,
          lateLevel2From31To45: metrics.lateLevel2From31To45,
          lateLevel3Over45: metrics.lateLevel3Over45,
          isAbsent: metrics.isAbsent,
          isOnLeave: metrics.isOnLeave,
          isAnnualLeave: metrics.isAnnualLeave,
          isMedicalLeave: metrics.isMedicalLeave,
          isOffDay: metrics.isOffDay,
          isUnder8Hours: metrics.isUnder8Hours,
          isOver15Hours: metrics.isOver15Hours,
          isWorkedShift: metrics.isWorkedShift,
          assignmentVendorId: snapshot.assignmentVendorId,
          assignmentChainId: snapshot.assignmentChainId,
          archiveStatus,
          rowFingerprint: fingerprintRow(row)
        });
      }
    }

    const summaryResult = this.summaries.buildMonthlySummaries({
      records: summaryRecords,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      referenceDate: input.referenceDate
    });
    const warningCount = issues.filter(
      (issue) => issue.severity === AttendanceIssueSeverity.WARNING
    ).length;
    const errorCount = issues.filter(
      (issue) => issue.severity === AttendanceIssueSeverity.ERROR
    ).length;

    return {
      issues,
      dailyRecords,
      summaryResult,
      egyptRows: egyptRows.length,
      ignoredRows: input.rows.length - egyptRows.length,
      processedRows: eligibleRows.length,
      matchedPickers,
      matchedChamps,
      unmatchedIdentifiers,
      duplicateRows,
      warningCount,
      errorCount
    };
  }

  private detectDuplicateRows(
    rows: ParsedAttendanceRow[],
    issues: AttendanceIssueDraft[]
  ) {
    const seen = new Set<string>();
    let duplicateRows = 0;

    rows.forEach((row) => {
      if (!row.attendanceDate) return;
      const key = `${row.identifier}:${row.attendanceDate.toISOString()}`;

      if (seen.has(key)) {
        duplicateRows += 1;
        issues.push(
          this.issueService.build({
            severity: AttendanceIssueSeverity.WARNING,
            type: AttendanceIssueType.DUPLICATE_IDENTIFIER_SHIFT_DATE,
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            attendanceDate: row.attendanceDate,
            message: `Duplicate attendance row for identifier ${row.identifier} on ${row.attendanceDate.toISOString().slice(0, 10)}.`
          })
        );
      }

      seen.add(key);
    });

    return duplicateRows;
  }

  private async persistImportResult(
    batchId: string,
    input: ImportAttendanceFromBufferInput,
    processed: Awaited<ReturnType<AttendanceImportService["processRows"]>>,
    status: AttendanceImportStatus
  ) {
    const monthKeys = this.summaries.monthKeysBetween(input.periodFrom, input.periodTo);

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceDailyRecord.deleteMany({
        where: {
          attendanceDate: {
            gte: input.periodFrom,
            lte: input.periodTo
          }
        }
      });
      await this.replaceSummaries(tx, monthKeys, batchId, processed.summaryResult);

      if (processed.dailyRecords.length) {
        await tx.attendanceDailyRecord.createMany({
          data: processed.dailyRecords.map((record) => ({
            ...record,
            importBatchId: batchId
          }))
        });
      }

      if (processed.issues.length) {
        await tx.attendanceImportIssue.createMany({
          data: processed.issues.map((issue) => ({
            importBatchId: batchId,
            severity: issue.severity,
            type: issue.type,
            rowNumber: issue.rowNumber ?? null,
            identifier: issue.identifier ?? null,
            attendanceDate: issue.attendanceDate ?? null,
            message: issue.message,
            metadata: issue.metadata ?? Prisma.JsonNull
          }))
        });
      }

      await tx.attendanceImportBatch.update({
        where: { id: batchId },
        data: {
          status,
          totalRows: processed.egyptRows + processed.ignoredRows,
          egyptRows: processed.egyptRows,
          ignoredRows: processed.ignoredRows,
          processedRows: processed.processedRows,
          matchedPickers: processed.matchedPickers,
          matchedChamps: processed.matchedChamps,
          unmatchedIdentifiers: processed.unmatchedIdentifiers,
          duplicateRows: processed.duplicateRows,
          warningsCount: processed.warningCount,
          errorsCount: processed.errorCount,
          dailyRecordsStored: processed.dailyRecords.length,
          userSummariesStored: processed.summaryResult.userSummaries.length,
          branchSummariesRebuilt: processed.summaryResult.branchSummaries.length,
          chainSummariesRebuilt: processed.summaryResult.chainSummaries.length,
          completedAt: new Date()
        }
      });
    });
  }

  private async replaceSummaries(
    tx: Prisma.TransactionClient,
    monthKeys: string[],
    batchId: string,
    summaryResult: ReturnType<AttendanceSummaryService["buildMonthlySummaries"]>
  ) {
    await tx.attendanceMonthlyUserSummary.deleteMany({
      where: { monthKey: { in: monthKeys } }
    });
    await tx.attendanceMonthlyBranchSummary.deleteMany({
      where: { monthKey: { in: monthKeys } }
    });
    await tx.attendanceMonthlyChainSummary.deleteMany({
      where: { monthKey: { in: monthKeys } }
    });

    if (summaryResult.userSummaries.length) {
      await tx.attendanceMonthlyUserSummary.createMany({
        data: summaryResult.userSummaries.map((summary) => ({
          ...summary,
          lastImportBatchId: batchId
        }))
      });
    }

    if (summaryResult.branchSummaries.length) {
      await tx.attendanceMonthlyBranchSummary.createMany({
        data: summaryResult.branchSummaries.map((summary) => ({
          ...summary,
          lastImportBatchId: batchId
        }))
      });
    }

    if (summaryResult.chainSummaries.length) {
      await tx.attendanceMonthlyChainSummary.createMany({
        data: summaryResult.chainSummaries.map((summary) => ({
          ...summary,
          lastImportBatchId: batchId
        }))
      });
    }
  }

  private assertImportMode(mode: AttendanceImportMode) {
    if (
      mode !== AttendanceImportMode.DAILY_MTD_OVERRIDE &&
      mode !== AttendanceImportMode.HISTORICAL_BACKFILL
    ) {
      throw new BadRequestException(
        "Phase 2 buffer import supports Daily MTD Override and Historical Backfill only."
      );
    }
  }

  private assertPeriod(periodFrom: Date, periodTo: Date) {
    if (
      Number.isNaN(periodFrom.getTime()) ||
      Number.isNaN(periodTo.getTime()) ||
      periodFrom > periodTo
    ) {
      throw new BadRequestException("A valid attendance period is required.");
    }
  }
}

function isEgypt(division: string) {
  return division.trim().toLowerCase() === "egypt";
}

function fingerprintRow(row: ParsedAttendanceRow) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        identifier: row.identifier,
        attendanceDate: row.attendanceDate?.toISOString() ?? null,
        status: row.rawStatus,
        shiftName: row.shiftName,
        scheduledStartAt: row.scheduledStartAt?.toISOString() ?? null,
        actualCheckInAt: row.actualCheckInAt?.toISOString() ?? null
      })
    )
    .digest("hex");
}

