"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Clock3,
  Gauge,
  PackageX,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  type LucideIcon
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
import {
  ordersKpisApi,
  type OrdersKpiMetricComparison,
  type OrdersKpiMetricTargetEvaluation,
  type OrdersKpiPerformanceFilterOption,
  type OrdersKpiPerformanceReportQuery,
  type OrdersKpiPerformanceReportResponse,
  type OrdersKpiPerformanceReportSortDirection,
  type OrdersKpiPerformanceReportSortKey,
  type OrdersKpiPerformanceReportView,
  type OrdersKpiPerformanceRow,
  type OrdersKpiPerformanceTrendPoint
} from "@/lib/api/orders-kpis";
import { cn } from "@/lib/utils";

type ReportStatus = "idle" | "loading" | "success" | "error";
type MetricTone = "default" | "danger" | "info" | "success" | "warning";

interface MetricDefinition {
  cardTone: MetricTone;
  icon: LucideIcon;
  key: OrdersKpiPerformanceReportSortKey;
  label: string;
  shortLabel: string;
  valueType: "count" | "percent";
}

interface ActiveContext {
  label: string;
  value: string;
}

const reportViews: Array<{
  description: string;
  label: string;
  value: OrdersKpiPerformanceReportView;
}> = [
  {
    description: "Chain performance groups",
    label: "Chain",
    value: "CHAIN"
  },
  {
    description: "Vendor and unmapped vendor rows",
    label: "Vendor",
    value: "VENDOR"
  },
  {
    description: "Picker and shopper buckets",
    label: "Picker",
    value: "PICKER"
  }
];

const metricDefinitions: MetricDefinition[] = [
  {
    cardTone: "success",
    icon: ReceiptText,
    key: "totalOrders",
    label: "Total Orders",
    shortLabel: "Total",
    valueType: "count"
  },
  {
    cardTone: "danger",
    icon: Activity,
    key: "unhealthyOrders",
    label: "UHO",
    shortLabel: "UHO",
    valueType: "count"
  },
  {
    cardTone: "danger",
    icon: Gauge,
    key: "unhealthyRate",
    label: "UHO %",
    shortLabel: "UHO %",
    valueType: "percent"
  },
  {
    cardTone: "warning",
    icon: Clock3,
    key: "orderNotOnTime",
    label: "Not on Time",
    shortLabel: "Not on Time",
    valueType: "count"
  },
  {
    cardTone: "warning",
    icon: ShieldAlert,
    key: "qcFailedOrders",
    label: "QC Failed Orders",
    shortLabel: "QC Failed",
    valueType: "count"
  },
  {
    cardTone: "info",
    icon: Store,
    key: "partialRefund",
    label: "Partial Refund",
    shortLabel: "Refund",
    valueType: "count"
  },
  {
    cardTone: "warning",
    icon: PackageX,
    key: "outOfStock",
    label: "OOS",
    shortLabel: "OOS",
    valueType: "count"
  },
  {
    cardTone: "info",
    icon: ClipboardList,
    key: "priceModified",
    label: "Price Modified",
    shortLabel: "Price Mod.",
    valueType: "count"
  }
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
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");
  const [report, setReport] =
    useState<OrdersKpiPerformanceReportResponse | null>(null);
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const dateRangeError = validateAttendanceDateRange(
    filters.dateFrom,
    filters.dateTo
  );
  const queryError = dateRangeError;
  const query = useMemo<OrdersKpiPerformanceReportQuery>(
    () => ({
      chainId: filters.chainId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      pageSize: filters.pageSize,
      pickerId: filters.pickerId,
      pickerSearch: filters.pickerSearch,
      search: filters.search,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      sourcePickerKey: filters.sourcePickerKey,
      sourceShopperId: filters.sourceShopperId,
      sourceVendorId: filters.sourceVendorId,
      unmappedOnly: filters.unmappedOnly,
      vendorId: filters.vendorId,
      view: filters.view
    }),
    [filters]
  );
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    setSearchDraft(filters.search ?? "");
  }, [filters.search]);

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

    const nextSearch = nextParams.toString();
    router.push(nextSearch ? `${pathname}?${nextSearch}` : pathname);
  }

  function resetFilters() {
    const yesterday = yesterdayIsoDate();
    router.push(`${pathname}?dateFrom=${yesterday}&dateTo=${yesterday}&view=CHAIN`);
  }

  function handleDateRangeChange(dateFrom: string, dateTo: string) {
    updateFilters({ dateFrom, dateTo, page: 1 });
  }

  function handleViewChange(view: OrdersKpiPerformanceReportView) {
    updateFilters({ page: 1, pickerSearch: null, view });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({
      page: 1,
      pickerSearch: null,
      search: searchDraft.trim() || null
    });
  }

  function handleSort(sortBy: OrdersKpiPerformanceReportSortKey) {
    const sortDirection: OrdersKpiPerformanceReportSortDirection =
      filters.sortBy === sortBy && filters.sortDirection === "desc" ? "asc" : "desc";

    updateFilters({ page: 1, sortBy, sortDirection });
  }

  function handleDrilldown(row: OrdersKpiPerformanceRow) {
    if (!row.hasDrilldown || !row.nextView || !row.drilldownParams) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", row.nextView);
    nextParams.set("page", "1");
    nextParams.delete("pickerSearch");
    nextParams.delete("pickerId");
    nextParams.delete("pickerLabel");
    nextParams.delete("sourcePickerKey");
    nextParams.delete("sourceShopperId");
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
  const activeContexts = activeReportContexts(filters);
  const isLoading = status === "loading";
  const isEmpty = status === "success" && !rows.length;

  return (
    <div className="min-w-0 space-y-4 overflow-hidden rounded-2xl bg-slate-50/80 p-3 sm:p-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-normal text-slate-950 sm:text-2xl">
                  Orders KPI Performance
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Vendor-first operational KPI workspace
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Confirmed daily records from {formatDateLong(filters.dateFrom)} to{" "}
              {formatDateLong(filters.dateTo)}.
            </p>
          </div>

          <div className="w-full shrink-0 lg:w-auto">
            <AttendanceDateRangeSelector
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              error={dateRangeError}
              onChange={handleDateRangeChange}
            />
          </div>
        </div>
      </section>

      {queryError ? (
        <InlineNotice
          message={queryError}
          tone="warning"
          title="Filter needs attention"
        />
      ) : null}
      {error ? (
        <InlineNotice message={error} tone="error" title="Report failed" />
      ) : null}

      <KpiCards
        comparison={report?.comparison.summary ?? null}
        isLoading={isLoading}
        summary={summary}
        targetEvaluation={report?.targetEvaluation ?? null}
        trend={report?.trend ?? []}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Report controls
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeContexts.length ? (
                activeContexts.map((context) => (
                  <span
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600"
                    key={`${context.label}:${context.value}`}
                  >
                    <span className="text-slate-400">{context.label}</span>
                    <span className="max-w-[14rem] truncate text-slate-900">
                      {context.value}
                    </span>
                  </span>
                ))
              ) : (
                <span className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500">
                  All confirmed records
                </span>
              )}
            </div>
            <FilterControls
              filters={filters}
              options={report?.filterOptions ?? null}
              updateFilters={updateFilters}
            />
          </div>

          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,18rem)_auto]">
            <form
              className="flex min-w-0 gap-2"
              onSubmit={handleSearchSubmit}
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  className="h-11 rounded-xl pl-9"
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search chain, vendor, or picker"
                  value={searchDraft}
                />
              </div>
              <Button
                className="h-11 rounded-xl"
                type="submit"
                variant="outline"
              >
                Apply
              </Button>
            </form>
            <Button
              className="h-11 gap-2 rounded-xl"
              onClick={resetFilters}
              type="button"
              variant="outline"
            >
              <RefreshCcw className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <ReportViewTabs
            activeView={filters.view}
            onViewChange={handleViewChange}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">
              {pagination
                ? `${formatNumber(pagination.totalRows)} rows across ${formatNumber(
                    pagination.totalPages
                  )} pages`
                : "Rows load from confirmed Orders KPI records."}
            </p>
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
        </div>

        {isLoading ? <ReportTableSkeleton /> : null}
        {isEmpty ? <EmptyReport /> : null}
        {!isLoading && !queryError && rows.length ? (
          <ReportRows
            filters={filters}
            onDrilldown={handleDrilldown}
            onSort={handleSort}
            rows={rows}
          />
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
  comparison,
  isLoading,
  summary,
  targetEvaluation,
  trend
}: {
  comparison: OrdersKpiPerformanceReportResponse["comparison"]["summary"] | null;
  isLoading: boolean;
  summary: OrdersKpiPerformanceReportResponse["summary"] | null;
  targetEvaluation: OrdersKpiPerformanceReportResponse["targetEvaluation"] | null;
  trend: OrdersKpiPerformanceTrendPoint[];
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metricDefinitions.map((metric) => (
        <KpiCard
          comparison={comparison?.[metric.key] ?? null}
          isLoading={isLoading}
          key={metric.key}
          metric={metric}
          target={targetEvaluation?.metrics[metric.key] ?? null}
          trend={trend}
          value={summary?.[metric.key] ?? 0}
        />
      ))}
    </section>
  );
}

function KpiCard({
  comparison,
  isLoading,
  metric,
  target,
  trend,
  value
}: {
  comparison: OrdersKpiMetricComparison | null;
  isLoading: boolean;
  metric: MetricDefinition;
  target: OrdersKpiMetricTargetEvaluation | null;
  trend: OrdersKpiPerformanceTrendPoint[];
  value: number;
}) {
  const Icon = metric.icon;
  const deltaTone = getDeltaTone(metric, comparison?.delta ?? 0);

  return (
    <article
      className={cn(
        "min-w-0 rounded-2xl border bg-white p-4 shadow-sm",
        metric.key === "unhealthyRate"
          ? "border-primary/30 ring-1 ring-primary/10"
          : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            {metric.label}
          </p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-28" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
              {formatMetricValue(value, metric.valueType)}
            </p>
          )}
        </div>
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            metricToneClasses(metric.cardTone)
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">vs previous period</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-4 w-24" />
            ) : (
              <p className={cn("mt-1 text-xs font-semibold", deltaTone)}>
                {formatDelta(comparison, metric.valueType)}
              </p>
            )}
            {target && !isLoading ? (
              <p className={cn("mt-1 text-[11px] font-semibold", targetTone(target))}>
                {formatTargetLine(target)}
              </p>
            ) : null}
          </div>
          <TrendSparkline
            metric={metric}
            points={trend}
            valueType={metric.valueType}
          />
        </div>
      </div>
    </article>
  );
}

function FilterControls({
  filters,
  options,
  updateFilters
}: {
  filters: ParsedReportFilters;
  options: OrdersKpiPerformanceReportResponse["filterOptions"] | null;
  updateFilters: (updates: Record<string, string | number | boolean | null>) => void;
}) {
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      <FilterSelect
        label="Chain"
        onChange={(value) => {
          updateFilters({
            chainId: value.startsWith("chain:") ? value.slice(6) : null,
            chainLabel: null,
            page: 1,
            pickerId: null,
            pickerLabel: null,
            sourcePickerKey: null,
            sourceShopperId: null,
            sourceVendorId: null,
            unmappedOnly: value === "unmapped" ? true : null,
            vendorId: null,
            vendorLabel: null
          });
        }}
        options={(options?.chains ?? []).map((option) => ({
          label: option.label,
          value: option.unmappedOnly ? "unmapped" : `chain:${option.id}`
        }))}
        placeholder="All chains"
        value={chainSelectValue(filters)}
      />
      <FilterSelect
        label="Vendor"
        onChange={(value) => {
          updateFilters({
            page: 1,
            pickerId: null,
            pickerLabel: null,
            sourcePickerKey: null,
            sourceShopperId: null,
            sourceVendorId: value.startsWith("source:") ? value.slice(7) : null,
            vendorId: value.startsWith("vendor:") ? value.slice(7) : null,
            vendorLabel: null
          });
        }}
        options={(options?.vendors ?? []).map((option) => ({
          label: option.label,
          value: option.id
            ? `vendor:${option.id}`
            : `source:${option.sourceVendorId ?? ""}`
        }))}
        placeholder="All vendors"
        value={vendorSelectValue(filters)}
      />
      <FilterSelect
        label="Picker"
        onChange={(value) => {
          updateFilters({
            page: 1,
            pickerId: value.startsWith("picker:") ? value.slice(7) : null,
            pickerLabel: null,
            sourcePickerKey: value.startsWith("key:") ? value.slice(4) : null,
            sourceShopperId: value.startsWith("shopper:") ? value.slice(8) : null
          });
        }}
        options={(options?.pickers ?? []).map((option) => ({
          label: option.label,
          value: pickerOptionValue(option)
        }))}
        placeholder="All pickers"
        value={pickerSelectValue(filters)}
      />
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  value: string;
}) {
  const hasSelectedOption =
    value === "all" || options.some((option) => option.value === value);

  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <Select
        className="h-11 rounded-xl"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="all">{placeholder}</option>
        {!hasSelectedOption ? <option value={value}>Selected {label}</option> : null}
        {options.map((option) => (
          <option key={`${label}:${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function TrendSparkline({
  metric,
  points,
  valueType
}: {
  metric: MetricDefinition;
  points: OrdersKpiPerformanceTrendPoint[];
  valueType: MetricDefinition["valueType"];
}) {
  const values = points.map((point) => point.metrics[metric.key]);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const spread = max - min || 1;
  const width = 88;
  const height = 28;
  const coordinates = values.length
    ? values
        .map((value, index) => {
          const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
          const y = height - ((value - min) / spread) * height;
          return `${roundNumber(x, 2)},${roundNumber(y, 2)}`;
        })
        .join(" ")
    : "";

  return (
    <div className="w-24 shrink-0 text-right">
      {coordinates ? (
        <svg
          aria-label={`${metric.label} trend`}
          className="h-7 w-full overflow-visible"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <polyline
            fill="none"
            points={coordinates}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
          {values.length === 1 ? (
            <circle
              cx={width / 2}
              cy={height - (((values[0] ?? 0) - min) / spread) * height}
              fill="currentColor"
              r="3"
            />
          ) : null}
        </svg>
      ) : (
        <div className="h-7" />
      )}
      <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
        {points.length
          ? formatMetricValue(values.at(-1) ?? 0, valueType)
          : "No trend"}
      </p>
    </div>
  );
}

function ReportViewTabs({
  activeView,
  onViewChange
}: {
  activeView: OrdersKpiPerformanceReportView;
  onViewChange: (view: OrdersKpiPerformanceReportView) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[34rem]">
      {reportViews.map((view) => (
        <button
          aria-pressed={activeView === view.value}
          className={cn(
            "min-h-16 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            activeView === view.value
              ? "border-primary/45 bg-primary/5 text-primary shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-primary/30"
          )}
          key={view.value}
          onClick={() => onViewChange(view.value)}
          type="button"
        >
          <span className="block text-sm font-semibold">{view.label}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {view.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function ReportRows({
  filters,
  onDrilldown,
  onSort,
  rows
}: {
  filters: ParsedReportFilters;
  onDrilldown: (row: OrdersKpiPerformanceRow) => void;
  onSort: (sortBy: OrdersKpiPerformanceReportSortKey) => void;
  rows: OrdersKpiPerformanceRow[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="hidden min-w-[1080px] divide-y divide-slate-200 text-sm lg:table">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Target Status</th>
              {metricDefinitions.map((metric) => (
                <SortableMetricHeader
                  direction={filters.sortDirection}
                  isActive={filters.sortBy === metric.key}
                  key={metric.key}
                  metric={metric}
                  onSort={onSort}
                />
              ))}
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr className="transition hover:bg-slate-50/70" key={row.groupKey}>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <GroupIcon row={row} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">
                        {getRowLabel(row)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getRowSubLabel(row)}
                      </p>
                      <GroupBadge row={row} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <TargetStatusBadge evaluation={row.targetEvaluation} />
                </td>
                {metricDefinitions.map((metric) => (
                  <MetricCell key={metric.key} metric={metric} row={row} />
                ))}
                <td className="px-3 py-3">
                  {row.hasDrilldown ? (
                    <Button
                      className="h-9 gap-1 rounded-xl"
                      onClick={() => onDrilldown(row)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Open
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">
                      Final view
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-slate-100 bg-white lg:hidden">
          {rows.map((row) => (
            <MobileReportCard key={row.groupKey} onDrilldown={onDrilldown} row={row} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableMetricHeader({
  direction,
  isActive,
  metric,
  onSort
}: {
  direction: OrdersKpiPerformanceReportSortDirection;
  isActive: boolean;
  metric: MetricDefinition;
  onSort: (sortBy: OrdersKpiPerformanceReportSortKey) => void;
}) {
  const SortIcon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-3 text-right"
    >
      <button
        className="ml-auto inline-flex items-center justify-end gap-1 rounded-lg px-2 py-1 text-right transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        onClick={() => onSort(metric.key)}
        type="button"
      >
        <span>{metric.shortLabel}</span>
        <SortIcon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

function MetricCell({
  metric,
  row
}: {
  metric: MetricDefinition;
  row: OrdersKpiPerformanceRow;
}) {
  const value = row.metrics[metric.key];
  const comparison = row.comparison[metric.key];
  const target = row.targetEvaluation.metrics[metric.key] ?? null;
  const isOutOfTarget = target?.status === "OUT_OF_TARGET";

  return (
    <td className="px-3 py-3 text-right tabular-nums">
      <p
        className={cn(
          "font-semibold",
          isOutOfTarget ? "text-rose-700" : "text-slate-700"
        )}
      >
        {formatMetricValue(value, metric.valueType)}
      </p>
      <p className={cn("mt-1 text-xs font-medium", getDeltaTone(metric, comparison.delta))}>
        {formatDelta(comparison, metric.valueType)}
      </p>
      {target ? (
        <p className={cn("mt-1 text-[11px] font-semibold", targetTone(target))}>
          {formatTargetLine(target)}
        </p>
      ) : null}
    </td>
  );
}

function MobileReportCard({
  onDrilldown,
  row
}: {
  onDrilldown: (row: OrdersKpiPerformanceRow) => void;
  row: OrdersKpiPerformanceRow;
}) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <GroupIcon row={row} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">{getRowLabel(row)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {getRowSubLabel(row)}
            </p>
            <GroupBadge row={row} />
            <div className="mt-2">
              <TargetStatusBadge evaluation={row.targetEvaluation} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {metricDefinitions.map((metric) => {
          const target = row.targetEvaluation.metrics[metric.key] ?? null;

          return (
            <div
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
              key={metric.key}
            >
              <p className="text-xs font-semibold text-slate-500">
                {metric.shortLabel}
              </p>
              <p className="mt-1 font-semibold tabular-nums text-slate-950">
                {formatMetricValue(row.metrics[metric.key], metric.valueType)}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs font-medium tabular-nums",
                  getDeltaTone(metric, row.comparison[metric.key].delta)
                )}
              >
                {formatDelta(row.comparison[metric.key], metric.valueType)}
              </p>
              {target ? (
                <p className={cn("mt-1 text-[11px] font-semibold", targetTone(target))}>
                  {formatTargetLine(target)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {row.hasDrilldown ? (
        <Button
          className="mt-4 w-full gap-1 rounded-xl"
          onClick={() => onDrilldown(row)}
          type="button"
          variant="outline"
        >
          Open next view
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}
    </article>
  );
}

function GroupIcon({ row }: { row: OrdersKpiPerformanceRow }) {
  const isUnmapped =
    row.groupType === "UNMAPPED_CHAIN" || row.groupType === "UNMAPPED_VENDOR";

  return (
    <span
      className={cn(
        "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
        isUnmapped ? "bg-amber-50 text-amber-700" : "bg-primary/10 text-primary"
      )}
    >
      {isUnmapped ? <AlertTriangle className="h-4 w-4" /> : <Store className="h-4 w-4" />}
    </span>
  );
}

function GroupBadge({ row }: { row: OrdersKpiPerformanceRow }) {
  return (
    <Badge
      className={cn(
        "mt-2",
        row.groupType.includes("UNMAPPED") &&
          "border-amber-200 bg-amber-50 text-amber-800",
        row.groupType.includes("UNKNOWN") &&
          "border-slate-200 bg-slate-50 text-slate-600",
        row.groupType.includes("UNMATCHED") &&
          "border-orange-200 bg-orange-50 text-orange-800"
      )}
      variant="outline"
    >
      {getGroupTypeLabel(row.groupType)}
    </Badge>
  );
}

function TargetStatusBadge({
  evaluation
}: {
  evaluation: OrdersKpiPerformanceRow["targetEvaluation"];
}) {
  const inTarget = evaluation.status === "IN_TARGET";

  return (
    <Badge
      className={cn(
        "whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-semibold",
        inTarget
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      )}
      variant="outline"
    >
      {inTarget ? "In Target" : "Out of Target"}
    </Badge>
  );
}

function ReportTableSkeleton() {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 p-4">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-14 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

function EmptyReport() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-950">
        No confirmed Orders KPI rows
      </p>
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
        "rounded-2xl border p-4 text-sm leading-6",
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

interface ParsedReportFilters {
  chainId: string | null;
  chainLabel: string | null;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  pickerId: string | null;
  pickerLabel: string | null;
  pickerSearch: string | null;
  search: string | null;
  sortBy: OrdersKpiPerformanceReportSortKey;
  sortDirection: OrdersKpiPerformanceReportSortDirection;
  sourcePickerKey: string | null;
  sourceShopperId: string | null;
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
    pickerId: searchParams.get("pickerId"),
    pickerLabel: searchParams.get("pickerLabel"),
    pickerSearch: blankToNull(searchParams.get("pickerSearch")),
    search: blankToNull(searchParams.get("search")),
    sortBy: parseSortBy(searchParams.get("sortBy")),
    sortDirection: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
    sourcePickerKey: searchParams.get("sourcePickerKey"),
    sourceShopperId: searchParams.get("sourceShopperId"),
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
  return metricDefinitions.some((metric) => metric.key === value)
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

function activeReportContexts(filters: ParsedReportFilters): ActiveContext[] {
  const contexts: ActiveContext[] = [];

  if (filters.chainId || filters.unmappedOnly || filters.chainLabel) {
    contexts.push({
      label: "Chain",
      value:
        filters.chainLabel ??
        (filters.unmappedOnly ? "Unmapped Chain" : filters.chainId ?? "Selected")
    });
  }

  if (filters.vendorId || filters.sourceVendorId || filters.vendorLabel) {
    contexts.push({
      label: "Vendor",
      value:
        filters.vendorLabel ??
        (filters.sourceVendorId
          ? `Unmapped Vendor ${filters.sourceVendorId}`
          : filters.vendorId ?? "Selected")
    });
  }

  if (filters.pickerId || filters.sourceShopperId || filters.sourcePickerKey || filters.pickerLabel) {
    contexts.push({
      label: "Picker",
      value:
        filters.pickerLabel ??
        filters.sourceShopperId ??
        filters.sourcePickerKey ??
        filters.pickerId ??
        "Selected"
    });
  }

  if (filters.search) {
    contexts.push({
      label: "Search",
      value: filters.search
    });
  }

  if (filters.pickerSearch) {
    contexts.push({
      label: "Picker search",
      value: filters.pickerSearch
    });
  }

  return contexts;
}

function chainSelectValue(filters: ParsedReportFilters) {
  if (filters.unmappedOnly) {
    return "unmapped";
  }

  return filters.chainId ? `chain:${filters.chainId}` : "all";
}

function vendorSelectValue(filters: ParsedReportFilters) {
  if (filters.vendorId) {
    return `vendor:${filters.vendorId}`;
  }

  return filters.sourceVendorId ? `source:${filters.sourceVendorId}` : "all";
}

function pickerSelectValue(filters: ParsedReportFilters) {
  if (filters.pickerId) {
    return `picker:${filters.pickerId}`;
  }

  if (filters.sourceShopperId) {
    return `shopper:${filters.sourceShopperId}`;
  }

  return filters.sourcePickerKey ? `key:${filters.sourcePickerKey}` : "all";
}

function pickerOptionValue(option: OrdersKpiPerformanceFilterOption) {
  if (option.id) {
    return `picker:${option.id}`;
  }

  if (option.sourceShopperId) {
    return `shopper:${option.sourceShopperId}`;
  }

  return option.sourcePickerKey ? `key:${option.sourcePickerKey}` : "all";
}

function getRowLabel(row: OrdersKpiPerformanceRow) {
  if (row.label?.trim()) {
    return row.label;
  }

  if (row.groupType === "UNMAPPED_CHAIN") {
    return "Unmapped Chain";
  }

  if (row.groupType === "UNMAPPED_VENDOR") {
    return row.sourceVendorId
      ? `Unmapped Vendor ${row.sourceVendorId}`
      : "Unmapped Vendor";
  }

  if (row.groupType === "UNKNOWN_PICKER") {
    return "Unknown Picker";
  }

  if (row.groupType === "UNMATCHED_SHOPPER") {
    return row.sourceShopperId
      ? `Unmatched shopperId: ${row.sourceShopperId}`
      : "Unmatched Shopper";
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
    MATCHED_USER_NOT_PICKER: "Non-Picker Shopper",
    MATCHED_VENDOR: "Matched Vendor",
    UNKNOWN_PICKER: "Unknown Picker",
    UNMATCHED_SHOPPER: "Unmatched Shopper",
    UNMAPPED_CHAIN: "Unmapped Chain",
    UNMAPPED_VENDOR: "Unmapped Vendor"
  };

  return labels[type];
}

function metricToneClasses(tone: MetricTone) {
  const classes: Record<MetricTone, string> = {
    danger: "bg-rose-50 text-rose-700",
    default: "bg-slate-100 text-slate-700",
    info: "bg-sky-50 text-sky-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700"
  };

  return classes[tone];
}

function getDeltaTone(metric: MetricDefinition, delta: number) {
  if (delta === 0) {
    return "text-slate-500";
  }

  const lowerIsBetter = metric.key !== "totalOrders";
  const isGood = lowerIsBetter ? delta < 0 : delta > 0;
  return isGood ? "text-emerald-700" : "text-rose-700";
}

function targetTone(target: OrdersKpiMetricTargetEvaluation | undefined | null) {
  if (!target) {
    return "text-slate-500";
  }

  return target.status === "OUT_OF_TARGET"
    ? "text-rose-700"
    : "text-emerald-700";
}

function formatTargetLine(target: OrdersKpiMetricTargetEvaluation) {
  return `${percentFormatter.format(target.rate)}% / target <= ${percentFormatter.format(
    target.target
  )}%`;
}

function formatDelta(
  comparison: OrdersKpiMetricComparison | null,
  valueType: MetricDefinition["valueType"]
) {
  if (!comparison) {
    return "No previous period";
  }

  if (comparison.delta === 0) {
    return "No change";
  }

  const value =
    valueType === "percent"
      ? `${formatSignedPercentagePoints(comparison.delta)} pp`
      : formatSignedNumber(comparison.delta);
  const percent =
    comparison.deltaPercent === null
      ? ""
      : ` (${formatSignedPercent(comparison.deltaPercent)})`;

  return `${value}${percent}`;
}

function formatMetricValue(value: number, valueType: MetricDefinition["valueType"]) {
  if (valueType === "percent") {
    return `${percentFormatter.format(value)}%`;
  }

  return formatNumber(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${percentFormatter.format(value)}%`;
}

function formatSignedPercentagePoints(value: number) {
  return `${value > 0 ? "+" : ""}${percentFormatter.format(value)}`;
}

function roundNumber(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Orders KPI report error.";
}
