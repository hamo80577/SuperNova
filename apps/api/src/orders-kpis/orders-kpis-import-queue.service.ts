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
import { OrdersKpiImportBatchStatus } from "@prisma/client";
import type { Queue } from "bullmq";

import {
  EXCEL_IMPORT_QUEUE,
  excelImportJobOptions,
  ORDERS_KPI_IMPORT_JOB
} from "../import-jobs/import-jobs.constants";
import { ImportFileStorageService } from "../import-jobs/import-file-storage.service";
import type {
  ExcelImportJobData,
  OrdersKpiImportJobData,
  QueuedImportResponse,
  StoredImportFile
} from "../import-jobs/import-jobs.types";
import { PrismaService } from "../prisma/prisma.service";
import type { OrdersKpiPreviewImportOptions } from "./orders-kpis.types";

@Injectable()
export class OrdersKpisImportQueueService {
  private readonly logger = new Logger(OrdersKpisImportQueueService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @InjectQueue(EXCEL_IMPORT_QUEUE)
    private readonly importQueue: Queue<ExcelImportJobData>,
    @Inject(ImportFileStorageService)
    private readonly fileStorage: ImportFileStorageService
  ) {}

  async enqueue(
    file: StoredImportFile,
    options: OrdersKpiPreviewImportOptions
  ): Promise<QueuedImportResponse> {
    const filePath = requireStoredFilePath(file);
    const batchId = randomUUID();
    const fileName = normalizeFileName(
      file.originalname ?? options.fileName ?? "orders-kpis-import.xlsx"
    );

    try {
      await this.prisma.ordersKpiImportBatch.create({
        data: {
          id: batchId,
          fileName,
          fileHash: "",
          uploadedByUserId: options.actor.id,
          status: OrdersKpiImportBatchStatus.PENDING,
          jobId: batchId,
          sourceFilePath: filePath,
          failureReason: null,
          coveredDates: []
        }
      });
    } catch (error) {
      await this.discardUploadedFile(filePath);
      throw error;
    }

    const jobData: OrdersKpiImportJobData = {
      kind: "ORDERS_KPI",
      batchId,
      filePath,
      actor: options.actor,
      fileName,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    };

    try {
      await this.importQueue.add(
        ORDERS_KPI_IMPORT_JOB,
        jobData,
        excelImportJobOptions(batchId)
      );
    } catch (error) {
      await this.recordQueueFailure(batchId, filePath, error);
      throw new ServiceUnavailableException(
        "Orders KPI import could not be queued. Try again later."
      );
    }

    return { batchId, jobId: batchId, status: "PENDING" };
  }

  async getStatus(batchId: string) {
    const batch = await this.prisma.ordersKpiImportBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        jobId: true,
        status: true,
        fileName: true,
        rowCount: true,
        confirmableRows: true,
        skippedRows: true,
        errorRows: true,
        warningRows: true,
        failureReason: true,
        updatedAt: true
      }
    });

    if (!batch) {
      throw new NotFoundException("Orders KPI import batch was not found.");
    }

    return batch;
  }

  private async recordQueueFailure(
    batchId: string,
    filePath: string,
    queueError: unknown
  ) {
    try {
      await this.prisma.ordersKpiImportBatch.update({
          where: { id: batchId },
          data: {
            status: OrdersKpiImportBatchStatus.FAILED,
            failureReason: queueFailureMessage(queueError)
          }
        });
    } catch (databaseError) {
      this.logger.error(
        `Failed to mark Orders KPI batch ${batchId} after queue failure: ${errorMessage(databaseError)}`
      );
    }

    if (await this.discardUploadedFile(filePath)) {
      try {
        await this.prisma.ordersKpiImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        });
      } catch (databaseError) {
        this.logger.error(
          `Failed to clear Orders KPI batch ${batchId} upload path: ${errorMessage(databaseError)}`
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
        `Failed to remove Orders KPI upload ${filePath}: ${errorMessage(storageError)}`
      );
      return false;
    }
  }
}

function requireStoredFilePath(file: StoredImportFile) {
  if (!file.path || !file.size) {
    throw new BadRequestException("Orders KPI file is required.");
  }

  return file.path;
}

function normalizeFileName(value: string) {
  const trimmed = value.trim();
  return (trimmed || "orders-kpis-import.xlsx").slice(0, 255);
}

function queueFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown queue error.";
  return `Queue dispatch failed: ${message}`.slice(0, 2000);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}
