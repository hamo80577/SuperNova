import { apiFormRequest, apiGet, apiRequest } from "./request";

export type AttendanceImportMode =
  | "DAILY_MTD_OVERRIDE"
  | "HISTORICAL_BACKFILL"
  | "RECALCULATE_ONLY"
  | "DELETE_RANGE"
  | "DELETE_MONTH"
  | "DELETE_ALL"
  | "COMPRESS_OLD_MONTHS";

export type AttendanceImportStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED"
  | "CANCELLED";

export type AttendanceIssueSeverity = "INFO" | "WARNING" | "ERROR";

export interface AttendanceImportSummary {
  batchId: string;
  status: string;
  totalRows: number;
  egyptRows: number;
  ignoredRows: number;
  processedRows: number;
  matchedPickers: number;
  matchedChamps: number;
  unmatchedIdentifiers: number;
  duplicateRows: number;
  warningsCount: number;
  errorsCount: number;
  dailyRecordsStored: number;
  userSummariesStored: number;
  branchSummariesRebuilt: number;
  chainSummariesRebuilt: number;
}

export interface AttendanceImportListItem {
  id: string;
  createdAt: string;
  createdBy: {
    id: string;
    nameEn: string;
    role: string;
  };
  mode: AttendanceImportMode;
  status: AttendanceImportStatus;
  periodFrom: string;
  periodTo: string;
  fileName: string | null;
  totalRows: number;
  egyptRows: number;
  ignoredRows: number;
  matchedPickers: number;
  matchedChamps: number;
  warningsCount: number;
  errorsCount: number;
  dailyRecordsStored: number;
  userSummariesStored: number;
  branchSummariesRebuilt: number;
  chainSummariesRebuilt: number;
  completedAt: string | null;
  durationMs: number | null;
}

export interface AttendanceImportDetail extends AttendanceImportListItem {
  errorMessage: string | null;
  processedRows: number;
  duplicateRows: number;
  unmatchedIdentifiers: number;
  issueCounts: Record<AttendanceIssueSeverity, number>;
  retention: {
    dailyRecordsStored: number;
    userSummariesStored: number;
    branchSummariesRebuilt: number;
    chainSummariesRebuilt: number;
  };
}

export interface AttendanceImportIssue {
  id: string;
  severity: AttendanceIssueSeverity;
  type: string;
  rowNumber: number | null;
  identifier: string | null;
  attendanceDate: string | null;
  message: string;
  metadata: unknown;
  createdAt: string;
}

export interface AttendanceImportSampleUser {
  id: string;
  identifier: string;
  role: "PICKER" | "CHAMP";
  userDisplayName: string;
  totalCreatedShifts: number;
  totalShiftsNeeded: number;
  missingShifts: number;
  lateLevel1Over15Count: number;
  absentCount: number;
  under8HoursCount: number;
  over15HoursCount: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PageMeta;
}

export interface HistoricalAssignmentBackfillNotice {
  rowNumber?: number | null;
  attendanceDate?: string | null;
  identifier?: string | null;
  location?: string | null;
  reason: string;
  message: string;
}

export interface HistoricalAssignmentBackfillProposal {
  pickerId: string;
  identifier: string;
  vendorId: string;
  vendorExternalId: string;
  vendorName: string | null;
  chainId: string;
  proposedStartDate: string;
  proposedEndDate: string;
  source: "ATTENDANCE_BACKFILL";
  evidenceCount: number;
}

export interface HistoricalAssignmentBackfillPreview {
  totalRowsAnalyzed: number;
  matchedPickers: number;
  ignoredChampRows: number;
  unmappedLocationCount: number;
  conflictCount: number;
  proposalsCount: number;
  proposals: HistoricalAssignmentBackfillProposal[];
  warnings: HistoricalAssignmentBackfillNotice[];
  conflicts: HistoricalAssignmentBackfillNotice[];
}

export interface HistoricalAssignmentBackfillConfirmResult {
  createdCount: number;
  skippedCount: number;
  conflictCount: number;
  createdAssignmentIds: string[];
  conflicts: HistoricalAssignmentBackfillNotice[];
}

export type AttendanceMaintenanceOperation =
  | "DELETE_RANGE"
  | "DELETE_MONTH"
  | "DELETE_ALL"
  | "RECALCULATE_SUMMARIES"
  | "COMPRESS_OLD_MONTHS";

export type AttendanceMaintenanceArchiveStatus =
  | "ACTIVE_MTD"
  | "DETAILED"
  | "SUMMARY_ONLY"
  | "COMPRESSED"
  | "EMPTY";

export interface AttendanceMaintenanceMonth {
  monthKey: string;
  dailyRecordsCount: number;
  userSummariesCount: number;
  branchSummariesCount: number;
  chainSummariesCount: number;
  importBatchesCount: number;
  issuesCount: number;
  archiveStatus: AttendanceMaintenanceArchiveStatus;
  lastImportAt: string | null;
  lastImportStatus: AttendanceImportStatus | null;
}

export interface AttendanceMaintenancePreview {
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
  dateRangeAffected: {
    periodFrom: string | null;
    periodTo: string | null;
  };
}

export interface AttendanceMaintenanceResult extends AttendanceMaintenancePreview {
  status: AttendanceImportStatus;
  batchId?: string;
  userSummariesStored?: number;
  branchSummariesRebuilt?: number;
  chainSummariesRebuilt?: number;
}

export interface AttendanceMaintenancePreviewInput {
  operation: AttendanceMaintenanceOperation;
  periodFrom?: string;
  periodTo?: string;
  monthKey?: string;
  beforeMonthKey?: string;
}

export interface AttendanceImportUploadInput {
  file: File;
  periodFrom: string;
  periodTo: string;
  uploadMode: "DAILY_MTD_OVERRIDE" | "HISTORICAL_BACKFILL";
}

export interface HistoricalBackfillInput {
  file: File;
  periodFrom: string;
  periodTo: string;
}

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function attendanceFormData(input: AttendanceImportUploadInput) {
  const body = new FormData();
  body.set("file", input.file);
  body.set("periodFrom", input.periodFrom);
  body.set("periodTo", input.periodTo);
  body.set("uploadMode", input.uploadMode);
  return body;
}

function historicalFormData(input: HistoricalBackfillInput) {
  const body = new FormData();
  body.set("file", input.file);
  body.set("periodFrom", input.periodFrom);
  body.set("periodTo", input.periodTo);
  return body;
}

export const attendanceOperationsApi = {
  uploadAttendanceImport(input: AttendanceImportUploadInput) {
    return apiFormRequest<AttendanceImportSummary>(
      "/attendance-operations/imports",
      attendanceFormData(input)
    );
  },
  listAttendanceImports(params: {
    page?: number;
    pageSize?: number;
    status?: AttendanceImportStatus | "";
    mode?: AttendanceImportMode | "";
    periodFrom?: string;
    periodTo?: string;
  } = {}) {
    return apiGet<PaginatedResponse<AttendanceImportListItem>>(
      `/attendance-operations/imports${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        mode: params.mode,
        periodFrom: params.periodFrom,
        periodTo: params.periodTo
      })}`
    );
  },
  getAttendanceImport(id: string) {
    return apiGet<AttendanceImportDetail>(`/attendance-operations/imports/${id}`);
  },
  getAttendanceImportIssues(
    id: string,
    params: { page?: number; pageSize?: number; severity?: AttendanceIssueSeverity | "" } = {}
  ) {
    return apiGet<PaginatedResponse<AttendanceImportIssue>>(
      `/attendance-operations/imports/${id}/issues${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        severity: params.severity
      })}`
    );
  },
  getAttendanceImportSampleUsers(id: string) {
    return apiGet<{ items: AttendanceImportSampleUser[] }>(
      `/attendance-operations/imports/${id}/sample-users`
    );
  },
  previewHistoricalAssignmentBackfill(input: HistoricalBackfillInput) {
    return apiFormRequest<HistoricalAssignmentBackfillPreview>(
      "/attendance-operations/historical-assignments/preview",
      historicalFormData(input)
    );
  },
  confirmHistoricalAssignmentBackfill(
    input: HistoricalBackfillInput & { confirmationText: string }
  ) {
    const body = historicalFormData(input);
    body.set("confirmationText", input.confirmationText);
    return apiFormRequest<HistoricalAssignmentBackfillConfirmResult>(
      "/attendance-operations/historical-assignments/confirm",
      body
    );
  },
  listAttendanceMaintenanceMonths() {
    return apiGet<{ items: AttendanceMaintenanceMonth[] }>(
      "/attendance-operations/maintenance/months"
    );
  },
  previewAttendanceMaintenance(input: AttendanceMaintenancePreviewInput) {
    return apiRequest<AttendanceMaintenancePreview>(
      "/attendance-operations/maintenance/preview",
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  },
  deleteAttendanceRange(input: {
    periodFrom: string;
    periodTo: string;
    confirmationText: string;
  }) {
    return apiRequest<AttendanceMaintenanceResult>(
      "/attendance-operations/maintenance/delete-range",
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  },
  deleteAttendanceMonth(input: { monthKey: string; confirmationText: string }) {
    return apiRequest<AttendanceMaintenanceResult>(
      "/attendance-operations/maintenance/delete-month",
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  },
  deleteAllAttendanceData(input: { confirmationText: string }) {
    return apiRequest<AttendanceMaintenanceResult>(
      "/attendance-operations/maintenance/delete-all",
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  },
  recalculateAttendanceSummaries(input: {
    periodFrom?: string;
    periodTo?: string;
    monthKey?: string;
    confirmationText: string;
  }) {
    return apiRequest<AttendanceMaintenanceResult>(
      "/attendance-operations/maintenance/recalculate",
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  },
  compressOldAttendanceMonths(input: {
    beforeMonthKey?: string;
    confirmationText: string;
  }) {
    return apiRequest<AttendanceMaintenanceResult>(
      "/attendance-operations/maintenance/compress-old-months",
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  }
};
