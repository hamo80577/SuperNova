import { apiGet, apiRequest, clearApiCache } from "./request";

export type AttendanceCalculatedStatus =
  | "ON_TIME"
  | "LATE"
  | "ABSENT"
  | "OFF_DAY"
  | "ANNUAL_LEAVE"
  | "MEDICAL_LEAVE"
  | "OTHER_LEAVE"
  | "EXCLUDED_NON_EGYPT"
  | "UNMATCHED_IDENTIFIER"
  | "EXCLUDED_NOT_PICKER"
  | "INVALID_OR_MISSING_ATTENDANCE_DATA";

export type AttendanceLateBucket = "NONE" | "LATE_1" | "LATE_2" | "LATE_3";

export type AttendanceLeaveType =
  | "ANNUAL_LEAVE"
  | "MEDICAL_LEAVE"
  | "OTHER_LEAVE";

export interface AttendanceDailyReportQuery {
  periodMonth?: string;
  dateFrom?: string;
  dateTo?: string;
  shopperId?: string;
  pickerSearch?: string;
  status?: AttendanceCalculatedStatus | "";
  lateOnly?: boolean;
  absentOnly?: boolean;
  onLeaveOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AttendanceDailyReportResponse {
  periodMonth: string;
  activeBatchId: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  expectedCoverageEndDate: string | null;
  pagination: AttendanceDailyReportPagination;
  summary: AttendanceDailyReportSummary;
  rows: AttendanceDailyReportRow[];
}

export interface AttendanceDailyReportPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface AttendanceDailyReportSummary {
  totalRows: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  offDayCount: number;
  under8HoursCount: number;
  over15HoursCount: number;
  totalRawLateMins: number;
  totalChargeableLateMins: number;
}

export interface AttendanceDailyReportRow {
  id: string;
  pickerName: string;
  shopperId: string;
  userId: string;
  shiftDate: string;
  shiftName: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualCheckinTime: string | null;
  actualCheckoutTime: string | null;
  actualWorkDurationHours: number | null;
  calculatedStatus: AttendanceCalculatedStatus;
  rawLateMins: number | null;
  chargeableLateMins: number | null;
  lateBucket: AttendanceLateBucket | null;
  leaveType: AttendanceLeaveType | null;
  isWorkingDay: boolean;
  isUnder8Hours: boolean;
  isOver15Hours: boolean;
  sourceLocation: string | null;
  sourceDesignation: string | null;
  issuesCount: number;
}

export type AttendanceImportBatchStatus =
  | "UPLOADED"
  | "VALIDATED"
  | "CONFIRMED"
  | "ACTIVE"
  | "REPLACED"
  | "FAILED"
  | "LOCKED";

export type AttendanceIssueSeverity = "ERROR" | "WARNING";

export type AttendanceIssueResolutionStatus = "OPEN" | "IGNORED" | "RESOLVED";

export type AttendanceMatchStatus =
  | "MATCHED_PICKER"
  | "UNMATCHED_IDENTIFIER"
  | "EXCLUDED_NOT_PICKER"
  | "EXCLUDED_NON_EGYPT"
  | "NOT_EVALUATED";

export interface AttendanceImportPreviewOptions {
  uploadDate?: string;
}

export interface AttendanceImportPreviewResponse {
  batchId: string;
  status: AttendanceImportBatchStatus;
  canConfirm: boolean;
  preview: AttendanceValidationPreview;
  dailyRecordCount: number;
  monthlySummaryCount: number;
  issueCount: number;
}

export interface AttendanceValidationPreview {
  periodMonth: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  expectedCoverageEndDate: string;
  rowCount: number;
  egyptRows: number;
  nonEgyptRows: number;
  matchedPickerRows: number;
  unmatchedRows: number;
  excludedNonPickerRows: number;
  errorRows: number;
  warningRows: number;
  canConfirm: boolean;
  issues: AttendancePreviewIssue[];
  rowsPreview: AttendanceRowsPreviewItem[];
}

export interface AttendancePreviewIssue {
  rowNumber: number | null;
  shopperId: string | null;
  severity: AttendanceIssueSeverity;
  issueCode: string;
  fieldName: string | null;
  message: string;
  resolutionStatus: AttendanceIssueResolutionStatus;
}

export interface AttendanceRowsPreviewItem {
  rawRowNumber: number;
  identifier: string | null;
  shiftDate: string | null;
  division: string | null;
  matchStatus: AttendanceMatchStatus;
  issuesCount: number;
}

export interface AttendanceImportConfirmResponse {
  batchId: string;
  periodMonth: string;
  status: AttendanceImportBatchStatus;
  previousActiveBatchId: string | null;
  confirmedAt: string;
}

const attendanceDailyReportPathPrefix = "/attendance/reports/daily";

export function buildAttendanceDailyReportPath(
  query: AttendanceDailyReportQuery
) {
  const params = new URLSearchParams();

  setString(params, "periodMonth", query.periodMonth);
  setString(params, "dateFrom", query.dateFrom);
  setString(params, "dateTo", query.dateTo);
  setString(params, "shopperId", query.shopperId);
  setString(params, "pickerSearch", query.pickerSearch);
  setString(params, "status", query.status);
  setBoolean(params, "lateOnly", query.lateOnly);
  setBoolean(params, "absentOnly", query.absentOnly);
  setBoolean(params, "onLeaveOnly", query.onLeaveOnly);
  setNumber(params, "page", query.page);
  setNumber(params, "pageSize", query.pageSize);

  const serialized = params.toString();
  return `${attendanceDailyReportPathPrefix}${serialized ? `?${serialized}` : ""}`;
}

export function buildAttendanceImportPreviewFormData(
  file: File,
  options: AttendanceImportPreviewOptions = {}
) {
  const formData = new FormData();
  formData.set("file", file);
  setFormString(formData, "uploadDate", options.uploadDate);
  return formData;
}

export function buildAttendanceImportConfirmPath(batchId: string) {
  return `/attendance/imports/${encodeURIComponent(batchId)}/confirm`;
}

export function clearAttendanceDailyReportCache() {
  clearApiCache(attendanceDailyReportPathPrefix);
}

export const attendanceApi = {
  dailyReport(query: AttendanceDailyReportQuery) {
    return apiGet<AttendanceDailyReportResponse>(
      buildAttendanceDailyReportPath(query)
    );
  },
  clearDailyReportCache() {
    clearAttendanceDailyReportCache();
  },
  previewImport(file: File, options: AttendanceImportPreviewOptions = {}) {
    return apiRequest<AttendanceImportPreviewResponse>(
      "/attendance/imports/preview",
      {
        body: buildAttendanceImportPreviewFormData(file, options),
        method: "POST"
      }
    );
  },
  async confirmImport(batchId: string) {
    const result = await apiRequest<AttendanceImportConfirmResponse>(
      buildAttendanceImportConfirmPath(batchId),
      {
        method: "POST"
      }
    );
    clearAttendanceDailyReportCache();
    return result;
  }
};

function setString(
  params: URLSearchParams,
  key: string,
  value: string | undefined
) {
  const text = value?.trim();
  if (text) {
    params.set(key, text);
  }
}

function setBoolean(
  params: URLSearchParams,
  key: string,
  value: boolean | undefined
) {
  if (value) {
    params.set(key, "true");
  }
}

function setNumber(
  params: URLSearchParams,
  key: string,
  value: number | undefined
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    params.set(key, String(value));
  }
}

function setFormString(
  formData: FormData,
  key: string,
  value: string | undefined
) {
  const text = value?.trim();
  if (text) {
    formData.set(key, text);
  }
}
