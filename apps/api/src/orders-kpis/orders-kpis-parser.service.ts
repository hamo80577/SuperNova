import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";

import {
  ORDERS_KPI_INTEGER_METRIC_KEYS,
  type OrdersKpiIntegerMetricKey,
  type OrdersKpiParsedNumber,
  type OrdersKpiParsedRow,
  type OrdersKpiParsedWorkbook
} from "./orders-kpis.types";

type SourceColumnKey =
  | "date"
  | "sourceShopperId"
  | "sourceVendorId"
  | OrdersKpiIntegerMetricKey
  | "preparationTime";

interface ColumnDefinition {
  key: SourceColumnKey;
  label: string;
  aliases: string[];
}

type SourceRowValues = Partial<Record<SourceColumnKey, unknown>>;

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "date", label: "date", aliases: ["date"] },
  { key: "sourceShopperId", label: "shopperId", aliases: ["shopperid"] },
  { key: "sourceVendorId", label: "vendor id", aliases: ["vendorid"] },
  { key: "totalOrders", label: "Total orders", aliases: ["totalorders"] },
  { key: "successfulOrders", label: "Successful orders", aliases: ["successfulorders"] },
  { key: "qcFailedOrders", label: "QC Failed orders", aliases: ["qcfailedorders"] },
  {
    key: "vendorFailedOrders",
    label: "Vendor Failed orders",
    aliases: ["vendorfailedorders"]
  },
  { key: "unhealthyOrders", label: "Unhealthy orders", aliases: ["unhealthyorders"] },
  {
    key: "orderNotOnTime",
    label: "Order not on time",
    aliases: ["ordernotontime"]
  },
  { key: "partialRefund", label: "Partial refund", aliases: ["partialrefund"] },
  { key: "vendorDelay", label: "Vendor delay", aliases: ["vendordelay"] },
  { key: "preparationTime", label: "Preparation time", aliases: ["preparationtime"] },
  { key: "outOfStock", label: "Out of Stock", aliases: ["outofstock"] },
  { key: "firNotOnTime", label: "Fir Not On Time", aliases: ["firnotontime"] },
  { key: "priceModified", label: "Price modified", aliases: ["pricemodified"] }
];

const REQUIRED_COLUMN_LABELS = COLUMN_DEFINITIONS.map((column) => column.label);
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

@Injectable()
export class OrdersKpisParserService {
  async parseFile(buffer: Buffer, fileName: string): Promise<OrdersKpiParsedWorkbook> {
    if (fileName.toLowerCase().endsWith(".csv")) {
      return this.parseCsv(buffer);
    }

    if (fileName.toLowerCase().endsWith(".xlsx")) {
      return this.parseXlsx(buffer);
    }

    try {
      return await this.parseXlsx(buffer);
    } catch {
      return this.parseCsv(buffer);
    }
  }

  private parseCsv(buffer: Buffer): OrdersKpiParsedWorkbook {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const csvRows = parseCsvRows(text);

    if (csvRows.length === 0) {
      return {
        rows: [],
        headers: [],
        missingRequiredColumns: REQUIRED_COLUMN_LABELS,
        skippedBlankRows: 0
      };
    }

    return this.parseTabularRows(csvRows[0], csvRows.slice(1), 2);
  }

  private async parseXlsx(buffer: Buffer): Promise<OrdersKpiParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(toArrayBuffer(buffer));
    } catch {
      throw new Error("Unable to read Orders KPI Excel file.");
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        rows: [],
        headers: [],
        missingRequiredColumns: REQUIRED_COLUMN_LABELS,
        skippedBlankRows: 0
      };
    }

    const headerRow = worksheet.getRow(1);
    const headers = valuesFromWorksheetRow(headerRow, worksheet.columnCount);
    const dataRows: unknown[][] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      dataRows.push(valuesFromWorksheetRow(row, worksheet.columnCount));
    }

    return this.parseTabularRows(headers, dataRows, 2);
  }

  private parseTabularRows(
    headerValues: unknown[],
    dataRows: unknown[][],
    firstDataRowNumber: number
  ): OrdersKpiParsedWorkbook {
    const headers = headerValues.map((value) => cellToText(value) ?? "");
    const columnIndexes = buildColumnIndexes(headers);
    const missingRequiredColumns = COLUMN_DEFINITIONS.filter(
      (column) => columnIndexes.get(column.key) === undefined
    ).map((column) => column.label);
    const rows: OrdersKpiParsedRow[] = [];
    let skippedBlankRows = 0;

    dataRows.forEach((rowValues, rowOffset) => {
      const sourceValues = rowValuesToSourceValues(rowValues, columnIndexes);

      if (isBlankSourceRow(sourceValues)) {
        skippedBlankRows += 1;
        return;
      }

      rows.push(this.parseSourceRow(firstDataRowNumber + rowOffset, sourceValues));
    });

    return {
      rows,
      headers,
      missingRequiredColumns,
      skippedBlankRows
    };
  }

  private parseSourceRow(
    rawRowNumber: number,
    sourceValues: SourceRowValues
  ): OrdersKpiParsedRow {
    const sourceVendorId = normalizeTextValue(sourceValues.sourceVendorId);
    const sourceShopperText = normalizeTextValue(sourceValues.sourceShopperId);
    const shopperIdWasNoData = isNoDataValue(sourceShopperText);
    const sourceShopperId =
      sourceShopperText && !shopperIdWasNoData ? sourceShopperText : null;
    const integerMetrics = {} as Record<
      OrdersKpiIntegerMetricKey,
      OrdersKpiParsedNumber
    >;

    for (const metricKey of ORDERS_KPI_INTEGER_METRIC_KEYS) {
      integerMetrics[metricKey] = parseIntegerMetric(sourceValues[metricKey]);
    }

    return {
      rawRowNumber,
      rowHash: hashSourceRow(rawRowNumber, sourceValues),
      kpiDate: parseKpiDate(sourceValues.date),
      sourceVendorId,
      sourceShopperId,
      shopperIdWasNoData,
      integerMetrics,
      preparationTime: parseDecimalMetric(sourceValues.preparationTime)
    };
  }
}

function buildColumnIndexes(headers: string[]) {
  const indexes = new Map<SourceColumnKey, number>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const definition = COLUMN_DEFINITIONS.find((column) =>
      column.aliases.includes(normalized)
    );

    if (definition && indexes.get(definition.key) === undefined) {
      indexes.set(definition.key, index);
    }
  });

  return indexes;
}

function rowValuesToSourceValues(
  rowValues: unknown[],
  columnIndexes: Map<SourceColumnKey, number>
): SourceRowValues {
  const values: SourceRowValues = {};

  for (const definition of COLUMN_DEFINITIONS) {
    const index = columnIndexes.get(definition.key);
    values[definition.key] = index === undefined ? null : rowValues[index] ?? null;
  }

  return values;
}

function isBlankSourceRow(sourceValues: SourceRowValues) {
  return COLUMN_DEFINITIONS.every((column) => {
    const value = sourceValues[column.key];
    return !normalizeTextValue(value);
  });
}

function valuesFromWorksheetRow(row: ExcelJS.Row, columnCount: number) {
  const values: unknown[] = [];

  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    values.push(normalizeExcelCellValue(row.getCell(columnNumber).value));
  }

  return values;
}

function normalizeExcelCellValue(value: ExcelJS.CellValue | undefined): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  const objectValue = value as unknown as Record<string, unknown>;

  if (typeof objectValue.text === "string") {
    return objectValue.text;
  }

  if (Array.isArray(objectValue.richText)) {
    return objectValue.richText
      .map((part) =>
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
          ? part.text
          : ""
      )
      .join("");
  }

  if (objectValue.result !== undefined && objectValue.result !== null) {
    return normalizeExcelCellValue(objectValue.result as ExcelJS.CellValue);
  }

  return String(value);
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";

      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseKpiDate(value: unknown) {
  const rawValue = cellToText(value);
  const missing = !rawValue;

  if (missing) {
    return {
      rawValue,
      date: null,
      dateString: null,
      isMissing: true,
      isValid: false
    };
  }

  const parsedDate = parseDateValue(value, rawValue);

  return {
    rawValue,
    date: parsedDate,
    dateString: parsedDate ? formatDateOnly(parsedDate) : null,
    isMissing: false,
    isValid: Boolean(parsedDate)
  };
}

function parseDateValue(value: unknown, textValue: string): Date | null {
  if (value instanceof Date && isValidDateParts(value.getFullYear(), value.getMonth(), value.getDate())) {
    return toUtcDateOnly(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  const isoMatch = textValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    return isValidDateParts(year, month, day)
      ? toUtcDateOnly(year, month, day)
      : null;
  }

  const numericValue = Number(textValue);
  if (Number.isFinite(numericValue) && textValue.trim() !== "") {
    return excelSerialToDate(numericValue);
  }

  const monthNameMatch = textValue.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthNameMatch) {
    const month = MONTH_INDEX[monthNameMatch[1].toLowerCase()];
    const day = Number(monthNameMatch[2]);
    const year = Number(monthNameMatch[3]);

    return month !== undefined && isValidDateParts(year, month, day)
      ? toUtcDateOnly(year, month, day)
      : null;
  }

  return null;
}

function excelSerialToDate(serial: number) {
  if (serial <= 0) {
    return null;
  }

  const date = new Date(EXCEL_EPOCH + Math.floor(serial) * ONE_DAY_MS);
  return isValidDateParts(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    ? toUtcDateOnly(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : null;
}

function parseIntegerMetric(value: unknown): OrdersKpiParsedNumber {
  const parsed = parseNumericValue(value);

  return {
    ...parsed,
    value: parsed.isValid && Number.isInteger(parsed.value) ? parsed.value : null,
    isValid: parsed.isValid && Number.isInteger(parsed.value)
  };
}

function parseDecimalMetric(value: unknown): OrdersKpiParsedNumber {
  const parsed = parseNumericValue(value);

  return {
    ...parsed,
    value: parsed.isValid ? parsed.value : null
  };
}

function parseNumericValue(value: unknown): OrdersKpiParsedNumber {
  const rawValue = cellToText(value);
  const isMissing = !rawValue;
  const isNoData = isNoDataValue(rawValue);

  if (isMissing || isNoData) {
    return {
      rawValue,
      value: null,
      isMissing,
      isNoData,
      isValid: false,
      isNegative: false
    };
  }

  const numericValue =
    typeof value === "number"
      ? value
      : Number(rawValue.replaceAll(",", "").trim());
  const isValid = Number.isFinite(numericValue);
  const isNegative = isValid && numericValue < 0;

  return {
    rawValue,
    value: isValid ? numericValue : null,
    isMissing: false,
    isNoData: false,
    isValid,
    isNegative
  };
}

function normalizeTextValue(value: unknown) {
  const text = cellToText(value);
  return text ? text.trim() : null;
}

function cellToText(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const text = String(value).trim();
  return text ? text : null;
}

function isNoDataValue(value: string | null) {
  return value?.trim().toLowerCase() === "no data";
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
  );
}

function toUtcDateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hashSourceRow(rawRowNumber: number, sourceValues: SourceRowValues) {
  const hash = createHash("sha256");
  hash.update(String(rawRowNumber));

  for (const definition of COLUMN_DEFINITIONS) {
    hash.update("|");
    hash.update(cellToText(sourceValues[definition.key]) ?? "");
  }

  return hash.digest("hex");
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}
