"use client";

import type {
  AreaManagerPerformanceSummary,
  AreaManagerRankRow
} from "@/lib/api/area-manager-performance";
import { cn } from "@/lib/utils";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardRankMark
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import { formatNumber, formatPercent } from "./area-manager-dashboard-utils";
import {
  AreaManagerCard,
  SectionEmptyState,
  SectionHeader,
  SectionUnavailable
} from "./area-manager-metric-card";

export function AreaManagerRankingCard({
  ranking
}: {
  ranking: AreaManagerPerformanceSummary["areaManagersRanking"];
}) {
  const current = ranking.currentAreaManager;

  return (
    <AreaManagerCard className="h-full overflow-hidden">
      <SectionHeader
        eyebrow="Lower UHO ranks higher"
        title="Area Managers Ranking"
      />

      {!ranking.available ? (
        <div className="p-4">
          <SectionUnavailable
            message={ranking.reason ?? "Area Manager ranking is unavailable."}
          />
        </div>
      ) : (
        <>
          {current ? <CurrentRankSummary row={current} /> : null}

          {ranking.rows.length === 0 ? (
            <SectionEmptyState
              message="Ranking is available but no ranking rows were returned."
            />
          ) : (
            <div className="grid max-h-[220px] gap-2 overflow-y-auto p-3">
              {ranking.rows.map((row) => (
                <RankingRow key={row.areaManagerId} row={row} />
              ))}
            </div>
          )}
        </>
      )}
    </AreaManagerCard>
  );
}

function CurrentRankSummary({ row }: { row: AreaManagerRankRow }) {
  return (
    <div className="grid gap-3 border-b border-[color:var(--sn-border)] bg-[#fffaf6] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <DashboardRankMark rank={row.rank} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[color:var(--sn-muted)]">
            Your current rank
          </p>
          <p className="sn-mono mt-0.5 text-[30px] font-semibold leading-none text-[color:var(--sn-ink)]">
            #{formatNumber(row.rank)}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-[color:var(--sn-border)] bg-white px-3 py-2">
        <DashboardMetricGrid className="border-t-0 pt-0">
        <RankContext label="Orders" value={formatNumber(row.totalOrders)} />
        <RankContext label="UHO" value={formatPercent(row.unhealthyRate)} />
        <RankContext
          label="Att. Rate"
          value={formatPercent(row.attendanceHealthRate)}
        />
        </DashboardMetricGrid>
      </div>
    </div>
  );
}

function RankContext({ label, value }: { label: string; value: string }) {
  return <DashboardMetricItem label={label} value={value} />;
}

function RankingRow({ row }: { row: AreaManagerRankRow }) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3",
        row.isCurrentUser && "border-[#ffc9a8] bg-[#fff8f2]"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <DashboardRankMark rank={row.rank} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
            {row.areaManagerName}
          </p>
          <p className="text-[11px] text-[color:var(--sn-muted)]">
            {formatNumber(row.chainsCount)} chains
            {row.isCurrentUser ? " - You" : ""}
          </p>
        </div>
      </div>
      <DashboardMetricGrid>
        <RankContext label="Orders" value={formatNumber(row.totalOrders)} />
        <RankContext label="UHO" value={formatPercent(row.unhealthyRate)} />
        <RankContext
          label="Att. Rate"
          value={formatPercent(row.attendanceHealthRate)}
        />
      </DashboardMetricGrid>
    </div>
  );
}
