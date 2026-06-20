import type { AttendanceImportMode, UserRole } from "@prisma/client";

export interface ImportJobActor {
  id: string;
  role: UserRole;
}

export interface AttendanceImportJobData {
  kind: "ATTENDANCE";
  batchId: string;
  filePath: string;
  actor: ImportJobActor;
  duplicateResolutionRowNumbers?: number[];
  fileName: string;
  importMode?: AttendanceImportMode | string;
  periodMonth?: string;
  uploadDate?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface OrdersKpiImportJobData {
  kind: "ORDERS_KPI";
  batchId: string;
  filePath: string;
  actor: ImportJobActor;
  fileName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type ExcelImportJobData =
  | AttendanceImportJobData
  | OrdersKpiImportJobData;

export interface QueuedImportResponse {
  batchId: string;
  jobId: string;
  status: "PENDING";
}

export interface StoredImportFile {
  originalname?: string;
  path?: string;
  size?: number;
}
