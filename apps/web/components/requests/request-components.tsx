"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  KeyRound,
  Send,
  UserPlus,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import {
  requestsApi,
  type CreateRequestPayload,
  type FinalizeNewHireResponse,
  type RequestDetail,
  type RequestStatus,
  type RequestSummary,
  type RequestType
} from "@/lib/api/requests";

const requestTypes: RequestType[] = [
  "NEW_HIRE",
  "RESIGNATION",
  "TERMINATION",
  "TRANSFER"
];
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

export function RequestsCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const canUseInternalRequestEngine =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [items, setItems] = useState<RequestSummary[]>([]);
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [type, setType] = useState<RequestType | "">("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: "NEW_HIRE" as RequestType,
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
        router.push(`/requests/${created.id}`);
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
              Generic lifecycle request records and approval state. Final workflow
              execution is intentionally reserved for later phases.
            </p>
          </div>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/approvals"
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
            Internal request engine testing. Real workflow forms are implemented
            in later phases. This creates a request record only; it does not
            create Pickers, move assignments, archive users, or perform final
            actions.
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
                {requestTypes.map((value) => (
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
              href="/requests"
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

export function ApprovalsCenter() {
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
            href={`/requests/${approval.request.id}`}
            prefetch
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Finalize with Shopper ID
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
        href={`/requests/${approval.request.id}`}
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
    if (!shopperId.trim()) {
      setError("Shopper ID is required to finalize New Hire.");
      return;
    }

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
            Shopper ID is required. SuperNova will create the Picker, assign the
            Picker to the source Branch, generate temporary credentials, notify
            the Champ, and mark the request completed in one backend transaction.
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
              placeholder="Required unique Shopper ID"
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
                  href={`/requests/${request.id}`}
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

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
