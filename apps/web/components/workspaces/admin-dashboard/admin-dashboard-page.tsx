"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminPerformanceApi,
  type AdminPerformanceSummary
} from "@/lib/api/admin-performance";
import { AdminDashboardBranchesTable } from "./admin-dashboard-branches-table";
import { AdminDashboardHeader } from "./admin-dashboard-header";
import {
  AttendanceHealthCard,
  UhoPerformanceCard
} from "./admin-dashboard-metric-card";
import {
  AdminAreaManagersRankingTable,
  AdminChampsRankingTable
} from "./admin-dashboard-ranking-table";
import { AdminDashboardTicketsCard } from "./admin-dashboard-tickets-card";
import { AdminDashboardTopPickersTable } from "./admin-dashboard-top-pickers-table";
import {
  getAdminDashboardDateRange,
  getFilteredBranchOptions,
  getNextBranchIdForChain,
  type AdminDashboardBranchOption,
  type AdminDashboardRangeKey
} from "./admin-dashboard-utils";

type DashboardState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; data?: never; error: string }
  | { status: "ready"; data: AdminPerformanceSummary; error?: never };

export function AdminDashboardPage() {
  const [rangeKey, setRangeKey] =
    useState<AdminDashboardRangeKey>("THIS_MONTH");
  const [selectedChainId, setSelectedChainId] = useState<string | undefined>();
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>();
  const [chainOptions, setChainOptions] = useState<
    AdminPerformanceSummary["filters"]["chains"]
  >([]);
  const [branchOptions, setBranchOptions] = useState<
    AdminDashboardBranchOption[]
  >([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const selectedRange = useMemo(
    () => getAdminDashboardDateRange(rangeKey),
    [rangeKey]
  );
  const visibleBranchOptions = useMemo(
    () => getFilteredBranchOptions(branchOptions, selectedChainId),
    [branchOptions, selectedChainId]
  );

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setState({ status: "loading" });

      try {
        const data = await adminPerformanceApi.summary({
          chainId: selectedChainId,
          dateFrom: selectedRange.dateFrom,
          dateTo: selectedRange.dateTo,
          vendorId: selectedVendorId
        });

        if (!mounted) return;

        setChainOptions((current) =>
          mergeChainOptions(current, data.filters.chains)
        );
        setBranchOptions((current) =>
          mergeBranchOptions(current, data.filters.branches)
        );
        setState({ status: "ready", data });
      } catch (caughtError) {
        if (!mounted) return;

        setState({
          status: "error",
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load Admin performance summary."
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
    selectedRange.dateTo,
    selectedVendorId
  ]);

  function handleChainChange(nextChainId: string | undefined) {
    setSelectedChainId(nextChainId);
    setSelectedVendorId((currentVendorId) =>
      getNextBranchIdForChain({
        branches: branchOptions,
        currentVendorId,
        nextChainId
      })
    );
  }

  return (
    <div className="sn mx-auto grid w-full max-w-[1480px] gap-4 overflow-hidden">
      <AdminDashboardHeader
        branchOptions={visibleBranchOptions}
        chainOptions={chainOptions}
        dateFrom={selectedRange.dateFrom}
        dateTo={selectedRange.dateTo}
        loading={state.status === "loading"}
        onBranchChange={setSelectedVendorId}
        onChainChange={handleChainChange}
        onRangeChange={setRangeKey}
        rangeKey={rangeKey}
        selectedChainId={selectedChainId}
        selectedVendorId={selectedVendorId}
      />

      {state.status === "ready" ? (
        <AdminDashboardContent
          summary={state.data}
        />
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

function AdminDashboardContent({
  summary
}: {
  summary: AdminPerformanceSummary;
}) {
  return (
    <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <UhoPerformanceCard ordersKpi={summary.ordersKpi} />
        <AttendanceHealthCard attendance={summary.attendance} />
      </div>

      <AdminDashboardTicketsCard ticketsSummary={summary.ticketsSummary} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <AdminAreaManagersRankingTable
          ranking={summary.areaManagersRanking}
        />
        <AdminChampsRankingTable
          ranking={summary.champsRanking}
        />
      </div>

      <AdminDashboardBranchesTable
        ranking={summary.branchesRanking}
      />

      <AdminDashboardTopPickersTable topPickers={summary.topPickers} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4" role="status">
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard className="h-[260px]" />
        <SkeletonCard className="h-[260px]" />
      </div>
      <SkeletonCard className="h-[150px]" />
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard className="h-[330px]" />
        <SkeletonCard className="h-[330px]" />
      </div>
      <SkeletonCard className="h-[360px]" />
      <SkeletonCard className="h-[360px]" />
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
  current: AdminPerformanceSummary["filters"]["chains"],
  incoming: AdminPerformanceSummary["filters"]["chains"]
) {
  const byId = new Map(current.map((chain) => [chain.chainId, chain]));

  for (const chain of incoming) {
    byId.set(chain.chainId, chain);
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.chainName.localeCompare(right.chainName)
  );
}

function mergeBranchOptions(
  current: AdminDashboardBranchOption[],
  incoming: AdminDashboardBranchOption[]
) {
  const byId = new Map(current.map((branch) => [branch.vendorId, branch]));

  for (const branch of incoming) {
    byId.set(branch.vendorId, branch);
  }

  return Array.from(byId.values()).sort((left, right) => {
    const chainComparison = left.chainName.localeCompare(right.chainName);
    return chainComparison === 0
      ? left.vendorName.localeCompare(right.vendorName)
      : chainComparison;
  });
}
