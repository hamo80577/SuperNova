"use client";

import { MinusCircle, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { NewRequestSheet } from "@/components/requests/forms/new-request-sheet";
import { type NewRequestDraft } from "@/components/requests/shared/request-types";
import { formatEnum } from "@/components/requests/shared/request-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deductionCaseStatusLabels,
  deductionPenaltyTypeLabels,
  deductionsApi,
  getAllowedDeductionTargetRoles,
  type ActiveDeductionPolicy,
  type DeductionCaseStatus,
  type DeductionCaseSummary,
  type DeductionListResponse
} from "@/lib/api/deductions";
import {
  currentMonthValue,
  DeductionStatusBadge,
  formatDate,
  formatDeductionDays,
  formatOrdinal
} from "./deduction-format";

type DeductionsListState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: DeductionListResponse; error?: never };

const statusFilterOptions: Array<{ label: string; value: "all" | DeductionCaseStatus }> = [
  { label: "All statuses", value: "all" },
  { label: deductionCaseStatusLabels.PENDING_APPROVAL, value: "PENDING_APPROVAL" },
  { label: deductionCaseStatusLabels.EFFECTIVE, value: "EFFECTIVE" },
  { label: deductionCaseStatusLabels.REJECTED, value: "REJECTED" },
  { label: deductionCaseStatusLabels.CANCELLED, value: "CANCELLED" }
];

export function DeductionsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonthValue);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [actionId, setActionId] = useState("all");
  const [status, setStatus] = useState<"all" | DeductionCaseStatus>("all");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<DeductionsListState>({ status: "loading" });
  const [policy, setPolicy] = useState<ActiveDeductionPolicy | null>(null);
  const [requestDraft, setRequestDraft] = useState<NewRequestDraft | null>(null);
  const [selectedCase, setSelectedCase] = useState<DeductionCaseSummary | null>(
    null
  );
  const [refreshToken, setRefreshToken] = useState(0);

  const canCreate = getAllowedDeductionTargetRoles(user?.role).length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let mounted = true;

    deductionsApi
      .activePolicy()
      .then((response) => {
        if (mounted) {
          setPolicy(response);
        }
      })
      .catch(() => {
        // Tolerable failure: the action filter is hidden without a policy.
        if (mounted) {
          setPolicy(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });

    deductionsApi
      .list({
        month,
        page,
        pageSize: 25,
        ...(debouncedQ ? { q: debouncedQ } : {}),
        ...(actionId !== "all" ? { actionId } : {}),
        ...(status !== "all" ? { status } : {})
      })
      .then((data) => {
        if (mounted) {
          setState({ data, status: "ready" });
        }
      })
      .catch((caughtError) => {
        if (mounted) {
          setState({
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load deductions.",
            status: "error"
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [actionId, debouncedQ, month, page, refreshToken, status]);

  const groups = useMemo(
    () =>
      state.status === "ready" ? groupByTarget(state.data.items) : [],
    [state]
  );

  function handleCreated() {
    setRequestDraft(null);
    setRefreshToken((current) => current + 1);
  }

  return (
    <main className="grid min-w-0 gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--sn-ink)]">
            Deduction records
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[color:var(--sn-muted)]">
            Occurrences are counted per calendar month from the active policy.
          </p>
        </div>
        {canCreate ? (
          <Button
            className="h-10 rounded-xl"
            onClick={() => setRequestDraft({ type: "DEDUCTION" })}
            type="button"
          >
            <MinusCircle className="mr-2 h-4 w-4" />
            New deduction
          </Button>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-xs font-medium text-[color:var(--sn-body)]">
          Month
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(1);
            }}
            type="month"
            value={month}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-medium text-[color:var(--sn-body)]">
          Search
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, Shopper ID, or IBS ID"
            type="search"
            value={q}
          />
        </label>
        {policy ? (
          <label className="grid min-w-0 gap-1 text-xs font-medium text-[color:var(--sn-body)]">
            Action
            <Select
              aria-label="Action filter"
              onChange={(event) => {
                setActionId(event.target.value);
                setPage(1);
              }}
              value={actionId}
            >
              <option value="all">All actions</option>
              {policy.actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label className="grid min-w-0 gap-1 text-xs font-medium text-[color:var(--sn-body)]">
          Status
          <Select
            aria-label="Status filter"
            onChange={(event) => {
              setStatus(event.target.value as "all" | DeductionCaseStatus);
              setPage(1);
            }}
            value={status}
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </section>

      {state.status === "loading" ? (
        <DeductionsLoadingSkeleton />
      ) : state.status === "error" ? (
        <div className="rounded-[16px] border border-[oklch(0.85_0.1_27)] bg-[oklch(0.95_0.035_27)] p-4 text-sm font-medium text-[oklch(0.55_0.19_27)]">
          {state.error}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              label="Effective this month"
              value={state.data.summary.effectiveCount}
            />
            <KpiCard label="Warnings" value={state.data.summary.warningCount} />
            <KpiCard
              label="Deduction days"
              value={Number(state.data.summary.deductionDaysTotal)}
            />
            <KpiCard
              label="Pending tickets"
              value={state.data.summary.pendingCount}
            />
          </section>

          {groups.length ? (
            <section className="grid gap-3">
              {groups.map((group) => (
                <TargetGroupCard
                  group={group}
                  key={group.targetId}
                  onSelect={setSelectedCase}
                />
              ))}
            </section>
          ) : (
            <div className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-6 text-center shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
              <p className="text-sm font-semibold text-[color:var(--sn-ink)]">
                No deduction records found.
              </p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
                Records appear here once Deduction tickets are created for this
                month and scope.
              </p>
            </div>
          )}

          <DeductionsPagination
            meta={state.data.meta}
            onPageChange={setPage}
          />
        </>
      )}

      {selectedCase ? (
        <DeductionDetailModal
          item={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      ) : null}

      {requestDraft ? (
        <NewRequestSheet
          draft={requestDraft}
          onClose={() => setRequestDraft(null)}
          onCreated={handleCreated}
        />
      ) : null}
    </main>
  );
}

type TargetGroup = {
  targetId: string;
  target: DeductionCaseSummary["target"];
  items: DeductionCaseSummary[];
  effectiveDays: number;
};

function groupByTarget(items: DeductionCaseSummary[]): TargetGroup[] {
  const groups = new Map<string, TargetGroup>();

  for (const item of items) {
    let group = groups.get(item.target.id);

    if (!group) {
      group = {
        effectiveDays: 0,
        items: [],
        target: item.target,
        targetId: item.target.id
      };
      groups.set(item.target.id, group);
    }

    group.items.push(item);

    if (item.status === "EFFECTIVE" && item.deductionDays !== null) {
      group.effectiveDays += Number(item.deductionDays);
    }
  }

  return [...groups.values()];
}

function TargetGroupCard({
  group,
  onSelect
}: {
  group: TargetGroup;
  onSelect: (item: DeductionCaseSummary) => void;
}) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--sn-border)] pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
            {group.target.nameEn}
          </h3>
          <Badge
            className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
            variant="outline"
          >
            {formatEnum(group.target.role)}
          </Badge>
          {group.target.shopperId ? (
            <span className="text-xs font-medium text-[color:var(--sn-muted)]">
              Shopper {group.target.shopperId}
            </span>
          ) : null}
        </div>
        <p className="shrink-0 text-xs font-semibold text-[color:var(--sn-muted)]">
          {group.items.length}{" "}
          {group.items.length === 1 ? "record" : "records"} ·{" "}
          {formatDeductionDays(group.effectiveDays)} days
        </p>
      </header>
      <ul className="divide-y divide-[color:var(--sn-border)]">
        {group.items.map((item) => (
          <DeductionRow item={item} key={item.id} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

function DeductionRow({
  item,
  onSelect
}: {
  item: DeductionCaseSummary;
  onSelect: (item: DeductionCaseSummary) => void;
}) {
  return (
    <li
      className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-1 py-3 transition hover:bg-[#FFE8D9]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]"
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span className="text-sm font-semibold text-[color:var(--sn-ink)]">
        {item.actionName}
      </span>
      <Badge
        className="border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
        variant="outline"
      >
        {formatOrdinal(item.occurrenceNumber)}
      </Badge>
      <span className="text-sm text-[color:var(--sn-body)]">{item.penaltyLabel}</span>
      <DeductionStatusBadge status={item.status} />
      <span className="text-xs font-medium text-[color:var(--sn-muted)]">
        {formatDate(item.incidentDate)}
      </span>
      <span className="ml-auto shrink-0 text-sm font-semibold text-primary">
        Details
      </span>
    </li>
  );
}

function DeductionDetailModal({
  item,
  onClose
}: {
  item: DeductionCaseSummary;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[120] grid place-items-end bg-[rgba(65,21,23,0.35)] p-0 sm:place-items-center sm:p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        role="dialog"
      >
        <section className="max-h-[94dvh] w-full overflow-hidden rounded-t-[1.75rem] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem]">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--sn-border)] p-4 sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                  variant="outline"
                >
                  {formatEnum(item.target.role)}
                </Badge>
                <DeductionStatusBadge status={item.status} />
              </div>
              <h2 className="mt-2 truncate text-lg font-semibold text-[color:var(--sn-ink)]">
                {item.target.nameEn}
              </h2>
            </div>
            <Button
              aria-label="Close deduction details"
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[calc(94dvh-88px)] overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden">
            <div className="grid gap-0">
              <DeductionDetailRow label="Action" value={item.actionName} />
              <DeductionDetailRow
                label="Occurrence"
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      Occurrence {item.occurrenceNumber} in {item.incidentMonth}
                    </span>
                    <Badge
                      className="border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
                      variant="outline"
                    >
                      {formatOrdinal(item.occurrenceNumber)}
                    </Badge>
                  </span>
                }
              />
              <DeductionDetailRow
                label="Penalty"
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{item.penaltyLabel}</span>
                    <Badge
                      className="border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
                      variant="outline"
                    >
                      {deductionPenaltyTypeLabels[item.penaltyType]}
                    </Badge>
                    {item.deductionDays !== null ? (
                      <span className="text-[color:var(--sn-body)]">
                        {formatDeductionDays(Number(item.deductionDays))}{" "}
                        {Number(item.deductionDays) === 1 ? "day" : "days"}
                      </span>
                    ) : null}
                  </span>
                }
              />
              <DeductionDetailRow
                label="Incident date"
                value={formatDate(item.incidentDate)}
              />
              <DeductionDetailRow
                label="Policy version"
                value={
                  item.policyVersionNumber !== null
                    ? `Version ${item.policyVersionNumber}`
                    : "Not available"
                }
              />
              <DeductionDetailRow
                label="Branch"
                value={item.source.vendorName ?? "Not available"}
              />
              <DeductionDetailRow
                label="Chain"
                value={item.source.chainName ?? "Not available"}
              />
              <DeductionDetailRow
                copyValue={item.target.shopperId}
                label="Shopper ID"
                value={item.target.shopperId ?? "Not available"}
              />
              <DeductionDetailRow
                label="Created by"
                value={`${item.createdBy.nameEn} · ${formatEnum(item.createdBy.role)}`}
              />
              <DeductionDetailRow
                label="Created at"
                value={formatDateTime(item.createdAt)}
              />
              {item.finalApprovedAt ? (
                <DeductionDetailRow
                  label="Final approved at"
                  value={formatDateTime(item.finalApprovedAt)}
                />
              ) : null}
              <DeductionDetailRow
                label="Reason"
                value={item.reason ?? "Not provided"}
              />
              <DeductionDetailRow label="Notes" value={item.notes ?? "None"} />
            </div>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function DeductionDetailRow({
  copyValue,
  label,
  value
}: {
  copyValue?: string | null;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-[color:var(--sn-border)] py-2.5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <span className="text-xs font-medium text-[color:var(--sn-muted)]">{label}</span>
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-medium text-[color:var(--sn-ink)]">
          {value}
        </span>
        {copyValue ? (
          <CopyButton
            aria-label={`Copy ${label}`}
            iconOnly
            size="sm"
            text={copyValue}
          />
        ) : null}
      </span>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <p className="text-xs font-medium text-[color:var(--sn-muted)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-data)] text-2xl font-semibold text-[color:var(--sn-ink)]">
        {formatDeductionDays(value)}
      </p>
    </article>
  );
}

function DeductionsPagination({
  meta,
  onPageChange
}: {
  meta: DeductionListResponse["meta"];
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, meta.totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <p className="text-sm font-medium text-[color:var(--sn-muted)]">
        Page {meta.page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          className="h-9 rounded-xl"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          className="h-9 rounded-xl"
          disabled={meta.page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, meta.page + 1))}
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function DeductionsLoadingSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4" role="status">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]"
            key={index}
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  });
}
