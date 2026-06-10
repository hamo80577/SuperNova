"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  RotateCcw,
  Search
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AttendanceDateRangeSelector } from "@/components/reports/attendance-date-range-selector";
import {
  formatDateLong,
  normalizeAttendanceDateRange,
  validateAttendanceDateRange,
  yesterdayIsoDate
} from "@/components/reports/attendance-date-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ordersKpisApi,
  type OrdersKpiPerformanceReportQuery,
  type OrdersKpiPerformanceReportResponse,
  type OrdersKpiPerformanceReportSortDirection,
  type OrdersKpiPerformanceReportSortKey,
  type OrdersKpiPerformanceReportView,
  type OrdersKpiPerformanceRow
} from "@/lib/api/orders-kpis";

type ReportStatus = "idle" | "loading" | "success" | "error";

const viewOptions: Array<{ label: string; value: OrdersKpiPerformanceReportView }> = [
  { label: "Chain View", value: "CHAIN" },
  { label: "Vendor View", value: "VENDOR" },
  { label: "Picker View", value: "PICKER" }
];

const sortOptions: Array<{ label: string; value: OrdersKpiPerformanceReportSortKey }> = [
  { label: "Total Orders", value: "totalOrders" },
  { label: "UHO", value: "unhealthyOrders" },
  { label: "UHO %", value: "unhealthyRate" },
  { label: "Not on time", value: "orderNotOnTime" },
  { label: "QC Failed Orders", value: "qcFailedOrders" },
  { label: "Partial Refund", value: "partialRefund" },
  { label: "OOS", value: "outOfStock" },
  { label: "Price Modified", value: "priceModified" }
];

const pageSizeOptions = [10, 25, 50, 100];
const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

export function OrdersKpiReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseReportFilters(searchParams), [searchParams]);
  const [pickerSearchDraft, setPickerSearchDraft] = useState(filters.pickerSearch ?? "");
  const [report, setReport] = useState<OrdersKpiPerformanceReportResponse | null>(null);
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const dateRangeError = validateAttendanceDateRange(filters.dateFrom, filters.dateTo);
  const pickerScopeError =
    filters.view === "PICKER" && !filters.vendorId && !filters.sourceVendorId
      ? "Open Picker View from a vendor row or choose a vendor-scoped link."
      : null;
  const queryError = dateRangeError ?? pickerScopeError;
  const query = useMemo<OrdersKpiPerformanceReportQuery>(
    () => ({
      chainId: filters.chainId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      pageSize: filters.pageSize,
      pickerSearch: filters.pickerSearch,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      sourceVendorId: filters.sourceVendorId,
      unmappedOnly: filters.unmappedOnly,
      vendorId: filters.vendorId,
      view: filters.view
    }),
    [filters]
  );
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    setPickerSearchDraft(filters.pickerSearch ?? "");
  }, [filters.pickerSearch]);

  useEffect(() => {
    if (queryError) {
      setStatus("idle");
      setReport(null);
      setError(null);
      return;
    }

    let ignore = false;
    setStatus("loading");
    setError(null);

    ordersKpisApi
      .performanceReport(query)
      .then((response) => {
        if (ignore) {
          return;
        }
        setReport(response);
        setStatus("success");
      })
      .catch((fetchError: unknown) => {
        if (ignore) {
          return;
        }
        setError(getErrorMessage(fetchError));
        setStatus("error");
      });

    return () => {
      ignore = true;
    };
  }, [query, queryError, queryKey]);

  function updateFilters(updates: Record<string, string | number | boolean | null>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === undefined) {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, String(value));
    });

    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function resetFilters() {
    const yesterday = yesterdayIsoDate();
    router.push(`${pathname}?dateFrom=${yesterday}&dateTo=${yesterday}&view=CHAIN`);
  }

  function handleDateRangeChange(dateFrom: string, dateTo: string) {
    updateFilters({ dateFrom, dateTo, page: 1 });
  }

  function handleViewChange(view: OrdersKpiPerformanceReportView) {
    if (view === "CHAIN") {
      updateFilters({
        chainId: null,
        chainLabel: null,
        page: 1,
        pickerSearch: null,
        sourceVendorId: null,
        unmappedOnly: null,
        vendorId: null,
        vendorLabel: null,
        view
      });
      return;
    }

    if (view === "VENDOR") {
      updateFilters({
        page: 1,
        pickerSearch: null,
        sourceVendorId: null,
        vendorId: null,
        vendorLabel: null,
        view
      });
      return;
    }

    updateFilters({ page: 1, view });
  }

  function handlePickerSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ page: 1, pickerSearch: pickerSearchDraft.trim() || null });
  }

  function handleDrilldown(row: OrdersKpiPerformanceRow) {
    if (!row.hasDrilldown || !row.nextView || !row.drilldownParams) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", row.nextView);
    nextParams.set("page", "1");
    nextParams.delete("pickerSearch");
    nextParams.delete("vendorId");
    nextParams.delete("sourceVendorId");

    if (row.nextView === "VENDOR") {
      nextParams.delete("chainId");
      nextParams.delete("unmappedOnly");
      nextParams.delete("vendorLabel");
      nextParams.set("chainLabel", getRowLabel(row));
    }

    if (row.nextView === "PICKER") {
      nextParams.set("vendorLabel", getRowLabel(row));
    }

    Object.entries(row.drilldownParams).forEach(([key, value]) => {
      nextParams.set(key, String(value));
    });

    router.push(`${pathname}?${nextParams.toString()}`);
  }

  const summary = report?.summary ?? null;
  const rows = report?.rows ?? [];
  const pagination = report?.pagination ?? null;
  const isLoading = status === "loading";
  const isEmpty = status === "success" && !rows.length;

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-slate-50/80 p-3 sm:p-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4">
          <AttendanceDateRangeSelector
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            error={dateRangeError}
            onChange={handleDateRangeChange}
          />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(160px,220px)_minmax(160px,220px)_minmax(140px,180px)]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Orders KPI Report</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Confirmed Orders KPI daily records from {formatDateLong(filters.dateFrom)} to {formatDateLong(filters.dateTo)}.
              </p>
              <ReportBreadcrumb filters={filters} onViewChange={handleViewChange} />
            </div>
            <Select
              onChange={(event) => handleViewChange(event.target.value as OrdersKpiPerformanceReportView)}
              value={filters.view}
            >
              {viewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              onChange={(event) =>
                updateFilters({
                  page: 1,
                  sortBy: event.target.value as OrdersKpiPerformanceReportSortKey
                })
              }
              value={filters.sortBy}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </Select>
            <Select
              onChange={(event) =>
                updateFilters({
                  page: 1,
                  sortDirection: event.target.value as OrdersKpiPerformanceReportSortDirection
                })
              }
              value={filters.sortDirection}
            >
              <option value="desc">High to low</option>
              <option value="asc">Low to high</option>
            </Select>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {viewOptions.map((option) => (
                <button
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    filters.view === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"
                  )}
                  key={option.value}
                  onClick={() => handleViewChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {filters.view === "PICKER" ? (
                <form className="flex min-w-0 gap-2" onSubmit={handlePickerSearchSubmit}>
                  <div className="relative min-w-0 flex-1 sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-10 rounded-xl pl-9"
                      onChange={(event) => setPickerSearchDraft(event.target.value)}
                      placeholder="Search picker"
                      value={pickerSearchDraft}
                    />
                  </div>
                  <Button className="rounded-xl" type="submit" variant="outline">
                    Apply
                  </Button>
                </form>
              ) : null}
              <Button className="gap-2 rounded-xl" onClick={resetFilters} type="button" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          </div>
        </div>
      </section>

      {queryError ? <InlineNotice message={queryError} tone="warning" title="Filter needs attention" /> : null}
      {error ? <InlineNotice message={error} tone="error" title="Report failed" /> : null}

      <KpiCards isLoading={isLoading} summary={summary} />

      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {getViewLabel(filters.view)} rows
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {pagination
                ? `${formatNumber(pagination.totalRows)} rows across ${formatNumber(pagination.totalPages)} pages`
                : "Rows are loaded from confirmed Orders KPI records."}
            </p>
          </div>
          <Select
            onChange={(event) =>
              updateFilters({ page: 1, pageSize: Number(event.target.value) })
            }
            value={String(filters.pageSize)}
            wrapperClassName="w-full sm:w-40"
          >
            {pageSizeOptions.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize} per page
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? <ReportTableSkeleton /> : null}
        {isEmpty ? <EmptyReport /> : null}
        {!isLoading && !queryError && rows.length ? (
          <ReportRows rows={rows} onDrilldown={handleDrilldown} />
        ) : null}

        {pagination ? (
          <PaginationControls
            onPageChange={(page) => updateFilters({ page })}
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        ) : null}
      </section>
    </div>
  );
}

function KpiCards({
  isLoading,
  summary
}: {
  isLoading: boolean;
  summary: OrdersKpiPerformanceReportResponse["summary"] | null;
}) {
  const cards = [
    { label: "Total Orders", value: formatNumber(summary?.totalOrders ?? 0) },
    { label: "UHO", value: formatNumber(summary?.unhealthyOrders ?? 0) },
    { label: "UHO %", value: `${percentFormatter.format(summary?.unhealthyRate ?? 0)}%` },
    { label: "Not on time", value: formatNumber(summary?.orderNotOnTime ?? 0) },
    { label: "QC Failed Orders", value: formatNumber(summary?.qcFailedOrders ?? 0) },
    { label: "Partial Refund", value: formatNumber(summary?.partialRefund ?? 0) },
    { label: "OOS", value: formatNumber(summary?.outOfStock ?? 0) },
    { label: "Price Modified", value: formatNumber(summary?.priceModified ?? 0) }
  ];

  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={card.label}>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            {card.label}
          </p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : (
            <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
          )}
        </div>
      ))}
    </section>
  );
}

function ReportRows({
  onDrilldown,
  rows
}: {
  onDrilldown: (row: OrdersKpiPerformanceRow) => void;
  rows: OrdersKpiPerformanceRow[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="hidden min-w-[980px] divide-y divide-slate-200 text-sm lg:table">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-3 py-3">Group</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-right">UHO</th>
              <th className="px-3 py-3 text-right">UHO %</th>
              <th className="px-3 py-3 text-right">Not on time</th>
              <th className="px-3 py-3 text-right">QC Failed</th>
              <th className="px-3 py-3 text-right">Partial Refund</th>
              <th className="px-3 py-3 text-right">OOS</th>
              <th className="px-3 py-3 text-right">Price Modified</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.groupKey}>
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-950">{getRowLabel(row)}</p>
                  <p className="mt-1 text-xs text-slate-500">{getRowSubLabel(row)}</p>
                </td>
                <td className="px-3 py-3">
                  <Badge variant="muted">{getGroupTypeLabel(row.groupType)}</Badge>
                </td>
                <MetricCell value={row.metrics.totalOrders} />
                <MetricCell value={row.metrics.unhealthyOrders} />
                <MetricCell value={`${percentFormatter.format(row.metrics.unhealthyRate)}%`} />
                <MetricCell value={row.metrics.orderNotOnTime} />
                <MetricCell value={row.metrics.qcFailedOrders} />
                <MetricCell value={row.metrics.partialRefund} />
                <MetricCell value={row.metrics.outOfStock} />
                <MetricCell value={row.metrics.priceModified} />
                <td className="px-3 py-3">
                  {row.hasDrilldown ? (
                    <Button
                      className="h-9 gap-1 rounded-xl"
                      onClick={() => onDrilldown(row)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Drilldown
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">Final view</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-slate-100 bg-white lg:hidden">
          {rows.map((row) => (
            <div className="p-4" key={row.groupKey}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{getRowLabel(row)}</p>
                  <p className="mt-1 text-xs text-slate-500">{getRowSubLabel(row)}</p>
                </div>
                <Badge variant="muted">{getGroupTypeLabel(row.groupType)}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MobileMetric label="Total" value={row.metrics.totalOrders} />
                <MobileMetric label="UHO" value={row.metrics.unhealthyOrders} />
                <MobileMetric label="UHO %" value={`${percentFormatter.format(row.metrics.unhealthyRate)}%`} />
                <MobileMetric label="Not on time" value={row.metrics.orderNotOnTime} />
                <MobileMetric label="QC Failed" value={row.metrics.qcFailedOrders} />
                <MobileMetric label="Price Modified" value={row.metrics.priceModified} />
              </div>
              {row.hasDrilldown ? (
                <Button
                  className="mt-4 w-full gap-1 rounded-xl"
                  onClick={() => onDrilldown(row)}
                  type="button"
                  variant="outline"
                >
                  Drilldown
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportTableSkeleton() {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 p-4">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-12 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

function EmptyReport() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-950">No confirmed Orders KPI rows</p>
      <p className="mt-2 text-sm text-slate-500">
        Change filters or import confirmed Orders KPI records for this date range.
      </p>
    </div>
  );
}

function PaginationControls({
  onPageChange,
  page,
  totalPages
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Page {formatNumber(page)} of {formatNumber(totalPages)}
      </p>
      <div className="flex gap-2">
        <Button
          className="rounded-xl"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          className="rounded-xl"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function ReportBreadcrumb({
  filters,
  onViewChange
}: {
  filters: ParsedReportFilters;
  onViewChange: (view: OrdersKpiPerformanceReportView) => void;
}) {
  const chainLabel =
    filters.chainLabel ?? (filters.unmappedOnly ? "Unmapped Chain" : null);
  const vendorLabel =
    filters.vendorLabel ??
    (filters.sourceVendorId ? `Unmapped Vendor ${filters.sourceVendorId}` : null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <button
        className="font-semibold text-primary hover:underline"
        onClick={() => onViewChange("CHAIN")}
        type="button"
      >
        All Chains
      </button>
      {filters.view !== "CHAIN" ? (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            className={cn(
              "font-semibold",
              filters.view === "VENDOR" ? "text-slate-700" : "text-primary hover:underline"
            )}
            onClick={() => onViewChange("VENDOR")}
            type="button"
          >
            {chainLabel ?? "All Vendors"}
          </button>
        </>
      ) : null}
      {filters.view === "PICKER" ? (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-slate-700">
            {vendorLabel ?? "Picker View"}
          </span>
        </>
      ) : null}
    </div>
  );
}

function InlineNotice({
  message,
  title,
  tone
}: {
  message: string;
  title: string;
  tone: "error" | "warning";
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-2xl border p-4 text-sm leading-6",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCell({ value }: { value: number | string }) {
  return (
    <td className="px-3 py-3 text-right font-medium text-slate-700">
      {typeof value === "number" ? formatNumber(value) : value}
    </td>
  );
}

function MobileMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

interface ParsedReportFilters {
  chainId: string | null;
  chainLabel: string | null;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  pickerSearch: string | null;
  sortBy: OrdersKpiPerformanceReportSortKey;
  sortDirection: OrdersKpiPerformanceReportSortDirection;
  sourceVendorId: string | null;
  unmappedOnly: boolean;
  vendorId: string | null;
  vendorLabel: string | null;
  view: OrdersKpiPerformanceReportView;
}

function parseReportFilters(searchParams: URLSearchParams): ParsedReportFilters {
  const yesterday = yesterdayIsoDate();
  const normalizedRange = normalizeAttendanceDateRange(
    searchParams.get("dateFrom") ?? yesterday,
    searchParams.get("dateTo") ?? yesterday,
    yesterday
  );

  return {
    chainId: searchParams.get("chainId"),
    chainLabel: searchParams.get("chainLabel"),
    dateFrom: normalizedRange.dateFrom,
    dateTo: normalizedRange.dateTo,
    page: parsePositiveInt(searchParams.get("page"), 1),
    pageSize: parsePageSize(searchParams.get("pageSize")),
    pickerSearch: blankToNull(searchParams.get("pickerSearch")),
    sortBy: parseSortBy(searchParams.get("sortBy")),
    sortDirection: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
    sourceVendorId: searchParams.get("sourceVendorId"),
    unmappedOnly: searchParams.get("unmappedOnly") === "true",
    vendorId: searchParams.get("vendorId"),
    vendorLabel: searchParams.get("vendorLabel"),
    view: parseView(searchParams.get("view"))
  };
}

function parseView(value: string | null): OrdersKpiPerformanceReportView {
  if (value === "VENDOR" || value === "PICKER") {
    return value;
  }

  return "CHAIN";
}

function parseSortBy(value: string | null): OrdersKpiPerformanceReportSortKey {
  return sortOptions.some((option) => option.value === value)
    ? (value as OrdersKpiPerformanceReportSortKey)
    : "totalOrders";
}

function parsePageSize(value: string | null) {
  const parsed = Number(value);
  return pageSizeOptions.includes(parsed) ? parsed : 25;
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function blankToNull(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getRowLabel(row: OrdersKpiPerformanceRow) {
  if (row.label?.trim()) {
    return row.label;
  }

  if (row.groupType === "UNMAPPED_CHAIN") {
    return "Unmapped Chain";
  }

  if (row.groupType === "UNMAPPED_VENDOR") {
    return "Unmapped Vendor";
  }

  if (row.groupType === "UNKNOWN_PICKER") {
    return "Unknown Picker";
  }

  if (row.groupType === "UNMATCHED_SHOPPER") {
    return "Unmatched Shopper";
  }

  return "Unmapped";
}

function getRowSubLabel(row: OrdersKpiPerformanceRow) {
  if (row.sourceVendorId) {
    return `Vendor ID ${row.sourceVendorId}`;
  }

  if (row.sourceShopperId) {
    return `Shopper ID ${row.sourceShopperId}`;
  }

  if (row.sourcePickerKey) {
    return `Picker key ${row.sourcePickerKey}`;
  }

  return row.groupKey;
}

function getGroupTypeLabel(type: OrdersKpiPerformanceRow["groupType"]) {
  const labels: Record<OrdersKpiPerformanceRow["groupType"], string> = {
    MATCHED_CHAIN: "Matched Chain",
    MATCHED_PICKER: "Matched Picker",
    MATCHED_USER_NOT_PICKER: "Matched User Not Picker",
    MATCHED_VENDOR: "Matched Vendor",
    UNKNOWN_PICKER: "Unknown Picker",
    UNMATCHED_SHOPPER: "Unmatched Shopper",
    UNMAPPED_CHAIN: "Unmapped Chain",
    UNMAPPED_VENDOR: "Unmapped Vendor"
  };

  return labels[type];
}

function getViewLabel(view: OrdersKpiPerformanceReportView) {
  const option = viewOptions.find((entry) => entry.value === view);
  return option?.label ?? "Report";
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Orders KPI report error.";
}
