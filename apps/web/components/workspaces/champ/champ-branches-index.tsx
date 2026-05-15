"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { workspacesApi } from "@/lib/api/workspaces";
import { replaceRoute } from "@/lib/navigation";
import { BranchCard } from "./champ-branch-card";
import {
  EmptyState,
  LoadingCard,
  useAsyncData,
  WorkspaceState
} from "./champ-branch-states";

export function ChampBranchesIndex() {
  const router = useRouter();
  const state = useAsyncData(workspacesApi.champBranches);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    if (state.status === "ready" && state.data.branches.length === 1) {
      replaceRoute(router, `/champ/branches/${state.data.branches[0].vendor.id}`);
    }
  }, [router, state]);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} label="Loading assigned Branches" />;
  }

  if (state.data.branches.length === 1) {
    return <LoadingCard label="Opening your Branch" />;
  }

  const branches = state.data.branches.filter((branch) => {
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
  });

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge
              className="border-orange-200 bg-orange-50 text-orange-700"
              variant="outline"
            >
              Champ workspace
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              My Branches
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose a Branch workspace to manage Pickers and request actions.
            </p>
          </div>
          <label className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-xl pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Branches"
              value={query}
            />
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
        <EmptyState message="No assigned Branches match the current search." />
      )}
    </div>
  );
}
