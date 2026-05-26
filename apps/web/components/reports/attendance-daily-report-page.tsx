"use client";

import {
  AlarmClock,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Gauge,
  ListChecks,
  LogIn,
  LogOut,
  Search,
  SlidersHorizontal,
  UploadCloud,
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
  type AttendanceMetricDelta,
  type AttendanceSegmentMetric
} from "@/lib/api/attendance";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

type PerformanceView = "all" | "absent" | "late" | "under8" | "over15";

interface AttendanceDailyReportFilters {
  periodMonth: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  page: number;
  pageSize: number;
}

const pageSizes = [10, 25, 50, 100];
const performanceViews: Array<{ label: string; value: PerformanceView }> = [
  { label: "All", value: "all" },
  { label: "Absent", value: "absent" },
  { label: "Late", value: "late" },
  { label: "Under 8", value: "under8" },
  { label: "Over 15", value: "over15" }
];

export function AttendanceDailyReportPage() {
  const initialFilters = useMemo(createInitialFilters, []);
  const [filters, setFilters] =
    useState<AttendanceDailyReportFilters>(initialFilters);
  const [searchDraft, setSearchDraft] = useState(initialFilters.search);
  const [performanceView, setPerformanceView] =
    useState<PerformanceView>("all");
  const [state, setState] = useState<AsyncState<AttendanceDailyReportResponse>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setState({ status: "loading" });
      try {
        const data = await attendanceApi.dailyReport({
          periodMonth: filters.periodMonth,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          pickerSearch: filters.search,
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

  function refreshReport() {
    attendanceApi.clearDailyReportCache();
    setFilters((current) => ({ ...current }));
  }

  const report = state.status === "ready" ? state.data : null;

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-slate-50/80 p-3 sm:p-4">
      <div className="grid min-w-0 gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              Attendance
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track picker attendance and manage daily records.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              aria-label="Refresh attendance"
              className="h-11 w-11 rounded-xl border-sky-200 bg-sky-50 p-0 text-sky-700 hover:bg-sky-100"
              onClick={refreshReport}
              type="button"
              variant="outline"
            >
              <AlarmClock className="h-5 w-5" />
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
              onChange={applyDateRange}
            />
            <Button
              aria-label="Next date range"
              className="h-11 w-11 rounded-xl p-0"
              onClick={() => shiftRange(1)}
              type="button"
              variant="outline"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
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
            <Button
              aria-label="Notifications"
              className="h-11 w-11 rounded-xl p-0"
              disabled
              type="button"
              variant="outline"
            >
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <ReportStateView state={state}>
          {(data) => (
            <>
              <DashboardGrid
                analytics={data.analytics}
                performanceView={performanceView}
                rangeTitle={rangeAttendanceTitle(data.analytics.range)}
                onPerformanceViewChange={setPerformanceView}
              />
              <AttendanceList
                onClearSearch={clearSearch}
                onPageChange={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
                onPageSizeChange={(pageSize) =>
                  setFilters((current) => ({ ...current, page: 1, pageSize }))
                }
                onSearch={applySearch}
                rows={data.rows}
                searchDraft={searchDraft}
                setSearchDraft={setSearchDraft}
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
  const mix = analytics.attendanceMix;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <CardTitle icon={ListChecks} title={title} />
      <div className="mt-12">
        <MetricValue
          delta={analytics.attendanceRate.delta}
          label="Attendance Rate"
          value={`${formatNumber(analytics.attendanceRate.value)}%`}
        />
      </div>
      <SegmentedStrip
        className="mt-10"
        segments={[
          { color: "bg-sky-500", percentage: mix.attend.percentage },
          { color: "bg-amber-400", percentage: mix.onLeave.percentage },
          { color: "bg-slate-200", percentage: mix.absent.percentage }
        ]}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MixTile color="bg-sky-500" label="Attend" metric={mix.attend} />
        <MixTile color="bg-amber-400" label="On Leave" metric={mix.onLeave} />
        <MixTile color="bg-slate-300" label="Absent" metric={mix.absent} />
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
      <CardTitle icon={UsersRound} title="Employee Attend" />
      <div className="mt-12 flex items-end gap-1">
        <span className="text-3xl font-semibold tabular-nums text-slate-950">
          {buckets.totalLateCount}
        </span>
        <span className="pb-1 text-lg text-slate-500">
          /{analytics.attendanceRate.totalShifts}
        </span>
      </div>
      <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-2">
        <LateBucketRow color="bg-amber-400" label="Late 1" metric={buckets.late1} />
        <LateBucketRow color="bg-orange-500" label="Late 2" metric={buckets.late2} />
        <LateBucketRow color="bg-rose-500" label="Late 3" metric={buckets.late3} />
      </div>
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
      <CardTitle icon={Clock3} title="Total Log Hours" />
      <div className="mt-16">
        <MetricValue
          delta={analytics.averageLogHours.delta}
          label="Average attended shift"
          value={analytics.averageLogHours.formattedValue}
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
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <CardTitle icon={Gauge} title="Working Hour Performance" />
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
      <ArcGauge analytics={analytics} metric={selected} view={view} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallMetricTile
          label="Attendance Performance"
          value={`${formatNumber(analytics.performance.validShiftRate.value)}%`}
          delta={analytics.performance.validShiftRate.delta}
        />
        <SmallMetricTile
          label="Problem Shifts"
          value={`${analytics.performance.problemShiftCount.value}`}
          delta={analytics.performance.problemShiftCount.delta}
        />
      </div>
    </section>
  );
}

function AttendanceList({
  onClearSearch,
  onPageChange,
  onPageSizeChange,
  onSearch,
  pagination,
  rows,
  searchDraft,
  setSearchDraft
}: {
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearch: () => void;
  pagination: AttendanceDailyReportResponse["pagination"];
  rows: AttendanceDailyReportRow[];
  searchDraft: string;
  setSearchDraft: (value: string) => void;
}) {
  const lastPage = Math.max(pagination.totalPages, 1);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle icon={ListChecks} title="Attendance List" />
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto_auto]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              className="h-10 rounded-xl pl-9"
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
          <Button className="h-10 rounded-xl" onClick={onSearch} type="button" variant="outline">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button className="h-10 rounded-xl" onClick={onClearSearch} type="button" variant="ghost">
            Clear
          </Button>
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
                    <TimeCell icon={LogIn} value={row.actualCheckinTime} />
                  </TableCell>
                  <TableCell>
                    <TimeCell icon={LogOut} value={row.actualCheckoutTime} />
                  </TableCell>
                  <TableCell>{formatHours(row.actualWorkDurationHours)}</TableCell>
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
                  <Definition label="Location" value={<LocationPill value={row.sourceLocation} />} />
                  <Definition label="Check-in" value={formatText(row.actualCheckinTime)} />
                  <Definition label="Check-out" value={formatText(row.actualCheckoutTime)} />
                  <Definition label="Log Hours" value={formatHours(row.actualWorkDurationHours)} />
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
  onChange
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-[minmax(8.5rem,1fr)_minmax(8.5rem,1fr)]">
      <DatePicker
        className="h-9 border-0 shadow-none"
        onChange={(value) => onChange(value, dateTo)}
        placeholder="Start"
        quickActions={["yesterday", "today"]}
        value={dateFrom}
      />
      <DatePicker
        align="end"
        className="h-9 border-0 shadow-none"
        onChange={(value) => onChange(dateFrom, value)}
        placeholder="End"
        quickActions={["yesterday", "today"]}
        value={dateTo}
      />
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
        <p className="truncate text-4xl font-semibold tabular-nums tracking-normal text-slate-950">
          {value}
        </p>
        <DeltaBadge delta={delta} />
      </div>
      <p className="mt-2 truncate text-base text-slate-500">{label}</p>
    </div>
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

function SegmentedStrip({
  className,
  segments
}: {
  className?: string;
  segments: Array<{ color: string; percentage: number }>;
}) {
  const bars = Array.from({ length: 44 }, (_, index) => {
    const midpoint = ((index + 0.5) / 44) * 100;
    let total = 0;
    const segment = segments.find((item) => {
      total += item.percentage;
      return midpoint <= total;
    });
    return segment?.color ?? "bg-slate-200";
  });

  return (
    <div className={cn("flex h-24 items-end gap-1", className)} aria-hidden="true">
      {bars.map((color, index) => (
        <span className={cn("h-full min-w-1 flex-1 rounded-full", color)} key={index} />
      ))}
    </div>
  );
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
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-center">
      <span className={cn("mx-auto block h-2 w-8 rounded-full", color)} />
      <p className="mt-3 truncate text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
        {formatNumber(metric.percentage)}%
      </p>
    </div>
  );
}

function LateBucketRow({
  color,
  label,
  metric
}: {
  color: string;
  label: string;
  metric: AttendanceSegmentMetric;
}) {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-200">
        <span
          className={cn("block h-full rounded-full", color)}
          style={{ width: `${Math.min(metric.percentage, 100)}%` }}
        />
      </span>
      <span className="text-right tabular-nums text-slate-600">
        {metric.count} / {formatNumber(metric.percentage)}%
      </span>
    </div>
  );
}

function ArcGauge({
  analytics,
  metric,
  view
}: {
  analytics: AttendanceDailyReportAnalytics;
  metric: ReturnType<typeof performanceMetricForView>;
  view: PerformanceView;
}) {
  const barCount = 28;
  const filledBars = Math.round((Math.min(metric.percentage, 100) / 100) * barCount);
  const lateSegments = [
    { color: "bg-amber-400", count: analytics.lateBuckets.late1.count },
    { color: "bg-orange-500", count: analytics.lateBuckets.late2.count },
    { color: "bg-rose-500", count: analytics.lateBuckets.late3.count }
  ];
  const totalLate = Math.max(analytics.lateBuckets.totalLateCount, 1);

  return (
    <div className="relative mx-auto mt-7 h-56 w-full max-w-sm overflow-hidden">
      {Array.from({ length: barCount }).map((_, index) => {
        const angle = -86 + index * (172 / (barCount - 1));
        const active = index < filledBars;
        const lateColor = colorForLateGauge(index, filledBars, lateSegments, totalLate);
        const color =
          view === "late" && active
            ? lateColor
            : active
              ? "bg-rose-500"
              : "bg-slate-200";
        const style = {
          transform: `translateX(-50%) rotate(${angle}deg) translateY(-6.6rem)`,
          transformOrigin: "50% 7.5rem"
        } satisfies CSSProperties;

        return (
          <span
            className={cn("absolute bottom-8 left-1/2 h-12 w-4 rounded-full", color)}
            key={index}
            style={style}
          />
        );
      })}
      <div className="absolute inset-x-0 bottom-4 grid place-items-center text-center">
        <p className="text-4xl font-semibold tabular-nums text-slate-950">
          {formatNumber(metric.percentage)}%
        </p>
        <p className="mt-2 max-w-48 text-sm text-slate-500">{metric.label}</p>
        {metric.delta ? <div className="mt-2"><DeltaBadge delta={metric.delta} /></div> : null}
      </div>
    </div>
  );
}

function colorForLateGauge(
  index: number,
  filledBars: number,
  lateSegments: Array<{ color: string; count: number }>,
  totalLate: number
) {
  if (filledBars === 0) {
    return "bg-slate-200";
  }

  const progress = (index + 1) / filledBars;
  let cumulative = 0;
  for (const segment of lateSegments) {
    cumulative += segment.count / totalLate;
    if (progress <= cumulative) {
      return segment.color;
    }
  }

  return "bg-rose-500";
}

function SmallMetricTile({
  delta,
  label,
  value
}: {
  delta: AttendanceMetricDelta;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <p className="truncate text-sm text-slate-500">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-2xl font-semibold tabular-nums text-slate-950">
          {value}
        </p>
        <DeltaBadge delta={delta} />
      </div>
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

function performanceMetricForView(
  analytics: AttendanceDailyReportAnalytics,
  view: PerformanceView
) {
  const mix = analytics.performance.problemMix;
  const map: Record<
    PerformanceView,
    { delta: AttendanceMetricDelta | null; label: string; percentage: number }
  > = {
    absent: {
      delta: null,
      label: "Absent problem shifts",
      percentage: mix.absent.percentage
    },
    all: {
      delta: analytics.performance.problemShiftCount.delta,
      label: "All problem shifts",
      percentage: mix.all.percentage
    },
    late: {
      delta: null,
      label: "Late problem shifts",
      percentage: mix.late.percentage
    },
    over15: {
      delta: null,
      label: "Over 15 hour shifts",
      percentage: mix.over15.percentage
    },
    under8: {
      delta: null,
      label: "Under 8 hour shifts",
      percentage: mix.under8.percentage
    }
  };

  return map[view];
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
      label: "On Leave",
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
      label: "On Leave",
      tone: "border-sky-200 bg-sky-50 text-sky-700"
    },
    OFF_DAY: {
      label: "On Leave",
      tone: "border-sky-200 bg-sky-50 text-sky-700"
    },
    ON_TIME: {
      label: "Attend",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700"
    },
    OTHER_LEAVE: {
      label: "On Leave",
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
    dateFrom: yesterday,
    dateTo: yesterday,
    page: 1,
    pageSize: 10,
    periodMonth: yesterday.slice(0, 7),
    search: ""
  };
}

function normalizeDateRange(dateFrom: string, dateTo: string) {
  const fallback = yesterdayIsoDate();
  let start = isIsoDate(dateFrom) ? dateFrom : isIsoDate(dateTo) ? dateTo : fallback;
  let end = isIsoDate(dateTo) ? dateTo : start;

  if (start > end) {
    [start, end] = [end, start];
  }

  return { dateFrom: start, dateTo: end };
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
  return addDaysIso(formatIsoDate(new Date()), -1);
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

  return `${formatNumber(value)}h`;
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
