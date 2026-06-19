"use client";

import {
  AlertTriangle,
  Clock3,
  ShieldCheck,
  ShoppingBag,
  Target,
  UserRound
} from "lucide-react";

import type { AreaManagerPerformanceSummary } from "@/lib/api/area-manager-performance";
import {
  formatIssueShiftCount,
  formatNumber,
  formatPercent
} from "./area-manager-dashboard-utils";
import {
  AreaManagerCard,
  AttendanceDonut,
  CardTitle,
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
    <div className="grid gap-4 xl:grid-cols-2">
      <UhoPerformanceCard ordersKpi={summary.ordersKpi} />
      <AttendanceHealthCard attendance={summary.attendance} />
    </div>
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
      <CardTitle
        eyebrow="Confirmed Orders KPI records"
        title="UHO Performance"
      />

      {!ordersKpi.available ? (
        <div className="mt-4">
          <SectionUnavailable
            message={
              ordersKpi.reason ??
              "No confirmed Orders KPI records are available for this period."
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div
            className={
              trend.length
                ? "grid gap-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(220px,1fr)] sm:items-center"
                : "grid gap-4"
            }
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-[color:var(--sn-muted)]">
                UHO %
              </p>
              <p className="sn-num mt-2 text-[48px] leading-none text-[color:var(--sn-ink)]">
                {formatPercent(ordersKpi.unhealthyRate)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TargetBadge status={ordersKpi.target?.status} />
                <span className="text-xs font-medium text-[color:var(--sn-muted)]">
                  {ordersKpi.target?.configured
                    ? `Target <= ${formatPercent(
                        ordersKpi.target.unhealthyRateTarget
                      )}`
                    : "No target configured"}
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
            ) : null}
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
      <CardTitle
        eyebrow={`Included roles: ${attendance.includedRoles
          .map((role) => (role === "PICKER" ? "Pickers" : "Champs"))
          .join(" + ")}`}
        title="Attendance Health"
      />

      {!attendance.available ? (
        <div className="mt-4">
          <SectionUnavailable
            message={
              attendance.reason ??
              "No attendance records are available for this period."
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[color:var(--sn-muted)]">
                Clean Shift Rate
              </p>
              <p className="sn-num mt-2 text-[48px] leading-none text-[color:var(--sn-ink)]">
                {formatPercent(attendance.attendanceHealthRate)}
              </p>
              <p className="mt-3 text-sm font-semibold text-[color:var(--sn-body)]">
                {formatNumber(attendance.cleanShifts)} /{" "}
                {formatNumber(attendance.totalShifts)} clean shifts
              </p>
              <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
                {formatIssueShiftCount(attendance.issueShifts)}
              </p>
            </div>
            <AttendanceDonut value={attendance.attendanceHealthRate} />
          </div>

          <div className="grid grid-cols-2 gap-y-3 divide-x-0 border-t border-[color:var(--sn-border)] pt-3 sm:grid-cols-5 sm:divide-x sm:divide-[color:var(--sn-border)]">
            <MetricFootnote
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Shift Errors"
              value={formatNumber(attendance.totalShiftErrors)}
            />
            <MetricFootnote
              icon={<Clock3 className="h-4 w-4" />}
              label="Late"
              value={formatNumber(attendance.lateCount)}
            />
            <MetricFootnote
              icon={<UserRound className="h-4 w-4" />}
              label="Absent"
              value={formatNumber(attendance.absentCount)}
            />
            <MetricFootnote
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Under 8"
              value={formatNumber(attendance.under8Count)}
            />
            <MetricFootnote
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Over 15"
              value={formatNumber(attendance.over15Count)}
            />
          </div>
        </div>
      )}
    </AreaManagerCard>
  );
}
