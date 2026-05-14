"use client";

import { ShieldAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestsApi, type FinalizeOffboardingResponse, type OffboardingBlockDecision, type RequestDetail } from "@/lib/api/requests";
import { BlockDecisionFields } from "../forms/resignation/block-decision-fields";
import { Field } from "../shared/request-field";
import { ErrorState } from "../shared/request-states";
import { formatEnum, formatOffboardingBlockDecision, parseOffboardingPayload } from "../shared/request-utils";

export function FinalizeOffboardingPanel({
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
