"use client";

import {
  Clock3,
  Info,
  ShieldCheck,
  ShoppingBag,
  Target
} from "lucide-react";
import { useState, type PointerEvent, type ReactNode } from "react";

import type { AdminPerformanceSummary } from "@/lib/api/admin-performance";
import { cn } from "@/lib/utils";
import { getNearestDashboardPointIndex } from "@/components/workspaces/dashboard-ui/dashboard-chart-utils";
import {
  DashboardCard,
  DashboardEmptyState,
  DashboardPerformanceStatusBadge,
  DashboardSectionHeader,
  DashboardUnavailableState
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import {
  formatNumber,
  formatPercent,
  formatShortDate,
  targetBadgeMeta
} from "./admin-dashboard-utils";

export function AdminDashboardCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <DashboardCard className={className}>{children}</DashboardCard>;
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
    <DashboardSectionHeader action={action} eyebrow={eyebrow} title={title} />
  );
}

export function AdminPerformanceStatusBadge({
  status
}: {
  status: Parameters<typeof DashboardPerformanceStatusBadge>[0]["status"];
}) {
  return <DashboardPerformanceStatusBadge status={status} />;
}

export function AdminSectionUnavailable({ message }: { message: string }) {
  return <DashboardUnavailableState message={message} />;
}

export function AdminSectionEmptyState({ message }: { message: string }) {
  return <DashboardEmptyState message={message} />;
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
              <p className="sn-num text-[42px] leading-none text-[color:var(--sn-ink)]">
                {formatPercent(ordersKpi.unhealthyRate)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AdminTargetBadge status={ordersKpi.target?.status} />
                <span className="text-xs font-medium text-[color:var(--sn-muted)]">
                  Target:{" "}
                  {ordersKpi.target?.configured
                    ? `<= ${formatPercent(
                        ordersKpi.target.unhealthyRateTarget
                      )}`
                    : "No target"}
                </span>
              </div>
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
              icon={<Target className="h-4 w-4" />}
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
              <p className="sn-num text-[42px] leading-none text-[color:var(--sn-ink)]">
                {formatPercent(attendance.attendanceHealthRate)}
              </p>
              <p className="mt-3 text-sm text-[color:var(--sn-muted)]">
                Clean shifts
              </p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--sn-ink)]">
                {formatNumber(attendance.cleanShifts)} /{" "}
                {formatNumber(attendance.totalShifts)}
              </p>
              <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
                {formatIssueShiftCount(attendance.issueShifts)} ·{" "}
                {formatNumber(attendance.totalShiftErrors)} total errors
              </p>
            </div>
            <AttendanceDonut value={attendance.attendanceHealthRate} />
          </div>

          <div className="grid grid-cols-4 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-3">
            <IssueMetric
              label="Late"
              tone="orange"
              value={attendance.lateCount}
            />
            <IssueMetric
              label="Absent"
              tone="red"
              value={attendance.absentCount}
            />
            <IssueMetric
              label="Under 8"
              tone="orange"
              value={attendance.under8Count}
            />
            <IssueMetric
              label="Over 15"
              tone="red"
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
        "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold leading-none",
        meta.className
      )}
    >
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

function formatIssueShiftCount(value: number | undefined) {
  const safeValue = value ?? 0;
  return `${formatNumber(safeValue)} ${
    safeValue === 1 ? "issue shift" : "issue shifts"
  }`;
}

function IssueMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "orange" | "red";
  value: number | undefined;
}) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
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

function AttendanceDonut({ value }: { value: number | null | undefined }) {
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
  const activePoint =
    activeIndex === null
      ? null
      : plottedPoints.find((point) => point.index === activeIndex) ?? null;
  const tooltipPoint =
    activePoint ?? plottedPoints[plottedPoints.length - 1] ?? null;
  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const targetY =
    target === null || target === undefined
      ? null
      : paddingY + plotHeight - (Math.min(target, yMax) / yMax) * plotHeight;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setActiveIndex(
      getNearestDashboardPointIndex({
        chartWidth,
        pointerClientX: event.clientX,
        points: plottedPoints,
        svgLeft: bounds.left,
        svgWidth: bounds.width
      })
    );
  }

  return (
    <div className="relative min-h-[132px] rounded-xl bg-[#fffaf6] px-2 py-1">
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
      {tooltipPoint ? (
        <p className="pointer-events-none absolute right-3 top-2 z-10 rounded-lg border border-[color:var(--sn-border)] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[color:var(--sn-ink)] shadow-[0_6px_18px_rgba(65,21,23,0.08)]">
          <span className="text-[color:var(--sn-muted)]">
            {formatShortDate(tooltipPoint.date)}
          </span>{" "}
          {formatPercent(tooltipPoint.value)}
        </p>
      ) : null}
    </div>
  );
}
