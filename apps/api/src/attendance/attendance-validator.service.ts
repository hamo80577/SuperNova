import { Inject, Injectable } from "@nestjs/common";
import {
  AttendanceImportMode,
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  UserRole
} from "@prisma/client";

import { AttendanceParserService } from "./attendance-parser.service";
import type {
  AttendanceMatchedUser,
  AttendanceDuplicateGroup,
  AttendanceDuplicateOption,
  AttendanceParsedRow,
  AttendancePreviewIssue,
  AttendanceRowsPreviewItem,
  AttendanceUserLookup,
  AttendanceValidationOptions,
  AttendanceValidationPreview
} from "./attendance-preview.types";

const requiredHeaders = [
  "Identifier",
  "Division",
  "Shift Date",
  "Shift Name",
  "Shift Scheduled Start Time",
  "Shift Scheduled End Time",
  "Shift Break Duration (mins)",
  "Total Hours In Shift (hrs)",
  "Actual Checkin Time",
  "Actual Checkout Time",
  "Actual Work Duration (hrs)",
  "Status"
];

const recognizedStatuses = new Set([
  "PRESENT",
  "ON TIME",
  "LATE",
  "ABSENT",
  "ON LEAVE"
]);

@Injectable()
export class AttendanceValidatorService {
  constructor(
    @Inject(AttendanceParserService)
    private readonly parser: AttendanceParserService
  ) {}

  async validateWorkbook(
    buffer: Buffer,
    options: AttendanceValidationOptions
  ): Promise<AttendanceValidationPreview> {
    const workbook = await this.parser.parseWorkbook(buffer);
    const uploadDate = normalizeUploadDate(options.uploadDate);
    const issues: AttendancePreviewIssue[] = [];
    const rowIssueCounts = new Map<number, number>();
    const importMode = normalizeImportMode(
      options.importMode,
      issues,
      rowIssueCounts
    );
    const matchStatuses = new Map<
      number,
      AttendanceRowsPreviewItem["matchStatus"]
    >();

    for (const requiredHeader of requiredHeaders) {
      if (!workbook.headers.includes(requiredHeader)) {
        addIssue(issues, rowIssueCounts, fileIssue(
          AttendanceIssueCode.INVALID_REQUIRED_COLUMN,
          requiredHeader,
          `Missing required attendance column: ${requiredHeader}.`
        ));
      }
    }

    const usersByShopperId = await this.loadUsers(workbook.rows, options.userLookup);
    const validShiftDates = workbook.rows
      .map((row) => row.shiftDate)
      .filter((value): value is string => Boolean(value));
    const coverageStartDate = minDateOnly(validShiftDates);
    const coverageEndDate = maxDateOnly(validShiftDates);
    const periodMonths = new Set(validShiftDates.map((date) => date.slice(0, 7)));
    let periodMonth = coverageStartDate?.slice(0, 7) ?? null;
    let expectedCoverageEndDate = previousDateOnly(uploadDate);

    if (periodMonths.size > 1) {
      addIssue(issues, rowIssueCounts, fileIssue(
        AttendanceIssueCode.MULTIPLE_MONTHS_IN_FILE,
        "Shift Date",
        "Attendance file contains more than one period month."
      ));
    }

    if (importMode === AttendanceImportMode.MTD) {
      validateMtdCoverage({
        coverageStartDate,
        coverageEndDate,
        expectedCoverageEndDate,
        issues,
        periodMonthInput: options.periodMonth,
        rowIssueCounts,
        uploadDate,
        validShiftDates
      });
    } else {
      const historicalPeriodMonth = validateHistoricalPeriodMonth(
        options.periodMonth,
        uploadDate,
        issues,
        rowIssueCounts
      );

      if (historicalPeriodMonth) {
        periodMonth = historicalPeriodMonth;
        expectedCoverageEndDate = lastDateOfMonth(historicalPeriodMonth);
        validateHistoricalShiftDates(
          workbook.rows,
          historicalPeriodMonth,
          issues,
          rowIssueCounts
        );
      } else {
        periodMonth = null;
      }
    }

    let egyptRows = 0;
    let nonEgyptRows = 0;
    let matchedPickerRows = 0;
    let unmatchedRows = 0;
    let excludedNonPickerRows = 0;
    const duplicateTrackers = new Map<string, DuplicateTracker>();

    for (const row of workbook.rows) {
      matchStatuses.set(row.rawRowNumber, "NOT_EVALUATED");
      validateParsedFields(row, issues, rowIssueCounts);

      const isEgyptRow = isEgypt(row.division);

      if (!isEgyptRow) {
        nonEgyptRows += 1;
        matchStatuses.set(row.rawRowNumber, "EXCLUDED_NON_EGYPT");
        addIssue(issues, rowIssueCounts, rowIssue(row, {
          severity: AttendanceIssueSeverity.WARNING,
          issueCode: AttendanceIssueCode.NON_EGYPT_ROW,
          fieldName: "Division",
          message: "Only Egypt division rows are eligible for v1 calculation."
        }));
        continue;
      }

      egyptRows += 1;

      if (!row.identifier) {
        addIssue(issues, rowIssueCounts, rowIssue(row, {
          severity: AttendanceIssueSeverity.ERROR,
          issueCode: AttendanceIssueCode.MISSING_IDENTIFIER,
          fieldName: "Identifier",
          message: "Identifier is required for User.shopperId matching."
        }));
        continue;
      }

      const matchedUser = usersByShopperId.get(row.identifier);

      if (!matchedUser) {
        unmatchedRows += 1;
        matchStatuses.set(row.rawRowNumber, "UNMATCHED_IDENTIFIER");
        addIssue(issues, rowIssueCounts, rowIssue(row, {
          severity: AttendanceIssueSeverity.WARNING,
          issueCode: AttendanceIssueCode.UNMATCHED_IDENTIFIER,
          fieldName: "Identifier",
          message: "Identifier does not match a SuperNova User.shopperId."
        }));
        trackDuplicate(duplicateTrackers, unmatchedDuplicateInput(row, matchedUser));
        continue;
      }

      if (matchedUser.role !== UserRole.PICKER) {
        excludedNonPickerRows += 1;
        matchStatuses.set(row.rawRowNumber, "EXCLUDED_NOT_PICKER");
        addIssue(issues, rowIssueCounts, rowIssue(row, {
          severity: AttendanceIssueSeverity.WARNING,
          issueCode: AttendanceIssueCode.MATCHED_USER_NOT_PICKER,
          fieldName: "Identifier",
          message: "Matched SuperNova user is not role PICKER."
        }));
        continue;
      }

      matchedPickerRows += 1;
      matchStatuses.set(row.rawRowNumber, "MATCHED_PICKER");
      trackDuplicate(duplicateTrackers, matchedDuplicateInput(row, matchedUser));
    }

    const duplicateGroups = buildDuplicateGroups(
      duplicateTrackers,
      new Set(options.duplicateResolutionRowNumbers ?? []),
      issues,
      rowIssueCounts
    );

    const errorRows = countIssueRows(issues, AttendanceIssueSeverity.ERROR);
    const warningRows = countIssueRows(issues, AttendanceIssueSeverity.WARNING);

    return {
      importMode,
      periodMonth,
      coverageStartDate,
      coverageEndDate,
      expectedCoverageEndDate,
      rowCount: workbook.rows.length,
      egyptRows,
      nonEgyptRows,
      matchedPickerRows,
      unmatchedRows,
      excludedNonPickerRows,
      errorRows,
      warningRows,
      mappedLocationRows: 0,
      unmappedLocationRows: 0,
      missingLocationCodeRows: 0,
      activeAssignmentMismatchRows: 0,
      locationShiftLocationDifferenceRows: 0,
      rowsByReportedLocationCode: [],
      canConfirm: errorRows === 0,
      duplicateGroups,
      issues,
      rowsPreview: workbook.rows
        .slice(0, options.rowsPreviewLimit ?? 20)
        .map((row) => ({
          rawRowNumber: row.rawRowNumber,
          identifier: row.identifier,
          shiftDate: row.shiftDate,
          division: row.division,
          matchStatus: matchStatuses.get(row.rawRowNumber) ?? "NOT_EVALUATED",
          issuesCount: rowIssueCounts.get(row.rawRowNumber) ?? 0
        }))
    };
  }

  private async loadUsers(
    rows: AttendanceParsedRow[],
    overrideLookup?: AttendanceUserLookup
  ) {
    if (!overrideLookup) {
      return new Map<string, AttendanceMatchedUser>();
    }

    const shopperIds = Array.from(
      new Set(rows.map((row) => row.identifier).filter(Boolean) as string[])
    );
    const users = await overrideLookup.findByShopperIds(shopperIds);

    return new Map(users.map((user) => [user.shopperId, user]));
  }
}

type DuplicateTracker = {
  key: string;
  shopperId: string;
  userId: string | null;
  pickerName: string | null;
  branchName: string | null;
  vendorName: string | null;
  shiftDate: string;
  rows: AttendanceParsedRow[];
};

type DuplicateInput = Omit<DuplicateTracker, "rows"> & {
  row: AttendanceParsedRow;
};

function validateParsedFields(
  row: AttendanceParsedRow,
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>
) {
  if (!row.shiftDateValid) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_SHIFT_DATE,
      fieldName: "Shift Date",
      message: "Shift Date must be a valid date."
    }));
  }

  if (!row.scheduledStartTime || !row.scheduledStartTimeValid) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_TIME,
      fieldName: "Shift Scheduled Start Time",
      message: "Shift Scheduled Start Time must be a valid time."
    }));
  }

  if (!row.scheduledEndTime || !row.scheduledEndTimeValid) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_TIME,
      fieldName: "Shift Scheduled End Time",
      message: "Shift Scheduled End Time must be a valid time."
    }));
  }

  if (row.actualCheckinTimeValid === false || row.actualCheckoutTimeValid === false) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_TIME,
      fieldName: "Actual Checkin Time",
      message: "Actual check-in/check-out values must be valid times when present."
    }));
  }

  if (!row.breakDurationMinsValid) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_BREAK_DURATION,
      fieldName: "Shift Break Duration (mins)",
      message: "Shift Break Duration must be numeric when present."
    }));
  }

  if (!row.scheduledShiftHoursValid) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_SHIFT_DURATION,
      fieldName: "Total Hours In Shift (hrs)",
      message: "Total Hours In Shift must be numeric when present."
    }));
  }

  if (!row.actualWorkDurationHoursValid) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.INVALID_WORK_DURATION,
      fieldName: "Actual Work Duration (hrs)",
      message: "Actual Work Duration must be numeric when present."
    }));
  }

  if (hasUnknownStatus(row)) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.WARNING,
      issueCode: AttendanceIssueCode.UNKNOWN_STATUS,
      fieldName: "Status",
      message: "Source Status is not recognized for v1 attendance rules."
    }));
  }

  if (requiresCheckin(row) && !row.actualCheckinTime) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.MISSING_CHECKIN,
      fieldName: "Actual Checkin Time",
      message: "Actual Checkin Time is required for regular attendance rows."
    }));
  }
}

function addIssue(
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>,
  issue: AttendancePreviewIssue
) {
  issues.push(issue);

  if (issue.rowNumber !== null) {
    rowIssueCounts.set(
      issue.rowNumber,
      (rowIssueCounts.get(issue.rowNumber) ?? 0) + 1
    );
  }
}

function countIssueRows(
  issues: AttendancePreviewIssue[],
  severity: AttendanceIssueSeverity
) {
  const rowNumbers = new Set<number>();
  let fileIssues = 0;

  issues
    .filter((issue) => issue.severity === severity)
    .forEach((issue) => {
      if (issue.rowNumber === null) {
        fileIssues += 1;
      } else {
        rowNumbers.add(issue.rowNumber);
      }
    });

  return rowNumbers.size + fileIssues;
}

function normalizeImportMode(
  value: AttendanceValidationOptions["importMode"],
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>
) {
  const normalized = typeof value === "string" ? value.trim() : value;

  if (!normalized) {
    return AttendanceImportMode.MTD;
  }

  if (
    normalized === AttendanceImportMode.MTD ||
    normalized === AttendanceImportMode.HISTORICAL_MONTH
  ) {
    return normalized;
  }

  addIssue(issues, rowIssueCounts, fileIssue(
    AttendanceIssueCode.INVALID_ATTENDANCE_IMPORT_MODE,
    "importMode",
    "Attendance import mode must be MTD or HISTORICAL_MONTH."
  ));

  return AttendanceImportMode.MTD;
}

function validateMtdCoverage(options: {
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  expectedCoverageEndDate: string;
  issues: AttendancePreviewIssue[];
  periodMonthInput?: string;
  rowIssueCounts: Map<number, number>;
  uploadDate: string;
  validShiftDates: string[];
}) {
  if (options.periodMonthInput?.trim()) {
    addIssue(options.issues, options.rowIssueCounts, fileIssue(
      AttendanceIssueCode.INVALID_ATTENDANCE_IMPORT_MODE,
      "periodMonth",
      "periodMonth is only accepted for HISTORICAL_MONTH attendance imports."
    ));
  }

  if (
    options.coverageStartDate &&
    options.coverageStartDate !== firstDateOfMonth(options.coverageStartDate)
  ) {
    addIssue(options.issues, options.rowIssueCounts, fileIssue(
      AttendanceIssueCode.MTD_COVERAGE_START_NOT_MONTH_START,
      "Shift Date",
      "MTD coverage must start on the first day of the period month."
    ));
  }

  if (
    options.coverageEndDate &&
    options.coverageEndDate !== options.expectedCoverageEndDate
  ) {
    addIssue(options.issues, options.rowIssueCounts, fileIssue(
      AttendanceIssueCode.MTD_COVERAGE_END_NOT_YESTERDAY,
      "Shift Date",
      "MTD coverage must end on the day before the upload date."
    ));
  }

  if (options.validShiftDates.includes(options.uploadDate)) {
    addIssue(options.issues, options.rowIssueCounts, fileIssue(
      AttendanceIssueCode.MTD_INCLUDES_UPLOAD_DAY,
      "Shift Date",
      "Normal daily MTD uploads must not include the upload day."
    ));
  }

  if (options.validShiftDates.some((shiftDate) => shiftDate > options.uploadDate)) {
    addIssue(options.issues, options.rowIssueCounts, fileIssue(
      AttendanceIssueCode.MTD_INCLUDES_FUTURE_DATE,
      "Shift Date",
      "Attendance file must not include future shift dates."
    ));
  }
}

function validateHistoricalPeriodMonth(
  value: string | undefined,
  uploadDate: string,
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>
) {
  const periodMonth = value?.trim();

  if (!periodMonth) {
    addIssue(issues, rowIssueCounts, fileIssue(
      AttendanceIssueCode.HISTORICAL_PERIOD_MONTH_REQUIRED,
      "periodMonth",
      "Historical attendance imports require periodMonth in YYYY-MM format."
    ));
    return null;
  }

  if (!isValidPeriodMonth(periodMonth)) {
    addIssue(issues, rowIssueCounts, fileIssue(
      AttendanceIssueCode.INVALID_HISTORICAL_PERIOD_MONTH,
      "periodMonth",
      "Historical attendance periodMonth must use YYYY-MM format."
    ));
    return null;
  }

  if (!isClosedHistoricalPeriodMonth(periodMonth, uploadDate)) {
    addIssue(issues, rowIssueCounts, fileIssue(
      AttendanceIssueCode.HISTORICAL_PERIOD_MONTH_NOT_CLOSED,
      "periodMonth",
      "Historical attendance periodMonth must be a closed past month."
    ));
  }

  return periodMonth;
}

function validateHistoricalShiftDates(
  rows: AttendanceParsedRow[],
  periodMonth: string,
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>
) {
  for (const row of rows) {
    if (!row.shiftDate || row.shiftDate.startsWith(`${periodMonth}-`)) {
      continue;
    }

    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.SHIFT_DATE_OUTSIDE_SELECTED_PERIOD_MONTH,
      fieldName: "Shift Date",
      message:
        "Historical attendance shift date must be inside the selected periodMonth."
    }));
  }
}

function fileIssue(
  issueCode: AttendanceIssueCode,
  fieldName: string,
  message: string
): AttendancePreviewIssue {
  return {
    rowNumber: null,
    shopperId: null,
    severity: AttendanceIssueSeverity.ERROR,
    issueCode,
    fieldName,
    message,
    resolutionStatus: AttendanceIssueResolutionStatus.OPEN
  };
}

function rowIssue(
  row: AttendanceParsedRow,
  issue: Omit<AttendancePreviewIssue, "rowNumber" | "shopperId" | "resolutionStatus">
): AttendancePreviewIssue {
  return {
    rowNumber: row.rawRowNumber,
    shopperId: row.identifier,
    resolutionStatus: AttendanceIssueResolutionStatus.OPEN,
    ...issue
  };
}

function trackDuplicate(
  trackers: Map<string, DuplicateTracker>,
  input: DuplicateInput | null
) {
  if (!input) {
    return;
  }

  const tracker = trackers.get(input.key);

  if (tracker) {
    tracker.rows.push(input.row);
    return;
  }

  trackers.set(input.key, {
    key: input.key,
    shopperId: input.shopperId,
    userId: input.userId,
    pickerName: input.pickerName,
    branchName: input.branchName,
    vendorName: input.vendorName,
    shiftDate: input.shiftDate,
    rows: [input.row]
  });
}

function buildDuplicateGroups(
  trackers: Map<string, DuplicateTracker>,
  selectedRows: Set<number>,
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>
): AttendanceDuplicateGroup[] {
  const groups: AttendanceDuplicateGroup[] = [];

  for (const tracker of trackers.values()) {
    if (tracker.rows.length < 2) {
      continue;
    }

    const selectedRawRowNumbers = tracker.rows
      .map((row) => row.rawRowNumber)
      .filter((rowNumber) => selectedRows.has(rowNumber));
    const selectedRawRowNumber =
      selectedRawRowNumbers.length === 1 ? selectedRawRowNumbers[0] ?? null : null;

    if (!selectedRawRowNumber) {
      for (const row of tracker.rows.slice(1)) {
        addIssue(issues, rowIssueCounts, rowIssue(row, {
          severity: AttendanceIssueSeverity.ERROR,
          issueCode: AttendanceIssueCode.DUPLICATE_PICKER_DATE,
          fieldName: "Shift Date",
          message: "Duplicate Picker/date rows are not allowed in v1."
        }));
      }
    }

    groups.push({
      shopperId: tracker.shopperId,
      userId: tracker.userId,
      pickerName: tracker.pickerName,
      branchName: tracker.branchName,
      vendorName: tracker.vendorName,
      shiftDate: tracker.shiftDate,
      selectedRawRowNumber,
      options: tracker.rows.map(mapDuplicateOption)
    });
  }

  return groups;
}

function mapDuplicateOption(row: AttendanceParsedRow): AttendanceDuplicateOption {
  return {
    rawRowNumber: row.rawRowNumber,
    shiftName: row.shiftName,
    sourceStatus: row.sourceStatus,
    scheduledStartTime: row.scheduledStartTime,
    scheduledEndTime: row.scheduledEndTime,
    actualCheckinTime: row.actualCheckinTime,
    actualCheckoutTime: row.actualCheckoutTime,
    actualWorkDurationHours: row.actualWorkDurationHours,
    sourceLocation: row.sourceLocation,
    sourceDesignation: row.sourceDesignation
  };
}

function matchedDuplicateInput(
  row: AttendanceParsedRow,
  user: AttendanceMatchedUser
): DuplicateInput | null {
  if (!row.shiftDate) {
    return null;
  }

  return {
    key: matchedKey(row, user),
    shopperId: user.shopperId,
    userId: user.id,
    pickerName: user.nameEn,
    branchName: user.branchName,
    vendorName: user.vendorName,
    shiftDate: row.shiftDate,
    row
  };
}

function unmatchedDuplicateInput(
  row: AttendanceParsedRow,
  user: AttendanceMatchedUser | undefined
): DuplicateInput | null {
  if (!row.shiftDate || !row.identifier || user) {
    return null;
  }

  return {
    key: unmatchedKey(row),
    shopperId: row.identifier,
    userId: null,
    pickerName: null,
    branchName: null,
    vendorName: null,
    shiftDate: row.shiftDate,
    row
  };
}

function matchedKey(row: AttendanceParsedRow, user: AttendanceMatchedUser) {
  return `matched:${row.shiftDate}:${user.id}`;
}

function unmatchedKey(row: AttendanceParsedRow) {
  return `unmatched:${row.shiftDate}:${row.identifier}`;
}

function isEgypt(division: string | null) {
  return division?.trim().toUpperCase() === "EGYPT";
}

function hasUnknownStatus(row: AttendanceParsedRow) {
  const status = row.sourceStatus?.trim().toUpperCase();

  if (!status || isLeaveOrOffDay(row)) {
    return false;
  }

  return !recognizedStatuses.has(status);
}

function requiresCheckin(row: AttendanceParsedRow) {
  const status = row.sourceStatus?.trim().toUpperCase();

  return !isLeaveOrOffDay(row) && status !== "ABSENT" && status !== "ON LEAVE";
}

function isLeaveOrOffDay(row: AttendanceParsedRow) {
  const shiftName = row.shiftName?.trim().toUpperCase() ?? "";

  return (
    shiftName.includes("OFF DAY") ||
    shiftName.includes("ANNUAL LEAVE") ||
    shiftName.includes("MEDICAL LEAVE")
  );
}

function normalizeUploadDate(uploadDate: string | Date) {
  if (uploadDate instanceof Date) {
    return formatDateOnly(uploadDate);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(uploadDate);

  if (!match) {
    throw new Error("uploadDate must be a YYYY-MM-DD string or Date.");
  }

  return uploadDate;
}

function previousDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return formatUtcDateOnly(parsed);
}

function firstDateOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function isValidPeriodMonth(periodMonth: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  return year >= 1900 && month >= 1 && month <= 12;
}

function isClosedHistoricalPeriodMonth(periodMonth: string, uploadDate: string) {
  return periodMonth < uploadDate.slice(0, 7);
}

function lastDateOfMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return formatUtcDateOnly(date);
}

function minDateOnly(dates: string[]) {
  return dates.length ? [...dates].sort()[0] : null;
}

function maxDateOnly(dates: string[]) {
  return dates.length ? [...dates].sort().at(-1) ?? null : null;
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatUtcDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
