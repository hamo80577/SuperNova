"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SnIcon, type SnIconName } from "@/components/sn/sn-icon";
import {
  SnAvatar,
  SnTypeChip
} from "@/components/sn/sn-primitives";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import {
  requestsApi,
  type RequestSummary,
  type RequestType
} from "@/lib/api/requests";
import { workspacesApi, type AreaManagerWorkspace } from "@/lib/api/workspaces";
import type { UserRole } from "@/lib/auth/types";

const CLOSED_STATUSES = new Set(["COMPLETED", "REJECTED", "CANCELLED"]);

const ROLE_LABELS: Record<UserRole, string> = {
  PICKER: "Picker",
  CHAMP: "Champ",
  AREA_MANAGER: "Area Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin"
};

const CYCLE_ROWS: Array<{ label: string; type: RequestType }> = [
  { label: "New hires", type: "NEW_HIRE" },
  { label: "Transfers", type: "TRANSFER" },
  { label: "Resignations", type: "RESIGNATION" },
  { label: "Deductions", type: "DEDUCTION" }
];

const QUICK_ACTIONS: Array<{ label: string; icon: SnIconName }> = [
  { label: "New hire", icon: "plus" },
  { label: "Transfer", icon: "swap" },
  { label: "Resign", icon: "minus" },
  { label: "Deduct", icon: "doc" }
];

function greetingPart(hour: number) {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function compactAge(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function waitingLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days >= 1) return `Waiting ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return `Waiting ${Math.max(1, hours)}h`;
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
  const role = request.targetUser?.role ?? request.createdBy.role;
  return ROLE_LABELS[role] ?? role;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      workspace: AreaManagerWorkspace;
      pending: PendingApproval[];
      requests: RequestSummary[];
    };

export function AreaManagerCalmDashboard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      setState({ status: "loading" });
      try {
        const [workspace, pendingResponse, requestResponse] = await Promise.all([
          workspacesApi.areaManager(),
          approvalsApi.pending(),
          requestsApi.list({ pageSize: 60 })
        ]);
        if (!active) return;
        setState({
          status: "ready",
          workspace,
          pending: pendingResponse.items,
          requests: requestResponse.items
        });
      } catch (caughtError) {
        if (!active) return;
        setState({
          status: "error",
          message:
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load your workspace."
        });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const oldestPending = useMemo(() => {
    if (state.status !== "ready" || !state.pending.length) return null;
    return [...state.pending].sort(
      (a, b) =>
        new Date(a.request.createdAt).getTime() -
        new Date(b.request.createdAt).getTime()
    )[0];
  }, [state]);

  const weeklyCounts = useMemo(() => {
    const counts: Record<RequestType, number> = {
      NEW_HIRE: 0,
      RESIGNATION: 0,
      TRANSFER: 0,
      DEDUCTION: 0
    };
    if (state.status !== "ready") return counts;
    const weekAgo = Date.now() - 7 * 86_400_000;
    for (const request of state.requests) {
      if (new Date(request.createdAt).getTime() >= weekAgo) {
        counts[request.type] += 1;
      }
    }
    return counts;
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="sn grid place-items-center rounded-[16px] border border-[color:var(--sn-border)] bg-white py-16 text-sm text-[color:var(--sn-muted)]">
        Loading your workspace…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="sn rounded-[16px] border border-[color:var(--sn-border)] bg-white p-6 text-sm text-[color:var(--sn-danger)]">
        {state.message}
      </div>
    );
  }

  const { workspace, pending } = state;
  const firstName = workspace.areaManager.nameEn.split(" ")[0] ?? "there";
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  const openCount = state.requests.filter(
    (request) => !CLOSED_STATUSES.has(request.status)
  ).length;

  const stats: Array<{ label: string; value: number; hot?: boolean }> = [
    { label: "Pending approvals", value: pending.length, hot: true },
    { label: "Open requests", value: openCount },
    { label: "Active pickers", value: workspace.totals.activePickers },
    { label: "Branches", value: workspace.totals.vendors }
  ];

  const needsAction = pending.slice(0, 4);

  return (
    <div className="sn grid gap-3.5">
      {/* Greeting hero */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="sn-h1" style={{ fontSize: 22 }}>
            Good {greetingPart(now.getHours())}, {firstName}
          </h1>
          <span className="text-[12px] text-[color:var(--sn-muted)]">
            {dateLabel} · {workspace.totals.chains}{" "}
            {workspace.totals.chains === 1 ? "chain" : "chains"} under you
          </span>
        </div>
        <Link className="sn-btn sn-btn-primary" href="/tickets">
          <SnIcon name="plus" size={14} />
          New request
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="sn-card"
            key={stat.label}
            style={{
              padding: "13px 16px",
              borderTop: stat.hot ? "3px solid var(--tlb-orange)" : undefined
            }}
          >
            <div className="text-[11px] font-semibold text-[color:var(--sn-muted)]">
              {stat.label}
            </div>
            <div
              className="sn-num"
              style={{
                fontSize: 28,
                color: stat.hot ? "var(--tlb-orange)" : "var(--sn-ink)"
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile quick actions */}
      <div className="grid gap-2 lg:hidden">
        <div className="sn-label">Quick actions</div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              className="grid justify-items-center gap-1.5 rounded-[13px] border border-[color:var(--sn-border)] bg-white px-1 py-3"
              href="/tickets"
              key={action.label}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-[11px]"
                style={{ background: "#FFF3EB", color: "var(--tlb-orange)" }}
              >
                <SnIcon name={action.icon} size={16} />
              </span>
              <span className="text-[10.5px] font-semibold text-[color:var(--sn-ink)]">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column operational area */}
      <div className="grid items-start gap-3 lg:grid-cols-[1.7fr_1fr]">
        {/* Needs your action */}
        <div className="sn-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--sn-border)] px-4 py-2.5">
            <span className="sn-h2">Needs your action</span>
            <Link
              className="text-[12px] font-semibold text-[color:var(--tlb-orange)]"
              href="/tickets"
            >
              View all {pending.length} →
            </Link>
          </div>
          {needsAction.length ? (
            needsAction.map((approval) => (
              <div
                className="flex items-center gap-3 border-b border-[color:var(--sn-border)] px-4 py-2.5 last:border-b-0"
                key={approval.id}
              >
                <SnTypeChip compact type={approval.request.type} />
                <div className="grid min-w-0 flex-1 gap-0">
                  <span className="truncate text-[12.5px] font-semibold text-[color:var(--sn-ink)]">
                    {targetName(approval.request)}{" "}
                    <span className="font-normal text-[color:var(--sn-muted)]">
                      · {targetRoleLabel(approval.request)}
                    </span>
                  </span>
                  <span className="truncate text-[11px] text-[color:var(--sn-muted)]">
                    {branchLabel(approval.request)}
                  </span>
                </div>
                <span className="sn-mono text-[11px] text-[color:var(--sn-faint)]">
                  {compactAge(approval.request.createdAt)}
                </span>
                <Link
                  className="sn-btn sn-btn-sm sn-btn-primary"
                  href={`/tickets?requestId=${approval.request.id}`}
                >
                  Review
                </Link>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-[12.5px] text-[color:var(--sn-muted)]">
              You&apos;re all caught up — no approvals waiting on you.
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="grid gap-3">
          <div className="sn-card grid gap-2.5" style={{ padding: "13px 16px" }}>
            <span className="sn-h2" style={{ fontSize: 13 }}>
              This week&apos;s cycle
            </span>
            {CYCLE_ROWS.map((row) => (
              <div className="flex items-center justify-between" key={row.type}>
                <div className="flex items-center gap-2">
                  <SnTypeChip compact type={row.type} />
                  <span className="text-[12.5px]">{row.label}</span>
                </div>
                <span
                  className="sn-num"
                  style={{ fontSize: 15, color: "var(--sn-ink)" }}
                >
                  {weeklyCounts[row.type]}
                </span>
              </div>
            ))}
          </div>

          <div className="sn-card grid gap-2" style={{ padding: "13px 16px" }}>
            <span className="sn-h2" style={{ fontSize: 13 }}>
              Oldest waiting
            </span>
            {oldestPending ? (
              <div className="flex items-center gap-2.5">
                <SnAvatar name={targetName(oldestPending.request)} />
                <div className="grid min-w-0 flex-1 gap-0">
                  <span className="truncate text-[12.5px] font-semibold text-[color:var(--sn-ink)]">
                    {targetName(oldestPending.request)} ·{" "}
                    {targetRoleLabel(oldestPending.request)}
                  </span>
                  <span className="text-[11px] font-semibold text-[color:var(--sn-danger)]">
                    {waitingLabel(oldestPending.request.createdAt)}
                  </span>
                </div>
                <Link
                  className="sn-btn sn-btn-sm sn-btn-ghost"
                  href={`/tickets?requestId=${oldestPending.request.id}`}
                >
                  Open
                </Link>
              </div>
            ) : (
              <span className="text-[12px] text-[color:var(--sn-muted)]">
                Nothing waiting right now.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
