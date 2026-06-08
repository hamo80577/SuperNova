import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";

import type {
  OrdersKpiParsedRow,
  OrdersKpiParsedWorkbook
} from "./orders-kpis.types";

type OrdersKpiColumnKey = keyof Omit<OrdersKpiParsedRow, "rawRowNumber">;

const canonicalColumns = {
  date: ["date"],
  firNotOnTime: ["firnotontime"],
  orderNotOnTime: ["ordernotontime"],
  outOfStock: ["outofstock"],
  partialRefund: ["partialrefund"],
  preparationTime: ["preparationtime"],
  priceModified: ["pricemodified"],
  qcFailedOrders: ["qcfailedorders"],
  shopperId: ["shopperid"],
  sourceVendorId: ["vendorid"],
  successfulOrders: ["successfulorders"],
  totalOrders: ["totalorders"],
  unhealthyOrders: ["unhealthyorders"],
  vendorDelay: ["vendordelay"],
  vendorFailedOrders: ["vendorfailedorders"]
} satisfies Record<OrdersKpiColumnKey, string[]>;

export const ordersKpiRequiredColumnLabels = {
  date: "date",
  firNotOnTime: "Fir Not On Time",
  orderNotOnTime: "Order not on time",
  outOfStock: "Out of Stock",
  partialRefund: "Partial refund",
  preparationTime: "Preparation time",
  priceModified: "Price modified",
  qcFailedOrders: "QC Failed orders",
  shopperId: "shopperId",
  sourceVendorId: "vendor id",
  successfulOrders: "Successful orders",
  totalOrders: "Total orders",
  unhealthyOrders: "Unhealthy orders",
  vendorDelay: "Vendor delay",
  vendorFailedOrders: "Vendor Failed orders"
} satisfies Record<OrdersKpiColumnKey, string>;

const columnKeys = Object.keys(canonicalColumns) as OrdersKpiColumnKey[];

@Injectable()
export class OrdersKpisParserService {
  async parseFile(
    buffer: Buffer,
    options: { fileName?: string } = {}
  ): Promise<OrdersKpiParsedWorkbook> {
    if (buffer.length === 0) {
      throw new BadRequestException("Orders KPI file is required.");
    }

    if (isXlsxFile(buffer, options.fileName)) {
      return this.parseXlsx(buffer);
    }

    return this.parseCsv(buffer);
  }

  private parseCsv(buffer: Buffer): OrdersKpiParsedWorkbook {
    const rows = parseCsvRows(buffer.toString("utf8").replace(/^\uFEFF/, ""));
    if (rows.length === 0) {
      throw new BadRequestException("Orders KPI CSV file has no rows.");
    }

    const headers = rows[0]?.map((cell) => cell.trim()) ?? [];
    const headerIndex = buildHeaderIndex(headers);
    const parsedRows: OrdersKpiParsedRow[] = [];

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      if (isBlankCsvRow(row)) {
        continue;
      }

      parsedRows.push(buildParsedRow(index + 1, headerIndex, (columnIndex) =>
        columnIndex === null ? null : row[columnIndex] ?? null
      ));
    }

    return { headers, rows: parsedRows };
  }

  private async parseXlsx(buffer: Buffer): Promise<OrdersKpiParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(toArrayBuffer(buffer));
    } catch (error) {
      throw new BadRequestException(
        `Unable to read Orders KPI Excel file: ${
          error instanceof Error ? error.message : "unknown parser error"
        }`
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(
        "Unable to read Orders KPI Excel file: no worksheet found."
      );
    }

    const headerRow = worksheet.getRow(1);
    const headers = readXlsxHeaders(headerRow);
    const headerIndex = buildHeaderIndex(headers);
    const parsedRows: OrdersKpiParsedRow[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      if (isBlankXlsxRow(row, headers.length)) {
        continue;
      }

      parsedRows.push(buildParsedRow(rowNumber, headerIndex, (columnIndex) =>
        columnIndex === null ? null : readCellValue(row.getCell(columnIndex + 1))
      ));
    }

    return { headers, rows: parsedRows };
  }
}

function buildParsedRow(
  rawRowNumber: number,
  headerIndex: Map<OrdersKpiColumnKey, number>,
  readValue: (columnIndex: number | null) => unknown
): OrdersKpiParsedRow {
  const row = { rawRowNumber } as OrdersKpiParsedRow;

  for (const key of columnKeys) {
    row[key] = readValue(headerIndex.get(key) ?? null);
  }

  return row;
}

function buildHeaderIndex(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const headerIndex = new Map<OrdersKpiColumnKey, number>();

  for (const key of columnKeys) {
    const aliases = canonicalColumns[key];
    const index = normalizedHeaders.findIndex((header) =>
      aliases.includes(header)
    );

    if (index >= 0) {
      headerIndex.set(key, index);
    }
  }

  return headerIndex;
}

export function hasOrdersKpiColumn(headers: string[], key: OrdersKpiColumnKey) {
  const aliases = canonicalColumns[key];
  return headers.some((header) => aliases.includes(normalizeHeader(header)));
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new BadRequestException("Orders KPI CSV file has an unclosed quote.");
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function isBlankCsvRow(row: string[]) {
  return row.every((cell) => cell.trim() === "");
}

function readXlsxHeaders(row: ExcelJS.Row) {
  const headers: string[] = [];

  row.eachCell({ includeEmpty: false }, (cell) => {
    const value = normalizeText(readCellValue(cell));
    if (value) {
      headers.push(value);
    }
  });

  return headers;
}

function isBlankXlsxRow(row: ExcelJS.Row, columnCount: number) {
  for (let index = 1; index <= columnCount; index += 1) {
    if (normalizeText(readCellValue(row.getCell(index)))) {
      return false;
    }
  }

  return true;
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

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isXlsxFile(buffer: Buffer, fileName?: string) {
  if (fileName?.toLowerCase().endsWith(".xlsx")) {
    return true;
  }

  return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}
