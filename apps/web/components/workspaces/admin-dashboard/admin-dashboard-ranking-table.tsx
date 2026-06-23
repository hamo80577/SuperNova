"use client";

import type { ReactNode } from "react";

import type {
  AdminAreaManagerRankRow,
  AdminChampRankRow,
  AdminPerformanceSummary
} from "@/lib/api/admin-performance";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardRankMark,
  DashboardSectionFooter
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import {
  formatNumber,
  formatPercent
} from "./admin-dashboard-utils";
import {
  AdminDashboardCard,
  AdminPerformanceStatusBadge,
  AdminSectionEmptyState,
  AdminSectionHeader,
  AdminSectionUnavailable
} from "./admin-dashboard-metric-card";

export function AdminAreaManagersRankingTable({
  ranking
}: {
  ranking: AdminPerformanceSummary["areaManagersRanking"];
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        eyebrow="Lower UHO ranks higher"
        title="Area Managers Ranking"
      />

      {!ranking.available ? (
        <div className="p-4">
          <AdminSectionUnavailable
            message={
              ranking.reason ?? "Area Manager ranking is unavailable."
            }
          />
        </div>
      ) : ranking.rows.length === 0 ? (
        <AdminSectionEmptyState
          message="No Area Manager ranking rows for this period."
        />
      ) : (
        <>
          <div className="grid gap-2 p-3">
            {ranking.rows.map((row) => (
              <AreaManagerRankingMobileRow
                key={row.areaManagerId}
                row={row}
              />
            ))}
          </div>

          <RankingFooter
            label={`Showing ${formatNumber(ranking.rows.length)} of ${formatNumber(
              ranking.totalRows
            )} Area Managers`}
          />
        </>
      )}
    </AdminDashboardCard>
  );
}

export function AdminChampsRankingTable({
  ranking
}: {
  ranking: AdminPerformanceSummary["champsRanking"];
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        eyebrow="Performance across each Champ's scoped branches"
        title="Champs Ranking"
      />

      {!ranking.available ? (
        <div className="p-4">
          <AdminSectionUnavailable
            message={ranking.reason ?? "Champ ranking is unavailable."}
          />
        </div>
      ) : ranking.rows.length === 0 ? (
        <AdminSectionEmptyState message="No Champ ranking rows for this period." />
      ) : (
        <>
          <div className="grid gap-2 p-3">
            {ranking.rows.map((row) => (
              <ChampRankingMobileRow key={row.champId} row={row} />
            ))}
          </div>

          <RankingFooter
            label={`Showing ${formatNumber(ranking.rows.length)} of ${formatNumber(
              ranking.totalRows
            )} Champs`}
          />
        </>
      )}
    </AdminDashboardCard>
  );
}

function AreaManagerRankingMobileRow({
  row
}: {
  row: AdminAreaManagerRankRow;
}) {
  return (
    <RankingMobileCard
      meta={`${formatNumber(row.chainsCount)} chains · ${formatNumber(
        row.branchesCount
      )} branches`}
      rank={row.rank}
      status={<AdminPerformanceStatusBadge status={row.status} />}
      title={row.areaManagerName}
    >
      <MobileMetric label="Orders" value={formatNumber(row.totalOrders)} />
      <MobileMetric label="UHO" value={formatPercent(row.unhealthyRate)} />
      <MobileMetric
        label="Att."
        value={formatPercent(row.attendanceHealthRate)}
      />
    </RankingMobileCard>
  );
}

function ChampRankingMobileRow({ row }: { row: AdminChampRankRow }) {
  return (
    <RankingMobileCard
      meta={`${formatNumber(row.branchesCount)} branches · ${formatNumber(
        row.totalPickers
      )} pickers`}
      rank={row.rank}
      status={<AdminPerformanceStatusBadge status={row.status} />}
      title={row.champName}
    >
      <MobileMetric label="Orders" value={formatNumber(row.totalOrders)} />
      <MobileMetric label="UHO" value={formatPercent(row.unhealthyRate)} />
      <MobileMetric
        label="Att."
        value={formatPercent(row.attendanceHealthRate)}
      />
    </RankingMobileCard>
  );
}

function RankingMobileCard({
  children,
  meta,
  rank,
  status,
  title
}: {
  children: ReactNode;
  meta: string;
  rank: number;
  status: ReactNode;
  title: string;
}) {
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <DashboardRankMark rank={rank} />
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-5 text-[color:var(--sn-ink)]">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] text-[color:var(--sn-muted)]">
              {meta}
            </p>
          </div>
        </div>
        {status}
      </div>

      <DashboardMetricGrid>
        {children}
      </DashboardMetricGrid>
    </article>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return <DashboardMetricItem label={label} value={value} />;
}

function RankingFooter({ label }: { label: string }) {
  return <DashboardSectionFooter>{label}</DashboardSectionFooter>;
}
