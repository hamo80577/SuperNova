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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  requestsApi,
  type OffboardingBlockDecision,
  type OffboardingEligibleUserSearchItem,
  type OffboardingReasonCode,
  type RequestSummary,
  type ResignationTargetRole,
  offboardingReasonLabels
} from "@/lib/api/requests";
import { type UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { BlockDecisionFields } from "./block-decision-fields";
import { PickerAvatar } from "./offboarding-picker-search";
import { offboardingReasonCodes } from "../../shared/request-constants";
import { Field } from "../../shared/request-field";
import { Definition } from "../../shared/request-field";
import { ErrorState } from "../../shared/request-states";
import {
  type InitialResignationPicker,
  type InitialResignationUser
} from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

export function ResignationRequestForm({
  fixedSourceVendorId,
  initialPicker,
  initialTargetRole,
  initialUser,
  onCancel,
  onDirtyChange,
  onCreated
}: {
  fixedSourceVendorId?: string;
  initialPicker?: InitialResignationPicker | null;
  initialTargetRole?: ResignationTargetRole;
  initialUser?: InitialResignationUser | null;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const { user } = useAuth();
  const resolvedInitialUser = initialUser ?? initialPicker ?? null;
  const resolvedInitialRole = isResignationTargetRole(resolvedInitialUser?.role)
    ? resolvedInitialUser.role
    : undefined;
  const branchLocked = Boolean(fixedSourceVendorId);
  const allowedTargetRoles = useMemo(
    () => getAllowedResignationTargetRoles(user?.role, branchLocked),
    [branchLocked, user?.role]
  );
  const [targetRole, setTargetRole] = useState<ResignationTargetRole>(
    initialTargetRole ?? resolvedInitialRole ?? allowedTargetRoles[0] ?? "PICKER"
  );
  const [query, setQuery] = useState(
    resolvedInitialUser?.phoneNumber ?? resolvedInitialUser?.nameEn ?? ""
  );
  const [items, setItems] = useState<OffboardingEligibleUserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] =
    useState<OffboardingEligibleUserSearchItem | null>(null);
  const [form, setForm] = useState({
    resignationDate: "",
    lastWorkingDate: "",
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
  const initialQuery = resolvedInitialUser?.phoneNumber ?? resolvedInitialUser?.nameEn ?? "";

  useEffect(() => {
    if (!allowedTargetRoles.length) {
      return;
    }

    setTargetRole((current) =>
      allowedTargetRoles.includes(current) ? current : allowedTargetRoles[0]
    );
  }, [allowedTargetRoles]);

  useEffect(() => {
    if (!initialTargetRole && !resolvedInitialRole) {
      return;
    }

    const nextRole = initialTargetRole ?? resolvedInitialRole;
    if (nextRole && allowedTargetRoles.includes(nextRole)) {
      setTargetRole(nextRole);
    }
  }, [allowedTargetRoles, initialTargetRole, resolvedInitialRole]);

  useEffect(() => {
    if (!allowedTargetRoles.includes(targetRole)) {
      setItems([]);
      setSelectedUser(null);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestsApi
        .searchOffboardingEligibleUsers({
          q: query.trim() || undefined,
          targetRole,
          sourceVendorId: fixedSourceVendorId
        })
        .then((response) => {
          if (!mounted) return;
          setItems(response.items);
          setSelectedUser((current) => {
            if (
              current &&
              response.items.some((item) => item.assignmentId === current.assignmentId)
            ) {
              return current;
            }

            if (resolvedInitialUser?.id) {
              return (
                response.items.find(
                  (item) => item.targetUserId === resolvedInitialUser.id
                ) ?? null
              );
            }

            return null;
          });
        })
        .catch((caughtError) => {
          if (mounted) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to search eligible users."
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
  }, [
    allowedTargetRoles,
    fixedSourceVendorId,
    query,
    resolvedInitialUser?.id,
    targetRole
  ]);

  const selectedChanged = Boolean(
    selectedUser && selectedUser.targetUserId !== resolvedInitialUser?.id
  );

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        selectedChanged ||
          targetRole !== (initialTargetRole ?? resolvedInitialRole ?? targetRole) ||
          (query.trim() && query.trim() !== initialQuery.trim()) ||
          form.resignationDate ||
          form.lastWorkingDate ||
          form.reasonCode !== "BAD_ATTITUDE" ||
          form.reasonDetails.trim() ||
          form.notes.trim() ||
          form.blockDecision !== "NO_BLOCK" ||
          form.blockReason.trim()
      )
    );
  }, [
    form.blockDecision,
    form.blockReason,
    form.lastWorkingDate,
    form.notes,
    form.reasonCode,
    form.reasonDetails,
    form.resignationDate,
    initialQuery,
    initialTargetRole,
    onDirtyChange,
    query,
    resolvedInitialRole,
    selectedChanged,
    targetRole
  ]);

  function updateTargetRole(nextRole: ResignationTargetRole) {
    setTargetRole(nextRole);
    setSelectedUser(null);
    setItems([]);
    setQuery("");
    setError(null);
    setForm((current) => ({
      ...current,
      lastWorkingDate: nextRole === "PICKER" ? current.lastWorkingDate : ""
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!allowedTargetRoles.includes(targetRole)) {
      setError("This Resignation target role is not available for your workspace.");
      return;
    }
    if (!selectedUser) {
      setError(`Select an active ${formatEnum(targetRole)} before submitting.`);
      return;
    }
    if (selectedUser.hasPendingResignation) {
      setError(
        `This ${formatEnum(selectedUser.targetRole)} already has a pending Resignation request.`
      );
      return;
    }
    if (!form.resignationDate) {
      setError("Resignation date is required.");
      return;
    }
    if (selectedUser.targetRole === "PICKER" && !form.lastWorkingDate) {
      setError("Last Working Date (LWD) is required for Picker Resignation.");
      return;
    }
    if (form.reasonCode === "OTHER" && !form.reasonDetails.trim()) {
      setError("Reason details are required when the reason is Other.");
      return;
    }
    if (
      isAreaManagerCreator &&
      form.blockDecision === "PERMANENT" &&
      !form.blockReason.trim()
    ) {
      setError("Block reason is required for Permanent block.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createOffboarding({
          type: "RESIGNATION",
          targetRole: selectedUser.targetRole,
          sourceVendorId: selectedUser.vendorId,
          sourceChainId: selectedUser.chainId,
          targetUserId: selectedUser.targetUserId,
          resignationDate: form.resignationDate,
          lastWorkingDate:
            selectedUser.targetRole === "PICKER"
              ? form.lastWorkingDate
              : undefined,
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
      <div className="rounded-2xl border border-[oklch(0.80_0.08_150)] bg-[oklch(0.95_0.045_150)] p-4 text-sm text-[oklch(0.58_0.13_150)]">
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

  if (!allowedTargetRoles.length) {
    return (
      <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-body)]">
        Resignation requests are not available for this user role.
      </div>
    );
  }

  return (
    <form className="grid min-w-0 gap-5" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}

      <Section
        description="Choose only the role this workspace can submit."
        title="Target role"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {allowedTargetRoles.map((role) => (
            <button
              className={cn(
                "min-h-12 rounded-xl border p-3 text-left text-sm font-semibold transition-colors",
                targetRole === role
                  ? "border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-burgundy)]"
                  : "border-[color:var(--sn-border)] bg-white text-[color:var(--sn-body)] hover:border-[#FFD8BD]"
              )}
              key={role}
              onClick={() => updateTargetRole(role)}
              type="button"
            >
              {formatEnum(role)}
            </button>
          ))}
        </div>
      </Section>

      <Section
        description="The list is scoped by your active assignments and request permissions."
        title={`Eligible ${formatEnum(targetRole)}`}
      >
        <Field label={formatEnum(targetRole)}>
          <Select
            aria-label={`${formatEnum(targetRole)} for Resignation`}
            disabled={loading}
            emptyMessage={`No active scoped ${formatEnum(targetRole)} matches this search.`}
            onChange={(event) => {
              const nextUser = items.find(
                (item) => item.assignmentId === event.target.value
              );
              setSelectedUser(nextUser ?? null);
            }}
            onSearchChange={(value) => {
              setQuery(value);
              setSelectedUser(null);
            }}
            searchable
            searchPlaceholder={`Search ${formatEnum(targetRole)} by name, phone, Branch, or Chain`}
            searchValue={query}
            value={selectedUser?.assignmentId ?? ""}
          >
            <option value="">
              {loading ? "Searching eligible users..." : `Select ${formatEnum(targetRole)}`}
            </option>
            {items.map((item) => (
              <option key={item.assignmentId} value={item.assignmentId}>
                {item.user.nameEn} / {item.user.phoneNumber} /{" "}
                {item.vendor?.vendorName ?? item.chain.chainName}
                {item.hasPendingResignation ? " / Pending" : " / Active"}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      {selectedUser ? <ResignationUserCard item={selectedUser} /> : null}

      <Section
        description="Resignation dates and reason are required before approval routing."
        title="Resignation details"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Resignation Date">
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
          {targetRole === "PICKER" ? (
            <Field label="Last Working Date (LWD)">
              <DatePicker
                maxYear={new Date().getFullYear() + 1}
                minYear={new Date().getFullYear() - 1}
                onChange={(value) =>
                  setForm((current) => ({ ...current, lastWorkingDate: value }))
                }
                placeholder="Select final working day"
                value={form.lastWorkingDate}
              />
              <span className="text-xs font-normal leading-5 text-[color:var(--sn-muted)]">
                The Picker's final working day. Used later for HR sync.
              </span>
            </Field>
          ) : null}
          <Field label="Reason">
            <Select
              aria-label="Reason"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
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
            </Select>
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
      </Section>

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
          title="Area Manager block decision"
        />
      ) : null}

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
          className="min-h-11 w-full rounded-xl border-[oklch(0.45_0.19_27)] bg-[oklch(0.55_0.19_27)] px-5 text-white hover:bg-[oklch(0.48_0.19_27)] sm:w-auto"
          disabled={isPending || selectedUser?.hasPendingResignation}
          type="submit"
        >
          {isPending ? "Submitting..." : "Submit Resignation"}
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
    <section className="grid gap-4 border-b border-[color:var(--sn-border)] pb-5 lg:grid-cols-[13rem_1fr]">
      <div>
        <p className="text-sm font-semibold text-[color:var(--sn-ink)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--sn-muted)]">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ResignationUserCard({ item }: { item: OffboardingEligibleUserSearchItem }) {
  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <PickerAvatar name={item.user.nameEn} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-[color:var(--sn-ink)]">
                {item.user.nameEn}
              </h3>
              <Badge className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]" variant="outline">
                {formatEnum(item.targetRole)}
              </Badge>
              <Badge variant="muted">{formatEnum(item.user.employmentStatus)}</Badge>
            </div>
            <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
              {item.user.phoneNumber}
              {item.user.shopperId ? ` · Shopper ${item.user.shopperId}` : ""}
              {item.user.ibsId ? ` · IBS ${item.user.ibsId}` : ""}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "w-fit",
            item.hasPendingResignation
              ? "border-[oklch(0.85_0.06_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
              : ""
          )}
          variant="outline"
        >
          {item.hasPendingResignation ? "Pending Resignation" : "Ready"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {item.vendor ? <Definition label="Branch" value={item.vendor.vendorName} /> : null}
        <Definition label="Chain" value={item.chain.chainName} />
        <Definition
          label="Assignment start"
          value={new Date(item.assignmentStartDate).toLocaleDateString()}
        />
        <Definition
          label="Block status"
          value={formatEnum(item.user.blockStatus ?? "NO_BLOCK")}
        />
      </div>
    </section>
  );
}

function getAllowedResignationTargetRoles(
  role: UserRole | undefined,
  branchLocked: boolean
): ResignationTargetRole[] {
  if (role === "CHAMP") {
    return ["PICKER"];
  }
  if (role === "AREA_MANAGER") {
    return branchLocked ? ["PICKER"] : ["PICKER", "CHAMP"];
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return branchLocked ? ["PICKER"] : ["PICKER", "CHAMP", "AREA_MANAGER"];
  }
  return [];
}

function isResignationTargetRole(
  role: UserRole | undefined
): role is ResignationTargetRole {
  return role === "PICKER" || role === "CHAMP" || role === "AREA_MANAGER";
}
