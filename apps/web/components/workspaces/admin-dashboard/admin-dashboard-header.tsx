"use client";

import { CalendarDays, GitBranch, Store } from "lucide-react";

import { Select } from "@/components/ui/select";
import type { AdminPerformanceSummary } from "@/lib/api/admin-performance";
import {
  adminDashboardRangeOptions,
  formatDateRangeLabel,
  type AdminDashboardBranchOption,
  type AdminDashboardRangeKey
} from "./admin-dashboard-utils";

const allValue = "__all__";

export function AdminDashboardHeader({
  branchOptions,
  chainOptions,
  dateFrom,
  dateTo,
  loading,
  onBranchChange,
  onChainChange,
  onRangeChange,
  rangeKey,
  selectedChainId,
  selectedVendorId
}: {
  branchOptions: AdminDashboardBranchOption[];
  chainOptions: AdminPerformanceSummary["filters"]["chains"];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  onBranchChange: (vendorId: string | undefined) => void;
  onChainChange: (chainId: string | undefined) => void;
  onRangeChange: (rangeKey: AdminDashboardRangeKey) => void;
  rangeKey: AdminDashboardRangeKey;
  selectedChainId: string | undefined;
  selectedVendorId: string | undefined;
}) {
  return (
    <header className="grid min-w-0 gap-3 rounded-[18px] border border-[color:var(--sn-border)] bg-white/80 p-4 shadow-[0_1px_2px_rgba(65,21,23,0.04)] backdrop-blur sm:grid-cols-[minmax(0,1fr)_minmax(360px,auto)] sm:items-start sm:p-5">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-normal text-[color:var(--sn-ink)] sm:text-[34px]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
          Admin performance overview
        </p>
        <p className="mt-1 text-xs text-[color:var(--sn-faint)]">
          {formatDateRangeLabel(dateFrom, dateTo)}
        </p>
      </div>

      <div className="grid min-w-0 gap-2 sm:w-[560px] sm:grid-cols-3">
        <Select
          aria-label="Select chain"
          className="h-10 rounded-xl bg-white text-sm sm:h-12"
          disabled={loading || chainOptions.length === 0}
          leadingIcon={<GitBranch className="h-4 w-4" />}
          onChange={(event) =>
            onChainChange(
              event.target.value === allValue ? undefined : event.target.value
            )
          }
          value={selectedChainId ?? allValue}
        >
          <option value={allValue}>All Chains</option>
          {chainOptions.map((chain) => (
            <option key={chain.chainId} value={chain.chainId}>
              {chain.chainName}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Select branch"
          className="h-10 rounded-xl bg-white text-sm sm:h-12"
          disabled={loading || branchOptions.length === 0}
          leadingIcon={<Store className="h-4 w-4" />}
          onChange={(event) =>
            onBranchChange(
              event.target.value === allValue ? undefined : event.target.value
            )
          }
          value={selectedVendorId ?? allValue}
        >
          <option value={allValue}>All Branches</option>
          {branchOptions.map((branch) => (
            <option key={branch.vendorId} value={branch.vendorId}>
              {branch.vendorName}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Select date range"
          className="h-10 rounded-xl bg-white text-sm sm:h-12"
          leadingIcon={<CalendarDays className="h-4 w-4" />}
          onChange={(event) =>
            onRangeChange(event.target.value as AdminDashboardRangeKey)
          }
          value={rangeKey}
        >
          {adminDashboardRangeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </header>
  );
}
