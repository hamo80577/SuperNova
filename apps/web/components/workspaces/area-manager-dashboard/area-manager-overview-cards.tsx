"use client";

import {
  Clock3,
  Info,
  ShoppingBag,
  Target
} from "lucide-react";

import type { AreaManagerPerformanceSummary } from "@/lib/api/area-manager-performance";
import { cn } from "@/lib/utils";
import {
  formatIssueShiftCount,
  formatNumber,
  formatPercent
} from "./area-manager-dashboard-utils";
import {
  AreaManagerCard,
  AttendanceDonut,
  MetricFootnote,
  SectionUnavailable,
  TargetBadge,
  TrendLine
} from "./area-manager-metric-card";

export function AreaManagerOverviewCards({
  summary
}: {
  summary: AreaManagerPerformanceSummary;
}) {
  return (
    <>
      <UhoPerformanceCard ordersKpi={summary.ordersKpi} />
      <AttendanceHealthCard attendance={summary.attendance} />
    </>
  );
}

function UhoPerformanceCard({
  ordersKpi
}: {
  ordersKpi: AreaManagerPerformanceSummary["ordersKpi"];
}) {
  const trend =
    ordersKpi.trend?.map((point) => ({
      date: point.date,
      value: point.unhealthyRate
    })) ?? [];

  return (
    <AreaManagerCard className="p-4 sm:p-5">
      <MetricCardTitle title="UHO Performance" />

      {!ordersKpi.available ? (
        <SectionUnavailable
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
                <TargetBadge status={ordersKpi.target?.status} />
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
              <TrendLine
                ariaLabel="Area UHO trend by day"
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
                <span>
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
    </AreaManagerCard>
  );
}

function AttendanceHealthCard({
  attendance
}: {
  attendance: AreaManagerPerformanceSummary["attendance"];
}) {
  return (
    <AreaManagerCard className="p-4 sm:p-5">
      <MetricCardTitle title="Attendance Health" />

      {!attendance.available ? (
        <SectionUnavailable
          message={
            attendance.reason ??
            "No attendance records are available for this period."
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-4">
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
        </div>
      )}
    </AreaManagerCard>
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
