import { apiGet, apiRequest, clearApiCache } from "./request";

export type OrdersKpiImportBatchStatus =
  | "VALIDATED"
  | "NEEDS_REVIEW"
  | "CONFIRMED"
  | "REJECTED"
  | "FAILED";

export type OrdersKpiIssueSeverity = "ERROR" | "WARNING";

export type OrdersKpiIssueCode =
  | "MISSING_REQUIRED_COLUMN"
  | "MISSING_DATE"
  | "INVALID_DATE"
  | "MISSING_SHOPPER_ID"
  | "MISSING_VENDOR_ID"
  | "INVALID_NUMERIC_VALUE"
  | "NEGATIVE_NUMERIC_VALUE"
  | "SUCCESSFUL_ORDERS_EXCEED_TOTAL"
  | "DUPLICATE_KPI_ROW"
  | "MATCHED_USER_NOT_PICKER"
  | "UNMATCHED_SHOPPER_ID"
  | "PREPARATION_TIME_MISSING"
  | "UNMAPPED_VENDOR_ID"
  | "UNHEALTHY_ORDERS_EXCEED_TOTAL"
  | "ORDER_NOT_ON_TIME_EXCEED_TOTAL"
  | "NO_ACTIVE_BRANCH_ASSIGNMENT";

export type OrdersKpiDailyReportSortBy =
  | "date"
  | "pickerName"
  | "shopperId"
  | "totalOrders"
  | "successfulOrders"
  | "successRate"
  | "preparationTime";

export type OrdersKpiDailyReportSortDirection = "asc" | "desc";

export interface OrdersKpiDailyReportQuery {
  chainId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  pickerSearch?: string;
  shopperId?: string;
  sortBy?: OrdersKpiDailyReportSortBy;
  sortDirection?: OrdersKpiDailyReportSortDirection;
  vendorId?: string;
}

export interface OrdersKpiImportPreviewResponse {
  batchId: string;
  canApproveValidRows: boolean;
  canConfirm: boolean;
  canReject: boolean;
  issueCount: number;
  preview: OrdersKpiValidationPreview;
  skippedErrorRows: number;
  stagingRowCount: number;
  status: OrdersKpiImportBatchStatus;
}

export interface OrdersKpiValidationPreview {
  canApproveValidRows: boolean;
  canConfirm: boolean;
  canReject: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  errorRows: number;
  issues: OrdersKpiPreviewIssue[];
  matchedRows: number;
  rowCount: number;
  rowsPreview: OrdersKpiRowsPreviewItem[];
  skippedErrorRows: number;
  stagingRows: OrdersKpiValidatedStagingRow[];
  unmatchedRows: number;
  warningRows: number;
}

export interface OrdersKpiPreviewIssue {
  fieldName: string | null;
  issueCode: OrdersKpiIssueCode;
  message: string;
  rowNumber: number | null;
  severity: OrdersKpiIssueSeverity;
  shopperId: string | null;
}

export interface OrdersKpiRowsPreviewItem {
  issuesCount: number;
  kpiDate: string | null;
  matchStatus:
    | "MATCHED_PICKER"
    | "UNMATCHED_SHOPPER_ID"
    | "MATCHED_USER_NOT_PICKER"
    | "NOT_EVALUATED";
  rawRowNumber: number;
  shopperId: string | null;
  sourceVendorId: string | null;
}

export interface OrdersKpiValidatedStagingRow {
  firNotOnTime: number;
  issuesCount: number;
  kpiDate: string;
  matchedChainId: string | null;
  matchedVendorId: string | null;
  notOnTimeRate: number | null;
  orderNotOnTime: number;
  outOfStock: number;
  partialRefund: number;
  pickerNameSnapshot: string;
  preparationTime: number | null;
  priceModified: number;
  qcFailedOrders: number;
  rawRowNumber: number;
  rowHash: string;
  shopperId: string;
  sourceVendorId: string;
  successRate: number | null;
  successfulOrders: number;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  userId: string;
  vendorDelay: number;
  vendorFailedOrders: number;
}

export interface OrdersKpiImportConfirmResponse {
  approvedWithErrors: boolean;
  batchId: string;
  confirmedAt: string;
  dateFrom: string | null;
  dateTo: string | null;
  errorRows: number;
  insertedCount: number;
  rowCount: number;
  skippedErrorRows: number;
  status: OrdersKpiImportBatchStatus;
  updatedCount: number;
  warningRows: number;
}

export interface OrdersKpiApproveValidRowsRequest {
  acknowledgeSkippedErrorRows: boolean;
}

export interface OrdersKpiImportRejectResponse {
  batchId: string;
  dateFrom: string | null;
  dateTo: string | null;
  errorRows: number;
  rejectedAt: string;
  rowCount: number;
  stagingRowCount: number;
  status: OrdersKpiImportBatchStatus;
  warningRows: number;
}

export interface OrdersKpiDailyReportResponse {
  dateFrom: string;
  dateTo: string;
  pagination: OrdersKpiDailyReportPagination;
  rows: OrdersKpiDailyReportRow[];
  summary: OrdersKpiDailyReportSummary;
}

export interface OrdersKpiDailyReportSummary {
  averagePreparationTime: number | null;
  firNotOnTime: number;
  notOnTimeRate: number | null;
  orderNotOnTime: number;
  outOfStock: number;
  pickerCount: number;
  priceModified: number;
  successRate: number | null;
  successfulOrders: number;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  vendorDelay: number;
}

export interface OrdersKpiDailyReportPagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
}

export interface OrdersKpiDailyReportRow {
  firNotOnTime: number;
  id: string;
  issuesCount: number;
  kpiDate: string;
  matchedChainId: string | null;
  matchedVendorId: string | null;
  notOnTimeRate: number | null;
  orderNotOnTime: number;
  outOfStock: number;
  pickerName: string;
  preparationTime: number | null;
  priceModified: number;
  shopperId: string;
  sourceVendorId: string;
  successRate: number | null;
  successfulOrders: number;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  userId: string;
  vendorDelay: number;
}

const ordersKpiDailyReportPathPrefix = "/orders-kpis/reports/daily";

export function buildOrdersKpiDailyReportPath(
  query: OrdersKpiDailyReportQuery
) {
  const params = new URLSearchParams();

  setString(params, "dateFrom", query.dateFrom);
  setString(params, "dateTo", query.dateTo);
  setString(params, "shopperId", query.shopperId);
  setString(params, "pickerSearch", query.pickerSearch);
  setString(params, "vendorId", query.vendorId);
  setString(params, "chainId", query.chainId);
  setString(params, "sortBy", query.sortBy);
  setString(params, "sortDirection", query.sortDirection);
  setNumber(params, "page", query.page);
  setNumber(params, "pageSize", query.pageSize);

  const serialized = params.toString();
  return `${ordersKpiDailyReportPathPrefix}${serialized ? `?${serialized}` : ""}`;
}

export function buildOrdersKpiImportPreviewFormData(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return formData;
}

export function buildOrdersKpiImportConfirmPath(batchId: string) {
  return `/orders-kpis/imports/${encodeURIComponent(batchId)}/confirm`;
}

export function buildOrdersKpiApproveValidRowsPath(batchId: string) {
  return `/orders-kpis/imports/${encodeURIComponent(batchId)}/approve-valid-rows`;
}

export function buildOrdersKpiRejectImportPath(batchId: string) {
  return `/orders-kpis/imports/${encodeURIComponent(batchId)}/reject`;
}

export function clearOrdersKpiDailyReportCache() {
  clearApiCache(ordersKpiDailyReportPathPrefix);
}

export const ordersKpisApi = {
  async approveValidRows(
    batchId: string,
    body: OrdersKpiApproveValidRowsRequest
  ) {
    const result = await apiRequest<OrdersKpiImportConfirmResponse>(
      buildOrdersKpiApproveValidRowsPath(batchId),
      {
        body: JSON.stringify(body),
        method: "POST"
      }
    );
    clearOrdersKpiDailyReportCache();
    return result;
  },
  clearDailyReportCache() {
    clearOrdersKpiDailyReportCache();
  },
  async confirmImport(batchId: string) {
    const result = await apiRequest<OrdersKpiImportConfirmResponse>(
      buildOrdersKpiImportConfirmPath(batchId),
      {
        method: "POST"
      }
    );
    clearOrdersKpiDailyReportCache();
    return result;
  },
  dailyReport(query: OrdersKpiDailyReportQuery) {
    return apiGet<OrdersKpiDailyReportResponse>(
      buildOrdersKpiDailyReportPath(query)
    );
  },
  previewImport(file: File) {
    return apiRequest<OrdersKpiImportPreviewResponse>(
      "/orders-kpis/imports/preview",
      {
        body: buildOrdersKpiImportPreviewFormData(file),
        method: "POST"
      }
    );
  },
  rejectImport(batchId: string) {
    return apiRequest<OrdersKpiImportRejectResponse>(
      buildOrdersKpiRejectImportPath(batchId),
      {
        method: "POST"
      }
    );
  }
};

function setString(
  params: URLSearchParams,
  key: string,
  value: string | undefined
) {
  const text = value?.trim();
  if (text) {
    params.set(key, text);
  }
}

function setNumber(
  params: URLSearchParams,
  key: string,
  value: number | undefined
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    params.set(key, String(value));
  }
}
