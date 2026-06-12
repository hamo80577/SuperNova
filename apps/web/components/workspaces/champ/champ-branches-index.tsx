"use client";

import { ListFilter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { type ChampBranch, workspacesApi } from "@/lib/api/workspaces";
import { replaceRoute } from "@/lib/navigation";
import { BranchCard } from "./champ-branch-card";
import {
  EmptyState,
  useAsyncData,
  WorkspaceState
} from "./champ-branch-states";

type BranchSort =
  | "DEFAULT"
  | "BRANCH_NAME"
  | "MOST_PICKERS"
  | "MOST_PENDING"
  | "CHAIN_NAME";

const sortLabels: Record<BranchSort, string> = {
  DEFAULT: "Default",
  BRANCH_NAME: "Branch name A-Z",
  MOST_PICKERS: "Most Pickers",
  MOST_PENDING: "Most Pending Requests",
  CHAIN_NAME: "Chain name A-Z"
};

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});
const emptyBranches: ChampBranch[] = [];

export function ChampBranchesIndex() {
  const router = useRouter();
  const state = useAsyncData(workspacesApi.champBranches);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BranchSort>("DEFAULT");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    if (state.status === "ready" && state.data.branches.length === 1) {
      replaceRoute(router, `/champ/branches/${state.data.branches[0].vendor.id}`);
    }
  }, [router, state]);

  const sourceBranches =
    state.status === "ready" ? state.data.branches : emptyBranches;
  const branches = useMemo(
    () =>
      sortBranches(
        sourceBranches.filter((branch) => {
          if (!deferredQuery) {
            return true;
          }

          return [
            branch.vendor.vendorName,
            branch.vendor.vendorCode,
            branch.chain.chainName,
            branch.vendor.area,
            branch.vendor.city
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(deferredQuery));
        }),
        sort
      ),
    [deferredQuery, sort, sourceBranches]
  );

  if (state.status !== "ready") {
    return <WorkspaceState quiet state={state} label="Loading assigned Branches" />;
  }

  if (state.data.branches.length === 1) {
    return null;
  }

  return (
    <div className="grid gap-5">
      <section className="flex justify-center md:justify-end">
        <div className="flex w-full max-w-3xl flex-col gap-2 md:flex-row md:items-center md:justify-end md:gap-3">
          <label className="relative min-w-0 md:flex-1">
            <span className="sr-only">Search branches</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--tlb-orange)]" />
            <Input
              className="h-11 rounded-xl border-[color:var(--sn-border)] bg-white/80 pl-9 shadow-sm placeholder:text-[color:var(--sn-faint)] focus-visible:border-[#FFD8BD] focus-visible:ring-[#FFE8D9]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branches"
              value={query}
            />
          </label>
          <label className="relative min-w-0 md:w-64">
            <span className="sr-only">Sort branches</span>
            <Select
              aria-label="Sort branches"
              leadingIcon={<ListFilter className="h-4 w-4" />}
              onChange={(event) => setSort(event.target.value as BranchSort)}
              value={sort}
            >
              {(Object.keys(sortLabels) as BranchSort[]).map((option) => (
                <option key={option} value={option}>
                  {sortLabels[option]}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </section>

      {branches.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard branch={branch} key={branch.assignment.id} />
          ))}
        </section>
      ) : (
        <EmptyState compact message="No branches match this search. Try a branch name, code, chain, area, or city." />
      )}
    </div>
  );
}

function sortBranches(branches: ChampBranch[], sort: BranchSort) {
  const sorted = [...branches];

  if (sort === "BRANCH_NAME") {
    return sorted.sort((first, second) =>
      textCollator.compare(first.vendor.vendorName, second.vendor.vendorName)
    );
  }

  if (sort === "MOST_PICKERS") {
    return sorted.sort(
      (first, second) => second.activePickerCount - first.activePickerCount
    );
  }

  if (sort === "MOST_PENDING") {
    return sorted.sort(
      (first, second) => second.pendingRequestCount - first.pendingRequestCount
    );
  }

  if (sort === "CHAIN_NAME") {
    return sorted.sort((first, second) =>
      textCollator.compare(first.chain.chainName, second.chain.chainName)
    );
  }

  return sorted;
}
