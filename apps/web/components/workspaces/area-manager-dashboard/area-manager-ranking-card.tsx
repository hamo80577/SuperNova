"use client";

import { Medal, Trophy } from "lucide-react";

import type {
  AreaManagerPerformanceSummary,
  AreaManagerRankRow
} from "@/lib/api/area-manager-performance";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "./area-manager-dashboard-utils";
import {
  AreaManagerCard,
  InfoPill,
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
        action={<InfoPill>UHO only</InfoPill>}
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
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffe8d9] text-[color:var(--tlb-orange)]">
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[color:var(--sn-muted)]">
            Your current rank
          </p>
          <p className="sn-mono mt-0.5 text-[30px] font-semibold leading-none text-[color:var(--sn-ink)]">
            #{formatNumber(row.rank)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[color:var(--sn-border)] rounded-xl border border-[color:var(--sn-border)] bg-white px-3 py-2">
        <RankContext label="Orders" value={formatNumber(row.totalOrders)} />
        <RankContext label="UHO" value={formatPercent(row.unhealthyRate)} />
        <RankContext
          label="Att. Rate"
          value={formatPercent(row.attendanceHealthRate)}
        />
      </div>
    </div>
  );
}

function RankContext({ label, value }: { label: string; value: string }) {
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

function RankingRow({ row }: { row: AreaManagerRankRow }) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3",
        row.isCurrentUser && "border-[#ffc9a8] bg-[#fff8f2]"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <RankMark rank={row.rank} />
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
      <div className="grid grid-cols-3 divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-2">
        <RankContext label="Orders" value={formatNumber(row.totalOrders)} />
        <RankContext label="UHO" value={formatPercent(row.unhealthyRate)} />
        <RankContext
          label="Att. Rate"
          value={formatPercent(row.attendanceHealthRate)}
        />
      </div>
    </div>
  );
}

function RankMark({ rank }: { rank: number }) {
  const isTopThree = rank <= 3;

  return (
    <span
      className={cn(
        "sn-mono grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold",
        rank === 1 &&
          "border-[#f3c252] bg-[#fff5cf] text-[#8a6500]",
        rank === 2 &&
          "border-[#c8d0d5] bg-[#f2f5f6] text-[#59666f]",
        rank === 3 &&
          "border-[#e5b18f] bg-[#fff0e5] text-[#98542a]",
        !isTopThree &&
          "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
      )}
    >
      {isTopThree ? (
        <span className="flex items-center gap-0.5">
          <Medal className="h-3.5 w-3.5" />
          <span>{rank}</span>
        </span>
      ) : (
        rank
      )}
    </span>
  );
}
