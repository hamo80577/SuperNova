"use client";

import {
  AlertCircle,
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Inbox,
  RotateCcw,
  Search,
  TimerReset,
  Umbrella,
  UploadCloud,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DetailPanelSkeleton,
  StatsCardSkeleton,
  TableRowsSkeleton
} from "@/components/ui/skeleton";
import {
  attendanceApi,
  type AttendanceCalculatedStatus,
  type AttendanceDailyReportResponse,
  type AttendanceDailyReportRow
} from "@/lib/api/attendance";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

type QuickFilter = "" | "late" | "absent" | "leave";

interface AttendanceDailyReportFilters {
  periodMonth: string;
  dateFrom: string;
  dateTo: string;
  shopperId: string;
  pickerSearch: string;
  status: AttendanceCalculatedStatus | "";
  quickFilter: QuickFilter;
  page: number;
  pageSize: number;
}

const statuses: Array<AttendanceCalculatedStatus | ""> = [
  "",
  "ON_TIME",
  "LATE",
  "ABSENT",
  "ANNUAL_LEAVE",
  "MEDICAL_LEAVE",
  "OTHER_LEAVE",
  "OFF_DAY"
];

const pageSizes = [25, 50, 100];

export function AttendanceDailyReportPage() {
  const initialFilters = useMemo(createInitialFilters, []);
  const [filters, setFilters] =
    useState<AttendanceDailyReportFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceDailyReportFilters>(initialFilters);
  const [state, setState] = useState<AsyncState<AttendanceDailyReportResponse>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!appliedFilters.periodMonth) {
        setState({
          status: "error",
          error: "Period month is required."
        });
        return;
      }

      setState({ status: "loading" });
      try {
        const data = await attendanceApi.dailyReport({
          periodMonth: appliedFilters.periodMonth,
          dateFrom: appliedFilters.dateFrom,
          dateTo: appliedFilters.dateTo,
          shopperId: appliedFilters.shopperId,
          pickerSearch: appliedFilters.pickerSearch,
          status: appliedFilters.status,
          lateOnly: appliedFilters.quickFilter === "late",
          absentOnly: appliedFilters.quickFilter === "absent",
          onLeaveOnly: appliedFilters.quickFilter === "leave",
          page: appliedFilters.page,
          pageSize: appliedFilters.pageSize
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
  }, [appliedFilters]);

  function updateFilter<K extends keyof AttendanceDailyReportFilters>(
    key: K,
    value: AttendanceDailyReportFilters[K]
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applyFilters() {
    setAppliedFilters({
      ...filters,
      page: 1
    });
    setFilters((current) => ({
      ...current,
      page: 1
    }));
  }

  function clearFilters() {
    const nextFilters = createInitialFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  function goToPage(page: number) {
    setFilters((current) => ({ ...current, page }));
    setAppliedFilters((current) => ({ ...current, page }));
  }

  const data = state.status === "ready" ? state.data : null;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Badge
              className="border-orange-200 bg-orange-50 text-orange-700"
              variant="outline"
            >
              Attendance daily report
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              Picker Attendance
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Stored daily rows from the confirmed active monthly attendance
              batch.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 rounded-xl"
              )}
              href="/admin/attendance/imports"
              prefetch
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Import console
            </Link>
            <Button
              className="h-11 rounded-xl"
              onClick={() => setAppliedFilters({ ...filters })}
              type="button"
              variant="outline"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Filter className="h-4 w-4 text-orange-600" />
          Filters
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(140px,0.7fr)_repeat(2,minmax(140px,0.7fr))_minmax(180px,1fr)_minmax(160px,0.9fr)_minmax(160px,0.9fr)]">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Period
            <Input
              className="h-11 rounded-xl"
              onChange={(event) =>
                updateFilter("periodMonth", event.target.value)
              }
              required
              type="month"
              value={filters.periodMonth}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            From
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              type="date"
              value={filters.dateFrom}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            To
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              type="date"
              value={filters.dateTo}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Picker search
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                className="h-11 rounded-xl pl-9"
                onChange={(event) =>
                  updateFilter("pickerSearch", event.target.value)
                }
                placeholder="Name or Shopper ID"
                value={filters.pickerSearch}
              />
            </span>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Shopper ID
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => updateFilter("shopperId", event.target.value)}
              placeholder="Partial ID"
              value={filters.shopperId}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Status
            <Select
              aria-label="Status"
              className="h-11 rounded-xl"
              onChange={(event) => {
                updateFilter(
                  "status",
                  event.target.value as AttendanceCalculatedStatus | ""
                );
                updateFilter("quickFilter", "");
              }}
              value={filters.status}
            >
              {statuses.map((status) => (
                <option key={status || "all"} value={status}>
                  {status ? attendanceStatusLabel(status) : "All statuses"}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <QuickFilterButton
              active={filters.quickFilter === "late"}
              label="Late only"
              onClick={() =>
                setFilters((current) => toggleQuickFilter(current, "late"))
              }
            />
            <QuickFilterButton
              active={filters.quickFilter === "absent"}
              label="Absent only"
              onClick={() =>
                setFilters((current) => toggleQuickFilter(current, "absent"))
              }
            />
            <QuickFilterButton
              active={filters.quickFilter === "leave"}
              label="On leave only"
              onClick={() =>
                setFilters((current) => toggleQuickFilter(current, "leave"))
              }
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="grid gap-1 text-xs font-medium text-slate-600 sm:w-28">
              Page size
              <Select
                aria-label="Page size"
                className="h-10 rounded-xl"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    pageSize: Number(event.target.value)
                  }))
                }
                value={filters.pageSize}
              >
                {pageSizes.map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex gap-2">
              <Button
                className="h-10 rounded-xl"
                onClick={clearFilters}
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
              <Button
                className="h-10 rounded-xl"
                disabled={!filters.periodMonth}
                onClick={applyFilters}
                type="button"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </section>

      <ReportStateView state={state}>
        {(report) => (
          <>
            <AttendanceMetadata report={report} />
            <AttendanceSummary report={report} />
            <AttendanceRows
              onPageChange={goToPage}
              report={report}
            />
          </>
        )}
      </ReportStateView>

      {data ? (
        <p className="text-xs leading-5 text-slate-500">
          Showing page {data.pagination.page} of {data.pagination.totalPages}.
        </p>
      ) : null}
    </div>
  );
}

function AttendanceMetadata({
  report
}: {
  report: AttendanceDailyReportResponse;
}) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
      <MetadataItem label="Period" value={formatMonth(report.periodMonth)} />
      <MetadataItem
        label="Active batch"
        value={report.activeBatchId ?? "No active batch"}
        valueClassName="font-mono text-xs"
      />
      <MetadataItem
        label="Coverage start"
        value={formatDate(report.coverageStartDate)}
      />
      <MetadataItem
        label="Coverage end"
        value={formatDate(report.coverageEndDate)}
      />
      <MetadataItem
        label="Expected end"
        value={formatDate(report.expectedCoverageEndDate)}
      />
    </section>
  );
}

function AttendanceSummary({
  report
}: {
  report: AttendanceDailyReportResponse;
}) {
  const summary = report.summary;
  const cards = [
    { icon: Users, label: "Rows", value: summary.totalRows },
    { icon: CheckCircle2, label: "On time", value: summary.onTimeCount },
    { icon: Clock3, label: "Late", value: summary.lateCount },
    { icon: AlertTriangle, label: "Absent", value: summary.absentCount },
    { icon: Umbrella, label: "Leave", value: summary.leaveCount },
    { icon: CalendarOff, label: "Off day", value: summary.offDayCount },
    { icon: TimerReset, label: "Under 8h", value: summary.under8HoursCount },
    { icon: Clock3, label: "Over 15h", value: summary.over15HoursCount },
    {
      icon: Clock3,
      label: "Chargeable late",
      value: `${summary.totalChargeableLateMins}m`
    }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <SummaryCard
          icon={card.icon}
          key={card.label}
          label={card.label}
          value={card.value}
        />
      ))}
    </section>
  );
}

function AttendanceRows({
  onPageChange,
  report
}: {
  onPageChange: (page: number) => void;
  report: AttendanceDailyReportResponse;
}) {
  const hasActiveBatch = Boolean(report.activeBatchId);
  const hasRows = report.rows.length > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">Daily rows</h2>
          <p className="mt-1 text-sm text-slate-500">
            {report.pagination.totalRows} matching rows
          </p>
        </div>
        <PaginationControls
          onPageChange={onPageChange}
          page={report.pagination.page}
          totalPages={report.pagination.totalPages}
        />
      </div>

      {!hasActiveBatch ? (
        <EmptyState message="No confirmed attendance batch found for this month." />
      ) : !hasRows ? (
        <EmptyState message="No attendance rows match the selected filters." />
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <TableHeader>Picker</TableHeader>
                  <TableHeader>Shopper ID</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Shift</TableHeader>
                  <TableHeader>Scheduled</TableHeader>
                  <TableHeader>Check-in</TableHeader>
                  <TableHeader>Check-out</TableHeader>
                  <TableHeader>Work Hours</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Raw Late</TableHeader>
                  <TableHeader>Chargeable</TableHeader>
                  <TableHeader>Bucket</TableHeader>
                  <TableHeader>Leave Type</TableHeader>
                  <TableHeader>Location</TableHeader>
                  <TableHeader>Issues</TableHeader>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr className="border-b last:border-0" key={row.id}>
                    <TableCell>
                      <div className="font-medium text-slate-950">
                        {row.pickerName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.userId}
                      </div>
                    </TableCell>
                    <TableCell>{row.shopperId}</TableCell>
                    <TableCell>{formatDate(row.shiftDate)}</TableCell>
                    <TableCell>{row.shiftName}</TableCell>
                    <TableCell>
                      {formatText(row.scheduledStartTime)} -{" "}
                      {formatText(row.scheduledEndTime)}
                    </TableCell>
                    <TableCell>{formatText(row.actualCheckinTime)}</TableCell>
                    <TableCell>{formatText(row.actualCheckoutTime)}</TableCell>
                    <TableCell>
                      {formatHours(row.actualWorkDurationHours)}
                    </TableCell>
                    <TableCell>
                      <AttendanceStatusBadge status={row.calculatedStatus} />
                    </TableCell>
                    <TableCell>{formatMinutes(row.rawLateMins)}</TableCell>
                    <TableCell>
                      {formatMinutes(row.chargeableLateMins)}
                    </TableCell>
                    <TableCell>{formatEnumValue(row.lateBucket)}</TableCell>
                    <TableCell>{formatEnumValue(row.leaveType)}</TableCell>
                    <TableCell>{formatText(row.sourceLocation)}</TableCell>
                    <TableCell>
                      <IssuesBadge count={row.issuesCount} />
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 xl:hidden">
            {report.rows.map((row) => (
              <AttendanceRowCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function AttendanceRowCard({ row }: { row: AttendanceDailyReportRow }) {
  return (
    <article className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950">
            {row.pickerName}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{row.shopperId}</p>
        </div>
        <AttendanceStatusBadge status={row.calculatedStatus} />
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Definition label="Date" value={formatDate(row.shiftDate)} />
        <Definition label="Shift" value={row.shiftName} />
        <Definition
          label="Scheduled"
          value={`${formatText(row.scheduledStartTime)} - ${formatText(
            row.scheduledEndTime
          )}`}
        />
        <Definition label="Check-in" value={formatText(row.actualCheckinTime)} />
        <Definition
          label="Check-out"
          value={formatText(row.actualCheckoutTime)}
        />
        <Definition
          label="Work hours"
          value={formatHours(row.actualWorkDurationHours)}
        />
        <Definition label="Raw late" value={formatMinutes(row.rawLateMins)} />
        <Definition
          label="Chargeable late"
          value={formatMinutes(row.chargeableLateMins)}
        />
        <Definition label="Late bucket" value={formatEnumValue(row.lateBucket)} />
        <Definition label="Leave type" value={formatEnumValue(row.leaveType)} />
        <Definition label="Location" value={formatText(row.sourceLocation)} />
        <Definition
          label="Source designation"
          value={formatText(row.sourceDesignation)}
        />
        <Definition label="Working day" value={row.isWorkingDay ? "Yes" : "No"} />
        <Definition
          label="Duration flags"
          value={durationFlags(row)}
        />
        <Definition label="Issues" value={<IssuesBadge count={row.issuesCount} />} />
      </div>
    </article>
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
        <DetailPanelSkeleton label="Loading attendance metadata" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <TableRowsSkeleton label="Loading attendance rows" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {state.error}
      </div>
    );
  }

  return <>{children(state.data)}</>;
}

function QuickFilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="h-9 rounded-xl"
      onClick={onClick}
      type="button"
      variant={active ? "default" : "outline"}
    >
      {label}
    </Button>
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
    <div className="flex items-center gap-2">
      <Button
        aria-label="Previous page"
        className="h-9 rounded-xl"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
        variant="outline"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm tabular-nums text-slate-600">
        {page} / {totalPages}
      </span>
      <Button
        aria-label="Next page"
        className="h-9 rounded-xl"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
        variant="outline"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function MetadataItem({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={cn("mt-1 break-words text-sm font-semibold", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-orange-600" />
      <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </section>
  );
}

function AttendanceStatusBadge({
  status
}: {
  status: AttendanceCalculatedStatus;
}) {
  const tone = attendanceStatusTone(status);

  return (
    <Badge className={tone} variant="outline">
      {attendanceStatusLabel(status)}
    </Badge>
  );
}

function IssuesBadge({ count }: { count: number }) {
  return (
    <Badge
      className={count > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : ""}
      variant={count > 0 ? "outline" : "muted"}
    >
      {count}
    </Badge>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-2">
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-medium text-slate-800">
        {value}
      </div>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="py-3 pr-4">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="py-3 pr-4 align-top text-slate-700">{children}</td>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function toggleQuickFilter(
  filters: AttendanceDailyReportFilters,
  quickFilter: QuickFilter
): AttendanceDailyReportFilters {
  return {
    ...filters,
    quickFilter: filters.quickFilter === quickFilter ? "" : quickFilter,
    status: ""
  };
}

function createInitialFilters(): AttendanceDailyReportFilters {
  return {
    periodMonth: currentPeriodMonth(),
    dateFrom: "",
    dateTo: "",
    shopperId: "",
    pickerSearch: "",
    status: "",
    quickFilter: "",
    page: 1,
    pageSize: 25
  };
}

function currentPeriodMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function attendanceStatusLabel(status: AttendanceCalculatedStatus) {
  const labels: Record<AttendanceCalculatedStatus, string> = {
    ON_TIME: "On time",
    LATE: "Late",
    ABSENT: "Absent",
    OFF_DAY: "Off day",
    ANNUAL_LEAVE: "Annual leave",
    MEDICAL_LEAVE: "Medical leave",
    OTHER_LEAVE: "Other leave",
    EXCLUDED_NON_EGYPT: "Excluded",
    UNMATCHED_IDENTIFIER: "Unmatched",
    EXCLUDED_NOT_PICKER: "Not Picker",
    INVALID_OR_MISSING_ATTENDANCE_DATA: "Invalid data"
  };

  return labels[status];
}

function attendanceStatusTone(status: AttendanceCalculatedStatus) {
  const tones: Record<AttendanceCalculatedStatus, string> = {
    ON_TIME: "border-emerald-200 bg-emerald-50 text-emerald-700",
    LATE: "border-amber-300 bg-amber-50 text-amber-800",
    ABSENT: "border-destructive/40 bg-destructive/10 text-destructive",
    OFF_DAY: "border-slate-200 bg-slate-100 text-slate-600",
    ANNUAL_LEAVE: "border-blue-200 bg-blue-50 text-blue-700",
    MEDICAL_LEAVE: "border-blue-200 bg-blue-50 text-blue-700",
    OTHER_LEAVE: "border-blue-200 bg-blue-50 text-blue-700",
    EXCLUDED_NON_EGYPT: "border-slate-200 bg-slate-100 text-slate-600",
    UNMATCHED_IDENTIFIER: "border-amber-300 bg-amber-50 text-amber-800",
    EXCLUDED_NOT_PICKER: "border-slate-200 bg-slate-100 text-slate-600",
    INVALID_OR_MISSING_ATTENDANCE_DATA:
      "border-destructive/40 bg-destructive/10 text-destructive"
  };

  return tones[status];
}

function durationFlags(row: AttendanceDailyReportRow) {
  if (row.isUnder8Hours && row.isOver15Hours) {
    return "Under 8h, Over 15h";
  }

  if (row.isUnder8Hours) {
    return "Under 8h";
  }

  if (row.isOver15Hours) {
    return "Over 15h";
  }

  return "None";
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) {
    return value;
  }

  return `${month}/${year}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatText(value?: string | null) {
  return value ? value : "-";
}

function formatEnumValue(value?: string | null) {
  return value ? formatEnum(value) : "-";
}

function formatHours(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  })}h`;
}

function formatMinutes(value: number | null) {
  return value === null ? "-" : `${value}m`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
