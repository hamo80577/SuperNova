import {
  OrdersKpiImportBatchStatus,
  type OrdersKpiIssueCode,
  type OrdersKpiIssueSeverity,
  type OrdersKpiPickerMatchStatus,
  type OrdersKpiVendorMatchStatus,
  type UserRole
} from "@prisma/client";

export const ORDERS_KPI_UNKNOWN_PICKER_KEY = "__UNKNOWN__";
export const ORDERS_KPI_PREVIEW_ACTION = "ORDERS_KPI_IMPORT_PREVIEWED";
export const ORDERS_KPI_CONFIRM_REPLACE_ACTION =
  "ORDERS_KPI_IMPORT_CONFIRMED_REPLACE";
export const ORDERS_KPI_REJECT_ACTION = "ORDERS_KPI_IMPORT_REJECTED";
export const ORDERS_KPI_UPLOAD_MODE = "FULL_DAILY_SNAPSHOT";

export const ORDERS_KPI_INTEGER_METRIC_KEYS = [
  "totalOrders",
  "successfulOrders",
  "qcFailedOrders",
  "vendorFailedOrders",
  "unhealthyOrders",
  "orderNotOnTime",
  "partialRefund",
  "vendorDelay",
  "outOfStock",
  "firNotOnTime",
  "priceModified"
] as const;

export type OrdersKpiIntegerMetricKey =
  (typeof ORDERS_KPI_INTEGER_METRIC_KEYS)[number];

export type OrdersKpiIntegerMetrics = Record<OrdersKpiIntegerMetricKey, number>;

export interface OrdersKpiImportActor {
  id: string;
  role: UserRole;
}

export interface OrdersKpiPreviewImportOptions {
  actor: OrdersKpiImportActor;
  fileName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface OrdersKpiConfirmReplaceRequest {
  acknowledgeReplaceDates?: boolean;
  approveValidRowsOnly?: boolean;
  acknowledgeSkippedErrorRows?: boolean;
}

export interface OrdersKpiConfirmReplaceOptions
  extends OrdersKpiConfirmReplaceRequest {
  actor: OrdersKpiImportActor;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface OrdersKpiRejectImportRequest {
  reason?: string | null;
}

export interface OrdersKpiRejectImportOptions
  extends OrdersKpiRejectImportRequest {
  actor: OrdersKpiImportActor;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface OrdersKpiParsedDate {
  rawValue: string | null;
  date: Date | null;
  dateString: string | null;
  isMissing: boolean;
  isValid: boolean;
}

export interface OrdersKpiParsedNumber {
  rawValue: string | null;
  value: number | null;
  isMissing: boolean;
  isNoData: boolean;
  isValid: boolean;
  isNegative: boolean;
}

export interface OrdersKpiParsedRow {
  rawRowNumber: number;
  rowHash: string;
  kpiDate: OrdersKpiParsedDate;
  sourceVendorId: string | null;
  sourceShopperId: string | null;
  shopperIdWasNoData: boolean;
  integerMetrics: Record<OrdersKpiIntegerMetricKey, OrdersKpiParsedNumber>;
  preparationTime: OrdersKpiParsedNumber;
}

export interface OrdersKpiParsedWorkbook {
  rows: OrdersKpiParsedRow[];
  headers: string[];
  missingRequiredColumns: string[];
  skippedBlankRows: number;
}

export interface OrdersKpiImportIssueDraft {
  rowNumber: number | null;
  sourceVendorId: string | null;
  sourceShopperId: string | null;
  severity: OrdersKpiIssueSeverity;
  issueCode: OrdersKpiIssueCode;
  fieldName: string | null;
  message: string;
}

export interface OrdersKpiStagingRowDraft {
  rawRowNumber: number;
  rowHash: string;
  kpiDate: Date;
  kpiDateString: string;
  sourceVendorId: string;
  matchedVendorId: string | null;
  matchedChainId: string | null;
  vendorNameSnapshot: string | null;
  chainNameSnapshot: string | null;
  vendorMatchStatus: OrdersKpiVendorMatchStatus;
  sourceShopperId: string | null;
  sourcePickerKey: string;
  userId: string | null;
  pickerNameSnapshot: string | null;
  pickerMatchStatus: OrdersKpiPickerMatchStatus;
  totalOrders: number;
  successfulOrders: number;
  qcFailedOrders: number;
  vendorFailedOrders: number;
  unhealthyOrders: number;
  orderNotOnTime: number;
  partialRefund: number;
  vendorDelay: number;
  preparationTime: number | null;
  outOfStock: number;
  firNotOnTime: number;
  priceModified: number;
  issuesCount: number;
}

export interface OrdersKpiPreviewRow {
  rawRowNumber: number;
  kpiDate: string | null;
  sourceVendorId: string | null;
  vendorLabel: string;
  vendorMatchStatus: string | null;
  sourceShopperId: string | null;
  pickerLabel: string;
  pickerMatchStatus: string | null;
  totalOrders: number | null;
  issuesCount: number;
  confirmable: boolean;
}

export interface OrdersKpiValidationSummary {
  matchedVendorRows: number;
  unmappedVendorRows: number;
  matchedPickerRows: number;
  unmatchedShopperRows: number;
  unknownPickerRows: number;
  matchedUserNotPickerRows: number;
}

export interface OrdersKpiValidationResult {
  rowCount: number;
  skippedRows: number;
  errorRows: number;
  warningRows: number;
  coveredDates: string[];
  coveredDateFrom: Date | null;
  coveredDateTo: Date | null;
  coveredDateFromString: string | null;
  coveredDateToString: string | null;
  previewRows: OrdersKpiPreviewRow[];
  stagingRows: OrdersKpiStagingRowDraft[];
  issues: OrdersKpiImportIssueDraft[];
  summary: OrdersKpiValidationSummary;
}

export interface OrdersKpiPreviewResponse {
  batch: {
    id: string;
    fileName: string;
    status: OrdersKpiImportBatchStatus;
    rowCount: number;
    confirmableRows: number;
    skippedRows: number;
    errorRows: number;
    warningRows: number;
    coveredDates: string[];
    coveredDateFrom: string | null;
    coveredDateTo: string | null;
    canConfirm: boolean;
    requiresReviewDecision: boolean;
  };
  summary: OrdersKpiValidationSummary;
  previewRows: OrdersKpiPreviewRow[];
  issues: Array<{
    rowNumber: number | null;
    sourceVendorId: string | null;
    sourceShopperId: string | null;
    severity: OrdersKpiIssueSeverity;
    issueCode: OrdersKpiIssueCode;
    fieldName: string | null;
    message: string;
  }>;
}

export interface OrdersKpiConfirmReplaceResponse {
  batchId: string;
  status: "CONFIRMED";
  coveredDates: string[];
  deletedRecords: number;
  insertedRecords: number;
  skippedRows: number;
  errorRows: number;
  warningRows: number;
  confirmedAt: string;
}

export interface OrdersKpiRejectImportResponse {
  batchId: string;
  status: "REJECTED";
  rejectedAt: string;
  reason: string | null;
}
