"use client";

import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Inbox,
  KeyRound,
  MoveRight,
  Plus,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
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
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import {
  assignmentsApi,
  type PickerBranchAssignment
} from "@/lib/api/assignments";
import { organizationApi, type Chain, type Vendor } from "@/lib/api/organization";
import { workspacesApi } from "@/lib/api/workspaces";
import {
  requestsApi,
  type CreateRequestPayload,
  type FinalizeOffboardingResponse,
  type FinalizeNewHireResponse,
  type NewHireLookupCandidate,
  type NewHireLookupResponse,
  type NewHireTargetRole,
  type OffboardingBlockDecision,
  type OffboardingPickerSearchItem,
  type OffboardingReasonCode,
  type RequestDetail,
  type RequestStatus,
  type RequestSummary,
  type RequestType,
  offboardingBlockDecisionLabels,
  offboardingReasonLabels
} from "@/lib/api/requests";
import type { UserRole } from "@/lib/auth/types";
import { pushRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const requestTypes: RequestType[] = [
  "NEW_HIRE",
  "RESIGNATION",
  "TRANSFER"
];
const offboardingReasonCodes: OffboardingReasonCode[] = [
  "BAD_ATTITUDE",
  "BAD_PERFORMANCE",
  "ATTENDANCE_ISSUES",
  "POLICY_VIOLATION",
  "NO_SHOW",
  "VOLUNTARY_QUIT",
  "OTHER"
];
const offboardingBlockDecisions: OffboardingBlockDecision[] = [
  "NO_BLOCK",
  "THREE_MONTHS",
  "SIX_MONTHS",
  "ONE_YEAR",
  "PERMANENT"
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

function getRequestLoadErrorMessage(caughtError: unknown) {
  const error = caughtError as { message?: string; status?: number } | null;
  const message = error?.message;

  if (
    error?.status === 404 ||
    (message && /not found|no longer available/i.test(message))
  ) {
    return "Request no longer available.";
  }

  return message ?? "Unable to load request.";
}

type OperationsMode = "action" | "submitted" | "open" | "completed" | "rejected";
type NewHireEntityStatus = "ACTIVE" | "INACTIVE";
type NewHireChainSource = {
  id: string;
  chainName: string;
  chainCode: string;
  status?: NewHireEntityStatus;
};
type NewHireVendorSource = {
  id: string;
  vendorName: string;
  vendorCode: string;
  vendorExternalId?: string | null;
  status?: NewHireEntityStatus;
  chainId: string;
  area?: string | null;
  city?: string | null;
  chain?: NewHireChainSource;
};
type NewHireChainOption = Required<NewHireChainSource>;
type NewHireVendorOption = Omit<Required<NewHireVendorSource>, "chain"> & {
  chain: NewHireChainOption;
};
export type LockedNewHireBranchContext = {
  vendor: NewHireVendorSource;
  chain: NewHireChainSource;
};
type NewRequestDraft =
  | { type: "NEW_HIRE"; targetRole: NewHireTargetRole }
  | { type: "RESIGNATION" | "TRANSFER" };

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
      setError(getRequestLoadErrorMessage(caughtError));
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
              ) &&
              !(
                request.type === "RESIGNATION" &&
                actionableApproval.step === "AREA_MANAGER_APPROVAL"
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

              {actionableApproval &&
              request.type === "RESIGNATION" &&
              actionableApproval.step === "AREA_MANAGER_APPROVAL" ? (
                <ResignationAreaManagerApprovalPanel
                  approvalId={actionableApproval.id}
                  onApproved={async () => {
                    await loadRequest();
                    await onChanged();
                  }}
                />
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
                  request={request}
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
                  request={request}
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
    return <NewHireRequestDetailPanel request={request} />;
  }

  if (request.type === "TRANSFER") {
    return (
      <InfoCard title="Transfer Details">
        <TransferContext payload={request.payload} request={request} />
      </InfoCard>
    );
  }

  return (
    <ResignationRequestDetailPanel request={request} />
  );
}

function ResignationRequestDetailPanel({ request }: { request: RequestDetail }) {
  const context = parseOffboardingPayload(request.payload);

  if (!context) {
    return (
      <InfoCard title="Resignation">
        <EmptyState message="No Resignation context is available." compact />
      </InfoCard>
    );
  }

  return (
    <InfoCard title="Resignation">
      <div className="flex flex-wrap gap-2">
        <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
          Picker
        </Badge>
        <Badge variant="outline">{formatEnum(request.status)}</Badge>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex min-w-0 items-start gap-3">
          <PickerAvatar name={request.targetUser?.nameEn ?? "Picker"} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {request.targetUser?.nameEn ?? context.pickerId}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {request.targetUser?.phoneNumber ?? "Phone not available"} ·{" "}
              {request.sourceVendor?.vendorName ?? context.sourceVendorId}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <Definition
            label="Source Branch"
            value={request.sourceVendor?.vendorName ?? context.sourceVendorId}
          />
          <Definition
            label="Source Chain"
            value={request.sourceChain?.chainName ?? context.sourceChainId}
          />
          <Definition label="Assignment" value={context.pickerAssignmentId} />
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <Definition label="Last working day" value={context.effectiveDate} />
        <Definition label="Reason" value={context.reason} />
        <Definition label="Reason details" value={context.reasonDetails ?? "None"} />
        <Definition label="Notes" value={context.notes ?? "None"} />
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-950">
          Area Manager block recommendation
        </p>
        {context.areaManagerDecision ? (
          <>
            <Definition
              label="Decision"
              value={formatOffboardingBlockDecision(
                context.areaManagerDecision.blockDecision
              )}
            />
            <Definition
              label="Block status"
              value={formatEnum(context.areaManagerDecision.blockStatus)}
            />
            <Definition
              label="Block reason"
              value={context.areaManagerDecision.blockReason ?? "No block"}
            />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Waiting for Area Manager block decision.
          </p>
        )}
      </div>
      {context.finalization ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-950">Admin final result</p>
          <Definition
            label="Decision"
            value={formatOffboardingBlockDecision(context.finalization.blockDecision)}
          />
          <Definition
            label="Block status"
            value={formatEnum(context.finalization.blockStatus)}
          />
          <Definition
            label="Blocked until"
            value={context.finalization.blockedUntil ?? "Not applicable"}
          />
          <Definition
            label="Completed"
            value={new Date(context.finalization.completedAt).toLocaleString()}
          />
        </div>
      ) : null}
    </InfoCard>
  );
}

function NewHireRequestDetailPanel({ request }: { request: RequestDetail }) {
  const context = parseNewHirePayload(request.payload);

  if (!context) {
    return (
      <InfoCard title="New Hire">
        <EmptyState message="No New Hire context is available." compact />
      </InfoCard>
    );
  }

  const isRehire = context.mode === "REHIRE";
  const selectedChainText =
    context.targetRole === "AREA_MANAGER"
      ? [
          request.sourceChain?.chainName,
          ...(context.source.chainIds ?? []).filter(
            (chainId) => chainId !== request.sourceChain?.id
          )
        ]
          .filter(Boolean)
          .join(", ") || "Not available"
      : request.sourceChain?.chainName ?? context.source.chainId ?? "Not available";

  return (
    <InfoCard title="New Hire">
      <div className="flex flex-wrap gap-2">
        <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
          {formatEnum(context.targetRole)}
        </Badge>
        <Badge variant="outline">{isRehire ? "Rehire" : "New User"}</Badge>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <Definition label="Candidate" value={context.nameEn ?? "Not available"} />
        <Definition label="Phone" value={context.candidatePhone} />
        <Definition
          label="National ID"
          value={context.nationalId ? maskNationalId(context.nationalId) : "Not available"}
        />
        <Definition label="Arabic name" value={context.nameAr ?? "Not available"} />
        <Definition label="Date of birth" value={context.dateOfBirth ?? "Not available"} />
        <Definition label="Gender" value={formatEnum(context.gender)} />
        <Definition label="Address" value={context.address ?? "Not available"} />
        <Definition label="Notes" value={context.notes ?? "None"} />
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <Definition label="Source Chain" value={selectedChainText} />
        {context.targetRole !== "AREA_MANAGER" ? (
          <Definition
            label="Source Branch"
            value={request.sourceVendor?.vendorName ?? context.source.vendorId ?? "Not available"}
          />
        ) : (
          <Definition
            label="Selected Chain IDs"
            value={(context.source.chainIds ?? []).join(", ") || "Not available"}
          />
        )}
        <Definition label="Creator" value={request.createdBy.nameEn} />
        {context.rehireUserId ? (
          <Definition label="Previous Picker ID" value={context.rehireUserId} />
        ) : null}
      </div>

      <NewHireApprovalPathDetail request={request} targetRole={context.targetRole} />

      {context.finalization ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <Definition label="Finalized user" value={context.finalization.userId} />
          {request.targetUser ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              href={`/admin/users?userId=${request.targetUser.id}`}
              prefetch
            >
              Open user profile
            </Link>
          ) : null}
          <Definition
            label="Assignment type"
            value={context.finalization.assignmentType}
          />
          <Definition
            label="Assignment result"
            value={
              context.finalization.assignmentId ??
              context.finalization.assignmentIds?.join(", ") ??
              "Not available"
            }
          />
          <Definition
            label="Shopper ID"
            value={context.finalization.shopperId ?? "Not required"}
          />
          <Definition
            label="Completed"
            value={
              context.finalization.completedAt
                ? new Date(context.finalization.completedAt).toLocaleString()
                : "Not available"
            }
          />
        </div>
      ) : null}
    </InfoCard>
  );
}

function NewHireApprovalPathDetail({
  request,
  targetRole
}: {
  request: RequestDetail;
  targetRole: NewHireTargetRole;
}) {
  const steps = buildNewHireApprovalSteps(request.createdBy.role, targetRole);
  const areaManagerApproval = request.approvals.find(
    (approval) => approval.step === "AREA_MANAGER_APPROVAL"
  );

  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-950">Approval path</p>
      {steps.map((step, index) => {
        const isAreaManagerStep = step.label === "Area Manager approval";
        const skipped = isAreaManagerStep
          ? areaManagerApproval?.status === "SKIPPED" || step.skipped
          : step.skipped;
        return (
          <div className="flex items-start gap-3 text-sm" key={`${step.label}:${index}`}>
            <span
              className={cn(
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                skipped
                  ? "bg-slate-100 text-slate-500"
                  : "bg-orange-50 text-orange-700"
              )}
            >
              {index + 1}
            </span>
            <div>
              <p className="font-medium text-slate-950">
                {step.label}
                {skipped ? " (skipped)" : ""}
              </p>
              <p className="text-xs leading-5 text-slate-500">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toNewHireChainOption(chain: NewHireChainSource): NewHireChainOption {
  return {
    id: chain.id,
    chainName: chain.chainName,
    chainCode: chain.chainCode,
    status: chain.status ?? "ACTIVE"
  };
}

function toNewHireVendorOption(
  vendor: NewHireVendorSource,
  chain?: NewHireChainSource
): NewHireVendorOption {
  const resolvedChain = toNewHireChainOption(
    chain ??
      vendor.chain ?? {
        id: vendor.chainId,
        chainName: "Selected Chain",
        chainCode: "",
        status: "ACTIVE"
      }
  );

  return {
    id: vendor.id,
    vendorName: vendor.vendorName,
    vendorCode: vendor.vendorCode,
    vendorExternalId: vendor.vendorExternalId ?? null,
    status: vendor.status ?? "ACTIVE",
    chainId: vendor.chainId,
    area: vendor.area ?? null,
    city: vendor.city ?? null,
    chain: resolvedChain
  };
}

function uniqueNewHireChains(chains: NewHireChainOption[]) {
  return Array.from(new Map(chains.map((chain) => [chain.id, chain])).values());
}

function isActiveNewHireEntity(entity: { status?: NewHireEntityStatus }) {
  return !entity.status || entity.status === "ACTIVE";
}

function applyFixedNewHireBranch(
  fixedSourceVendorId: string | undefined,
  vendorOptions: NewHireVendorOption[],
  setForm: Dispatch<
    SetStateAction<{
      targetRole: NewHireTargetRole;
      sourceChainId: string;
      sourceVendorId: string;
      chainIds: string[];
      nameEn: string;
      nameAr: string;
      phoneNumber: string;
      nationalId: string;
      dateOfBirth: string;
      gender: "MALE" | "FEMALE" | "UNSPECIFIED";
      address: string;
      notes: string;
    }>
  >
) {
  if (!fixedSourceVendorId) {
    return;
  }

  const fixedVendor = vendorOptions.find((vendor) => vendor.id === fixedSourceVendorId);
  setForm((current) => ({
    ...current,
    sourceVendorId: fixedSourceVendorId,
    sourceChainId: fixedVendor?.chainId ?? current.sourceChainId
  }));
}

export function NewHireRequestForm({
  fixedSourceVendorId,
  initialTargetRole = "PICKER",
  lockedBranchContext,
  lockTargetRole = false,
  onDirtyChange,
  onCreated
}: {
  fixedSourceVendorId?: string;
  initialTargetRole?: NewHireTargetRole;
  lockedBranchContext?: LockedNewHireBranchContext;
  lockTargetRole?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const { user } = useAuth();
  const [chains, setChains] = useState<NewHireChainOption[]>([]);
  const [vendors, setVendors] = useState<NewHireVendorOption[]>([]);
  const [form, setForm] = useState({
    targetRole: initialTargetRole,
    sourceChainId: "",
    sourceVendorId: "",
    chainIds: [] as string[],
    nameEn: "",
    nameAr: "",
    phoneNumber: "",
    nationalId: "",
    dateOfBirth: "",
    gender: "UNSPECIFIED" as "MALE" | "FEMALE" | "UNSPECIFIED",
    address: "",
    notes: ""
  });
  const [chainQuery, setChainQuery] = useState("");
  const [branchQuery, setBranchQuery] = useState("");
  const [lookupResponse, setLookupResponse] =
    useState<NewHireLookupResponse | null>(null);
  const [selectedRehireUserId, setSelectedRehireUserId] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "checking" | "checked">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isPending, startTransition] = useTransition();
  const branchLocked = Boolean(fixedSourceVendorId);

  const allowedTargetRoles = useMemo(
    () => getAllowedNewHireTargetRoles(user?.role, branchLocked),
    [branchLocked, user?.role]
  );

  useEffect(() => {
    if (fixedSourceVendorId) {
      setForm((current) => ({ ...current, sourceVendorId: fixedSourceVendorId }));
    }
    let mounted = true;
    async function loadVendors() {
      setIsLoadingVendors(true);
      setError(null);
      try {
        if (fixedSourceVendorId && lockedBranchContext) {
          const chainOption = toNewHireChainOption(lockedBranchContext.chain);
          const vendorOption = toNewHireVendorOption(
            lockedBranchContext.vendor,
            chainOption
          );
          if (mounted) {
            setChains([chainOption]);
            setVendors([vendorOption]);
            applyFixedNewHireBranch(fixedSourceVendorId, [vendorOption], setForm);
          }
          return;
        }

        if (user?.role === "CHAMP") {
          const workspace = await workspacesApi.champBranches();
          if (!mounted) {
            return;
          }

          const visibleBranches = workspace.branches.filter(
            (branch) =>
              isActiveNewHireEntity(branch.chain) &&
              isActiveNewHireEntity(branch.vendor) &&
              (!fixedSourceVendorId || branch.vendor.id === fixedSourceVendorId)
          );
          const chainOptions = uniqueNewHireChains(
            visibleBranches.map((branch) => toNewHireChainOption(branch.chain))
          );
          const vendorOptions = visibleBranches.map((branch) =>
            toNewHireVendorOption(branch.vendor, branch.chain)
          );

          setChains(chainOptions);
          setVendors(vendorOptions);
          applyFixedNewHireBranch(fixedSourceVendorId, vendorOptions, setForm);
          return;
        }

        if (user?.role === "AREA_MANAGER") {
          const workspace = await workspacesApi.areaManager();
          if (!mounted) {
            return;
          }

          const activeChains = workspace.chains.filter((chain) =>
            isActiveNewHireEntity(chain.chain)
          );
          const chainOptions = uniqueNewHireChains(
            activeChains.map((chain) => toNewHireChainOption(chain.chain))
          );
          const vendorOptions = activeChains.flatMap((chain) =>
            chain.vendors
              .filter(
                (branch) =>
                  isActiveNewHireEntity(branch.vendor) &&
                  (!fixedSourceVendorId ||
                    branch.vendor.id === fixedSourceVendorId)
              )
              .map((branch) => toNewHireVendorOption(branch.vendor, chain.chain))
          );

          setChains(chainOptions);
          setVendors(vendorOptions);
          applyFixedNewHireBranch(fixedSourceVendorId, vendorOptions, setForm);
          return;
        }

        if (fixedSourceVendorId) {
          if (mounted) {
            setChains([]);
            setVendors([]);
            setError("Selected Branch context was not provided.");
          }
          return;
        }

        if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
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
            Array.from(
              { length: Math.max(0, first.meta.totalPages - 1) },
              (_, index) =>
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
            const allChains = [
              ...chainFirst.items,
              ...chainRest.flatMap((page) => page.items)
            ].map((chain) => toNewHireChainOption(chain));
            const allVendors = [
              ...first.items,
              ...rest.flatMap((page) => page.items)
            ].map((vendor) => toNewHireVendorOption(vendor));

            setChains(allChains);
            setVendors(allVendors);
          }
          return;
        }

        if (mounted) {
          setChains([]);
          setVendors([]);
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
  }, [fixedSourceVendorId, lockedBranchContext, user?.role]);

  useEffect(() => {
    if (!allowedTargetRoles.length) {
      return;
    }
    setForm((current) =>
      allowedTargetRoles.includes(current.targetRole)
        ? current
        : {
            ...current,
            targetRole: allowedTargetRoles[0],
            chainIds: [],
            sourceChainId: fixedSourceVendorId ? current.sourceChainId : "",
            sourceVendorId: fixedSourceVendorId ?? ""
          }
    );
  }, [allowedTargetRoles, fixedSourceVendorId]);

  useEffect(() => {
    if (!lockTargetRole) {
      return;
    }

    setForm((current) =>
      current.targetRole === initialTargetRole
        ? current
        : {
            ...current,
            targetRole: initialTargetRole,
            chainIds: initialTargetRole === "AREA_MANAGER" ? current.chainIds : [],
            sourceChainId:
              initialTargetRole === "AREA_MANAGER" && !fixedSourceVendorId
                ? ""
                : current.sourceChainId,
            sourceVendorId:
              initialTargetRole === "AREA_MANAGER" && !fixedSourceVendorId
                ? ""
                : current.sourceVendorId
          }
    );
  }, [fixedSourceVendorId, initialTargetRole, lockTargetRole]);

  useEffect(() => {
    if (isLoadingVendors || branchLocked) {
      return;
    }

    setForm((current) => {
      if (current.targetRole === "AREA_MANAGER") {
        if (current.chainIds.length || chains.length !== 1) {
          return current;
        }

        return {
          ...current,
          chainIds: [chains[0].id],
          sourceChainId: chains[0].id
        };
      }

      if (current.sourceVendorId) {
        return current;
      }

      const nextChainId =
        current.sourceChainId || (chains.length === 1 ? chains[0].id : "");
      const branchOptions = vendors.filter(
        (vendor) => !nextChainId || vendor.chainId === nextChainId
      );
      const nextVendorId = branchOptions.length === 1 ? branchOptions[0].id : "";

      if (
        nextChainId === current.sourceChainId &&
        nextVendorId === current.sourceVendorId
      ) {
        return current;
      }

      return {
        ...current,
        sourceChainId: nextChainId,
        sourceVendorId: nextVendorId
      };
    });
  }, [branchLocked, chains, form.targetRole, isLoadingVendors, vendors]);

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        form.nameEn.trim() ||
          form.nameAr.trim() ||
          form.phoneNumber.trim() ||
          form.nationalId.trim() ||
          form.dateOfBirth ||
          form.gender !== "UNSPECIFIED" ||
          form.address.trim() ||
          form.notes.trim()
      )
    );
  }, [
    form.address,
    form.dateOfBirth,
    form.gender,
    form.nameAr,
    form.nameEn,
    form.nationalId,
    form.notes,
    form.phoneNumber,
    onDirtyChange
  ]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetLookup() {
    setLookupResponse(null);
    setLookupState("idle");
    setSelectedRehireUserId("");
  }

  function updateTargetRole(targetRole: NewHireTargetRole) {
    setError(null);
    resetLookup();
    setForm((current) => ({
      ...current,
      targetRole,
      chainIds: targetRole === "AREA_MANAGER" ? current.chainIds : [],
      sourceChainId:
        targetRole === "AREA_MANAGER" && !fixedSourceVendorId
          ? ""
          : current.sourceChainId,
      sourceVendorId:
        targetRole === "AREA_MANAGER" && !fixedSourceVendorId
          ? ""
          : current.sourceVendorId
    }));
  }

  function updateIdentityField(name: "phoneNumber" | "nationalId", value: string) {
    const numericValue = value.replace(/\D/g, "");
    setForm((current) => ({
      ...current,
      [name]: numericValue
    }));
    resetLookup();
    setError(null);
  }

  const isPhoneValid = isValidEgyptPhone(form.phoneNumber);
  const isNationalIdValid = isValidEgyptNationalId(form.nationalId);
  const isBranchTarget = form.targetRole === "PICKER" || form.targetRole === "CHAMP";
  const isAreaManagerTarget = form.targetRole === "AREA_MANAGER";
  const selectedVendor = vendors.find((vendor) => vendor.id === form.sourceVendorId);
  const selectedChain = chains.find((chain) => chain.id === form.sourceChainId);
  const selectedChains = chains.filter((chain) => form.chainIds.includes(chain.id));
  const lookupContextReady = isAreaManagerTarget
    ? form.chainIds.length > 0
    : Boolean(form.sourceVendorId);
  const canLookupCandidate =
    lookupContextReady && (isPhoneValid || isNationalIdValid);
  const chainSearchResults = chains
    .filter((chain) => {
      const query = chainQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [chain.chainName, chain.chainCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .slice(0, 10);
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
  const lookupStatus = lookupResponse?.status;
  const lookupCandidates = lookupResponse?.candidates ?? [];
  const rehireCandidate =
    form.targetRole === "PICKER"
      ? lookupCandidates.find((candidate) => candidate.decision === "REHIRE_AVAILABLE")
      : undefined;
  const blockingCandidate = lookupCandidates.find((candidate) =>
    isBlockingNewHireDecision(candidate.decision)
  );
  const canShowCandidateForm = lookupStatus === "CLEAR";
  const canSubmit =
    !isPending &&
    lookupContextReady &&
    isPhoneValid &&
    isNationalIdValid &&
    (lookupStatus === "CLEAR" || lookupStatus === "REHIRE_AVAILABLE") &&
    !blockingCandidate &&
    (lookupStatus !== "CLEAR" || Boolean(form.nameEn.trim())) &&
    (lookupStatus !== "REHIRE_AVAILABLE" || Boolean(selectedRehireUserId));

  useEffect(() => {
    const phoneNumber = form.phoneNumber.trim();
    const nationalId = form.nationalId.trim();

    if (!canLookupCandidate) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLookupState("checking");
      startTransition(async () => {
        try {
          const result = await requestsApi.lookupNewHireCandidate({
            targetRole: form.targetRole,
            sourceVendorId: form.sourceVendorId || undefined,
            sourceChainId: form.sourceChainId || undefined,
            chainIds: isAreaManagerTarget ? form.chainIds : undefined,
            phoneNumber: isPhoneValid ? phoneNumber : undefined,
            nationalId: isNationalIdValid ? nationalId : undefined
          });
          if (cancelled) {
            return;
          }

          const rehireCandidate = result.candidates.find(
            (candidate) => candidate.decision === "REHIRE_AVAILABLE"
          );
          setLookupResponse(result);
          setSelectedRehireUserId(rehireCandidate?.user.id ?? "");
          setLookupState("checked");
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
  }, [
    canLookupCandidate,
    form.chainIds,
    form.nationalId,
    form.phoneNumber,
    form.sourceChainId,
    form.sourceVendorId,
    form.targetRole,
    isAreaManagerTarget,
    isNationalIdValid,
    isPhoneValid
  ]);

  function updateSourceChain(chainId: string) {
    setForm((current) => ({
      ...current,
      sourceChainId: chainId,
      sourceVendorId: ""
    }));
    setBranchQuery("");
    resetLookup();
  }

  function selectBranch(vendor: NewHireVendorOption) {
    setForm((current) => ({
      ...current,
      sourceChainId: vendor.chainId,
      sourceVendorId: vendor.id
    }));
    resetLookup();
  }

  function toggleChain(chainId: string) {
    setForm((current) => {
      const chainIds = current.chainIds.includes(chainId)
        ? current.chainIds.filter((id) => id !== chainId)
        : [...current.chainIds, chainId];
      return {
        ...current,
        chainIds,
        sourceChainId: chainIds[0] ?? ""
      };
    });
    resetLookup();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowedTargetRoles.includes(form.targetRole)) {
      setError("This New Hire target role is not available for your workspace.");
      return;
    }
    if (!isPhoneValid) {
      setError("Phone number must be 11 digits and start with 010, 011, 012, or 015.");
      return;
    }
    if (!isNationalIdValid) {
      setError("National ID must be exactly 14 digits.");
      return;
    }
    if (isBranchTarget && !form.sourceVendorId) {
      setError("Select the Chain and Branch before submitting New Hire.");
      return;
    }
    if (isAreaManagerTarget && !form.chainIds.length) {
      setError("Select at least one Chain before creating an Area Manager.");
      return;
    }
    if (!lookupResponse) {
      setError("Wait for candidate lookup before submitting.");
      return;
    }
    if (lookupStatus === "REHIRE_AVAILABLE" && !selectedRehireUserId) {
      setError("Select the previous Picker before submitting this Rehire.");
      return;
    }
    if (blockingCandidate) {
      setError(blockingCandidate.reason ?? "This candidate cannot be hired.");
      return;
    }
    if (lookupStatus === "CLEAR" && !form.nameEn.trim()) {
      setError("English name is required for a new user.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createNewHire({
          targetRole: form.targetRole,
          sourceVendorId: isBranchTarget ? form.sourceVendorId : undefined,
          sourceChainId: isAreaManagerTarget
            ? form.chainIds[0]
            : form.sourceChainId || selectedVendor?.chainId || undefined,
          chainIds: isAreaManagerTarget ? form.chainIds : undefined,
          rehireUserId:
            lookupStatus === "REHIRE_AVAILABLE"
              ? selectedRehireUserId || undefined
              : undefined,
          nameEn: lookupStatus === "CLEAR" ? form.nameEn || undefined : undefined,
          nameAr: lookupStatus === "CLEAR" ? form.nameAr || undefined : undefined,
          phoneNumber: form.phoneNumber,
          nationalId: form.nationalId,
          dateOfBirth:
            lookupStatus === "CLEAR" ? form.dateOfBirth || undefined : undefined,
          gender: lookupStatus === "CLEAR" ? form.gender : undefined,
          address: lookupStatus === "CLEAR" ? form.address || undefined : undefined,
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

      {!lockTargetRole ? (
        <NewHireFormSection
          description="Choose only the role this workspace can submit."
          title="Target role"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {allowedTargetRoles.map((role) => (
              <button
                className={cn(
                  "min-h-12 rounded-xl border p-3 text-left text-sm font-semibold transition-colors",
                  form.targetRole === role
                    ? "border-orange-300 bg-orange-50 text-orange-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-200"
                )}
                key={role}
                onClick={() => updateTargetRole(role)}
                type="button"
              >
                {formatEnum(role)}
              </button>
            ))}
          </div>
        </NewHireFormSection>
      ) : null}

      <NewHireFormSection
        description={
          branchLocked
            ? "The Branch is locked from the current workspace."
            : isAreaManagerTarget
              ? "Area Managers are assigned directly to one or more Chains."
              : "Select a Chain first, then choose a Branch from the scoped search."
        }
        title="Operational context"
      >
        {branchLocked ? (
          <SelectedContextCard
            loading={isLoadingVendors}
            selectedChain={selectedVendor?.chain ?? selectedChain ?? null}
            selectedVendor={selectedVendor ?? null}
          />
        ) : isAreaManagerTarget ? (
          <div className="grid gap-3">
            <Field label="Chain search">
              <Input
                className="h-11 rounded-xl bg-white"
                disabled={isLoadingVendors}
                onChange={(event) => setChainQuery(event.target.value)}
                placeholder="Search Chain name or code"
                value={chainQuery}
              />
            </Field>
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chainSearchResults.map((chain) => (
                <button
                  className={cn(
                    "min-h-12 rounded-xl border bg-white p-3 text-left text-sm transition-colors",
                    form.chainIds.includes(chain.id)
                      ? "border-orange-300 bg-orange-50 text-orange-950"
                      : "border-slate-200 text-slate-700 hover:border-orange-200"
                  )}
                  key={chain.id}
                  onClick={() => toggleChain(chain.id)}
                  type="button"
                >
                  <span className="block font-semibold">{chain.chainName}</span>
                  <span className="block text-xs text-slate-500">
                    {chain.chainCode}
                  </span>
                </button>
              ))}
              {!chainSearchResults.length ? (
                <EmptyState message="No Chain matches this search." compact />
              ) : null}
            </div>
            {selectedChains.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedChains.map((chain) => (
                  <Badge key={chain.id} variant="outline">
                    {chain.chainName}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chain search">
                <Input
                  className="h-11 rounded-xl bg-white"
                  disabled={isLoadingVendors}
                  onChange={(event) => setChainQuery(event.target.value)}
                  placeholder="Search Chain name or code"
                  value={chainQuery}
                />
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chainSearchResults.map((chain) => (
                  <button
                    className={cn(
                      "min-h-12 rounded-xl border bg-white p-3 text-left text-sm transition-colors",
                      form.sourceChainId === chain.id
                        ? "border-orange-300 bg-orange-50 text-orange-950"
                        : "border-slate-200 text-slate-700 hover:border-orange-200"
                    )}
                    key={chain.id}
                    onClick={() => updateSourceChain(chain.id)}
                    type="button"
                  >
                    <span className="block font-semibold">{chain.chainName}</span>
                    <span className="block text-xs text-slate-500">
                      {chain.chainCode}
                    </span>
                  </button>
                ))}
                {!chainSearchResults.length ? (
                  <EmptyState message="No Chain matches this search." compact />
                ) : null}
              </div>
              <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {form.sourceChainId ? (
                  filteredVendors.slice(0, 12).map((vendor) => (
                    <button
                      className={cn(
                        "min-h-12 rounded-xl border bg-white p-3 text-left text-sm transition-colors",
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
                        {vendor.vendorCode} / {vendor.chain.chainName}
                      </span>
                    </button>
                  ))
                ) : (
                  <EmptyState message="Select a Chain to load Branches." compact />
                )}
                {form.sourceChainId && !filteredVendors.length ? (
                  <EmptyState message="No Branch matches this Chain/search." compact />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </NewHireFormSection>

      <NewHireFormSection
        description="Lookup starts only after a valid Egyptian phone number or National ID is entered."
        title="Candidate identity"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone number">
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              maxLength={11}
              onChange={(event) =>
                updateIdentityField("phoneNumber", event.target.value)
              }
              placeholder="01012345678"
              required
              value={form.phoneNumber}
            />
          </Field>
          <Field label="National ID">
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              maxLength={14}
              onChange={(event) =>
                updateIdentityField("nationalId", event.target.value)
              }
              placeholder="14 digits"
              required
              value={form.nationalId}
            />
          </Field>
        </div>
        <div className="grid gap-1 text-xs text-slate-500">
          {form.phoneNumber && !isPhoneValid ? (
            <span>Phone must be 11 digits and start with 010, 011, 012, or 015.</span>
          ) : null}
          {form.nationalId && !isNationalIdValid ? (
            <span>National ID must be exactly 14 digits.</span>
          ) : null}
          {!lookupContextReady ? (
            <span>Select the operational context before lookup can run.</span>
          ) : null}
        </div>
      </NewHireFormSection>

      {lookupState === "checking" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Checking existing user records...
        </div>
      ) : null}

      {lookupStatus && lookupStatus !== "CLEAR" ? (
        <NewHireLookupResultCard
          candidate={blockingCandidate ?? rehireCandidate ?? lookupCandidates[0]}
          status={lookupStatus}
        />
      ) : null}

      {canShowCandidateForm ? (
        <>
          <NewHireFormSection description="Core profile fields for the requested user." title="Identity">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name English">
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("nameEn", event.target.value)}
                  required
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
            </div>
          </NewHireFormSection>
          <NewHireFormSection description="Optional personal fields used by the operational profile." title="Personal details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date of birth">
                <DatePicker
                  onChange={(value) => updateField("dateOfBirth", value)}
                  placeholder="Select birth date"
                  startYear={2000}
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
          </NewHireFormSection>
          <NewHireFormSection description="Contact location and operational notes." title="Contact and notes">
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
          </NewHireFormSection>
        </>
      ) : lookupStatus === "REHIRE_AVAILABLE" ? (
        <NewHireFormSection
          description="Previous safe profile data is read-only for Rehire submission."
          title="Previous Picker"
        >
          <PreviousPickerCard candidate={rehireCandidate} />
          <Field label="Notes">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => updateField("notes", event.target.value)}
              value={form.notes}
            />
          </Field>
        </NewHireFormSection>
      ) : null}

      <NewHireApprovalPreview
        creatorRole={user?.role}
        targetRole={form.targetRole}
      />

      <NewHireReviewCard
        creatorName={user?.nameEn ?? "Current user"}
        mode={lookupStatus === "REHIRE_AVAILABLE" ? "REHIRE" : "NEW_USER"}
        nationalId={form.nationalId}
        phoneNumber={form.phoneNumber}
        selectedChains={selectedChains}
        selectedVendor={selectedVendor ?? null}
        targetRole={form.targetRole}
      />

      <div className="flex justify-end">
        <Button
          className="min-h-11 rounded-xl bg-orange-600 hover:bg-orange-700"
          disabled={!canSubmit}
          type="submit"
        >
          {isPending ? "Submitting..." : getNewHireSubmitLabel(form.targetRole)}
        </Button>
      </div>
    </form>
  );
}

function NewHireFormSection({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="grid min-w-0 gap-3">{children}</div>
    </section>
  );
}

function SelectedContextCard({
  loading,
  selectedChain,
  selectedVendor
}: {
  loading: boolean;
  selectedChain: Pick<NewHireChainOption, "chainCode" | "chainName"> | null;
  selectedVendor: NewHireVendorOption | null;
}) {
  if (loading) {
    return <EmptyState message="Loading selected Branch context." compact />;
  }

  if (!selectedVendor) {
    return <EmptyState message="Selected Branch context was not found." compact />;
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{selectedVendor.vendorName}</p>
          <p className="mt-1 text-xs text-slate-500">{selectedVendor.vendorCode}</p>
        </div>
        <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
          Branch locked
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600">
        <span>Chain: {selectedChain?.chainName ?? selectedVendor.chain.chainName}</span>
        <span>Code: {selectedChain?.chainCode ?? selectedVendor.chain.chainCode}</span>
      </div>
    </div>
  );
}

function NewHireLookupResultCard({
  candidate,
  status
}: {
  candidate?: NewHireLookupCandidate;
  status: NewHireLookupResponse["status"];
}) {
  const isRehire = status === "REHIRE_AVAILABLE";
  const title =
    status === "ACTIVE_DUPLICATE"
      ? "Active duplicate found"
      : status === "TEMPORARY_BLOCKED"
        ? "Temporary block is active"
        : status === "PERMANENT_BLOCKED"
          ? "Permanent block is active"
          : isRehire
            ? "Rehire available"
            : "Candidate cannot be submitted";
  const body =
    status === "ACTIVE_DUPLICATE"
      ? "This user already exists and is active. New Hire submission is disabled."
      : status === "TEMPORARY_BLOCKED"
        ? "This Picker cannot be rehired until the temporary block expires."
        : status === "PERMANENT_BLOCKED"
          ? "Admin must remove the permanent block from the user profile before Rehire."
          : isRehire
            ? "SuperNova found a previous Picker. Submit this as a Rehire without editing old profile data."
            : "This candidate cannot be hired right now.";

  return (
    <section
      className={cn(
        "rounded-2xl border p-4 text-sm",
        isRehire
          ? "border-orange-200 bg-orange-50 text-orange-950"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      <div className="flex items-start gap-3">
        {isRehire ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 leading-6">{candidate?.reason ?? body}</p>
          {candidate ? (
            <div className="mt-3 grid gap-2 rounded-xl bg-white/75 p-3 text-slate-700">
              <Definition label="User" value={candidate.user.nameEn} />
              <Definition label="Role" value={formatEnum(candidate.role)} />
              <Definition label="Status" value={formatEnum(candidate.employmentStatus)} />
              <Definition
                label="National ID"
                value={candidate.maskedNationalId ?? "Masked"}
              />
              <Definition
                label="Last Branch"
                value={candidate.lastBranch?.vendorName ?? "Not available"}
              />
              <Definition
                label="Last Chain"
                value={candidate.lastChain?.chainName ?? "Not available"}
              />
              {candidate.blockReason ? (
                <Definition label="Block reason" value={candidate.blockReason} />
              ) : null}
              {candidate.blockedUntil ? (
                <Definition
                  label="Blocked until"
                  value={new Date(candidate.blockedUntil).toLocaleDateString()}
                />
              ) : null}
              {candidate.remainingDays !== undefined && candidate.remainingDays !== null ? (
                <Definition label="Remaining days" value={String(candidate.remainingDays)} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PreviousPickerCard({
  candidate
}: {
  candidate?: NewHireLookupCandidate;
}) {
  if (!candidate) {
    return <EmptyState message="Previous Picker details are not available." compact />;
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-orange-200 bg-white p-3 text-sm">
      <Definition label="Name" value={candidate.user.nameEn} />
      <Definition label="Phone" value={candidate.user.phoneNumber} />
      <Definition
        label="National ID"
        value={candidate.maskedNationalId ?? "Masked"}
      />
      <Definition label="Status" value={formatEnum(candidate.employmentStatus)} />
      <Definition
        label="Last Branch"
        value={candidate.lastBranch?.vendorName ?? "Not available"}
      />
      <Definition
        label="Last Chain"
        value={candidate.lastChain?.chainName ?? "Not available"}
      />
    </div>
  );
}

function NewHireApprovalPreview({
  creatorRole,
  targetRole
}: {
  creatorRole?: UserRole;
  targetRole: NewHireTargetRole;
}) {
  const steps = buildNewHireApprovalSteps(creatorRole, targetRole);

  return (
    <NewHireFormSection
      description="Expected workflow after submission. Backend scope checks remain the source of truth."
      title="Approval path preview"
    >
      <div className="grid gap-2">
        {steps.map((step, index) => (
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-white p-3 text-sm",
              step.skipped ? "border-slate-200 text-slate-500" : "border-orange-100"
            )}
            key={`${step.label}:${index}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-semibold text-orange-700">
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-slate-950">
                {step.label}
                {step.skipped ? " (skipped)" : ""}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </NewHireFormSection>
  );
}

function NewHireReviewCard({
  creatorName,
  mode,
  nationalId,
  phoneNumber,
  selectedChains,
  selectedVendor,
  targetRole
}: {
  creatorName: string;
  mode: "NEW_USER" | "REHIRE";
  nationalId: string;
  phoneNumber: string;
  selectedChains: NewHireChainOption[];
  selectedVendor: NewHireVendorOption | null;
  targetRole: NewHireTargetRole;
}) {
  const expectedNextStep =
    targetRole === "AREA_MANAGER"
      ? "Account and Chain assignment created immediately"
      : targetRole === "PICKER"
        ? "Admin finalization with Shopper ID"
        : "Admin finalization without Shopper ID";

  return (
    <NewHireFormSection
      description="Confirm the request contract before submission."
      title="Review"
    >
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
        <Definition label="Target role" value={formatEnum(targetRole)} />
        <Definition
          label="Mode"
          value={mode === "REHIRE" ? "Rehire" : "New User"}
        />
        <Definition
          label="Selected Chain"
          value={
            targetRole === "AREA_MANAGER"
              ? selectedChains.map((chain) => chain.chainName).join(", ") ||
                "At least one Chain required"
              : selectedVendor?.chain.chainName ?? "Required"
          }
        />
        {targetRole !== "AREA_MANAGER" ? (
          <Definition
            label="Selected Branch"
            value={selectedVendor?.vendorName ?? "Required"}
          />
        ) : null}
        <Definition label="Candidate phone" value={phoneNumber || "Required"} />
        <Definition
          label="National ID"
          value={nationalId ? maskNationalId(nationalId) : "Required"}
        />
        <Definition label="Creator" value={creatorName} />
        <Definition label="Expected next step" value={expectedNextStep} />
      </div>
    </NewHireFormSection>
  );
}

function getAllowedNewHireTargetRoles(
  role: UserRole | undefined,
  branchLocked: boolean
): NewHireTargetRole[] {
  if (role === "CHAMP") {
    return ["PICKER"];
  }
  if (role === "AREA_MANAGER") {
    return ["PICKER", "CHAMP"];
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return branchLocked ? ["PICKER", "CHAMP"] : ["PICKER", "CHAMP", "AREA_MANAGER"];
  }
  return [];
}

function isValidEgyptPhone(value: string) {
  return /^(010|011|012|015)\d{8}$/.test(value);
}

function isValidEgyptNationalId(value: string) {
  return /^\d{14}$/.test(value);
}

function isBlockingNewHireDecision(decision: NewHireLookupCandidate["decision"]) {
  return (
    decision === "ACTIVE_DUPLICATE" ||
    decision === "BLOCKED" ||
    decision === "TEMPORARY_BLOCKED" ||
    decision === "PERMANENT_BLOCKED"
  );
}

function getNewHireSubmitLabel(targetRole: NewHireTargetRole) {
  if (targetRole === "AREA_MANAGER") {
    return "Create Area Manager";
  }
  return `Submit ${formatEnum(targetRole)} New Hire`;
}

function buildNewHireApprovalSteps(
  creatorRole: UserRole | undefined,
  targetRole: NewHireTargetRole
) {
  if (targetRole === "AREA_MANAGER") {
    return [
      {
        label: "Submit",
        description: "Admin submits the Area Manager New Hire.",
        skipped: false
      },
      {
        label: "Account created immediately",
        description: "The backend creates the account without approval routing.",
        skipped: false
      },
      {
        label: "Chain assignment created",
        description: "ChainAreaManagerAssignment rows are created for selected Chains.",
        skipped: false
      },
      {
        label: "Credential handoff from user profile",
        description: "Temporary password is revealed or reset only from authorized profile controls.",
        skipped: false
      }
    ];
  }

  const isAreaManagerCreator = creatorRole === "AREA_MANAGER";
  const finalization =
    targetRole === "PICKER"
      ? "Admin finalization with Shopper ID"
      : "Admin finalization";
  const assignment =
    targetRole === "PICKER"
      ? "Picker created and assigned"
      : "Champ created and assigned to Branch";

  return [
    {
      label: "Submit",
      description: `${formatEnum(targetRole)} New Hire request is submitted.`,
      skipped: false
    },
    {
      label: "Area Manager approval",
      description: isAreaManagerCreator
        ? "Area Manager-created New Hire skips this approval step."
        : "Area Manager reviews the Branch-scoped request.",
      skipped: isAreaManagerCreator
    },
    {
      label: finalization,
      description:
        targetRole === "PICKER"
          ? "Admin provides Shopper ID before account creation."
          : "Admin finalizes without a Shopper ID.",
      skipped: false
    },
    {
      label: assignment,
      description:
        targetRole === "PICKER"
          ? "PickerBranchAssignment is created."
          : "VendorChampAssignment is created.",
      skipped: false
    }
  ];
}

function maskNationalId(value: string) {
  if (value.length <= 4) {
    return value;
  }
  return `${value.slice(0, 3)}*******${value.slice(-4)}`;
}

type InitialResignationPicker = {
  id: string;
  nameEn: string;
  phoneNumber?: string | null;
};

export function ResignationRequestForm({
  fixedSourceVendorId,
  initialPicker,
  onCreated
}: {
  fixedSourceVendorId?: string;
  initialPicker?: InitialResignationPicker | null;
  onCreated: (request: RequestSummary) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState(
    initialPicker?.phoneNumber ?? initialPicker?.nameEn ?? ""
  );
  const [items, setItems] = useState<OffboardingPickerSearchItem[]>([]);
  const [selectedPicker, setSelectedPicker] =
    useState<OffboardingPickerSearchItem | null>(null);
  const [form, setForm] = useState({
    resignationDate: "",
    reasonCode: "BAD_ATTITUDE" as OffboardingReasonCode,
    reasonDetails: "",
    notes: "",
    blockDecision: "NO_BLOCK" as OffboardingBlockDecision,
    blockReason: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const isAreaManagerCreator = user?.role === "AREA_MANAGER";

  useEffect(() => {
    let mounted = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestsApi
        .searchOffboardingPickers({
          q: query.trim() || undefined,
          sourceVendorId: fixedSourceVendorId
        })
        .then((response) => {
          if (!mounted) return;
          setItems(response.items);
          if (!selectedPicker && initialPicker?.id) {
            const match = response.items.find(
              (item) => item.pickerId === initialPicker.id
            );
            if (match) setSelectedPicker(match);
          }
        })
        .catch((caughtError) => {
          if (mounted) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to search active Pickers."
            );
          }
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [fixedSourceVendorId, initialPicker?.id, query, selectedPicker]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPicker) {
      setError("Select an active Picker before submitting.");
      return;
    }
    if (selectedPicker.hasPendingResignation) {
      setError("This Picker already has a pending Resignation request.");
      return;
    }
    if (!form.resignationDate) {
      setError("Last working day is required.");
      return;
    }
    if (form.reasonCode === "OTHER" && !form.reasonDetails.trim()) {
      setError("Reason details are required when the reason is Other.");
      return;
    }
    if (
      isAreaManagerCreator &&
      form.blockDecision !== "NO_BLOCK" &&
      !form.blockReason.trim()
    ) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createOffboarding({
          type: "RESIGNATION",
          sourceVendorId: selectedPicker.vendorId,
          targetUserId: selectedPicker.pickerId,
          resignationDate: form.resignationDate,
          reasonCode: form.reasonCode,
          ...(form.reasonDetails.trim()
            ? { reasonDetails: form.reasonDetails.trim() }
            : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          ...(isAreaManagerCreator
            ? {
                blockDecision: form.blockDecision,
                ...(form.blockReason.trim()
                  ? { blockReason: form.blockReason.trim() }
                  : {})
              }
            : {})
        });
        setCreatedRequest(created);
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit Resignation request."
        );
      }
    });
  }

  if (createdRequest) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Resignation request submitted.</p>
            <p className="mt-1">
              Status: {formatEnum(createdRequest.status)}. Current step:{" "}
              {createdRequest.currentStep
                ? formatEnum(createdRequest.currentStep)
                : "None"}.
            </p>
            <Link
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "mt-3 bg-white"
              )}
              href={`/tickets?requestId=${createdRequest.id}`}
              prefetch
            >
              Open request detail
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="grid min-w-0 gap-5" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-950">Picker search</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Search is scoped by your workspace. Branch and Chain are resolved
            from the active Picker assignment.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-xl bg-white pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedPicker(null);
              }}
              placeholder="Search by name, phone, shopper ID, Branch, or Chain"
              value={query}
            />
          </div>
          <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading ? <LoadingState label="Searching active Pickers" /> : null}
            {!loading &&
              items.map((item) => (
                <button
                  className={cn(
                    "flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition",
                    selectedPicker?.assignmentId === item.assignmentId
                      ? "border-orange-300 bg-orange-50"
                      : "border-slate-200 bg-white hover:border-orange-200"
                  )}
                  key={item.assignmentId}
                  onClick={() => setSelectedPicker(item)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <PickerAvatar name={item.picker.nameEn} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-950">
                        {item.picker.nameEn}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {item.picker.phoneNumber} · {item.vendor.vendorName}
                      </span>
                    </span>
                  </span>
                  <Badge
                    className={cn(
                      "shrink-0",
                      item.hasPendingResignation
                        ? "border-red-200 bg-red-50 text-red-700"
                        : ""
                    )}
                    variant={item.hasPendingResignation ? "outline" : "muted"}
                  >
                    {item.hasPendingResignation ? "Pending" : "Active"}
                  </Badge>
                </button>
              ))}
            {!loading && !items.length ? (
              <EmptyState
                compact
                message="No active scoped Picker matches this search."
              />
            ) : null}
          </div>
        </div>
      </div>

      {selectedPicker ? <PickerIdentityCard picker={selectedPicker} /> : null}

      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-950">Resignation details</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Last working day and reason are required before approval routing.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Last working day">
            <DatePicker
              maxYear={new Date().getFullYear() + 1}
              minYear={new Date().getFullYear() - 1}
              onChange={(value) =>
                setForm((current) => ({ ...current, resignationDate: value }))
              }
              quickActions={["yesterday", "today"]}
              value={form.resignationDate}
            />
          </Field>
          <Field label="Reason">
            <select
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reasonCode: event.target.value as OffboardingReasonCode,
                  reasonDetails:
                    event.target.value === "OTHER" ? current.reasonDetails : ""
                }))
              }
              value={form.reasonCode}
            >
              {offboardingReasonCodes.map((reasonCode) => (
                <option key={reasonCode} value={reasonCode}>
                  {offboardingReasonLabels[reasonCode]}
                </option>
              ))}
            </select>
          </Field>
          {form.reasonCode === "OTHER" ? (
            <Field label="Reason details">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reasonDetails: event.target.value
                  }))
                }
                placeholder="Required for Other"
                value={form.reasonDetails}
              />
            </Field>
          ) : null}
          <Field label="Notes">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Optional"
              value={form.notes}
            />
          </Field>
        </div>
      </div>

      {isAreaManagerCreator ? (
        <BlockDecisionFields
          blockDecision={form.blockDecision}
          blockReason={form.blockReason}
          onChange={(patch) =>
            setForm((current) => ({
              ...current,
              ...patch,
              blockReason:
                patch.blockDecision === "NO_BLOCK"
                  ? ""
                  : patch.blockReason ?? current.blockReason
            }))
          }
          title="Area Manager block recommendation"
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          className="min-h-11 rounded-xl bg-orange-600 px-5 text-white hover:bg-orange-700"
          disabled={isPending || selectedPicker?.hasPendingResignation}
          type="submit"
        >
          {isPending ? "Submitting..." : "Submit Resignation"}
        </Button>
      </div>
    </form>
  );
}

function PickerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
      {initials || <UserRound className="h-4 w-4" />}
    </span>
  );
}

function PickerIdentityCard({ picker }: { picker: OffboardingPickerSearchItem }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <PickerAvatar name={picker.picker.nameEn} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-950">
                {picker.picker.nameEn}
              </h3>
              <Badge variant="muted">{formatEnum(picker.picker.employmentStatus)}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {picker.picker.phoneNumber}
              {picker.picker.shopperId ? ` · Shopper ${picker.picker.shopperId}` : ""}
              {picker.picker.ibsId ? ` · IBS ${picker.picker.ibsId}` : ""}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "w-fit",
            picker.hasPendingResignation
              ? "border-red-200 bg-red-50 text-red-700"
              : ""
          )}
          variant="outline"
        >
          {picker.hasPendingResignation ? "Pending Resignation" : "Ready"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Definition label="Branch" value={picker.vendor.vendorName} />
        <Definition label="Chain" value={picker.chain.chainName} />
        <Definition
          label="Assignment start"
          value={new Date(picker.assignmentStartDate).toLocaleDateString()}
        />
        <Definition label="Block status" value={formatEnum(picker.picker.blockStatus)} />
      </div>
    </section>
  );
}

function BlockDecisionFields({
  blockDecision,
  blockReason,
  onChange,
  title
}: {
  blockDecision: OffboardingBlockDecision;
  blockReason: string;
  onChange: (
    patch: Partial<{
      blockDecision: OffboardingBlockDecision;
      blockReason: string;
    }>
  ) => void;
  title: string;
}) {
  return (
    <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Choose one fixed decision. Temporary block dates are calculated at
          Admin finalization.
        </p>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-5">
          {offboardingBlockDecisions.map((decision) => (
            <button
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-medium transition",
                blockDecision === decision
                  ? "border-orange-300 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-orange-200"
              )}
              key={decision}
              onClick={() =>
                onChange({
                  blockDecision: decision,
                  blockReason: decision === "NO_BLOCK" ? "" : blockReason
                })
              }
              type="button"
            >
              {offboardingBlockDecisionLabels[decision]}
            </button>
          ))}
        </div>
        {blockDecision !== "NO_BLOCK" ? (
          <Field label="Block reason">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => onChange({ blockReason: event.target.value })}
              placeholder="Required for any block"
              value={blockReason}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}

function LifecyclePickerRequestForm({
  onCreated,
  type
}: {
  onCreated: (request: RequestSummary) => void;
  type: "TRANSFER";
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
    if (!destinationVendorId) {
      setError("Select destination Chain and Branch.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createTransfer({
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Transfer date">
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

function NewRequestMenu({
  allowedNewHireTargetRoles,
  onSelect
}: {
  allowedNewHireTargetRoles: NewHireTargetRole[];
  onSelect: (draft: NewRequestDraft) => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-2xl">
      <div className="group relative">
        <button
          className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allowedNewHireTargetRoles.length}
          type="button"
        >
          <span>New Hire</span>
          <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
        </button>
        <div className="mt-1 hidden gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1 group-focus-within:grid group-hover:grid sm:absolute sm:right-full sm:top-0 sm:mt-0 sm:w-52 sm:bg-white sm:shadow-xl">
          {allowedNewHireTargetRoles.map((role) => (
            <button
              className="min-h-10 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
              key={role}
              onClick={() => onSelect({ type: "NEW_HIRE", targetRole: role })}
              type="button"
            >
              {formatEnum(role)}
            </button>
          ))}
        </div>
      </div>
      <button
        className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
        onClick={() => onSelect({ type: "RESIGNATION" })}
        type="button"
      >
        Resignation
      </button>
      <button
        className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
        onClick={() => onSelect({ type: "TRANSFER" })}
        type="button"
      >
        Transfer
      </button>
    </div>
  );
}

function NewRequestSheet({
  draft,
  onClose,
  onCreated
}: {
  draft: NewRequestDraft;
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const title =
    draft.type === "NEW_HIRE"
      ? `${formatEnum(draft.targetRole)} New Hire`
      : `${formatEnum(draft.type)} request`;

  function requestClose() {
    if (isDirty && !window.confirm("Discard the New Hire data you entered?")) {
      return;
    }

    onClose();
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[130] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <section className="max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl [scrollbar-width:none] sm:max-w-5xl sm:rounded-[1.75rem] sm:p-5 xl:max-w-6xl [&::-webkit-scrollbar]:hidden">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              New request
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Create {title}
            </h2>
          </div>
          <Button
            aria-label="Close new request"
            className="h-10 w-10 rounded-xl p-0"
            onClick={requestClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {draft.type === "NEW_HIRE" ? (
          <NewHireRequestForm
            initialTargetRole={draft.targetRole}
            key={draft.targetRole}
            lockTargetRole
            onCreated={onCreated}
            onDirtyChange={setIsDirty}
          />
        ) : draft.type === "RESIGNATION" ? (
          <ResignationRequestForm onCreated={onCreated} />
        ) : draft.type === "TRANSFER" ? (
          <LifecyclePickerRequestForm onCreated={onCreated} type={draft.type} />
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
      setError(getRequestLoadErrorMessage(caughtError));
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
        {request.type === "NEW_HIRE" ? (
          <NewHireRequestDetailPanel request={request} />
        ) : null}
        {request.type === "RESIGNATION" ? (
          <ResignationRequestDetailPanel request={request} />
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
          request={request}
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
          request={request}
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
  const [decisionBlockDecision, setDecisionBlockDecision] =
    useState<OffboardingBlockDecision>("NO_BLOCK");
  const [decisionBlockReason, setDecisionBlockReason] = useState("");
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
    const requiresBlockDecision =
      decision.action === "approve" &&
      decision.approval.request.type === "RESIGNATION" &&
      decision.approval.step === "AREA_MANAGER_APPROVAL";

    if (
      requiresBlockDecision &&
      decisionBlockDecision !== "NO_BLOCK" &&
      !decisionBlockReason.trim()
    ) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (decision.action === "approve") {
          await approvalsApi.approve(
            decision.approval.id,
            requiresBlockDecision
              ? {
                  blockDecision: decisionBlockDecision,
                  ...(decisionBlockReason.trim()
                    ? { blockReason: decisionBlockReason.trim() }
                    : {}),
                  ...(decisionNotes.trim() ? { notes: decisionNotes.trim() } : {})
                }
              : decisionNotes
          );
        } else {
          await approvalsApi.reject(decision.approval.id, decisionNotes);
        }
        setDecision(null);
        setDecisionNotes("");
        setDecisionBlockDecision("NO_BLOCK");
        setDecisionBlockReason("");
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
                  setDecisionBlockDecision("NO_BLOCK");
                  setDecisionBlockReason("");
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
              Offboarding Admin final approval requires block decision and internal
              deactivation confirmation from the request detail page.
            </p>
            {decision.action === "approve" &&
            decision.approval.request.type === "RESIGNATION" &&
            decision.approval.step === "AREA_MANAGER_APPROVAL" ? (
              <div className="mt-4">
                <BlockDecisionFields
                  blockDecision={decisionBlockDecision}
                  blockReason={decisionBlockReason}
                  onChange={(patch) => {
                    if (patch.blockDecision) {
                      setDecisionBlockDecision(patch.blockDecision);
                      if (patch.blockDecision === "NO_BLOCK") {
                        setDecisionBlockReason("");
                      }
                    }
                    if (patch.blockReason !== undefined) {
                      setDecisionBlockReason(patch.blockReason);
                    }
                  }}
                  title="Block decision"
                />
              </div>
            ) : null}
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
                  setDecisionBlockDecision("NO_BLOCK");
                  setDecisionBlockReason("");
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

function ResignationAreaManagerApprovalPanel({
  approvalId,
  onApproved
}: {
  approvalId: string;
  onApproved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    blockDecision: "NO_BLOCK" as OffboardingBlockDecision,
    blockReason: "",
    notes: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function approve() {
    if (form.blockDecision !== "NO_BLOCK" && !form.blockReason.trim()) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        await approvalsApi.approve(approvalId, {
          blockDecision: form.blockDecision,
          ...(form.blockReason.trim()
            ? { blockReason: form.blockReason.trim() }
            : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {})
        });
        await onApproved();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to record Area Manager approval."
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-orange-950">
            Area Manager block decision
          </h3>
          <p className="mt-1 text-sm text-orange-800">
            Choose whether this Picker should be blocked before the request goes
            to Admin finalization.
          </p>
        </div>
        <UserCheck className="h-5 w-5 text-orange-700" />
      </div>
      <div className="mt-4 grid gap-4">
        <BlockDecisionFields
          blockDecision={form.blockDecision}
          blockReason={form.blockReason}
          onChange={(patch) =>
            setForm((current) => ({
              ...current,
              ...patch,
              blockReason:
                patch.blockDecision === "NO_BLOCK"
                  ? ""
                  : patch.blockReason ?? current.blockReason
            }))
          }
          title="Block decision"
        />
        <Field label="Approval notes">
          <Input
            className="h-11 rounded-xl bg-white"
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="Optional"
            value={form.notes}
          />
        </Field>
        {error ? <ErrorState message={error} /> : null}
        <Button
          className="w-fit rounded-xl bg-orange-600 text-white hover:bg-orange-700"
          disabled={isPending}
          onClick={approve}
          type="button"
        >
          {isPending ? "Approving..." : "Approve Resignation"}
        </Button>
      </div>
    </section>
  );
}

function FinalizeNewHirePanel({
  onFinalized,
  request
}: {
  onFinalized: () => Promise<void>;
  request: RequestDetail;
}) {
  const context = parseNewHirePayload(request.payload);
  const [shopperId, setShopperId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeNewHireResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const targetRole = context?.targetRole ?? "PICKER";
  const isPicker = targetRole === "PICKER";

  if (targetRole === "AREA_MANAGER") {
    return null;
  }

  function finalize() {
    if (isPicker && !shopperId.trim()) {
      setError("Shopper ID is required before Picker account creation.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeNewHire(
          request.id,
          isPicker ? shopperId : undefined
        );
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
          <h2 className="mt-3 text-base font-semibold">
            Finalize {formatEnum(targetRole)} New Hire
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {isPicker
              ? "Shopper ID is required before Picker account creation. SuperNova applies the approved workflow, creates or reactivates the Picker, and creates the Branch assignment."
              : "Champ does not require Shopper ID. SuperNova applies the approved workflow, creates the Champ account, and assigns the source Branch."}
          </p>
        </div>
        <UserPlus className="h-6 w-6 text-primary" />
      </div>

      {result ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">New Hire completed.</p>
          <p className="mt-1">
            {formatEnum(result.user.role)} {result.user.nameEn} was created with phone{" "}
            {result.user.phoneNumber} and assigned to the selected Branch.
          </p>
          <p className="mt-1">
            Temporary credentials are available only from authorized user profile controls.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          {isPicker ? (
            <Field label="Shopper ID">
              <Input
                onChange={(event) => setShopperId(event.target.value)}
                placeholder="Required before Picker creation"
                value={shopperId}
              />
            </Field>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Champ finalization does not require Shopper ID.
            </div>
          )}
          <div className="flex items-end">
            <Button disabled={isPending} onClick={finalize} type="button">
              {isPending ? "Finalizing..." : `Finalize ${formatEnum(targetRole)}`}
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
  request,
  type
}: {
  onFinalized: () => Promise<void>;
  request: RequestDetail;
  type: "RESIGNATION";
}) {
  const context = parseOffboardingPayload(request.payload);
  const recommendedDecision =
    context?.areaManagerDecision?.blockDecision ?? "NO_BLOCK";
  const recommendedReason = context?.areaManagerDecision?.blockReason ?? "";
  const [form, setForm] = useState({
    blockDecision: recommendedDecision as OffboardingBlockDecision,
    blockReason: recommendedReason,
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

    if (form.blockDecision !== "NO_BLOCK" && !form.blockReason.trim()) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeOffboarding(request.id, {
          blockDecision: form.blockDecision,
          confirmInternalDeactivation: form.confirmInternalDeactivation,
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
          {context?.areaManagerDecision ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
              Area Manager recommended{" "}
              <span className="font-semibold">
                {formatOffboardingBlockDecision(
                  context.areaManagerDecision.blockDecision
                )}
              </span>
              {context.areaManagerDecision.blockReason
                ? `: ${context.areaManagerDecision.blockReason}`
                : "."}
            </div>
          ) : null}
          <BlockDecisionFields
            blockDecision={form.blockDecision}
            blockReason={form.blockReason}
            onChange={(patch) =>
              setForm((current) => ({
                ...current,
                ...patch,
                blockReason:
                  patch.blockDecision === "NO_BLOCK"
                    ? ""
                    : patch.blockReason ?? current.blockReason
              }))
            }
            title="Admin block decision"
          />
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
  const newHireContext =
    request.type === "NEW_HIRE" ? parseNewHirePayload(request.payload) : null;
  const finalAction =
    request.status === "PENDING_ADMIN" &&
    request.currentStep === "ADMIN_FINAL_APPROVAL"
      ? request.type === "NEW_HIRE"
        ? newHireContext?.targetRole === "PICKER"
          ? "Admin must enter Shopper ID and finalize Picker New Hire."
          : newHireContext?.targetRole === "CHAMP"
            ? "Admin can finalize Champ New Hire without Shopper ID."
            : "Area Manager New Hire does not use Admin finalization."
        : request.type === "RESIGNATION"
          ? "Admin must confirm offboarding and block decision."
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
              ? `${formatEnum(context.targetRole)} ${context.finalization.userId} completed.`
              : "Completed result is not available in payload."
          }
        />
        <Definition
          label="Assignment type"
          value={context?.finalization?.assignmentType ?? "Not available"}
        />
        <Definition
          label="Shopper ID"
          value={
            context?.targetRole === "PICKER"
              ? context?.finalization?.shopperId ?? "Not available"
              : "Not required"
          }
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
          : `${formatEnum(context?.targetRole ?? "PICKER")} New Hire ${context?.candidatePhone ?? ""}`.trim(),
      subtitle:
        context?.targetRole === "AREA_MANAGER"
          ? `${request.sourceChain?.chainName ?? "Selected Chain"} · Area Manager`
          : `${request.sourceVendor?.vendorName ?? "No Branch"} · ${request.sourceChain?.chainName ?? "No Chain"}`
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
  const source = objectPayload.source;
  const target = objectPayload.target;
  const areaManagerDecision = objectPayload.areaManagerDecision;
  const finalization = objectPayload.finalization;

  if (
    !offboarding ||
    typeof offboarding !== "object" ||
    Array.isArray(offboarding) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    !target ||
    typeof target !== "object" ||
    Array.isArray(target)
  ) {
    return null;
  }

  const offboardingPayload = offboarding as Record<string, unknown>;
  const sourcePayload = source as Record<string, unknown>;
  const targetPayload = target as Record<string, unknown>;
  const areaManagerPayload =
    areaManagerDecision &&
    typeof areaManagerDecision === "object" &&
    !Array.isArray(areaManagerDecision)
      ? (areaManagerDecision as Record<string, unknown>)
      : null;
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
    reasonCode:
      typeof offboardingPayload.reasonCode === "string"
        ? offboardingPayload.reasonCode
        : "OTHER",
    reason:
      typeof offboardingPayload.reason === "string"
        ? offboardingPayload.reason
        : "Not provided",
    reasonDetails:
      typeof offboardingPayload.reasonDetails === "string"
        ? offboardingPayload.reasonDetails
        : undefined,
    notes:
      typeof offboardingPayload.notes === "string"
        ? offboardingPayload.notes
        : undefined,
    effectiveDate:
      typeof offboardingPayload.resignationDate === "string"
        ? offboardingPayload.resignationDate
        : "Not set",
    sourceVendorId:
      typeof sourcePayload.vendorId === "string"
        ? sourcePayload.vendorId
        : "Not available",
    sourceChainId:
      typeof sourcePayload.chainId === "string"
        ? sourcePayload.chainId
        : "Not available",
    pickerId:
      typeof targetPayload.pickerId === "string"
        ? targetPayload.pickerId
        : "Not available",
    pickerAssignmentId:
      typeof targetPayload.pickerAssignmentId === "string"
        ? targetPayload.pickerAssignmentId
        : "Not available",
    areaManagerDecision: areaManagerPayload
      ? {
          blockDecision:
            typeof areaManagerPayload.blockDecision === "string"
              ? (areaManagerPayload.blockDecision as OffboardingBlockDecision)
              : blockStatusToOffboardingDecision(areaManagerPayload.blockStatus),
          blockStatus:
            typeof areaManagerPayload.blockStatus === "string"
              ? areaManagerPayload.blockStatus
              : "NO_BLOCK",
          blockReason:
            typeof areaManagerPayload.blockReason === "string"
              ? areaManagerPayload.blockReason
              : null
        }
      : null,
    finalizedAt:
      typeof finalizationPayload?.completedAt === "string"
        ? finalizationPayload.completedAt
        : undefined,
    finalization: finalizationPayload
      ? {
          completedAt:
            typeof finalizationPayload.completedAt === "string"
              ? finalizationPayload.completedAt
              : "",
          blockDecision:
            typeof finalizationPayload.blockDecision === "string"
              ? (finalizationPayload.blockDecision as OffboardingBlockDecision)
              : blockStatusToOffboardingDecision(finalizationPayload.blockStatus),
          blockStatus:
            typeof finalizationPayload.blockStatus === "string"
              ? finalizationPayload.blockStatus
              : "NO_BLOCK",
          blockedUntil:
            typeof finalizationPayload.blockedUntil === "string"
              ? finalizationPayload.blockedUntil
              : null,
          blockReason:
            typeof finalizationPayload.blockReason === "string"
              ? finalizationPayload.blockReason
              : null
        }
      : null,
    blockStatus:
      typeof finalizationPayload?.blockStatus === "string"
        ? finalizationPayload.blockStatus
        : undefined
  };
}

function blockStatusToOffboardingDecision(value: unknown): OffboardingBlockDecision {
  if (value === "PERMANENT_BLOCK") {
    return "PERMANENT";
  }
  if (value === "TEMPORARY_BLOCK") {
    return "THREE_MONTHS";
  }
  return "NO_BLOCK";
}

function formatOffboardingBlockDecision(value: OffboardingBlockDecision) {
  return offboardingBlockDecisionLabels[value] ?? formatEnum(value);
}

function parseNewHirePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidate = objectPayload.candidate;
  const targetRole = parseNewHireTargetRole(objectPayload.targetRole);
  const mode =
    objectPayload.mode === "REHIRE" ||
    objectPayload.mode === "NEW_PICKER" ||
    objectPayload.mode === "NEW_CHAMP" ||
    objectPayload.mode === "NEW_AREA_MANAGER"
      ? objectPayload.mode
      : targetRole === "CHAMP"
        ? "NEW_CHAMP"
        : targetRole === "AREA_MANAGER"
          ? "NEW_AREA_MANAGER"
          : "NEW_PICKER";
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
  const sourcePayload = source as Record<string, unknown>;
  const rehirePayload =
    rehire && typeof rehire === "object" && !Array.isArray(rehire)
      ? (rehire as Record<string, unknown>)
      : null;
  const finalizationPayload =
    finalization && typeof finalization === "object" && !Array.isArray(finalization)
      ? (finalization as Record<string, unknown>)
      : null;
  const chainIds = Array.isArray(sourcePayload.chainIds)
    ? sourcePayload.chainIds.filter((value): value is string => typeof value === "string")
    : undefined;
  const assignmentIds = Array.isArray(finalizationPayload?.assignmentIds)
    ? finalizationPayload.assignmentIds.filter(
        (value): value is string => typeof value === "string"
      )
    : undefined;

  return {
    targetRole,
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
    dateOfBirth:
      typeof candidatePayload.dateOfBirth === "string"
        ? candidatePayload.dateOfBirth
        : undefined,
    gender:
      typeof candidatePayload.gender === "string"
        ? candidatePayload.gender
        : "UNSPECIFIED",
    notes:
      typeof candidatePayload.notes === "string" ? candidatePayload.notes : undefined,
    source: {
      vendorId:
        typeof sourcePayload.vendorId === "string" ? sourcePayload.vendorId : undefined,
      chainId:
        typeof sourcePayload.chainId === "string" ? sourcePayload.chainId : undefined,
      chainIds
    },
    rehireUserId:
      typeof rehirePayload?.userId === "string" ? rehirePayload.userId : undefined,
    finalization: finalizationPayload
      ? {
          userId:
            typeof finalizationPayload.userId === "string"
              ? finalizationPayload.userId
              : typeof finalizationPayload.pickerId === "string"
                ? finalizationPayload.pickerId
                : "Not available",
          assignmentId:
            typeof finalizationPayload.assignmentId === "string"
              ? finalizationPayload.assignmentId
              : undefined,
          assignmentIds,
          assignmentType:
            typeof finalizationPayload.assignmentType === "string"
              ? finalizationPayload.assignmentType
              : "Not available",
          shopperId:
            typeof finalizationPayload.shopperId === "string"
              ? finalizationPayload.shopperId
              : undefined,
          completedAt:
            typeof finalizationPayload.completedAt === "string"
              ? finalizationPayload.completedAt
              : undefined
        }
      : null
  };
}

function parseNewHireTargetRole(value: unknown): NewHireTargetRole {
  return value === "CHAMP" || value === "AREA_MANAGER" || value === "PICKER"
    ? value
    : "PICKER";
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
