import type {
  AttendanceImportBatchStatus,
  UserRole
} from "@prisma/client";

import type { AttendanceValidationPreview } from "./attendance-preview.types";

export interface AttendanceImportActor {
  id: string;
  role: UserRole;
}

export interface AttendanceImportRequestContext {
  actor: AttendanceImportActor;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AttendanceImportPreviewOptions
  extends AttendanceImportRequestContext {
  fileName: string;
  uploadDate?: Date | string;
  rowsPreviewLimit?: number;
  now?: Date | string;
}

export interface AttendanceImportPreviewResult {
  batchId: string;
  status: AttendanceImportBatchStatus;
  canConfirm: boolean;
  preview: AttendanceValidationPreview;
  dailyRecordCount: number;
  monthlySummaryCount: number;
  issueCount: number;
}

export interface AttendanceImportConfirmOptions
  extends AttendanceImportRequestContext {
  now?: Date | string;
}

export interface AttendanceImportConfirmResult {
  batchId: string;
  periodMonth: string;
  status: AttendanceImportBatchStatus;
  previousActiveBatchId: string | null;
  confirmedAt: string;
}
