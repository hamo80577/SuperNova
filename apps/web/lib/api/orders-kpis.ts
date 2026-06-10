import { apiGet, apiRequest, clearApiCache } from "./request";

export type OrdersKpiImportBatchStatus =
  | "VALIDATED"
  | "NEEDS_REVIEW"
  | "CONFIRMED"
  | "REJECTED"
  | "FAILED";

export type OrdersKpiIssueSeverity = "WARNING" | "ERROR";

export type OrdersKpiPerformanceReportView = "CHAIN" | "VENDOR" | "PICKER";

export type OrdersKpiPerformanceReportSortKey =
  | "totalOrders"
  | "unhealthyOrders"
  | "unhealthyRate"
  | "orderNotOnTime"
  | "qcFailedOrders"
  | "partialRefund"
  | "outOfStock"
  | "priceModified";

export type OrdersKpiPerformanceReportSortDirection = "asc" | "desc";

export type OrdersKpiPerformanceReportGroupType =
  | "MATCHED_CHAIN"
  | "UNMAPPED_CHAIN"
  | "MATCHED_VENDOR"
  | "UNMAPPED_VENDOR"
  | "MATCHED_PICKER"
  | "UNMATCHED_SHOPPER"
  | "UNKNOWN_PICKER"
  | "MATCHED_USER_NOT_PICKER";

export type OrdersKpiVendorMatchStatus =
  | "MATCHED"
  | "UNMAPPED_VENDOR_ID";

export type OrdersKpiPickerMatchStatus =
  | "MATCHED"
  | "UNMATCHED_SHOPPER_ID"
  | "UNKNOWN_PICKER"
  | "MATCHED_USER_NOT_PICKER";

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

export interface OrdersKpiPreviewIssue {
  rowNumber: number | null;
  sourceVendorId: string | null;
  sourceShopperId: string | null;
  severity: OrdersKpiIssueSeverity;
  issueCode: string;
  fieldName: string | null;
  message: string;
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
  issues: OrdersKpiPreviewIssue[];
}

export interface OrdersKpiConfirmReplaceRequest {
  acknowledgeReplaceDates?: boolean;
  approveValidRowsOnly?: boolean;
  acknowledgeSkippedErrorRows?: boolean;
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

export interface OrdersKpiRejectImportRequest {
  reason?: string | null;
}

export interface OrdersKpiRejectImportResponse {
  batchId: string;
  status: "REJECTED";
  rejectedAt: string;
  reason: string | null;
}

export interface OrdersKpiMetricSummary {
  totalOrders: number;
  successfulOrders: number;
  qcFailedOrders: number;
  vendorFailedOrders: number;
  unhealthyOrders: number;
  orderNotOnTime: number;
  partialRefund: number;
  vendorDelay: number;
  outOfStock: number;
  firNotOnTime: number;
  priceModified: number;
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
}

export interface OrdersKpiPerformanceReportQuery {
  dateFrom?: string;
  dateTo?: string;
  view?: OrdersKpiPerformanceReportView;
  chainId?: string | null;
  unmappedOnly?: boolean | null;
  vendorId?: string | null;
  sourceVendorId?: string | null;
  pickerSearch?: string | null;
  page?: number | null;
  pageSize?: number | null;
  sortBy?: OrdersKpiPerformanceReportSortKey | null;
  sortDirection?: OrdersKpiPerformanceReportSortDirection | null;
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
    pickerSearch: string | null;
    sortBy: OrdersKpiPerformanceReportSortKey;
    sortDirection: OrdersKpiPerformanceReportSortDirection;
  };
  summary: OrdersKpiPerformanceSummary;
  rows: OrdersKpiPerformanceRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export function buildOrdersKpiImportPreviewFormData(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export function buildOrdersKpiImportConfirmReplacePath(batchId: string) {
  return `/orders-kpis/imports/${encodeURIComponent(batchId)}/confirm-replace`;
}

export function buildOrdersKpiImportRejectPath(batchId: string) {
  return `/orders-kpis/imports/${encodeURIComponent(batchId)}/reject`;
}

export function buildOrdersKpiPerformanceReportPath(
  query: OrdersKpiPerformanceReportQuery
) {
  const params = new URLSearchParams();

  appendQueryParam(params, "dateFrom", query.dateFrom);
  appendQueryParam(params, "dateTo", query.dateTo);
  appendQueryParam(params, "view", query.view);
  appendQueryParam(params, "chainId", query.chainId);
  appendQueryParam(params, "unmappedOnly", query.unmappedOnly);
  appendQueryParam(params, "vendorId", query.vendorId);
  appendQueryParam(params, "sourceVendorId", query.sourceVendorId);
  appendQueryParam(params, "pickerSearch", query.pickerSearch);
  appendQueryParam(params, "page", query.page);
  appendQueryParam(params, "pageSize", query.pageSize);
  appendQueryParam(params, "sortBy", query.sortBy);
  appendQueryParam(params, "sortDirection", query.sortDirection);

  const search = params.toString();
  return `/orders-kpis/reports/performance${search ? `?${search}` : ""}`;
}

export function clearOrdersKpiPerformanceReportCache() {
  clearApiCache("/orders-kpis/reports/performance");
}

export const ordersKpisApi = {
  confirmReplaceImport(batchId: string, request: OrdersKpiConfirmReplaceRequest) {
    return apiRequest<OrdersKpiConfirmReplaceResponse>(
      buildOrdersKpiImportConfirmReplacePath(batchId),
      {
        body: JSON.stringify(request),
        method: "POST"
      }
    ).then((response) => {
      clearOrdersKpiPerformanceReportCache();
      return response;
    });
  },
  performanceReport(query: OrdersKpiPerformanceReportQuery) {
    return apiGet<OrdersKpiPerformanceReportResponse>(
      buildOrdersKpiPerformanceReportPath(query)
    );
  },
  previewImport(file: File) {
    return apiRequest<OrdersKpiPreviewResponse>("/orders-kpis/imports/preview", {
      body: buildOrdersKpiImportPreviewFormData(file),
      method: "POST"
    });
  },
  rejectImport(batchId: string, request: OrdersKpiRejectImportRequest) {
    return apiRequest<OrdersKpiRejectImportResponse>(
      buildOrdersKpiImportRejectPath(batchId),
      {
        body: JSON.stringify(request),
        method: "POST"
      }
    ).then((response) => {
      clearOrdersKpiPerformanceReportCache();
      return response;
    });
  }
};

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: boolean | number | string | null | undefined
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}
