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
export const ORDERS_KPI_TARGET_SETTINGS_ID = "global";
export const ORDERS_KPI_TARGET_SETTINGS_UPDATED_ACTION =
  "ORDERS_KPI_TARGET_SETTINGS_UPDATED";
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

export const ORDERS_KPI_PERFORMANCE_REPORT_VIEWS = [
  "CHAIN",
  "VENDOR",
  "PICKER"
] as const;

export type OrdersKpiPerformanceReportView =
  (typeof ORDERS_KPI_PERFORMANCE_REPORT_VIEWS)[number];

export const ORDERS_KPI_PERFORMANCE_REPORT_SORT_KEYS = [
  "totalOrders",
  "unhealthyOrders",
  "unhealthyRate",
  "orderNotOnTime",
  "qcFailedOrders",
  "partialRefund",
  "outOfStock",
  "priceModified"
] as const;

export type OrdersKpiPerformanceReportSortKey =
  (typeof ORDERS_KPI_PERFORMANCE_REPORT_SORT_KEYS)[number];

export type OrdersKpiPerformanceReportSortDirection = "asc" | "desc";

export interface OrdersKpiTargetSettingsValues {
  uhoRateTarget: number;
  notOnTimeRateTarget: number;
  qcFailedRateTarget: number;
  partialRefundRateTarget: number;
  oosRateTarget: number;
  priceModifiedRateTarget: number;
}

export type OrdersKpiTargetSettingsRequest =
  Partial<OrdersKpiTargetSettingsValues>;

export interface OrdersKpiTargetSettingsResponse {
  id: string;
  source: "DEFAULT" | "SAVED";
  targets: OrdersKpiTargetSettingsValues;
  updatedByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type OrdersKpiTargetStatus = "IN_TARGET" | "OUT_OF_TARGET";

export type OrdersKpiTargetEvaluationMetricKey =
  | "unhealthyRate"
  | "orderNotOnTime"
  | "qcFailedOrders"
  | "partialRefund"
  | "outOfStock"
  | "priceModified";

export interface OrdersKpiMetricTargetEvaluation {
  metricKey: OrdersKpiTargetEvaluationMetricKey;
  rate: number;
  target: number;
  status: OrdersKpiTargetStatus;
}

export interface OrdersKpiTargetEvaluation {
  status: OrdersKpiTargetStatus;
  primary: OrdersKpiMetricTargetEvaluation;
  secondaryWarnings: OrdersKpiMetricTargetEvaluation[];
  metrics: Partial<
    Record<OrdersKpiPerformanceReportSortKey, OrdersKpiMetricTargetEvaluation>
  >;
}

export type OrdersKpiPerformanceReportGroupType =
  | "MATCHED_CHAIN"
  | "UNMAPPED_CHAIN"
  | "MATCHED_VENDOR"
  | "UNMAPPED_VENDOR"
  | "MATCHED_PICKER"
  | "UNMATCHED_SHOPPER"
  | "UNKNOWN_PICKER"
  | "MATCHED_USER_NOT_PICKER";

export interface OrdersKpiPerformanceReportQuery {
  dateFrom?: string;
  dateTo?: string;
  view?: string;
  chainId?: string | null;
  unmappedOnly?: string | boolean | null;
  vendorId?: string | null;
  sourceVendorId?: string | null;
  pickerId?: string | null;
  sourceShopperId?: string | null;
  sourcePickerKey?: string | null;
  search?: string | null;
  pickerSearch?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
  sortBy?: string | null;
  sortDirection?: string | null;
}

export interface OrdersKpiMetricSummary extends OrdersKpiIntegerMetrics {
  unhealthyRate: number;
  preparationTime: number | null;
}

export interface OrdersKpiPerformanceSummary {
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number;
  orderNotOnTime: number;
  qcFailedOrders: number;
  partialRefund: number;
  outOfStock: number;
  priceModified: number;
}

export interface OrdersKpiMetricComparison {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
}

export type OrdersKpiMetricComparisons = Record<
  OrdersKpiPerformanceReportSortKey,
  OrdersKpiMetricComparison
>;

export interface OrdersKpiPerformanceTrendPoint {
  date: string;
  metrics: OrdersKpiPerformanceSummary;
}

export interface OrdersKpiPerformanceFilterOption {
  id: string | null;
  label: string;
  sourceVendorId?: string | null;
  sourceShopperId?: string | null;
  sourcePickerKey?: string | null;
  unmappedOnly?: boolean;
}

export interface OrdersKpiPerformanceFilterOptions {
  chains: OrdersKpiPerformanceFilterOption[];
  vendors: OrdersKpiPerformanceFilterOption[];
  pickers: OrdersKpiPerformanceFilterOption[];
}

export interface OrdersKpiPerformanceRow {
  groupKey: string;
  groupType: OrdersKpiPerformanceReportGroupType;
  label: string;
  matchedChainId: string | null;
  matchedVendorId: string | null;
  userId: string | null;
  sourceVendorId: string | null;
  sourceShopperId: string | null;
  sourcePickerKey: string | null;
  vendorMatchStatus: OrdersKpiVendorMatchStatus | null;
  pickerMatchStatus: OrdersKpiPickerMatchStatus | null;
  hasDrilldown: boolean;
  nextView: "VENDOR" | "PICKER" | null;
  drilldownParams: Record<string, string | boolean> | null;
  metrics: OrdersKpiMetricSummary;
  comparison: OrdersKpiMetricComparisons;
  targetEvaluation: OrdersKpiTargetEvaluation;
}

export interface OrdersKpiPerformanceReportResponse {
  filters: {
    dateFrom: string;
    dateTo: string;
    view: OrdersKpiPerformanceReportView;
    chainId: string | null;
    unmappedOnly: boolean;
    vendorId: string | null;
    sourceVendorId: string | null;
    pickerId: string | null;
    sourceShopperId: string | null;
    sourcePickerKey: string | null;
    search: string | null;
    pickerSearch: string | null;
    sortBy: OrdersKpiPerformanceReportSortKey;
    sortDirection: OrdersKpiPerformanceReportSortDirection;
  };
  summary: OrdersKpiPerformanceSummary;
  targets: OrdersKpiTargetSettingsResponse;
  targetEvaluation: OrdersKpiTargetEvaluation;
  comparison: {
    previousPeriod: {
      dateFrom: string;
      dateTo: string;
    };
    summary: OrdersKpiMetricComparisons;
  };
  trend: OrdersKpiPerformanceTrendPoint[];
  filterOptions: OrdersKpiPerformanceFilterOptions;
  rows: OrdersKpiPerformanceRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}
