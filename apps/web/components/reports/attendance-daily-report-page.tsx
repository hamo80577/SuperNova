"use client";

import {
  ArrowUpDown,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Gauge,
  GitBranch,
  ListChecks,
  LogIn,
  LogOut,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  TriangleAlert,
  UploadCloud,
  UserRound,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DetailPanelSkeleton, TableRowsSkeleton } from "@/components/ui/skeleton";
import {
  attendanceApi,
  type AttendanceCalculatedStatus,
  type AttendanceDailyReportAnalytics,
  type AttendanceDailyReportResponse,
  type AttendanceDailyReportRow,
  type AttendanceDailyReportSortBy,
  type AttendanceDailyReportSortDirection,
  type AttendanceMetricDelta,
  type AttendanceSegmentMetric
} from "@/lib/api/attendance";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: T; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

type PerformanceView = "all" | "onTime" | "lateOver15" | "absent" | "onLeave";
type AttendanceStatusFilter = AttendanceCalculatedStatus | "";
type ChartTone =
  | "clean"
  | "error"
  | "late1"
  | "late2"
  | "late3"
  | "leave"
  | "neutral";

interface ChartHoverInfo {
  count: number;
  label: string;
  percentage: number;
  tone: ChartTone;
}

interface AttendanceDailyReportFilters {
  branch: string;
  chain: string;
  periodMonth: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  sortBy: AttendanceDailyReportSortBy;
  sortDirection: AttendanceDailyReportSortDirection;
  status: AttendanceStatusFilter;
  page: number;
  pageSize: number;
}

export type AttendanceReportWorkspaceVariant = "admin" | "area-manager" | "champ";

const workspaceCopy: Record<
  AttendanceReportWorkspaceVariant,
  {
    description: string;
    scopeNote: string;
    showImportShortcut: boolean;
    title: string;
  }
> = {
  admin: {
    description: "Track picker attendance and manage daily records.",
    scopeNote:
      "Source Chain and Branch are imported attendance-file labels for reporting filters only. Operational access remains controlled by backend permissions.",
    showImportShortcut: true,
    title: "Attendance"
  },
  "area-manager": {
    description: "Read-only attendance scoped to your current Chain assignments.",
    scopeNote:
      "This report is scoped by your current operational assignments. Source Chain and Branch are imported file labels that only filter the scoped data.",
    showImportShortcut: false,
    title: "Attendance"
  },
  champ: {
    description:
      "Read-only attendance scoped to your current assigned branches and pickers.",
    scopeNote:
      "This report is scoped by your current assigned branches and Pickers. Source Chain and Branch are imported file labels that only filter the scoped data.",
    showImportShortcut: false,
    title: "Attendance"
  }
};

const pageSizes = [10, 25, 50, 100];
const performanceViews: Array<{ label: string; value: PerformanceView }> = [
  { label: "Attend rate", value: "all" },
  { label: "On time", value: "onTime" },
  { label: "Late >15", value: "lateOver15" },
  { label: "Absent", value: "absent" },
  { label: "On leave", value: "onLeave" }
];
const sortOptions: Array<{
  icon: LucideIcon;
  label: string;
  value: AttendanceDailyReportSortBy;
}> = [
  { icon: CalendarDays, label: "Sort by date", value: "date" },
  { icon: UserRound, label: "Sort by name", value: "name" },
  { icon: MapPin, label: "Sort by location", value: "location" },
  { icon: BadgeCheck, label: "Sort by status", value: "status" },
  { icon: Clock3, label: "Sort by log hours", value: "hours" }
];

export function AttendanceDailyReportPage({
  variant = "admin"
}: {
  variant?: AttendanceReportWorkspaceVariant;
}) {
  const copy = workspaceCopy[variant];
  const initialFilters = useMemo(createInitialFilters, []);
  const [filters, setFilters] =
    useState<AttendanceDailyReportFilters>(initialFilters);
  const [searchDraft, setSearchDraft] = useState(initialFilters.search);
  const [performanceView, setPerformanceView] =
    useState<PerformanceView>("all");
  const [dateError, setDateError] = useState<string | null>(null);
  const [state, setState] = useState<AsyncState<AttendanceDailyReportResponse>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setState((current) =>
        current.status === "ready" || current.status === "loading"
          ? { status: "loading", data: current.data }
          : { status: "loading" }
      );
      try {
        const data = await attendanceApi.dailyReport({
          branch: filters.branch,
          chain: filters.chain,
          periodMonth: filters.periodMonth,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          pickerSearch: filters.search,
          sortBy: filters.sortBy,
          sortDirection: filters.sortDirection,
          status: filters.status,
          page: filters.page,
          pageSize: filters.pageSize
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
                : "Unable to load attendance report."
          });
        }
      }
    }

    void load();
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
      page: 1,
      periodMonth: nextRange.dateFrom.slice(0, 7)
    }));
  }

  function shiftRange(direction: -1 | 1) {
    const days = rangeLength(filters.dateFrom, filters.dateTo);
    applyDateRange(
      addDaysIso(filters.dateFrom, direction * days),
      addDaysIso(filters.dateTo, direction * days)
    );
  }

  function resetToYesterday() {
    const yesterday = yesterdayIsoDate();
    setDateError(null);
    setFilters((current) => ({
      ...current,
      dateFrom: yesterday,
      dateTo: yesterday,
      page: 1,
      periodMonth: yesterday.slice(0, 7)
    }));
  }

  function applySearch() {
    setFilters((current) => ({
      ...current,
      page: 1,
      search: searchDraft.trim()
    }));
  }

  function clearSearch() {
    setSearchDraft("");
    setFilters((current) => ({ ...current, page: 1, search: "" }));
  }

  function applyListFilters(
    nextFilters: Partial<
      Pick<
        AttendanceDailyReportFilters,
        "branch" | "chain" | "sortBy" | "sortDirection" | "status"
      >
    >
  ) {
    setFilters((current) => ({ ...current, ...nextFilters, page: 1 }));
  }

  const report =
    state.status === "ready"
      ? state.data
      : state.status === "loading"
        ? state.data ?? null
        : null;
  const canMoveForward =
    addDaysIso(filters.dateTo, rangeLength(filters.dateFrom, filters.dateTo)) <=
    yesterdayIsoDate();

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-slate-50/80 p-3 sm:p-4">
      <div className="grid min-w-0 gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {copy.description}
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              {copy.scopeNote}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              aria-label="Reset to yesterday"
              className="h-11 w-11 rounded-xl border-sky-200 bg-sky-50 p-0 text-sky-700 hover:bg-sky-100"
              onClick={resetToYesterday}
              type="button"
              variant="outline"
            >
              <Star className="h-5 w-5" />
            </Button>
            <Button
              aria-label="Previous date range"
              className="h-11 w-11 rounded-xl p-0"
              onClick={() => shiftRange(-1)}
              type="button"
              variant="outline"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <DateRangeControl
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              error={dateError}
              onChange={applyDateRange}
            />
            <Button
              aria-label="Next date range"
              className="h-11 w-11 rounded-xl p-0"
              disabled={!canMoveForward}
              onClick={() => shiftRange(1)}
              type="button"
              variant="outline"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            {copy.showImportShortcut ? (
              <Link
                aria-label="Import attendance"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-11 w-11 rounded-xl p-0"
                )}
                href="/admin/attendance/imports"
                prefetch
              >
                <UploadCloud className="h-5 w-5" />
              </Link>
            ) : null}
          </div>
        </header>

        <ReportStateView state={state}>
          {(data) => (
            <>
              <ReportFilterBar
                filterOptions={data.filterOptions}
                filters={{
                  branch: filters.branch,
                  chain: filters.chain,
                  status: filters.status
                }}
                onClearSearch={clearSearch}
                onFilterChange={applyListFilters}
                onSearch={applySearch}
                searchDraft={searchDraft}
                setSearchDraft={setSearchDraft}
              />
              <DashboardGrid
                analytics={data.analytics}
                performanceView={performanceView}
                rangeTitle={rangeAttendanceTitle(data.analytics.range)}
                onPerformanceViewChange={setPerformanceView}
              />
              <AttendanceList
                onPageChange={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
                onPageSizeChange={(pageSize) =>
                  setFilters((current) => ({ ...current, page: 1, pageSize }))
                }
                filters={{
                  sortBy: filters.sortBy,
                  sortDirection: filters.sortDirection
                }}
                onFilterChange={applyListFilters}
                rows={data.rows}
                pagination={data.pagination}
              />
            </>
          )}
        </ReportStateView>

        {report ? (
          <p className="text-xs leading-5 text-slate-500">
            Showing {report.rows.length} of {report.pagination.totalRows} rows
            for {formatRangeLabel(report.analytics.range.dateFrom, report.analytics.range.dateTo)}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DashboardGrid({
  analytics,
  onPerformanceViewChange,
  performanceView,
  rangeTitle
}: {
  analytics: AttendanceDailyReportAnalytics;
  onPerformanceViewChange: (value: PerformanceView) => void;
  performanceView: PerformanceView;
  rangeTitle: string;
}) {
  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.7fr)_minmax(24rem,0.95fr)]">
      <AttendanceRateCard analytics={analytics} title={rangeTitle} />
      <div className="grid gap-4">
        <LateBucketsCard analytics={analytics} />
        <AverageHoursCard analytics={analytics} />
      </div>
      <PerformanceCard
        analytics={analytics}
        onViewChange={onPerformanceViewChange}
        view={performanceView}
      />
    </section>
  );
}

function AttendanceRateCard({
  analytics,
  title
}: {
  analytics: AttendanceDailyReportAnalytics;
  title: string;
}) {
  const quality = analytics.shiftQuality;
  const problemMix = analytics.performance.problemMix;
  const durationError = combineSegments(
    problemMix.under8,
    problemMix.over15,
    quality.counts.totalShifts.value
  );

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <CardTitle icon={ListChecks} title={title} />
      <div className="mt-8">
        <MetricValue
          delta={quality.cleanShiftRate.delta}
          label="Attendance Rate"
          value={`${formatNumber(quality.cleanShiftRate.value)}%`}
        />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ShiftQualityStat
          label="Total Shifts"
          metric={quality.counts.totalShifts}
          tone="total"
        />
        <ShiftQualityStat
          label="Total Clean Shift"
          metric={quality.counts.cleanShifts}
          tone="clean"
        />
        <ShiftQualityStat
          label="Total Error Shift"
          metric={quality.counts.errorShifts}
          tone="error"
        />
      </div>
      <QualityStrip
        clean={quality.counts.cleanShifts.value}
        error={quality.counts.errorShifts.value}
        total={quality.counts.totalShifts.value}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MixTile color="bg-orange-400" label="Late" metric={problemMix.late} />
        <MixTile color="bg-rose-500" label="Absent" metric={problemMix.absent} />
        <MixTile color="bg-amber-500" label="Duration Error" metric={durationError} />
      </div>
    </section>
  );
}

function LateBucketsCard({
  analytics
}: {
  analytics: AttendanceDailyReportAnalytics;
}) {
  const buckets = analytics.lateBuckets;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <CardTitle icon={UsersRound} title="Late Rate" />
      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">
          Total late shifts
        </p>
        <div className="mt-2 flex items-end justify-center gap-1">
          <AnimatedMetricText
            className="text-4xl font-semibold tabular-nums text-slate-950"
            value={buckets.totalLateCount.toLocaleString()}
          />
          <span className="pb-1 text-sm font-medium text-slate-500">
            of {analytics.attendanceRate.totalShifts.toLocaleString()}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">created shifts</p>
      </div>
      <LateBucketMiniTable buckets={buckets} />
    </section>
  );
}

function AverageHoursCard({
  analytics
}: {
  analytics: AttendanceDailyReportAnalytics;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <CardTitle icon={Clock3} title="AVG Shift Duration" />
      <div className="mt-16">
        <MetricValue
          delta={analytics.averageLogHours.delta}
          label="Average attended shift"
          value={formatHours(analytics.averageLogHours.value)}
        />
      </div>
    </section>
  );
}

function PerformanceCard({
  analytics,
  onViewChange,
  view
}: {
  analytics: AttendanceDailyReportAnalytics;
  onViewChange: (value: PerformanceView) => void;
  view: PerformanceView;
}) {
  const selected = performanceMetricForView(analytics, view);

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <CardTitle icon={Gauge} title="Attendance rate" />
      <div className="mt-6 overflow-hidden rounded-xl bg-slate-100 p-1">
        <div className="flex gap-1 overflow-x-auto">
          {performanceViews.map((item) => (
            <button
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-sm font-medium text-slate-600 transition",
                item.value === view
                  ? "bg-white text-slate-950 shadow-sm"
                  : "hover:bg-white/70"
              )}
              key={item.value}
              onClick={() => onViewChange(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-[20rem] flex-1 items-center justify-center">
        <ArcGauge metric={selected} view={view} />
      </div>
    </section>
  );
}

function AttendanceList({
  filters,
  onFilterChange,
  onPageChange,
  onPageSizeChange,
  pagination,
  rows
}: {
  filters: Pick<
    AttendanceDailyReportFilters,
    "sortBy" | "sortDirection"
  >;
  onFilterChange: (
    nextFilters: Partial<
      Pick<
        AttendanceDailyReportFilters,
        "sortBy" | "sortDirection"
      >
    >
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pagination: AttendanceDailyReportResponse["pagination"];
  rows: AttendanceDailyReportRow[];
}) {
  const lastPage = Math.max(pagination.totalPages, 1);
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle icon={ListChecks} title="Attendance List" />
        <div className="relative">
          <Button
            aria-expanded={sortOpen}
            aria-label="Sort attendance rows"
            className="h-10 w-10 rounded-xl p-0"
            onClick={() => setSortOpen((current) => !current)}
            type="button"
            variant="outline"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          {sortOpen ? (
            <SortMenu filters={filters} onFilterChange={onFilterChange} />
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="hidden w-full table-fixed text-left text-sm lg:table">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <TableHeader>ID Employee</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Check-in Time</TableHeader>
              <TableHeader>Check-Out Time</TableHeader>
              <TableHeader>Log Hours</TableHeader>
              <TableHeader>Status</TableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr className="border-t border-slate-100" key={row.id}>
                  <TableCell>
                    <TruncatedText className="font-medium text-slate-950" value={row.shopperId} />
                  </TableCell>
                  <TableCell>
                    <NameCell row={row} />
                  </TableCell>
                  <TableCell>
                    <LocationPill value={row.sourceLocation} />
                  </TableCell>
                  <TableCell>
                    {isLeaveStatus(row) ? null : <CheckInCell row={row} />}
                  </TableCell>
                  <TableCell>
                    {isLeaveStatus(row) ? null : <TimeCell icon={LogOut} value={row.actualCheckoutTime} />}
                  </TableCell>
                  <TableCell>
                    {isLeaveStatus(row) ? null : <LogHoursCell row={row} />}
                  </TableCell>
                  <TableCell>
                    <StatusBadge row={row} />
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                  No attendance rows match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="grid gap-3 p-3 lg:hidden">
          {rows.length > 0 ? (
            rows.map((row) => (
              <article className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" key={row.id}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <TruncatedText className="font-semibold text-slate-950" value={row.pickerName} />
                    <p className="mt-1 text-xs text-slate-500">{row.shopperId}</p>
                  </div>
                  <StatusBadge row={row} />
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <Definition
                    label="Location"
                    value={<LocationPill value={row.sourceLocation} />}
                  />
                  <Definition
                    label="Check-in"
                    value={isLeaveStatus(row) ? null : <CheckInCell row={row} />}
                  />
                  <Definition
                    label="Check-out"
                    value={isLeaveStatus(row) ? null : formatText(row.actualCheckoutTime)}
                  />
                  <Definition
                    label="Log Hours"
                    value={isLeaveStatus(row) ? null : <LogHoursCell row={row} />}
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              No attendance rows match the selected filters.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-medium text-slate-700">
          Total Attendance : {pagination.totalRows.toLocaleString()}
        </p>
        <PaginationControls
          onPageChange={onPageChange}
          page={pagination.page}
          totalPages={lastPage}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Show per Page
          <Select
            aria-label="Rows per page"
            className="h-10 w-20 rounded-xl"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pagination.pageSize}
          >
            {pageSizes.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </section>
  );
}

function DateRangeControl({
  dateFrom,
  dateTo,
  error,
  onChange
}: {
  dateFrom: string;
  dateTo: string;
  error: string | null;
  onChange: (dateFrom: string, dateTo: string) => void;
}) {
  const maxDate = yesterdayIsoDate();

  return (
    <div className="min-w-0 sm:min-w-[22rem]">
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 gap-1 rounded-xl border bg-white p-1 shadow-sm sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)]",
          error ? "border-rose-200" : "border-slate-200"
        )}
      >
        <DatePicker
          className="h-9 border-0 px-2 shadow-none"
          maxDate={maxDate}
          maxYear={Number(maxDate.slice(0, 4))}
          onChange={(value) => onChange(value, dateTo)}
          placeholder="Start"
          quickActions={["yesterday"]}
          value={dateFrom}
        />
        <DatePicker
          align="end"
          className="h-9 border-0 px-2 shadow-none"
          maxDate={maxDate}
          maxYear={Number(maxDate.slice(0, 4))}
          onChange={(value) => onChange(dateFrom, value)}
          placeholder="End"
          quickActions={["yesterday"]}
          value={dateTo}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

function ReportFilterBar({
  filterOptions,
  filters,
  onClearSearch,
  onFilterChange,
  onSearch,
  searchDraft,
  setSearchDraft
}: {
  filterOptions: AttendanceDailyReportResponse["filterOptions"];
  filters: Pick<AttendanceDailyReportFilters, "branch" | "chain" | "status">;
  onClearSearch: () => void;
  onFilterChange: (
    nextFilters: Partial<
      Pick<AttendanceDailyReportFilters, "branch" | "chain" | "status">
    >
  ) => void;
  onSearch: () => void;
  searchDraft: string;
  setSearchDraft: (value: string) => void;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm xl:grid-cols-[minmax(18rem,1.1fr)_minmax(0,2fr)_auto]">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <Input
          className="h-11 rounded-xl border-slate-200 bg-white pl-9 shadow-sm"
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
          placeholder="Search name, ID, location"
          value={searchDraft}
        />
      </label>
      <div className="grid min-w-0 gap-2 md:grid-cols-3">
        <FilterSelectShell tone="rose">
          <Select
            aria-label="Filter by status"
            className="h-11 rounded-xl border-0 bg-transparent shadow-none"
            leadingIcon={<BadgeCheck className="h-4 w-4" />}
            onChange={(event) =>
              onFilterChange({
                status: event.target.value as AttendanceStatusFilter
              })
            }
            value={filters.status}
            wrapperClassName="min-w-0"
          >
            <option value="">All states</option>
            {filterOptions.statuses.map((status) => (
              <option key={status} value={status}>
                {statusFilterLabel(status)}
              </option>
            ))}
          </Select>
        </FilterSelectShell>
        <FilterSelectShell tone="amber">
          <Select
            aria-label="Filter by imported source chain label"
            className="h-11 rounded-xl border-0 bg-transparent shadow-none"
            leadingIcon={<GitBranch className="h-4 w-4" />}
            onChange={(event) =>
              onFilterChange({ branch: "", chain: event.target.value })
            }
            searchable
            searchPlaceholder="Search source chains"
            value={filters.chain}
            wrapperClassName="min-w-0"
          >
            <option value="">All source chains</option>
            {filterOptions.chains.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </Select>
        </FilterSelectShell>
        <FilterSelectShell tone="sky">
          <Select
            aria-label="Filter by imported source branch label"
            className="h-11 rounded-xl border-0 bg-transparent shadow-none"
            leadingIcon={<MapPin className="h-4 w-4" />}
            onChange={(event) => onFilterChange({ branch: event.target.value })}
            searchable
            searchPlaceholder="Search source branches"
            value={filters.branch}
            wrapperClassName="min-w-0"
          >
            <option value="">All source branches</option>
            {filterOptions.branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </Select>
        </FilterSelectShell>
      </div>
      <div className="flex items-center gap-2">
        <Button className="h-11 rounded-xl" onClick={onSearch} type="button">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Search
        </Button>
        <Button className="h-11 rounded-xl" onClick={onClearSearch} type="button" variant="ghost">
          Clear
        </Button>
      </div>
      <p className="min-w-0 text-xs leading-5 text-slate-500 xl:col-span-3">
        Chain and Branch filters use imported source labels from the attendance
        file fields <span className="font-mono text-[11px]">sourceSubDivision</span>{" "}
        and <span className="font-mono text-[11px]">sourceLocation</span>. They
        are read-only reporting dimensions, not assignment-controlled hierarchy,
        authorization, or operational source of truth.
      </p>
    </section>
  );
}

function FilterSelectShell({
  children,
  tone
}: {
  children: ReactNode;
  tone: "amber" | "rose" | "sky";
}) {
  const toneClass = {
    amber: "border-amber-100 bg-amber-50/60",
    rose: "border-rose-100 bg-rose-50/60",
    sky: "border-sky-100 bg-sky-50/60"
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-2xl border p-1 shadow-sm", toneClass)}>
      {children}
    </div>
  );
}

function SortMenu({
  filters,
  onFilterChange
}: {
  filters: Pick<
    AttendanceDailyReportFilters,
    "sortBy" | "sortDirection"
  >;
  onFilterChange: (
    nextFilters: Partial<
      Pick<
        AttendanceDailyReportFilters,
        "branch" | "chain" | "sortBy" | "sortDirection" | "status"
      >
    >
  ) => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="text-xs font-semibold uppercase text-slate-400">Sort rows</p>
      <div className="mt-3 grid gap-2">
        {sortOptions.map((option) => {
          const Icon = option.icon;
          const selected = filters.sortBy === option.value;

          return (
            <button
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition",
                selected
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
              key={option.value}
              onClick={() => onFilterChange({ sortBy: option.value })}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{option.label.replace("Sort by ", "")}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        {(["asc", "desc"] as const).map((direction) => (
          <Button
            key={direction}
            onClick={() => onFilterChange({ sortDirection: direction })}
            type="button"
            variant={filters.sortDirection === direction ? "default" : "outline"}
          >
            {direction === "asc" ? "Ascending" : "Descending"}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ReportStateView({
  children,
  state
}: {
  children: (data: AttendanceDailyReportResponse) => ReactNode;
  state: AsyncState<AttendanceDailyReportResponse>;
}) {
  if (state.status === "loading") {
    if (state.data) {
      return (
        <div
          aria-busy="true"
          className="grid gap-4 opacity-80 transition-opacity duration-200"
          role="status"
        >
          {children(state.data)}
        </div>
      );
    }

    return (
      <div className="grid gap-4" role="status" aria-busy="true">
        <DetailPanelSkeleton label="Loading attendance analytics" />
        <TableRowsSkeleton label="Loading attendance rows" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {state.error}
      </div>
    );
  }

  return <>{children(state.data)}</>;
}

function CardTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="truncate text-lg font-semibold tracking-normal text-slate-950">
        {title}
      </h2>
    </div>
  );
}

function MetricValue({
  delta,
  label,
  value
}: {
  delta: AttendanceMetricDelta;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <AnimatedMetricText
          className="truncate text-4xl font-semibold tabular-nums tracking-normal text-slate-950"
          value={value}
        />
        <DeltaBadge delta={delta} />
      </div>
      <p className="mt-2 truncate text-base text-slate-500">{label}</p>
    </div>
  );
}

function AnimatedMetricText({
  className,
  value
}: {
  className?: string;
  value: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    setDisplayValue(value);
    setIsChanging(true);
    const timeout = window.setTimeout(() => setIsChanging(false), 220);

    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <span
      className={cn(
        "inline-block min-w-0 transition duration-200 ease-out",
        isChanging && "scale-[1.02] opacity-80",
        className
      )}
    >
      {displayValue}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: AttendanceMetricDelta }) {
  const tone =
    delta.direction === "up"
      ? "bg-emerald-50 text-emerald-700"
      : delta.direction === "down"
        ? "bg-rose-50 text-rose-700"
        : delta.direction === "flat"
          ? "bg-slate-100 text-slate-600"
          : "bg-slate-100 text-slate-400";

  return (
    <span className={cn("rounded-lg px-2 py-1 text-sm font-semibold tabular-nums", tone)}>
      {delta.label}
    </span>
  );
}

function ChartHoverCard({
  className,
  info
}: {
  className?: string;
  info: ChartHoverInfo | null;
}) {
  if (!info) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-30 w-max min-w-44 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-left shadow-xl backdrop-blur transition duration-150",
        className ?? "top-2"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", chartToneColor(info.tone))} />
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
          {info.label}
        </p>
      </div>
      <div className="mt-1 flex items-end justify-between gap-4">
        <p className="text-lg font-semibold tabular-nums text-slate-950">
          {info.count.toLocaleString()}
        </p>
        <p className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">
          {formatNumber(info.percentage)}%
        </p>
      </div>
    </div>
  );
}

function chartToneColor(tone: ChartTone) {
  const colors: Record<ChartTone, string> = {
    clean: "bg-emerald-500",
    error: "bg-rose-500",
    late1: "bg-amber-400",
    late2: "bg-orange-500",
    late3: "bg-rose-500",
    leave: "bg-sky-400",
    neutral: "bg-slate-200"
  };

  return colors[tone];
}

function lateToneForLabel(label: string): ChartTone {
  if (label === "Late 1") {
    return "late1";
  }
  if (label === "Late 2") {
    return "late2";
  }

  return "late3";
}

function MixTile({
  color,
  label,
  metric
}: {
  color: string;
  label: string;
  metric: AttendanceSegmentMetric;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <span className={cn("block h-2 w-10 rounded-full", color)} />
      <div className="mt-3 flex min-w-0 items-end justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-slate-600">{label}</p>
        <AnimatedMetricText
          className="text-xl font-semibold tabular-nums text-slate-950"
          value={metric.count.toLocaleString()}
        />
      </div>
      <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">
        {formatNumber(metric.percentage)}% of shifts
      </p>
    </div>
  );
}

function ShiftQualityStat({
  label,
  metric,
  tone
}: {
  label: string;
  metric: { delta: AttendanceMetricDelta; value: number };
  tone: "clean" | "error" | "total";
}) {
  const toneClass = {
    clean: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    error: "border-rose-100 bg-rose-50/70 text-rose-700",
    total: "border-slate-200 bg-white text-slate-800"
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-2xl border p-3 shadow-sm", toneClass)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-600">{label}</p>
        <AnimatedMetricText
          className="shrink-0 text-2xl font-semibold tabular-nums text-slate-950"
          value={metric.value.toLocaleString()}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <DeltaBadge delta={metric.delta} />
      </div>
    </div>
  );
}

function QualityStrip({
  clean,
  error,
  total
}: {
  clean: number;
  error: number;
  total: number;
}) {
  const barCount = 44;
  const safeTotal = Math.max(total, 0);
  const cleanShare = safeTotal > 0 ? clean / safeTotal : 0;
  const cleanBars = Math.round(cleanShare * barCount);
  const cleanInfo = {
    count: clean,
    label: "Clean shifts",
    percentage: percentageOf(clean, safeTotal),
    tone: "clean" as const
  };
  const errorInfo = {
    count: error,
    label: "Error shifts",
    percentage: percentageOf(error, safeTotal),
    tone: "error" as const
  };
  const emptyInfo = {
    count: 0,
    label: "No shifts",
    percentage: 0,
    tone: "neutral" as const
  };
  const [hovered, setHovered] = useState<ChartHoverInfo | null>(null);

  return (
    <div
      className="relative mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-3"
      onMouseLeave={() => setHovered(null)}
    >
      <ChartHoverCard info={hovered} />
      <div
        aria-label={`${clean} clean shifts and ${error} error shifts`}
        className="flex h-16 min-w-0 items-stretch gap-1 overflow-hidden rounded-2xl"
      >
        {Array.from({ length: barCount }).map((_, index) => {
          const info =
            safeTotal === 0 ? emptyInfo : index < cleanBars ? cleanInfo : errorInfo;
          const color = chartToneColor(info.tone);

          return (
            <span
              aria-label={`${info.label}: ${info.count.toLocaleString()} shifts, ${formatNumber(info.percentage)}%`}
              className={cn(
                "min-w-0 flex-1 rounded-full transition-[background-color,opacity] duration-300 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-slate-300",
                color
              )}
              key={index}
              onFocus={() => setHovered(info)}
              onMouseEnter={() => setHovered(info)}
              tabIndex={0}
              title={`${info.label}: ${info.count.toLocaleString()} shifts, ${formatNumber(info.percentage)}%`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Clean {clean.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          Error {error.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function LateBucketMiniTable({
  buckets
}: {
  buckets: AttendanceDailyReportAnalytics["lateBuckets"];
}) {
  const items = [
    { color: "bg-amber-400", label: "Late 1", metric: buckets.late1 },
    { color: "bg-orange-500", label: "Late 2", metric: buckets.late2 },
    { color: "bg-rose-500", label: "Late 3", metric: buckets.late3 }
  ];
  const [hovered, setHovered] = useState<ChartHoverInfo | null>(null);

  return (
    <div
      className="relative mt-4 rounded-2xl border border-slate-200"
      onMouseLeave={() => setHovered(null)}
    >
      <ChartHoverCard className="-top-4" info={hovered} />
      <div className="grid grid-cols-3 overflow-hidden rounded-t-2xl bg-slate-50 text-center text-xs font-semibold uppercase tracking-normal text-slate-500">
        {items.map((item) => (
          <div className="border-r border-slate-200 px-3 py-2 last:border-r-0" key={item.label}>
            {item.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-b-2xl text-center">
        {items.map((item) => (
          <div
            aria-label={`${item.label}: ${item.metric.count.toLocaleString()} shifts, ${formatNumber(item.metric.percentage)}% of late shifts`}
            className="min-w-0 border-r border-slate-100 p-3 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none last:border-r-0"
            key={item.label}
            onFocus={() =>
              setHovered({
                count: item.metric.count,
                label: item.label,
                percentage: item.metric.percentage,
                tone: lateToneForLabel(item.label)
              })
            }
            onMouseEnter={() =>
              setHovered({
                count: item.metric.count,
                label: item.label,
                percentage: item.metric.percentage,
                tone: lateToneForLabel(item.label)
              })
            }
            tabIndex={0}
            title={`${item.label}: ${item.metric.count.toLocaleString()} shifts, ${formatNumber(item.metric.percentage)}% of late shifts`}
          >
            <span className={cn("mx-auto block h-2 w-8 rounded-full", item.color)} />
            <AnimatedMetricText
              className="mt-2 block text-xl font-semibold tabular-nums text-slate-950"
              value={item.metric.count.toLocaleString()}
            />
            <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">
              {formatNumber(item.metric.percentage)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArcGauge({
  metric,
  view
}: {
  metric: ReturnType<typeof performanceMetricForView>;
  view: PerformanceView;
}) {
  const barCount = 48;
  const filledBars = Math.round((Math.min(metric.percentage, 100) / 100) * barCount);
  const activeColor = performanceGaugeColor(view);
  const activeInfo: ChartHoverInfo = {
    count: metric.count,
    label: metric.label,
    percentage: metric.percentage,
    tone: performanceChartTone(view)
  };
  const remainingInfo: ChartHoverInfo = {
    count: Math.max(metric.total - metric.count, 0),
    label: "Remaining shifts",
    percentage: percentageOf(Math.max(metric.total - metric.count, 0), metric.total),
    tone: "neutral" as const
  };
  const [hovered, setHovered] = useState<ChartHoverInfo | null>(null);

  return (
    <div
      className="relative mx-auto grid h-72 w-full max-w-sm place-items-center overflow-visible"
      onMouseLeave={() => setHovered(null)}
    >
      <ChartHoverCard className="top-1" info={hovered} />
      {Array.from({ length: barCount }).map((_, index) => {
        const angle = index * (360 / barCount);
        const active = index < filledBars;
        const info = active ? activeInfo : remainingInfo;
        const color = active ? activeColor : chartToneColor("neutral");
        const style = {
          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-7.35rem)`
        } satisfies CSSProperties;

        return (
          <span
            aria-label={`${info.label}: ${info.count.toLocaleString()} shifts, ${formatNumber(info.percentage)}%`}
            className={cn(
              "absolute left-1/2 top-1/2 h-9 w-3 rounded-full transition-[background-color,opacity] duration-300 ease-out hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-slate-300",
              color
            )}
            key={index}
            onFocus={() => setHovered(info)}
            onMouseEnter={() => setHovered(info)}
            style={style}
            tabIndex={0}
            title={`${info.label}: ${info.count.toLocaleString()} shifts, ${formatNumber(info.percentage)}%`}
          />
        );
      })}
      <div className="relative z-10 grid place-items-center text-center">
        <AnimatedMetricText
          className="text-4xl font-semibold tabular-nums text-slate-950"
          value={`${formatNumber(metric.percentage)}%`}
        />
        <p className="mt-2 text-xs font-semibold tabular-nums text-slate-400">
          {metric.count.toLocaleString()} shifts
        </p>
        <div className="mt-2"><DeltaBadge delta={metric.delta} /></div>
      </div>
    </div>
  );
}

function performanceGaugeColor(view: PerformanceView) {
  const colors: Record<PerformanceView, string> = {
    absent: "bg-rose-500",
    all: "bg-emerald-500",
    lateOver15: "bg-orange-500",
    onLeave: "bg-sky-400",
    onTime: "bg-emerald-500"
  };

  return colors[view];
}

function performanceChartTone(view: PerformanceView): ChartTone {
  const tones: Record<PerformanceView, ChartTone> = {
    absent: "error",
    all: "clean",
    lateOver15: "late2",
    onLeave: "leave",
    onTime: "clean"
  };

  return tones[view];
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
  const pages = paginationPages(page, totalPages);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        aria-label="First page"
        className="h-10 w-10 rounded-xl p-0"
        disabled={page <= 1}
        onClick={() => onPageChange(1)}
        type="button"
        variant="ghost"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Previous page"
        className="h-10 w-10 rounded-xl p-0"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
        variant="ghost"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((item) =>
        item === "ellipsis" ? (
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500" key={item}>
            ...
          </span>
        ) : (
          <Button
            className="h-10 w-10 rounded-xl p-0"
            key={item}
            onClick={() => onPageChange(item)}
            type="button"
            variant={item === page ? "default" : "outline"}
          >
            {item}
          </Button>
        )
      )}
      <Button
        aria-label="Next page"
        className="h-10 w-10 rounded-xl p-0"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
        variant="ghost"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Last page"
        className="h-10 w-10 rounded-xl p-0"
        disabled={page >= totalPages}
        onClick={() => onPageChange(totalPages)}
        type="button"
        variant="ghost"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NameCell({ row }: { row: AttendanceDailyReportRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
        {initials(row.pickerName)}
      </span>
      <TruncatedText className="font-medium text-slate-950" value={row.pickerName} />
    </div>
  );
}

function LocationPill({ value }: { value?: string | null }) {
  return (
    <span className="inline-flex max-w-full rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
      <TruncatedText value={value} />
    </span>
  );
}

function TimeCell({ icon: Icon, value }: { icon: LucideIcon; value?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <TruncatedText value={value} />
    </span>
  );
}

function CheckInCell({ row }: { row: AttendanceDailyReportRow }) {
  const offset = checkInOffsetMinutes(row);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <LogIn className="h-4 w-4 shrink-0 text-slate-400" />
      <TruncatedText value={row.actualCheckinTime} />
      {offset !== null ? <CheckInOffsetBadge minutes={offset} /> : null}
    </span>
  );
}

function CheckInOffsetBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) {
    return (
      <span
        aria-label="On time or early"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
        title="On time or early"
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }

  const lateTone =
    minutes > 15
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-700";

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-lg px-2 text-xs font-semibold tabular-nums",
        lateTone
      )}
      title={`${minutes} minutes after scheduled start`}
    >
      - {minutes} Mins
    </span>
  );
}

function LogHoursCell({ row }: { row: AttendanceDailyReportRow }) {
  const hasHoursIssue = row.isUnder8Hours || row.isOver15Hours;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <TruncatedText value={formatHours(row.actualWorkDurationHours)} />
      {hasHoursIssue ? (
        <TriangleAlert
          aria-label={row.isUnder8Hours ? "Under 8 hours" : "Over 15 hours"}
          className="h-4 w-4 shrink-0 text-amber-500"
        />
      ) : null}
    </span>
  );
}

function StatusBadge({ row }: { row: AttendanceDailyReportRow }) {
  const status = rowStatus(row);

  return (
    <Badge className={cn("whitespace-nowrap", status.tone)} variant="outline">
      {status.label}
    </Badge>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="min-w-0 px-4 py-3 align-middle text-slate-700">{children}</td>;
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-2">
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-medium text-slate-800">
        {value}
      </div>
    </div>
  );
}

function TruncatedText({
  className,
  value
}: {
  className?: string;
  value?: string | null;
}) {
  const text = formatText(value);
  return (
    <span className={cn("block min-w-0 truncate", className)} title={text}>
      {text}
    </span>
  );
}

function combineSegments(
  left: AttendanceSegmentMetric,
  right: AttendanceSegmentMetric,
  total: number
): AttendanceSegmentMetric {
  const count = left.count + right.count;

  return {
    count,
    percentage: percentageOf(count, total)
  };
}

function percentageOf(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((count / total) * 10_000) / 100;
}

function performanceMetricForView(
  analytics: AttendanceDailyReportAnalytics,
  view: PerformanceView
) {
  const rates = analytics.workStatusRates;
  const total = analytics.shiftQuality.counts.totalShifts.value;
  const map: Record<
    PerformanceView,
    {
      count: number;
      delta: AttendanceMetricDelta;
      label: string;
      percentage: number;
      total: number;
    }
  > = {
    absent: {
      count: rates.absent.count,
      delta: rates.absent.delta,
      label: "Absent shifts",
      percentage: rates.absent.percentage,
      total
    },
    all: {
      count: rates.all.count,
      delta: rates.all.delta,
      label: "Attend rate",
      percentage: rates.all.percentage,
      total
    },
    lateOver15: {
      count: rates.lateOver15.count,
      delta: rates.lateOver15.delta,
      label: "Late >15 shifts",
      percentage: rates.lateOver15.percentage,
      total
    },
    onLeave: {
      count: rates.onLeave.count,
      delta: rates.onLeave.delta,
      label: "On leave shifts",
      percentage: rates.onLeave.percentage,
      total
    },
    onTime: {
      count: rates.onTime.count,
      delta: rates.onTime.delta,
      label: "On time shifts",
      percentage: rates.onTime.percentage,
      total
    }
  };

  return map[view];
}

function statusFilterLabel(status: AttendanceCalculatedStatus) {
  const labels: Record<AttendanceCalculatedStatus, string> = {
    ABSENT: "Absent",
    ANNUAL_LEAVE: "Annual Leave",
    EXCLUDED_NON_EGYPT: "Excluded",
    EXCLUDED_NOT_PICKER: "Not picker",
    INVALID_OR_MISSING_ATTENDANCE_DATA: "Invalid",
    LATE: "Late",
    MEDICAL_LEAVE: "Sick Leave",
    OFF_DAY: "Off Day",
    ON_TIME: "Attend",
    OTHER_LEAVE: "Other Leave",
    UNMATCHED_IDENTIFIER: "Unmatched"
  };

  return labels[status];
}

function rowStatus(row: AttendanceDailyReportRow) {
  if (row.calculatedStatus === "LATE") {
    const labels = {
      LATE_1: "Late 1",
      LATE_2: "Late 2",
      LATE_3: "Late 3",
      NONE: "On time"
    };
    const tones = {
      LATE_1: "border-amber-300 bg-amber-50 text-amber-800",
      LATE_2: "border-orange-300 bg-orange-50 text-orange-800",
      LATE_3: "border-rose-300 bg-rose-50 text-rose-800",
      NONE: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
    const bucket = row.lateBucket ?? "NONE";
    return { label: labels[bucket], tone: tones[bucket] };
  }

  const statuses: Record<AttendanceCalculatedStatus, { label: string; tone: string }> = {
    ABSENT: {
      label: "Absent",
      tone: "border-rose-300 bg-rose-50 text-rose-800"
    },
    ANNUAL_LEAVE: {
      label: "Annual Leave",
      tone: "border-sky-200 bg-sky-50 text-sky-700"
    },
    EXCLUDED_NON_EGYPT: {
      label: "Excluded",
      tone: "border-slate-200 bg-slate-100 text-slate-600"
    },
    EXCLUDED_NOT_PICKER: {
      label: "Not Picker",
      tone: "border-slate-200 bg-slate-100 text-slate-600"
    },
    INVALID_OR_MISSING_ATTENDANCE_DATA: {
      label: "Invalid",
      tone: "border-rose-300 bg-rose-50 text-rose-800"
    },
    LATE: {
      label: "Late",
      tone: "border-orange-300 bg-orange-50 text-orange-800"
    },
    MEDICAL_LEAVE: {
      label: "Sick Leave",
      tone: "border-sky-200 bg-sky-50 text-sky-700"
    },
    OFF_DAY: {
      label: "Off Day",
      tone: "border-sky-200 bg-sky-50 text-sky-700"
    },
    ON_TIME: {
      label: "Attend",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700"
    },
    OTHER_LEAVE: {
      label: "Other Leave",
      tone: "border-sky-200 bg-sky-50 text-sky-700"
    },
    UNMATCHED_IDENTIFIER: {
      label: "Unmatched",
      tone: "border-amber-300 bg-amber-50 text-amber-800"
    }
  };

  return statuses[row.calculatedStatus];
}

function paginationPages(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, page, page + 1, totalPages]);
  return Array.from(pages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((left, right) => left - right)
    .flatMap((item, index, list) =>
      index > 0 && item - list[index - 1] > 1 ? ["ellipsis" as const, item] : [item]
    );
}

function createInitialFilters(): AttendanceDailyReportFilters {
  const yesterday = yesterdayIsoDate();
  return {
    branch: "",
    chain: "",
    dateFrom: yesterday,
    dateTo: yesterday,
    page: 1,
    pageSize: 10,
    periodMonth: yesterday.slice(0, 7),
    search: "",
    sortBy: "date",
    sortDirection: "asc",
    status: ""
  };
}

function normalizeDateRange(dateFrom: string, dateTo: string) {
  const fallback = yesterdayIsoDate();
  const start = isIsoDate(dateFrom) ? dateFrom : isIsoDate(dateTo) ? dateTo : fallback;
  const end = isIsoDate(dateTo) ? dateTo : start;

  return { dateFrom: start, dateTo: end };
}

function validateReportDateRange(dateFrom: string, dateTo: string) {
  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return "Select a valid start and end date.";
  }

  if (dateFrom > dateTo) {
    return "Start date must be before end date.";
  }

  const today = todayIsoDate();
  if (dateFrom >= today || dateTo >= today) {
    return "Today and future dates are not available.";
  }

  return null;
}

function rangeLength(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function rangeAttendanceTitle(range: AttendanceDailyReportAnalytics["range"]) {
  if (range.dateFrom === yesterdayIsoDate() && range.dateTo === yesterdayIsoDate()) {
    return "Yesterday Attendance";
  }

  if (range.dateFrom === range.dateTo) {
    return `${formatDateLong(range.dateFrom)} Attendance`;
  }

  return `${formatRangeLabel(range.dateFrom, range.dateTo)} Attendance`;
}

function formatRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return formatDateLong(dateFrom);
  }

  return `${formatDateLong(dateFrom)} - ${formatDateLong(dateTo)}`;
}

function yesterdayIsoDate() {
  return addDaysIso(todayIsoDate(), -1);
}

function todayIsoDate() {
  return formatIsoDate(new Date());
}

function addDaysIso(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateLong(value: string) {
  const date = parseIsoDate(value);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatText(value?: string | null) {
  return value ? value : "-";
}

function formatHours(value: number | null) {
  if (value === null) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.round(value * 60 * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${padClock(hours)}:${padClock(minutes)}:${padClock(seconds)}`;
}

function checkInOffsetMinutes(row: AttendanceDailyReportRow) {
  const scheduled = minutesFromClock(row.scheduledStartTime);
  const actual = minutesFromClock(row.actualCheckinTime);

  if (scheduled === null || actual === null) {
    return null;
  }

  let diff = actual - scheduled;

  if (diff < -720) {
    diff += 1440;
  }
  if (diff > 720) {
    diff -= 1440;
  }

  return diff;
}

function minutesFromClock(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function isLeaveStatus(row: AttendanceDailyReportRow) {
  return (
    row.calculatedStatus === "ANNUAL_LEAVE" ||
    row.calculatedStatus === "MEDICAL_LEAVE" ||
    row.calculatedStatus === "OFF_DAY" ||
    row.calculatedStatus === "OTHER_LEAVE"
  );
}

function padClock(value: number) {
  return String(value).padStart(2, "0");
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
