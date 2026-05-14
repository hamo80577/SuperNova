"use client";

import { ChevronDown, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import { requestsApi, type RequestSummary, type RequestType } from "@/lib/api/requests";
import { RequestFilters } from "./request-filters";
import { RequestOperationCard } from "./request-operation-card";
import { RequestDetailModal } from "../detail/request-detail-modal";
import { getAllowedNewHireTargetRoles } from "../forms/new-hire/new-hire-utils";
import { NewRequestMenu } from "../forms/new-request-menu";
import { NewRequestSheet } from "../forms/new-request-sheet";
import { EmptyState } from "../shared/request-empty-state";
import { ErrorState, LoadingState } from "../shared/request-states";
import { type NewRequestDraft, type OperationsMode } from "../shared/request-types";

export function RequestsCenter() {
  return <RequestOperationsCenter defaultMode="action" />;
}

export function RequestOperationsCenter({
  defaultMode = "action"
}: {
  defaultMode?: OperationsMode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<OperationsMode>(defaultMode);
  const [items, setItems] = useState<RequestSummary[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RequestType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRequestMenuOpen, setNewRequestMenuOpen] = useState(false);
  const [newRequestDraft, setNewRequestDraft] = useState<NewRequestDraft | null>(
    null
  );

  const requestId = searchParams.get("requestId");
  const canCreateLifecycleRequest = user?.role !== "PICKER";
  const allowedNewHireTargetRoles = useMemo(
    () => getAllowedNewHireTargetRoles(user?.role, false),
    [user?.role]
  );

  async function loadOperations() {
    setLoading(true);
    setError(null);
    try {
      const [approvalResponse, requestResponse] = await Promise.all([
        approvalsApi.pending(),
        mode === "submitted"
          ? requestsApi.mySubmitted({ pageSize: 60, type, q: query })
          : requestsApi.list({ pageSize: 60, type, q: query })
      ]);
      setApprovals(approvalResponse.items);
      setItems(requestResponse.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load request operations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOperations();
  }, [mode, type]);

  const actionRequestIds = useMemo(
    () => new Set(approvals.map((approval) => approval.request.id)),
    [approvals]
  );

  const visibleRequests = useMemo(() => {
    const approvalCards = approvals.map((approval) => ({
      approval,
      request: approval.request,
      actionRequired: true
    }));
    const requestCards = items
      .filter((request) => !actionRequestIds.has(request.id))
      .map((request) => ({ approval: null, request, actionRequired: false }));
    const allCards =
      mode === "action"
        ? approvalCards
        : mode === "submitted"
          ? requestCards
          : [...approvalCards, ...requestCards];

    return allCards.filter(({ request, actionRequired }) => {
      const matchesQuery = query.trim()
        ? [
            request.createdBy.nameEn,
            request.targetUser?.nameEn,
            request.sourceVendor?.vendorName,
            request.destinationVendor?.vendorName,
            request.sourceChain?.chainName,
            request.destinationChain?.chainName
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(query.trim().toLowerCase())
            )
        : true;
      const matchesMode =
        mode === "action"
          ? actionRequired
          : mode === "submitted"
            ? true
            : mode === "open"
              ? !["COMPLETED", "REJECTED", "CANCELLED"].includes(request.status)
              : mode === "completed"
                ? request.status === "COMPLETED"
                : request.status === "REJECTED" || request.status === "CANCELLED";

      return matchesQuery && matchesMode;
    });
  }, [actionRequestIds, approvals, items, mode, query]);

  function openRequest(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("requestId", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  function closeRequest() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("requestId");
    const serialized = next.toString();
    router.push(serialized ? `${pathname}?${serialized}` : pathname);
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[1.35rem] border border-orange-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="grid gap-4 border-b border-slate-100 p-4 sm:p-5 lg:grid-cols-[1fr_auto]">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              Request operations room
            </Badge>
            <h1 className="mt-3 text-xl font-semibold tracking-normal text-slate-950">
              Tickets Control Center
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Review lifecycle tickets, act on approvals, and open details without
              leaving the current workspace.
            </p>
          </div>
          {canCreateLifecycleRequest ? (
            <div className="relative flex flex-wrap items-center gap-2">
              <Button
                className="h-11 rounded-xl bg-orange-600 hover:bg-orange-700"
                onClick={() => setNewRequestMenuOpen((open) => !open)}
                type="button"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Request
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {newRequestMenuOpen ? (
                <NewRequestMenu
                  allowedNewHireTargetRoles={allowedNewHireTargetRoles}
                  onSelect={(draft) => {
                    setNewRequestMenuOpen(false);
                    setNewRequestDraft(draft);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <RequestFilters
          mode={mode}
          onApply={() => void loadOperations()}
          onModeChange={setMode}
          onQueryChange={setQuery}
          onTypeChange={setType}
          query={query}
          type={type}
        />
      </section>

      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <LoadingState label="Loading request operations" />
      ) : visibleRequests.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleRequests.map(({ approval, request, actionRequired }) => (
            <RequestOperationCard
              actionRequired={actionRequired}
              approval={approval}
              key={`${request.id}:${approval?.id ?? "request"}`}
              onOpen={() => openRequest(request.id)}
              request={request}
            />
          ))}
        </div>
      ) : (
        <EmptyState message="No request cards match the current view." />
      )}

      {requestId ? (
        <RequestDetailModal
          onChanged={async () => {
            await loadOperations();
          }}
          onClose={closeRequest}
          requestId={requestId}
        />
      ) : null}

      {newRequestDraft && canCreateLifecycleRequest ? (
        <NewRequestSheet
          draft={newRequestDraft}
          onClose={() => setNewRequestDraft(null)}
          onCreated={(request) => {
            setNewRequestDraft(null);
            void loadOperations();
            openRequest(request.id);
          }}
        />
      ) : null}
    </div>
  );
}
