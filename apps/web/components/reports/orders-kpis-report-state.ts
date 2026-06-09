import type {
  OrdersKpiChainPerformanceRow,
  OrdersKpiPerformanceReportSortBy,
  OrdersKpiPerformanceReportSortDirection,
  OrdersKpiPerformanceReportView,
  OrdersKpiVendorPerformanceRow
} from "@/lib/api/orders-kpis";

import { isIsoDate, yesterdayIsoDate } from "./attendance-date-range";

export interface OrdersKpisReportFilters {
  chainId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  pickerSearch: string;
  sortBy: OrdersKpiPerformanceReportSortBy;
  sortDirection: OrdersKpiPerformanceReportSortDirection;
  vendorId: string;
  view: OrdersKpiPerformanceReportView;
}

const defaultPage = 1;
const defaultPageSize = 50;
const defaultSortBy: OrdersKpiPerformanceReportSortBy = "uhoRate";
const defaultSortDirection: OrdersKpiPerformanceReportSortDirection = "desc";
const defaultView: OrdersKpiPerformanceReportView = "CHAIN";
const pageSizes = new Set([10, 25, 50, 100]);
const sortFields = new Set<OrdersKpiPerformanceReportSortBy>([
  "totalOrders",
  "uho",
  "uhoRate",
  "notOnTime",
  "qcFailedOrders",
  "partialRefund",
  "oos",
  "priceModified"
]);

export function defaultOrdersKpisReportFilters(
  date = yesterdayIsoDate()
): OrdersKpisReportFilters {
  return {
    chainId: "",
    dateFrom: date,
    dateTo: date,
    page: defaultPage,
    pageSize: defaultPageSize,
    pickerSearch: "",
    sortBy: defaultSortBy,
    sortDirection: defaultSortDirection,
    vendorId: "",
    view: defaultView
  };
}

export function parseOrdersKpisReportFilters(
  searchParams: URLSearchParams,
  fallbackDate = yesterdayIsoDate()
): OrdersKpisReportFilters {
  const defaults = defaultOrdersKpisReportFilters(fallbackDate);
  const dateFrom = textParam(searchParams, "dateFrom");
  const dateTo = textParam(searchParams, "dateTo");
  const range =
    dateFrom && dateTo && isIsoDate(dateFrom) && isIsoDate(dateTo) && dateFrom <= dateTo
      ? { dateFrom, dateTo }
      : { dateFrom: defaults.dateFrom, dateTo: defaults.dateTo };

  return {
    ...defaults,
    ...range,
    chainId: textParam(searchParams, "chainId"),
    page: integerParam(searchParams, "page", defaultPage, 1, 1_000_000),
    pageSize: pageSizeParam(searchParams),
    pickerSearch: textParam(searchParams, "pickerSearch"),
    sortBy: sortByParam(searchParams),
    sortDirection: sortDirectionParam(searchParams),
    vendorId: textParam(searchParams, "vendorId"),
    view: viewParam(searchParams)
  };
}

export function serializeOrdersKpisReportFilters(
  filters: OrdersKpisReportFilters
) {
  const params = new URLSearchParams();

  params.set("dateFrom", filters.dateFrom);
  params.set("dateTo", filters.dateTo);
  setNonDefaultString(params, "view", filters.view, defaultView);
  setString(params, "chainId", filters.chainId);
  setString(params, "vendorId", filters.vendorId);
  setString(params, "pickerSearch", filters.pickerSearch);
  setNonDefaultString(params, "sortBy", filters.sortBy, defaultSortBy);
  setNonDefaultString(
    params,
    "sortDirection",
    filters.sortDirection,
    defaultSortDirection
  );
  setNonDefaultNumber(params, "page", filters.page, defaultPage);
  setNonDefaultNumber(params, "pageSize", filters.pageSize, defaultPageSize);

  return params.toString();
}

export function drillDownOrdersKpisChainRow(
  filters: OrdersKpisReportFilters,
  row: OrdersKpiChainPerformanceRow
): OrdersKpisReportFilters | null {
  if (!row.chainId) {
    return null;
  }

  return {
    ...filters,
    chainId: row.chainId,
    page: 1,
    vendorId: "",
    view: "VENDOR"
  };
}

export function drillDownOrdersKpisVendorRow(
  filters: OrdersKpisReportFilters,
  row: OrdersKpiVendorPerformanceRow
): OrdersKpisReportFilters | null {
  if (!row.vendorId) {
    return null;
  }

  return {
    ...filters,
    page: 1,
    vendorId: row.vendorId,
    view: "PICKER"
  };
}

export function selectOrdersKpisReportView(
  filters: OrdersKpisReportFilters,
  view: OrdersKpiPerformanceReportView
): OrdersKpisReportFilters {
  if (view === "CHAIN") {
    return {
      ...filters,
      chainId: "",
      page: 1,
      vendorId: "",
      view
    };
  }

  if (view === "VENDOR") {
    return {
      ...filters,
      page: 1,
      vendorId: "",
      view
    };
  }

  return {
    ...filters,
    page: 1,
    view
  };
}

export function clearOrdersKpisReportScope(
  filters: OrdersKpisReportFilters
): OrdersKpisReportFilters {
  return {
    ...filters,
    chainId: "",
    page: 1,
    vendorId: "",
    view: "CHAIN"
  };
}

export function backToOrdersKpisVendors(
  filters: OrdersKpisReportFilters
): OrdersKpisReportFilters {
  return {
    ...filters,
    page: 1,
    vendorId: "",
    view: "VENDOR"
  };
}

function textParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function integerParam(
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number
) {
  const value = Number(searchParams.get(key));
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function pageSizeParam(searchParams: URLSearchParams) {
  const value = Number(searchParams.get("pageSize"));
  if (!Number.isInteger(value)) {
    return defaultPageSize;
  }

  return pageSizes.has(value) ? value : defaultPageSize;
}

function sortByParam(searchParams: URLSearchParams) {
  const value = textParam(searchParams, "sortBy");
  return sortFields.has(value as OrdersKpiPerformanceReportSortBy)
    ? (value as OrdersKpiPerformanceReportSortBy)
    : defaultSortBy;
}

function sortDirectionParam(
  searchParams: URLSearchParams
): OrdersKpiPerformanceReportSortDirection {
  return searchParams.get("sortDirection") === "asc" ? "asc" : defaultSortDirection;
}

function viewParam(searchParams: URLSearchParams): OrdersKpiPerformanceReportView {
  const value = searchParams.get("view");
  return value === "VENDOR" || value === "PICKER" ? value : defaultView;
}

function setString(params: URLSearchParams, key: string, value: string) {
  const text = value.trim();
  if (text) {
    params.set(key, text);
  }
}

function setNonDefaultString(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string
) {
  if (value !== defaultValue) {
    setString(params, key, value);
  }
}

function setNonDefaultNumber(
  params: URLSearchParams,
  key: string,
  value: number,
  defaultValue: number
) {
  if (value !== defaultValue) {
    params.set(key, String(value));
  }
}
