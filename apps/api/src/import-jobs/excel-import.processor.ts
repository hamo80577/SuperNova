import { readFile } from "node:fs/promises";

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import {
  AttendanceImportBatchStatus,
  OrdersKpiImportBatchStatus
} from "@prisma/client";
import type { Job } from "bullmq";

import { AttendanceImportService } from "../attendance/attendance-import.service";
import { OrdersKpisImportService } from "../orders-kpis/orders-kpis-import.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ATTENDANCE_IMPORT_JOB,
  EXCEL_IMPORT_QUEUE,
  IMPORT_WORKER_CONCURRENCY,
  IMPORT_WORKER_LOCK_DURATION_MS,
  ORDERS_KPI_IMPORT_JOB
} from "./import-jobs.constants";
import { ImportFileStorageService } from "./import-file-storage.service";
import type {
  AttendanceImportJobData,
  ExcelImportJobData,
  OrdersKpiImportJobData
} from "./import-jobs.types";

@Processor(EXCEL_IMPORT_QUEUE, {
  concurrency: IMPORT_WORKER_CONCURRENCY,
  lockDuration: IMPORT_WORKER_LOCK_DURATION_MS
})
export class ExcelImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExcelImportProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttendanceImportService)
    private readonly attendanceImportService: AttendanceImportService,
    @Inject(OrdersKpisImportService)
    private readonly ordersKpisImportService: OrdersKpisImportService,
    @Inject(ImportFileStorageService)
    private readonly fileStorage: ImportFileStorageService
  ) {
    super();
  }

  async process(job: Job<ExcelImportJobData>) {
    if (job.name === ATTENDANCE_IMPORT_JOB && job.data.kind === "ATTENDANCE") {
      return this.processAttendance(job as Job<AttendanceImportJobData>);
    }

    if (job.name === ORDERS_KPI_IMPORT_JOB && job.data.kind === "ORDERS_KPI") {
      return this.processOrdersKpi(job as Job<OrdersKpiImportJobData>);
    }

    throw new Error(`Unsupported Excel import job: ${job.name}.`);
  }

  private async processAttendance(job: Job<AttendanceImportJobData>) {
    const { batchId, filePath } = job.data;
    const startingStatus = await this.startAttendanceBatch(batchId, filePath);

    if (startingStatus !== AttendanceImportBatchStatus.PROCESSING) {
      await this.cleanupStoredFile(filePath, () =>
        this.prisma.attendanceImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        })
      );
      return { batchId, status: startingStatus };
    }

    try {
      const safePath = await this.fileStorage.assertReadable(filePath);
      const completedImport = await this.attendanceImportService.processQueuedImport(
        batchId,
        await readFile(safePath),
        {
          actor: job.data.actor,
          duplicateResolutionRowNumbers:
            job.data.duplicateResolutionRowNumbers,
          fileName: job.data.fileName,
          importMode: job.data.importMode,
          periodMonth: job.data.periodMonth,
          uploadDate: job.data.uploadDate,
          ipAddress: job.data.ipAddress,
          userAgent: job.data.userAgent
        }
      );
      await this.cleanupStoredFile(filePath, () =>
        this.prisma.attendanceImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        })
      );
      return { batchId, status: completedImport.status };
    } catch (error) {
      await this.recordAttendanceFailure(batchId, error);
      await this.cleanupOnFinalAttempt(job, filePath, () =>
        this.prisma.attendanceImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        })
      );
      throw error;
    }
  }

  private async processOrdersKpi(job: Job<OrdersKpiImportJobData>) {
    const { batchId, filePath } = job.data;
    const startingStatus = await this.startOrdersKpiBatch(batchId, filePath);

    if (startingStatus !== OrdersKpiImportBatchStatus.PROCESSING) {
      await this.cleanupStoredFile(filePath, () =>
        this.prisma.ordersKpiImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        })
      );
      return { batchId, status: startingStatus };
    }

    try {
      const safePath = await this.fileStorage.assertReadable(filePath);
      const completedImport = await this.ordersKpisImportService.processQueuedImport(
        batchId,
        await readFile(safePath),
        {
          actor: job.data.actor,
          fileName: job.data.fileName,
          ipAddress: job.data.ipAddress,
          userAgent: job.data.userAgent
        }
      );
      await this.cleanupStoredFile(filePath, () =>
        this.prisma.ordersKpiImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        })
      );
      return { batchId, status: completedImport.batch.status };
    } catch (error) {
      await this.recordOrdersKpiFailure(batchId, error);
      await this.cleanupOnFinalAttempt(job, filePath, () =>
        this.prisma.ordersKpiImportBatch.update({
          where: { id: batchId },
          data: { sourceFilePath: null }
        })
      );
      throw error;
    }
  }

  private async startAttendanceBatch(batchId: string, filePath: string) {
    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id: batchId },
      select: { failureReason: true, sourceFilePath: true, status: true }
    });

    if (!batch || batch.sourceFilePath !== filePath) {
      throw new Error(`Attendance import batch ${batchId} is not runnable.`);
    }

    const shouldProcess =
      batch.status === AttendanceImportBatchStatus.PENDING ||
      batch.status === AttendanceImportBatchStatus.PROCESSING ||
      (batch.status === AttendanceImportBatchStatus.FAILED &&
        batch.failureReason !== null);

    if (!shouldProcess) {
      return batch.status;
    }

    const processingBatch = await this.prisma.attendanceImportBatch.update({
      where: { id: batchId },
      data: {
        status: AttendanceImportBatchStatus.PROCESSING,
        failureReason: null
      }
    });
    return processingBatch.status;
  }

  private async startOrdersKpiBatch(batchId: string, filePath: string) {
    const batch = await this.prisma.ordersKpiImportBatch.findUnique({
      where: { id: batchId },
      select: { failureReason: true, sourceFilePath: true, status: true }
    });

    if (!batch || batch.sourceFilePath !== filePath) {
      throw new Error(`Orders KPI import batch ${batchId} is not runnable.`);
    }

    const shouldProcess =
      batch.status === OrdersKpiImportBatchStatus.PENDING ||
      batch.status === OrdersKpiImportBatchStatus.PROCESSING ||
      (batch.status === OrdersKpiImportBatchStatus.FAILED &&
        batch.failureReason !== null);

    if (!shouldProcess) {
      return batch.status;
    }

    const processingBatch = await this.prisma.ordersKpiImportBatch.update({
      where: { id: batchId },
      data: {
        status: OrdersKpiImportBatchStatus.PROCESSING,
        failureReason: null
      }
    });
    return processingBatch.status;
  }

  private async recordAttendanceFailure(batchId: string, error: unknown) {
    try {
      await this.prisma.attendanceImportBatch.update({
        where: { id: batchId },
        data: {
          status: AttendanceImportBatchStatus.FAILED,
          failureReason: errorMessage(error)
        }
      });
    } catch (databaseError) {
      this.logFailurePersistenceError("attendance", batchId, databaseError);
    }
  }

  private async recordOrdersKpiFailure(batchId: string, error: unknown) {
    try {
      await this.prisma.ordersKpiImportBatch.update({
        where: { id: batchId },
        data: {
          status: OrdersKpiImportBatchStatus.FAILED,
          failureReason: errorMessage(error)
        }
      });
    } catch (databaseError) {
      this.logFailurePersistenceError("Orders KPI", batchId, databaseError);
    }
  }

  private logFailurePersistenceError(
    importType: string,
    batchId: string,
    databaseError: unknown
  ) {
    this.logger.error(
      `Failed to persist ${importType} batch ${batchId} failure: ${errorMessage(databaseError)}`
    );
  }

  private async cleanupOnFinalAttempt(
    job: Job<ExcelImportJobData>,
    filePath: string,
    clearStoredPath: () => Promise<unknown>
  ) {
    const attempts = job.opts.attempts ?? 1;

    if (job.attemptsMade + 1 < attempts) {
      return;
    }

    await this.cleanupStoredFile(filePath, clearStoredPath);
  }

  private async cleanupStoredFile(
    filePath: string,
    clearStoredPath: () => Promise<unknown>
  ) {
    try {
      await this.fileStorage.remove(filePath);
      await clearStoredPath();
    } catch (error) {
      this.logger.error(
        `Failed to remove processed import file ${filePath}: ${errorMessage(error)}`
      );
    }
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown import error.";
  return message.slice(0, 2000);
}
