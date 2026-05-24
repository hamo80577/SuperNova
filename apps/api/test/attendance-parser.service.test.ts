import assert from "node:assert/strict";

import ExcelJS from "exceljs";
import { AttendanceIssueType } from "@prisma/client";

import { AttendanceParserService } from "../src/attendance/attendance-parser.service";

const headers = [
  "Name",
  "Identifier",
  "Designation",
  "Department",
  "Division",
  "Sub Division",
  "Location",
  "Role",
  "Job Type",
  "Employee Current Status",
  "Shift Name",
  "Shift Date",
  "Shift Scheduled Start Time",
  "Shift Scheduled End Time",
  "Actual Checkin Time",
  "Actual Checkout Time",
  "Total Hours In Shift (hrs)",
  "Actual Work Duration (hrs)",
  "Status"
];

async function workbookBuffer(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function main() {
  const parser = new AttendanceParserService();
  const buffer = await workbookBuffer([
    [
      "Picker One",
      " SHOP-1 ",
      "Picker",
      "Ops",
      "Egypt",
      "Cairo",
      "Branch A",
      "Picker",
      "Full Time",
      "Active",
      "Morning Shift",
      new Date("2026-05-10T00:00:00.000Z"),
      "09:00",
      "17:00",
      "09:20",
      "17:15",
      8,
      7.75,
      "Late"
    ]
  ]);

  const result = await parser.parseAttendanceBuffer(buffer);

  assert.equal(result.issues.length, 0);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].rowNumber, 2);
  assert.equal(result.rows[0].identifier, "SHOP-1");
  assert.equal(result.rows[0].division, "Egypt");
  assert.equal(result.rows[0].attendanceDate?.toISOString(), "2026-05-10T00:00:00.000Z");
  assert.equal(result.rows[0].scheduledStartAt?.toISOString(), "2026-05-10T09:00:00.000Z");
  assert.equal(result.rows[0].actualCheckInAt?.toISOString(), "2026-05-10T09:20:00.000Z");
  assert.equal(result.rows[0].actualWorkDurationHours, 7.75);

  const missingColumnWorkbook = new ExcelJS.Workbook();
  const missingColumnSheet = missingColumnWorkbook.addWorksheet("Attendance");
  missingColumnSheet.addRow(["Identifier", "Division", "Shift Date"]);
  const missingColumnResult = await parser.parseAttendanceBuffer(
    Buffer.from(await missingColumnWorkbook.xlsx.writeBuffer())
  );

  assert.equal(missingColumnResult.rows.length, 0);
  assert.equal(
    missingColumnResult.issues.some(
      (issue) => issue.type === AttendanceIssueType.MISSING_REQUIRED_COLUMN
    ),
    true
  );
}

void main();
