import assert from "node:assert/strict";

import {
  AttendanceIdentifierType,
  AttendanceImportMode,
  AttendanceIssueCode,
  AttendanceIssueSeverity,
  AttendancePersonRole,
  UserRole
} from "@prisma/client";
import ExcelJS from "exceljs";

import { AttendanceParserService } from "../src/attendance/attendance-parser.service";
import { AttendanceValidatorService } from "../src/attendance/attendance-validator.service";
import type {
  AttendanceMatchedUser,
  AttendanceValidationPreview
} from "../src/attendance/attendance-preview.types";

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

type WorkbookRow = Record<string, unknown>;

const pickerUser: AttendanceMatchedUser = {
  id: "user-picker-1",
  role: UserRole.PICKER,
  personRole: AttendancePersonRole.PICKER,
  identifier: "SHOPPER-1",
  identifierType: AttendanceIdentifierType.SHOPPER_ID,
  nameEn: "Picker Test",
  branchName: "Branch A",
  vendorName: "Vendor A"
};

const secondPickerUser: AttendanceMatchedUser = {
  id: "user-picker-2",
  role: UserRole.PICKER,
  personRole: AttendancePersonRole.PICKER,
  identifier: "SHOPPER-2",
  identifierType: AttendanceIdentifierType.SHOPPER_ID,
  nameEn: "Picker Two",
  branchName: "Branch B",
  vendorName: "Vendor B"
};

const champUser: AttendanceMatchedUser = {
  id: "user-champ-1",
  role: UserRole.CHAMP,
  personRole: AttendancePersonRole.CHAMP,
  identifier: "CHAMP-1",
  identifierType: AttendanceIdentifierType.IBS_ID,
  nameEn: "Champ Test",
  branchName: "Branch C",
  vendorName: "Vendor C"
};

// Same identifier value resolving to both a picker and a champ (ambiguous).
const ambiguousChampUser: AttendanceMatchedUser = {
  id: "user-champ-2",
  role: UserRole.CHAMP,
  personRole: AttendancePersonRole.CHAMP,
  identifier: "SHOPPER-1",
  identifierType: AttendanceIdentifierType.IBS_ID,
  nameEn: "Ambiguous Champ",
  branchName: null,
  vendorName: null
};

function baseRow(overrides: WorkbookRow = {}): WorkbookRow {
  return {
    Identifier: "SHOPPER-1",
    Division: " Egypt ",
    "Shift Date": "2026-05-01",
    "Shift Name": "Morning Shift",
    "Shift Scheduled Start Time": "09:00",
    "Shift Scheduled End Time": "17:00",
    "Shift Break Duration (mins)": 60,
    "Total Hours In Shift (hrs)": 8,
    "Actual Checkin Time": "09:05",
    "Actual Checkout Time": "17:05",
    "Actual Work Duration (hrs)": 8,
    Status: "Present",
    ...overrides
  };
}

async function workbookBuffer(
  rows: WorkbookRow[],
  headers = requiredHeaders
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Attendance");

  worksheet.addRow(headers);
  rows.forEach((row) => {
    worksheet.addRow(headers.map((header) => row[header] ?? ""));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function createValidator(users: AttendanceMatchedUser[]) {
  const parser = new AttendanceParserService();

  const validator = new AttendanceValidatorService(parser);
  const userLookup = {
    // Returns every matched user (picker by shopperId, champ by ibsId) whose
    // identifier appears in the requested set — including the case where the
    // same identifier resolves to both a picker and a champ.
    findByIdentifiers: async (identifiers: string[]) =>
      users.filter((user) => identifiers.includes(user.identifier))
  };

  return { userLookup, validator };
}

async function validateRows(
  rows: WorkbookRow[],
  options: {
    duplicateResolutionRowNumbers?: number[];
    headers?: string[];
    importMode?: AttendanceImportMode;
    periodMonth?: string;
    uploadDate?: string;
    users?: AttendanceMatchedUser[];
  } = {}
) {
  const { userLookup, validator } = createValidator(options.users ?? [pickerUser]);
  const buffer = await workbookBuffer(rows, options.headers ?? requiredHeaders);

  return validator.validateWorkbook(buffer, {
    uploadDate: options.uploadDate ?? "2026-05-09",
    importMode: options.importMode,
    periodMonth: options.periodMonth,
    duplicateResolutionRowNumbers: options.duplicateResolutionRowNumbers,
    rowsPreviewLimit: 5,
    userLookup
  });
}

function issueCodes(preview: AttendanceValidationPreview) {
  return preview.issues.map((issue) => issue.issueCode);
}

function assertIssue(
  preview: AttendanceValidationPreview,
  issueCode: AttendanceIssueCode
) {
  assert.ok(
    issueCodes(preview).includes(issueCode),
    `Expected ${issueCode} in ${JSON.stringify(preview.issues)}`
  );
}

async function main() {
  {
    const preview = await validateRows([baseRow()], {
      headers: requiredHeaders.filter((header) => header !== "Identifier")
    });

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.INVALID_REQUIRED_COLUMN);
  }

  {
    const preview = await validateRows([
      baseRow({
        "Shift Date": new Date("2026-05-01T00:00:00.000Z")
      }),
      baseRow({
        Identifier: "SHOPPER-2",
        "Shift Date": "2026-05-08",
        "Actual Checkin Time": "09:10"
      })
    ], {
      users: [pickerUser, secondPickerUser]
    });

    assert.equal(preview.canConfirm, true);
    assert.equal(preview.periodMonth, "2026-05");
    assert.equal(preview.coverageStartDate, "2026-05-01");
    assert.equal(preview.coverageEndDate, "2026-05-08");
    assert.equal(preview.expectedCoverageEndDate, "2026-05-08");
    assert.equal(preview.rowCount, 2);
    assert.equal(preview.egyptRows, 2);
    assert.equal(preview.nonEgyptRows, 0);
    assert.equal(preview.matchedPickerRows, 2);
    assert.equal(preview.unmatchedRows, 0);
    assert.equal(preview.excludedNonPickerRows, 0);
    assert.equal(preview.errorRows, 0);
    assert.equal(preview.warningRows, 0);
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Date": "2026-05-01" }),
      baseRow({ "Shift Date": "2026-05-09" })
    ]);

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.MTD_INCLUDES_UPLOAD_DAY);
    assertIssue(preview, AttendanceIssueCode.MTD_COVERAGE_END_NOT_YESTERDAY);
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Date": "2026-05-01" }),
      baseRow({ "Shift Date": "2026-05-10" })
    ]);

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.MTD_INCLUDES_FUTURE_DATE);
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Date": "2026-05-01" }),
      baseRow({ "Shift Date": "2026-05-31" })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      uploadDate: "2026-06-02"
    });

    assert.equal(preview.canConfirm, true);
    assert.equal(preview.importMode, AttendanceImportMode.HISTORICAL_MONTH);
    assert.equal(preview.periodMonth, "2026-05");
    assert.equal(preview.coverageEndDate, "2026-05-31");
    assert.equal(preview.expectedCoverageEndDate, "2026-05-31");
    assert.equal(
      issueCodes(preview).includes(
        AttendanceIssueCode.MTD_COVERAGE_END_NOT_YESTERDAY
      ),
      false
    );
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Date": "2026-06-01" })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      uploadDate: "2026-06-02"
    });

    assert.equal(preview.canConfirm, false);
    assertIssue(
      preview,
      AttendanceIssueCode.SHIFT_DATE_OUTSIDE_SELECTED_PERIOD_MONTH
    );
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Date": "2026-05-01" }),
      baseRow({ "Shift Date": "2026-06-01" })
    ]);

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.MULTIPLE_MONTHS_IN_FILE);
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Date": "2026-05-02" }),
      baseRow({ Identifier: "SHOPPER-2", "Shift Date": "2026-05-08" })
    ], {
      users: [pickerUser, secondPickerUser]
    });

    assert.equal(preview.canConfirm, false);
    assertIssue(
      preview,
      AttendanceIssueCode.MTD_COVERAGE_START_NOT_MONTH_START
    );
  }

  {
    const preview = await validateRows([
      baseRow({ Division: "KSA" }),
      baseRow({ Identifier: "SHOPPER-2", "Shift Date": "2026-05-08" })
    ], {
      users: [pickerUser, secondPickerUser]
    });

    assert.equal(preview.canConfirm, true);
    assert.equal(preview.egyptRows, 1);
    assert.equal(preview.nonEgyptRows, 1);
    assertIssue(preview, AttendanceIssueCode.NON_EGYPT_ROW);
  }

  {
    const preview = await validateRows([baseRow({ Identifier: "  " })]);

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.MISSING_IDENTIFIER);
  }

  {
    const preview = await validateRows([baseRow({ Identifier: "UNKNOWN-1" })], {
      uploadDate: "2026-05-02"
    });

    assert.equal(preview.canConfirm, true);
    assert.equal(preview.unmatchedRows, 1);
    assertIssue(preview, AttendanceIssueCode.UNMATCHED_IDENTIFIER);
  }

  {
    // Champ matched by ibsId — a valid MATCHED_CHAMP row, not an exclusion.
    const preview = await validateRows([baseRow({ Identifier: "CHAMP-1" })], {
      uploadDate: "2026-05-02",
      users: [champUser]
    });

    assert.equal(preview.canConfirm, true);
    assert.equal(preview.matchedChampRows, 1);
    assert.equal(preview.matchedPickerRows, 0);
    assert.equal(
      preview.rowsPreview[0]?.matchStatus,
      "MATCHED_CHAMP"
    );
  }

  {
    // Identifier matches both a picker shopperId and a champ ibsId -> blocking.
    const preview = await validateRows([baseRow({ Identifier: "SHOPPER-1" })], {
      uploadDate: "2026-05-02",
      users: [pickerUser, ambiguousChampUser]
    });

    assert.equal(preview.canConfirm, false);
    assert.equal(preview.ambiguousIdentifierRows, 1);
    assert.equal(
      preview.rowsPreview[0]?.matchStatus,
      "AMBIGUOUS_IDENTIFIER"
    );
    assertIssue(preview, AttendanceIssueCode.AMBIGUOUS_ATTENDANCE_IDENTIFIER);
  }

  {
    const preview = await validateRows([
      baseRow({ Identifier: "SHOPPER-1", "Shift Date": "2026-05-01" }),
      baseRow({ Identifier: "SHOPPER-1", "Shift Date": "2026-05-01" }),
      baseRow({ Identifier: "SHOPPER-2", "Shift Date": "2026-05-08" })
    ], {
      users: [pickerUser, secondPickerUser]
    });

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.DUPLICATE_PICKER_DATE);
    assert.equal(preview.duplicateGroups.length, 1);
    assert.equal(preview.duplicateGroups[0]?.pickerName, "Picker Test");
    assert.equal(preview.duplicateGroups[0]?.branchName, "Branch A");
    assert.equal(preview.duplicateGroups[0]?.shiftDate, "2026-05-01");
    assert.deepEqual(
      preview.duplicateGroups[0]?.options.map((option) => option.rawRowNumber),
      [2, 3]
    );
  }

  {
    const preview = await validateRows([
      baseRow({
        Identifier: "SHOPPER-1",
        "Shift Date": "2026-05-01",
        "Shift Name": "Morning Shift"
      }),
      baseRow({
        Identifier: "SHOPPER-1",
        "Shift Date": "2026-05-01",
        "Shift Name": "Late Coverage",
        "Actual Checkin Time": "10:31",
        Status: "Late"
      }),
      baseRow({ Identifier: "SHOPPER-2", "Shift Date": "2026-05-08" })
    ], {
      duplicateResolutionRowNumbers: [3],
      users: [pickerUser, secondPickerUser]
    });

    assert.equal(preview.canConfirm, true);
    assert.equal(
      preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.DUPLICATE_PICKER_DATE
      ),
      false
    );
    assert.equal(preview.duplicateGroups[0]?.selectedRawRowNumber, 3);
    assert.equal(preview.duplicateGroups[0]?.options[1]?.shiftName, "Late Coverage");
    assert.equal(preview.duplicateGroups[0]?.options[1]?.sourceStatus, "Late");
  }

  {
    const preview = await validateRows([baseRow({ "Shift Date": "not-a-date" })]);

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.INVALID_SHIFT_DATE);
  }

  {
    const preview = await validateRows([
      baseRow({ "Shift Scheduled Start Time": "not-a-time" })
    ]);

    assert.equal(preview.canConfirm, false);
    assertIssue(preview, AttendanceIssueCode.INVALID_TIME);
  }

  {
    const preview = await validateRows([
      baseRow({
        Status: "Mystery status",
        "Actual Checkin Time": "-",
        "Actual Checkout Time": "-"
      })
    ]);

    assertIssue(preview, AttendanceIssueCode.UNKNOWN_STATUS);
  }

  {
    const parser = new AttendanceParserService();
    const buffer = await workbookBuffer([
      baseRow({
        Identifier: "  SHOPPER-1  ",
        "Actual Checkin Time": "-",
        "Actual Checkout Time": null
      })
    ]);
    const workbook = await parser.parseWorkbook(buffer);

    assert.equal(workbook.rows[0]?.identifier, "SHOPPER-1");
    assert.equal(workbook.rows[0]?.actualCheckinTime, null);
    assert.equal(workbook.rows[0]?.actualCheckoutTime, null);
  }

  {
    const { userLookup, validator } = createValidator([pickerUser]);
    await assert.rejects(
      validator.validateWorkbook(Buffer.from("not an excel file"), {
        uploadDate: "2026-05-09",
        userLookup
      }),
      /Unable to read attendance Excel file/
    );
  }
}

void main();
