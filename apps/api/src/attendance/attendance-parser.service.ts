import { Injectable } from "@nestjs/common";
import { AttendanceIssueSeverity, AttendanceIssueType } from "@prisma/client";
import ExcelJS from "exceljs";

import type {
  AttendanceIssueDraft,
  AttendanceParseResult,
  ParsedAttendanceRow
} from "./attendance.types";

const REQUIRED_COLUMNS = [
  "Identifier",
  "Division",
  "Shift Date",
  "Shift Name",
  "Status",
  "Shift Scheduled Start Time",
  "Actual Checkin Time",
  "Actual Work Duration (hrs)"
] as const;

const OPTIONAL_COLUMNS = [
  "Name",
  "Designation",
  "Department",
  "Sub Division",
  "Location",
  "Role",
  "Job Type",
  "Employee Current Status",
  "Shift Scheduled End Time",
  "Actual Checkout Time",
  "Total Hours In Shift (hrs)"
] as const;

@Injectable()
export class AttendanceParserService {
  async parseAttendanceBuffer(buffer: Buffer): Promise<AttendanceParseResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]
      );
    } catch {
      return {
        rows: [],
        issues: [
          {
            severity: AttendanceIssueSeverity.ERROR,
            type: AttendanceIssueType.ROW_PARSE_ERROR,
            message: "Attendance workbook could not be parsed."
          }
        ]
      };
    }
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return {
        rows: [],
        issues: [
          {
            severity: AttendanceIssueSeverity.ERROR,
            type: AttendanceIssueType.ROW_PARSE_ERROR,
            message: "Attendance workbook does not contain any worksheets."
          }
        ]
      };
    }

    const headerMap = this.buildHeaderMap(sheet.getRow(1));
    const missingColumns = REQUIRED_COLUMNS.filter(
      (column) => !headerMap.has(normalizeHeader(column))
    );

    if (missingColumns.length) {
      return {
        rows: [],
        issues: missingColumns.map((column) => ({
          severity: AttendanceIssueSeverity.ERROR,
          type: AttendanceIssueType.MISSING_REQUIRED_COLUMN,
          message: `Missing required attendance column: ${column}.`,
          metadata: { column }
        }))
      };
    }

    const rows: ParsedAttendanceRow[] = [];
    const issues: AttendanceIssueDraft[] = [];
    const lastRowNumber = sheet.actualRowCount;

    for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (isEmptyRow(row)) {
        continue;
      }

      const attendanceDate = parseDateCell(this.getCell(row, headerMap, "Shift Date"));
      const scheduledStartAt = combineDateAndTime(
        attendanceDate,
        this.getCell(row, headerMap, "Shift Scheduled Start Time")
      );
      const scheduledEndAt = combineDateAndTime(
        attendanceDate,
        this.getCell(row, headerMap, "Shift Scheduled End Time")
      );
      const actualCheckInAt = combineDateAndTime(
        attendanceDate,
        this.getCell(row, headerMap, "Actual Checkin Time")
      );
      const actualCheckOutAt = combineDateAndTime(
        attendanceDate,
        this.getCell(row, headerMap, "Actual Checkout Time")
      );
      const identifier = toCellText(this.getCell(row, headerMap, "Identifier")).trim();

      if (!attendanceDate) {
        issues.push({
          severity: AttendanceIssueSeverity.ERROR,
          type: AttendanceIssueType.INVALID_DATE,
          rowNumber,
          identifier,
          message: "Shift Date is missing or invalid."
        });
      }

      if (attendanceDate && !scheduledStartAt) {
        issues.push({
          severity: AttendanceIssueSeverity.WARNING,
          type: AttendanceIssueType.INVALID_TIME,
          rowNumber,
          identifier,
          attendanceDate,
          message: "Shift Scheduled Start Time is missing or invalid."
        });
      }

      rows.push({
        rowNumber,
        rawName: nullableText(this.getCell(row, headerMap, "Name")),
        identifier,
        rawDesignation: nullableText(this.getCell(row, headerMap, "Designation")),
        department: nullableText(this.getCell(row, headerMap, "Department")),
        division: toCellText(this.getCell(row, headerMap, "Division")),
        subDivision: nullableText(this.getCell(row, headerMap, "Sub Division")),
        rawLocation: nullableText(this.getCell(row, headerMap, "Location")),
        rawRole: nullableText(this.getCell(row, headerMap, "Role")),
        jobType: nullableText(this.getCell(row, headerMap, "Job Type")),
        employeeCurrentStatus: nullableText(
          this.getCell(row, headerMap, "Employee Current Status")
        ),
        shiftName: nullableText(this.getCell(row, headerMap, "Shift Name")),
        attendanceDate,
        scheduledStartAt,
        scheduledEndAt,
        actualCheckInAt,
        actualCheckOutAt,
        totalHoursInShift: toNumber(
          this.getCell(row, headerMap, "Total Hours In Shift (hrs)")
        ),
        actualWorkDurationHours: toNumber(
          this.getCell(row, headerMap, "Actual Work Duration (hrs)")
        ),
        rawStatus: nullableText(this.getCell(row, headerMap, "Status"))
      });
    }

    return { rows, issues };
  }

  getRequiredColumns() {
    return [...REQUIRED_COLUMNS];
  }

  getKnownColumns() {
    return [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
  }

  private buildHeaderMap(row: ExcelJS.Row) {
    const headers = new Map<string, number>();
    row.eachCell((cell, colNumber) => {
      const header = normalizeHeader(toCellText(cell.value));
      if (header) {
        headers.set(header, colNumber);
      }
    });
    return headers;
  }

  private getCell(row: ExcelJS.Row, headerMap: Map<string, number>, column: string) {
    const columnNumber = headerMap.get(normalizeHeader(column));
    return columnNumber ? row.getCell(columnNumber).value : null;
  }
}

function isEmptyRow(row: ExcelJS.Row) {
  let hasValue = false;
  row.eachCell((cell) => {
    if (toCellText(cell.value).trim().length > 0) {
      hasValue = true;
    }
  });
  return !hasValue;
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function nullableText(value: ExcelJS.CellValue | undefined | null) {
  const text = toCellText(value).trim();
  return text.length ? text : null;
}

function toCellText(value: ExcelJS.CellValue | undefined | null): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return toCellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") {
      return value.text;
    }
  }
  return String(value);
}

function toNumber(value: ExcelJS.CellValue | undefined | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = toCellText(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateCell(value: ExcelJS.CellValue | undefined | null) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return startOfUtcDay(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return startOfUtcDay(excelSerialToDate(value));
  }

  const text = toCellText(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return startOfUtcDay(parsed);
  }

  const dayMonthYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!dayMonthYear) {
    return null;
  }

  const [, dayValue, monthValue, yearValue] = dayMonthYear;
  const year = Number(yearValue.length === 2 ? `20${yearValue}` : yearValue);
  const month = Number(monthValue) - 1;
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function combineDateAndTime(
  date: Date | null,
  value: ExcelJS.CellValue | undefined | null
) {
  if (!date) return null;
  const time = parseTimeCell(value);
  if (!time) return null;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      time.hours,
      time.minutes,
      time.seconds
    )
  );
}

function parseTimeCell(value: ExcelJS.CellValue | undefined | null) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      hours: value.getUTCHours(),
      minutes: value.getUTCMinutes(),
      seconds: value.getUTCSeconds()
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = value >= 1 ? value % 1 : value;
    const totalSeconds = Math.round(fraction * 86_400);
    return {
      hours: Math.floor(totalSeconds / 3600) % 24,
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }

  const text = toCellText(value).trim();
  if (!text) return null;

  const parsed = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!parsed) return null;

  let hours = Number(parsed[1]);
  const minutes = Number(parsed[2]);
  const seconds = Number(parsed[3] ?? 0);
  const meridiem = parsed[4]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return { hours, minutes, seconds };
}

function excelSerialToDate(serial: number) {
  return new Date(Math.round((serial - 25569) * 86_400_000));
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}
