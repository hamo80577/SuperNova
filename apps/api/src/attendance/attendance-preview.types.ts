import type {
  AttendanceIdentifierType,
  AttendanceImportMode,
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  AttendanceLocationMappingStatus,
  AttendancePersonRole,
  UserRole
} from "@prisma/client";

export interface AttendanceMatchedUser {
  id: string;
  role: UserRole;
  personRole: AttendancePersonRole;
  // shopperId for PICKER, ibsId for CHAMP — the value seen in the sheet Identifier column.
  identifier: string;
  identifierType: AttendanceIdentifierType;
  nameEn: string;
  branchName: string | null;
  vendorName: string | null;
}

export interface AttendanceUserLookup {
  findByIdentifiers(identifiers: string[]): Promise<AttendanceMatchedUser[]>;
}

export interface AttendanceValidationOptions {
  duplicateResolutionRowNumbers?: number[];
  importMode?: AttendanceImportMode | string;
  periodMonth?: string;
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
  shiftLocation: string | null;
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

export interface AttendanceDuplicateGroup {
  shopperId: string;
  userId: string | null;
  pickerName: string | null;
  branchName: string | null;
  vendorName: string | null;
  shiftDate: string;
  selectedRawRowNumber: number | null;
  options: AttendanceDuplicateOption[];
}

export interface AttendanceDuplicateOption {
  rawRowNumber: number;
  shiftName: string | null;
  sourceStatus: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualCheckinTime: string | null;
  actualCheckoutTime: string | null;
  actualWorkDurationHours: number | null;
  sourceLocation: string | null;
  sourceDesignation: string | null;
}

export interface AttendanceRowsPreviewItem {
  rawRowNumber: number;
  identifier: string | null;
  shiftDate: string | null;
  division: string | null;
  matchStatus:
    | "MATCHED_PICKER"
    | "MATCHED_CHAMP"
    | "AMBIGUOUS_IDENTIFIER"
    | "UNMATCHED_IDENTIFIER"
    | "EXCLUDED_NOT_PICKER"
    | "EXCLUDED_NON_EGYPT"
    | "NOT_EVALUATED";
  issuesCount: number;
}

export interface AttendanceValidationPreview {
  importMode: AttendanceImportMode;
  periodMonth: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  expectedCoverageEndDate: string;
  rowCount: number;
  egyptRows: number;
  nonEgyptRows: number;
  matchedPickerRows: number;
  matchedChampRows: number;
  ambiguousIdentifierRows: number;
  unmatchedRows: number;
  excludedNonPickerRows: number;
  errorRows: number;
  warningRows: number;
  mappedLocationRows: number;
  unmappedLocationRows: number;
  missingLocationCodeRows: number;
  activeAssignmentMismatchRows: number;
  locationShiftLocationDifferenceRows: number;
  rowsByReportedLocationCode: AttendanceReportedLocationSummary[];
  canConfirm: boolean;
  duplicateGroups: AttendanceDuplicateGroup[];
  issues: AttendancePreviewIssue[];
  rowsPreview: AttendanceRowsPreviewItem[];
}

export interface AttendanceReportedLocationSummary {
  code: string | null;
  name: string | null;
  vendorId: string | null;
  vendorName: string | null;
  chainId: string | null;
  chainName: string | null;
  rowCount: number;
  mappingStatus: AttendanceLocationMappingStatus;
}
