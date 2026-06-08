export interface OrdersKpiDailyReportQuery {
  dateFrom?: string;
  dateTo?: string;
  shopperId?: string;
  pickerSearch?: string;
  vendorId?: string;
  chainId?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: OrdersKpiDailyReportSortBy;
  sortDirection?: OrdersKpiDailyReportSortDirection;
}

export type OrdersKpiDailyReportSortBy =
  | "date"
  | "pickerName"
  | "shopperId"
  | "totalOrders"
  | "successfulOrders"
  | "successRate"
  | "preparationTime";

export type OrdersKpiDailyReportSortDirection = "asc" | "desc";

export type OrdersKpiPerformanceReportView = "CHAIN" | "VENDOR" | "PICKER";

export type OrdersKpiPerformanceReportSortBy =
  | "totalOrders"
  | "uho"
  | "uhoRate"
  | "notOnTime"
  | "qcFailedOrders"
  | "partialRefund"
  | "oos"
  | "priceModified";

export type OrdersKpiPerformanceReportSortDirection = "asc" | "desc";

export interface OrdersKpiPerformanceReportQuery {
  dateFrom?: string;
  dateTo?: string;
  view?: OrdersKpiPerformanceReportView;
  chainId?: string;
  vendorId?: string;
  pickerSearch?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: OrdersKpiPerformanceReportSortBy;
  sortDirection?: OrdersKpiPerformanceReportSortDirection;
}

export interface OrdersKpiDailyReportResponse {
  dateFrom: string;
  dateTo: string;
  summary: OrdersKpiDailyReportSummary;
  pagination: OrdersKpiDailyReportPagination;
  rows: OrdersKpiDailyReportRow[];
}

export interface OrdersKpiPerformanceReportResponse {
  dateFrom: string;
  dateTo: string;
  view: OrdersKpiPerformanceReportView;
  scope: OrdersKpiPerformanceReportScope;
  summary: OrdersKpiPerformanceReportSummary;
  rows: OrdersKpiPerformanceReportRow[];
  pagination: OrdersKpiDailyReportPagination;
}

export interface OrdersKpiPerformanceReportScope {
  chainId: string | null;
  chainName: string | null;
  vendorId: string | null;
  vendorName: string | null;
}

export interface OrdersKpiPerformanceReportSummary {
  totalOrders: number;
  uho: number;
  uhoRate: number | null;
  notOnTime: number;
  qcFailedOrders: number;
  partialRefund: number;
  oos: number;
  priceModified: number;
}

export type OrdersKpiPerformanceReportRow =
  | OrdersKpiChainPerformanceRow
  | OrdersKpiVendorPerformanceRow
  | OrdersKpiPickerPerformanceRow;

export interface OrdersKpiChainPerformanceRow
  extends OrdersKpiPerformanceReportSummary {
  kind: "CHAIN";
  chainId: string | null;
  chainName: string;
  vendorCount: number;
  pickerCount: number;
}

export interface OrdersKpiVendorPerformanceRow
  extends OrdersKpiPerformanceReportSummary {
  kind: "VENDOR";
  chainId: string | null;
  chainName: string | null;
  vendorId: string | null;
  vendorName: string;
  sourceVendorId: string | null;
  pickerCount: number;
}

export interface OrdersKpiPickerPerformanceRow
  extends OrdersKpiPerformanceReportSummary {
  kind: "PICKER";
  chainId: string | null;
  chainName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  sourceVendorId: string | null;
  userId: string;
  pickerName: string;
  shopperId: string;
}

export interface OrdersKpiDailyReportSummary {
  pickerCount: number;
  totalOrders: number;
  successfulOrders: number;
  successRate: number | null;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  orderNotOnTime: number;
  notOnTimeRate: number | null;
  averagePreparationTime: number | null;
  outOfStock: number;
  vendorDelay: number;
  firNotOnTime: number;
  priceModified: number;
}

export interface OrdersKpiDailyReportPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface OrdersKpiDailyReportRow {
  id: string;
  kpiDate: string;
  pickerName: string;
  shopperId: string;
  userId: string;
  sourceVendorId: string;
  matchedVendorId: string | null;
  matchedChainId: string | null;
  totalOrders: number;
  successfulOrders: number;
  successRate: number | null;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  orderNotOnTime: number;
  notOnTimeRate: number | null;
  preparationTime: number | null;
  outOfStock: number;
  vendorDelay: number;
  firNotOnTime: number;
  priceModified: number;
  issuesCount: number;
}
