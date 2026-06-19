"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  areaManagerPerformanceApi,
  type AreaManagerPerformanceSummary
} from "@/lib/api/area-manager-performance";
import { AreaManagerBranchesTable } from "./area-manager-branches-table";
import { AreaManagerChampsTable } from "./area-manager-champs-table";
import {
  AreaManagerDashboardHeader,
  type AreaManagerChainOption
} from "./area-manager-dashboard-header";
import {
  getAreaManagerDateRange,
  type AreaManagerRangeKey
} from "./area-manager-dashboard-utils";
import { AreaManagerOverviewCards } from "./area-manager-overview-cards";
import { AreaManagerRankingCard } from "./area-manager-ranking-card";
import { AreaManagerRequestsCard } from "./area-manager-requests-card";

type DashboardState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; data?: never; error: string }
  | {
      status: "ready";
      data: AreaManagerPerformanceSummary;
      error?: never;
    };

export function AreaManagerDashboardPage() {
  const [rangeKey, setRangeKey] =
    useState<AreaManagerRangeKey>("THIS_MONTH");
  const [selectedChainId, setSelectedChainId] = useState<string | undefined>();
  const [chainOptions, setChainOptions] = useState<AreaManagerChainOption[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const selectedRange = useMemo(
    () => getAreaManagerDateRange(rangeKey),
    [rangeKey]
  );

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setState({ status: "loading" });

      try {
        const data = await areaManagerPerformanceApi.summary({
          dateFrom: selectedRange.dateFrom,
          dateTo: selectedRange.dateTo,
          chainId: selectedChainId
        });

        if (!mounted) return;

        setChainOptions((current) =>
          mergeChainOptions(current, data.scope.chains)
        );
        setState({ status: "ready", data });
      } catch (caughtError) {
        if (!mounted) return;

        setState({
          status: "error",
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load Area Manager performance summary."
        });
      }
    }

    void loadSummary();

    return () => {
      mounted = false;
    };
  }, [
    reloadNonce,
    selectedChainId,
    selectedRange.dateFrom,
    selectedRange.dateTo
  ]);

  return (
    <div className="sn mx-auto grid w-full max-w-[1480px] gap-4 overflow-hidden">
      <AreaManagerDashboardHeader
        chainOptions={chainOptions}
        dateFrom={selectedRange.dateFrom}
        dateTo={selectedRange.dateTo}
        loading={state.status === "loading"}
        onChainChange={setSelectedChainId}
        onRangeChange={setRangeKey}
        rangeKey={rangeKey}
        selectedChainId={selectedChainId}
      />

      {state.status === "ready" ? (
        <AreaManagerDashboardContent summary={state.data} />
      ) : state.status === "error" ? (
        <DashboardError
          message={state.error}
          onRetry={() => setReloadNonce((current) => current + 1)}
        />
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  );
}

function AreaManagerDashboardContent({
  summary
}: {
  summary: AreaManagerPerformanceSummary;
}) {
  return (
    <>
      <AreaManagerOverviewCards summary={summary} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <AreaManagerRequestsCard latestRequests={summary.latestRequests} />
        <AreaManagerRankingCard ranking={summary.areaManagersRanking} />
      </div>

      <AreaManagerBranchesTable
        branchesPerformance={summary.branchesPerformance}
      />
      <AreaManagerChampsTable champsPerformance={summary.champsPerformance} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4" role="status">
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard className="h-[300px]" />
        <SkeletonCard className="h-[300px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <SkeletonCard className="h-[330px]" />
        <SkeletonCard className="h-[330px]" />
      </div>
      <SkeletonCard className="h-[360px]" />
      <SkeletonCard className="h-[340px]" />
    </div>
  );
}

function SkeletonCard({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-[16px] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.04)] ${className}`}
    />
  );
}

function DashboardError({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-3 rounded-[16px] border border-[color:var(--sn-danger-bg)] bg-[color:var(--sn-danger-bg)] p-4 text-sm text-[color:var(--sn-danger)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="break-words">{message}</p>
      </div>
      <Button
        className="h-9 shrink-0 rounded-xl bg-white"
        onClick={onRetry}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

function mergeChainOptions(
  current: AreaManagerChainOption[],
  incoming: AreaManagerChainOption[]
) {
  const byId = new Map(current.map((chain) => [chain.chainId, chain]));

  for (const chain of incoming) {
    byId.set(chain.chainId, chain);
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.chainName.localeCompare(right.chainName)
  );
}
