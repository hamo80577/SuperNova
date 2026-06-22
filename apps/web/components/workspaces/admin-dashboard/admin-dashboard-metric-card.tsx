"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  ShieldCheck,
  ShoppingBag,
  Target,
  TrendingUp,
  UserX
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  AdminPerformanceStatus,
  AdminPerformanceSummary
} from "@/lib/api/admin-performance";
import { cn } from "@/lib/utils";
import {
  formatNumber,
  formatPercent,
  formatShortDate,
  statusLabels,
  statusToneClass,
  targetBadgeMeta
} from "./admin-dashboard-utils";

export function AdminDashboardCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[16px] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function AdminSectionHeader({
  action,
  eyebrow,
  title
}: {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[color:var(--sn-border)] px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
          {title}
        </h2>
        {eyebrow ? (
          <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">
            {eyebrow}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminInfoPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[color:var(--sn-border)] bg-[#fbf9f5] px-2.5 text-xs font-semibold text-[color:var(--sn-muted)]">
      <Info className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function AdminPerformanceStatusBadge({
  status
}: {
  status: AdminPerformanceStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        statusToneClass(status)
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export function AdminSectionUnavailable({ message }: { message: string }) {
  return (
    <div className="grid min-h-[112px] place-items-center rounded-xl border border-dashed border-[color:var(--sn-border)] bg-[#fbf9f5] p-4 text-center">
      <div className="grid justify-items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-[color:var(--sn-muted)]" />
        <p className="max-w-sm text-sm leading-6 text-[color:var(--sn-muted)]">
          {message}
        </p>
      </div>
    </div>
  );
}

export function AdminSectionEmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-[112px] place-items-center p-4 text-center">
      <div className="grid justify-items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]">
          <Info className="h-4 w-4" />
        </span>
        <p className="max-w-sm text-sm leading-6 text-[color:var(--sn-muted)]">
          {message}
        </p>
      </div>
    </div>
  );
}

export function UhoPerformanceCard({
  ordersKpi
}: {
  ordersKpi: AdminPerformanceSummary["ordersKpi"];
}) {
  const trend =
    ordersKpi.trend?.map((point) => ({
      date: point.date,
      value: point.unhealthyRate
    })) ?? [];

  return (
    <AdminDashboardCard className="p-4 sm:p-5">
      <MetricCardTitle title="UHO Performance" />

      {!ordersKpi.available ? (
        <AdminSectionUnavailable
          message={
            ordersKpi.reason ??
            "No confirmed Orders KPI records are available for this period."
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.62fr)_minmax(220px,1fr)] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-end gap-3">
                <p className="sn-num text-[44px] leading-none text-primary sm:text-[48px]">
                  {formatPercent(ordersKpi.unhealthyRate)}
                </p>
                <AdminTargetBadge status={ordersKpi.target?.status} />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[color:var(--sn-body)]">
                <Target className="h-4 w-4 text-primary" />
                Target:{" "}
                {ordersKpi.target?.configured
                  ? `<= ${formatPercent(ordersKpi.target.unhealthyRateTarget)}`
                  : "No target"}
              </p>
            </div>

            {trend.length ? (
              <AdminSparkline
                ariaLabel="Admin UHO trend by day"
                color="#ff5900"
                points={trend}
                target={ordersKpi.target?.unhealthyRateTarget ?? null}
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
              value={formatNumber(ordersKpi.totalOrders)}
            />
            <MetricFootnote
              icon={<TrendingUp className="h-4 w-4" />}
              label="UHO Count"
              value={formatNumber(ordersKpi.unhealthyOrders)}
            />
            <MetricFootnote
              icon={<Clock3 className="h-4 w-4" />}
              label="Not on Time"
              value={
                <span
                  className={
                    ordersKpi.orderNotOnTime
                      ? "text-[color:var(--sn-danger)]"
                      : undefined
                  }
                >
                  {formatNumber(ordersKpi.orderNotOnTime)}
                  {ordersKpi.orderNotOnTimeRate !== null &&
                  ordersKpi.orderNotOnTimeRate !== undefined ? (
                    <span className="ml-1 text-xs font-medium text-[color:var(--sn-muted)]">
                      ({formatPercent(ordersKpi.orderNotOnTimeRate)})
                    </span>
                  ) : null}
                </span>
              }
            />
          </div>
        </div>
      )}
    </AdminDashboardCard>
  );
}

export function AttendanceHealthCard({
  attendance
}: {
  attendance: AdminPerformanceSummary["attendance"];
}) {
  return (
    <AdminDashboardCard className="p-4 sm:p-5">
      <MetricCardTitle title="Attendance Health" />

      {!attendance.available ? (
        <AdminSectionUnavailable
          message={
            attendance.reason ??
            "No attendance records are available for this period."
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="sn-num text-[44px] leading-none text-primary sm:text-[48px]">
                {formatPercent(attendance.attendanceHealthRate)}
              </p>
              <p className="mt-2 text-xs font-medium text-[color:var(--sn-muted)]">
                Issue shifts:{" "}
                <span className="font-semibold text-[color:var(--sn-danger)]">
                  {formatNumber(attendance.issueShifts)}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-[color:var(--sn-border)] rounded-xl border border-[color:var(--sn-border)] bg-[#fffaf6] px-3 py-2">
              <MetricContext
                label="Clean Shifts"
                value={formatNumber(attendance.cleanShifts)}
              />
              <MetricContext
                label="Total Shifts"
                value={formatNumber(attendance.totalShifts)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-3">
            <IssueMetric
              icon={<Clock3 className="h-4 w-4" />}
              label="Late"
              value={attendance.lateCount}
            />
            <IssueMetric
              icon={<UserX className="h-4 w-4" />}
              label="Absent"
              value={attendance.absentCount}
            />
            <IssueMetric
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Under 8"
              value={attendance.under8Count}
            />
            <IssueMetric
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Over 15"
              value={attendance.over15Count}
            />
          </div>

          <p className="text-[11px] font-medium text-[color:var(--sn-muted)]">
            Included roles: {attendance.includedRoles.join(" + ")}
          </p>
        </div>
      )}
    </AdminDashboardCard>
  );
}

function MetricCardTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
        {title}
      </h2>
      <span className="grid h-5 w-5 place-items-center rounded-full text-[color:var(--sn-muted)]">
        <Info className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function AdminTargetBadge({
  status
}: {
  status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET" | undefined;
}) {
  const meta = targetBadgeMeta(status);

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
        meta.className
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function MetricFootnote({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <div className="flex min-w-0 items-center gap-2 text-[color:var(--sn-muted)]">
        {icon}
        <span className="min-w-0 text-[11px] leading-tight sm:text-xs">
          {label}
        </span>
      </div>
      <p className="sn-num mt-2 text-lg text-[color:var(--sn-ink)] sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function MetricContext({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <p className="truncate text-[10px] font-medium text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="sn-mono mt-1 text-sm font-semibold text-[color:var(--sn-ink)] sm:text-base">
        {value}
      </p>
    </div>
  );
}

function IssueMetric({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-3">
      <p className="flex min-w-0 items-center gap-1.5 text-[10px] text-[color:var(--sn-muted)] sm:text-xs">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="sn-num mt-1 text-sm text-[color:var(--sn-ink)] sm:text-lg">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function AdminSparkline({
  ariaLabel,
  color,
  points,
  target
}: {
  ariaLabel: string;
  color: string;
  points: Array<{ date: string; value: number | null | undefined }>;
  target?: number | null;
}) {
  const chartWidth = 320;
  const chartHeight = 132;
  const paddingX = 14;
  const paddingY = 16;
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  const yMax = Math.max(
    5,
    Math.ceil((Math.max(...values, target ?? 0, 10) * 1.2) / 5) * 5
  );
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const plottedPoints = points
    .map((point, index) => {
      if (typeof point.value !== "number") return null;

      const x =
        paddingX +
        (points.length <= 1
          ? plotWidth
          : (index / (points.length - 1)) * plotWidth);
      const y =
        paddingY +
        plotHeight -
        (Math.min(point.value, yMax) / yMax) * plotHeight;

      return { ...point, index, value: point.value, x, y };
    })
    .filter(
      (
        point
      ): point is {
        date: string;
        index: number;
        value: number;
        x: number;
        y: number;
      } => Boolean(point)
    );
  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const targetY =
    target === null || target === undefined
      ? null
      : paddingY + plotHeight - (Math.min(target, yMax) / yMax) * plotHeight;

  return (
    <div className="relative min-h-[132px] rounded-xl bg-[#fff7f0] px-2 py-1">
      <svg
        aria-label={ariaLabel}
        className="h-[120px] w-full touch-pan-y"
        role="img"
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
        {plottedPoints.map((point) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill="white"
            key={`${point.date}-${point.index}`}
            r="3.3"
            stroke={color}
            strokeWidth="2"
          />
        ))}
      </svg>
      {plottedPoints.length ? (
        <p className="absolute right-3 top-2 rounded-lg border border-[color:var(--sn-border)] bg-white/90 px-2 py-1 text-[11px] font-semibold text-[color:var(--sn-muted)]">
          {formatShortDate(plottedPoints[plottedPoints.length - 1].date)} ·{" "}
          {formatPercent(plottedPoints[plottedPoints.length - 1].value)}
        </p>
      ) : null}
    </div>
  );
}
