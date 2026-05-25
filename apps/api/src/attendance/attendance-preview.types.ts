import type {
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  UserRole
} from "@prisma/client";

export interface AttendanceMatchedUser {
  id: string;
  shopperId: string;
  role: UserRole;
  nameEn: string;
}

export interface AttendanceUserLookup {
  findByShopperIds(shopperIds: string[]): Promise<AttendanceMatchedUser[]>;
}

export interface AttendanceValidationOptions {
  uploadDate: Date | string;
  rowsPreviewLimit?: number;
  userLookup?: AttendanceUserLookup;
}

export interface AttendanceParsedWorkbook {
  headers: string[];
  rows: AttendanceParsedRow[];
}

export interface AttendanceParsedRow {
  rawRowNumber: number;
  identifier: string | null;
  division: string | null;
  shiftDate: string | null;
  shiftDateValid: boolean;
  shiftName: string | null;
  scheduledStartTime: string | null;
  scheduledStartTimeValid: boolean;
  scheduledEndTime: string | null;
  scheduledEndTimeValid: boolean;
  breakDurationMins: number | null;
  breakDurationMinsValid: boolean;
  scheduledShiftHours: number | null;
  scheduledShiftHoursValid: boolean;
  actualCheckinTime: string | null;
  actualCheckinTimeValid: boolean;
  actualCheckoutTime: string | null;
  actualCheckoutTimeValid: boolean;
  actualWorkDurationHours: number | null;
  actualWorkDurationHoursValid: boolean;
  sourceStatus: string | null;
  sourceName: string | null;
  sourceDesignation: string | null;
  sourceSubDivision: string | null;
  sourceLocation: string | null;
  sourceLocationCode: string | null;
}

export interface AttendancePreviewIssue {
  rowNumber: number | null;
  shopperId: string | null;
  severity: AttendanceIssueSeverity;
  issueCode: AttendanceIssueCode;
  fieldName: string | null;
  message: string;
  resolutionStatus: AttendanceIssueResolutionStatus;
}

export interface AttendanceRowsPreviewItem {
  rawRowNumber: number;
  identifier: string | null;
  shiftDate: string | null;
  division: string | null;
  matchStatus: "MATCHED_PICKER" | "UNMATCHED_IDENTIFIER" | "EXCLUDED_NOT_PICKER" | "EXCLUDED_NON_EGYPT" | "NOT_EVALUATED";
  issuesCount: number;
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
