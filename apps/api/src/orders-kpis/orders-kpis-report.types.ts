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

export interface OrdersKpiDailyReportResponse {
  dateFrom: string;
  dateTo: string;
  summary: OrdersKpiDailyReportSummary;
  pagination: OrdersKpiDailyReportPagination;
  rows: OrdersKpiDailyReportRow[];
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
