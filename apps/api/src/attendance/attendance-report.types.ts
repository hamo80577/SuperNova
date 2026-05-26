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
  analytics: AttendanceDailyReportAnalytics;
  pagination: AttendanceDailyReportPagination;
  summary: AttendanceDailyReportSummary;
  rows: AttendanceDailyReportRow[];
}

export interface AttendanceDailyReportAnalytics {
  range: AttendanceAnalyticsRange;
  attendanceRate: AttendanceRateMetric;
  attendanceMix: AttendanceAttendanceMix;
  lateBuckets: AttendanceLateBucketMetrics;
  averageLogHours: AttendanceAverageLogHoursMetric;
  performance: AttendancePerformanceMetrics;
}

export interface AttendanceAnalyticsRange {
  dateFrom: string;
  dateTo: string;
  days: number;
  comparisonDateFrom: string;
  comparisonDateTo: string;
}

export interface AttendanceMetricDelta {
  value: number | null;
  direction: "up" | "down" | "flat" | "neutral";
  unit: "percentage_point" | "percent";
  label: string;
}

export interface AttendanceSegmentMetric {
  count: number;
  percentage: number;
}

export interface AttendanceRateMetric {
  value: number;
  attendCount: number;
  totalShifts: number;
  delta: AttendanceMetricDelta;
}

export interface AttendanceAttendanceMix {
  attend: AttendanceSegmentMetric;
  onLeave: AttendanceSegmentMetric;
  absent: AttendanceSegmentMetric;
}

export interface AttendanceLateBucketMetrics {
  late1: AttendanceSegmentMetric;
  late2: AttendanceSegmentMetric;
  late3: AttendanceSegmentMetric;
  totalLateCount: number;
}

export interface AttendanceAverageLogHoursMetric {
  value: number | null;
  formattedValue: string;
  attendedShiftCount: number;
  delta: AttendanceMetricDelta;
}

export interface AttendancePerformanceMetrics {
  validShiftRate: AttendanceValidShiftRateMetric;
  problemShiftCount: AttendanceProblemShiftCountMetric;
  problemMix: AttendanceProblemMix;
}

export interface AttendanceValidShiftRateMetric {
  value: number;
  validShiftCount: number;
  totalShifts: number;
  delta: AttendanceMetricDelta;
}

export interface AttendanceProblemShiftCountMetric {
  value: number;
  delta: AttendanceMetricDelta;
}

export interface AttendanceProblemMix {
  all: AttendanceSegmentMetric;
  absent: AttendanceSegmentMetric;
  late: AttendanceSegmentMetric;
  under8: AttendanceSegmentMetric;
  over15: AttendanceSegmentMetric;
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
