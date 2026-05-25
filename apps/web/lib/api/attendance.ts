import { apiGet } from "./request";

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
  return `/attendance/reports/daily${serialized ? `?${serialized}` : ""}`;
}

export const attendanceApi = {
  dailyReport(query: AttendanceDailyReportQuery) {
    return apiGet<AttendanceDailyReportResponse>(
      buildAttendanceDailyReportPath(query)
    );
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
