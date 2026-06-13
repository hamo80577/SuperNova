import type {
  AttendanceCalculatedStatus,
  AttendanceIdentifierType,
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  AttendanceLateBucket,
  AttendanceLeaveType,
  AttendanceAssignmentMismatchStatus,
  AttendanceLocationMappingStatus,
  AttendanceMatchStatus,
  AttendancePersonRole
} from "@prisma/client";

export interface AttendanceCalculationInput {
  periodMonth: string;
  calculatedAt?: Date | string;
  rows: AttendanceCalculationInputRow[];
}

export interface AttendanceCalculationInputRow {
  periodMonth: string;
  shiftDate: string;
  shopperId: string | null;
  personRole?: AttendancePersonRole;
  identifierType?: AttendanceIdentifierType;
  identifierValue?: string;
  personNameSnapshot?: string;
  userId: string;
  pickerNameSnapshot: string;
  sourceName: string | null;
  sourceDesignation: string | null;
  division: string;
  sourceSubDivision: string | null;
  sourceLocation: string | null;
  sourceLocationCode: string | null;
  reportedVendorId: string | null;
  reportedChainId: string | null;
  reportedLocationCode: string | null;
  reportedLocationName: string | null;
  reportedLocationRaw: string | null;
  shiftLocationCode: string | null;
  shiftLocationName: string | null;
  shiftLocationRaw: string | null;
  locationMappingStatus: AttendanceLocationMappingStatus;
  assignmentMismatchStatus: AttendanceAssignmentMismatchStatus;
  shiftName: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  scheduledShiftHours: number | null;
  breakDurationMins: number | null;
  actualCheckinTime: string | null;
  actualCheckoutTime: string | null;
  actualWorkDurationHours: number | null;
  sourceStatus: string | null;
  matchStatus?: AttendanceMatchStatus;
  rawRowNumber: number;
  issuesCount?: number;
}

export interface AttendanceDailyCalculationRecord {
  periodMonth: string;
  shiftDate: string;
  shopperId: string | null;
  personRole: AttendancePersonRole;
  identifierType: AttendanceIdentifierType;
  identifierValue: string;
  personNameSnapshot: string;
  userId: string;
  pickerNameSnapshot: string;
  sourceName: string | null;
  sourceDesignation: string | null;
  division: string;
  sourceSubDivision: string | null;
  sourceLocation: string | null;
  sourceLocationCode: string | null;
  reportedVendorId: string | null;
  reportedChainId: string | null;
  reportedLocationCode: string | null;
  reportedLocationName: string | null;
  reportedLocationRaw: string | null;
  shiftLocationCode: string | null;
  shiftLocationName: string | null;
  shiftLocationRaw: string | null;
  locationMappingStatus: AttendanceLocationMappingStatus;
  assignmentMismatchStatus: AttendanceAssignmentMismatchStatus;
  shiftName: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  scheduledShiftHours: number | null;
  breakDurationMins: number | null;
  actualCheckinTime: string | null;
  actualCheckoutTime: string | null;
  actualWorkDurationHours: number | null;
  sourceStatus: string | null;
  calculatedStatus: AttendanceCalculatedStatus;
  rawLateMins: number | null;
  graceMins: number | null;
  chargeableLateMins: number | null;
  lateBucket: AttendanceLateBucket | null;
  isLate: boolean;
  isOnTime: boolean;
  isAbsent: boolean;
  isOffDay: boolean;
  isOnLeave: boolean;
  leaveType: AttendanceLeaveType | null;
  isAnnualLeave: boolean;
  isMedicalLeave: boolean;
  isWorkingDay: boolean;
  isUnder8Hours: boolean;
  isOver15Hours: boolean;
  matchStatus: AttendanceMatchStatus;
  rawRowNumber: number;
  rowHash: string;
  issuesCount: number;
}

export interface AttendancePickerMonthlyCalculationSummary {
  periodMonth: string;
  shopperId: string | null;
  personRole: AttendancePersonRole;
  identifierType: AttendanceIdentifierType;
  identifierValue: string;
  personNameSnapshot: string;
  userId: string;
  pickerNameSnapshot: string;
  totalScheduledRows: number;
  totalWorkingDays: number;
  onTimeDays: number;
  lateDays: number;
  totalRawLateMins: number;
  totalChargeableLateMins: number;
  late1Count: number;
  late2Count: number;
  late3Count: number;
  absentCount: number;
  leaveCount: number;
  annualLeaveCount: number;
  medicalLeaveCount: number;
  otherLeaveCount: number;
  offDayCount: number;
  under8HoursCount: number;
  over15HoursCount: number;
  firstShiftDate: string | null;
  lastShiftDate: string | null;
  lastCalculatedAt: string;
}

export interface AttendanceCalculationIssue {
  rowNumber: number | null;
  shopperId: string | null;
  severity: AttendanceIssueSeverity;
  issueCode: AttendanceIssueCode;
  fieldName: string | null;
  message: string;
  resolutionStatus: AttendanceIssueResolutionStatus;
}

export interface AttendanceCalculationResult {
  dailyRecords: AttendanceDailyCalculationRecord[];
  monthlySummaries: AttendancePickerMonthlyCalculationSummary[];
  issues: AttendanceCalculationIssue[];
}
