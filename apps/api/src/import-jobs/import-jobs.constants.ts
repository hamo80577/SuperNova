export const EXCEL_IMPORT_QUEUE = "excel-imports";
export const ATTENDANCE_IMPORT_JOB = "attendance-preview";
export const ORDERS_KPI_IMPORT_JOB = "orders-kpi-preview";

export const IMPORT_JOB_ATTEMPTS = 3;
export const IMPORT_WORKER_CONCURRENCY = 1;
export const IMPORT_WORKER_LOCK_DURATION_MS = 10 * 60 * 1000;

export function excelImportJobOptions(jobId: string): JobsOptions {
  return {
    jobId,
    attempts: IMPORT_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: { age: 604_800, count: 5_000 }
  };
}
import type { JobsOptions } from "bullmq";
