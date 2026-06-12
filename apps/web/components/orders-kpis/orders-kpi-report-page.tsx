"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
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
  type OrdersKpiPerformanceRow
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

export type OrdersKpiReportWorkspaceVariant =
  | "admin"
  | "area-manager"
  | "champ";

const workspaceScopeNotes: Record<OrdersKpiReportWorkspaceVariant, string | null> = {
  admin: null,
  "area-manager":
    "Showing Orders KPI records within your assigned chains.",
  champ: "Showing Orders KPI records within your assigned vendors."
};

export function OrdersKpiReportPage({
  variant = "admin"
}: {
  variant?: OrdersKpiReportWorkspaceVariant;
} = {}) {
  const scopeNote = workspaceScopeNotes[variant];
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
    <div className="min-w-0 space-y-4 overflow-hidden rounded-2xl bg-[color:var(--sn-sunken)] p-3 sm:p-4">
      <div
        className={cn(
          "flex w-full flex-col gap-3 sm:flex-row sm:items-center",
          scopeNote ? "sm:justify-between" : "sm:justify-end"
        )}
      >
        {scopeNote ? (
          <p className="text-xs leading-5 text-[color:var(--sn-muted)]">{scopeNote}</p>
        ) : null}
        <div className="w-full shrink-0 sm:w-auto">
          <AttendanceDateRangeSelector
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            error={dateRangeError}
            onChange={handleDateRangeChange}
          />
        </div>
      </div>

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
      />

      <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--sn-ink)]">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Report controls
            </div>
            {activeContexts.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeContexts.map((context) => (
                  <span
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 text-xs font-semibold text-[color:var(--sn-body)]"
                    key={`${context.label}:${context.value}`}
                  >
                    <span className="text-[color:var(--sn-muted)]">{context.label}</span>
                    <span className="max-w-[14rem] truncate text-[color:var(--sn-ink)]">
                      {context.value}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
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
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--sn-muted)]" />
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

      <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <ReportViewTabs
            activeView={filters.view}
            onViewChange={handleViewChange}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-[color:var(--sn-muted)]">
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
  targetEvaluation
}: {
  comparison: OrdersKpiPerformanceReportResponse["comparison"]["summary"] | null;
  isLoading: boolean;
  summary: OrdersKpiPerformanceReportResponse["summary"] | null;
  targetEvaluation: OrdersKpiPerformanceReportResponse["targetEvaluation"] | null;
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
  value
}: {
  comparison: OrdersKpiMetricComparison | null;
  isLoading: boolean;
  metric: MetricDefinition;
  target: OrdersKpiMetricTargetEvaluation | null;
  value: number;
}) {
  const Icon = metric.icon;
  const deltaTone = getDeltaTone(metric, comparison?.delta ?? 0);
  const outOfTarget = target?.status === "OUT_OF_TARGET";
  const isPrimary = metric.key === "unhealthyRate";

  return (
    <article
      className={cn(
        "min-w-0 rounded-[16px] border bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        isPrimary ? "border-primary/30 ring-1 ring-primary/10" : "border-[color:var(--sn-border)]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
              metricToneClasses(metric.cardTone)
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <p className="truncate text-xs font-medium text-[color:var(--sn-muted)]">
            {metric.label}
          </p>
        </div>
        {target && !isLoading ? (
          <TargetIcon
            inTarget={!outOfTarget}
            title={formatTargetTooltip(target)}
          />
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <p
          className={cn(
            "mt-2 font-[family-name:var(--font-data)] text-[26px] font-semibold leading-tight tabular-nums",
            outOfTarget ? "text-[oklch(0.55_0.19_27)]" : "text-[color:var(--sn-ink)]"
          )}
        >
          {formatMetricValue(value, metric.valueType)}
        </p>
      )}

      {isLoading ? (
        <Skeleton className="mt-2 h-4 w-16" />
      ) : (
        <p className={cn("mt-1 text-xs font-medium tabular-nums", deltaTone)}>
          {formatDeltaShort(comparison, metric.valueType)}
        </p>
      )}
    </article>
  );
}

function TargetIcon({
  inTarget,
  title
}: {
  inTarget: boolean;
  title?: string;
}) {
  const Icon = inTarget ? CheckCircle2 : AlertCircle;

  return (
    <span
      className={cn("shrink-0", inTarget ? "text-[oklch(0.58_0.13_150)]" : "text-[oklch(0.55_0.19_27)]")}
      title={title}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
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
      <span className="mb-1 block text-xs font-semibold text-[color:var(--sn-muted)]">
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
              : "border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-body)] hover:border-primary/30"
          )}
          key={view.value}
          onClick={() => onViewChange(view.value)}
          type="button"
        >
          <span className="block text-sm font-semibold">{view.label}</span>
          <span className="mt-1 block text-xs leading-5 text-[color:var(--sn-muted)]">
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
    <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--sn-border)]">
      <div className="overflow-x-auto">
        <table className="hidden w-full min-w-[900px] table-fixed divide-y divide-[color:var(--sn-border)] text-sm lg:table">
          <colgroup>
            <col className="w-[22%]" />
            {metricDefinitions.map((metric) => (
              <col className="w-[9%]" key={metric.key} />
            ))}
            <col className="w-[56px]" />
          </colgroup>
          <thead className="bg-[color:var(--sn-sunken)] text-left text-xs font-semibold uppercase tracking-normal text-[color:var(--sn-muted)]">
            <tr>
              <th className="px-3 py-3">Name</th>
              {metricDefinitions.map((metric) => (
                <SortableMetricHeader
                  direction={filters.sortDirection}
                  isActive={filters.sortBy === metric.key}
                  key={metric.key}
                  metric={metric}
                  onSort={onSort}
                />
              ))}
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--sn-border)] bg-[color:var(--sn-card)]">
            {rows.map((row) => (
              <tr className="transition hover:bg-[color:var(--sn-sunken)]" key={row.groupKey}>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <GroupIcon row={row} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-[color:var(--sn-ink)]">
                          {getRowLabel(row)}
                        </p>
                        <TargetIcon
                          inTarget={row.targetEvaluation.status === "IN_TARGET"}
                          title={
                            row.targetEvaluation.status === "IN_TARGET"
                              ? "On target"
                              : "Off target"
                          }
                        />
                      </div>
                      {getRowSubLabel(row) ? (
                        <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">
                          {getRowSubLabel(row)}
                        </p>
                      ) : null}
                      <GroupBadge row={row} />
                    </div>
                  </div>
                </td>
                {metricDefinitions.map((metric) => (
                  <MetricCell key={metric.key} metric={metric} row={row} />
                ))}
                <td className="px-2 py-3 text-center">
                  {row.hasDrilldown ? (
                    <Button
                      aria-label={`Open ${getRowLabel(row)}`}
                      className="h-8 w-8 rounded-lg p-0"
                      onClick={() => onDrilldown(row)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-[color:var(--sn-muted)]" aria-hidden>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-[color:var(--sn-border)] bg-[color:var(--sn-card)] lg:hidden">
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
  const SortIcon = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-3 text-right"
    >
      <button
        className={cn(
          "ml-auto inline-flex w-full items-center justify-end gap-1 rounded-lg px-2 py-1 text-right transition hover:text-[color:var(--sn-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          isActive ? "text-[color:var(--sn-ink)]" : "text-[color:var(--sn-muted)]"
        )}
        onClick={() => onSort(metric.key)}
        type="button"
      >
        <span className="truncate">{metric.shortLabel}</span>
        {isActive ? <SortIcon className="h-3.5 w-3.5 shrink-0" /> : null}
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
  const target = row.targetEvaluation.metrics[metric.key] ?? null;
  const isOutOfTarget = target?.status === "OUT_OF_TARGET";

  return (
    <td className="px-3 py-3 text-right tabular-nums" title={formatTargetTooltip(target)}>
      <div className="flex items-center justify-end gap-1.5">
        {isOutOfTarget ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.19_27)]" aria-hidden />
        ) : null}
        <span
          className={cn(
            "font-semibold",
            isOutOfTarget ? "text-[oklch(0.55_0.19_27)]" : "text-[color:var(--sn-body)]"
          )}
        >
          {formatMetricValue(value, metric.valueType)}
        </span>
      </div>
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
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-[color:var(--sn-ink)]">
                {getRowLabel(row)}
              </p>
              <TargetIcon
                inTarget={row.targetEvaluation.status === "IN_TARGET"}
                title={
                  row.targetEvaluation.status === "IN_TARGET"
                    ? "On target"
                    : "Off target"
                }
              />
            </div>
            {getRowSubLabel(row) ? (
              <p className="mt-0.5 text-xs leading-5 text-[color:var(--sn-muted)]">
                {getRowSubLabel(row)}
              </p>
            ) : null}
            <GroupBadge row={row} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {metricDefinitions.map((metric) => {
          const target = row.targetEvaluation.metrics[metric.key] ?? null;
          const isOutOfTarget = target?.status === "OUT_OF_TARGET";

          return (
            <div
              className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3"
              key={metric.key}
              title={formatTargetTooltip(target)}
            >
              <p className="text-xs font-medium text-[color:var(--sn-muted)]">
                {metric.shortLabel}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                {isOutOfTarget ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.19_27)]" aria-hidden />
                ) : null}
                <span
                  className={cn(
                    "font-[family-name:var(--font-data)] font-semibold tabular-nums",
                    isOutOfTarget ? "text-[oklch(0.55_0.19_27)]" : "text-[color:var(--sn-ink)]"
                  )}
                >
                  {formatMetricValue(row.metrics[metric.key], metric.valueType)}
                </span>
              </div>
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
        isUnmapped ? "bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]" : "bg-primary/10 text-primary"
      )}
    >
      {isUnmapped ? <AlertTriangle className="h-4 w-4" /> : <Store className="h-4 w-4" />}
    </span>
  );
}

const MATCHED_GROUP_TYPES: ReadonlyArray<OrdersKpiPerformanceRow["groupType"]> = [
  "MATCHED_CHAIN",
  "MATCHED_VENDOR",
  "MATCHED_PICKER"
];

function GroupBadge({ row }: { row: OrdersKpiPerformanceRow }) {
  if (MATCHED_GROUP_TYPES.includes(row.groupType)) {
    return null;
  }

  return (
    <Badge
      className={cn(
        "mt-1.5",
        row.groupType.includes("UNMAPPED") &&
          "border-[oklch(0.88_0.05_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]",
        row.groupType.includes("UNKNOWN") &&
          "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]",
        row.groupType.includes("UNMATCHED") &&
          "border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
      )}
      variant="outline"
    >
      {getGroupTypeLabel(row.groupType)}
    </Badge>
  );
}

function ReportTableSkeleton() {
  return (
    <div className="mt-4 rounded-2xl border border-[color:var(--sn-border)] p-4">
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
    <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--sn-border-strong)] bg-[color:var(--sn-sunken)] p-8 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-[color:var(--sn-muted)]" />
      <p className="mt-3 text-sm font-semibold text-[color:var(--sn-ink)]">
        No confirmed Orders KPI rows
      </p>
      <p className="mt-2 text-sm text-[color:var(--sn-muted)]">
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
      <p className="text-sm text-[color:var(--sn-muted)]">
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
          ? "border-[oklch(0.75_0.12_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
          : "border-[oklch(0.88_0.05_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]"
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

  return null;
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
    danger: "bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]",
    default: "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]",
    info: "bg-[color:var(--tlb-lavender,#EDE9FF)] text-[color:var(--tlb-purple,#4B3B8C)]",
    success: "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    warning: "bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]"
  };

  return classes[tone];
}

function getDeltaTone(metric: MetricDefinition, delta: number) {
  if (delta === 0) {
    return "text-[color:var(--sn-muted)]";
  }

  const lowerIsBetter = metric.key !== "totalOrders";
  const isGood = lowerIsBetter ? delta < 0 : delta > 0;
  return isGood ? "text-[oklch(0.58_0.13_150)]" : "text-[oklch(0.55_0.19_27)]";
}

function formatTargetTooltip(
  target: OrdersKpiMetricTargetEvaluation | undefined | null
) {
  if (!target) {
    return undefined;
  }

  const status = target.status === "OUT_OF_TARGET" ? "Off target" : "On target";
  return `${status} · ${percentFormatter.format(
    target.rate
  )}% (target ≤ ${percentFormatter.format(target.target)}%)`;
}

function formatDeltaShort(
  comparison: OrdersKpiMetricComparison | null,
  valueType: MetricDefinition["valueType"]
) {
  if (!comparison) {
    return "—";
  }

  if (comparison.delta === 0) {
    return "No change";
  }

  if (valueType === "percent") {
    return `${formatSignedPercentagePoints(comparison.delta)} pp`;
  }

  return comparison.deltaPercent === null
    ? formatSignedNumber(comparison.delta)
    : formatSignedPercent(comparison.deltaPercent);
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Orders KPI report error.";
}
