"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Field } from "@/components/requests/shared/request-field";
import { ErrorState } from "@/components/requests/shared/request-states";
import { type InitialDeductionTarget } from "@/components/requests/shared/request-types";
import { formatEnum } from "@/components/requests/shared/request-utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deductionPenaltyTypeLabels,
  deductionsApi,
  getAllowedDeductionTargetRoles,
  type ActiveDeductionPolicy,
  type DeductionPenaltyType,
  type DeductionPreviewResponse,
  type DeductionTargetRole,
  type DeductionTargetSearchItem
} from "@/lib/api/deductions";
import { type RequestSummary } from "@/lib/api/requests";
import { cn } from "@/lib/utils";

type SelectedDeductionTarget = {
  userId: string;
  name: string;
  role: DeductionTargetRole;
  shopperId: string | null;
  ibsId: string | null;
  vendorId: string | null;
  vendorName: string | null;
  chainId: string | null;
  chainName: string | null;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: DeductionPreviewResponse };

export function DeductionRequestForm({
  initialTarget,
  initialTargetRole,
  onCancel,
  onCreated,
  onDirtyChange
}: {
  initialTarget?: InitialDeductionTarget | null;
  initialTargetRole?: DeductionTargetRole;
  onCancel?: () => void;
  onCreated: (request: RequestSummary) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const { user } = useAuth();
  const allowedTargetRoles = useMemo(
    () => getAllowedDeductionTargetRoles(user?.role),
    [user?.role]
  );
  const resolvedInitialTarget = useMemo(
    () =>
      initialTarget && allowedTargetRoles.includes(initialTarget.role)
        ? toSelectedDeductionTarget(initialTarget)
        : null,
    [allowedTargetRoles, initialTarget]
  );
  const [targetRole, setTargetRole] = useState<DeductionTargetRole>(
    initialTargetRole ??
      resolvedInitialTarget?.role ??
      allowedTargetRoles[0] ??
      "PICKER"
  );
  const [selectedTarget, setSelectedTarget] =
    useState<SelectedDeductionTarget | null>(resolvedInitialTarget);
  const [query, setQuery] = useState("");
  const [searchItems, setSearchItems] = useState<DeductionTargetSearchItem[]>(
    []
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [incidentDate, setIncidentDate] = useState("");
  const [policy, setPolicy] = useState<ActiveDeductionPolicy | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [actionId, setActionId] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>({
    status: "idle"
  });
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);

  useEffect(() => {
    if (!allowedTargetRoles.length) {
      return;
    }

    setTargetRole((current) =>
      allowedTargetRoles.includes(current) ? current : allowedTargetRoles[0]
    );
  }, [allowedTargetRoles]);

  useEffect(() => {
    let mounted = true;

    deductionsApi
      .activePolicy()
      .then((response) => {
        if (mounted) {
          setPolicy(response);
          setPolicyError(null);
        }
      })
      .catch((caughtError) => {
        if (mounted) {
          setPolicyError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load the active deduction policy."
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedTarget || !allowedTargetRoles.includes(targetRole)) {
      return;
    }

    if (query.trim().length < 2) {
      setSearchItems([]);
      setSearchLoading(false);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      deductionsApi
        .searchTargets({ q: query.trim(), role: targetRole })
        .then((items) => {
          if (mounted) {
            setSearchItems(items);
            setError(null);
          }
        })
        .catch((caughtError) => {
          if (mounted) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to search deduction targets."
            );
          }
        })
        .finally(() => {
          if (mounted) {
            setSearchLoading(false);
          }
        });
    }, 400);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [allowedTargetRoles, query, selectedTarget, targetRole]);

  useEffect(() => {
    if (!selectedTarget || !actionId || !isCompleteDate(incidentDate)) {
      setPreviewState({ status: "idle" });
      return;
    }

    let mounted = true;
    setPreviewState({ status: "loading" });
    deductionsApi
      .preview({
        actionId,
        incidentDate,
        sourceVendorId: selectedTarget.vendorId ?? undefined,
        targetRole: selectedTarget.role,
        targetUserId: selectedTarget.userId
      })
      .then((preview) => {
        if (mounted) {
          setPreviewState({ preview, status: "ready" });
        }
      })
      .catch((caughtError) => {
        if (mounted) {
          setPreviewState({
            message:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to calculate the deduction outcome.",
            status: "error"
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [actionId, incidentDate, selectedTarget]);

  const targetChanged = selectedTarget?.userId !== resolvedInitialTarget?.userId;

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        targetChanged ||
          query.trim() ||
          incidentDate ||
          actionId ||
          reason.trim() ||
          notes.trim()
      )
    );
  }, [
    actionId,
    incidentDate,
    notes,
    onDirtyChange,
    query,
    reason,
    targetChanged
  ]);

  function updateTargetRole(nextRole: DeductionTargetRole) {
    setTargetRole(nextRole);
    setSelectedTarget(null);
    setSearchItems([]);
    setQuery("");
    setError(null);
  }

  function clearTarget() {
    setSelectedTarget(null);
    setSearchItems([]);
    setQuery("");
    setError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTarget) {
      setError(`Select a ${formatEnum(targetRole)} before submitting.`);
      return;
    }
    if (!isCompleteDate(incidentDate)) {
      setError("Incident date is required.");
      return;
    }
    if (!actionId) {
      setError("Select the action that occurred.");
      return;
    }
    if (previewState.status !== "ready") {
      setError("Wait for the outcome preview before submitting.");
      return;
    }

    const target = selectedTarget;

    startTransition(async () => {
      setError(null);
      try {
        const created = await deductionsApi.createDeductionRequest({
          actionId,
          incidentDate,
          sourceVendorId: target.vendorId ?? undefined,
          targetRole: target.role,
          targetUserId: target.userId,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {})
        });
        setCreatedRequest(created);
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit the Deduction ticket."
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
            <p className="font-semibold">Deduction ticket submitted.</p>
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

  if (!allowedTargetRoles.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Deduction tickets are not available for this user role.
      </div>
    );
  }

  return (
    <form className="grid min-w-0 gap-5" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}

      <Section
        description="Pick who this Deduction ticket applies to. The list is scoped to your assignments."
        title="Target"
      >
        {selectedTarget ? (
          <DeductionTargetCard onChange={clearTarget} target={selectedTarget} />
        ) : (
          <div className="grid gap-3">
            {allowedTargetRoles.length > 1 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {allowedTargetRoles.map((role) => (
                  <button
                    className={cn(
                      "min-h-12 rounded-xl border p-3 text-left text-sm font-semibold transition-colors",
                      targetRole === role
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
            ) : null}
            <Field label={`Search ${formatEnum(targetRole)}`}>
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${formatEnum(targetRole)} by name, Shopper ID, or IBS ID`}
                type="search"
                value={query}
              />
            </Field>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {query.trim().length < 2 ? (
                <p className="p-3 text-sm text-slate-500">
                  Type at least 2 characters to search your scoped{" "}
                  {formatEnum(targetRole)}s.
                </p>
              ) : searchLoading ? (
                <div className="grid gap-2 p-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : searchItems.length ? (
                <ul className="divide-y divide-slate-100">
                  {searchItems.map((item) => (
                    <li key={`${item.userId}:${item.vendorId}`}>
                      <button
                        className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-orange-50/60"
                        onClick={() =>
                          setSelectedTarget(toSelectedFromSearchItem(item))
                        }
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950">
                            {item.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {item.shopperId ? `Shopper ${item.shopperId} · ` : ""}
                            {item.ibsId ? `IBS ${item.ibsId} · ` : ""}
                            {item.vendorName} · {item.chainName}
                          </span>
                        </span>
                        <Badge
                          className="shrink-0 border-orange-200 bg-orange-50 text-orange-700"
                          variant="outline"
                        >
                          {formatEnum(item.role)}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-3 text-sm text-slate-500">
                  No scoped {formatEnum(targetRole)} matches this search.
                </p>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section
        description="The day the action occurred this month. Deductions are limited to the current month."
        title="Incident date"
      >
        <Field label="Incident date">
          <DatePicker
            maxDate={today}
            minDate={monthStart}
            onChange={setIncidentDate}
            placeholder="Select incident date"
            quickActions={["today"]}
            value={incidentDate}
          />
        </Field>
      </Section>

      <Section
        description="Actions and penalties come from the active deduction policy."
        title="Action"
      >
        {policyError ? (
          <p className="text-sm font-medium text-red-600">{policyError}</p>
        ) : (
          <Field label="Action">
            <Select
              aria-label="Deduction action"
              disabled={!policy}
              onChange={(event) => setActionId(event.target.value)}
              value={actionId}
            >
              <option value="">
                {policy ? "Select action" : "Loading policy actions..."}
              </option>
              {(policy?.actions ?? []).map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Section>

      <Section
        description="Calculated automatically from the active policy and this month's history."
        title="Outcome"
      >
        <DeductionOutcomeCard state={previewState} />
      </Section>

      <Section
        description="Optional context recorded on the ticket for approvers."
        title="Reason & notes"
      >
        <div className="grid gap-3">
          <Field label="Reason">
            <textarea
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional"
              value={reason}
            />
          </Field>
          <Field label="Notes">
            <Input
              className="h-11 rounded-xl"
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              value={notes}
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            className="min-h-11 w-full rounded-xl sm:w-auto"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          className="min-h-11 w-full rounded-xl border-red-700 bg-red-600 px-5 text-white hover:bg-red-700 sm:w-auto"
          disabled={isPending || previewState.status !== "ready"}
          type="submit"
        >
          {isPending ? "Submitting..." : "Submit Deduction Ticket"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function DeductionTargetCard({
  onChange,
  target
}: {
  onChange: () => void;
  target: SelectedDeductionTarget;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-950">
              {target.name}
            </h3>
            <Badge
              className="border-orange-200 bg-orange-50 text-orange-700"
              variant="outline"
            >
              {formatEnum(target.role)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {target.shopperId ? `Shopper ${target.shopperId}` : "No Shopper ID"}
            {target.ibsId ? ` · IBS ${target.ibsId}` : ""}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {target.vendorName ?? "Branch resolved at preview"} ·{" "}
            {target.chainName ?? "Chain resolved at preview"}
          </p>
        </div>
        <Button
          className="h-9 rounded-xl"
          onClick={onChange}
          type="button"
          variant="outline"
        >
          Change
        </Button>
      </div>
    </section>
  );
}

function DeductionOutcomeCard({ state }: { state: PreviewState }) {
  if (state.status === "idle") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Select a target, an incident date, and an action to preview the
        calculated penalty.
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        role="status"
      >
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {state.message}
      </div>
    );
  }

  const { preview } = state;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className="border-slate-200 bg-slate-50 text-slate-700"
          variant="outline"
        >
          Occurrence {preview.occurrenceNumber} in {preview.incidentMonth}
        </Badge>
        <PenaltyTypeBadge penaltyType={preview.penalty.penaltyType} />
      </div>
      <p className="mt-3 text-base font-semibold text-slate-950">
        {preview.penalty.label}
      </p>
      {preview.penalty.deductionDays !== null ? (
        <p className="mt-1 text-sm text-slate-600">
          Deduction: {Number(preview.penalty.deductionDays)}{" "}
          {Number(preview.penalty.deductionDays) === 1 ? "day" : "days"}
        </p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-slate-400">
        Policy version {preview.policyVersion.versionNumber} ·{" "}
        {preview.action.name}
      </p>
    </div>
  );
}

export function PenaltyTypeBadge({
  penaltyType
}: {
  penaltyType: DeductionPenaltyType;
}) {
  return (
    <Badge
      className={cn(
        penaltyType === "WARNING" && "border-amber-200 bg-amber-50 text-amber-700",
        penaltyType === "DEDUCTION_DAYS" &&
          "border-rose-200 bg-rose-50 text-rose-700",
        penaltyType === "LIFECYCLE_REVIEW_REQUIRED" &&
          "border-violet-200 bg-violet-50 text-violet-700"
      )}
      variant="outline"
    >
      {deductionPenaltyTypeLabels[penaltyType]}
    </Badge>
  );
}

function toSelectedDeductionTarget(
  target: InitialDeductionTarget
): SelectedDeductionTarget {
  return {
    chainId: target.chainId ?? null,
    chainName: target.chainName ?? null,
    ibsId: target.ibsId,
    name: target.name,
    role: target.role,
    shopperId: target.shopperId,
    userId: target.userId,
    vendorId: target.vendorId ?? null,
    vendorName: target.vendorName ?? null
  };
}

function toSelectedFromSearchItem(
  item: DeductionTargetSearchItem
): SelectedDeductionTarget {
  return {
    chainId: item.chainId,
    chainName: item.chainName,
    ibsId: item.ibsId,
    name: item.name,
    role: item.role,
    shopperId: item.shopperId,
    userId: item.userId,
    vendorId: item.vendorId,
    vendorName: item.vendorName
  };
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isCompleteDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
