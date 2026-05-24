import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AttendanceArchiveStatus,
  AttendanceImportMode,
  AttendanceImportStatus,
  AttendanceIssueSeverity,
  Prisma
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceHistoricalAssignmentBackfillService } from "./attendance-historical-assignment-backfill.service";
import { AttendanceImportService } from "./attendance-import.service";
import { toMonthKey } from "./attendance-summary.service";
import { AttendanceMaintenanceOperation } from "./dto/attendance-operations.dto";
import type { ConfirmHistoricalAssignmentBackfillResult } from "./attendance.types";

export const HISTORICAL_ASSIGNMENT_CONFIRMATION_TEXT =
  "CREATE HISTORICAL ASSIGNMENTS";
export const DELETE_ATTENDANCE_CONFIRMATION_TEXT = "DELETE ATTENDANCE DATA";
export const RECALCULATE_ATTENDANCE_CONFIRMATION_TEXT =
  "RECALCULATE ATTENDANCE SUMMARIES";
export const COMPRESS_ATTENDANCE_CONFIRMATION_TEXT =
  "COMPRESS ATTENDANCE MONTHS";

export type AttendanceUploadedFile = {
  originalname: string;
  buffer: Buffer;
  size?: number;
};

type RequestContextInput = {
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type UploadAttendanceImportInput = RequestContextInput & {
  file: AttendanceUploadedFile | null | undefined;
  periodFrom: string;
  periodTo: string;
  uploadMode: AttendanceImportMode;
};

type PreviewHistoricalAssignmentsInput = RequestContextInput & {
  file: AttendanceUploadedFile | null | undefined;
  periodFrom: string;
  periodTo: string;
};

type ConfirmHistoricalAssignmentsInput = PreviewHistoricalAssignmentsInput & {
  confirmationText: string;
};

type PreviewMaintenanceInput = RequestContextInput & {
  operation: AttendanceMaintenanceOperation;
  periodFrom?: string;
  periodTo?: string;
  monthKey?: string;
  beforeMonthKey?: string;
};

type DeleteAttendanceRangeInput = RequestContextInput & {
  periodFrom: string;
  periodTo: string;
  confirmationText: string;
};

type DeleteAttendanceMonthInput = RequestContextInput & {
  monthKey: string;
  confirmationText: string;
};

type DeleteAllAttendanceDataInput = RequestContextInput & {
  confirmationText: string;
};

type RecalculateAttendanceSummariesInput = RequestContextInput & {
  periodFrom?: string;
  periodTo?: string;
  monthKey?: string;
  confirmationText: string;
};

type CompressOldAttendanceMonthsInput = RequestContextInput & {
  beforeMonthKey?: string;
  confirmationText: string;
};

type MaintenanceRange = {
  monthKeys: string[];
  periodFrom: Date | null;
  periodTo: Date | null;
};

type MaintenancePreview = {
  operation: AttendanceMaintenanceOperation;
  canProceed: boolean;
  blockers: string[];
  warnings: string[];
  safetyNotice: string[];
  attendanceDailyRecordsAffected: number;
  monthlyUserSummariesAffected: number;
  monthlyBranchSummariesAffected: number;
  monthlyChainSummariesAffected: number;
  importBatchesAffected: number;
  importIssuesAffected: number;
  monthKeysAffected: string[];
  dateRangeAffected: { periodFrom: string | null; periodTo: string | null };
};

type PageQuery = {
  page?: number;
  pageSize?: number;
};

type ListImportsQuery = PageQuery & {
  status?: AttendanceImportStatus;
  mode?: AttendanceImportMode;
  periodFrom?: string;
  periodTo?: string;
};

type ListIssuesQuery = PageQuery & {
  severity?: AttendanceIssueSeverity;
};

@Injectable()
export class AttendanceOperationsService {
  maintenanceReferenceDate?: Date;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttendanceImportService)
    private readonly attendanceImport: AttendanceImportService,
    @Inject(AttendanceHistoricalAssignmentBackfillService)
    private readonly historicalBackfill: AttendanceHistoricalAssignmentBackfillService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async uploadAttendanceImport(input: UploadAttendanceImportInput) {
    const file = this.assertXlsxFile(input.file);
    const period = parsePeriod(input.periodFrom, input.periodTo, "attendance import");
    this.assertUploadMode(input.uploadMode);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: "ATTENDANCE_IMPORT_STARTED",
      entityType: "AttendanceImportBatch",
      entityId: file.originalname,
      newValue: {
        fileName: file.originalname,
        periodFrom: period.periodFrom.toISOString(),
        periodTo: period.periodTo.toISOString(),
        mode: input.uploadMode
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    try {
      const summary = await this.attendanceImport.importAttendanceFromBuffer({
        buffer: file.buffer,
        fileName: file.originalname,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        mode: input.uploadMode,
        createdById: input.actorUserId
      });

      await this.audit.log({
        actorUserId: input.actorUserId,
        action: "ATTENDANCE_IMPORT_COMPLETED",
        entityType: "AttendanceImportBatch",
        entityId: summary.batchId,
        newValue: {
          fileName: file.originalname,
          periodFrom: period.periodFrom.toISOString(),
          periodTo: period.periodTo.toISOString(),
          mode: input.uploadMode,
          status: summary.status,
          counts: summary
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });

      return summary;
    } catch (error) {
      await this.audit.log({
        actorUserId: input.actorUserId,
        action: "ATTENDANCE_IMPORT_FAILED",
        entityType: "AttendanceImportBatch",
        entityId: file.originalname,
        newValue: {
          fileName: file.originalname,
          periodFrom: period.periodFrom.toISOString(),
          periodTo: period.periodTo.toISOString(),
          mode: input.uploadMode,
          errorMessage:
            error instanceof Error ? error.message : "Attendance import failed."
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
      throw error;
    }
  }

  async listImports(query: ListImportsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where = buildImportWhere(query);
    const [total, batches] = await Promise.all([
      this.prisma.attendanceImportBatch.count({ where }),
      this.prisma.attendanceImportBatch.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              nameEn: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: batches.map(toBatchListItem),
      meta: toMeta({ page, pageSize, total })
    };
  }

  async getImport(id: string) {
    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            nameEn: true,
            role: true
          }
        }
      }
    });

    if (!batch) {
      throw new NotFoundException("Attendance import was not found.");
    }

    const groupedIssues = await this.prisma.attendanceImportIssue.groupBy({
      by: ["severity"],
      where: { importBatchId: id },
      _count: true
    });

    return {
      ...toBatchListItem(batch),
      errorMessage: batch.errorMessage,
      processedRows: batch.processedRows,
      duplicateRows: batch.duplicateRows,
      unmatchedIdentifiers: batch.unmatchedIdentifiers,
      issueCounts: {
        INFO: groupedIssues.find((item) => item.severity === "INFO")?._count ?? 0,
        WARNING:
          groupedIssues.find((item) => item.severity === "WARNING")?._count ?? 0,
        ERROR: groupedIssues.find((item) => item.severity === "ERROR")?._count ?? 0
      },
      retention: {
        dailyRecordsStored: batch.dailyRecordsStored,
        userSummariesStored: batch.userSummariesStored,
        branchSummariesRebuilt: batch.branchSummariesRebuilt,
        chainSummariesRebuilt: batch.chainSummariesRebuilt
      }
    };
  }

  async listImportIssues(id: string, query: ListIssuesQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.AttendanceImportIssueWhereInput = {
      importBatchId: id,
      severity: query.severity
    };
    const [total, issues] = await Promise.all([
      this.prisma.attendanceImportIssue.count({ where }),
      this.prisma.attendanceImportIssue.findMany({
        where,
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        type: issue.type,
        rowNumber: issue.rowNumber,
        identifier: issue.identifier,
        attendanceDate: issue.attendanceDate?.toISOString() ?? null,
        message: issue.message,
        metadata: issue.metadata,
        createdAt: issue.createdAt.toISOString()
      })),
      meta: toMeta({ page, pageSize, total })
    };
  }

  async getImportSampleUsers(id: string) {
    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!batch) {
      throw new NotFoundException("Attendance import was not found.");
    }

    const summaries = await this.prisma.attendanceMonthlyUserSummary.findMany({
      where: { lastImportBatchId: id },
      include: {
        user: {
          select: {
            nameEn: true
          }
        }
      },
      orderBy: [{ role: "asc" }, { identifier: "asc" }],
      take: 10
    });

    return {
      items: summaries.map((summary) => ({
        id: summary.id,
        identifier: summary.identifier,
        role: summary.role,
        userDisplayName: summary.user.nameEn,
        totalCreatedShifts: summary.totalCreatedShifts,
        totalShiftsNeeded: summary.totalShiftsNeeded,
        missingShifts: summary.missingShifts,
        lateLevel1Over15Count: summary.lateLevel1Over15Count,
        absentCount: summary.absentCount,
        under8HoursCount: summary.under8HoursCount,
        over15HoursCount: summary.over15HoursCount
      }))
    };
  }

  async previewHistoricalAssignments(input: PreviewHistoricalAssignmentsInput) {
    const file = this.assertXlsxFile(input.file);
    const period = parsePeriod(
      input.periodFrom,
      input.periodTo,
      "historical assignment backfill preview"
    );
    const preview =
      await this.historicalBackfill.previewHistoricalAssignmentBackfill({
        buffer: file.buffer,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        createdById: input.actorUserId,
        mode: AttendanceImportMode.HISTORICAL_BACKFILL
      });

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: "ATTENDANCE_HISTORICAL_ASSIGNMENT_PREVIEW_REQUESTED",
      entityType: "AttendanceHistoricalAssignmentBackfillPreview",
      entityId: `${input.actorUserId}:${Date.now()}`,
      newValue: {
        fileName: file.originalname,
        periodFrom: period.periodFrom.toISOString(),
        periodTo: period.periodTo.toISOString(),
        totals: {
          totalRowsAnalyzed: preview.totalRowsAnalyzed,
          matchedPickers: preview.matchedPickers,
          ignoredChampRows: preview.ignoredChampRows,
          unmappedLocationCount: preview.unmappedLocationCount,
          conflictCount: preview.conflictCount,
          proposalsCount: preview.proposalsCount
        }
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    return preview;
  }

  async confirmHistoricalAssignments(input: ConfirmHistoricalAssignmentsInput) {
    if (input.confirmationText !== HISTORICAL_ASSIGNMENT_CONFIRMATION_TEXT) {
      throw new BadRequestException(
        `Type ${HISTORICAL_ASSIGNMENT_CONFIRMATION_TEXT} to confirm historical assignment creation.`
      );
    }

    const file = this.assertXlsxFile(input.file);
    const period = parsePeriod(
      input.periodFrom,
      input.periodTo,
      "historical assignment backfill confirmation"
    );
    const preview =
      await this.historicalBackfill.previewHistoricalAssignmentBackfill({
        buffer: file.buffer,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        createdById: input.actorUserId,
        mode: AttendanceImportMode.HISTORICAL_BACKFILL
      });

    if (preview.conflictCount > 0) {
      throw new BadRequestException(
        "Historical assignment backfill preview contains conflicts. Resolve conflicts before confirmation."
      );
    }

    if (preview.proposalsCount === 0) {
      throw new BadRequestException(
        "Historical assignment backfill preview has no safe proposals to confirm."
      );
    }

    const result =
      await this.historicalBackfill.confirmHistoricalAssignmentBackfill({
        proposals: preview.proposals,
        confirmedById: input.actorUserId
      });

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: "ATTENDANCE_HISTORICAL_ASSIGNMENT_CONFIRMATION_PERFORMED",
      entityType: "PickerBranchAssignment",
      entityId: "ATTENDANCE_BACKFILL",
      newValue: {
        fileName: file.originalname,
        periodFrom: period.periodFrom.toISOString(),
        periodTo: period.periodTo.toISOString(),
        proposalsCount: preview.proposalsCount,
        result: safeConfirmResult(result)
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    return result;
  }

  async listMaintenanceMonths() {
    const [
      dailyGroups,
      userSummaryGroups,
      branchSummaryGroups,
      chainSummaryGroups,
      importBatches,
      issues,
      userArchiveRows
    ] = await Promise.all([
      this.prisma.attendanceDailyRecord.groupBy({
        by: ["monthKey"],
        _count: true
      }),
      this.prisma.attendanceMonthlyUserSummary.groupBy({
        by: ["monthKey"],
        _count: true
      }),
      this.prisma.attendanceMonthlyBranchSummary.groupBy({
        by: ["monthKey"],
        _count: true
      }),
      this.prisma.attendanceMonthlyChainSummary.groupBy({
        by: ["monthKey"],
        _count: true
      }),
      this.prisma.attendanceImportBatch.findMany({
        select: {
          id: true,
          periodFrom: true,
          periodTo: true,
          createdAt: true,
          completedAt: true,
          status: true
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.attendanceImportIssue.findMany({
        select: {
          attendanceDate: true,
          importBatch: {
            select: {
              periodFrom: true
            }
          }
        }
      }),
      this.prisma.attendanceMonthlyUserSummary.findMany({
        select: {
          monthKey: true,
          archiveStatus: true
        }
      })
    ]);

    const dailyCounts = countsFromGroupBy(dailyGroups);
    const userCounts = countsFromGroupBy(userSummaryGroups);
    const branchCounts = countsFromGroupBy(branchSummaryGroups);
    const chainCounts = countsFromGroupBy(chainSummaryGroups);
    const batchCounts = new Map<string, number>();
    const issueCounts = new Map<string, number>();
    const archiveStatuses = new Map<string, Set<AttendanceArchiveStatus>>();
    const latestImport = new Map<
      string,
      { lastImportAt: Date; lastImportStatus: AttendanceImportStatus }
    >();

    userArchiveRows.forEach((row) => {
      const statuses = archiveStatuses.get(row.monthKey) ?? new Set();
      statuses.add(row.archiveStatus);
      archiveStatuses.set(row.monthKey, statuses);
    });

    importBatches.forEach((batch) => {
      const monthKeys = monthKeysBetween(batch.periodFrom, batch.periodTo);
      monthKeys.forEach((monthKey) => {
        batchCounts.set(monthKey, (batchCounts.get(monthKey) ?? 0) + 1);
        const importAt = batch.completedAt ?? batch.createdAt;
        const existing = latestImport.get(monthKey);
        if (!existing || importAt > existing.lastImportAt) {
          latestImport.set(monthKey, {
            lastImportAt: importAt,
            lastImportStatus: batch.status
          });
        }
      });
    });

    issues.forEach((issue) => {
      const monthKey = issue.attendanceDate
        ? toMonthKey(issue.attendanceDate)
        : toMonthKey(issue.importBatch.periodFrom);
      issueCounts.set(monthKey, (issueCounts.get(monthKey) ?? 0) + 1);
    });

    const monthKeys = Array.from(
      new Set([
        ...dailyCounts.keys(),
        ...userCounts.keys(),
        ...branchCounts.keys(),
        ...chainCounts.keys(),
        ...batchCounts.keys(),
        ...issueCounts.keys()
      ])
    ).sort((a, b) => b.localeCompare(a));
    const referenceDate = this.getMaintenanceReferenceDate();

    return {
      items: monthKeys.map((monthKey) => ({
        monthKey,
        dailyRecordsCount: dailyCounts.get(monthKey) ?? 0,
        userSummariesCount: userCounts.get(monthKey) ?? 0,
        branchSummariesCount: branchCounts.get(monthKey) ?? 0,
        chainSummariesCount: chainCounts.get(monthKey) ?? 0,
        importBatchesCount: batchCounts.get(monthKey) ?? 0,
        issuesCount: issueCounts.get(monthKey) ?? 0,
        archiveStatus: deriveMaintenanceArchiveStatus({
          archiveStatuses: archiveStatuses.get(monthKey),
          dailyRecordsCount: dailyCounts.get(monthKey) ?? 0,
          monthKey,
          referenceDate,
          summariesCount:
            (userCounts.get(monthKey) ?? 0) +
            (branchCounts.get(monthKey) ?? 0) +
            (chainCounts.get(monthKey) ?? 0)
        }),
        lastImportAt:
          latestImport.get(monthKey)?.lastImportAt.toISOString() ?? null,
        lastImportStatus: latestImport.get(monthKey)?.lastImportStatus ?? null
      }))
    };
  }

  async previewMaintenance(input: PreviewMaintenanceInput) {
    const preview = await this.buildMaintenancePreview(input);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: "ATTENDANCE_MAINTENANCE_PREVIEW_REQUESTED",
      entityType: "AttendanceMaintenancePreview",
      entityId: `${input.operation}:${Date.now()}`,
      newValue: safeMaintenancePreview(preview),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    return preview;
  }

  async deleteAttendanceRange(input: DeleteAttendanceRangeInput) {
    assertConfirmation(
      input.confirmationText,
      DELETE_ATTENDANCE_CONFIRMATION_TEXT,
      "attendance data deletion"
    );

    const preview = await this.buildMaintenancePreview({
      ...input,
      operation: AttendanceMaintenanceOperation.DELETE_RANGE
    });
    this.assertPreviewCanProceed(preview);
    const range = resolveMaintenanceRange({
      operation: AttendanceMaintenanceOperation.DELETE_RANGE,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceImportIssue.deleteMany({
        where: dateRangeWhere("attendanceDate", range)
      });
      await tx.attendanceDailyRecord.deleteMany({
        where: dateRangeWhere("attendanceDate", range)
      });
      await deleteSummariesForMonthKeys(tx, range.monthKeys);
      await createMaintenanceBatch(tx, {
        actorUserId: input.actorUserId,
        mode: AttendanceImportMode.DELETE_RANGE,
        periodFrom: range.periodFrom!,
        periodTo: range.periodTo!,
        preview
      });
    });

    return this.auditAndReturnMaintenanceResult({
      action: "ATTENDANCE_MAINTENANCE_DELETE_RANGE_PERFORMED",
      input,
      preview
    });
  }

  async deleteAttendanceMonth(input: DeleteAttendanceMonthInput) {
    assertConfirmation(
      input.confirmationText,
      DELETE_ATTENDANCE_CONFIRMATION_TEXT,
      "attendance data deletion"
    );

    const preview = await this.buildMaintenancePreview({
      ...input,
      operation: AttendanceMaintenanceOperation.DELETE_MONTH
    });
    this.assertPreviewCanProceed(preview);
    const range = resolveMaintenanceRange({
      operation: AttendanceMaintenanceOperation.DELETE_MONTH,
      monthKey: input.monthKey
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceImportIssue.deleteMany({
        where: dateRangeWhere("attendanceDate", range)
      });
      await tx.attendanceDailyRecord.deleteMany({
        where: { monthKey: input.monthKey }
      });
      await deleteSummariesForMonthKeys(tx, [input.monthKey]);
      await createMaintenanceBatch(tx, {
        actorUserId: input.actorUserId,
        mode: AttendanceImportMode.DELETE_MONTH,
        periodFrom: range.periodFrom!,
        periodTo: range.periodTo!,
        preview
      });
    });

    return this.auditAndReturnMaintenanceResult({
      action: "ATTENDANCE_MAINTENANCE_DELETE_MONTH_PERFORMED",
      input,
      preview
    });
  }

  async deleteAllAttendanceData(input: DeleteAllAttendanceDataInput) {
    assertConfirmation(
      input.confirmationText,
      DELETE_ATTENDANCE_CONFIRMATION_TEXT,
      "attendance data deletion"
    );

    const preview = await this.buildMaintenancePreview({
      ...input,
      operation: AttendanceMaintenanceOperation.DELETE_ALL
    });
    this.assertPreviewCanProceed(preview);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: "ATTENDANCE_MAINTENANCE_DELETE_ALL_STARTED",
      entityType: "AttendanceMaintenanceOperation",
      entityId: "DELETE_ALL",
      newValue: safeMaintenancePreview(preview),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceDailyRecord.deleteMany({});
      await tx.attendanceMonthlyBranchSummary.deleteMany({});
      await tx.attendanceMonthlyChainSummary.deleteMany({});
      await tx.attendanceMonthlyUserSummary.deleteMany({});
      await tx.attendanceImportIssue.deleteMany({});
      await tx.attendanceImportBatch.deleteMany({});
    });

    return this.auditAndReturnMaintenanceResult({
      action: "ATTENDANCE_MAINTENANCE_DELETE_ALL_PERFORMED",
      input,
      preview
    });
  }

  async recalculateAttendanceSummaries(input: RecalculateAttendanceSummariesInput) {
    assertConfirmation(
      input.confirmationText,
      RECALCULATE_ATTENDANCE_CONFIRMATION_TEXT,
      "attendance summary recalculation"
    );

    const preview = await this.buildMaintenancePreview({
      ...input,
      operation: AttendanceMaintenanceOperation.RECALCULATE_SUMMARIES
    });
    this.assertPreviewCanProceed(preview);
    const range = resolveMaintenanceRange({
      operation: AttendanceMaintenanceOperation.RECALCULATE_SUMMARIES,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      monthKey: input.monthKey
    });

    const result = await this.attendanceImport.recalculateSummariesForPeriod({
      periodFrom: range.periodFrom!,
      periodTo: range.periodTo!,
      createdById: input.actorUserId,
      referenceDate: this.getMaintenanceReferenceDate()
    });

    const response = {
      ...toMaintenanceResult(preview),
      batchId: result.batchId,
      userSummariesStored: result.userSummariesStored,
      branchSummariesRebuilt: result.branchSummariesRebuilt,
      chainSummariesRebuilt: result.chainSummariesRebuilt
    };

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: "ATTENDANCE_MAINTENANCE_RECALCULATE_PERFORMED",
      entityType: "AttendanceMaintenanceOperation",
      entityId: "RECALCULATE_SUMMARIES",
      newValue: response,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    return response;
  }

  async compressOldAttendanceMonths(input: CompressOldAttendanceMonthsInput) {
    assertConfirmation(
      input.confirmationText,
      COMPRESS_ATTENDANCE_CONFIRMATION_TEXT,
      "attendance month compression"
    );

    const preview = await this.buildMaintenancePreview({
      ...input,
      operation: AttendanceMaintenanceOperation.COMPRESS_OLD_MONTHS
    });
    this.assertPreviewCanProceed(preview);
    const periodFrom = startOfMonthKey(preview.monthKeysAffected[0]);
    const periodTo = endOfMonthKey(
      preview.monthKeysAffected[preview.monthKeysAffected.length - 1]
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceMonthlyUserSummary.updateMany({
        where: { monthKey: { in: preview.monthKeysAffected } },
        data: {
          sourceDailyRecordsAvailable: false,
          archiveStatus: AttendanceArchiveStatus.COMPRESSED
        }
      });
      await tx.attendanceDailyRecord.deleteMany({
        where: { monthKey: { in: preview.monthKeysAffected } }
      });
      await createMaintenanceBatch(tx, {
        actorUserId: input.actorUserId,
        mode: AttendanceImportMode.COMPRESS_OLD_MONTHS,
        periodFrom,
        periodTo,
        preview
      });
    });

    return this.auditAndReturnMaintenanceResult({
      action: "ATTENDANCE_MAINTENANCE_COMPRESS_OLD_MONTHS_PERFORMED",
      input,
      preview
    });
  }

  private async buildMaintenancePreview(
    input: PreviewMaintenanceInput
  ): Promise<MaintenancePreview> {
    const range = await this.resolvePreviewRange(input);
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (
      input.operation === AttendanceMaintenanceOperation.DELETE_RANGE &&
      range.monthKeys.length
    ) {
      await this.addDeleteRangeSafetyBlockers(range, blockers, warnings);
    }

    if (input.operation === AttendanceMaintenanceOperation.RECALCULATE_SUMMARIES) {
      await this.addRecalculateBlockers(range, blockers);
    }

    if (input.operation === AttendanceMaintenanceOperation.COMPRESS_OLD_MONTHS) {
      await this.addCompressionBlockers(range, blockers);
    }

    if (!range.monthKeys.length && input.operation !== AttendanceMaintenanceOperation.DELETE_ALL) {
      blockers.push("No attendance months match the selected maintenance operation.");
    }

    const counts = await this.countMaintenanceImpact(range, input.operation);

    return {
      operation: input.operation,
      canProceed: blockers.length === 0,
      blockers,
      warnings,
      safetyNotice: ATTENDANCE_MAINTENANCE_SAFETY_NOTICE,
      ...counts,
      monthKeysAffected: range.monthKeys,
      dateRangeAffected: {
        periodFrom: range.periodFrom?.toISOString() ?? null,
        periodTo: range.periodTo?.toISOString() ?? null
      }
    };
  }

  private async resolvePreviewRange(
    input: PreviewMaintenanceInput
  ): Promise<MaintenanceRange> {
    if (input.operation === AttendanceMaintenanceOperation.DELETE_ALL) {
      const monthKeys = await this.getAllAttendanceMonthKeys();
      return {
        monthKeys,
        periodFrom: monthKeys.length ? startOfMonthKey(monthKeys[0]) : null,
        periodTo: monthKeys.length
          ? endOfMonthKey(monthKeys[monthKeys.length - 1])
          : null
      };
    }

    if (input.operation === AttendanceMaintenanceOperation.COMPRESS_OLD_MONTHS) {
      const monthKeys = await this.getCompressibleMonthKeys(input.beforeMonthKey);
      return {
        monthKeys,
        periodFrom: monthKeys.length ? startOfMonthKey(monthKeys[0]) : null,
        periodTo: monthKeys.length
          ? endOfMonthKey(monthKeys[monthKeys.length - 1])
          : null
      };
    }

    return resolveMaintenanceRange(input);
  }

  private async countMaintenanceImpact(
    range: MaintenanceRange,
    operation: AttendanceMaintenanceOperation
  ) {
    if (operation === AttendanceMaintenanceOperation.DELETE_ALL) {
      const [
        attendanceDailyRecordsAffected,
        monthlyUserSummariesAffected,
        monthlyBranchSummariesAffected,
        monthlyChainSummariesAffected,
        importBatchesAffected,
        importIssuesAffected
      ] = await Promise.all([
        this.prisma.attendanceDailyRecord.count(),
        this.prisma.attendanceMonthlyUserSummary.count(),
        this.prisma.attendanceMonthlyBranchSummary.count(),
        this.prisma.attendanceMonthlyChainSummary.count(),
        this.prisma.attendanceImportBatch.count(),
        this.prisma.attendanceImportIssue.count()
      ]);

      return {
        attendanceDailyRecordsAffected,
        monthlyUserSummariesAffected,
        monthlyBranchSummariesAffected,
        monthlyChainSummariesAffected,
        importBatchesAffected,
        importIssuesAffected
      };
    }

    const monthWhere = { monthKey: { in: range.monthKeys } };
    const dateWhere = dateRangeWhere("attendanceDate", range);
    const batchWhere =
      range.periodFrom && range.periodTo
        ? {
            periodFrom: { gte: range.periodFrom },
            periodTo: { lte: range.periodTo }
          }
        : {};

    const [
      attendanceDailyRecordsAffected,
      monthlyUserSummariesAffected,
      monthlyBranchSummariesAffected,
      monthlyChainSummariesAffected,
      importBatchesAffected,
      importIssuesAffected
    ] = await Promise.all([
      this.prisma.attendanceDailyRecord.count({
        where:
          operation === AttendanceMaintenanceOperation.COMPRESS_OLD_MONTHS
            ? monthWhere
            : dateWhere
      }),
      this.prisma.attendanceMonthlyUserSummary.count({ where: monthWhere }),
      this.prisma.attendanceMonthlyBranchSummary.count({ where: monthWhere }),
      this.prisma.attendanceMonthlyChainSummary.count({ where: monthWhere }),
      this.prisma.attendanceImportBatch.count({ where: batchWhere }),
      this.prisma.attendanceImportIssue.count({ where: dateWhere })
    ]);

    return {
      attendanceDailyRecordsAffected,
      monthlyUserSummariesAffected,
      monthlyBranchSummariesAffected,
      monthlyChainSummariesAffected,
      importBatchesAffected,
      importIssuesAffected
    };
  }

  private async addDeleteRangeSafetyBlockers(
    range: MaintenanceRange,
    blockers: string[],
    warnings: string[]
  ) {
    const referenceDate = this.getMaintenanceReferenceDate();

    for (const monthKey of range.monthKeys) {
      if (isCurrentOrPreviousMonth(monthKey, referenceDate)) {
        continue;
      }

      if (isFullMonthRange(range, monthKey)) {
        continue;
      }

      const [dailyRecords, summaries] = await Promise.all([
        this.prisma.attendanceDailyRecord.count({ where: { monthKey } }),
        this.prisma.attendanceMonthlyUserSummary.count({ where: { monthKey } })
      ]);

      if (dailyRecords === 0 && summaries > 0) {
        blockers.push(
          `${monthKey} is summary-only. Partial date-range deletion is blocked because daily records are not available to rebuild safely.`
        );
      }
    }

    if (range.monthKeys.length) {
      warnings.push(
        "Affected monthly summaries will be removed so stale summary totals are not shown after deletion."
      );
    }
  }

  private async addRecalculateBlockers(
    range: MaintenanceRange,
    blockers: string[]
  ) {
    const dailyRecords = await this.prisma.attendanceDailyRecord.count({
      where: dateRangeWhere("attendanceDate", range)
    });

    if (dailyRecords === 0) {
      blockers.push(
        "No daily attendance records exist for this selection. Re-upload historical data if recalculation is required."
      );
    }
  }

  private async addCompressionBlockers(
    range: MaintenanceRange,
    blockers: string[]
  ) {
    if (!range.monthKeys.length) {
      blockers.push("No old detailed months are eligible for compression.");
      return;
    }

    for (const monthKey of range.monthKeys) {
      const [dailyRecords, summaries] = await Promise.all([
        this.prisma.attendanceDailyRecord.count({ where: { monthKey } }),
        this.prisma.attendanceMonthlyUserSummary.count({ where: { monthKey } })
      ]);

      if (dailyRecords > 0 && summaries === 0) {
        blockers.push(
          `${monthKey} has daily records but no monthly user summaries. Compression is blocked until summaries exist.`
        );
      }
    }
  }

  private async getAllAttendanceMonthKeys() {
    const [
      dailyGroups,
      userSummaryGroups,
      branchSummaryGroups,
      chainSummaryGroups
    ] = await Promise.all([
      this.prisma.attendanceDailyRecord.groupBy({ by: ["monthKey"], _count: true }),
      this.prisma.attendanceMonthlyUserSummary.groupBy({
        by: ["monthKey"],
        _count: true
      }),
      this.prisma.attendanceMonthlyBranchSummary.groupBy({
        by: ["monthKey"],
        _count: true
      }),
      this.prisma.attendanceMonthlyChainSummary.groupBy({
        by: ["monthKey"],
        _count: true
      })
    ]);

    return Array.from(
      new Set([
        ...countsFromGroupBy(dailyGroups).keys(),
        ...countsFromGroupBy(userSummaryGroups).keys(),
        ...countsFromGroupBy(branchSummaryGroups).keys(),
        ...countsFromGroupBy(chainSummaryGroups).keys()
      ])
    ).sort();
  }

  private async getCompressibleMonthKeys(beforeMonthKey?: string) {
    const dailyGroups = await this.prisma.attendanceDailyRecord.groupBy({
      by: ["monthKey"],
      _count: true
    });
    const referenceDate = this.getMaintenanceReferenceDate();

    return Array.from(countsFromGroupBy(dailyGroups).entries())
      .filter(([, count]) => count > 0)
      .map(([monthKey]) => monthKey)
      .filter((monthKey) => !isCurrentOrPreviousMonth(monthKey, referenceDate))
      .filter((monthKey) => !beforeMonthKey || monthKey < beforeMonthKey)
      .sort();
  }

  private assertPreviewCanProceed(preview: MaintenancePreview) {
    if (!preview.canProceed) {
      throw new BadRequestException(
        `Attendance maintenance operation is blocked: ${preview.blockers.join(" ")}`
      );
    }
  }

  private async auditAndReturnMaintenanceResult(input: {
    action: string;
    input: RequestContextInput;
    preview: MaintenancePreview;
  }) {
    const result = toMaintenanceResult(input.preview);

    await this.audit.log({
      actorUserId: input.input.actorUserId,
      action: input.action,
      entityType: "AttendanceMaintenanceOperation",
      entityId: input.preview.operation,
      newValue: result,
      ipAddress: input.input.ipAddress,
      userAgent: input.input.userAgent
    });

    return result;
  }

  private getMaintenanceReferenceDate() {
    return this.maintenanceReferenceDate ?? new Date();
  }

  private assertXlsxFile(file: AttendanceUploadedFile | null | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Attendance XLSX file is required.");
    }

    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new BadRequestException("Attendance file must be an .xlsx workbook.");
    }

    return file;
  }

  private assertUploadMode(mode: AttendanceImportMode) {
    if (
      mode !== AttendanceImportMode.DAILY_MTD_OVERRIDE &&
      mode !== AttendanceImportMode.HISTORICAL_BACKFILL
    ) {
      throw new BadRequestException(
        "Upload mode must be Daily MTD Override or Historical Backfill."
      );
    }
  }
}

type BatchWithCreator = Prisma.AttendanceImportBatchGetPayload<{
  include: { createdBy: { select: { id: true; nameEn: true; role: true } } };
}>;

function toBatchListItem(batch: BatchWithCreator) {
  return {
    id: batch.id,
    createdAt: batch.createdAt.toISOString(),
    createdBy: batch.createdBy,
    mode: batch.mode,
    status: batch.status,
    periodFrom: batch.periodFrom.toISOString(),
    periodTo: batch.periodTo.toISOString(),
    fileName: batch.fileName,
    totalRows: batch.totalRows,
    egyptRows: batch.egyptRows,
    ignoredRows: batch.ignoredRows,
    matchedPickers: batch.matchedPickers,
    matchedChamps: batch.matchedChamps,
    warningsCount: batch.warningsCount,
    errorsCount: batch.errorsCount,
    dailyRecordsStored: batch.dailyRecordsStored,
    userSummariesStored: batch.userSummariesStored,
    branchSummariesRebuilt: batch.branchSummariesRebuilt,
    chainSummariesRebuilt: batch.chainSummariesRebuilt,
    completedAt: batch.completedAt?.toISOString() ?? null,
    durationMs:
      batch.startedAt && batch.completedAt
        ? batch.completedAt.getTime() - batch.startedAt.getTime()
        : null
  };
}

function buildImportWhere(query: ListImportsQuery): Prisma.AttendanceImportBatchWhereInput {
  const periodFrom = query.periodFrom ? parseDate(query.periodFrom) : null;
  const periodTo = query.periodTo ? parseDate(query.periodTo) : null;

  return {
    status: query.status,
    mode: query.mode,
    ...(periodFrom || periodTo
      ? {
          periodFrom: {
            ...(periodFrom ? { gte: periodFrom } : {}),
            ...(periodTo ? { lte: periodTo } : {})
          }
        }
      : {})
  };
}

function parsePeriod(periodFromValue: string, periodToValue: string, label: string) {
  const periodFrom = parseDate(periodFromValue);
  const periodTo = parseDate(periodToValue);

  if (!periodFrom || !periodTo || periodFrom > periodTo) {
    throw new BadRequestException(`A valid ${label} period is required.`);
  }

  return { periodFrom, periodTo };
}

function parseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

function toMeta(params: { page: number; pageSize: number; total: number }) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total: params.total,
    totalPages: Math.max(1, Math.ceil(params.total / params.pageSize))
  };
}

function safeConfirmResult(result: ConfirmHistoricalAssignmentBackfillResult) {
  return {
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    conflictCount: result.conflictCount
  };
}

const ATTENDANCE_MAINTENANCE_SAFETY_NOTICE = [
  "This affects attendance data only.",
  "It will not delete users.",
  "It will not delete assignments.",
  "It will not delete requests or approvals.",
  "It will not delete audit logs."
];

type GroupByMonthCount = Array<{ monthKey: string; _count: number }>;

function countsFromGroupBy(rows: GroupByMonthCount) {
  return new Map(rows.map((row) => [row.monthKey, row._count]));
}

function resolveMaintenanceRange(input: {
  operation: AttendanceMaintenanceOperation;
  periodFrom?: string;
  periodTo?: string;
  monthKey?: string;
}): MaintenanceRange {
  if (
    input.operation === AttendanceMaintenanceOperation.DELETE_MONTH ||
    (input.operation === AttendanceMaintenanceOperation.RECALCULATE_SUMMARIES &&
      input.monthKey)
  ) {
    if (!input.monthKey || !isValidMonthKey(input.monthKey)) {
      throw new BadRequestException("A valid attendance month is required.");
    }

    return {
      monthKeys: [input.monthKey],
      periodFrom: startOfMonthKey(input.monthKey),
      periodTo: endOfMonthKey(input.monthKey)
    };
  }

  if (
    input.operation === AttendanceMaintenanceOperation.DELETE_RANGE ||
    input.operation === AttendanceMaintenanceOperation.RECALCULATE_SUMMARIES
  ) {
    if (!input.periodFrom || !input.periodTo) {
      throw new BadRequestException("A valid attendance date range is required.");
    }

    const period = parsePeriod(
      input.periodFrom,
      input.periodTo,
      "attendance maintenance"
    );

    return {
      monthKeys: monthKeysBetween(period.periodFrom, period.periodTo),
      periodFrom: period.periodFrom,
      periodTo: period.periodTo
    };
  }

  return {
    monthKeys: [],
    periodFrom: null,
    periodTo: null
  };
}

function assertConfirmation(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new BadRequestException(`Type ${expected} to confirm ${label}.`);
  }
}

function monthKeysBetween(periodFrom: Date, periodTo: Date) {
  const keys: string[] = [];
  let cursor = new Date(
    Date.UTC(periodFrom.getUTCFullYear(), periodFrom.getUTCMonth(), 1)
  );
  const end = new Date(
    Date.UTC(periodTo.getUTCFullYear(), periodTo.getUTCMonth(), 1)
  );

  while (cursor.getTime() <= end.getTime()) {
    keys.push(toMonthKey(cursor));
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
    );
  }

  return keys;
}

function startOfMonthKey(monthKey: string) {
  const [year, month] = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month - 1, 1));
}

function endOfMonthKey(monthKey: string) {
  const [year, month] = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month, 0));
}

function parseMonthKey(monthKey: string) {
  if (!isValidMonthKey(monthKey)) {
    throw new BadRequestException("A valid attendance month is required.");
  }

  const [year, month] = monthKey.split("-").map(Number);
  return [year, month] as const;
}

function isValidMonthKey(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return false;
  }

  const [, month] = monthKey.split("-").map(Number);
  return month >= 1 && month <= 12;
}

function currentAndPreviousMonthKeys(referenceDate: Date) {
  const current = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1)
  );
  const previous = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1)
  );

  return {
    currentMonthKey: toMonthKey(current),
    previousMonthKey: toMonthKey(previous)
  };
}

function isCurrentOrPreviousMonth(monthKey: string, referenceDate: Date) {
  const { currentMonthKey, previousMonthKey } =
    currentAndPreviousMonthKeys(referenceDate);
  return monthKey === currentMonthKey || monthKey === previousMonthKey;
}

function isFullMonthRange(range: MaintenanceRange, monthKey: string) {
  if (!range.periodFrom || !range.periodTo) {
    return false;
  }

  return (
    range.periodFrom.getTime() <= startOfMonthKey(monthKey).getTime() &&
    range.periodTo.getTime() >= endOfMonthKey(monthKey).getTime()
  );
}

function dateRangeWhere(
  field: "attendanceDate",
  range: MaintenanceRange
): { attendanceDate?: { gte: Date; lte: Date } } {
  if (!range.periodFrom || !range.periodTo) {
    return {};
  }

  return {
    [field]: {
      gte: range.periodFrom,
      lte: range.periodTo
    }
  };
}

async function deleteSummariesForMonthKeys(
  tx: Prisma.TransactionClient,
  monthKeys: string[]
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
}

async function createMaintenanceBatch(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    mode: AttendanceImportMode;
    periodFrom: Date;
    periodTo: Date;
    preview: MaintenancePreview;
  }
) {
  await tx.attendanceImportBatch.create({
    data: {
      mode: input.mode,
      status: AttendanceImportStatus.COMPLETED,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      createdById: input.actorUserId,
      processedRows: input.preview.attendanceDailyRecordsAffected,
      warningsCount: input.preview.warnings.length,
      errorsCount: input.preview.blockers.length,
      dailyRecordsStored: 0,
      userSummariesStored: input.preview.monthlyUserSummariesAffected,
      branchSummariesRebuilt: input.preview.monthlyBranchSummariesAffected,
      chainSummariesRebuilt: input.preview.monthlyChainSummariesAffected,
      startedAt: new Date(),
      completedAt: new Date()
    }
  });
}

function deriveMaintenanceArchiveStatus(input: {
  archiveStatuses?: Set<AttendanceArchiveStatus>;
  dailyRecordsCount: number;
  monthKey: string;
  referenceDate: Date;
  summariesCount: number;
}) {
  if (input.summariesCount === 0 && input.dailyRecordsCount === 0) {
    return "EMPTY";
  }

  const { currentMonthKey } = currentAndPreviousMonthKeys(input.referenceDate);
  if (input.monthKey === currentMonthKey) {
    return "ACTIVE_MTD";
  }

  if (input.dailyRecordsCount > 0) {
    return "DETAILED";
  }

  if (input.archiveStatuses?.has(AttendanceArchiveStatus.COMPRESSED)) {
    return "COMPRESSED";
  }

  return "SUMMARY_ONLY";
}

function safeMaintenancePreview(preview: MaintenancePreview) {
  return {
    operation: preview.operation,
    canProceed: preview.canProceed,
    blockers: preview.blockers,
    warnings: preview.warnings,
    attendanceDailyRecordsAffected: preview.attendanceDailyRecordsAffected,
    monthlyUserSummariesAffected: preview.monthlyUserSummariesAffected,
    monthlyBranchSummariesAffected: preview.monthlyBranchSummariesAffected,
    monthlyChainSummariesAffected: preview.monthlyChainSummariesAffected,
    importBatchesAffected: preview.importBatchesAffected,
    importIssuesAffected: preview.importIssuesAffected,
    monthKeysAffected: preview.monthKeysAffected,
    dateRangeAffected: preview.dateRangeAffected
  };
}

function toMaintenanceResult(preview: MaintenancePreview) {
  return {
    ...safeMaintenancePreview(preview),
    status: AttendanceImportStatus.COMPLETED
  };
}
