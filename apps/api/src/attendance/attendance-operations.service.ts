import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AttendanceImportMode,
  AttendanceImportStatus,
  AttendanceIssueSeverity,
  Prisma
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceHistoricalAssignmentBackfillService } from "./attendance-historical-assignment-backfill.service";
import { AttendanceImportService } from "./attendance-import.service";
import type { ConfirmHistoricalAssignmentBackfillResult } from "./attendance.types";

export const HISTORICAL_ASSIGNMENT_CONFIRMATION_TEXT =
  "CREATE HISTORICAL ASSIGNMENTS";

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
