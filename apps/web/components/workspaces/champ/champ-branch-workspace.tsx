"use client";

import { ArrowLeft, ChevronDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { RequestDetailModal } from "@/components/requests/request-components";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { OperationalUserProfileModal } from "@/components/users/operational-user-profile-modal";
import { type ScopedPicker, workspacesApi } from "@/lib/api/workspaces";
import { pushRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BranchActionMenu } from "./champ-branch-action-menu";
import { BranchPickers } from "./champ-branch-pickers";
import { BranchRequests } from "./champ-branch-requests";
import {
  useAsyncData,
  WorkspaceState
} from "./champ-branch-states";
import type { BranchTab } from "./champ-branch-types";

export function ChampBranchWorkspace() {
  const params = useParams<{ vendorId: string }>();
  const router = useRouter();
  const [reloadVersion, setReloadVersion] = useState(0);
  const loadBranch = useCallback(
    () => workspacesApi.champBranchDetail(params.vendorId),
    [params.vendorId]
  );
  const branchState = useAsyncData(loadBranch, reloadVersion);
  const branchesState = useAsyncData(workspacesApi.champBranches);
  const [activeTab, setActiveTab] = useState<BranchTab>("Pickers");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedPicker, setSelectedPicker] = useState<ScopedPicker | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  if (branchState.status !== "ready") {
    return <WorkspaceState state={branchState} label="Loading Branch workspace" />;
  }

  const branch = branchState.data;
  const allBranches =
    branchesState.status === "ready" ? branchesState.data.branches : [];

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Link
              className="mb-3 inline-flex items-center text-sm font-medium text-primary"
              href="/champ/branches"
              prefetch
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              My Branches
            </Link>
            <h1 className="truncate text-3xl font-semibold tracking-normal text-slate-950">
              {branch.vendor.vendorName}
            </h1>
            <p className="mt-1 text-base font-medium text-slate-500">
              {branch.chain.chainName}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {allBranches.length > 1 ? (
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Switch Branch
                <Select
                  aria-label="Switch Branch"
                  className="h-11 min-w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
                  onChange={(event) =>
                    pushRoute(router, `/champ/branches/${event.target.value}`)
                  }
                  value={branch.vendor.id}
                >
                  {allBranches.map((item) => (
                    <option key={item.vendor.id} value={item.vendor.id}>
                      {item.vendor.vendorName}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            <div className="relative">
              <Button
                className="h-11 w-full rounded-xl sm:w-auto"
                onClick={() => setActionMenuOpen((current) => !current)}
                type="button"
              >
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {actionMenuOpen ? (
                <BranchActionMenu
                  branch={branch}
                  onClose={() => setActionMenuOpen(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          {(["Pickers", "Requests"] as const).map((tab) => (
            <button
              aria-pressed={activeTab === tab}
              className={cn(
                "h-11 rounded-xl px-3 text-sm font-semibold transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:bg-slate-50"
              )}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "Pickers" ? (
        <BranchPickers
          pickers={branch.pickers}
          onOpenPicker={(picker) => setSelectedPicker(picker)}
        />
      ) : null}
      {activeTab === "Requests" ? (
        <BranchRequests
          onOpenRequest={setSelectedRequestId}
          requests={branch.recentRequests}
        />
      ) : null}

      {selectedPicker ? (
        <OperationalUserProfileModal
          actions={{
            onTransfer: (user) => {
              setSelectedPicker(null);
              pushRoute(
                router,
                `/champ/branches/${branch.vendor.id}/transfer?pickerId=${user.id}`
              );
            },
            onResignation: (user) => {
              setSelectedPicker(null);
              pushRoute(
                router,
                `/champ/branches/${branch.vendor.id}/resignation?pickerId=${user.id}`
              );
            }
          }}
          onClose={() => setSelectedPicker(null)}
          userId={selectedPicker.picker.id}
        />
      ) : null}

      {selectedRequestId ? (
        <RequestDetailModal
          onChanged={async () => {
            setReloadVersion((current) => current + 1);
          }}
          onClose={() => setSelectedRequestId(null)}
          requestId={selectedRequestId}
        />
      ) : null}
    </div>
  );
}
