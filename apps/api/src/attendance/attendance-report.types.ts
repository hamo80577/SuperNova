import type {
  AttendanceCalculatedStatus,
  AttendanceLateBucket,
  AttendanceLeaveType
} from "@prisma/client";

export interface AttendanceDailyReportQuery {
  periodMonth?: string;
  dateFrom?: string;
  dateTo?: string;
  shopperId?: string;
  pickerSearch?: string;
  status?: AttendanceCalculatedStatus;
  lateOnly?: boolean | string;
  absentOnly?: boolean | string;
  onLeaveOnly?: boolean | string;
  page?: number | string;
  pageSize?: number | string;
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
