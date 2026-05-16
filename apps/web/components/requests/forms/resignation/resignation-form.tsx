"use client";

import { CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestsApi, type OffboardingBlockDecision, type OffboardingPickerSearchItem, type OffboardingReasonCode, type RequestSummary, offboardingReasonLabels } from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import { BlockDecisionFields } from "./block-decision-fields";
import { PickerAvatar, PickerIdentityCard } from "./offboarding-picker-search";
import { offboardingReasonCodes } from "../../shared/request-constants";
import { EmptyState } from "../../shared/request-empty-state";
import { Field } from "../../shared/request-field";
import { ErrorState, LoadingState } from "../../shared/request-states";
import { type InitialResignationPicker } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

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
            <Select
              aria-label="Reason"
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
