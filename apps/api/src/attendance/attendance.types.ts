import type { Prisma, UserRole } from "@prisma/client";
import {
  AttendanceArchiveStatus,
  AttendanceImportMode,
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

export type AttendanceLocationParseResult = {
  vendorExternalId: string | null;
  displayName: string | null;
  outcome: "MAPPED_LOCATION_CODE" | "UNMAPPED_LOCATION_CODE";
};

export type HistoricalAssignmentBackfillNoticeReason =
  | "UNMAPPED_LOCATION_CODE"
  | "UNMATCHED_IDENTIFIER"
  | "AMBIGUOUS_IDENTIFIER_MATCH"
  | "UNSUPPORTED_ROLE"
  | "MULTIPLE_LOCATIONS_SAME_DATE"
  | "EXISTING_ASSIGNMENT_DIFFERENT_VENDOR"
  | "INVALID_PROPOSAL"
  | "OVERLAPPING_ASSIGNMENT";

export type HistoricalAssignmentBackfillNotice = {
  rowNumber?: number | null;
  attendanceDate?: Date | null;
  identifier?: string | null;
  location?: string | null;
  reason: HistoricalAssignmentBackfillNoticeReason;
  message: string;
};

export type HistoricalAssignmentBackfillProposal = {
  pickerId: string;
  identifier: string;
  vendorId: string;
  vendorExternalId: string;
  vendorName: string | null;
  chainId: string;
  proposedStartDate: Date;
  proposedEndDate: Date;
  source: "ATTENDANCE_BACKFILL";
  evidenceCount: number;
};

export type PreviewHistoricalAssignmentBackfillInput = {
  rows?: ParsedAttendanceRow[];
  buffer?: Buffer;
  periodFrom: Date;
  periodTo: Date;
  createdById: string;
  mode: AttendanceImportMode;
  referenceDate?: Date;
};

export type HistoricalAssignmentBackfillPreview = {
  totalRowsAnalyzed: number;
  matchedPickers: number;
  ignoredChampRows: number;
  unmappedLocationCount: number;
  conflictCount: number;
  proposalsCount: number;
  proposals: HistoricalAssignmentBackfillProposal[];
  warnings: HistoricalAssignmentBackfillNotice[];
  conflicts: HistoricalAssignmentBackfillNotice[];
};

export type ConfirmHistoricalAssignmentBackfillInput = {
  proposals: HistoricalAssignmentBackfillProposal[];
  confirmedById: string;
  importBatchId?: string | null;
  referenceDate?: Date;
};

export type ConfirmHistoricalAssignmentBackfillResult = {
  createdCount: number;
  skippedCount: number;
  conflictCount: number;
  createdAssignmentIds: string[];
  conflicts: HistoricalAssignmentBackfillNotice[];
};
