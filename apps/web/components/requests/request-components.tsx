"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Inbox,
  KeyRound,
  MoveRight,
  Plus,
  Send,
  ShieldAlert,
  UserRound,
  X,
  UserPlus,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import {
  assignmentsApi,
  type PickerBranchAssignment
} from "@/lib/api/assignments";
import { organizationApi, type Chain, type Vendor } from "@/lib/api/organization";
import {
  requestsApi,
  type CreateRequestPayload,
  type FinalizeOffboardingResponse,
  type FinalizeNewHireResponse,
  type NewHireLookupCandidate,
  type RequestDetail,
  type RequestStatus,
  type RequestSummary,
  type RequestType
} from "@/lib/api/requests";
import { pushRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const requestTypes: RequestType[] = [
  "NEW_HIRE",
  "RESIGNATION",
  "TRANSFER"
];
const internalRequestEngineTypes: RequestType[] = [];
const requestStatuses: RequestStatus[] = [
  "DRAFT",
  "PENDING_AREA_MANAGER",
  "PENDING_DESTINATION_AREA_MANAGER",
  "PENDING_ADMIN",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED"
];

type OperationsMode = "action" | "submitted" | "open" | "completed" | "rejected";

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
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const requestId = searchParams.get("requestId");
  const canCreateLifecycleRequest = user?.role !== "PICKER";

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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="h-11 rounded-xl bg-orange-600 hover:bg-orange-700"
                onClick={() => setNewRequestOpen(true)}
                type="button"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 p-4 sm:p-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ["action", "My action required"],
              ["submitted", "Submitted by me"],
              ["open", "Open"],
              ["completed", "Completed"],
              ["rejected", "Rejected"]
            ].map(([value, label]) => (
              <button
                className={cn(
                  "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                  mode === value
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                )}
                key={value}
                onClick={() => setMode(value as OperationsMode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search picker, branch, chain, creator"
              value={query}
            />
            <select
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
              onChange={(event) => setType(event.target.value as RequestType | "")}
              value={type}
            >
              <option value="">All request types</option>
              {requestTypes.map((value) => (
                <option key={value} value={value}>
                  {formatEnum(value)}
                </option>
              ))}
            </select>
            <Button
              className="h-11 rounded-xl"
              onClick={() => void loadOperations()}
              type="button"
              variant="outline"
            >
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
          </div>
        </div>
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

      {newRequestOpen && canCreateLifecycleRequest ? (
        <NewRequestSheet
          onClose={() => setNewRequestOpen(false)}
          onCreated={(request) => {
            setNewRequestOpen(false);
            void loadOperations();
            openRequest(request.id);
          }}
        />
      ) : null}
    </div>
  );
}

export function LegacyRequestsCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const canUseInternalRequestEngine =
    (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
    internalRequestEngineTypes.length > 0;
  const [items, setItems] = useState<RequestSummary[]>([]);
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [type, setType] = useState<RequestType | "">("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: "TRANSFER" as RequestType,
    sourceChainId: "",
    sourceVendorId: "",
    destinationChainId: "",
    destinationVendorId: "",
    targetUserId: "",
    details: ""
  });

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const response = await requestsApi.list({
        status,
        type,
        q: query,
        pageSize: 20
      });
      setItems(response.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load requests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, [status, type]);

  function createRequest() {
    startTransition(async () => {
      setError(null);
      const payload: CreateRequestPayload = {
        type: form.type,
        sourceChainId: form.sourceChainId || undefined,
        sourceVendorId: form.sourceVendorId || undefined,
        destinationChainId: form.destinationChainId || undefined,
        destinationVendorId: form.destinationVendorId || undefined,
        targetUserId: form.targetUserId || undefined,
        payload: form.details ? { details: form.details } : undefined
      };

      try {
        const created = await requestsApi.create(payload);
        pushRoute(router, `/tickets?requestId=${created.id}`);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to create request."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">Phase 5 engine</Badge>
            <h1 className="mt-3 text-xl font-semibold">Requests</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Lifecycle request records and approval state. Branch-first New Hire,
              Offboarding, and Transfer workflows apply system changes through
              backend-controlled finalization paths.
            </p>
          </div>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/tickets"
          >
            Pending approvals
          </Link>
        </div>
      </section>

      {canUseInternalRequestEngine ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <Badge variant="muted">Admin only</Badge>
          <h2 className="mt-3 text-base font-semibold">
            Internal request engine testing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal request engine testing for generic request records. New
            Hire, Offboarding, and Transfer must use Branch-first workflows.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Type">
              <select
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as RequestType
                  }))
                }
                value={form.type}
              >
                {internalRequestEngineTypes.map((value) => (
                  <option key={value} value={value}>
                    {formatEnum(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source Chain ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceChainId: event.target.value
                  }))
                }
                value={form.sourceChainId}
              />
            </Field>
            <Field label="Source Vendor ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceVendorId: event.target.value
                  }))
                }
                value={form.sourceVendorId}
              />
            </Field>
            <Field label="Target User ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targetUserId: event.target.value
                  }))
                }
                value={form.targetUserId}
              />
            </Field>
            <Field label="Destination Chain ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    destinationChainId: event.target.value
                  }))
                }
                value={form.destinationChainId}
              />
            </Field>
            <Field label="Destination Vendor ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    destinationVendorId: event.target.value
                  }))
                }
                value={form.destinationVendorId}
              />
            </Field>
            <Field label="Details">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    details: event.target.value
                  }))
                }
                value={form.details}
              />
            </Field>
            <div className="flex items-end">
              <Button disabled={isPending} onClick={createRequest} type="button">
                Create Draft
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search request context"
            value={query}
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => setStatus(event.target.value as RequestStatus | "")}
            value={status}
          >
            <option value="">All statuses</option>
            {requestStatuses.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => setType(event.target.value as RequestType | "")}
            value={type}
          >
            <option value="">All types</option>
            {requestTypes.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
          <Button onClick={() => void loadRequests()} type="button" variant="outline">
            Search
          </Button>
        </div>
        {error ? <ErrorState message={error} /> : null}
        {loading ? (
          <LoadingState label="Loading requests" />
        ) : items.length ? (
          <RequestsTable items={items} />
        ) : (
          <EmptyState message="No requests match the current filters." />
        )}
      </section>
    </div>
  );
}

function RequestOperationCard({
  actionRequired,
  approval,
  onOpen,
  request
}: {
  actionRequired: boolean;
  approval: PendingApproval | null;
  onOpen: () => void;
  request: RequestSummary;
}) {
  const Icon = getRequestIcon(request.type);
  const context = getRequestPrimaryContext(request);

  return (
    <button
      className="group grid min-h-[190px] text-left rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">
              {formatEnum(request.type)}
            </span>
            <span className="block text-xs text-slate-500">
              {relativeTime(request.createdAt)}
            </span>
          </span>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="mt-4 grid gap-2">
        <p className="line-clamp-2 text-base font-semibold text-slate-950">
          {context.title}
        </p>
        <p className="line-clamp-2 text-sm leading-5 text-slate-500">
          {context.subtitle}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" />
          {request.createdBy.nameEn}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {approval
            ? formatEnum(approval.step)
            : request.currentStep
              ? formatEnum(request.currentStep)
              : "No pending step"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        {actionRequired ? (
          <Badge className="bg-orange-50 text-orange-700" variant="outline">
            Action required
          </Badge>
        ) : (
          <span className="text-xs font-medium text-slate-400">Review</span>
        )}
        <span className="inline-flex items-center text-sm font-semibold text-orange-600">
          Open
          <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function RequestDetailModal({
  onChanged,
  onClose,
  requestId
}: {
  onChanged: () => Promise<void>;
  onClose: () => void;
  requestId: string;
}) {
  const { user } = useAuth();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadRequest() {
    setLoading(true);
    setError(null);
    try {
      setRequest(await requestsApi.get(requestId));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load request."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequest();
  }, [requestId]);

  const actionableApproval = request?.approvals.find(
    (approval) =>
      approval.status === "PENDING" &&
      approval.step === request.currentStep &&
      (approval.approverId === user?.id ||
        approval.approverRole === user?.role ||
        ((user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
          approval.step === "ADMIN_FINAL_APPROVAL"))
  );

  function decide() {
    if (!actionableApproval || !decision) {
      return;
    }
    if (decision === "reject" && !decisionNotes.trim()) {
      setError("Reject reason is required.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (decision === "approve") {
          await approvalsApi.approve(actionableApproval.id, decisionNotes || undefined);
        } else {
          await approvalsApi.reject(actionableApproval.id, decisionNotes);
        }
        setDecision(null);
        setDecisionNotes("");
        await loadRequest();
        await onChanged();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to record approval decision."
        );
      }
    });
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <section className="max-h-[94dvh] w-full overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl sm:max-w-4xl sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              Request profile
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {request ? formatEnum(request.type) : "Loading request"}
            </h2>
          </div>
          <Button
            aria-label="Close request"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[calc(94dvh-88px)] overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden">
          {loading ? <LoadingState label="Loading request detail" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {request ? (
            <div className="grid gap-4">
              <RequestModalHero request={request} />
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <RequestTypePanel request={request} />
                <InfoCard title="Workflow">
                  <WorkflowStateSummary request={request} />
                </InfoCard>
              </div>
              <InfoCard title="Approval Steps">
                <div className="grid gap-2">
                  {request.approvals.map((approval) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                      key={approval.id}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatEnum(approval.step)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {approval.approver?.nameEn ??
                            formatEnum(approval.approverRole)}
                        </p>
                      </div>
                      <ApprovalStatusBadge status={approval.status} />
                    </div>
                  ))}
                </div>
              </InfoCard>

              {actionableApproval &&
              !(
                request.type === "NEW_HIRE" &&
                actionableApproval.step === "ADMIN_FINAL_APPROVAL"
              ) &&
              !(
                request.type === "RESIGNATION" &&
                actionableApproval.step === "ADMIN_FINAL_APPROVAL"
              ) ? (
                <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <h3 className="text-sm font-semibold text-orange-950">
                    Action required
                  </h3>
                  <p className="mt-1 text-sm text-orange-800">
                    Review the request details before recording your decision.
                    Reject requires a reason.
                  </p>
                  <div className="mt-3 grid gap-3">
                    {decision ? (
                      <Field label={decision === "reject" ? "Reject reason" : "Notes"}>
                        <Input
                          onChange={(event) => setDecisionNotes(event.target.value)}
                          placeholder={
                            decision === "reject"
                              ? "Required reason"
                              : "Optional notes"
                          }
                          value={decisionNotes}
                        />
                      </Field>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={isPending}
                        onClick={() => {
                          if (decision === "approve") {
                            decide();
                          } else {
                            setDecision("approve");
                            setDecisionNotes("");
                          }
                        }}
                        type="button"
                      >
                        {decision === "approve" ? "Confirm Approve" : "Approve"}
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => {
                          if (decision === "reject") {
                            decide();
                          } else {
                            setDecision("reject");
                            setDecisionNotes("");
                          }
                        }}
                        type="button"
                        variant="outline"
                      >
                        {decision === "reject" ? "Confirm Reject" : "Reject"}
                      </Button>
                      {decision ? (
                        <Button
                          onClick={() => {
                            setDecision(null);
                            setDecisionNotes("");
                          }}
                          type="button"
                          variant="ghost"
                        >
                          Cancel decision
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              {request.type === "NEW_HIRE" &&
              request.status === "PENDING_ADMIN" &&
              request.currentStep === "ADMIN_FINAL_APPROVAL" &&
              (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
                <FinalizeNewHirePanel
                  onFinalized={async () => {
                    await loadRequest();
                    await onChanged();
                  }}
                  requestId={request.id}
                />
              ) : null}

              {request.type === "RESIGNATION" &&
              request.status === "PENDING_ADMIN" &&
              request.currentStep === "ADMIN_FINAL_APPROVAL" &&
              (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
                <FinalizeOffboardingPanel
                  onFinalized={async () => {
                    await loadRequest();
                    await onChanged();
                  }}
                  requestId={request.id}
                  type="RESIGNATION"
                />
              ) : null}

              <InfoCard title="Timeline">
                <div className="grid gap-3">
                  {request.timeline.slice(0, 8).map((item) => (
                    <div className="flex gap-3" key={item.id}>
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-orange-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatEnum(item.type)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(item.at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </InfoCard>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function RequestModalHero({ request }: { request: RequestDetail }) {
  const context = getRequestPrimaryContext(request);
  const Icon = getRequestIcon(request.type);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {context.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{context.subtitle}</p>
            <p className="mt-2 text-xs text-slate-500">
              Submitted by {request.createdBy.nameEn} ·{" "}
              {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
    </section>
  );
}

function RequestTypePanel({ request }: { request: RequestDetail }) {
  if (request.type === "NEW_HIRE") {
    const context = parseNewHirePayload(request.payload);
    return (
      <InfoCard title={context?.mode === "REHIRE" ? "Rehire Candidate" : "New Hire Candidate"}>
        <Definition label="Picker English name" value={context?.nameEn ?? "Not available"} />
        <Definition label="Phone number" value={context?.candidatePhone ?? "Not available"} />
        <Definition label="National ID" value={context?.nationalId ?? "Not available"} />
        <Definition label="Address" value={context?.address ?? "Not available"} />
        <Definition label="Chain" value={request.sourceChain?.chainName ?? "None"} />
        <Definition label="Branch" value={request.sourceVendor?.vendorName ?? "None"} />
        <Definition
          label="Mode"
          value={context?.mode === "REHIRE" ? "Previous Picker rehire" : "New Picker"}
        />
        {context?.rehireUserId ? (
          <Definition label="Previous Picker ID" value={context.rehireUserId} />
        ) : null}
      </InfoCard>
    );
  }

  if (request.type === "TRANSFER") {
    return (
      <InfoCard title="Transfer Details">
        <TransferContext payload={request.payload} request={request} />
      </InfoCard>
    );
  }

  return (
    <InfoCard title="Resignation Details">
      <OffboardingContext payload={request.payload} />
    </InfoCard>
  );
}

export function NewHireRequestForm({
  fixedSourceVendorId,
  onCreated
}: {
  fixedSourceVendorId?: string;
  onCreated: (request: RequestSummary) => void;
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState({
    sourceChainId: "",
    sourceVendorId: "",
    nameEn: "",
    nameAr: "",
    phoneNumber: "",
    nationalId: "",
    dateOfBirth: "",
    gender: "UNSPECIFIED" as "MALE" | "FEMALE" | "UNSPECIFIED",
    address: "",
    notes: ""
  });
  const [branchQuery, setBranchQuery] = useState("");
  const [lookupCandidates, setLookupCandidates] = useState<NewHireLookupCandidate[]>([]);
  const [selectedRehireUserId, setSelectedRehireUserId] = useState("");
  const [autoFilledFromUserId, setAutoFilledFromUserId] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "checking" | "found" | "clear">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (fixedSourceVendorId) {
      setForm((current) => ({ ...current, sourceVendorId: fixedSourceVendorId }));
    }
    let mounted = true;
    async function loadVendors() {
      try {
        const [chainFirst, first] = await Promise.all([
          organizationApi.listChains({
            page: 1,
            pageSize: 100,
            status: "ACTIVE"
          }),
          organizationApi.listVendors({
            page: 1,
            pageSize: 100,
            status: "ACTIVE"
          })
        ]);
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, index) =>
            organizationApi.listVendors({
              page: index + 2,
              pageSize: 100,
              status: "ACTIVE"
            })
          )
        );
        const chainRest = await Promise.all(
          Array.from(
            { length: Math.max(0, chainFirst.meta.totalPages - 1) },
            (_, index) =>
              organizationApi.listChains({
                page: index + 2,
                pageSize: 100,
                status: "ACTIVE"
              })
          )
        );
        if (mounted) {
          const allVendors = [...first.items, ...rest.flatMap((page) => page.items)];
          setChains([...chainFirst.items, ...chainRest.flatMap((page) => page.items)]);
          setVendors(allVendors);
          if (fixedSourceVendorId) {
            const fixedVendor = allVendors.find(
              (vendor) => vendor.id === fixedSourceVendorId
            );
            setForm((current) => ({
              ...current,
              sourceVendorId: fixedSourceVendorId,
              sourceChainId: fixedVendor?.chainId ?? current.sourceChainId
            }));
          }
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load Branches."
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingVendors(false);
        }
      }
    }
    void loadVendors();
    return () => {
      mounted = false;
    };
  }, [fixedSourceVendorId]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateIdentityField(name: "phoneNumber" | "nationalId", value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(autoFilledFromUserId
        ? {
            nameEn: "",
            nameAr: "",
            dateOfBirth: "",
            gender: "UNSPECIFIED" as const,
            address: ""
          }
        : {})
    }));
    setAutoFilledFromUserId("");
    setSelectedRehireUserId("");
    setLookupCandidates([]);
    setLookupState("idle");
    setError(null);
  }

  useEffect(() => {
    const phoneNumber = form.phoneNumber.trim();
    const nationalId = form.nationalId.trim();
    const canLookup = phoneNumber.length >= 8 || nationalId.length >= 6;

    if (!canLookup) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLookupState("checking");
      startTransition(async () => {
        try {
          const result = await requestsApi.lookupNewHireCandidate({
            sourceVendorId: form.sourceVendorId || undefined,
            phoneNumber: phoneNumber || undefined,
            nationalId: nationalId || undefined
          });
          if (cancelled) {
            return;
          }

          setLookupCandidates(result.candidates);
          const firstCandidate = result.candidates[0];
          const rehireCandidate = result.candidates.find(
            (candidate) => candidate.decision === "REHIRE_AVAILABLE"
          );
          const blocking = result.candidates.find(
            (candidate) =>
              candidate.decision === "ACTIVE_DUPLICATE" ||
              candidate.decision === "BLOCKED"
          );

          if (firstCandidate) {
            setForm((current) => ({
              ...current,
              nameEn: firstCandidate.user.nameEn,
              nameAr: firstCandidate.user.nameAr ?? "",
              phoneNumber: firstCandidate.user.phoneNumber,
              dateOfBirth: firstCandidate.dateOfBirth ?? "",
              gender: firstCandidate.gender
            }));
            setAutoFilledFromUserId(firstCandidate.user.id);
          }

          setSelectedRehireUserId(rehireCandidate?.user.id ?? "");
          setLookupState(result.candidates.length ? "found" : "clear");
          setError(blocking?.reason ?? null);
        } catch (caughtError) {
          if (!cancelled) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to lookup candidate."
            );
            setLookupState("idle");
          }
        }
      });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [form.phoneNumber, form.nationalId, form.sourceVendorId]);

  function updateSourceChain(chainId: string) {
    setForm((current) => ({
      ...current,
      sourceChainId: chainId,
      sourceVendorId: ""
    }));
    setBranchQuery("");
  }

  function selectBranch(vendor: Vendor) {
    setForm((current) => ({
      ...current,
      sourceChainId: vendor.chainId,
      sourceVendorId: vendor.id
    }));
  }

  const filteredVendors = vendors
    .filter((vendor) => !form.sourceChainId || vendor.chainId === form.sourceChainId)
    .filter((vendor) => {
      const query = branchQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [vendor.vendorName, vendor.vendorCode, vendor.chain.chainName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

  const selectedVendor = vendors.find((vendor) => vendor.id === form.sourceVendorId);
  const blockingCandidate = lookupCandidates.find(
    (candidate) =>
      candidate.decision === "ACTIVE_DUPLICATE" || candidate.decision === "BLOCKED"
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rehireCandidate = lookupCandidates.find(
      (candidate) => candidate.decision === "REHIRE_AVAILABLE"
    );
    if (rehireCandidate && !selectedRehireUserId) {
      setError("Select the previous Picker before submitting this Rehire.");
      return;
    }
    if (blockingCandidate) {
      setError(blockingCandidate.reason ?? "This candidate cannot be hired.");
      return;
    }
    if (!form.sourceVendorId) {
      setError("Select the Chain and Branch before submitting New Hire.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createNewHire({
          sourceVendorId: form.sourceVendorId,
          rehireUserId: selectedRehireUserId || undefined,
          nameEn: form.nameEn || undefined,
          nameAr: form.nameAr || undefined,
          phoneNumber: form.phoneNumber,
          nationalId: form.nationalId,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender,
          address: form.address || undefined,
          notes: form.notes || undefined
        });
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit New Hire request."
        );
      }
    });
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}
      {fixedSourceVendorId ? null : (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Chain">
              <select
                className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
                disabled={isLoadingVendors}
                onChange={(event) => updateSourceChain(event.target.value)}
                value={form.sourceChainId}
              >
                <option value="">
                  {isLoadingVendors ? "Loading Chains..." : "Select Chain"}
                </option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.chainName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Branch search">
              <Input
                className="h-11 rounded-xl bg-white"
                disabled={!form.sourceChainId || isLoadingVendors}
                onChange={(event) => setBranchQuery(event.target.value)}
                placeholder="Search Branch name or code"
                value={branchQuery}
              />
            </Field>
          </div>
          {form.sourceChainId ? (
            <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredVendors.slice(0, 12).map((vendor) => (
                <button
                  className={cn(
                    "rounded-xl border bg-white p-3 text-left text-sm transition-colors",
                    form.sourceVendorId === vendor.id
                      ? "border-orange-300 bg-orange-50 text-orange-950"
                      : "border-slate-200 text-slate-700 hover:border-orange-200"
                  )}
                  key={vendor.id}
                  onClick={() => selectBranch(vendor)}
                  type="button"
                >
                  <span className="block font-semibold">{vendor.vendorName}</span>
                  <span className="block text-xs text-slate-500">
                    {vendor.vendorCode} · {vendor.chain.chainName}
                  </span>
                </button>
              ))}
              {!filteredVendors.length ? (
                <EmptyState message="No Branch matches this Chain/search." compact />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {selectedVendor ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <span className="font-semibold">{selectedVendor.chain.chainName}</span>
          <span className="mx-2 text-orange-400">/</span>
          <span>{selectedVendor.vendorName}</span>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone number">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => updateIdentityField("phoneNumber", event.target.value)}
            required
            value={form.phoneNumber}
          />
        </Field>
        <Field label="National ID">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => updateIdentityField("nationalId", event.target.value)}
            value={form.nationalId}
          />
        </Field>
      </div>
      {lookupState === "checking" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Checking existing Picker records...
        </div>
      ) : null}
      {lookupCandidates
        .filter((candidate) => candidate.decision !== "ACTIVE_DUPLICATE")
        .map((candidate) => (
          <div
            className={cn(
              "rounded-2xl border p-3 text-left text-sm",
              candidate.decision === "REHIRE_AVAILABLE"
                ? "border-orange-300 bg-orange-50"
                : "border-red-200 bg-red-50 text-red-800"
            )}
            key={candidate.user.id}
          >
            <p className="font-semibold text-slate-950">
              {candidate.decision === "REHIRE_AVAILABLE"
                ? `Previous Picker will be reused: ${candidate.user.nameEn}`
                : `Blocked Picker: ${candidate.user.nameEn}`}
            </p>
            <p className="mt-1 text-slate-500">
              {candidate.user.phoneNumber} · {formatEnum(candidate.employmentStatus)}
            </p>
            <p className="mt-2 text-xs font-medium text-orange-700">
              {candidate.reason ??
                (candidate.decision === "REHIRE_AVAILABLE"
                  ? "SuperNova detected an old Picker record and selected Rehire automatically."
                  : "This Picker cannot be hired right now.")}
            </p>
          </div>
        ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name English">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => updateField("nameEn", event.target.value)}
            value={form.nameEn}
          />
        </Field>
        <Field label="Name Arabic">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => updateField("nameAr", event.target.value)}
            value={form.nameAr}
          />
        </Field>
        <Field label="Date of birth">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => updateField("dateOfBirth", event.target.value)}
            type="date"
            value={form.dateOfBirth}
          />
        </Field>
        <Field label="Gender">
          <select
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            onChange={(event) => updateField("gender", event.target.value)}
            value={form.gender}
          >
            <option value="UNSPECIFIED">Unspecified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </Field>
      </div>
      <Field label="Address">
        <Input
          className="h-11 rounded-xl"
          onChange={(event) => updateField("address", event.target.value)}
          value={form.address}
        />
      </Field>
      <Field label="Notes">
        <Input
          className="h-11 rounded-xl"
          onChange={(event) => updateField("notes", event.target.value)}
          value={form.notes}
        />
      </Field>
      <div className="flex justify-end">
        <Button className="rounded-xl bg-orange-600 hover:bg-orange-700" disabled={isPending} type="submit">
          Submit New Hire
        </Button>
      </div>
    </form>
  );
}

function LifecyclePickerRequestForm({
  onCreated,
  type
}: {
  onCreated: (request: RequestSummary) => void;
  type: "RESIGNATION" | "TRANSFER";
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sourceChainId, setSourceChainId] = useState("");
  const [sourceVendorId, setSourceVendorId] = useState("");
  const [sourceBranchQuery, setSourceBranchQuery] = useState("");
  const [destinationChainId, setDestinationChainId] = useState("");
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [destinationBranchQuery, setDestinationBranchQuery] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerAssignments, setPickerAssignments] = useState<PickerBranchAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] =
    useState<PickerBranchAssignment | null>(null);
  const [form, setForm] = useState({
    reason: "",
    effectiveDate: "",
    notes: ""
  });
  const [loading, setLoading] = useState(true);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      setLoading(true);
      try {
        const [chainFirst, vendorFirst] = await Promise.all([
          organizationApi.listChains({ page: 1, pageSize: 100, status: "ACTIVE" }),
          organizationApi.listVendors({ page: 1, pageSize: 100, status: "ACTIVE" })
        ]);
        const [chainRest, vendorRest] = await Promise.all([
          Promise.all(
            Array.from(
              { length: Math.max(0, chainFirst.meta.totalPages - 1) },
              (_, index) =>
                organizationApi.listChains({
                  page: index + 2,
                  pageSize: 100,
                  status: "ACTIVE"
                })
            )
          ),
          Promise.all(
            Array.from(
              { length: Math.max(0, vendorFirst.meta.totalPages - 1) },
              (_, index) =>
                organizationApi.listVendors({
                  page: index + 2,
                  pageSize: 100,
                  status: "ACTIVE"
                })
            )
          )
        ]);

        if (mounted) {
          setChains([...chainFirst.items, ...chainRest.flatMap((page) => page.items)]);
          setVendors([...vendorFirst.items, ...vendorRest.flatMap((page) => page.items)]);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load Chain and Branch options."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sourceVendorId) {
      setPickerAssignments([]);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      setPickerLoading(true);
      assignmentsApi
        .listPickerBranchAssignments({
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
          q: pickerQuery || undefined
        })
        .then((response) => {
          if (mounted) {
            setPickerAssignments(
              response.items.filter((assignment) => assignment.vendorId === sourceVendorId)
            );
          }
        })
        .catch((caughtError) => {
          if (mounted) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load active Pickers."
            );
          }
        })
        .finally(() => {
          if (mounted) {
            setPickerLoading(false);
          }
        });
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [pickerQuery, sourceVendorId]);

  const sourceVendors = filterVendors(vendors, sourceChainId, sourceBranchQuery);
  const destinationVendors = filterVendors(
    vendors,
    destinationChainId,
    destinationBranchQuery
  ).filter((vendor) => vendor.id !== sourceVendorId);
  const sourceVendor = vendors.find((vendor) => vendor.id === sourceVendorId);
  const destinationVendor = vendors.find((vendor) => vendor.id === destinationVendorId);

  function selectSourceChain(chainId: string) {
    setSourceChainId(chainId);
    setSourceVendorId("");
    setSelectedAssignment(null);
    setPickerAssignments([]);
    setPickerQuery("");
    setSourceBranchQuery("");
  }

  function selectSourceVendor(vendor: Vendor) {
    setSourceChainId(vendor.chainId);
    setSourceVendorId(vendor.id);
    setSelectedAssignment(null);
    setPickerQuery("");
  }

  function selectDestinationChain(chainId: string) {
    setDestinationChainId(chainId);
    setDestinationVendorId("");
    setDestinationBranchQuery("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceVendorId || !selectedAssignment) {
      setError("Select Chain, Branch, and Picker before submitting.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (type === "RESIGNATION" && !form.effectiveDate) {
      setError("Last working day is required.");
      return;
    }
    if (type === "TRANSFER" && !destinationVendorId) {
      setError("Select destination Chain and Branch.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created =
          type === "RESIGNATION"
            ? await requestsApi.createOffboarding({
                type: "RESIGNATION",
                sourceVendorId,
                targetUserId: selectedAssignment.pickerId,
                reason: form.reason,
                resignationDate: form.effectiveDate,
                notes: form.notes || undefined
              })
            : await requestsApi.createTransfer({
                sourceVendorId,
                targetUserId: selectedAssignment.pickerId,
                destinationVendorId,
                reason: form.reason,
                requestedTransferDate: form.effectiveDate || undefined,
                notes: form.notes || undefined
              });
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : `Unable to submit ${formatEnum(type)} request.`
        );
      }
    });
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source Chain">
            <select
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              onChange={(event) => selectSourceChain(event.target.value)}
              value={sourceChainId}
            >
              <option value="">{loading ? "Loading Chains..." : "Select Chain"}</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch search">
            <Input
              className="h-11 rounded-xl bg-white"
              disabled={!sourceChainId || loading}
              onChange={(event) => setSourceBranchQuery(event.target.value)}
              placeholder="Search Branch"
              value={sourceBranchQuery}
            />
          </Field>
        </div>
        {sourceChainId ? (
          <BranchChoiceList
            onSelect={selectSourceVendor}
            selectedVendorId={sourceVendorId}
            vendors={sourceVendors}
          />
        ) : null}
      </div>

      {sourceVendor ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <span className="font-semibold">{sourceVendor.chain.chainName}</span>
          <span className="mx-2 text-orange-400">/</span>
          <span>{sourceVendor.vendorName}</span>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <Field label="Picker search">
          <Input
            className="h-11 rounded-xl"
            disabled={!sourceVendorId}
            onChange={(event) => setPickerQuery(event.target.value)}
            placeholder="Search by name, phone, or ID"
            value={pickerQuery}
          />
        </Field>
        {pickerLoading ? (
          <LoadingState label="Loading active Pickers" />
        ) : sourceVendorId ? (
          <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pickerAssignments.slice(0, 12).map((assignment) => (
              <button
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-colors",
                  selectedAssignment?.id === assignment.id
                    ? "border-orange-300 bg-orange-50"
                    : "border-slate-200 bg-slate-50 hover:border-orange-200"
                )}
                key={assignment.id}
                onClick={() => setSelectedAssignment(assignment)}
                type="button"
              >
                <span className="block font-semibold text-slate-950">
                  {assignment.picker.nameEn}
                </span>
                <span className="block text-xs text-slate-500">
                  {assignment.picker.phoneNumber} · {assignment.vendor.vendorName}
                </span>
              </button>
            ))}
            {!pickerAssignments.length ? (
              <EmptyState message="No active Picker matches this Branch/search." compact />
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedAssignment ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-950">Selected Picker</p>
          <Definition label="Name" value={selectedAssignment.picker.nameEn} />
          <Definition label="Phone" value={selectedAssignment.picker.phoneNumber} />
          <Definition label="Branch" value={selectedAssignment.vendor.vendorName} />
          <Definition label="Chain" value={selectedAssignment.chain.chainName} />
        </div>
      ) : null}

      {type === "TRANSFER" ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Destination Chain">
              <select
                className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
                disabled={loading}
                onChange={(event) => selectDestinationChain(event.target.value)}
                value={destinationChainId}
              >
                <option value="">
                  {loading ? "Loading Chains..." : "Select Chain"}
                </option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.chainName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Destination Branch search">
              <Input
                className="h-11 rounded-xl bg-white"
                disabled={!destinationChainId || loading}
                onChange={(event) => setDestinationBranchQuery(event.target.value)}
                placeholder="Search destination Branch"
                value={destinationBranchQuery}
              />
            </Field>
          </div>
          {destinationChainId ? (
            <BranchChoiceList
              onSelect={(vendor) => {
                setDestinationChainId(vendor.chainId);
                setDestinationVendorId(vendor.id);
              }}
              selectedVendorId={destinationVendorId}
              vendors={destinationVendors}
            />
          ) : null}
          {destinationVendor ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
              {destinationVendor.chain.chainName} / {destinationVendor.vendorName}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={type === "RESIGNATION" ? "Last working day" : "Transfer date"}>
          <Input
            className="h-11 rounded-xl"
            onChange={(event) =>
              setForm((current) => ({ ...current, effectiveDate: event.target.value }))
            }
            type="date"
            value={form.effectiveDate}
          />
        </Field>
        <Field label="Reason">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) =>
              setForm((current) => ({ ...current, reason: event.target.value }))
            }
            value={form.reason}
          />
        </Field>
      </div>
      <Field label="Notes">
        <Input
          className="h-11 rounded-xl"
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          value={form.notes}
        />
      </Field>
      <div className="flex justify-end">
        <Button
          className="rounded-xl bg-orange-600 hover:bg-orange-700"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Submitting..." : `Submit ${formatEnum(type)}`}
        </Button>
      </div>
    </form>
  );
}

function filterVendors(vendors: Vendor[], chainId: string, queryValue: string) {
  return vendors
    .filter((vendor) => !chainId || vendor.chainId === chainId)
    .filter((vendor) => {
      const query = queryValue.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [vendor.vendorName, vendor.vendorCode, vendor.chain.chainName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
}

function BranchChoiceList({
  onSelect,
  selectedVendorId,
  vendors
}: {
  onSelect: (vendor: Vendor) => void;
  selectedVendorId: string;
  vendors: Vendor[];
}) {
  return (
    <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {vendors.slice(0, 12).map((vendor) => (
        <button
          className={cn(
            "rounded-xl border bg-white p-3 text-left text-sm transition-colors",
            selectedVendorId === vendor.id
              ? "border-orange-300 bg-orange-50 text-orange-950"
              : "border-slate-200 text-slate-700 hover:border-orange-200"
          )}
          key={vendor.id}
          onClick={() => onSelect(vendor)}
          type="button"
        >
          <span className="block font-semibold">{vendor.vendorName}</span>
          <span className="block text-xs text-slate-500">
            {vendor.vendorCode} · {vendor.chain.chainName}
          </span>
        </button>
      ))}
      {!vendors.length ? (
        <EmptyState message="No Branch matches this Chain/search." compact />
      ) : null}
    </div>
  );
}

function NewRequestSheet({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const [selectedType, setSelectedType] = useState<RequestType>("NEW_HIRE");

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[130] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <section className="max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl [scrollbar-width:none] sm:max-w-2xl sm:rounded-[1.75rem] sm:p-5 [&::-webkit-scrollbar]:hidden">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              New request
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Create lifecycle request
            </h2>
          </div>
          <Button
            aria-label="Close new request"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {requestTypes.map((type) => (
            <button
              className={cn(
                "rounded-2xl border p-3 text-left text-sm font-semibold",
                selectedType === type
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-600"
              )}
              key={type}
              onClick={() => setSelectedType(type)}
              type="button"
            >
              {formatEnum(type)}
            </button>
          ))}
        </div>
        {selectedType === "NEW_HIRE" ? (
          <NewHireRequestForm onCreated={onCreated} />
        ) : selectedType === "RESIGNATION" || selectedType === "TRANSFER" ? (
          <LifecyclePickerRequestForm onCreated={onCreated} type={selectedType} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            This request type is not available in the current workflow.
          </div>
        )}
      </section>
    </div>
  );
}

export function RequestDetailView() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadRequest() {
    setLoading(true);
    setError(null);
    try {
      setRequest(await requestsApi.get(params.id));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load request."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequest();
  }, [params.id]);

  function submit() {
    startTransition(async () => {
      try {
        await requestsApi.submit(params.id);
        await loadRequest();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit request."
        );
      }
    });
  }

  function cancel() {
    const notes = window.prompt("Cancellation notes") ?? undefined;
    startTransition(async () => {
      try {
        await requestsApi.cancel(params.id, notes);
        await loadRequest();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to cancel request."
        );
      }
    });
  }

  if (loading) {
    return <LoadingState label="Loading request detail" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!request) {
    return <EmptyState message="Request was not found." />;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">{formatEnum(request.type)}</Badge>
            <h1 className="mt-3 text-xl font-semibold">Request Detail</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Created by {request.createdBy.nameEn} on{" "}
              {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestStatusBadge status={request.status} />
            {request.status === "DRAFT" ? (
              <Button disabled={isPending} onClick={submit} size="sm" type="button">
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            ) : null}
            {["DRAFT", "PENDING_AREA_MANAGER", "PENDING_DESTINATION_AREA_MANAGER", "PENDING_ADMIN"].includes(
              request.status
            ) ? (
              <Button
                disabled={isPending}
                onClick={cancel}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            ) : null}
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href="/tickets"
              prefetch
            >
              Back
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Context">
          <Definition label="Source Chain" value={request.sourceChain?.chainName ?? "None"} />
          <Definition label="Source Vendor" value={request.sourceVendor?.vendorName ?? "None"} />
          <Definition
            label="Destination Chain"
            value={request.destinationChain?.chainName ?? "None"}
          />
          <Definition
            label="Destination Vendor"
            value={request.destinationVendor?.vendorName ?? "None"}
          />
          <Definition label="Target User" value={request.targetUser?.nameEn ?? "None"} />
        </InfoCard>
        <InfoCard title="Workflow State">
          <WorkflowStateSummary request={request} />
        </InfoCard>
        {request.type === "RESIGNATION" ? (
          <InfoCard title="Offboarding Context">
            <OffboardingContext payload={request.payload} />
          </InfoCard>
        ) : null}
        {request.type === "TRANSFER" ? (
          <InfoCard title="Transfer Context">
            <TransferContext payload={request.payload} request={request} />
          </InfoCard>
        ) : null}
        <InfoCard title="Approval Steps">
          {request.approvals.length ? (
            request.approvals.map((approval) => (
              <div className="rounded-md border bg-background p-3" key={approval.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{formatEnum(approval.step)}</p>
                  <ApprovalStatusBadge status={approval.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Owner: {approval.approver?.nameEn ?? formatEnum(approval.approverRole)}
                </p>
              </div>
            ))
          ) : (
            <EmptyState message="No approval steps generated yet." compact />
          )}
        </InfoCard>
      </section>

      {request.type === "NEW_HIRE" &&
      request.status === "PENDING_ADMIN" &&
      request.currentStep === "ADMIN_FINAL_APPROVAL" &&
      (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
        <FinalizeNewHirePanel
          onFinalized={async () => {
            await loadRequest();
          }}
          requestId={request.id}
        />
      ) : null}

      {request.type === "RESIGNATION" &&
      request.status === "PENDING_ADMIN" &&
      request.currentStep === "ADMIN_FINAL_APPROVAL" &&
      (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
        <FinalizeOffboardingPanel
          onFinalized={async () => {
            await loadRequest();
          }}
          requestId={request.id}
        type="RESIGNATION"
      />
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Timeline</h2>
        <div className="mt-4 grid gap-3">
          {request.timeline.map((item) => (
            <div className="flex gap-3" key={item.id}>
              <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <div>
                <p className="text-sm font-medium">{formatEnum(item.type)}</p>
                <p className="text-xs text-muted-foreground">
                  {item.label} · {new Date(item.at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LegacyApprovalsCenter() {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [decision, setDecision] = useState<{
    action: "approve" | "reject";
    approval: PendingApproval;
  } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadApprovals() {
    setLoading(true);
    setError(null);
    try {
      const response = await approvalsApi.pending();
      setItems(response.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load pending approvals."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApprovals();
  }, []);

  function decide() {
    if (!decision) {
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (decision.action === "approve") {
          await approvalsApi.approve(decision.approval.id, decisionNotes);
        } else {
          await approvalsApi.reject(decision.approval.id, decisionNotes);
        }
        setDecision(null);
        setDecisionNotes("");
        await loadApprovals();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to decide approval."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <Badge variant="outline">Approval queue</Badge>
        <h1 className="mt-3 text-xl font-semibold">Pending Actions</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Backend scope checks decide which approval steps are actionable. This page
          only renders the authenticated user&apos;s pending queue.
        </p>
      </section>
      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingState label="Loading approvals" />
      ) : items.length ? (
        <div className="grid gap-3">
          {items.map((approval) => (
            <ApprovalQueueCard
              approval={approval}
              isPending={isPending}
              key={approval.id}
              onDecision={(action) => {
                setDecision({ action, approval });
                setDecisionNotes("");
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState message="No pending approvals are assigned to you." />
      )}
      {decision ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
        >
          <section className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-xl">
            <Badge variant="outline">{formatEnum(decision.action)}</Badge>
            <h2 className="mt-3 text-lg font-semibold">
              {formatEnum(decision.approval.step)}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This records the approval decision. New Hire Admin final approval
              requires Shopper ID finalization from the request detail page.
              Offboarding Admin final approval requires block status and internal
              deactivation confirmation from the request detail page.
            </p>
            <label className="mt-4 grid gap-1 text-sm font-medium">
              Decision notes
              <Input
                onChange={(event) => setDecisionNotes(event.target.value)}
                placeholder="Optional notes"
                value={decisionNotes}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => {
                  setDecision(null);
                  setDecisionNotes("");
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} onClick={decide} type="button">
                Confirm {formatEnum(decision.action)}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function ApprovalsCenter() {
  return <RequestOperationsCenter defaultMode="action" />;
}

function ApprovalQueueCard({
  approval,
  isPending,
  onDecision
}: {
  approval: PendingApproval;
  isPending: boolean;
  onDecision: (action: "approve" | "reject") => void;
}) {
  const requiresNewHireFinalization =
    approval.request.type === "NEW_HIRE" &&
    approval.step === "ADMIN_FINAL_APPROVAL";
  const requiresOffboardingFinalization =
    approval.request.type === "RESIGNATION" &&
    approval.step === "ADMIN_FINAL_APPROVAL";

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="outline">{formatEnum(approval.request.type)}</Badge>
          <h2 className="mt-3 text-base font-semibold">
            {formatEnum(approval.step)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted by {approval.request.createdBy.nameEn}
          </p>
        </div>
        <RequestStatusBadge status={approval.request.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {requiresNewHireFinalization ? (
          <Link
            className={buttonVariants({ size: "sm" })}
            href={`/tickets?requestId=${approval.request.id}`}
            prefetch
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Finalize with Shopper ID
          </Link>
        ) : requiresOffboardingFinalization ? (
          <Link
            className={buttonVariants({
              size: "sm",
              className:
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            })}
            href={`/tickets?requestId=${approval.request.id}`}
            prefetch
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Finalize Offboarding
          </Link>
        ) : (
          <Button
            disabled={isPending}
            onClick={() => onDecision("approve")}
            type="button"
          >
            Approve
          </Button>
        )}
        <Button
          disabled={isPending}
          onClick={() => onDecision("reject")}
          type="button"
          variant="outline"
        >
          Reject
        </Button>
      </div>
      <Link
        className="mt-4 inline-flex text-sm font-medium text-primary"
        href={`/tickets?requestId=${approval.request.id}`}
      >
        View request detail
      </Link>
    </section>
  );
}

function FinalizeNewHirePanel({
  onFinalized,
  requestId
}: {
  onFinalized: () => Promise<void>;
  requestId: string;
}) {
  const [shopperId, setShopperId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeNewHireResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  function finalize() {
    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeNewHire(requestId, shopperId);
        setResult(finalized);
        await onFinalized();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to finalize New Hire."
        );
      }
    });
  }

  return (
    <section className="rounded-lg border border-primary/30 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline">Admin finalization</Badge>
          <h2 className="mt-3 text-base font-semibold">Finalize New Hire</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Shopper ID is required for a new Picker and optional when a Rehire
            already has one. SuperNova applies the approved workflow, creates or
            reactivates the Picker, assigns the source Branch, and generates
            temporary credentials in one backend transaction.
          </p>
        </div>
        <UserPlus className="h-6 w-6 text-primary" />
      </div>

      {result ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">New Hire completed.</p>
          <p className="mt-1">
            Picker {result.picker.nameEn} was created with phone{" "}
            {result.picker.phoneNumber} and assigned to the selected Branch.
          </p>
          <p className="mt-1">
            Temporary credentials are available only in the Champ notification.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Shopper ID">
            <Input
              onChange={(event) => setShopperId(event.target.value)}
              placeholder="Required for new Picker"
              value={shopperId}
            />
          </Field>
          <div className="flex items-end">
            <Button disabled={isPending} onClick={finalize} type="button">
              {isPending ? "Finalizing..." : "Finalize New Hire"}
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}
    </section>
  );
}

function FinalizeOffboardingPanel({
  onFinalized,
  requestId,
  type
}: {
  onFinalized: () => Promise<void>;
  requestId: string;
  type: "RESIGNATION";
}) {
  const [form, setForm] = useState({
    blockStatus: "NO_BLOCK" as "NO_BLOCK" | "TEMPORARY_BLOCK" | "PERMANENT_BLOCK",
    blockedUntil: "",
    blockReason: "",
    notes: "",
    confirmInternalDeactivation: false
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeOffboardingResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  function finalize() {
    if (!form.confirmInternalDeactivation) {
      setError("Internal deactivation confirmation is required.");
      return;
    }

    if (form.blockStatus === "TEMPORARY_BLOCK" && !form.blockedUntil) {
      setError("Blocked until date is required for a temporary block.");
      return;
    }

    if (
      (form.blockStatus === "TEMPORARY_BLOCK" ||
        form.blockStatus === "PERMANENT_BLOCK") &&
      !form.blockReason.trim()
    ) {
      setError("Block reason is required for temporary or permanent blocks.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeOffboarding(requestId, {
          blockStatus: form.blockStatus,
          confirmInternalDeactivation: form.confirmInternalDeactivation,
          ...(form.blockedUntil ? { blockedUntil: form.blockedUntil } : {}),
          ...(form.blockReason ? { blockReason: form.blockReason } : {}),
          ...(form.notes ? { notes: form.notes } : {})
        });
        setResult(finalized);
        await onFinalized();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to finalize offboarding."
        );
      }
    });
  }

  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge className="border-destructive/40 text-destructive" variant="outline">
            Admin finalization
          </Badge>
          <h2 className="mt-3 text-base font-semibold">
            Finalize {formatEnum(type)}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            This applies irreversible operational offboarding: the Picker account
            is archived, login is disabled, block status is saved, and the active
            Branch assignment is closed in one backend transaction.
          </p>
        </div>
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>

      {result ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Offboarding completed.</p>
          <p className="mt-1">
            Picker {result.picker.nameEn} is now {formatEnum(result.picker.accountStatus)}
            ; assignment {result.assignment.id} is {formatEnum(result.assignment.status)}.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <Field label="Block status">
            <select
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  blockStatus: event.target.value as typeof form.blockStatus
                }))
              }
              value={form.blockStatus}
            >
              <option value="NO_BLOCK">No block</option>
              <option value="TEMPORARY_BLOCK">Temporary block</option>
              <option value="PERMANENT_BLOCK">Permanent block</option>
            </select>
          </Field>
          {form.blockStatus === "TEMPORARY_BLOCK" ? (
            <Field label="Blocked until">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    blockedUntil: event.target.value
                  }))
                }
                type="date"
                value={form.blockedUntil}
              />
            </Field>
          ) : null}
          {form.blockStatus !== "NO_BLOCK" ? (
            <Field label="Block reason">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    blockReason: event.target.value
                  }))
                }
                placeholder="Required for temporary or permanent block"
                value={form.blockReason}
              />
            </Field>
          ) : null}
          <Field label="Admin notes">
            <Input
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Optional"
              value={form.notes}
            />
          </Field>
          <label className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
            <input
              checked={form.confirmInternalDeactivation}
              className="mt-1"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  confirmInternalDeactivation: event.target.checked
                }))
              }
              type="checkbox"
            />
            I confirm SuperNova should archive this Picker account, disable
            login, and close the active Branch assignment.
          </label>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={finalize}
            type="button"
          >
            {isPending ? "Finalizing..." : "Finalize Offboarding"}
          </Button>
        </div>
      )}
      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}
    </section>
  );
}

function TransferContext({
  payload,
  request
}: {
  payload: unknown;
  request: RequestDetail;
}) {
  const context = parseTransferPayload(payload);

  if (!context) {
    return <EmptyState message="No Transfer context is available." compact />;
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <MoveRight className="h-4 w-4 text-primary" />
        {context.approvalPath === "CROSS_CHAIN"
          ? "Cross-chain Transfer"
          : "Same-chain Transfer"}
      </div>
      <Definition
        label="Picker"
        value={request.targetUser?.nameEn ?? context.pickerId}
      />
      <Definition
        label="Source Branch"
        value={request.sourceVendor?.vendorName ?? context.sourceVendorId}
      />
      <Definition
        label="Source Chain"
        value={request.sourceChain?.chainName ?? context.sourceChainId}
      />
      <Definition
        label="Destination Branch"
        value={
          request.destinationVendor?.vendorName ?? context.destinationVendorId
        }
      />
      <Definition
        label="Destination Chain"
        value={
          request.destinationChain?.chainName ?? context.destinationChainId
        }
      />
      <Definition label="Reason" value={context.reason} />
      <Definition
        label="Requested transfer date"
        value={context.requestedTransferDate ?? "Not set"}
      />
      <Definition label="Notes" value={context.notes ?? "None"} />
      <Definition
        label="Approval path"
        value={
          context.approvalPath === "CROSS_CHAIN"
            ? "Source Area Manager, then destination Area Manager"
            : "Source Area Manager only"
        }
      />
      {context.completedAt ? (
        <Definition
          label="Transfer applied"
          value={`${new Date(context.completedAt).toLocaleString()} · old ${context.oldAssignmentId} · new ${context.newAssignmentId}`}
        />
      ) : null}
    </>
  );
}

function OffboardingContext({ payload }: { payload: unknown }) {
  const context = parseOffboardingPayload(payload);

  if (!context) {
    return <EmptyState message="No offboarding context is available." compact />;
  }

  return (
    <>
      <Definition label="Reason" value={context.reason} />
      <Definition
        label="Last working day"
        value={context.effectiveDate ?? "Not set"}
      />
      <Definition label="Notes" value={context.notes ?? "None"} />
      <Definition label="Picker assignment" value={context.pickerAssignmentId} />
      {context.finalizedAt ? (
        <Definition
          label="Finalized"
          value={`${new Date(context.finalizedAt).toLocaleString()} · ${formatEnum(
            context.blockStatus ?? "NO_BLOCK"
          )}`}
        />
      ) : null}
    </>
  );
}

function RequestsTable({ items }: { items: RequestSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Created By</th>
            <th className="py-3 pr-4">Source</th>
            <th className="py-3 pr-4">Current Step</th>
            <th className="py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((request) => (
            <tr className="border-b last:border-0" key={request.id}>
              <td className="py-3 pr-4 font-medium">{formatEnum(request.type)}</td>
              <td className="py-3 pr-4">
                <RequestStatusBadge status={request.status} />
              </td>
              <td className="py-3 pr-4">{request.createdBy.nameEn}</td>
              <td className="py-3 pr-4 text-muted-foreground">
                {request.sourceVendor?.vendorName ??
                  request.sourceChain?.chainName ??
                  "No source"}
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {request.currentStep ? formatEnum(request.currentStep) : "None"}
              </td>
              <td className="py-3 text-right">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/tickets?requestId=${request.id}`}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function WorkflowStateSummary({ request }: { request: RequestDetail }) {
  const finalAction =
    request.status === "PENDING_ADMIN" &&
    request.currentStep === "ADMIN_FINAL_APPROVAL"
      ? request.type === "NEW_HIRE"
        ? "Admin must enter Shopper ID and finalize New Hire."
        : request.type === "RESIGNATION"
          ? "Admin must confirm offboarding and block status."
          : "Admin review is pending."
      : request.status === "COMPLETED"
        ? "Workflow has been completed by the backend."
        : request.currentStep
          ? `${formatEnum(request.currentStep)} is the current actionable step.`
          : "No final action is currently required.";

  return (
    <>
      <Definition label="Workflow type" value={formatEnum(request.type)} />
      <Definition label="Current state" value={formatEnum(request.status)} />
      <Definition
        label="Current step"
        value={request.currentStep ? formatEnum(request.currentStep) : "None"}
      />
      <Definition label="Final action needed" value={finalAction} />
      {request.status === "COMPLETED" ? (
        <WorkflowResultSummary request={request} />
      ) : null}
    </>
  );
}

function WorkflowResultSummary({ request }: { request: RequestDetail }) {
  if (request.type === "NEW_HIRE") {
    const context = parseNewHirePayload(request.payload);
    return (
      <>
        <Definition
          label="New Hire result"
          value={
            context?.finalization
              ? `Picker ${context.finalization.pickerId} created and assigned.`
              : "Completed result is not available in payload."
          }
        />
        <Definition
          label="Shopper ID"
          value={context?.finalization?.shopperId ?? "Not available"}
        />
      </>
    );
  }

  if (request.type === "RESIGNATION") {
    const context = parseOffboardingPayload(request.payload);
    return (
      <Definition
        label="Offboarding result"
        value={
          context?.finalizedAt
            ? `Picker archived; assignment ${context.pickerAssignmentId} closed with ${formatEnum(
                context.blockStatus ?? "NO_BLOCK"
              )}.`
            : "Completed result is not available in payload."
        }
      />
    );
  }

  if (request.type === "TRANSFER") {
    const context = parseTransferPayload(request.payload);
    return (
      <Definition
        label="Transfer result"
        value={
          context?.completedAt
            ? `Old assignment ${context.oldAssignmentId} closed; new assignment ${context.newAssignmentId} opened.`
            : "Completed result is not available in payload."
        }
      />
    );
  }

  return null;
}

function getRequestIcon(type: RequestType) {
  if (type === "NEW_HIRE") return UserPlus;
  if (type === "TRANSFER") return MoveRight;
  if (type === "RESIGNATION") return ShieldAlert;
  return ShieldAlert;
}

function getRequestPrimaryContext(request: RequestSummary) {
  if (request.type === "NEW_HIRE") {
    const context = parseNewHirePayload(request.payload);
    return {
      title:
        context?.mode === "REHIRE"
          ? `Rehire ${request.targetUser?.nameEn ?? context.candidatePhone}`
          : `New Hire ${context?.candidatePhone ?? ""}`.trim(),
      subtitle: `${request.sourceVendor?.vendorName ?? "No Branch"} · ${request.sourceChain?.chainName ?? "No Chain"}`
    };
  }

  if (request.type === "TRANSFER") {
    return {
      title: request.targetUser?.nameEn ?? "Picker transfer",
      subtitle: `${request.sourceVendor?.vendorName ?? "Source"} → ${request.destinationVendor?.vendorName ?? "Destination"}`
    };
  }

  return {
    title: request.targetUser?.nameEn ?? formatEnum(request.type),
    subtitle: `Last working day request · ${request.sourceVendor?.vendorName ?? "No Branch"}`
  };
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const variant = status === "APPROVED" ? "default" : "muted";
  const Icon =
    status === "APPROVED"
      ? CheckCircle2
      : status === "REJECTED" || status === "CANCELLED"
        ? XCircle
        : status === "DRAFT"
          ? FileText
          : Clock;

  return (
    <Badge className="gap-1" variant={variant}>
      <Icon className="h-3 w-3" />
      {formatEnum(status)}
    </Badge>
  );
}

function ApprovalStatusBadge({ status }: { status: string }) {
  return <Badge variant={status === "APPROVED" ? "default" : "muted"}>{formatEnum(status)}</Badge>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
      {label}
    </div>
  );
}

function EmptyState({
  compact,
  message
}: {
  compact?: boolean;
  message: string;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-md border bg-background p-4 text-sm text-muted-foreground"
          : "grid place-items-center rounded-lg border bg-card p-8 text-center shadow-sm"
      }
    >
      {!compact ? <Inbox className="mb-3 h-8 w-8 text-muted-foreground" /> : null}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function parseOffboardingPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const offboarding = objectPayload.offboarding;
  const target = objectPayload.target;
  const finalization = objectPayload.finalization;

  if (
    !offboarding ||
    typeof offboarding !== "object" ||
    Array.isArray(offboarding) ||
    !target ||
    typeof target !== "object" ||
    Array.isArray(target)
  ) {
    return null;
  }

  const offboardingPayload = offboarding as Record<string, unknown>;
  const targetPayload = target as Record<string, unknown>;
  const finalizationPayload =
    finalization && typeof finalization === "object" && !Array.isArray(finalization)
      ? (finalization as Record<string, unknown>)
      : null;
  const type = offboardingPayload.type;

  if (type !== "RESIGNATION") {
    return null;
  }

  return {
    type,
    reason:
      typeof offboardingPayload.reason === "string"
        ? offboardingPayload.reason
        : "Not provided",
    notes:
      typeof offboardingPayload.notes === "string"
        ? offboardingPayload.notes
        : undefined,
    effectiveDate:
      typeof offboardingPayload.resignationDate === "string"
        ? offboardingPayload.resignationDate
        : undefined,
    pickerAssignmentId:
      typeof targetPayload.pickerAssignmentId === "string"
        ? targetPayload.pickerAssignmentId
        : "Not available",
    finalizedAt:
      typeof finalizationPayload?.completedAt === "string"
        ? finalizationPayload.completedAt
        : undefined,
    blockStatus:
      typeof finalizationPayload?.blockStatus === "string"
        ? finalizationPayload.blockStatus
        : undefined
  };
}

function parseNewHirePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidate = objectPayload.candidate;
  const mode = objectPayload.mode === "REHIRE" ? "REHIRE" : "NEW_PICKER";
  const rehire = objectPayload.rehire;
  const source = objectPayload.source;
  const finalization = objectPayload.finalization;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    return null;
  }

  const candidatePayload = candidate as Record<string, unknown>;
  const rehirePayload =
    rehire && typeof rehire === "object" && !Array.isArray(rehire)
      ? (rehire as Record<string, unknown>)
      : null;
  const finalizationPayload =
    finalization && typeof finalization === "object" && !Array.isArray(finalization)
      ? (finalization as Record<string, unknown>)
      : null;

  return {
    mode,
    candidatePhone:
      typeof candidatePayload.phoneNumber === "string"
        ? candidatePayload.phoneNumber
        : "Not available",
    nameEn:
      typeof candidatePayload.nameEn === "string"
        ? candidatePayload.nameEn
        : "Not available",
    nameAr:
      typeof candidatePayload.nameAr === "string" ? candidatePayload.nameAr : undefined,
    nationalId:
      typeof candidatePayload.nationalId === "string"
        ? candidatePayload.nationalId
        : undefined,
    address:
      typeof candidatePayload.address === "string" ? candidatePayload.address : undefined,
    rehireUserId:
      typeof rehirePayload?.userId === "string" ? rehirePayload.userId : undefined,
    finalization: finalizationPayload
      ? {
          pickerId:
            typeof finalizationPayload.pickerId === "string"
              ? finalizationPayload.pickerId
              : "Not available",
          assignmentId:
            typeof finalizationPayload.assignmentId === "string"
              ? finalizationPayload.assignmentId
              : "Not available",
          shopperId:
            typeof finalizationPayload.shopperId === "string"
              ? finalizationPayload.shopperId
              : "Not available",
          completedAt:
            typeof finalizationPayload.completedAt === "string"
              ? finalizationPayload.completedAt
              : undefined
        }
      : null
  };
}

function parseTransferPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const transfer = objectPayload.transfer;
  const source = objectPayload.source;
  const destination = objectPayload.destination;
  const target = objectPayload.target;
  const finalization = objectPayload.finalization;

  if (
    !transfer ||
    typeof transfer !== "object" ||
    Array.isArray(transfer) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    !destination ||
    typeof destination !== "object" ||
    Array.isArray(destination) ||
    !target ||
    typeof target !== "object" ||
    Array.isArray(target)
  ) {
    return null;
  }

  const transferPayload = transfer as Record<string, unknown>;
  const sourcePayload = source as Record<string, unknown>;
  const destinationPayload = destination as Record<string, unknown>;
  const targetPayload = target as Record<string, unknown>;
  const finalizationPayload =
    finalization && typeof finalization === "object" && !Array.isArray(finalization)
      ? (finalization as Record<string, unknown>)
      : null;
  const approvalPath = transferPayload.approvalPath;

  if (approvalPath !== "SAME_CHAIN" && approvalPath !== "CROSS_CHAIN") {
    return null;
  }

  return {
    approvalPath,
    reason:
      typeof transferPayload.reason === "string"
        ? transferPayload.reason
        : "Not provided",
    notes:
      typeof transferPayload.notes === "string"
        ? transferPayload.notes
        : undefined,
    requestedTransferDate:
      typeof transferPayload.requestedTransferDate === "string"
        ? transferPayload.requestedTransferDate
        : undefined,
    sourceVendorId:
      typeof sourcePayload.vendorId === "string"
        ? sourcePayload.vendorId
        : "Not available",
    sourceChainId:
      typeof sourcePayload.chainId === "string"
        ? sourcePayload.chainId
        : "Not available",
    destinationVendorId:
      typeof destinationPayload.vendorId === "string"
        ? destinationPayload.vendorId
        : "Not available",
    destinationChainId:
      typeof destinationPayload.chainId === "string"
        ? destinationPayload.chainId
        : "Not available",
    pickerId:
      typeof targetPayload.pickerId === "string"
        ? targetPayload.pickerId
        : "Not available",
    completedAt:
      typeof finalizationPayload?.completedAt === "string"
        ? finalizationPayload.completedAt
        : undefined,
    oldAssignmentId:
      typeof finalizationPayload?.oldAssignmentId === "string"
        ? finalizationPayload.oldAssignmentId
        : "Not available",
    newAssignmentId:
      typeof finalizationPayload?.newAssignmentId === "string"
        ? finalizationPayload.newAssignmentId
        : "Not available"
  };
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
