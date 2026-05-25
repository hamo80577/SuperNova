import { Injectable } from "@nestjs/common";
import {
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  UserRole
} from "@prisma/client";

import { AttendanceParserService } from "./attendance-parser.service";
import type {
  AttendanceMatchedUser,
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
  constructor(private readonly parser: AttendanceParserService) {}

  async validateWorkbook(
    buffer: Buffer,
    options: AttendanceValidationOptions
  ): Promise<AttendanceValidationPreview> {
    const workbook = await this.parser.parseWorkbook(buffer);
    const expectedCoverageEndDate = previousDateOnly(
      normalizeUploadDate(options.uploadDate)
    );
    const issues: AttendancePreviewIssue[] = [];
    const rowIssueCounts = new Map<number, number>();
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
    const periodMonth = coverageStartDate?.slice(0, 7) ?? null;

    if (periodMonths.size > 1) {
      addIssue(issues, rowIssueCounts, fileIssue(
        AttendanceIssueCode.MULTIPLE_MONTHS_IN_FILE,
        "Shift Date",
        "Attendance file contains more than one period month."
      ));
    }

    if (coverageStartDate && coverageStartDate !== firstDateOfMonth(coverageStartDate)) {
      addIssue(issues, rowIssueCounts, fileIssue(
        AttendanceIssueCode.MTD_COVERAGE_START_NOT_MONTH_START,
        "Shift Date",
        "MTD coverage must start on the first day of the period month."
      ));
    }

    if (coverageEndDate && coverageEndDate !== expectedCoverageEndDate) {
      addIssue(issues, rowIssueCounts, fileIssue(
        AttendanceIssueCode.MTD_COVERAGE_END_NOT_YESTERDAY,
        "Shift Date",
        "MTD coverage must end on the day before the upload date."
      ));
    }

    if (validShiftDates.includes(normalizeUploadDate(options.uploadDate))) {
      addIssue(issues, rowIssueCounts, fileIssue(
        AttendanceIssueCode.MTD_INCLUDES_UPLOAD_DAY,
        "Shift Date",
        "Normal daily MTD uploads must not include the upload day."
      ));
    }

    if (validShiftDates.some((shiftDate) => shiftDate > normalizeUploadDate(options.uploadDate))) {
      addIssue(issues, rowIssueCounts, fileIssue(
        AttendanceIssueCode.MTD_INCLUDES_FUTURE_DATE,
        "Shift Date",
        "Attendance file must not include future shift dates."
      ));
    }

    let egyptRows = 0;
    let nonEgyptRows = 0;
    let matchedPickerRows = 0;
    let unmatchedRows = 0;
    let excludedNonPickerRows = 0;
    const matchedDuplicateKeys = new Map<string, number>();
    const unmatchedDuplicateKeys = new Map<string, number>();

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
        trackDuplicate(unmatchedDuplicateKeys, unmatchedKey(row), row, issues, rowIssueCounts);
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
      trackDuplicate(
        matchedDuplicateKeys,
        matchedKey(row, matchedUser),
        row,
        issues,
        rowIssueCounts
      );
    }

    const errorRows = countIssueRows(issues, AttendanceIssueSeverity.ERROR);
    const warningRows = countIssueRows(issues, AttendanceIssueSeverity.WARNING);

    return {
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
      canConfirm: errorRows === 0,
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
  seen: Map<string, number>,
  key: string | null,
  row: AttendanceParsedRow,
  issues: AttendancePreviewIssue[],
  rowIssueCounts: Map<number, number>
) {
  if (!key) {
    return;
  }

  if (seen.has(key)) {
    addIssue(issues, rowIssueCounts, rowIssue(row, {
      severity: AttendanceIssueSeverity.ERROR,
      issueCode: AttendanceIssueCode.DUPLICATE_PICKER_DATE,
      fieldName: "Shift Date",
      message: "Duplicate Picker/date rows are not allowed in v1."
    }));
    return;
  }

  seen.set(key, row.rawRowNumber);
}

function matchedKey(row: AttendanceParsedRow, user: AttendanceMatchedUser) {
  return row.shiftDate ? `${row.shiftDate}:${user.id}` : null;
}

function unmatchedKey(row: AttendanceParsedRow) {
  return row.shiftDate && row.identifier
    ? `${row.shiftDate}:${row.identifier}`
    : null;
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
