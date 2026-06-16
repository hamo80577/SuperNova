"use client";

import {
  AlertCircle,
  ArrowRight,
  Archive,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSearch,
  GitBranch,
  Inbox,
  Loader2,
  Map,
  MoveRight,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Target,
  Umbrella,
  X,
  UserRound,
  Users
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type PointerEvent,
  type ReactNode
} from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import {
  DetailPanelSkeleton,
  StatsCardSkeleton
} from "@/components/ui/skeleton";
import { ChampPerformanceDashboard } from "@/components/workspaces/champ/champ-performance-dashboard";
import {
  notificationsApi,
  type NotificationItem
} from "@/lib/api/notifications";
import { organizationApi, type Vendor } from "@/lib/api/organization";
import { requestsApi, type RequestSummary } from "@/lib/api/requests";
import {
  type AssignmentStatus,
  type EntityStatus,
  type PickerPerformanceSummary,
  type PickerRankSummary,
  type UserSummary,
  type VendorSummary,
  workspacesApi
} from "@/lib/api/workspaces";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

export function PickerWorkspaceDashboard() {
  const [rangeKey, setRangeKey] =
    useState<PickerDashboardRange>("THIS_MONTH");
  const [summaryState, setSummaryState] = useState<
    AsyncState<PickerPerformanceSummary>
  >({ status: "loading" });
  const [notificationsState, setNotificationsState] = useState<
    AsyncState<NotificationItem[]>
  >({ status: "loading" });
  const selectedRange = getPickerDateRange(rangeKey);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setSummaryState({ status: "loading" });

      try {
        const data = await workspacesApi.pickerPerformanceSummary({
          dateFrom: selectedRange.dateFrom,
          dateTo: selectedRange.dateTo,
          period: rangeKey
        });

        if (mounted) {
          setSummaryState({ status: "ready", data });
        }
      } catch (caughtError) {
        if (mounted) {
          setSummaryState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Picker performance summary."
          });
        }
      }
    }

    void loadSummary();

    return () => {
      mounted = false;
    };
  }, [rangeKey, selectedRange.dateFrom, selectedRange.dateTo]);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      try {
        const response = await notificationsApi.list({ page: 1, pageSize: 3 });

        if (mounted) {
          setNotificationsState({ status: "ready", data: response.items });
        }
      } catch (caughtError) {
        if (mounted) {
          setNotificationsState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load notifications."
          });
        }
      }
    }

    void loadNotifications();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-3 sm:gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-semibold tracking-normal text-[color:var(--sn-ink)] sm:text-[34px]">
            My Workday
          </h1>
          <p className="mt-0.5 text-xs text-[color:var(--sn-muted)] sm:mt-1 sm:text-sm">
            {formatDateRangeLabel(selectedRange.dateFrom, selectedRange.dateTo)}
          </p>
        </div>
        <PickerRangeSelector value={rangeKey} onChange={setRangeKey} />
      </div>

      {summaryState.status === "ready" ? (
        <PickerDashboardContent
          notificationsState={notificationsState}
          summary={summaryState.data}
        />
      ) : (
        <WorkspaceState state={summaryState} />
      )}
    </div>
  );
}

const pickerRangeOptions = [
  { key: "LAST_WEEK", label: "Last Week", shortLabel: "Week" },
  { key: "THIS_MONTH", label: "This Month", shortLabel: "Month" },
  { key: "THIS_QUARTER", label: "This Quarter", shortLabel: "Quarter" }
] as const;

type PickerDashboardRange = (typeof pickerRangeOptions)[number]["key"];

function PickerRangeSelector({
  onChange,
  value
}: {
  onChange: (value: PickerDashboardRange) => void;
  value: PickerDashboardRange;
}) {
  return (
    <div
      aria-label="Performance period"
      className="grid shrink-0 grid-cols-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-0.5 shadow-[0_1px_2px_rgba(65,21,23,0.04)] sm:p-1"
      role="group"
    >
      {pickerRangeOptions.map((option) => (
        <button
          className={
            option.key === value
              ? "h-8 rounded-lg bg-primary px-2 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(238,81,35,0.2)] sm:h-9 sm:px-3 sm:text-sm"
              : "h-8 rounded-lg px-2 text-[11px] font-semibold text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)] sm:h-9 sm:px-3 sm:text-sm"
          }
          key={option.key}
          onClick={() => onChange(option.key)}
          type="button"
        >
          <span className="sm:hidden">{option.shortLabel}</span>
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function PickerDashboardContent({
  notificationsState,
  summary
}: {
  notificationsState: AsyncState<NotificationItem[]>;
  summary: PickerPerformanceSummary;
}) {
  return (
    <>
      <PickerIdentityCard summary={summary} />
      <div className="grid gap-4 xl:grid-cols-2">
        <OrdersPerformanceCard summary={summary} />
        <AttendanceHealthCard summary={summary} />
      </div>
      <RankingCard summary={summary} />
      <div className="grid gap-4 lg:grid-cols-3">
        <DeductionsSummaryCard summary={summary} />
        <AnnualLeaveSummaryCard summary={summary} />
        <LatestNotificationsCard state={notificationsState} />
      </div>
    </>
  );
}

function PickerIdentityCard({ summary }: { summary: PickerPerformanceSummary }) {
  const identity = summary.identity;

  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-3 shadow-[0_1px_2px_rgba(65,21,23,0.04),0_6px_18px_rgba(65,21,23,0.05)] sm:p-5">
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-center sm:gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[linear-gradient(135deg,#5b0719,#8a0e26)] text-base font-semibold text-white shadow-[0_10px_24px_rgba(91,7,25,0.2)] sm:h-16 sm:w-16 sm:rounded-2xl sm:text-xl">
          {getInitials(identity.pickerName)}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 break-words text-sm font-semibold leading-5 text-[color:var(--sn-ink)] sm:text-base">
              {identity.pickerName}
            </p>
            <Badge variant="muted">Picker</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-[color:var(--sn-muted)]">
            {identity.branchName ?? "No branch"} · {identity.shopperId ?? "No shopper ID"}
          </p>
        </div>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 sm:mt-4 sm:grid-cols-5 lg:gap-x-5">
          <IdentityMetric label="Role" value="Picker" />
          <IdentityMetric
            label="Branch"
            value={identity.branchName ?? "Not assigned"}
          />
          <IdentityMetric
            label="Chain"
            value={identity.chainName ?? "Not assigned"}
          />
          <IdentityMetric
            label="Area Manager"
            value={identity.areaManagerName ?? "Not assigned"}
          />
          <IdentityMetric
            label="Shopper ID"
            value={identity.shopperId ?? "Not set"}
          />
      </div>
    </section>
  );
}

function IdentityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-[color:var(--sn-border)] pl-3 first:border-l-0 first:pl-0 odd:border-l-0 odd:pl-0 sm:odd:border-l sm:odd:pl-3 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-xs font-medium text-[color:var(--sn-muted)]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-[13px] font-semibold leading-5 text-[color:var(--sn-ink)] sm:text-sm">
        {value}
      </p>
    </div>
  );
}

function AttendanceHealthCard({
  summary
}: {
  summary: PickerPerformanceSummary;
}) {
  const attendance = summary.attendance;
  const cleanShiftLabel = `${formatNumber(attendance.cleanShifts)} / ${formatNumber(
    attendance.totalShifts
  )} clean shifts`;
  const trend = attendance.series.map((point) => ({
    date: point.date,
    value: point.attendanceHealthRate
  }));

  return (
    <PickerPanel
      actionHref="/picker/attendance"
      actionLabel="View attendance"
      icon={CalendarDays}
      step="2"
      title="Attendance / Shift Health"
    >
      {attendance.available ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,0.85fr)_minmax(160px,1fr)] sm:items-end">
            <div>
              <p className="text-xs font-medium text-[color:var(--sn-muted)]">
                Attendance Health
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <p className="text-[48px] font-semibold leading-none tracking-normal text-[#5b0719]">
                  {formatPercent(attendance.attendanceHealthRate)}
                </p>
                <DeltaBadge value={attendance.attendanceHealthRateDelta} />
              </div>
              <p className="mt-2 text-xs font-medium text-[color:var(--sn-muted)]">
                {cleanShiftLabel} · {formatIssueShiftCount(attendance.issueShifts)}
              </p>
            </div>
            <TimeSeriesChart
              ariaLabel="Attendance health daily trend"
              color="#2e7d32"
              maxValue={100}
              points={trend}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <PickerMicroStat
              icon={AlertCircle}
              label="Total Shift Errors"
              value={attendance.totalShiftErrors}
            />
            <PickerMicroStat icon={Clock3} label="Late" value={attendance.lateCount} />
            <PickerMicroStat
              icon={UserRound}
              label="Absent"
              value={attendance.absentCount}
            />
            <PickerMicroStat
              icon={CalendarDays}
              label="Under 8"
              value={attendance.under8Count}
            />
            <PickerMicroStat
              icon={ShieldCheck}
              label="Over 15"
              value={attendance.over15Count}
            />
          </div>
        </>
      ) : (
        <PickerUnavailableState
          icon={CalendarDays}
          message="No confirmed attendance shifts are available for this period."
        />
      )}
    </PickerPanel>
  );
}

function OrdersPerformanceCard({
  summary
}: {
  summary: PickerPerformanceSummary;
}) {
  const orders = summary.ordersKpi;
  const trend = orders.series.map((point) => ({
    date: point.date,
    value: point.unhealthyRate
  }));

  return (
    <PickerPanel
      icon={ShoppingBag}
      step="1"
      title="Orders Performance / UHO Target"
    >
      {orders.available ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,0.85fr)_minmax(160px,1fr)] sm:items-end">
            <div>
              <p className="text-xs font-medium text-[color:var(--sn-muted)]">UHO %</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <p className="text-[48px] font-semibold leading-none tracking-normal text-[#5b0719]">
                  {formatPercent(orders.unhealthyRate)}
                </p>
                <TargetBadge status={orders.target.status} />
              </div>
            </div>
            <TimeSeriesChart
              ariaLabel="UHO daily trend"
              color="#5b4ac8"
              points={trend}
              target={orders.target.unhealthyRateTarget}
            />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <PickerMicroStat
              icon={ShoppingBag}
              label="Total Orders"
              value={formatNumber(orders.totalOrders)}
            />
            <PickerMicroStat
              icon={Target}
              label="UHO Count"
              value={orders.unhealthyOrders}
            />
            <PickerMicroStat
              icon={Clock3}
              label="Not on Time"
              value={orders.orderNotOnTime}
            />
          </div>
        </>
      ) : (
        <PickerUnavailableState
          icon={ShoppingBag}
          message="No confirmed Orders KPI records are available for this period."
        />
      )}
    </PickerPanel>
  );
}

function RankingCard({ summary }: { summary: PickerPerformanceSummary }) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.04),0_6px_18px_rgba(65,21,23,0.05)] sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff8b6a] text-sm font-semibold text-white">
          3
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
            Your Performance Position
          </h2>
          <p className="text-xs text-[color:var(--sn-muted)]">
            Ranked by UHO %, volume, then attendance. Minimum{" "}
            {formatNumber(summary.ranking.minOrders)} orders.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RankScopeCard label="In Your Branch" rank={summary.ranking.branch} />
        <RankScopeCard label="In Your Chain" rank={summary.ranking.chain} />
        <RankScopeCard label="In All Team" rank={summary.ranking.allTeam} />
      </div>
    </section>
  );
}

function RankScopeCard({
  label,
  rank
}: {
  label: string;
  rank: PickerRankSummary;
}) {
  const showPercentileBadge = rank.ranked && rank.totalEligible >= 10;
  const showNotRankedBadge = !rank.ranked;

  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--sn-ink)]">{label}</p>
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-normal text-[#5b0719]">
            {rank.displayLabel}
          </p>
          <p className="mt-2 text-xs font-medium text-[color:var(--sn-muted)]">
            {formatNumber(rank.totalOrders)} orders · {formatPercent(rank.unhealthyRate)} UHO
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <RankMovementBadge change={rank.rankChange} />
          {showPercentileBadge || showNotRankedBadge ? (
            <Badge
              className={
                rank.ranked
                  ? "border-[oklch(0.8_0.09_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.43_0.14_150)]"
                  : undefined
              }
              variant={rank.ranked ? "outline" : "muted"}
            >
              {rank.percentileLabel ?? "Not ranked"}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs text-[color:var(--sn-muted)]">
        {rank.reason === "LOW_ORDER_VOLUME"
          ? `${formatNumber(rank.totalOrders)} of ${formatNumber(rank.minOrders)} required orders`
          : rank.previousRank
            ? `Previous rank #${rank.previousRank}`
            : "No previous rank"}
      </p>
    </div>
  );
}

function RankMovementBadge({ change }: { change: number | null }) {
  if (change === null) {
    return <Badge variant="muted">No previous</Badge>;
  }

  if (change === 0) {
    return <Badge variant="muted">No change</Badge>;
  }

  const improved = change > 0;

  return (
    <Badge
      className={
        improved
          ? "border-[oklch(0.8_0.09_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.43_0.14_150)]"
          : "border-[oklch(0.82_0.09_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.52_0.18_27)]"
      }
      variant="outline"
    >
      {improved ? "Up" : "Down"} {Math.abs(change)}
    </Badge>
  );
}

function DeductionsSummaryCard({
  summary
}: {
  summary: PickerPerformanceSummary;
}) {
  return (
    <PickerSmallPanel
      actionHref="/deductions"
      actionLabel="View deductions"
      icon={AlertCircle}
      title="Deductions (Days)"
    >
      <p className="text-[36px] font-semibold leading-none tracking-normal text-[#5b0719]">
        {formatDays(summary.deductions.totalEffectiveDays)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Definition
          label="Effective"
          value={formatDays(summary.deductions.totalEffectiveDays)}
        />
        <Definition
          label="Cases"
          value={summary.deductions.effectiveCasesCount}
        />
      </div>
    </PickerSmallPanel>
  );
}

function AnnualLeaveSummaryCard({
  summary
}: {
  summary: PickerPerformanceSummary;
}) {
  return (
    <PickerSmallPanel
      actionHref="/tickets"
      actionLabel="Open requests"
      icon={Umbrella}
      title="Annual Leave"
    >
      {summary.annualLeave.available ? (
        <div className="grid grid-cols-3 gap-2">
          <LeaveStat
            label="Balance"
            tone="green"
            value={formatDays(summary.annualLeave.balanceDays)}
          />
          <LeaveStat
            label="Taken"
            tone="purple"
            value={formatDays(summary.annualLeave.takenDays)}
          />
          <LeaveStat
            label="Remaining"
            tone="orange"
            value={
              summary.annualLeave.remainingDays === null
                ? "-"
                : formatDays(summary.annualLeave.remainingDays)
            }
          />
        </div>
      ) : (
        <PickerUnavailableState
          icon={Umbrella}
          message={summary.annualLeave.message}
        />
      )}
    </PickerSmallPanel>
  );
}

function LatestNotificationsCard({
  state
}: {
  state: AsyncState<NotificationItem[]>;
}) {
  return (
    <PickerSmallPanel
      actionHref="/notifications"
      actionLabel="View all"
      icon={Bell}
      title="Latest Notifications"
    >
      {state.status === "loading" ? (
        <div className="grid gap-2">
          <div className="h-9 rounded-lg bg-[color:var(--sn-sunken)]" />
          <div className="h-9 rounded-lg bg-[color:var(--sn-sunken)]" />
          <div className="h-9 rounded-lg bg-[color:var(--sn-sunken)]" />
        </div>
      ) : state.status === "error" ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : state.data.length ? (
        <div className="grid gap-3">
          {state.data.map((notification) => (
            <div
              className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3"
              key={notification.id}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[oklch(0.56_0.15_150)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[color:var(--sn-ink)]">
                  {notification.title}
                </p>
                <p className="truncate text-xs text-[color:var(--sn-muted)]">
                  {notification.body}
                </p>
              </div>
              <span className="text-xs text-[color:var(--sn-muted)]">
                {formatNotificationTime(notification.createdAt)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyInline message="No notifications yet." />
      )}
    </PickerSmallPanel>
  );
}

function PickerPanel({
  actionHref,
  actionLabel,
  children,
  icon: Icon,
  step,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  icon: typeof Users;
  step: string;
  title: string;
}) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.04),0_6px_18px_rgba(65,21,23,0.05)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff8b6a] text-sm font-semibold text-white">
            {step}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-base font-semibold text-[color:var(--sn-ink)]">
            {title}
          </h2>
        </div>
        {actionHref && actionLabel ? (
          <Link
            className="text-xs font-semibold text-primary hover:text-[color:var(--tlb-orange-900)]"
            href={actionHref}
            prefetch
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PickerSmallPanel({
  actionHref,
  actionLabel,
  children,
  icon: Icon,
  title
}: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  icon: typeof Users;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.04),0_6px_18px_rgba(65,21,23,0.05)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-base font-semibold text-[color:var(--sn-ink)]">
            {title}
          </h2>
        </div>
        <Link
          className="shrink-0 text-xs font-semibold text-primary hover:text-[color:var(--tlb-orange-900)]"
          href={actionHref}
          prefetch
        >
          {actionLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function PickerMicroStat({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-white p-3 shadow-[0_1px_2px_rgba(65,21,23,0.03)]">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 truncate text-xs font-medium text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-normal text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}

function PickerUnavailableState({
  icon: Icon,
  message
}: {
  icon: typeof Users;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--sn-border)] bg-white p-4">
      <Icon className="h-5 w-5 text-[color:var(--sn-muted)]" />
      <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--sn-body)]">
        {message}
      </p>
    </div>
  );
}

type TimeSeriesPoint = {
  date: string;
  value: number | null;
};

function TimeSeriesChart({
  color,
  ariaLabel,
  maxValue,
  points,
  target,
}: {
  ariaLabel: string;
  color: string;
  maxValue?: number;
  points: TimeSeriesPoint[];
  target?: number | null;
}) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const chartWidth = 260;
  const chartHeight = 92;
  const paddingX = 12;
  const paddingY = 12;
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  const hasTrend = values.length > 0;
  const dynamicMax = Math.max(...values, target ?? 0, 10);
  const yMax =
    maxValue ?? Math.max(5, Math.ceil((dynamicMax * 1.2) / 5) * 5);
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const plottedPoints = points
    .map((point, index) => {
      if (point.value === null) {
        return null;
      }

      const x =
        paddingX +
        (points.length <= 1 ? plotWidth : (index / (points.length - 1)) * plotWidth);
      const y =
        paddingY + plotHeight - (Math.min(point.value, yMax) / yMax) * plotHeight;

      return { ...point, index, x, y };
    })
    .filter(
      (
        point
      ): point is TimeSeriesPoint & { index: number; x: number; y: number } =>
        Boolean(point)
    );
  const activePoint =
    activePointIndex === null
      ? null
      : plottedPoints.find((point) => point.index === activePointIndex) ?? null;
  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    plottedPoints.length > 1
      ? `${linePath} L ${plottedPoints[plottedPoints.length - 1].x} ${
          chartHeight - paddingY
        } L ${plottedPoints[0].x} ${chartHeight - paddingY} Z`
      : "";
  const targetY =
    target === null || target === undefined
      ? null
      : paddingY + plotHeight - (Math.min(target, yMax) / yMax) * plotHeight;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!plottedPoints.length) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chartWidth;
    const nearest = plottedPoints.reduce((closest, point) =>
      Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest
    );

    setActivePointIndex(nearest.index);
  }

  return (
    <div className="relative min-h-[116px] rounded-xl border border-[color:var(--sn-border)] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(65,21,23,0.03)]">
      {hasTrend ? (
        <>
          <div
            className={`pointer-events-none absolute right-3 top-2 z-10 rounded-lg border border-[color:var(--sn-border)] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[color:var(--sn-ink)] shadow-[0_6px_18px_rgba(65,21,23,0.08)] transition-all duration-150 ${
              activePoint
                ? "translate-y-0 opacity-100"
                : "-translate-y-1 opacity-0"
            }`}
          >
            {activePoint ? (
              <>
                <span className="text-[color:var(--sn-muted)]">
                  {formatShortDate(activePoint.date)}
                </span>{" "}
                {formatPercent(activePoint.value)}
              </>
            ) : null}
          </div>
          <svg
            aria-label={ariaLabel}
            className="h-[92px] w-full"
            onBlur={() => setActivePointIndex(null)}
            onPointerLeave={() => setActivePointIndex(null)}
            onPointerMove={handlePointerMove}
            role="img"
            tabIndex={0}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <line
              stroke="var(--sn-border)"
              strokeWidth="1"
              x1={paddingX}
              x2={chartWidth - paddingX}
              y1={chartHeight - paddingY}
              y2={chartHeight - paddingY}
            />
            {targetY !== null ? (
              <line
                stroke="#ff5900"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                x1={paddingX}
                x2={chartWidth - paddingX}
                y1={targetY}
                y2={targetY}
              />
            ) : null}
            {areaPath ? (
              <path d={areaPath} fill={color} opacity="0.1" />
            ) : null}
            {linePath ? (
              <path
                className="transition-all duration-150"
                d={linePath}
                fill="none"
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            ) : null}
            {activePoint ? (
              <line
                stroke={color}
                strokeOpacity="0.25"
                strokeWidth="1"
                x1={activePoint.x}
                x2={activePoint.x}
                y1={paddingY}
                y2={chartHeight - paddingY}
              />
            ) : null}
            {plottedPoints.map((point) => (
              <circle
                className="transition-all duration-150"
                cx={point.x}
                cy={point.y}
                fill="white"
                key={`${point.date}-${point.x}`}
                r={activePoint?.index === point.index ? "4.5" : "3"}
                stroke={color}
                strokeWidth={activePoint?.index === point.index ? "2.5" : "2"}
              />
            ))}
          </svg>
          <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-[color:var(--sn-muted)]">
            <span>{formatShortDate(points[0]?.date)}</span>
            <span>{formatShortDate(points[points.length - 1]?.date)}</span>
          </div>
        </>
      ) : (
        <div className="flex h-[92px] items-center justify-center text-xs font-medium text-[color:var(--sn-muted)]">
          No trend data
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <Badge variant="muted">No previous</Badge>;
  }

  return (
    <Badge
      className={
        value >= 0
          ? "border-[oklch(0.8_0.09_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.43_0.14_150)]"
          : "border-[oklch(0.82_0.09_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.52_0.18_27)]"
      }
      variant="outline"
    >
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </Badge>
  );
}

function TargetBadge({
  status
}: {
  status: PickerPerformanceSummary["ordersKpi"]["target"]["status"];
}) {
  if (status === "NO_TARGET") {
    return <Badge variant="muted">No target</Badge>;
  }

  return (
    <Badge
      className={
        status === "IN_TARGET"
          ? "border-[oklch(0.8_0.09_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.43_0.14_150)]"
          : "border-[oklch(0.82_0.09_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.52_0.18_27)]"
      }
      variant="outline"
    >
      {status === "IN_TARGET" ? "In Target" : "Out of Target"}
    </Badge>
  );
}

function LeaveStat({
  label,
  tone,
  value
}: {
  label: string;
  tone: "green" | "orange" | "purple";
  value: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-[oklch(0.48_0.14_150)]"
      : tone === "purple"
        ? "text-[oklch(0.48_0.12_285)]"
        : "text-primary";

  return (
    <div className="min-w-0 border-l border-[color:var(--sn-border)] pl-3 first:border-l-0 first:pl-0">
      <p className="truncate text-xs font-medium text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tracking-normal ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

export function ChampWorkspaceDashboard() {
  return <ChampPerformanceDashboard />;
}

export function AreaManagerWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.areaManager);
  const [transferAction, setTransferAction] = useState<{
    picker: UserSummary;
    sourceVendor: VendorSummary;
  } | null>(null);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} />;
  }

  const data = state.data;

  return (
    <WorkspaceGrid>
      <HeroCard
        badge="Area Manager workspace"
        description="Chain, branch, Champ, and Picker visibility is derived from active Chain Area Manager assignments."
        title={data.areaManager.nameEn}
      />
      <MetricCard icon={GitBranch} label="Chains under me" value={data.totals.chains} />
      <MetricCard icon={Store} label="Branches" value={data.totals.vendors} />
      <MetricCard icon={Users} label="Users under me" value={data.usersUnderMe.length} />

      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-4">
        <SectionHeader
          description="Drill down from Chain to Vendor to assigned users."
          title="Operations Map"
        />
        {data.chains.length ? (
          <div className="mt-4 grid gap-4">
            {data.chains.map((chain) => (
              <div className="rounded-[12px] border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4" key={chain.assignment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[color:var(--sn-ink)]">{chain.chain.chainName}</p>
                    <p className="text-sm text-[color:var(--sn-muted)]">
                      {chain.chain.chainCode} · {chain.vendorCount} branches
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{chain.activeChampCount} Champs</Badge>
                    <Badge variant="outline">{chain.activePickerCount} Pickers</Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {chain.vendors.map((vendor) => (
                    <div className="rounded-[10px] border border-[color:var(--sn-border)] bg-white p-3" key={vendor.vendor.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[color:var(--sn-ink)]">
                            {vendor.vendor.vendorName}
                          </p>
                          <p className="text-xs text-[color:var(--sn-muted)]">
                            {vendor.vendor.vendorCode} · {vendor.vendor.area ?? "No area"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="muted">{vendor.activeChampCount} Champs</Badge>
                          <Badge variant="muted">{vendor.activePickerCount} Pickers</Badge>
                        </div>
                      </div>
                      <UserChips
                        onTransferPicker={(picker) =>
                          setTransferAction({
                            picker,
                            sourceVendor: vendor.vendor
                          })
                        }
                        users={[
                          ...vendor.champs.map((item) => item.champ),
                          ...vendor.pickers.map((item) => item.picker)
                        ]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock message="No active Chain Area Manager assignments are available." />
        )}
      </section>

      <PlaceholderCard title="Requests placeholder" value={data.placeholders.requests} />
      <PlaceholderCard title="Approvals placeholder" value={data.placeholders.approvals} />
      {transferAction ? (
        <AreaManagerTransferModal
          action={transferAction}
          onClose={() => setTransferAction(null)}
        />
      ) : null}
    </WorkspaceGrid>
  );
}

export function AdminWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.admin);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} />;
  }

  const data = state.data;

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-[16px] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD8BD] bg-[#FFE8D9] px-3 py-1 text-xs font-semibold text-[color:var(--tlb-orange-900)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin workspace
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-normal text-[color:var(--sn-ink)] sm:text-3xl">
              Admin Control Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sn-body)]">
              System-wide operational visibility for organization setup, final
              actions, archive review, audit history, and role-scoped reporting.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                className={buttonVariants({
                  className: "rounded-xl bg-primary px-4",
                  size: "sm"
                })}
                href="/tickets"
                prefetch
              >
                Pending final actions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                className={buttonVariants({
                  className: "rounded-xl border-[color:var(--sn-border)] bg-white",
                  size: "sm",
                  variant: "outline"
                })}
                href="/admin/reports"
                prefetch
              >
                Open reports
              </Link>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4">
            <Definition label="Active chains" value={data.totals.activeChains} />
            <Definition label="Active vendors" value={data.totals.activeVendors} />
            <Definition
              label="Active Picker assignments"
              value={data.totals.activePickerAssignments}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={GitBranch} label="Chains" value={data.totals.chains} />
        <MetricCard icon={Store} label="Vendors" value={data.totals.vendors} />
        <MetricCard icon={Users} label="Users" value={data.totals.users} />
        <MetricCard
          icon={Map}
          label="Active Picker assignments"
          value={data.totals.activePickerAssignments}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <InfoCard title="Organization Setup">
          <Definition label="Active chains" value={data.totals.activeChains} />
          <Definition label="Active vendors" value={data.totals.activeVendors} />
          <Definition
            label="Active Champ assignments"
            value={data.totals.activeChampAssignments}
          />
          <Definition
            label="Active Area Manager assignments"
            value={data.totals.activeAreaManagerAssignments}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <AdminControlLink
              description="Chains, Branches, and assignments."
              href="/admin/organization"
              icon={GitBranch}
              label="Organization"
            />
            <AdminControlLink
              description="Partner Branch records."
              href="/admin/organization"
              icon={Store}
              label="Vendors"
            />
            <AdminControlLink
              description="Role assignment links."
              href="/admin/organization"
              icon={Map}
              label="Assignments"
            />
          </div>
        </InfoCard>

        <InfoCard title="Pending Final Actions">
          <AdminControlLink
            description="Review New Hire Shopper ID and Resignation finalization work."
            href="/tickets"
            icon={ClipboardCheck}
            label="Open pending final actions"
          />
          <AdminControlLink
            description="Review approval queues without bypassing workflow state."
            href="/tickets"
            icon={ShieldCheck}
            label="Open approvals"
          />
          <AdminControlLink
            description="Inspect request records and their current workflow status."
            href="/tickets"
            icon={Inbox}
            label="Open requests"
          />
        </InfoCard>

        <InfoCard title="Archive & Audit">
          <AdminControlLink
            description="Inspect archived/deactivated users and block status."
            href="/admin/archived-users"
            icon={Archive}
            label="View archived users"
          />
          <AdminControlLink
            description="Review workflow, approval, assignment, and account audit events."
            href="/admin/audit-logs"
            icon={FileSearch}
            label="View audit logs"
          />
          <AdminControlLink
            description="Choose the workspace appearance theme for your account."
            href="/settings"
            icon={Settings}
            label="Open settings"
          />
        </InfoCard>

        <InfoCard title="Reports">
          <AdminControlLink
            description="Open system-wide operational counts and scoped report surfaces."
            href="/admin/reports"
            icon={ClipboardCheck}
            label="Open admin reports"
          />
          <SimpleList
            emptyLabel="No chains available."
            items={data.recent.chains.map((chain) => ({
              id: chain.id,
              label: chain.chainName,
              meta: chain.chainCode,
              status: chain.status
            }))}
          />
        </InfoCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <InfoCard title="Recent Chains">
          <SimpleList
            emptyLabel="No chains available."
            items={data.recent.chains.map((chain) => ({
              id: chain.id,
              label: chain.chainName,
              meta: chain.chainCode,
              status: chain.status
            }))}
          />
        </InfoCard>

        <InfoCard title="Recent Vendors">
          <SimpleList
            emptyLabel="No vendors available."
            items={data.recent.vendors.map((vendor) => ({
              id: vendor.id,
              label: vendor.vendorName,
              meta: vendor.vendorCode,
              status: vendor.status
            }))}
          />
        </InfoCard>
      </div>
    </div>
  );
}

function useWorkspaceData<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await loader();
        if (mounted) {
          setState({ status: "ready", data });
        }
      } catch (caughtError) {
        if (mounted) {
          setState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load workspace."
          });
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [loader]);

  return state;
}

function WorkspaceState<T>({ state }: { state: AsyncState<T> }) {
  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading workspace"
        className="grid gap-4"
        role="status"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <DetailPanelSkeleton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {state.error}
    </div>
  );
}

function WorkspaceGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-4">{children}</div>;
}

function HeroCard({
  badge,
  description,
  title
}: {
  badge: string;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline">{badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--sn-ink)]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--sn-muted)]">
            {description}
          </p>
        </div>
        <Badge variant="muted">Phase 4 scoped view</Badge>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3EB] text-[color:var(--tlb-orange)]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-2xl font-[family-name:var(--font-data)] font-semibold tracking-normal text-[color:var(--sn-ink)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[color:var(--sn-muted)]">{label}</p>
    </section>
  );
}

function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-2">
      <SectionHeader title={title} />
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function PlaceholderCard({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-[16px] border border-dashed border-[color:var(--sn-border)] bg-white p-5">
      <ShieldCheck className="h-5 w-5 text-[color:var(--sn-muted)]" />
      <p className="mt-4 text-sm font-medium text-[color:var(--sn-ink)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--sn-muted)]">{value}</p>
    </section>
  );
}

function AdminControlLink({
  description,
  href,
  icon: Icon,
  label
}: {
  description: string;
  href: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link
      className="group flex items-start gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3 transition-colors hover:border-[#FFD8BD] hover:bg-[#FFE8D9]"
      href={href}
      prefetch
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="block text-sm font-semibold text-[color:var(--sn-ink)]">
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[color:var(--sn-muted)]">
          {description}
        </span>
      </span>
    </Link>
  );
}

function SectionHeader({
  description,
  title
}: {
  description?: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-[color:var(--sn-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-[color:var(--sn-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[color:var(--sn-ink)]">{value}</span>
    </div>
  );
}

function UserChips({
  onTransferPicker,
  users
}: {
  onTransferPicker?: (user: UserSummary) => void;
  users: UserSummary[];
}) {
  if (!users.length) {
    return <EmptyInline message="No active assigned users in this branch." />;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {users.map((user) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--sn-border)] bg-white px-2.5 py-1 text-xs font-medium text-[color:var(--sn-body)]"
          key={user.id}
        >
          {user.nameEn} · {user.role}
          {user.role === "PICKER" && onTransferPicker ? (
            <button
              className="ml-1 rounded-full border border-[#FFD8BD] px-2 py-0.5 text-[color:var(--tlb-orange-900)] hover:bg-[#FFE8D9]"
              onClick={() => onTransferPicker(user)}
              type="button"
            >
              Transfer
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function AreaManagerTransferModal({
  action,
  onClose
}: {
  action: { picker: UserSummary; sourceVendor: VendorSummary };
  onClose: () => void;
}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function loadVendors() {
      setIsLoading(true);
      try {
        const firstPage = await organizationApi.listVendors({
          page: 1,
          pageSize: 100,
          status: "ACTIVE"
        });
        const remainingPages = await Promise.all(
          Array.from(
            { length: Math.max(0, firstPage.meta.totalPages - 1) },
            (_, index) =>
              organizationApi.listVendors({
                page: index + 2,
                pageSize: 100,
                status: "ACTIVE"
              })
          )
        );
        if (mounted) {
          setVendors([
            ...firstPage.items,
            ...remainingPages.flatMap((page) => page.items)
          ]);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load destination Branches."
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadVendors();
    return () => {
      mounted = false;
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const request = await requestsApi.createTransfer({
          sourceVendorId: action.sourceVendor.id,
          targetUserId: action.picker.id,
          destinationVendorId,
          reason
        });
        setCreatedRequest(request);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to create Transfer request."
        );
      }
    });
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[140] grid place-items-end bg-[rgba(65,21,23,0.35)] p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[28px] border border-[color:var(--sn-border)] bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-[28px] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Badge variant="outline">Area Manager Transfer</Badge>
            <h2 className="mt-2 text-lg font-semibold text-[color:var(--sn-ink)]">
              Transfer Picker
            </h2>
          </div>
          <Button
            aria-label="Close transfer modal"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {createdRequest ? (
          <div className="rounded-2xl border border-[oklch(0.85_0.08_150)] bg-[oklch(0.95_0.045_150)] p-4 text-sm text-[oklch(0.58_0.13_150)]">
            <p className="font-semibold">Transfer request created.</p>
            <p className="mt-1">
              Status: {formatEnum(createdRequest.status)}. Current step:{" "}
              {createdRequest.currentStep
                ? formatEnum(createdRequest.currentStep)
                : "Completed"}.
            </p>
            <Link
              className={buttonVariants({
                className: "mt-3 rounded-xl bg-white border-[color:var(--sn-border)]",
                size: "sm",
                variant: "outline"
              })}
              href={`/tickets?requestId=${createdRequest.id}`}
              prefetch
            >
              Open request detail
            </Link>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={onSubmit}>
            {error ? <ModalError message={error} /> : null}
            <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3 text-sm">
              <p className="font-semibold text-[color:var(--sn-ink)]">{action.picker.nameEn}</p>
              <p className="text-[color:var(--sn-muted)]">
                {action.picker.phoneNumber} · From {action.sourceVendor.vendorName}
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Destination Branch
              <Select
                aria-label="Destination Branch"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                disabled={isLoading}
                onChange={(event) => setDestinationVendorId(event.target.value)}
                required
                value={destinationVendorId}
              >
                <option value="">
                  {isLoading ? "Loading Branches..." : "Select destination Branch"}
                </option>
                {vendors
                  .filter((vendor) => vendor.id !== action.sourceVendor.id)
                  .map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName} · {vendor.chain.chainName}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Reason
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Example: operational branch move"
                required
                value={reason}
              />
            </label>
            <div className="rounded-2xl border border-[#FFD8BD] bg-[#FFE8D9] p-3 text-sm text-[color:var(--tlb-orange-900)]">
              <MoveRight className="mb-2 h-4 w-4" />
              Same-chain transfers complete immediately for your Chain. Cross-chain
              transfers wait for destination Area Manager approval.
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={onClose} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={isPending || isLoading} type="submit">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Transfer
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

function ModalError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[oklch(0.85_0.08_27)] bg-[oklch(0.95_0.035_27)] p-3 text-sm text-[oklch(0.55_0.19_27)]">
      {message}
    </div>
  );
}

function SimpleList({
  emptyLabel,
  items
}: {
  emptyLabel: string;
  items: Array<{
    id: string;
    label: string;
    meta: string;
    status: AssignmentStatus | EntityStatus;
  }>;
}) {
  if (!items.length) {
    return <EmptyInline message={emptyLabel} />;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3"
          key={item.id}
        >
          <div>
            <p className="text-sm font-semibold text-[color:var(--sn-ink)]">{item.label}</p>
            <p className="text-xs text-[color:var(--sn-muted)]">{item.meta}</p>
          </div>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-md border bg-background p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <p className="text-sm leading-6 text-muted-foreground">{message}</p>;
}

function getPickerDateRange(range: PickerDashboardRange) {
  const today = new Date();
  const dateTo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateFrom = new Date(dateTo);

  if (range === "LAST_WEEK") {
    dateFrom.setDate(dateTo.getDate() - 6);
  } else if (range === "THIS_MONTH") {
    dateFrom.setDate(1);
  } else {
    dateFrom.setMonth(Math.floor(dateTo.getMonth() / 3) * 3, 1);
  }

  return {
    dateFrom: toDateOnly(dateFrom),
    dateTo: toDateOnly(dateTo)
  };
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateRangeLabel(dateFrom: string, dateTo: string) {
  return `${formatShortDate(dateFrom)} - ${formatShortDate(dateTo)}`;
}

function formatShortDate(value: string | undefined) {
  if (!value) {
    return "";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "SN";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDays(value: number) {
  const formatted = value % 1 === 0 ? String(value) : value.toFixed(1);
  return `${formatted} ${value === 1 ? "day" : "days"}`;
}

function formatIssueShiftCount(value: number) {
  return `${formatNumber(value)} ${value === 1 ? "issue shift" : "issue shifts"}`;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
