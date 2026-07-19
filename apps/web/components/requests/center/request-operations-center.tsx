"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { SnIcon } from "@/components/sn/sn-icon";
import { SnAvatar, SnStatusBadge, SnTypeChip } from "@/components/sn/sn-primitives";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import {
  requestsApi,
  type RequestSummary,
  type RequestType
} from "@/lib/api/requests";
import type { UserRole } from "@/lib/auth/types";
import {
  RequestQuickActions,
  RequestQuickDecisionDialog,
  type QuickApprovalDecision
} from "../actions/request-quick-actions";
import { RequestDetailModal } from "../detail/request-detail-modal";
import { getAllowedNewHireTargetRoles } from "../forms/new-hire/new-hire-utils";
import { NewRequestMenu } from "../forms/new-request-menu";
import { NewRequestSheet } from "../forms/new-request-sheet";
import { EmptyState } from "../shared/request-empty-state";
import { ErrorState, LoadingState } from "../shared/request-states";
import { type NewRequestDraft, type OperationsMode } from "../shared/request-types";
import {
  canRenderNewRequestSheet,
  isClosedRequestForOperations,
  isCompletedRequestForOperations,
  requestTypeFilters
} from "./request-operations-center-rules";

const ROLE_LABELS: Record<UserRole, string> = {
  PICKER: "Picker",
  CHAMP: "Champ",
  AREA_MANAGER: "Area Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin"
};

const TYPE_LABELS: Record<RequestType, string> = {
  NEW_HIRE: "New Hire",
  RESIGNATION: "Resignation",
  TRANSFER: "Transfer",
  DEDUCTION: "Deduction",
  ANNUAL_LEAVE: "Annual Leave"
};

function compactAge(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function shortId(id: string) {
  return `#${id.slice(-5).toUpperCase()}`;
}

function roleLabel(role?: UserRole) {
  return role ? ROLE_LABELS[role] ?? role : "";
}

function branchLabel(request: RequestSummary) {
  const source = request.sourceVendor?.vendorName ?? request.sourceChain?.chainName;
  const destination =
    request.destinationVendor?.vendorName ?? request.destinationChain?.chainName;
  if (source && destination && destination !== source) {
    return `${source} → ${destination}`;
  }
  return source ?? destination ?? "—";
}

function targetName(request: RequestSummary) {
  return request.targetUser?.nameEn ?? request.createdBy.nameEn;
}

function targetRoleLabel(request: RequestSummary) {
  return roleLabel(request.targetUser?.role ?? request.createdBy.role);
}

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
  const [quickDecision, setQuickDecision] =
    useState<QuickApprovalDecision | null>(null);

  const requestId = searchParams.get("requestId");
  const canCreateLifecycleRequest = user?.role !== "PICKER";
  const canRequestAnnualLeave =
    user?.role === "PICKER" || user?.role === "CHAMP";
  const canOpenNewRequestMenu =
    canCreateLifecycleRequest || canRequestAnnualLeave;
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
              ? !isClosedRequestForOperations(request)
              : mode === "completed"
                ? isCompletedRequestForOperations(request)
                : request.status === "REJECTED" || request.status === "CANCELLED";

      return matchesQuery && matchesMode;
    });
  }, [actionRequestIds, approvals, items, mode, query]);

  const viewCounts = useMemo(() => {
    const open = items.filter(
      (request) => !isClosedRequestForOperations(request)
    ).length;
    return { needsMe: approvals.length, open };
  }, [approvals, items]);

  const views: Array<{ mode: OperationsMode; label: string; count?: number }> = [
    { mode: "action", label: "Needs me", count: viewCounts.needsMe },
    { mode: "open", label: "All open", count: viewCounts.open },
    { mode: "submitted", label: "Submitted" },
    { mode: "completed", label: "Completed" },
    { mode: "rejected", label: "Closed" }
  ];

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
    <div className="sn grid gap-3">
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canOpenNewRequestMenu ? (
          <div className="relative">
            <button
              className="sn-btn sn-btn-sm sn-btn-primary"
              onClick={() => setNewRequestMenuOpen((open) => !open)}
              type="button"
            >
              <SnIcon name="plus" size={13} />
              New request
              <SnIcon name="chevD" size={12} />
            </button>
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

      {/* Saved-view tabs */}
      <div className="overflow-x-auto">
        <div className="sn-views">
          {views.map((view) => (
            <button
              className={`sn-view${mode === view.mode ? " is-active" : ""}`}
              key={view.mode}
              onClick={() => setMode(view.mode)}
              type="button"
            >
              {view.label}
              {typeof view.count === "number" ? (
                <span className="n">{view.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="sn-filterbar">
        <label className="sn-input" style={{ width: 260, height: 32 }}>
          <SnIcon name="search" size={13} style={{ color: "var(--sn-faint)" }} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, Shopper ID, IBS ID…"
            value={query}
          />
        </label>
        {requestTypeFilters.map((filterType) => (
          <button
            className={`sn-chip${type === filterType ? " is-active" : ""}`}
            key={filterType}
            onClick={() =>
              setType((current) => (current === filterType ? "" : filterType))
            }
            type="button"
          >
            {type === filterType ? null : "+ "}
            {TYPE_LABELS[filterType]}
            {type === filterType ? <span className="x">×</span> : null}
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <LoadingState label="Loading request operations" />
      ) : visibleRequests.length ? (
        <>
          {/* Desktop table */}
          <div className="sn-card hidden overflow-hidden lg:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Target</th>
                  <th>Branch / Chain</th>
                  <th>Status</th>
                  <th>Created by</th>
                  <th>Age</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map(({ approval, request }) => (
                  <tr
                    className="cursor-pointer"
                    key={request.id}
                    onClick={() => openRequest(request.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRequest(request.id);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td>
                      <span className="flex items-center gap-2">
                        <SnTypeChip type={request.type} />
                        <span
                          className="sn-mono"
                          style={{ color: "var(--sn-muted)", fontSize: 12 }}
                        >
                          {shortId(request.id)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <SnAvatar name={targetName(request)} />
                        <span className="grid gap-0">
                          <span className="font-semibold text-[color:var(--sn-ink)]">
                            {targetName(request)}
                          </span>
                          <span className="text-[11px] text-[color:var(--sn-muted)]">
                            {targetRoleLabel(request)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{branchLabel(request)}</td>
                    <td>
                      <SnStatusBadge status={request.status} />
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {request.createdBy.nameEn}
                      <div className="text-[11px] text-[color:var(--sn-muted)]">
                        {roleLabel(request.createdBy.role)}
                      </div>
                    </td>
                    <td className="sn-mono" style={{ color: "var(--sn-muted)" }}>
                      {compactAge(request.createdAt)}
                    </td>
                    <td className="text-right">
                      <RequestQuickActions
                        approval={approval}
                        onDecision={setQuickDecision}
                        onOpenDetails={() => openRequest(request.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-2 lg:hidden">
            {visibleRequests.map(({ actionRequired, approval, request }) => (
              <article
                className="sn-card grid cursor-pointer gap-2 p-3 text-left transition hover:border-[#FFD8BD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]"
                key={request.id}
                onClick={() => openRequest(request.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openRequest(request.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <SnTypeChip type={request.type} />
                    <span className="sn-mono text-[10.5px] text-[color:var(--sn-faint)]">
                      {shortId(request.id)}
                    </span>
                  </span>
                  <SnStatusBadge status={request.status} />
                </div>
                <div className="grid gap-0">
                  <span className="truncate font-semibold text-[color:var(--sn-ink)]">
                    {targetName(request)}{" "}
                    <span className="font-normal text-[color:var(--sn-muted)]">
                      · {targetRoleLabel(request)}
                    </span>
                  </span>
                  <span className="truncate text-[11.5px] text-[color:var(--sn-muted)]">
                    {branchLabel(request)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[color:var(--sn-border)] pt-1.5">
                  <span className="min-w-0 truncate text-[11px] text-[color:var(--sn-muted)]">
                    {request.createdBy.nameEn} · {roleLabel(request.createdBy.role)}
                  </span>
                  <span className="sn-mono shrink-0 text-[11px] text-[color:var(--sn-faint)]">
                    {compactAge(request.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-medium text-[color:var(--sn-muted)]">
                    {actionRequired ? "Action required" : "Review ticket"}
                  </span>
                  <RequestQuickActions
                    approval={approval}
                    className="max-w-[260px]"
                    isMobile
                    onDecision={setQuickDecision}
                    onOpenDetails={() => openRequest(request.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState message="No request cards match the current view." />
      )}

      {quickDecision ? (
        <RequestQuickDecisionDialog
          decision={quickDecision}
          onChanged={loadOperations}
          onClose={() => setQuickDecision(null)}
        />
      ) : null}

      {requestId ? (
        <RequestDetailModal
          onChanged={async () => {
            await loadOperations();
          }}
          onClose={closeRequest}
          requestId={requestId}
        />
      ) : null}

      {newRequestDraft &&
      canRenderNewRequestSheet({
        draftType: newRequestDraft.type,
        userRole: user?.role
      }) ? (
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
