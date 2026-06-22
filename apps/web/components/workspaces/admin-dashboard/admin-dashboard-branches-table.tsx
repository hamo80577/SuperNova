"use client";

import { Store, Users } from "lucide-react";
import type { ReactNode } from "react";

import type {
  AdminBranchRankRow,
  AdminPerformanceSummary
} from "@/lib/api/admin-performance";
import {
  formatNumber,
  formatPercent,
  healthToneClass,
  uhoToneClass
} from "./admin-dashboard-utils";
import {
  AdminDashboardCard,
  AdminInfoPill,
  AdminPerformanceStatusBadge,
  AdminSectionEmptyState,
  AdminSectionHeader,
  AdminSectionUnavailable
} from "./admin-dashboard-metric-card";

export function AdminDashboardBranchesTable({
  ranking,
  scopeLabel
}: {
  ranking: AdminPerformanceSummary["branchesRanking"];
  scopeLabel: string;
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        action={<AdminInfoPill>{scopeLabel} · UHO only</AdminInfoPill>}
        eyebrow="Branch performance by confirmed Orders KPI and scoped attendance"
        title="Branches Ranking"
      />

      {!ranking.available ? (
        <div className="p-4">
          <AdminSectionUnavailable
            message={ranking.reason ?? "Branch ranking is unavailable."}
          />
        </div>
      ) : ranking.rows.length === 0 ? (
        <AdminSectionEmptyState
          message="No Branch ranking rows for this period."
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Branch / Vendor</th>
                  <th>Chain</th>
                  <th>Champ</th>
                  <th>Pickers</th>
                  <th>Orders</th>
                  <th>UHO %</th>
                  <th>Att. Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.map((row) => (
                  <BranchDesktopRow key={row.vendorId} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 xl:hidden">
            {ranking.rows.map((row) => (
              <BranchMobileRow key={row.vendorId} row={row} />
            ))}
          </div>

          <div className="border-t border-[color:var(--sn-border)] px-4 py-2.5 text-xs text-[color:var(--sn-muted)]">
            Showing {formatNumber(ranking.rows.length)} of{" "}
            {formatNumber(ranking.totalRows)} Branches
          </div>
        </>
      )}
    </AdminDashboardCard>
  );
}

function BranchDesktopRow({ row }: { row: AdminBranchRankRow }) {
  return (
    <tr>
      <td className="sn-mono font-semibold">{row.rank}</td>
      <td>
        <p className="max-w-[220px] truncate font-semibold text-[color:var(--sn-ink)]">
          {row.vendorName}
        </p>
      </td>
      <td className="max-w-[180px] truncate font-medium">{row.chainName}</td>
      <td className="max-w-[180px] truncate font-medium">
        {row.champName ?? "Not assigned"}
      </td>
      <td className="sn-mono font-semibold">{formatNumber(row.totalPickers)}</td>
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

function BranchMobileRow({ row }: { row: AdminBranchRankRow }) {
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="sn-mono grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-sm font-semibold text-[color:var(--sn-muted)]">
            {row.rank}
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-5 text-[color:var(--sn-ink)]">
              {row.vendorName}
            </h3>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-[color:var(--sn-muted)]">
              <Store className="h-3 w-3 shrink-0" />
              <span className="truncate">{row.chainName}</span>
            </p>
          </div>
        </div>
        <AdminPerformanceStatusBadge status={row.status} />
      </div>

      <div className="grid grid-cols-4 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-2">
        <MobileMetric
          icon={<Users className="h-3 w-3" />}
          label="Pickers"
          value={formatNumber(row.totalPickers)}
        />
        <MobileMetric label="Orders" value={formatNumber(row.totalOrders)} />
        <MobileMetric label="UHO" value={formatPercent(row.unhealthyRate)} />
        <MobileMetric
          label="Att."
          value={formatPercent(row.attendanceHealthRate)}
        />
      </div>

      <p className="text-[11px] leading-5 text-[color:var(--sn-muted)]">
        Champ: {row.champName ?? "Not assigned"}
      </p>
    </article>
  );
}

function MobileMetric({
  icon,
  label,
  value
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0">
      <p className="flex items-center gap-1 truncate text-[10px] font-medium text-[color:var(--sn-muted)]">
        {icon}
        {label}
      </p>
      <p className="sn-mono mt-0.5 truncate text-sm font-semibold text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}
