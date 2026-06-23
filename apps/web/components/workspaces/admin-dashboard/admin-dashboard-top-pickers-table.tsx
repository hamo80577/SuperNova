"use client";

import { Store } from "lucide-react";

import type {
  AdminPerformanceSummary,
  AdminTopPickerRow
} from "@/lib/api/admin-performance";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardRankMark,
  DashboardSectionFooter
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import {
  formatNumber,
  formatPercent,
  healthToneClass,
  uhoToneClass
} from "./admin-dashboard-utils";
import {
  AdminDashboardCard,
  AdminPerformanceStatusBadge,
  AdminSectionEmptyState,
  AdminSectionHeader,
  AdminSectionUnavailable
} from "./admin-dashboard-metric-card";

export function AdminDashboardTopPickersTable({
  topPickers
}: {
  topPickers: AdminPerformanceSummary["topPickers"];
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        title="Top 10 Pickers"
      />

      {!topPickers.available ? (
        <div className="p-4">
          <AdminSectionUnavailable
            message={topPickers.reason ?? "Top Pickers are unavailable."}
          />
        </div>
      ) : topPickers.rows.length === 0 ? (
        <AdminSectionEmptyState message="No eligible Pickers for this period." />
      ) : (
        <>
          <div className="hidden xl:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Picker</th>
                  <th>Shopper ID</th>
                  <th>Branch</th>
                  <th>Chain</th>
                  <th>Orders</th>
                  <th>UHO %</th>
                  <th>Att. Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topPickers.rows.map((row) => (
                  <TopPickerDesktopRow key={row.pickerId} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 xl:hidden">
            {topPickers.rows.map((row) => (
              <TopPickerMobileRow key={row.pickerId} row={row} />
            ))}
          </div>

          <DashboardSectionFooter>
            Showing {formatNumber(topPickers.rows.length)} Pickers from{" "}
            {formatNumber(topPickers.totalEligible)} eligible Pickers
          </DashboardSectionFooter>
        </>
      )}
    </AdminDashboardCard>
  );
}

function TopPickerDesktopRow({ row }: { row: AdminTopPickerRow }) {
  return (
    <tr>
      <td>
        <DashboardRankMark compact rank={row.rank} />
      </td>
      <td>
        <p className="max-w-[220px] truncate font-semibold text-[color:var(--sn-ink)]">
          {row.pickerName}
        </p>
      </td>
      <td className="max-w-[150px] truncate font-medium">
        {row.shopperId ?? "-"}
      </td>
      <td className="max-w-[180px] truncate font-medium">
        {row.vendorName ?? "Not assigned"}
      </td>
      <td className="max-w-[180px] truncate font-medium">
        {row.chainName ?? "Not assigned"}
      </td>
      <td className="sn-mono font-semibold">{formatNumber(row.totalOrders)}</td>
      <td className={uhoToneClass(row.unhealthyRate)}>
        {formatPercent(row.unhealthyRate)}
      </td>
      <td className={healthToneClass(row.attendanceHealthRate)}>
        {formatPercent(row.attendanceHealthRate)}
      </td>
      <td>
        <AdminPerformanceStatusBadge status={row.status} />
      </td>
    </tr>
  );
}

function TopPickerMobileRow({ row }: { row: AdminTopPickerRow }) {
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <DashboardRankMark rank={row.rank} />
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-5 text-[color:var(--sn-ink)]">
              {row.pickerName}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-[color:var(--sn-muted)]">
              {row.shopperId ?? "No shopper ID"}
            </p>
          </div>
        </div>
        <AdminPerformanceStatusBadge status={row.status} />
      </div>

      <DashboardMetricGrid>
        <MobileMetric label="Orders" value={formatNumber(row.totalOrders)} />
        <MobileMetric label="UHO" value={formatPercent(row.unhealthyRate)} />
        <MobileMetric
          label="Att."
          value={formatPercent(row.attendanceHealthRate)}
        />
      </DashboardMetricGrid>

      <p className="flex min-w-0 items-center gap-1 text-[11px] leading-5 text-[color:var(--sn-muted)]">
        <Store className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {row.vendorName ?? "Not assigned"} · {row.chainName ?? "No chain"}
        </span>
      </p>
    </article>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return <DashboardMetricItem label={label} value={value} />;
}
