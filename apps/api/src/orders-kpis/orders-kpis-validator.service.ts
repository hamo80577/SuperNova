import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import {
  hasOrdersKpiColumn,
  ordersKpiRequiredColumnLabels
} from "./orders-kpis-parser.service";
import type {
  OrdersKpiIssueSeverity,
  OrdersKpiMatchedUser,
  OrdersKpiMatchedVendor,
  OrdersKpiParsedRow,
  OrdersKpiParsedWorkbook,
  OrdersKpiPreviewIssue,
  OrdersKpiRowsPreviewItem,
  OrdersKpiValidatedStagingRow,
  OrdersKpiValidationContext,
  OrdersKpiValidationPreview
} from "./orders-kpis.types";

type ParsedDate = {
  date: Date;
  dateOnly: string;
};

type RowDraft = {
  activeAssignmentVendorId: string | null;
  kpiDate: ParsedDate | null;
  matchedUser: OrdersKpiMatchedUser | null;
  matchedVendor: OrdersKpiMatchedVendor | null;
  matchStatus: OrdersKpiRowsPreviewItem["matchStatus"];
  metrics: Omit<
    OrdersKpiValidatedStagingRow,
    | "kpiDate"
    | "shopperId"
    | "userId"
    | "pickerNameSnapshot"
    | "sourceVendorId"
    | "matchedVendorId"
    | "matchedChainId"
    | "rawRowNumber"
    | "rowHash"
    | "issuesCount"
  > | null;
  row: OrdersKpiParsedRow;
  shopperId: string | null;
  sourceVendorId: string | null;
};

const requiredColumnKeys = Object.keys(
  ordersKpiRequiredColumnLabels
) as Array<keyof typeof ordersKpiRequiredColumnLabels>;

const integerMetricFields = [
  ["totalOrders", "Total orders"],
  ["successfulOrders", "Successful orders"],
  ["qcFailedOrders", "QC Failed orders"],
  ["vendorFailedOrders", "Vendor Failed orders"],
  ["unhealthyOrders", "Unhealthy orders"],
  ["orderNotOnTime", "Order not on time"],
  ["partialRefund", "Partial refund"],
  ["vendorDelay", "Vendor delay"],
  ["outOfStock", "Out of Stock"],
  ["firNotOnTime", "Fir Not On Time"],
  ["priceModified", "Price modified"]
] as const;

@Injectable()
export class OrdersKpisValidatorService {
  validateWorkbook(
    workbook: OrdersKpiParsedWorkbook,
    context: OrdersKpiValidationContext
  ): OrdersKpiValidationPreview {
    const issues: OrdersKpiPreviewIssue[] = [];
    const rowIssueCounts = new Map<number, number>();
    const rowErrorCounts = new Map<number, number>();
    const drafts: RowDraft[] = [];

    for (const key of requiredColumnKeys) {
      if (!hasOrdersKpiColumn(workbook.headers, key)) {
        addIssue(issues, rowIssueCounts, rowErrorCounts, {
          rowNumber: null,
          shopperId: null,
          severity: "ERROR",
          issueCode: "MISSING_REQUIRED_COLUMN",
          fieldName: ordersKpiRequiredColumnLabels[key],
          message: `Missing required Orders KPI column: ${ordersKpiRequiredColumnLabels[key]}.`
        });
      }
    }

    for (const row of workbook.rows) {
      drafts.push(
        validateRow(row, context, issues, rowIssueCounts, rowErrorCounts)
      );
    }

    addDuplicateIssues(drafts, issues, rowIssueCounts, rowErrorCounts);

    const validDateOnlyValues = drafts
      .map((draft) => draft.kpiDate?.dateOnly)
      .filter((value): value is string => Boolean(value));
    const stagingRows = buildStagingRows(drafts, rowIssueCounts, rowErrorCounts);
    const errorRows = countRowsBySeverity(issues, "ERROR");
    const warningRows = countRowsBySeverity(issues, "WARNING");

    return {
      rowCount: workbook.rows.length,
      matchedRows: drafts.filter((draft) => draft.matchStatus === "MATCHED_PICKER")
        .length,
      unmatchedRows: drafts.filter(
        (draft) => draft.matchStatus === "UNMATCHED_SHOPPER_ID"
      ).length,
      errorRows,
      warningRows,
      dateFrom: minString(validDateOnlyValues),
      dateTo: maxString(validDateOnlyValues),
      canConfirm: errorRows === 0,
      canApproveValidRows: errorRows > 0 && stagingRows.length > 0,
      canReject: true,
      skippedErrorRows: errorRows,
      issues,
      rowsPreview: drafts.slice(0, 20).map((draft) => ({
        rawRowNumber: draft.row.rawRowNumber,
        kpiDate: draft.kpiDate?.dateOnly ?? null,
        shopperId: draft.shopperId,
        sourceVendorId: draft.sourceVendorId,
        matchStatus: draft.matchStatus,
        issuesCount: rowIssueCounts.get(draft.row.rawRowNumber) ?? 0
      })),
      stagingRows
    };
  }
}

function validateRow(
  row: OrdersKpiParsedRow,
  context: OrdersKpiValidationContext,
  issues: OrdersKpiPreviewIssue[],
  rowIssueCounts: Map<number, number>,
  rowErrorCounts: Map<number, number>
): RowDraft {
  const shopperId = normalizeText(row.shopperId);
  const sourceVendorId = normalizeText(row.sourceVendorId);
  const kpiDate = parseDateValue(row.date);
  const metrics = parseMetrics(row, issues, rowIssueCounts, rowErrorCounts);
  let matchedUser: OrdersKpiMatchedUser | null = null;
  let matchedVendor: OrdersKpiMatchedVendor | null = null;
  let activeAssignmentVendorId: string | null = null;
  let matchStatus: OrdersKpiRowsPreviewItem["matchStatus"] = "NOT_EVALUATED";

  if (!kpiDate) {
    addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
      severity: isMissing(row.date) ? "ERROR" : "ERROR",
      issueCode: isMissing(row.date) ? "MISSING_DATE" : "INVALID_DATE",
      fieldName: "date",
      message: isMissing(row.date)
        ? "date is required for Orders KPI rows."
        : "date must be a valid KPI date."
    }));
  }

  if (!shopperId || isNoData(shopperId)) {
    matchStatus = "UNMATCHED_SHOPPER_ID";
    addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
      severity: "ERROR",
      issueCode: "MISSING_SHOPPER_ID",
      fieldName: "shopperId",
      message: "shopperId is required and cannot be No data."
    }));
  } else {
    matchedUser = context.usersByShopperId.get(shopperId) ?? null;

    if (!matchedUser) {
      matchStatus = "UNMATCHED_SHOPPER_ID";
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "WARNING",
        issueCode: "UNMATCHED_SHOPPER_ID",
        fieldName: "shopperId",
        message: "shopperId does not match a SuperNova User.shopperId."
      }));
    } else if (matchedUser.role !== UserRole.PICKER) {
      matchStatus = "MATCHED_USER_NOT_PICKER";
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "ERROR",
        issueCode: "MATCHED_USER_NOT_PICKER",
        fieldName: "shopperId",
        message: "Matched SuperNova user is not role PICKER."
      }));
    } else {
      matchStatus = "MATCHED_PICKER";
      activeAssignmentVendorId =
        context.activeAssignmentsByPickerId.get(matchedUser.id) ?? null;

      if (!activeAssignmentVendorId) {
        addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
          severity: "WARNING",
          issueCode: "NO_ACTIVE_BRANCH_ASSIGNMENT",
          fieldName: "shopperId",
          message: "Picker has no active branch assignment."
        }));
      }
    }
  }

  if (!sourceVendorId) {
    addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
      severity: "ERROR",
      issueCode: "MISSING_VENDOR_ID",
      fieldName: "vendor id",
      message: "vendor id is required for Orders KPI rows."
    }));
  } else {
    matchedVendor = findVendorMatch(sourceVendorId, context.vendorsBySourceVendorId);

    if (!matchedVendor) {
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "WARNING",
        issueCode: "UNMAPPED_VENDOR_ID",
        fieldName: "vendor id",
        message: "vendor id is not mapped to a SuperNova Vendor."
      }));
    }
  }

  if (metrics) {
    if (metrics.successfulOrders > metrics.totalOrders) {
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "ERROR",
        issueCode: "SUCCESSFUL_ORDERS_EXCEED_TOTAL",
        fieldName: "Successful orders",
        message: "Successful orders cannot exceed Total orders."
      }));
    }

    if (metrics.unhealthyOrders > metrics.totalOrders) {
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "WARNING",
        issueCode: "UNHEALTHY_ORDERS_EXCEED_TOTAL",
        fieldName: "Unhealthy orders",
        message: "Unhealthy orders is greater than Total orders."
      }));
    }

    if (metrics.orderNotOnTime > metrics.totalOrders) {
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "WARNING",
        issueCode: "ORDER_NOT_ON_TIME_EXCEED_TOTAL",
        fieldName: "Order not on time",
        message: "Order not on time is greater than Total orders."
      }));
    }
  }

  return {
    activeAssignmentVendorId,
    kpiDate,
    matchedUser,
    matchedVendor,
    matchStatus,
    metrics,
    row,
    shopperId,
    sourceVendorId
  };
}

function parseMetrics(
  row: OrdersKpiParsedRow,
  issues: OrdersKpiPreviewIssue[],
  rowIssueCounts: Map<number, number>,
  rowErrorCounts: Map<number, number>
) {
  const parsed = {} as Record<string, number>;

  for (const [fieldName, label] of integerMetricFields) {
    const result = parseIntegerMetric(row[fieldName]);

    if (!result.valid) {
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
        severity: "ERROR",
        issueCode: result.negative
          ? "NEGATIVE_NUMERIC_VALUE"
          : "INVALID_NUMERIC_VALUE",
        fieldName: label,
        message: `${label} must be a non-negative integer.`
      }));
      continue;
    }

    parsed[fieldName] = result.value;
  }

  const preparationTime = parsePreparationTime(row.preparationTime);
  if (!preparationTime.valid) {
    addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(row, {
      severity: preparationTime.missing ? "WARNING" : "ERROR",
      issueCode: preparationTime.missing
        ? "PREPARATION_TIME_MISSING"
        : "INVALID_NUMERIC_VALUE",
      fieldName: "Preparation time",
      message: preparationTime.missing
        ? "Preparation time is missing or No data and will be stored as null."
        : "Preparation time must be a non-negative number when present."
    }));
  }

  if (integerMetricFields.some(([fieldName]) => parsed[fieldName] === undefined)) {
    return null;
  }

  return {
    totalOrders: parsed["totalOrders"]!,
    successfulOrders: parsed["successfulOrders"]!,
    qcFailedOrders: parsed["qcFailedOrders"]!,
    vendorFailedOrders: parsed["vendorFailedOrders"]!,
    unhealthyOrders: parsed["unhealthyOrders"]!,
    orderNotOnTime: parsed["orderNotOnTime"]!,
    partialRefund: parsed["partialRefund"]!,
    vendorDelay: parsed["vendorDelay"]!,
    preparationTime: preparationTime.value,
    outOfStock: parsed["outOfStock"]!,
    firNotOnTime: parsed["firNotOnTime"]!,
    priceModified: parsed["priceModified"]!,
    successRate: percentage(parsed["successfulOrders"]!, parsed["totalOrders"]!),
    unhealthyRate: percentage(parsed["unhealthyOrders"]!, parsed["totalOrders"]!),
    notOnTimeRate: percentage(parsed["orderNotOnTime"]!, parsed["totalOrders"]!)
  };
}

function addDuplicateIssues(
  drafts: RowDraft[],
  issues: OrdersKpiPreviewIssue[],
  rowIssueCounts: Map<number, number>,
  rowErrorCounts: Map<number, number>
) {
  const groups = new Map<string, RowDraft[]>();

  for (const draft of drafts) {
    if (!draft.kpiDate || !draft.shopperId || !draft.sourceVendorId) {
      continue;
    }

    const key = [
      draft.kpiDate.dateOnly,
      draft.shopperId.trim().toUpperCase(),
      draft.sourceVendorId.trim().toUpperCase()
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const draft of group) {
      addIssue(issues, rowIssueCounts, rowErrorCounts, rowIssue(draft.row, {
        severity: "ERROR",
        issueCode: "DUPLICATE_KPI_ROW",
        fieldName: "date",
        message: "Duplicate date + shopperId + vendor id rows are not allowed in one file."
      }));
    }
  }
}

function buildStagingRows(
  drafts: RowDraft[],
  rowIssueCounts: Map<number, number>,
  rowErrorCounts: Map<number, number>
): OrdersKpiValidatedStagingRow[] {
  return drafts.flatMap((draft) => {
    if (
      !draft.kpiDate ||
      !draft.shopperId ||
      !draft.sourceVendorId ||
      !draft.matchedUser ||
      draft.matchedUser.role !== UserRole.PICKER ||
      !draft.metrics ||
      (rowErrorCounts.get(draft.row.rawRowNumber) ?? 0) > 0
    ) {
      return [];
    }

    return [{
      kpiDate: draft.kpiDate.dateOnly,
      shopperId: draft.shopperId,
      userId: draft.matchedUser.id,
      pickerNameSnapshot: draft.matchedUser.nameEn,
      sourceVendorId: draft.sourceVendorId,
      matchedVendorId: draft.matchedVendor?.id ?? null,
      matchedChainId: draft.matchedVendor?.chainId ?? null,
      rawRowNumber: draft.row.rawRowNumber,
      rowHash: hashRow(draft.row),
      issuesCount: rowIssueCounts.get(draft.row.rawRowNumber) ?? 0,
      ...draft.metrics
    }];
  });
}

function addIssue(
  issues: OrdersKpiPreviewIssue[],
  rowIssueCounts: Map<number, number>,
  rowErrorCounts: Map<number, number>,
  issue: OrdersKpiPreviewIssue
) {
  issues.push(issue);

  if (issue.rowNumber === null) {
    return;
  }

  rowIssueCounts.set(issue.rowNumber, (rowIssueCounts.get(issue.rowNumber) ?? 0) + 1);
  if (issue.severity === "ERROR") {
    rowErrorCounts.set(issue.rowNumber, (rowErrorCounts.get(issue.rowNumber) ?? 0) + 1);
  }
}

function rowIssue(
  row: OrdersKpiParsedRow,
  issue: Omit<OrdersKpiPreviewIssue, "rowNumber" | "shopperId">
): OrdersKpiPreviewIssue {
  return {
    rowNumber: row.rawRowNumber,
    shopperId: normalizeText(row.shopperId),
    ...issue
  };
}

function countRowsBySeverity(
  issues: OrdersKpiPreviewIssue[],
  severity: OrdersKpiIssueSeverity
) {
  const rowNumbers = new Set<number>();
  let fileIssues = 0;

  for (const issue of issues) {
    if (issue.severity !== severity) {
      continue;
    }

    if (issue.rowNumber === null) {
      fileIssues += 1;
    } else {
      rowNumbers.add(issue.rowNumber);
    }
  }

  return rowNumbers.size + fileIssues;
}

function parseDateValue(value: unknown): ParsedDate | null {
  if (isMissing(value)) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return parsedDateFromParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return parsedDateFromParts(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  }

  const text = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (isoMatch) {
    return parsedDateFromParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
  }

  const monthNameMatch =
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s*(\d{4})$/i.exec(
      text
    );
  if (monthNameMatch) {
    return parsedDateFromParts(
      Number(monthNameMatch[3]),
      monthIndex(monthNameMatch[1]!) + 1,
      Number(monthNameMatch[2])
    );
  }

  return null;
}

function parsedDateFromParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    date,
    dateOnly: `${year}-${pad(month)}-${pad(day)}`
  };
}

function monthIndex(value: string) {
  return ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(
    value.slice(0, 3).toUpperCase()
  );
}

function parseIntegerMetric(value: unknown) {
  if (isMissing(value) || isNoData(String(value))) {
    return { valid: false, value: 0, negative: false };
  }

  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { valid: false, value: 0, negative: false };
  }

  if (parsed < 0) {
    return { valid: false, value: parsed, negative: true };
  }

  return { valid: true, value: parsed, negative: false };
}

function parsePreparationTime(value: unknown) {
  if (isMissing(value) || isNoData(String(value))) {
    return { valid: false, value: null, missing: true };
  }

  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, value: null, missing: false };
  }

  return { valid: true, value: parsed, missing: false };
}

function normalizeText(value: unknown) {
  if (isMissing(value)) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function isMissing(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  return typeof value === "string" && value.trim() === "";
}

function isNoData(value: string) {
  return value.trim().toLowerCase() === "no data";
}

function findVendorMatch(
  sourceVendorId: string,
  vendorsBySourceVendorId: Map<string, OrdersKpiMatchedVendor>
) {
  return (
    vendorsBySourceVendorId.get(sourceVendorId) ??
    vendorsBySourceVendorId.get(sourceVendorId.toUpperCase()) ??
    null
  );
}

function percentage(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 10_000) / 100 : null;
}

function minString(values: string[]) {
  return values.length ? [...values].sort()[0] ?? null : null;
}

function maxString(values: string[]) {
  return values.length ? [...values].sort().at(-1) ?? null : null;
}

function hashRow(row: OrdersKpiParsedRow) {
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
