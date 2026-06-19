"use client";

import { CalendarDays, Store } from "lucide-react";

import { Select } from "@/components/ui/select";
import {
  areaManagerRangeOptions,
  formatDateRangeLabel,
  type AreaManagerRangeKey
} from "./area-manager-dashboard-utils";

export interface AreaManagerChainOption {
  chainId: string;
  chainName: string;
}

const allChainsValue = "__all__";

export function AreaManagerDashboardHeader({
  chainOptions,
  dateFrom,
  dateTo,
  loading,
  onChainChange,
  onRangeChange,
  rangeKey,
  selectedChainId
}: {
  chainOptions: AreaManagerChainOption[];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  onChainChange: (chainId: string | undefined) => void;
  onRangeChange: (rangeKey: AreaManagerRangeKey) => void;
  rangeKey: AreaManagerRangeKey;
  selectedChainId: string | undefined;
}) {
  return (
    <header className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-normal text-[color:var(--sn-ink)] sm:text-[32px]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
          Area performance overview
        </p>
        <p className="mt-1 text-xs text-[color:var(--sn-faint)]">
          {formatDateRangeLabel(dateFrom, dateTo)}
        </p>
      </div>

      <div className="grid min-w-0 gap-2 sm:w-[420px] sm:grid-cols-2">
        <Select
          aria-label="Select chain"
          className="h-10 rounded-xl bg-white text-sm sm:h-11"
          disabled={loading || chainOptions.length === 0}
          leadingIcon={<Store className="h-4 w-4" />}
          onChange={(event) =>
            onChainChange(
              event.target.value === allChainsValue
                ? undefined
                : event.target.value
            )
          }
          value={selectedChainId ?? allChainsValue}
        >
          <option value={allChainsValue}>All Chains</option>
          {chainOptions.map((chain) => (
            <option key={chain.chainId} value={chain.chainId}>
              {chain.chainName}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Select date range"
          className="h-10 rounded-xl bg-white text-sm sm:h-11"
          leadingIcon={<CalendarDays className="h-4 w-4" />}
          onChange={(event) =>
            onRangeChange(event.target.value as AreaManagerRangeKey)
          }
          value={rangeKey}
        >
          {areaManagerRangeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </header>
  );
}
