import type { Prisma, UserRole } from "@prisma/client";
import {
  AttendanceArchiveStatus,
  AttendanceIssueSeverity,
  AttendanceIssueType,
  AttendanceMatchKeyType,
  AttendanceMatchedRole,
  AttendanceRecordStatus
} from "@prisma/client";

export type AttendanceMatchOutcome =
  | "MATCHED_PICKER"
  | "MATCHED_CHAMP"
  | "UNMATCHED_IDENTIFIER"
  | "AMBIGUOUS_IDENTIFIER_MATCH"
  | "UNSUPPORTED_ROLE";

export type AttendanceMatchedUser = {
  id: string;
  role: UserRole;
  shopperId: string | null;
  ibsId: string | null;
  joiningDate: Date | null;
};

export type AttendanceMatchResult = {
  outcome: AttendanceMatchOutcome;
  user: AttendanceMatchedUser | null;
  matchedRole: AttendanceMatchedRole | null;
  matchKeyType: AttendanceMatchKeyType | null;
};

export type ParsedAttendanceRow = {
  rowNumber: number;
  rawName: string | null;
  identifier: string;
  rawDesignation: string | null;
  department: string | null;
  division: string;
  subDivision: string | null;
  rawLocation: string | null;
  rawRole: string | null;
  jobType: string | null;
  employeeCurrentStatus: string | null;
  shiftName: string | null;
  attendanceDate: Date | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  actualCheckInAt: Date | null;
  actualCheckOutAt: Date | null;
  totalHoursInShift: number | null;
  actualWorkDurationHours: number | null;
  rawStatus: string | null;
};

export type AttendanceIssueDraft = {
  severity: AttendanceIssueSeverity;
  type: AttendanceIssueType;
  rowNumber?: number | null;
  identifier?: string | null;
  attendanceDate?: Date | null;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

export type AttendanceParseResult = {
  rows: ParsedAttendanceRow[];
  issues: AttendanceIssueDraft[];
};

export type AttendanceDailyCalculationInput = {
  status: string | null;
  shiftName: string | null;
  scheduledStartAt: Date | null;
  actualCheckInAt: Date | null;
  actualWorkDurationHours: number | null;
};

export type AttendanceDailyMetrics = {
  status: AttendanceRecordStatus;
  lateMinutes: number;
  lateLevel1Over15: boolean;
  lateLevel2From31To45: boolean;
  lateLevel3Over45: boolean;
  isAbsent: boolean;
  isOnLeave: boolean;
  isAnnualLeave: boolean;
  isMedicalLeave: boolean;
  isOffDay: boolean;
  isUnder8Hours: boolean;
  isOver15Hours: boolean;
  isWorkedShift: boolean;
};

export type AttendanceAssignmentSnapshot = {
  assignmentVendorId: string | null;
  assignmentChainId: string | null;
};

export type AttendanceSummaryRecord = {
  userId: string;
  identifier: string;
  role: AttendanceMatchedRole;
  matchKeyType: AttendanceMatchKeyType;
  monthKey: string;
  attendanceDate: Date;
  assignmentVendorId: string | null;
  assignmentChainId: string | null;
  actualWorkDurationHours: number | null;
  lateMinutes: number;
  lateLevel1Over15: boolean;
  lateLevel2From31To45: boolean;
  lateLevel3Over45: boolean;
  isAbsent: boolean;
  isOnLeave: boolean;
  isAnnualLeave: boolean;
  isMedicalLeave: boolean;
  isOffDay: boolean;
  isUnder8Hours: boolean;
  isOver15Hours: boolean;
  isWorkedShift: boolean;
  userJoiningDate: Date | null;
};

export type AttendanceMonthlyUserSummaryDraft = {
  monthKey: string;
  periodFrom: Date;
  periodTo: Date;
  userId: string;
  identifier: string;
  role: AttendanceMatchedRole;
  matchKeyType: AttendanceMatchKeyType;
  assignmentVendorId: string | null;
  assignmentChainId: string | null;
  totalShiftsNeeded: number;
  totalCreatedShifts: number;
  missingShifts: number;
  workedShiftCount: number;
  totalWorkedHours: number;
  lateMinutesTotal: number;
  lateLevel1Over15Count: number;
  lateLevel2From31To45Count: number;
  lateLevel3Over45Count: number;
  absentCount: number;
  onLeaveCount: number;
  annualLeaveCount: number;
  medicalLeaveCount: number;
  offDayCount: number;
  under8HoursCount: number;
  over15HoursCount: number;
  sourceDailyRecordsAvailable: boolean;
  archiveStatus: AttendanceArchiveStatus;
};

export type AttendanceMonthlyBranchSummaryDraft = {
  monthKey: string;
  periodFrom: Date;
  periodTo: Date;
  vendorId: string;
  chainId: string;
  pickerCount: number;
  totalShiftsNeeded: number;
  totalCreatedShifts: number;
  missingShifts: number;
  workedShiftCount: number;
  totalWorkedHours: number;
  lateMinutesTotal: number;
  lateLevel1Over15Count: number;
  lateLevel2From31To45Count: number;
  lateLevel3Over45Count: number;
  absentCount: number;
  onLeaveCount: number;
  annualLeaveCount: number;
  medicalLeaveCount: number;
  offDayCount: number;
  under8HoursCount: number;
  over15HoursCount: number;
};

export type AttendanceMonthlyChainSummaryDraft = {
  monthKey: string;
  periodFrom: Date;
  periodTo: Date;
  chainId: string;
  branchCount: number;
  pickerCount: number;
  totalShiftsNeeded: number;
  totalCreatedShifts: number;
  missingShifts: number;
  workedShiftCount: number;
  totalWorkedHours: number;
  lateMinutesTotal: number;
  lateLevel1Over15Count: number;
  lateLevel2From31To45Count: number;
  lateLevel3Over45Count: number;
  absentCount: number;
  onLeaveCount: number;
  annualLeaveCount: number;
  medicalLeaveCount: number;
  offDayCount: number;
  under8HoursCount: number;
  over15HoursCount: number;
};

export type AttendanceMonthlySummaryBuildResult = {
  userSummaries: AttendanceMonthlyUserSummaryDraft[];
  branchSummaries: AttendanceMonthlyBranchSummaryDraft[];
  chainSummaries: AttendanceMonthlyChainSummaryDraft[];
};

export type AttendanceImportSummary = {
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
};

