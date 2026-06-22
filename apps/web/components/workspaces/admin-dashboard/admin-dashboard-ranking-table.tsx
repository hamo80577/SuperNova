"use client";

import { Medal, Star, UserRoundCog } from "lucide-react";
import type { ReactNode } from "react";

import type {
  AdminAreaManagerRankRow,
  AdminChampRankRow,
  AdminPerformanceSummary
} from "@/lib/api/admin-performance";
import { cn } from "@/lib/utils";
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

export function AdminAreaManagersRankingTable({
  ranking,
  scopeLabel
}: {
  ranking: AdminPerformanceSummary["areaManagersRanking"];
  scopeLabel: string;
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        action={<AdminInfoPill>{scopeLabel} · UHO only</AdminInfoPill>}
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
          <div className="hidden xl:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Area Manager</th>
                  <th>Chains</th>
                  <th>Branches</th>
                  <th>Orders</th>
                  <th>UHO %</th>
                  <th>Att. Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.map((row) => (
                  <AreaManagerRankingDesktopRow
                    key={row.areaManagerId}
                    row={row}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 xl:hidden">
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
  ranking,
  scopeLabel
}: {
  ranking: AdminPerformanceSummary["champsRanking"];
  scopeLabel: string;
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        action={<AdminInfoPill>{scopeLabel} · UHO only</AdminInfoPill>}
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
          <div className="hidden xl:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Champ</th>
                  <th>Branches</th>
                  <th>Pickers</th>
                  <th>Orders</th>
                  <th>UHO %</th>
                  <th>Att. Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.map((row) => (
                  <ChampRankingDesktopRow key={row.champId} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 xl:hidden">
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

function AreaManagerRankingDesktopRow({
  row
}: {
  row: AdminAreaManagerRankRow;
}) {
  return (
    <tr>
      <td>
        <RankMark rank={row.rank} />
      </td>
      <td>
        <p className="max-w-[220px] truncate font-semibold text-[color:var(--sn-ink)]">
          {row.areaManagerName}
        </p>
      </td>
      <td className="sn-mono font-semibold">{formatNumber(row.chainsCount)}</td>
      <td className="sn-mono font-semibold">
        {formatNumber(row.branchesCount)}
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

function ChampRankingDesktopRow({ row }: { row: AdminChampRankRow }) {
  return (
    <tr>
      <td>
        <RankMark rank={row.rank} />
      </td>
      <td>
        <p className="max-w-[220px] truncate font-semibold text-[color:var(--sn-ink)]">
          {row.champName}
        </p>
      </td>
      <td className="sn-mono font-semibold">
        {formatNumber(row.branchesCount)}
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
          <RankMark rank={rank} />
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

      <div className="grid grid-cols-3 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-2">
        {children}
      </div>
    </article>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0">
      <p className="truncate text-[10px] font-medium text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="sn-mono mt-0.5 truncate text-sm font-semibold text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}

function RankMark({ rank }: { rank: number }) {
  const isTopThree = rank <= 3;

  return (
    <span
      className={cn(
        "sn-mono grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold",
        rank === 1 && "border-[#f3c252] bg-[#fff5cf] text-[#8a6500]",
        rank === 2 && "border-[#c8d0d5] bg-[#f2f5f6] text-[#59666f]",
        rank === 3 && "border-[#e5b18f] bg-[#fff0e5] text-[#98542a]",
        !isTopThree &&
          "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
      )}
    >
      {isTopThree ? (
        <span className="flex items-center gap-0.5">
          {rank === 1 ? (
            <Medal className="h-3.5 w-3.5" />
          ) : rank === 2 ? (
            <Star className="h-3.5 w-3.5" />
          ) : (
            <UserRoundCog className="h-3.5 w-3.5" />
          )}
          <span>{rank}</span>
        </span>
      ) : (
        rank
      )}
    </span>
  );
}

function RankingFooter({ label }: { label: string }) {
  return (
    <div className="border-t border-[color:var(--sn-border)] px-4 py-2.5 text-xs text-[color:var(--sn-muted)]">
      {label}
    </div>
  );
}
