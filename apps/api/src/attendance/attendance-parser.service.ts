import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";

import type {
  AttendanceParsedRow,
  AttendanceParsedWorkbook
} from "./attendance-preview.types";
import { parseAttendanceLocation } from "./attendance-location-parser";

const headerNames = {
  identifier: "Identifier",
  division: "Division",
  shiftDate: "Shift Date",
  shiftName: "Shift Name",
  scheduledStartTime: "Shift Scheduled Start Time",
  scheduledEndTime: "Shift Scheduled End Time",
  breakDurationMins: "Shift Break Duration (mins)",
  scheduledShiftHours: "Total Hours In Shift (hrs)",
  actualCheckinTime: "Actual Checkin Time",
  actualCheckoutTime: "Actual Checkout Time",
  actualWorkDurationHours: "Actual Work Duration (hrs)",
  sourceStatus: "Status",
  sourceName: "Name",
  sourceDesignation: "Designation",
  sourceSubDivision: "Sub Division",
  sourceLocation: "Location",
  shiftLocation: "Shift Location"
} as const;

@Injectable()
export class AttendanceParserService {
  async parseWorkbook(buffer: Buffer): Promise<AttendanceParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(toArrayBuffer(buffer));
    } catch (error) {
      throw new Error(
        `Unable to read attendance Excel file: ${
          error instanceof Error ? error.message : "unknown parser error"
        }`
      );
    }

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error("Unable to read attendance Excel file: no worksheet found.");
    }

    const headerRow = worksheet.getRow(1);
    const headers = readHeaders(headerRow);
    const headerIndex = new Map(headers.map((header, index) => [header, index + 1]));
    const rows: AttendanceParsedRow[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      if (isBlankRow(row, headerIndex)) {
        continue;
      }

      rows.push(this.parseRow(row, rowNumber, headerIndex));
    }

    return { headers, rows };
  }

  private parseRow(
    row: ExcelJS.Row,
    rawRowNumber: number,
    headerIndex: Map<string, number>
  ): AttendanceParsedRow {
    const shiftDate = parseDateOnly(cellValue(row, headerIndex, headerNames.shiftDate));
    const scheduledStartTime = parseTimeOnly(
      cellValue(row, headerIndex, headerNames.scheduledStartTime)
    );
    const scheduledEndTime = parseTimeOnly(
      cellValue(row, headerIndex, headerNames.scheduledEndTime)
    );
    const actualCheckinTime = parseTimeOnly(
      cellValue(row, headerIndex, headerNames.actualCheckinTime)
    );
    const actualCheckoutTime = parseTimeOnly(
      cellValue(row, headerIndex, headerNames.actualCheckoutTime)
    );
    const breakDurationMins = parseNumberValue(
      cellValue(row, headerIndex, headerNames.breakDurationMins)
    );
    const scheduledShiftHours = parseNumberValue(
      cellValue(row, headerIndex, headerNames.scheduledShiftHours)
    );
    const actualWorkDurationHours = parseNumberValue(
      cellValue(row, headerIndex, headerNames.actualWorkDurationHours)
    );
    const sourceLocation = normalizeText(
      cellValue(row, headerIndex, headerNames.sourceLocation)
    );
    const shiftLocation = normalizeText(
      cellValue(row, headerIndex, headerNames.shiftLocation)
    );

    return {
      rawRowNumber,
      identifier: normalizeText(cellValue(row, headerIndex, headerNames.identifier)),
      division: normalizeText(cellValue(row, headerIndex, headerNames.division)),
      shiftDate: shiftDate.value,
      shiftDateValid: shiftDate.valid,
      shiftName: normalizeText(cellValue(row, headerIndex, headerNames.shiftName)),
      scheduledStartTime: scheduledStartTime.value,
      scheduledStartTimeValid: scheduledStartTime.valid,
      scheduledEndTime: scheduledEndTime.value,
      scheduledEndTimeValid: scheduledEndTime.valid,
      breakDurationMins: breakDurationMins.value,
      breakDurationMinsValid: breakDurationMins.valid,
      scheduledShiftHours: scheduledShiftHours.value,
      scheduledShiftHoursValid: scheduledShiftHours.valid,
      actualCheckinTime: actualCheckinTime.value,
      actualCheckinTimeValid: actualCheckinTime.valid,
      actualCheckoutTime: actualCheckoutTime.value,
      actualCheckoutTimeValid: actualCheckoutTime.valid,
      actualWorkDurationHours: actualWorkDurationHours.value,
      actualWorkDurationHoursValid: actualWorkDurationHours.valid,
      sourceStatus: normalizeText(cellValue(row, headerIndex, headerNames.sourceStatus)),
      sourceName: normalizeText(cellValue(row, headerIndex, headerNames.sourceName)),
      sourceDesignation: normalizeText(
        cellValue(row, headerIndex, headerNames.sourceDesignation)
      ),
      sourceSubDivision: normalizeText(
        cellValue(row, headerIndex, headerNames.sourceSubDivision)
      ),
      sourceLocation,
      sourceLocationCode: parseAttendanceLocation(sourceLocation).code,
      shiftLocation
    };
  }
}

function readHeaders(row: ExcelJS.Row) {
  const headers: string[] = [];

  row.eachCell({ includeEmpty: false }, (cell) => {
    const header = normalizeText(readCellValue(cell));
    if (header) {
      headers.push(header);
    }
  });

  return headers;
}

function isBlankRow(row: ExcelJS.Row, headerIndex: Map<string, number>) {
  return Array.from(headerIndex.values()).every((columnIndex) => {
    return normalizeText(readCellValue(row.getCell(columnIndex))) === null;
  });
}

function cellValue(
  row: ExcelJS.Row,
  headerIndex: Map<string, number>,
  header: string
) {
  const columnIndex = headerIndex.get(header);

  if (!columnIndex) {
    return null;
  }

  return readCellValue(row.getCell(columnIndex));
}

function readCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;

  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date || typeof value !== "object") {
    return value;
  }

  const objectValue = value as unknown as Record<string, unknown>;

  if (typeof objectValue.text === "string") {
    return objectValue.text;
  }

  if (objectValue.result !== undefined) {
    return objectValue.result;
  }

  if (Array.isArray(objectValue.richText)) {
    return objectValue.richText
      .map((part) =>
        typeof part === "object" &&
        part !== null &&
        typeof (part as Record<string, unknown>).text === "string"
          ? String((part as Record<string, unknown>).text)
          : ""
      )
      .join("");
  }

  return cell.text;
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return formatDateOnly(value);
  }

  const text = String(value).trim();

  if (!text || text === "-") {
    return null;
  }

  return text;
}

function parseDateOnly(value: unknown): { value: string | null; valid: boolean } {
  if (value === null || value === undefined || normalizeText(value) === null) {
    return { value: null, valid: false };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: formatDateOnly(value), valid: true };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { value: formatDateOnly(excelSerialDate(value)), valid: true };
  }

  const text = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);

  if (isoMatch) {
    return fromDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const dashDayMonthYearMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(text);

  if (dashDayMonthYearMatch) {
    return fromDateParts(
      dashDayMonthYearMatch[3],
      dashDayMonthYearMatch[2],
      dashDayMonthYearMatch[1]
    );
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);

  if (slashMatch) {
    return fromDateParts(slashMatch[3], slashMatch[1], slashMatch[2]);
  }

  return { value: null, valid: false };
}

function parseTimeOnly(value: unknown): { value: string | null; valid: boolean } {
  if (value === null || value === undefined || normalizeText(value) === null) {
    return { value: null, valid: true };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: formatTimeOnly(value.getHours(), value.getMinutes()), valid: true };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    return {
      value: formatTimeOnly(Math.floor(totalMinutes / 60), totalMinutes % 60),
      valid: true
    };
  }

  const text = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(text);

  if (!match) {
    return { value: null, valid: false };
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) {
    hours += 12;
  }

  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  if (hours > 23 || minutes > 59) {
    return { value: null, valid: false };
  }

  return { value: formatTimeOnly(hours, minutes), valid: true };
}

function parseNumberValue(value: unknown): { value: number | null; valid: boolean } {
  if (value === null || value === undefined || normalizeText(value) === null) {
    return { value: null, valid: true };
  }

  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed)) {
    return { value: null, valid: false };
  }

  return { value: parsed, valid: true };
}

function fromDateParts(
  yearText: string,
  monthText: string,
  dayText: string
): { value: string | null; valid: boolean } {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { value: null, valid: false };
  }

  return { value: formatDateParts(year, month, day), valid: true };
}

function excelSerialDate(value: number) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(value) * 24 * 60 * 60 * 1000);
}

function formatDateOnly(date: Date) {
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatTimeOnly(hours: number, minutes: number) {
  return `${pad(hours)}:${pad(minutes)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
