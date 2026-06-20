import { randomUUID } from "node:crypto";

import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  AttendanceImportBatchStatus,
  AttendanceImportMode
} from "@prisma/client";
import type { Queue } from "bullmq";

import {
  ATTENDANCE_IMPORT_JOB,
  excelImportJobOptions,
  EXCEL_IMPORT_QUEUE,
} from "../import-jobs/import-jobs.constants";
import { ImportFileStorageService } from "../import-jobs/import-file-storage.service";
import type {
  AttendanceImportJobData,
  ExcelImportJobData,
  QueuedImportResponse,
  StoredImportFile
} from "../import-jobs/import-jobs.types";
import { PrismaService } from "../prisma/prisma.service";
import type { AttendanceImportPreviewOptions } from "./attendance-import.types";

@Injectable()
export class AttendanceImportQueueService {
  private readonly logger = new Logger(AttendanceImportQueueService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @InjectQueue(EXCEL_IMPORT_QUEUE)
    private readonly importQueue: Queue<ExcelImportJobData>,
    @Inject(ImportFileStorageService)
    private readonly fileStorage: ImportFileStorageService
  ) {}

  async enqueue(
    file: StoredImportFile,
    options: AttendanceImportPreviewOptions
  ): Promise<QueuedImportResponse> {
    const filePath = requireStoredFilePath(file);
    const batchId = randomUUID();
    const fileName = normalizeFileName(
      file.originalname ?? options.fileName ?? "attendance-import.xlsx"
    );
    const importMode = provisionalImportMode(options.importMode);
    const periodMonth = provisionalPeriodMonth(
      options.periodMonth,
      options.uploadDate
    );

    try {
      await this.prisma.attendanceImportBatch.create({
        data: {
          id: batchId,
          periodMonth,
          fileName,
          fileHash: "",
          importMode,
          uploadedByUserId: options.actor.id,
          status: AttendanceImportBatchStatus.PENDING,
          jobId: batchId,
          sourceFilePath: filePath,
          failureReason: null
        }
      });
    } catch (error) {
      await this.discardUploadedFile(filePath);
      throw error;
    }

    const jobData: AttendanceImportJobData = {
      kind: "ATTENDANCE",
      batchId,
      filePath,
      actor: options.actor,
      duplicateResolutionRowNumbers: options.duplicateResolutionRowNumbers,
      fileName,
      importMode: options.importMode,
      periodMonth: options.periodMonth,
      uploadDate: serializeDateInput(options.uploadDate),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    };

    try {
      await this.importQueue.add(
        ATTENDANCE_IMPORT_JOB,
        jobData,
        excelImportJobOptions(batchId)
      );
    } catch (error) {
      await this.recordQueueFailure(batchId, filePath, error);
      throw new ServiceUnavailableException(
        "Attendance import could not be queued. Try again later."
      );
    }

    return { batchId, jobId: batchId, status: "PENDING" };
  }

  async getStatus(batchId: string) {
    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        jobId: true,
        status: true,
        fileName: true,
        periodMonth: true,
        rowCount: true,
        errorRows: true,
        warningRows: true,
        previewResult: true,
        failureReason: true,
        updatedAt: true
      }
    });

    if (!batch) {
      throw new NotFoundException("Attendance import batch was not found.");
    }

    const { previewResult, ...statusResponse } = batch;

    return {
      ...statusResponse,
      hasPreviewResult: previewResult !== null
    };
  }

  private async recordQueueFailure(
    batchId: string,
    filePath: string,
    queueError: unknown
  ) {
    try {
      await this.prisma.attendanceImportBatch.update({
          where: { id: batchId },
          data: {
            status: AttendanceImportBatchStatus.FAILED,
            failureReason: queueFailureMessage(queueError)
          }
        });
    } catch (databaseError) {
      this.logger.error(
        `Failed to mark attendance batch ${batchId} after queue failure: ${errorMessage(databaseError)}`
      );
    }

    if (await this.discardUploadedFile(filePath)) {
      try {
        await this.prisma.attendanceImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        });
      } catch (databaseError) {
        this.logger.error(
          `Failed to clear attendance batch ${batchId} upload path: ${errorMessage(databaseError)}`
        );
      }
    }
  }

  private async discardUploadedFile(filePath: string) {
    try {
      await this.fileStorage.remove(filePath);
      return true;
    } catch (storageError) {
      this.logger.error(
        `Failed to remove attendance upload ${filePath}: ${errorMessage(storageError)}`
      );
      return false;
    }
  }
}

function requireStoredFilePath(file: StoredImportFile) {
  if (!file.path || !file.size) {
    throw new BadRequestException("Attendance file is required.");
  }

  return file.path;
}

function provisionalImportMode(value: AttendanceImportPreviewOptions["importMode"]) {
  return value === AttendanceImportMode.HISTORICAL_MONTH
    ? AttendanceImportMode.HISTORICAL_MONTH
    : AttendanceImportMode.MTD;
}

function provisionalPeriodMonth(
  periodMonth: string | undefined,
  uploadDate: Date | string | undefined
) {
  const normalizedPeriodMonth = periodMonth?.trim();
  if (normalizedPeriodMonth && /^\d{4}-\d{2}$/.test(normalizedPeriodMonth)) {
    return normalizedPeriodMonth;
  }

  const date = uploadDate ? new Date(uploadDate) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safeDate.getUTCFullYear()}-${String(safeDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeFileName(value: string) {
  const trimmed = value.trim();
  return (trimmed || "attendance-import.xlsx").slice(0, 255);
}

function serializeDateInput(value: Date | string | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function queueFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown queue error.";
  return `Queue dispatch failed: ${message}`.slice(0, 2000);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}
