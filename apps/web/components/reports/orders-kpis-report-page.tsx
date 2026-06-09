"use client";

import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  ClipboardList,
  Inbox,
  PackageX,
  Percent,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TimerOff,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  StatsCardSkeleton,
  TableRowsSkeleton
} from "@/components/ui/skeleton";
import {
  ordersKpisApi,
  type OrdersKpiPerformanceReportResponse,
  type OrdersKpiPerformanceReportRow,
  type OrdersKpiPerformanceReportSortBy,
  type OrdersKpiPerformanceReportSortDirection,
  type OrdersKpiPerformanceReportSummary,
  type OrdersKpiPerformanceReportView
} from "@/lib/api/orders-kpis";
import { cn } from "@/lib/utils";

import {
  normalizeAttendanceDateRange as normalizeDateRange,
  validateAttendanceDateRange as validateReportDateRange,
} from "./attendance-date-range";
import { AttendanceDateRangeSelector } from "./attendance-date-range-selector";
import {
  backToOrdersKpisVendors,
  clearOrdersKpisReportScope,
  drillDownOrdersKpisChainRow,
  drillDownOrdersKpisVendorRow,
  parseOrdersKpisReportFilters,
  selectOrdersKpisReportView,
  serializeOrdersKpisReportFilters,
  type OrdersKpisReportFilters
} from "./orders-kpis-report-state";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

interface FilterDrafts {
  chainId: string;
  pickerSearch: string;
  vendorId: string;
}

const pageSizes = [10, 25, 50, 100];
const reportViews: Array<{
  description: string;
  label: string;
  value: OrdersKpiPerformanceReportView;
}> = [
  {
    description: "Group confirmed KPI rows by Chain.",
    label: "Chain View",
    value: "CHAIN"
  },
  {
    description: "Group confirmed KPI rows by Vendor.",
    label: "Vendor View",
    value: "VENDOR"
  },
  {
    description: "Group confirmed KPI rows by Picker.",
    label: "Picker View",
    value: "PICKER"
  }
];

const metricColumns: Array<{
  align?: "right";
  key: OrdersKpiPerformanceReportSortBy;
  label: string;
  render: (value: number | null) => string;
}> = [
  { align: "right", key: "totalOrders", label: "Total Orders", render: formatCount },
  { align: "right", key: "uho", label: "UHO", render: formatCount },
  { align: "right", key: "uhoRate", label: "UHO %", render: formatPercent },
  { align: "right", key: "notOnTime", label: "Not on time", render: formatCount },
  {
    align: "right",
    key: "qcFailedOrders",
    label: "QC Failed Orders",
    render: formatCount
  },
  { align: "right", key: "partialRefund", label: "Partial Refund", render: formatCount },
  { align: "right", key: "oos", label: "OOS", render: formatCount },
  { align: "right", key: "priceModified", label: "Price Modified", render: formatCount }
];

export function OrdersKpisReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const initialFilters = parseOrdersKpisReportFilters(
    new URLSearchParams(searchParamsText)
  );
  const lastSyncedQueryRef = useRef(searchParamsText);
  const [filters, setFilters] =
    useState<OrdersKpisReportFilters>(initialFilters);
  const [filterDrafts, setFilterDrafts] = useState<FilterDrafts>(
    filterDraftsFromFilters(initialFilters)
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [state, setState] =
    useState<AsyncState<OrdersKpiPerformanceReportResponse>>({
      status: "loading"
    });

  useEffect(() => {
    if (searchParamsText === lastSyncedQueryRef.current) {
      return;
    }

    const nextFilters = parseOrdersKpisReportFilters(
      new URLSearchParams(searchParamsText)
    );
    const nextQuery = serializeOrdersKpisReportFilters(nextFilters);

    lastSyncedQueryRef.current = nextQuery;
    setDateError(null);
    setFilters(nextFilters);
    setFilterDrafts(filterDraftsFromFilters(nextFilters));
  }, [searchParamsText]);

  useEffect(() => {
    const nextQuery = serializeOrdersKpisReportFilters(filters);
    if (nextQuery === searchParamsText) {
      lastSyncedQueryRef.current = searchParamsText;
      return;
    }

    lastSyncedQueryRef.current = nextQuery;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false
    });
  }, [filters, pathname, router, searchParamsText]);

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      setState({ status: "loading" });

      try {
        const data = await ordersKpisApi.performanceReport({
          chainId: filters.chainId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          page: filters.page,
          pageSize: filters.pageSize,
          pickerSearch: filters.pickerSearch,
          sortBy: filters.sortBy,
          sortDirection: filters.sortDirection,
          vendorId: filters.vendorId,
          view: filters.view
        });

        if (mounted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        if (mounted) {
          setState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to load Orders KPI report."
          });
        }
      }
    }

    void loadReport();

    return () => {
      mounted = false;
    };
  }, [filters]);

  function applyDateRange(dateFrom: string, dateTo: string) {
    const validationError = validateReportDateRange(dateFrom, dateTo);
    if (validationError) {
      setDateError(validationError);
      return;
    }

    setDateError(null);
    const nextRange = normalizeDateRange(dateFrom, dateTo);
    setFilters((current) => ({
      ...current,
      ...nextRange,
      page: 1
    }));
  }

  function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setFilters((current) => ({
      ...current,
      chainId: filterDrafts.chainId.trim(),
      page: 1,
      pickerSearch: filterDrafts.pickerSearch.trim(),
      vendorId: filterDrafts.vendorId.trim()
    }));
  }

  function clearFilters() {
    setFilterDrafts({
      chainId: "",
      pickerSearch: "",
      vendorId: ""
    });
    setFilters((current) => ({
      ...current,
      chainId: "",
      page: 1,
      pickerSearch: "",
      vendorId: "",
      view: "CHAIN"
    }));
  }

  function changeView(view: OrdersKpiPerformanceReportView) {
    const nextFilters = selectOrdersKpisReportView(filters, view);
    setFilters(nextFilters);
    setFilterDrafts(filterDraftsFromFilters(nextFilters));
  }

  function clearScope() {
    const nextFilters = clearOrdersKpisReportScope(filters);
    setFilters(nextFilters);
    setFilterDrafts(filterDraftsFromFilters(nextFilters));
  }

  function backToChains() {
    clearScope();
  }

  function backToVendors() {
    const nextFilters = backToOrdersKpisVendors(filters);
    setFilters(nextFilters);
    setFilterDrafts(filterDraftsFromFilters(nextFilters));
  }

  function drillDownRow(row: OrdersKpiPerformanceReportRow) {
    const nextFilters =
      row.kind === "CHAIN"
        ? drillDownOrdersKpisChainRow(filters, row)
        : row.kind === "VENDOR"
          ? drillDownOrdersKpisVendorRow(filters, row)
          : null;

    if (!nextFilters) {
      return;
    }

    setFilters(nextFilters);
    setFilterDrafts(filterDraftsFromFilters(nextFilters));
  }

  function changeSort(sortBy: OrdersKpiPerformanceReportSortBy) {
    setFilters((current) => ({
      ...current,
      page: 1,
      sortBy,
      sortDirection:
        current.sortBy === sortBy && current.sortDirection === "desc"
          ? "asc"
          : "desc"
    }));
  }

  function changePage(page: number) {
    setFilters((current) => ({
      ...current,
      page
    }));
  }

  function changePageSize(pageSize: number) {
    setFilters((current) => ({
      ...current,
      page: 1,
      pageSize
    }));
  }

  const activeFilterCount = [
    filters.chainId,
    filters.vendorId,
    filters.pickerSearch
  ].filter(Boolean).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Badge variant="muted">
              <CalendarBadgeIcon />
              Confirmed rows only
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              Orders KPI Report
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Review confirmed Orders KPI performance by Chain, Vendor, or Picker.
            </p>
          </div>
          <AttendanceDateRangeSelector
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            error={dateError}
            onChange={applyDateRange}
          />
        </div>
      </section>

      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        onSubmit={applyFilters}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">
              Report filters
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              These filters update both KPI cards and the table rows.
            </p>
          </div>
          <Badge variant={activeFilterCount > 0 ? "default" : "muted"}>
            {activeFilterCount} active
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Chain ID">
            <Input
              autoComplete="off"
              className="rounded-xl"
              onChange={(event) =>
                setFilterDrafts((current) => ({
                  ...current,
                  chainId: event.target.value
                }))
              }
              placeholder="All chains"
              value={filterDrafts.chainId}
            />
          </Field>
          <Field label="Vendor ID">
            <Input
              autoComplete="off"
              className="rounded-xl"
              onChange={(event) =>
                setFilterDrafts((current) => ({
                  ...current,
                  vendorId: event.target.value
                }))
              }
              placeholder="All vendors"
              value={filterDrafts.vendorId}
            />
          </Field>
          <Field label="Picker search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="off"
                className="rounded-xl pl-9"
                onChange={(event) =>
                  setFilterDrafts((current) => ({
                    ...current,
                    pickerSearch: event.target.value
                  }))
                }
                placeholder="Name or Shopper ID"
                value={filterDrafts.pickerSearch}
              />
            </div>
          </Field>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            className="h-11 rounded-xl"
            onClick={clearFilters}
            type="button"
            variant="outline"
          >
            Clear all filters
          </Button>
          <Button className="h-11 rounded-xl" type="submit">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Apply filters
          </Button>
        </div>
      </form>

      <StateContent
        onRetry={() => setFilters((current) => ({ ...current }))}
        state={state}
      >
        {(data) => (
          <>
            <KpiCards summary={data.summary} />
            <ReportTable
              activeView={filters.view}
              data={data}
              filters={filters}
              onBackToChains={backToChains}
              onBackToVendors={backToVendors}
              onClearScope={clearScope}
              onPageChange={changePage}
              onPageSizeChange={changePageSize}
              onRowDrillDown={drillDownRow}
              onSortChange={changeSort}
              onViewChange={changeView}
              sortBy={filters.sortBy}
              sortDirection={filters.sortDirection}
            />
          </>
        )}
      </StateContent>
    </div>
  );
}

function KpiCards({ summary }: { summary: OrdersKpiPerformanceReportSummary }) {
  const cards: Array<{
    icon: LucideIcon;
    label: string;
    tone: "default" | "blue" | "green" | "amber" | "rose";
    value: string;
  }> = [
    {
      icon: ShoppingCart,
      label: "Total Orders",
      tone: "default",
      value: formatCount(summary.totalOrders)
    },
    {
      icon: ClipboardList,
      label: "UHO",
      tone: "amber",
      value: formatCount(summary.uho)
    },
    {
      icon: Percent,
      label: "UHO %",
      tone: "amber",
      value: formatPercent(summary.uhoRate)
    },
    {
      icon: TimerOff,
      label: "Not on time",
      tone: "rose",
      value: formatCount(summary.notOnTime)
    },
    {
      icon: AlertCircle,
      label: "QC Failed Orders",
      tone: "rose",
      value: formatCount(summary.qcFailedOrders)
    },
    {
      icon: CircleDollarSign,
      label: "Partial Refund",
      tone: "blue",
      value: formatCount(summary.partialRefund)
    },
    {
      icon: PackageX,
      label: "OOS",
      tone: "amber",
      value: formatCount(summary.oos)
    },
    {
      icon: BarChart3,
      label: "Price Modified",
      tone: "green",
      value: formatCount(summary.priceModified)
    }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: LucideIcon;
  label: string;
  tone: "default" | "blue" | "green" | "amber" | "rose";
  value: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 truncate text-2xl font-semibold tabular-nums text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            toneClassName(tone)
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function ReportTable({
  activeView,
  data,
  filters,
  onBackToChains,
  onBackToVendors,
  onClearScope,
  onPageChange,
  onPageSizeChange,
  onRowDrillDown,
  onSortChange,
  onViewChange,
  sortBy,
  sortDirection
}: {
  activeView: OrdersKpiPerformanceReportView;
  data: OrdersKpiPerformanceReportResponse;
  filters: OrdersKpisReportFilters;
  onBackToChains: () => void;
  onBackToVendors: () => void;
  onClearScope: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRowDrillDown: (row: OrdersKpiPerformanceReportRow) => void;
  onSortChange: (sortBy: OrdersKpiPerformanceReportSortBy) => void;
  onViewChange: (view: OrdersKpiPerformanceReportView) => void;
  sortBy: OrdersKpiPerformanceReportSortBy;
  sortDirection: OrdersKpiPerformanceReportSortDirection;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">
            Report table
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {data.pagination.totalRows.toLocaleString()} grouped rows.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {reportViews.map((view) => (
            <button
              aria-pressed={activeView === view.value}
              className={cn(
                "min-h-10 rounded-lg px-3 text-xs font-semibold text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                activeView === view.value
                  ? "bg-white text-primary shadow-sm"
                  : "hover:bg-white/70"
              )}
              key={view.value}
              onClick={() => onViewChange(view.value)}
              title={view.description}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <ScopeStrip
        data={data}
        filters={filters}
        onBackToChains={onBackToChains}
        onBackToVendors={onBackToVendors}
        onClearScope={onClearScope}
      />

      {data.rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="w-[260px] px-4 py-3">Group</th>
                <th className="w-[250px] px-4 py-3">Context</th>
                {metricColumns.map((column) => (
                  <th
                    className={cn(
                      "whitespace-nowrap px-4 py-3",
                      column.align === "right" && "text-right"
                    )}
                    key={column.key}
                  >
                    <SortHeader
                      active={sortBy === column.key}
                      direction={sortDirection}
                      label={column.label}
                      onClick={() => onSortChange(column.key)}
                    />
                  </th>
                ))}
                <th className="w-[150px] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <ReportRow
                  key={rowKey(row)}
                  onDrillDown={onRowDrillDown}
                  row={row}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">Rows</span>
          <Select
            aria-label="Rows per page"
            className="h-10 rounded-xl"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={String(data.pagination.pageSize)}
            wrapperClassName="w-28"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>

        <PaginationControls
          onPageChange={onPageChange}
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalRows={data.pagination.totalRows}
        />
      </div>
    </section>
  );
}

function ScopeStrip({
  data,
  filters,
  onBackToChains,
  onBackToVendors,
  onClearScope
}: {
  data: OrdersKpiPerformanceReportResponse;
  filters: OrdersKpisReportFilters;
  onBackToChains: () => void;
  onBackToVendors: () => void;
  onClearScope: () => void;
}) {
  const hasScope = Boolean(filters.chainId || filters.vendorId);
  const canBackToVendors = filters.view === "PICKER" && hasScope;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-400">
          Scope
        </span>
        <ScopeCrumbs data={data} filters={filters} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {hasScope ? (
          <Button
            className="h-9 rounded-xl"
            onClick={onClearScope}
            type="button"
            variant="outline"
          >
            Clear scope
          </Button>
        ) : null}
        {filters.view !== "CHAIN" || hasScope ? (
          <Button
            className="h-9 rounded-xl"
            onClick={onBackToChains}
            type="button"
            variant="outline"
          >
            Back to Chains
          </Button>
        ) : null}
        {canBackToVendors ? (
          <Button
            className="h-9 rounded-xl"
            onClick={onBackToVendors}
            type="button"
            variant="outline"
          >
            Back to Vendors
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ScopeCrumbs({
  data,
  filters
}: {
  data: OrdersKpiPerformanceReportResponse;
  filters: OrdersKpisReportFilters;
}) {
  if (!filters.chainId && !filters.vendorId) {
    return (
      <Badge className="rounded-full bg-white text-slate-700" variant="outline">
        All Chains
      </Badge>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {filters.chainId ? (
        <ScopeChip label="Chain" value={data.scope.chainName ?? filters.chainId} />
      ) : null}
      {filters.chainId && filters.vendorId ? (
        <span className="text-xs font-semibold text-slate-400">&gt;</span>
      ) : null}
      {filters.vendorId ? (
        <ScopeChip label="Vendor" value={data.scope.vendorName ?? filters.vendorId} />
      ) : null}
    </div>
  );
}

function ScopeChip({ label, value }: { label: string; value: string }) {
  return (
    <Badge
      className="max-w-full rounded-full bg-white text-slate-700"
      title={`${label}: ${value}`}
      variant="outline"
    >
      <span className="text-slate-400">{label}: </span>
      <span className="truncate">{value}</span>
    </Badge>
  );
}

function ReportRow({
  onDrillDown,
  row
}: {
  onDrillDown: (row: OrdersKpiPerformanceReportRow) => void;
  row: OrdersKpiPerformanceReportRow;
}) {
  const group = groupLabel(row);
  const context = contextItems(row);
  const actionLabel = drillDownActionLabel(row);
  const canDrillDown = Boolean(actionLabel);

  return (
    <tr
      className={cn(
        "bg-white align-top transition hover:bg-slate-50/70",
        canDrillDown && "cursor-pointer"
      )}
      onDoubleClick={() => {
        if (canDrillDown) {
          onDrillDown(row);
        }
      }}
      title={canDrillDown ? `${actionLabel} for ${group}` : undefined}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            {row.kind === "PICKER" ? (
              <UserRound className="h-4 w-4" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-950">{group}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {row.kind}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="grid gap-1">
          {context.map((item) => (
            <p
              className="min-w-0 truncate text-xs font-medium text-slate-600"
              key={item.label}
              title={item.value}
            >
              <span className="text-slate-400">{item.label}: </span>
              {item.value}
            </p>
          ))}
        </div>
      </td>
      {metricColumns.map((column) => (
        <td
          className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-800"
          key={column.key}
        >
          {column.render(row[column.key])}
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        {actionLabel ? (
          <Button
            className="h-9 rounded-xl"
            onClick={(event) => {
              event.stopPropagation();
              onDrillDown(row);
            }}
            type="button"
            variant="outline"
          >
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <span className="text-xs font-medium text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}

function SortHeader({
  active,
  direction,
  label,
  onClick
}: {
  active: boolean;
  direction: OrdersKpiPerformanceReportSortDirection;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "ml-auto inline-flex items-center justify-end gap-1 rounded-lg px-2 py-1 text-right transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        active && "text-primary"
      )}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <ArrowUpDown className="h-3.5 w-3.5" />
      {active ? (
        <span className="sr-only">
          Sorted {direction === "asc" ? "ascending" : "descending"}
        </span>
      ) : null}
    </button>
  );
}

function PaginationControls({
  onPageChange,
  page,
  totalPages,
  totalRows
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
  totalRows: number;
}) {
  const lastPage = Math.max(1, totalPages);
  const hasRows = totalRows > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <p className="text-center text-sm font-medium tabular-nums text-slate-500 sm:text-left">
        Page {Math.min(page, lastPage).toLocaleString()} of{" "}
        {lastPage.toLocaleString()}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button
          aria-label="First page"
          className="h-10 w-10 rounded-xl p-0"
          disabled={!hasRows || page <= 1}
          onClick={() => onPageChange(1)}
          type="button"
          variant="ghost"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Previous page"
          className="h-10 w-10 rounded-xl p-0"
          disabled={!hasRows || page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
          variant="ghost"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Next page"
          className="h-10 w-10 rounded-xl p-0"
          disabled={!hasRows || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
          type="button"
          variant="ghost"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Last page"
          className="h-10 w-10 rounded-xl p-0"
          disabled={!hasRows || page >= lastPage}
          onClick={() => onPageChange(lastPage)}
          type="button"
          variant="ghost"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StateContent({
  children,
  onRetry,
  state
}: {
  children: (data: OrdersKpiPerformanceReportResponse) => ReactNode;
  onRetry: () => void;
  state: AsyncState<OrdersKpiPerformanceReportResponse>;
}) {
  if (state.status === "loading") {
    return (
      <div className="grid gap-5" role="status" aria-busy="true">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <StatsCardSkeleton key={index} />
          ))}
        </section>
        <TableRowsSkeleton label="Loading Orders KPI report rows" rows={7} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold">Unable to load Orders KPI report</h2>
              <p className="mt-1 break-words">{state.error}</p>
            </div>
          </div>
          <Button
            className="h-10 rounded-xl bg-white text-rose-800 hover:bg-rose-100"
            onClick={onRetry}
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return <>{children(state.data)}</>;
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
      <Inbox className="h-10 w-10 text-slate-400" />
      <h3 className="mt-3 text-sm font-semibold text-slate-950">
        No confirmed KPI rows found
      </h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">
        Adjust the active filters or date range to see report rows.
      </p>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function CalendarBadgeIcon() {
  return <BarChart3 className="mr-1.5 h-3.5 w-3.5" />;
}

function filterDraftsFromFilters(filters: OrdersKpisReportFilters): FilterDrafts {
  return {
    chainId: filters.chainId,
    pickerSearch: filters.pickerSearch,
    vendorId: filters.vendorId
  };
}

function drillDownActionLabel(row: OrdersKpiPerformanceReportRow) {
  if (row.kind === "CHAIN" && row.chainId) {
    return "Open Vendors";
  }

  if (row.kind === "VENDOR" && row.vendorId) {
    return "Open Pickers";
  }

  return null;
}

function groupLabel(row: OrdersKpiPerformanceReportRow) {
  if (row.kind === "CHAIN") {
    return row.chainName;
  }

  if (row.kind === "VENDOR") {
    return row.vendorName;
  }

  return row.pickerName;
}

function contextItems(row: OrdersKpiPerformanceReportRow) {
  if (row.kind === "CHAIN") {
    return [
      { label: "Vendors", value: formatCount(row.vendorCount) },
      { label: "Pickers", value: formatCount(row.pickerCount) }
    ];
  }

  if (row.kind === "VENDOR") {
    return [
      { label: "Chain", value: row.chainName ?? "Unmapped Chain" },
      { label: "Vendor ID", value: row.vendorId ?? "Unmapped Vendor" },
      { label: "Source ID", value: row.sourceVendorId ?? "Missing" },
      { label: "Pickers", value: formatCount(row.pickerCount) }
    ];
  }

  return [
    { label: "Shopper ID", value: row.shopperId },
    { label: "Vendor", value: row.vendorName ?? "Unmapped Vendor" },
    { label: "Chain", value: row.chainName ?? "Unmapped Chain" },
    { label: "Source ID", value: row.sourceVendorId ?? "Missing" }
  ];
}

function rowKey(row: OrdersKpiPerformanceReportRow) {
  if (row.kind === "CHAIN") {
    return `chain:${row.chainId ?? row.chainName}`;
  }

  if (row.kind === "VENDOR") {
    return `vendor:${row.vendorId ?? row.sourceVendorId ?? row.vendorName}`;
  }

  return `picker:${row.userId}:${row.shopperId}`;
}

function toneClassName(tone: "default" | "blue" | "green" | "amber" | "rose") {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700"
  };

  return tones[tone];
}

function formatCount(value: number | null) {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  })}%`;
}
