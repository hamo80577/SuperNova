"use client";

import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileMinus,
  Info,
  MoreHorizontal,
  Minus,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Target,
  UserPlus,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent,
  type ReactNode
} from "react";

import { DeductionRequestForm } from "@/components/deductions/deduction-request-form";
import { RequestDiscardDialog } from "@/components/requests/forms/request-discard-dialog";
import { NewHireRequestModal } from "@/components/requests/request-components";
import { SnAvatar, SnStatusBadge, SnTypeChip } from "@/components/sn/sn-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { getClosedDailyDashboardDateRange } from "@/components/workspaces/dashboard-ui/dashboard-date-ranges";
import {
  DashboardCard,
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardPerformanceStatusBadge,
  DashboardRankMark,
  DashboardSectionFooter,
  DashboardSectionHeader,
  DashboardUnavailableState
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import type { RequestSummary } from "@/lib/api/requests";
import {
  type ChampBranchDetail,
  type ChampBranchRankSummary,
  type ChampPerformanceSummary,
  type ChampPickerPerformanceRow,
  workspacesApi
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { ChampLifecycleRequestModal } from "./champ-lifecycle-request-modal";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const champRangeOptions = [
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "LAST_WEEK", label: "Last Week" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "LAST_QUARTER", label: "Last Quarter" }
] as const;

type ChampRangeKey = (typeof champRangeOptions)[number]["key"];

const requestActionLabels = {
  newHire: "New Hire",
  transfer: "Transfer",
  deduction: "Deduction",
  resignation: "Resign"
} as const;

const requestActionIcons = {
  newHire: UserPlus,
  transfer: Repeat2,
  deduction: Minus,
  resignation: FileMinus
} as const;

type ChampDashboardAction = keyof typeof requestActionLabels;

export function ChampPerformanceDashboard() {
  const [rangeKey, setRangeKey] = useState<ChampRangeKey>("YESTERDAY");
  const [requestedVendorId, setRequestedVendorId] = useState<string | undefined>();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [activeAction, setActiveAction] = useState<ChampDashboardAction | null>(
    null
  );
  const selectedRange = useMemo(() => getChampDateRange(rangeKey), [rangeKey]);
  const [summaryState, setSummaryState] = useState<
    AsyncState<ChampPerformanceSummary>
  >({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setSummaryState({ status: "loading" });

      try {
        const data = await workspacesApi.champPerformanceSummary({
          dateFrom: selectedRange.dateFrom,
          dateTo: selectedRange.dateTo,
          vendorId: requestedVendorId
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
                : "Unable to load Champ performance summary."
          });
        }
      }
    }

    void loadSummary();

    return () => {
      mounted = false;
    };
  }, [reloadNonce, requestedVendorId, selectedRange.dateFrom, selectedRange.dateTo]);

  const summary = summaryState.status === "ready" ? summaryState.data : null;
  const selectedVendorId =
    requestedVendorId ?? summary?.scope.selectedVendorId ?? "";

  return (
    <div className="sn mx-auto grid w-full max-w-[1480px] gap-4 overflow-hidden">
      <ChampDashboardHeader
        branches={summary?.scope.branches ?? []}
        loading={summaryState.status === "loading"}
        onBranchChange={(vendorId) => setRequestedVendorId(vendorId)}
        onRangeChange={setRangeKey}
        rangeKey={rangeKey}
        selectedVendorId={selectedVendorId}
      />

      {summaryState.status === "ready" ? (
        <ChampDashboardContent
          onQuickAction={setActiveAction}
          summary={summaryState.data}
        />
      ) : summaryState.status === "error" ? (
        <ChampDashboardError message={summaryState.error} />
      ) : (
        <ChampDashboardSkeleton />
      )}

      {activeAction && summary ? (
        <ChampDashboardActionModal
          actionKey={activeAction}
          onClose={() => setActiveAction(null)}
          onCreated={() => {
            setActiveAction(null);
            setReloadNonce((current) => current + 1);
          }}
          summary={summary}
        />
      ) : null}
    </div>
  );
}

function ChampDashboardHeader({
  branches,
  loading,
  onBranchChange,
  onRangeChange,
  rangeKey,
  selectedVendorId
}: {
  branches: ChampPerformanceSummary["scope"]["branches"];
  loading: boolean;
  onBranchChange: (vendorId: string) => void;
  onRangeChange: (range: ChampRangeKey) => void;
  rangeKey: ChampRangeKey;
  selectedVendorId: string;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const selectedRangeLabel =
    champRangeOptions.find((option) => option.key === rangeKey)?.label ?? "Range";
  const selectedBranchLabel =
    branches.find((branch) => branch.vendorId === selectedVendorId)?.vendorName ??
    "Branch";

  const branchSelect = (
    <Select
      aria-label="Select branch"
      className="h-10 rounded-xl bg-white text-sm sm:h-11"
      disabled={loading || branches.length <= 1}
      leadingIcon={<Store className="h-4 w-4" />}
      onChange={(event) => onBranchChange(event.target.value)}
      value={selectedVendorId}
    >
      {branches.length ? (
        branches.map((branch) => (
          <option key={branch.vendorId} value={branch.vendorId}>
            {branch.vendorName}
          </option>
        ))
      ) : (
        <option value="">Loading Branch</option>
      )}
    </Select>
  );

  const rangeSelect = (
    <Select
      aria-label="Select date range"
      className="h-10 rounded-xl bg-white text-sm sm:h-11"
      leadingIcon={<CalendarDays className="h-4 w-4" />}
      onChange={(event) => onRangeChange(event.target.value as ChampRangeKey)}
      value={rangeKey}
    >
      {champRangeOptions.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </Select>
  );

  return (
    <section className="flex min-w-0 items-start justify-end gap-3 sm:justify-between lg:items-start">
      <div className="hidden min-w-0 sm:block">
        <h1 className="text-[26px] font-semibold leading-8 tracking-normal text-[color:var(--sn-ink)] sm:text-[34px] sm:leading-9">
          Dashboard
        </h1>
        <p className="mt-0.5 hidden text-sm text-[color:var(--sn-muted)] sm:block">
          Branch performance overview
        </p>
      </div>
      <div className="hidden min-w-0 gap-2 sm:grid sm:grid-cols-2 lg:w-[520px]">
        {branchSelect}
        {rangeSelect}
      </div>
      <div className="relative shrink-0 sm:hidden">
        <button
          aria-expanded={mobileFiltersOpen}
          className="inline-flex h-9 max-w-[168px] items-center gap-2 rounded-xl border border-[color:var(--sn-border)] bg-white/85 px-3 text-xs font-semibold text-[color:var(--sn-body)] shadow-[0_1px_2px_rgba(65,21,23,0.04)]"
          onClick={() => setMobileFiltersOpen((current) => !current)}
          type="button"
        >
          {mobileFiltersOpen ? (
            <X className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{selectedRangeLabel}</span>
        </button>
        {mobileFiltersOpen ? (
          <div className="absolute right-0 top-11 z-30 grid w-[min(92vw,330px)] gap-2 rounded-2xl border border-[color:var(--sn-border)] bg-white p-2 shadow-[0_18px_45px_rgba(65,21,23,0.14)]">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="truncate text-xs font-semibold text-[color:var(--sn-muted)]">
                {selectedBranchLabel}
              </span>
              <span className="shrink-0 text-xs font-semibold text-primary">
                {selectedRangeLabel}
              </span>
            </div>
            {branchSelect}
            {rangeSelect}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ChampDashboardContent({
  onQuickAction,
  summary
}: {
  onQuickAction: (action: ChampDashboardAction) => void;
  summary: ChampPerformanceSummary;
}) {
  return (
    <>
      <BranchInfoStrip onQuickAction={onQuickAction} summary={summary} />
      <div className="grid gap-4 xl:grid-cols-[1.48fr_0.8fr_0.84fr]">
        <UhoPerformanceCard summary={summary} />
        <AttendanceHealthCard summary={summary} />
        <BranchRankingCard summary={summary} />
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1.52fr_0.8fr]">
        <PickerPerformancePanel summary={summary} />
        <RecentRequestsPanel summary={summary} />
      </div>
    </>
  );
}

function BranchInfoStrip({
  onQuickAction,
  summary
}: {
  onQuickAction: (action: ChampDashboardAction) => void;
  summary: ChampPerformanceSummary;
}) {
  const branch = summary.scope.selectedBranch;

  if (!branch) {
    return (
      <ChampCard className="p-4">
        <SectionUnavailable message="No Branch is selected for this dashboard." />
      </ChampCard>
    );
  }

  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-3 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff3eb] text-primary ring-1 ring-[#ffd8bd] sm:h-12 sm:w-12">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[color:var(--sn-muted)]">
                  Branch
                </p>
                <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--sn-ink)] sm:text-base">
                  {branch.vendorName}
                </h2>
              </div>
            </div>
            <div className="shrink-0 lg:hidden">
              <QuickActionsMenu onAction={onQuickAction} summary={summary} />
            </div>
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <InfoStripItem label="Chain" value={branch.chainName} />
            <InfoStripItem
              label="Manager / Area Manager"
              value={branch.areaManagerName ?? "Unassigned"}
            />
            <InfoStripItem
              icon={<Users className="h-3.5 w-3.5" />}
              label="Active Pickers"
              value={formatNumber(branch.activePickersCount)}
            />
          </div>
        </div>
        <div className="hidden lg:block">
          <QuickActionsMenu onAction={onQuickAction} summary={summary} />
        </div>
      </div>
    </section>
  );
}

function InfoStripItem({
  icon,
  label,
  value
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-[#fffdfa] px-3 py-2 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
      <p className="text-[11px] font-medium text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="mt-1 flex min-w-0 items-center gap-1.5 break-words text-sm font-semibold text-[color:var(--sn-ink)]">
        {icon}
        {value}
      </p>
    </div>
  );
}

function QuickActionsMenu({
  onAction,
  summary
}: {
  onAction: (action: ChampDashboardAction) => void;
  summary: ChampPerformanceSummary;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative justify-self-end">
      <button
        aria-expanded={open}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-3 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(255,89,0,0.16)] transition hover:bg-[#e85100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? (
          <X className="h-4 w-4" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
        Actions
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 grid w-[228px] gap-1 rounded-2xl border border-[color:var(--sn-border)] bg-white p-2 shadow-[0_18px_45px_rgba(65,21,23,0.16)]">
          {(Object.keys(requestActionLabels) as Array<
            keyof typeof requestActionLabels
          >).map((actionKey) => (
            <QuickActionMenuItem
              actionKey={actionKey}
              key={actionKey}
              onSelect={(selectedAction) => {
                setOpen(false);
                onAction(selectedAction);
              }}
              summary={summary}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuickActionMenuItem({
  actionKey,
  onSelect,
  summary
}: {
  actionKey: ChampDashboardAction;
  onSelect: (action: ChampDashboardAction) => void;
  summary: ChampPerformanceSummary;
}) {
  const Icon = requestActionIcons[actionKey];
  const available = isQuickActionAvailable(actionKey, summary);
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
    actionKey === "newHire"
      ? "bg-[#fff3eb] text-primary hover:bg-[#ffe8d9]"
      : actionKey === "resignation"
        ? "text-[oklch(0.52_0.18_27)] hover:bg-[oklch(0.96_0.04_27)]"
        : "text-[color:var(--sn-body)] hover:bg-[#fffaf6]"
  );

  if (!available) {
    return (
      <button
        className={cn(className, "cursor-not-allowed opacity-50")}
        disabled
        title="This action is unavailable for the selected Branch."
        type="button"
      >
        <Icon className="h-4 w-4" />
        {requestActionLabels[actionKey]}
      </button>
    );
  }

  return (
    <button
      className={className}
      onClick={() => onSelect(actionKey)}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {requestActionLabels[actionKey]}
    </button>
  );
}

function ChampDashboardActionModal({
  actionKey,
  onClose,
  onCreated,
  summary
}: {
  actionKey: ChampDashboardAction;
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
  summary: ChampPerformanceSummary;
}) {
  const branchId = summary.scope.selectedVendorId;

  if (!branchId) {
    return null;
  }

  if (actionKey === "newHire") {
    return (
      <ChampDashboardNewHireModal
        onClose={onClose}
        onCreated={onCreated}
        vendorId={branchId}
      />
    );
  }

  if (actionKey === "deduction") {
    return (
      <ChampDashboardDeductionModal
        onClose={onClose}
        onCreated={onCreated}
      />
    );
  }

  return (
    <ChampLifecycleRequestModal
      onClose={onClose}
      onCreated={onCreated}
      type={actionKey === "transfer" ? "TRANSFER" : "RESIGNATION"}
      vendorId={branchId}
    />
  );
}

function ChampDashboardNewHireModal({
  onClose,
  onCreated,
  vendorId
}: {
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
  vendorId: string;
}) {
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;

    async function loadBranch() {
      try {
        const branch = await workspacesApi.champBranchDetail(vendorId);
        if (mounted) {
          setBranchState({ status: "ready", data: branch });
        }
      } catch (caughtError) {
        if (mounted) {
          setBranchState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Branch context."
          });
        }
      }
    }

    void loadBranch();

    return () => {
      mounted = false;
    };
  }, [vendorId]);

  if (branchState.status !== "ready") {
    return (
      <DashboardActionShell onClose={onClose} title="Picker New Hire request">
        {branchState.status === "loading" ? (
          <SectionUnavailable message="Loading selected Branch context." />
        ) : (
          <SectionUnavailable message={branchState.error} />
        )}
      </DashboardActionShell>
    );
  }

  const branch = branchState.data;

  return (
    <NewHireRequestModal
      description="Create a Branch-scoped New Hire request without leaving the Champ Dashboard."
      fixedSourceVendorId={branch.vendor.id}
      initialTargetRole="PICKER"
      lockedBranchContext={branch}
      lockTargetRole
      onClose={onClose}
      onCreated={onCreated}
      title="Picker New Hire request"
    />
  );
}

function ChampDashboardDeductionModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  function requestClose() {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }

    onClose();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isDirty) {
          setConfirmCloseOpen(true);
          return;
        }

        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, onClose]);

  return (
    <DashboardActionShell onClose={requestClose} title="Deduction request">
      <DeductionRequestForm
        initialTargetRole="PICKER"
        onCancel={requestClose}
        onCreated={onCreated}
        onDirtyChange={setIsDirty}
      />
      <RequestDiscardDialog
        onConfirm={onClose}
        onKeepEditing={() => setConfirmCloseOpen(false)}
        open={confirmCloseOpen}
      />
    </DashboardActionShell>
  );
}

function DashboardActionShell({
  children,
  onClose,
  title
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[160] grid place-items-end bg-[rgba(65,21,23,0.45)] p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
        role="dialog"
      >
        <section className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[color:var(--sn-border)] bg-white shadow-2xl sm:max-w-5xl sm:rounded-[1.75rem]">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--sn-border)] p-4 sm:p-5">
            <div className="min-w-0">
              <Badge
                className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                variant="outline"
              >
                Champ Dashboard
              </Badge>
              <h2 className="mt-2 truncate text-lg font-semibold text-[color:var(--sn-ink)] sm:text-xl">
                {title}
              </h2>
            </div>
            <Button
              aria-label={`Close ${title}`}
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function UhoPerformanceCard({ summary }: { summary: ChampPerformanceSummary }) {
  const orders = summary.ordersKpi;
  const target = orders.target;
  const trendPoints =
    orders.trend?.map((point) => ({
      date: point.date,
      value: point.unhealthyRate
    })) ?? [];

  return (
    <DashboardMetricCard
      icon={<Info className="h-3.5 w-3.5" />}
      title="UHO Performance"
    >
      {!orders.available ? (
        <SectionUnavailable message={orders.reason ?? "No KPI data for this period."} />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.62fr)_minmax(220px,1fr)] md:items-center">
            <div className="min-w-0">
              <p className="sn-num text-[42px] leading-none text-[color:var(--sn-ink)]">
                {formatPercent(orders.unhealthyRate ?? null)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {target ? <TargetBadge status={target.status} /> : null}
                <span className="text-xs font-medium text-[color:var(--sn-muted)]">
                  Target:{" "}
                  {target?.configured
                    ? `<= ${formatPercent(target.unhealthyRateTarget)}`
                    : "No target"}
                </span>
              </div>
            </div>
            {trendPoints.length ? (
              <TrendLine
                ariaLabel="UHO trend by day"
                color="#ff5900"
                points={trendPoints}
                target={target?.unhealthyRateTarget ?? null}
              />
            ) : (
              <div className="grid h-[132px] place-items-center rounded-xl border border-dashed border-[color:var(--sn-border)] bg-[#fbf9f5] text-xs font-medium text-[color:var(--sn-muted)]">
                No trend data for this period.
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-3">
            <MetricFootnote
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Total Orders"
              value={formatNumber(orders.totalOrders ?? 0)}
            />
            <MetricFootnote
              icon={<Target className="h-4 w-4" />}
              label="UHO Count"
              value={formatNumber(orders.unhealthyOrders ?? 0)}
            />
            <MetricFootnote
              icon={<Clock3 className="h-4 w-4" />}
              label="Not on Time"
              value={formatNumber(orders.orderNotOnTime ?? 0)}
            />
          </div>
        </div>
      )}
    </DashboardMetricCard>
  );
}

function AttendanceHealthCard({
  summary
}: {
  summary: ChampPerformanceSummary;
}) {
  const attendance = summary.attendance;
  const rate = attendance.attendanceHealthRate ?? null;

  return (
    <DashboardMetricCard
      icon={<Info className="h-3.5 w-3.5" />}
      title="Attendance Health"
    >
      {!attendance.available ? (
        <SectionUnavailable
          message={attendance.reason ?? "No attendance records for this period."}
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-4">
            <div className="min-w-0">
              <p className="sn-num text-[42px] leading-none text-[color:var(--sn-ink)]">
                {formatPercent(rate)}
              </p>
              <p className="mt-3 text-sm text-[color:var(--sn-muted)]">
                Clean shifts
              </p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--sn-ink)]">
                {formatNumber(attendance.cleanShifts ?? 0)} /{" "}
                {formatNumber(attendance.totalShifts ?? 0)}
              </p>
              <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
                {formatIssueShiftCount(attendance.issueShifts ?? 0)}
              </p>
            </div>
            <AttendanceDonut value={rate} />
          </div>
          <div className="grid grid-cols-4 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-3">
            <IssueMetric label="Late" tone="orange" value={attendance.lateCount ?? 0} />
            <IssueMetric label="Absent" tone="red" value={attendance.absentCount ?? 0} />
            <IssueMetric label="Under 8" tone="orange" value={attendance.under8Count ?? 0} />
            <IssueMetric label="Over 15" tone="red" value={attendance.over15Count ?? 0} />
          </div>
        </div>
      )}
    </DashboardMetricCard>
  );
}

function BranchRankingCard({ summary }: { summary: ChampPerformanceSummary }) {
  const ranking = summary.branchRanking;

  return (
    <DashboardMetricCard
      icon={<Info className="h-3.5 w-3.5" />}
      title="Branch Ranking"
    >
      {!ranking.available && !ranking.chain && !ranking.allBranches ? (
        <SectionUnavailable
          message={ranking.reason ?? "Branch is not ranked for this period."}
        />
      ) : (
        <div className="grid gap-3">
          <RankTile label="Rank in Chain" rank={ranking.chain} />
          <RankTile label="Rank in All Branches" rank={ranking.allBranches} />
          <p className="flex items-center gap-2 text-xs text-[color:var(--sn-muted)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--sn-sunken)]" />
            Ranking is based on UHO% + order volume
          </p>
        </div>
      )}
    </DashboardMetricCard>
  );
}

function PickerPerformancePanel({
  summary
}: {
  summary: ChampPerformanceSummary;
}) {
  const rows = summary.pickerPerformance.rows.slice(0, 6);
  const totalRows = summary.pickerPerformance.totalRows;
  const reportHref = buildPickerReportHref(summary);
  const footerLabel =
    summary.pickerPerformance.rows.length > totalRows
      ? `Showing ${formatNumber(rows.length)} rows · ${formatNumber(
          totalRows
        )} active pickers`
      : `Showing ${formatNumber(rows.length)} of ${formatNumber(
          totalRows
        )} pickers`;

  return (
    <ChampCard className="overflow-hidden">
      <PanelHeader
        actionHref={reportHref}
        actionLabel="View all pickers"
        title="Picker Performance"
      />
      {!summary.pickerPerformance.available ? (
        <div className="p-4">
          <SectionUnavailable
            message={
              summary.pickerPerformance.reason ??
              "No active Pickers are assigned to this Branch."
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden lg:block">
            <table className="sn-table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Picker</th>
                  <th>Orders</th>
                  <th>UHO %</th>
                  <th>Health</th>
                  <th>Issues</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <PickerRankMark rank={row.rank} />
                    </td>
                    <td>
                      <PickerIdentity
                        href={buildPickerReportHref(summary, row)}
                        row={row}
                      />
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.totalOrders)}
                    </td>
                    <td className={uhoToneClass(row.unhealthyRate)}>
                      {formatPercent(row.unhealthyRate)}
                    </td>
                    <td className={healthToneClass(row.attendanceHealthRate)}>
                      {formatPercent(row.attendanceHealthRate)}
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.totalShiftErrors)}
                    </td>
                    <td>
                      <PickerStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 p-3 lg:hidden">
            {rows.map((row) => (
              <PickerMobileCard
                href={buildPickerReportHref(summary, row)}
                key={row.userId}
                row={row}
              />
            ))}
          </div>
          <PanelFooter label={footerLabel} />
        </>
      )}
    </ChampCard>
  );
}

function RecentRequestsPanel({
  summary
}: {
  summary: ChampPerformanceSummary;
}) {
  const rows = summary.recentRequests.rows.slice(0, 6);

  return (
    <ChampCard className="overflow-hidden">
      <PanelHeader
        actionHref="/tickets"
        actionLabel="View all requests"
        title="Recent Branch Requests"
      />
      {!summary.recentRequests.available ? (
        <div className="p-4">
          <SectionUnavailable
            message={
              summary.recentRequests.reason ??
              "No recent Branch requests are available."
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-2 p-3">
            {rows.map((request) => (
              <Link
                className="grid gap-2 rounded-xl border border-[color:var(--sn-border)] bg-white p-3 transition hover:border-primary/25 hover:bg-[#fffaf6] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                href={`/tickets?requestId=${request.id}`}
                key={request.id}
                prefetch
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <SnTypeChip type={request.type} />
                    <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--sn-ink)]">
                      {request.targetUserName ?? "No picker"}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-xs text-[color:var(--sn-muted)]">
                    Requested by {request.requestedByName}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <SnStatusBadge status={request.status} />
                  <span className="sn-mono shrink-0 text-xs text-[color:var(--sn-muted)]">
                    {request.ageLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <PanelFooter
            label={`Showing ${formatNumber(rows.length)} recent requests`}
          />
        </>
      )}
    </ChampCard>
  );
}

function DashboardMetricCard({
  children,
  icon,
  title
}: {
  children: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <ChampCard className="p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
          {title}
        </h2>
        {icon ? (
          <span className="grid h-5 w-5 place-items-center rounded-full text-[color:var(--sn-muted)]">
            {icon}
          </span>
        ) : null}
      </div>
      {children}
    </ChampCard>
  );
}

function ChampCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <DashboardCard className={className}>{children}</DashboardCard>;
}

function PanelHeader({
  actionHref,
  actionLabel,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  title: string;
}) {
  const action =
    actionHref && actionLabel ? (
      <Link
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-[color:var(--tlb-orange-900)]"
        href={actionHref}
        prefetch
      >
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    ) : undefined;

  return (
    <DashboardSectionHeader action={action} title={title} />
  );
}

function PanelFooter({
  actionHref,
  actionLabel,
  label
}: {
  actionHref?: string;
  actionLabel?: string;
  label: string;
}) {
  const action =
    actionHref && actionLabel ? (
      <Link
        className="inline-flex items-center gap-1 font-semibold text-primary hover:text-[color:var(--tlb-orange-900)]"
        href={actionHref}
        prefetch
      >
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    ) : undefined;

  return (
    <DashboardSectionFooter action={action}>{label}</DashboardSectionFooter>
  );
}

function MetricFootnote({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <div className="flex min-w-0 items-center gap-2 text-[color:var(--sn-muted)]">
        {icon}
        <span className="min-w-0 text-[11px] leading-tight sm:text-xs">
          {label}
        </span>
      </div>
      <p className="sn-num mt-2 text-xl text-[color:var(--sn-ink)]">{value}</p>
    </div>
  );
}

function IssueMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "orange" | "red";
  value: number;
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p className="truncate text-xs text-[color:var(--sn-muted)]">{label}</p>
      <p
        className={cn(
          "sn-num mt-1 text-lg",
          tone === "red" ? "text-[color:var(--sn-danger)]" : "text-primary"
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

function RankTile({
  label,
  rank
}: {
  label: string;
  rank?: ChampBranchRankSummary;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[#fbf9f5] p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[color:var(--sn-body)]">
          {label}
        </p>
        <p className="sn-num mt-2 text-3xl leading-none text-[color:var(--sn-ink)]">
          {formatBranchRank(rank)}
        </p>
        {!rank?.ranked ? (
          <p className="mt-2 text-xs text-[color:var(--sn-muted)]">
            {formatRankReason(rank)}
          </p>
        ) : null}
      </div>
      <DashboardRankMark rank={rank?.rank} />
    </div>
  );
}

function PickerRankMark({
  compact = false,
  rank
}: {
  compact?: boolean;
  rank: number | null;
}) {
  return <DashboardRankMark compact={compact} rank={rank} />;
}

function PickerIdentity({
  href,
  row
}: {
  href: string;
  row: ChampPickerPerformanceRow;
}) {
  return (
    <Link
      className="flex min-w-0 items-center gap-2 rounded-lg transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href={href}
      prefetch
    >
      <SnAvatar name={row.pickerName} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate font-semibold text-[color:var(--sn-ink)]">
            {row.pickerName}
          </span>
          {row.assignmentMismatch ? <WrongAssignmentMarker /> : null}
        </span>
        <span className="sn-mono mt-0.5 block truncate text-[11px] text-[color:var(--sn-muted)]">
          {row.shopperId ?? "No shopper ID"}
        </span>
      </span>
    </Link>
  );
}

function WrongAssignmentMarker() {
  return (
    <span
      aria-label="Wrong Branch assignment"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[oklch(0.96_0.05_80)] text-[oklch(0.55_0.13_70)] ring-1 ring-[oklch(0.86_0.08_80)]"
      title="Orders are under this Branch, but the Picker is not actively assigned here."
    >
      <AlertTriangle className="h-3 w-3" />
    </span>
  );
}

function PickerMobileCard({
  href,
  row
}: {
  href: string;
  row: ChampPickerPerformanceRow;
}) {
  return (
    <article className="rounded-xl border border-[color:var(--sn-border)] bg-white p-3 shadow-[0_1px_2px_rgba(65,21,23,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PickerRankMark compact rank={row.rank} />
          <PickerIdentity href={href} row={row} />
        </div>
        <PickerStatusBadge status={row.status} />
      </div>
      <DashboardMetricGrid className="mt-3" columns={4}>
        <CompactMetric label="Orders" value={formatNumber(row.totalOrders)} />
        <CompactMetric label="UHO" value={formatPercent(row.unhealthyRate)} />
        <CompactMetric
          label="Health"
          value={formatPercent(row.attendanceHealthRate)}
        />
        <CompactMetric label="Issues" value={formatNumber(row.totalShiftErrors)} />
      </DashboardMetricGrid>
    </article>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return <DashboardMetricItem label={label} value={value} />;
}

function AttendanceDonut({ value }: { value: number | null }) {
  const percent = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div
      aria-label={`Attendance health ${formatPercent(value)}`}
      className="relative grid h-[104px] w-[104px] place-items-center rounded-full"
      role="img"
      style={{
        background: `conic-gradient(var(--sn-success) ${percent * 3.6}deg, #f1ece4 0deg)`
      }}
    >
      <div className="grid h-[66px] w-[66px] place-items-center rounded-full bg-white text-[color:var(--sn-success)] shadow-inner">
        <ShieldCheck className="h-6 w-6" />
      </div>
    </div>
  );
}

type TrendPoint = {
  date: string;
  value: number | null;
};

function TrendLine({
  ariaLabel,
  color,
  points,
  target
}: {
  ariaLabel: string;
  color: string;
  points: TrendPoint[];
  target?: number | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartWidth = 320;
  const chartHeight = 132;
  const paddingX = 14;
  const paddingY = 16;
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  const yMax = Math.max(
    5,
    Math.ceil((Math.max(...values, target ?? 0, 10) * 1.2) / 5) * 5
  );
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const plottedPoints = points
    .map((point, index) => {
      if (point.value === null) return null;
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
      ): point is TrendPoint & { index: number; x: number; y: number } =>
        Boolean(point)
    );
  const activePoint =
    activeIndex === null
      ? null
      : plottedPoints.find((point) => point.index === activeIndex) ?? null;
  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const targetY =
    target === null || target === undefined
      ? null
      : paddingY + plotHeight - (Math.min(target, yMax) / yMax) * plotHeight;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!plottedPoints.length) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chartWidth;
    const nearest = plottedPoints.reduce((closest, point) =>
      Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest
    );

    setActiveIndex(nearest.index);
  }

  return (
    <div className="relative min-h-[132px] rounded-xl bg-[#fffaf6] px-2 py-1">
      <div
        className={cn(
          "pointer-events-none absolute right-3 top-2 z-10 rounded-lg border border-[color:var(--sn-border)] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[color:var(--sn-ink)] shadow-[0_6px_18px_rgba(65,21,23,0.08)] transition-all duration-150",
          activePoint ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        )}
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
        className="h-[120px] w-full touch-pan-y"
        onBlur={() => setActiveIndex(null)}
        onPointerLeave={() => setActiveIndex(null)}
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
            stroke={color}
            strokeDasharray="4 5"
            strokeOpacity="0.5"
            strokeWidth="1.4"
            x1={paddingX}
            x2={chartWidth - paddingX}
            y1={targetY}
            y2={targetY}
          />
        ) : null}
        {linePath ? (
          <path
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
            cx={point.x}
            cy={point.y}
            fill="white"
            key={`${point.date}-${point.index}`}
            r={activePoint?.index === point.index ? 4.8 : 3.3}
            stroke={color}
            strokeWidth={activePoint?.index === point.index ? 2.6 : 2}
          />
        ))}
      </svg>
    </div>
  );
}

function TargetBadge({
  status
}: {
  status: NonNullable<ChampPerformanceSummary["ordersKpi"]["target"]>["status"];
}) {
  if (status === "NO_TARGET") {
    return (
      <Badge className="shrink-0 whitespace-nowrap" variant="muted">
        No Target
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        "shrink-0 whitespace-nowrap",
        status === "IN_TARGET"
          ? "border-[oklch(0.8_0.09_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.43_0.14_150)]"
          : "border-[oklch(0.82_0.09_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.52_0.18_27)]"
      )}
      variant="outline"
    >
      {status === "IN_TARGET" ? "In Target" : "Out of Target"}
    </Badge>
  );
}

function PickerStatusBadge({
  status
}: {
  status: ChampPickerPerformanceRow["status"];
}) {
  return <DashboardPerformanceStatusBadge status={status} />;
}

function SectionUnavailable({ message }: { message: string }) {
  return <DashboardUnavailableState message={message} />;
}

function ChampDashboardSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4" role="status">
      <div className="h-[84px] rounded-[16px] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.05)]" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-[264px] rounded-[16px] border border-[color:var(--sn-border)] bg-white" />
        <div className="h-[264px] rounded-[16px] border border-[color:var(--sn-border)] bg-white" />
        <div className="h-[264px] rounded-[16px] border border-[color:var(--sn-border)] bg-white" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.92fr]">
        <div className="h-[340px] rounded-[16px] border border-[color:var(--sn-border)] bg-white" />
        <div className="h-[340px] rounded-[16px] border border-[color:var(--sn-border)] bg-white" />
      </div>
    </div>
  );
}

function ChampDashboardError({ message }: { message: string }) {
  return (
    <div className="rounded-[16px] border border-[oklch(0.85_0.08_27)] bg-[oklch(0.95_0.035_27)] p-4 text-sm text-[oklch(0.55_0.19_27)]">
      {message}
    </div>
  );
}

function isQuickActionAvailable(
  actionKey: ChampDashboardAction,
  summary: ChampPerformanceSummary
) {
  const branchId = summary.scope.selectedVendorId;
  const action = summary.quickActions[actionKey];

  if (!branchId || !action.enabled || !action.href) {
    return false;
  }

  const expectedHref = {
    newHire: `/champ/branches/${branchId}/new-hire`,
    transfer: `/champ/branches/${branchId}/transfer`,
    deduction: "/deductions",
    resignation: `/champ/branches/${branchId}/resignation`
  }[actionKey];

  return action.href === expectedHref;
}

function buildPickerReportHref(
  summary: ChampPerformanceSummary,
  row?: ChampPickerPerformanceRow
) {
  const params = new URLSearchParams({
    dateFrom: summary.period.dateFrom,
    dateTo: summary.period.dateTo,
    sortBy: "totalOrders",
    sortDirection: "desc",
    view: "PICKER"
  });

  if (summary.scope.selectedVendorId) {
    params.set("vendorId", summary.scope.selectedVendorId);
  }

  if (row) {
    params.set("pickerId", row.userId);
    params.set("pickerLabel", row.pickerName);
  }

  return `/champ/reports/orders-kpi?${params.toString()}`;
}

function getChampDateRange(range: ChampRangeKey) {
  return getClosedDailyDashboardDateRange(range);
}

function formatShortDate(value: string | undefined) {
  if (!value) return "";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatIssueShiftCount(value: number) {
  return `${formatNumber(value)} ${value === 1 ? "issue shift" : "issue shifts"}`;
}

function formatBranchRank(rank: ChampBranchRankSummary | undefined) {
  if (!rank) return "-";
  if (rank.ranked) {
    return rank.displayLabel ?? `#${rank.rank} / ${rank.totalEligible}`;
  }
  return "-";
}

function formatRankReason(rank: ChampBranchRankSummary | undefined) {
  if (!rank) return "No ranking data";
  if (rank.reason === "LOW_ORDER_VOLUME") {
    return `${formatNumber(rank.totalOrders)} orders, minimum volume not met`;
  }
  if (rank.reason === "NO_KPI_RECORDS") {
    return "No confirmed KPI records";
  }
  return "Not ranked";
}

function uhoToneClass(value: number | null) {
  if (value === null) return "sn-mono font-semibold text-[color:var(--sn-muted)]";
  if (value <= 8) return "sn-mono font-semibold text-[color:var(--sn-success)]";
  if (value <= 12) return "sn-mono font-semibold text-[color:var(--sn-warn)]";
  return "sn-mono font-semibold text-[color:var(--sn-danger)]";
}

function healthToneClass(value: number | null) {
  if (value === null) return "sn-mono font-semibold text-[color:var(--sn-muted)]";
  if (value >= 85) return "sn-mono font-semibold text-[color:var(--sn-success)]";
  if (value >= 70) return "sn-mono font-semibold text-[color:var(--sn-warn)]";
  return "sn-mono font-semibold text-[color:var(--sn-danger)]";
}
