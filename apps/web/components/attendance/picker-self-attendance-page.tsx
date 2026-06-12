"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Info,
  Loader2,
  ShieldCheck,
  Target,
  TimerReset,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  attendanceApi,
  type AttendanceDailyReportResponse,
  type AttendanceDailyReportRow
} from "@/lib/api/attendance";
import { cn } from "@/lib/utils";
import {
  PICKER_ATTENDANCE_DEFAULT_TAB,
  buildPickerAttendanceViewModel,
  filterPickerAttendanceRows,
  type PickerAttendanceRowViewModel,
  type PickerAttendanceTab,
  type PickerShiftTag
} from "./picker-self-attendance-view-model";
import {
  getPickerAttendanceDateToMax,
  normalizePickerAttendanceDateRange
} from "./picker-self-attendance-date-range";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const pageSize = 100;

const tabs: Array<{ label: string; value: PickerAttendanceTab }> = [
  { label: "All", value: "ALL" },
  { label: "Clean Shift", value: "CLEAN" },
  { label: "Error Shift", value: "ERROR" },
  { label: "Late", value: "LATE" },
  { label: "Absent", value: "ABSENT" },
  { label: "Under 8", value: "UNDER_8" },
  { label: "Over 15", value: "OVER_15" }
];

export function PickerSelfAttendancePage() {
  const initialRange = useMemo(() => getInitialRange(), []);
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [activeTab, setActiveTab] = useState<PickerAttendanceTab>(
    PICKER_ATTENDANCE_DEFAULT_TAB
  );
  const [selectedShift, setSelectedShift] =
    useState<PickerAttendanceRowViewModel | null>(null);
  const [state, setState] = useState<AsyncState<AttendanceDailyReportResponse>>({
    status: "loading"
  });

  const maxDate = initialRange.maxDate;
  const dateToMax = getPickerAttendanceDateToMax(dateFrom, maxDate);
  const periodMonth = dateFrom.slice(0, 7);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setState({ status: "loading" });
      try {
        const firstPage = await attendanceApi.dailyReport({
          dateFrom,
          dateTo,
          page: 1,
          pageSize,
          periodMonth,
          sortBy: "date",
          sortDirection: "desc"
        });
        const remainingPages = await Promise.all(
          Array.from(
            { length: Math.max(0, firstPage.pagination.totalPages - 1) },
            (_, index) =>
              attendanceApi.dailyReport({
                dateFrom,
                dateTo,
                page: index + 2,
                pageSize,
                periodMonth,
                sortBy: "date",
                sortDirection: "desc"
              })
          )
        );
        if (mounted) {
          setState({
            data: {
              ...firstPage,
              rows: [
                ...firstPage.rows,
                ...remainingPages.flatMap((page) => page.rows)
              ]
            },
            status: "ready"
          });
        }
      } catch (caughtError) {
        if (mounted) {
          setState({
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load attendance.",
            status: "error"
          });
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [dateFrom, dateTo, periodMonth]);

  const viewModel = useMemo(
    () => buildPickerAttendanceViewModel(state.data?.rows ?? []),
    [state.data?.rows]
  );
  const filteredRows = useMemo(
    () => filterPickerAttendanceRows(viewModel.rows, activeTab),
    [activeTab, viewModel.rows]
  );

  function updateDateFrom(value: string) {
    const nextRange = normalizePickerAttendanceDateRange({
      dateFrom: value,
      dateTo,
      maxDate
    });
    setDateFrom(nextRange.dateFrom);
    setDateTo(nextRange.dateTo);
  }

  function updateDateTo(value: string) {
    const nextRange = normalizePickerAttendanceDateRange({
      dateFrom,
      dateTo: value,
      maxDate
    });
    setDateFrom(nextRange.dateFrom);
    setDateTo(nextRange.dateTo);
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 overflow-hidden">
      <section className="overflow-hidden rounded-[28px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <Badge className="rounded-full border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]" variant="outline">
              Picker attendance
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[color:var(--sn-ink)] sm:text-3xl">
              My Attendance
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sn-muted)]">
              Review your shifts from the imported attendance file. Your score
              ignores leave and off days.
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:w-[26rem]">
            <div className="grid gap-1">
              <DatePicker
                align="end"
                maxDate={maxDate}
                onChange={updateDateFrom}
                placeholder="Start date"
                quickActions={["yesterday"]}
                value={dateFrom}
              />
              <span className="px-1 text-[11px] font-medium text-[color:var(--sn-faint)]">
                Pick one attendance month.
              </span>
            </div>
            <div className="grid gap-1">
              <DatePicker
                align="end"
                maxDate={dateToMax}
                minDate={dateFrom}
                onChange={updateDateTo}
                placeholder="End date"
                quickActions={["yesterday"]}
                value={dateTo}
              />
              <span className="px-1 text-[11px] font-medium text-[color:var(--sn-faint)]">
                Ends by {formatDate(dateToMax)}.
              </span>
            </div>
          </div>
        </div>
      </section>

      {state.status === "loading" ? (
        <LoadingState />
      ) : state.status === "error" ? (
        <ErrorState message={state.error} />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <ScoreCard
              label={formatRangeLabel(dateFrom, dateTo)}
              rows={viewModel.rows}
              score={viewModel.score}
            />
            <BucketCard viewModel={viewModel} />
          </section>

          <section className="rounded-[28px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--sn-border)] text-[color:var(--sn-body)]">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
                      Shift History
                    </h2>
                    <p className="text-xs leading-5 text-[color:var(--sn-muted)]">
                      Card view, sorted newest first.
                    </p>
                  </div>
                </div>
              </div>
              {viewModel.score.unavailableLateRows ? (
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[oklch(0.82_0.08_80)] bg-[oklch(0.95_0.05_80)] px-3 text-xs font-semibold text-[oklch(0.55_0.14_65)]"
                  onClick={() => setActiveTab("ALL")}
                  type="button"
                >
                  <Info className="h-3.5 w-3.5" />
                  {viewModel.score.unavailableLateRows} need late details
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 sn-thin-scrollbar">
              {tabs.map((tab) => (
                <button
                  className={cn(
                    "min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                    activeTab === tab.value
                      ? "border-[color:var(--sn-ink)] bg-[color:var(--sn-ink)] text-white shadow-sm"
                      : "border-[color:var(--sn-border)] bg-white text-[color:var(--sn-body)] hover:border-[color:var(--sn-border-strong)] hover:bg-[color:var(--sn-sunken)]"
                  )}
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  type="button"
                >
                  {tab.label}
                  <span className="ml-1.5 text-[11px] opacity-70">
                    {getTabCount(viewModel.rows, tab.value)}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-2 grid gap-3">
              {!viewModel.rows.length ? (
                <NoAttendanceDataState />
              ) : filteredRows.length ? (
                filteredRows.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    onOpen={() => setSelectedShift(shift)}
                    shift={shift}
                  />
                ))
              ) : (
                <EmptyState activeTab={activeTab} />
              )}
            </div>
          </section>
        </>
      )}

      {selectedShift ? (
        <ShiftDetailSheet
          onClose={() => setSelectedShift(null)}
          shift={selectedShift}
        />
      ) : null}
    </div>
  );
}

function ScoreCard({
  label,
  rows,
  score
}: {
  label: string;
  rows: PickerAttendanceRowViewModel[];
  score: ReturnType<typeof buildPickerAttendanceViewModel>["score"];
}) {
  const percentage = score.percentage;
  const ringValue = percentage ?? 0;

  return (
    <section className="overflow-hidden rounded-[28px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[oklch(0.88_0.04_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
              Shift Score
            </h2>
            <p className="text-xs leading-5 text-[color:var(--sn-muted)]">
              {label} · Clean Shifts / Scorable Shifts
            </p>
          </div>
        </div>
        <Badge
          className="rounded-full border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]"
          variant="outline"
        >
          Target above 90%
        </Badge>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[12rem_1fr] sm:items-center">
        <div className="mx-auto grid aspect-square w-44 place-items-center rounded-full p-3 shadow-inner"
          style={{
            background: `conic-gradient(oklch(0.58 0.13 150) ${ringValue * 3.6}deg, var(--sn-border) 0deg)`
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
            <div>
              <p className="text-4xl font-semibold tracking-normal text-[color:var(--sn-ink)]">
                {percentage === null ? "--" : `${percentage}%`}
              </p>
              <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
                Clean / Scorable
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <InlineMetric
            label="Scorable shifts"
            tone="slate"
            value={score.scorableShifts}
          />
          <InlineMetric
            label="Clean shifts"
            tone="emerald"
            value={score.cleanShifts}
          />
          <InlineMetric
            label="Error shifts"
            tone="rose"
            value={score.errorShifts}
          />
          <InlineMetric
            label="Leave / off day"
            tone="blue"
            value={score.excludedRows}
          />
          <InlineMetric label="Rows loaded" tone="slate" value={rows.length} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[oklch(0.88_0.04_150)] bg-[oklch(0.95_0.045_150)] p-3 text-sm leading-6 text-[oklch(0.45_0.12_150)]">
        <div className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Shift Score is Clean Shifts divided by Scorable Shifts. Leave and
            Off Day are excluded. A check-in up to 15 minutes after shift start
            can still count as clean.
          </span>
        </div>
      </div>

      {score.unavailableLateRows ? (
        <div className="mt-4 rounded-2xl border border-[oklch(0.82_0.08_80)] bg-[oklch(0.95_0.05_80)] p-3 text-sm leading-6 text-[oklch(0.45_0.12_65)]">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {score.unavailableLateRows} late shift has unavailable details and
              is not included in the Shift Score.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BucketCard({
  viewModel
}: {
  viewModel: ReturnType<typeof buildPickerAttendanceViewModel>;
}) {
  const rows = [
    { count: viewModel.buckets.late1, label: "Late 1", tone: "rose" },
    { count: viewModel.buckets.late2, label: "Late 2", tone: "rose" },
    { count: viewModel.buckets.late3, label: "Late 3", tone: "rose" },
    { count: viewModel.buckets.absent, label: "Absent", tone: "rose" },
    { count: viewModel.buckets.under8, label: "Under 8", tone: "amber" },
    { count: viewModel.buckets.over15, label: "Over 15", tone: "amber" }
  ] as const;
  const totalIssues = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="rounded-[28px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[oklch(0.88_0.04_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
            Error Buckets
          </h2>
          <p className="text-xs leading-5 text-[color:var(--sn-muted)]">
            Simple attendance issue labels.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4">
        <p className="text-4xl font-semibold tracking-normal text-[color:var(--sn-ink)]">
          {totalIssues}
        </p>
        <p className="mt-1 text-sm text-[color:var(--sn-muted)]">Total issue tags</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div
            className="rounded-2xl border border-[color:var(--sn-border)] bg-white p-3"
            key={row.label}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[color:var(--sn-muted)]">
                {row.label}
              </span>
              <span
                className={cn(
                  "grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-semibold",
                  row.tone === "rose"
                    ? "bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
                    : "bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]"
                )}
              >
                {row.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShiftCard({
  onOpen,
  shift
}: {
  onOpen: () => void;
  shift: PickerAttendanceRowViewModel;
}) {
  const row = shift.row;

  return (
    <button
      className="group w-full rounded-[24px] border border-[color:var(--sn-border)] bg-white p-4 text-left shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] transition hover:border-[color:var(--sn-border-strong)] hover:shadow-[0_4px_24px_rgba(65,21,23,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      onClick={onOpen}
      type="button"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[color:var(--sn-ink)]">
            {row.shiftName || "Shift"}
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
            {formatDate(row.shiftDate)}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--sn-border-strong)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--sn-muted)]" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {shift.tags.map((tag) => (
          <ShiftTagBadge key={`${shift.id}-${tag.kind}`} tag={tag} />
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <SmallFact
          icon={CalendarDays}
          label="Scheduled"
          value={formatRange(row.scheduledStartTime, row.scheduledEndTime)}
        />
        <SmallFact
          icon={Clock3}
          label="Actual"
          value={formatRange(row.actualCheckinTime, row.actualCheckoutTime)}
        />
        <SmallFact
          icon={TimerReset}
          label="Work time"
          value={formatDuration(row.actualWorkDurationHours)}
        />
        <SmallFact
          icon={ShieldCheck}
          label="Source"
          value={formatSource(row)}
        />
      </div>
    </button>
  );
}

function ShiftDetailSheet({
  onClose,
  shift
}: {
  onClose: () => void;
  shift: PickerAttendanceRowViewModel;
}) {
  const row = shift.row;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[180] grid place-items-end bg-[rgba(65,21,23,0.45)] p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Shift details"
      >
        <div className="max-h-[92dvh] w-full overflow-auto rounded-t-[30px] border border-[color:var(--sn-border)] bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[30px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge variant="outline">Shift details</Badge>
              <h2 className="mt-3 truncate text-xl font-semibold text-[color:var(--sn-ink)]">
                {row.shiftName || "Shift"}
              </h2>
              <p className="text-sm text-[color:var(--sn-muted)]">{formatDate(row.shiftDate)}</p>
            </div>
            <Button
              aria-label="Close shift details"
              className="h-11 w-11 rounded-xl p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {shift.tags.map((tag) => (
              <ShiftTagBadge key={`${shift.id}-detail-${tag.kind}`} tag={tag} />
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm leading-6 text-[color:var(--sn-body)]">
            {shift.explanation}
          </div>

          <div className="mt-4 grid gap-3">
            <DetailRow label="Shopper ID" value={row.shopperId} />
            <DetailRow label="Imported source" value={formatSource(row)} />
            <DetailRow
              label="Scheduled time"
              value={formatRange(row.scheduledStartTime, row.scheduledEndTime)}
            />
            <DetailRow
              label="Check-in"
              value={row.actualCheckinTime ?? "Not recorded"}
            />
            <DetailRow
              label="Check-out"
              value={row.actualCheckoutTime ?? "Not recorded"}
            />
            <DetailRow
              label="Work time"
              value={formatDuration(row.actualWorkDurationHours)}
            />
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function InlineMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "blue" | "emerald" | "rose" | "slate";
  value: number;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3">
      <span className="text-sm font-medium text-[color:var(--sn-body)]">{label}</span>
      <span
        className={cn(
          "rounded-xl px-2.5 py-1 text-lg font-semibold tabular-nums",
          tone === "emerald" && "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
          tone === "rose" && "bg-[oklch(0.95_0.04_10)] text-[oklch(0.55_0.19_27)]",
          tone === "blue" && "bg-[color:var(--tlb-lavender,#f0f0ff)] text-[color:var(--tlb-purple,#4400aa)]",
          tone === "slate" && "bg-white text-[color:var(--sn-ink)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SmallFact({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-[color:var(--sn-sunken)] p-3">
      <Icon className="h-4 w-4 shrink-0 text-[color:var(--sn-faint)]" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase text-[color:var(--sn-faint)]">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--sn-border)] pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-[color:var(--sn-muted)]">{label}</span>
      <span className="max-w-full break-words text-right text-sm font-semibold text-[color:var(--sn-ink)]">
        {value}
      </span>
    </div>
  );
}

function ShiftTagBadge({ tag }: { tag: PickerShiftTag }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold",
        tag.tone === "emerald" && "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
        tag.tone === "rose" && "bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]",
        tag.tone === "amber" && "bg-[oklch(0.95_0.05_80)] text-[oklch(0.55_0.14_65)]",
        tag.tone === "blue" && "bg-[color:var(--tlb-lavender,#f0f0ff)] text-[color:var(--tlb-purple,#4400aa)]",
        tag.tone === "slate" && "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]"
      )}
    >
      {tag.tone === "emerald" ? (
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
      ) : null}
      {tag.label}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-64 place-items-center rounded-[28px] border border-[color:var(--sn-border)] bg-white p-6 text-center shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-3 text-sm font-medium text-[color:var(--sn-body)]">
        Loading your attendance...
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] border border-[oklch(0.82_0.08_27)] bg-[oklch(0.95_0.035_27)] p-4 text-sm leading-6 text-[oklch(0.55_0.19_27)]">
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}

function EmptyState({ activeTab }: { activeTab: PickerAttendanceTab }) {
  const copy = emptyStateCopy[activeTab];

  return (
    <div className="grid place-items-center rounded-[24px] border border-dashed border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-8 text-center">
      <ShieldCheck className="h-8 w-8 text-[color:var(--sn-muted)]" />
      <p className="mt-3 text-sm font-semibold text-[color:var(--sn-body)]">
        {copy.title}
      </p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[color:var(--sn-muted)]">
        {copy.body}
      </p>
    </div>
  );
}

function NoAttendanceDataState() {
  return (
    <div className="grid place-items-center rounded-[24px] border border-dashed border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-8 text-center">
      <CalendarDays className="h-8 w-8 text-[color:var(--sn-muted)]" />
      <p className="mt-3 text-sm font-semibold text-[color:var(--sn-body)]">
        No attendance here yet
      </p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[color:var(--sn-muted)]">
        Try another date in the same month, or check back after the attendance
        file is imported.
      </p>
    </div>
  );
}

function getTabCount(
  rows: PickerAttendanceRowViewModel[],
  tab: PickerAttendanceTab
) {
  return filterPickerAttendanceRows(rows, tab).length;
}

function getInitialRange() {
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  const firstDay = new Date(yesterday);
  firstDay.setDate(1);

  return {
    dateFrom: formatIsoDate(firstDay),
    dateTo: formatIsoDate(yesterday),
    maxDate: formatIsoDate(yesterday)
  };
}

function formatRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return `${formatDate(dateFrom)} Attendance`;
  }

  return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
}

function formatDate(value: string) {
  const date = parseIsoDate(value);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatRange(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "Not recorded";
  }

  return `${start ?? "-"} - ${end ?? "-"}`;
}

function formatDuration(hours: number | null) {
  if (hours === null || !Number.isFinite(hours)) {
    return "Not recorded";
  }

  const totalSeconds = Math.max(0, Math.round(hours * 3600));
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatSource(row: AttendanceDailyReportRow) {
  return [row.sourceLocation, row.sourceSubDivision]
    .filter(Boolean)
    .join(" / ") || "Not recorded";
}

const emptyStateCopy: Record<
  PickerAttendanceTab,
  { body: string; title: string }
> = {
  ABSENT: {
    body: "No absent shifts in this range. Keep your attendance steady.",
    title: "No absent shifts"
  },
  ALL: {
    body: "No shifts match this range yet. Try another date in the same month.",
    title: "No shifts to show"
  },
  CLEAN: {
    body: "No clean shifts in this view yet. Small improvements can move the score quickly.",
    title: "No clean shifts yet"
  },
  ERROR: {
    body: "No error shifts in this range. That is the goal.",
    title: "No error shifts"
  },
  LATE: {
    body: "No late bucket shifts here. Check another range if needed.",
    title: "No Late 1, 2, or 3 shifts"
  },
  OVER_15: {
    body: "No shifts over 15 hours in this range.",
    title: "No Over 15 shifts"
  },
  UNDER_8: {
    body: "No shifts under 8 hours in this range.",
    title: "No Under 8 shifts"
  }
};
