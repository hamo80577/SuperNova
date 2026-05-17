"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestsApi, type FinalizeOffboardingResponse, type OffboardingBlockDecision, type RequestDetail } from "@/lib/api/requests";
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeOffboardingResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  function finalize() {
    if (recommendedDecision !== "NO_BLOCK" && !recommendedReason.trim()) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeOffboarding(request.id, {
          blockDecision: recommendedDecision as OffboardingBlockDecision,
          confirmInternalDeactivation: true,
          ...(recommendedReason ? { blockReason: recommendedReason } : {})
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-medium">{formatEnum(type)} completed.</p>
          <p className="mt-1">
            Picker {result.picker.nameEn} is now {formatEnum(result.picker.accountStatus)}
            ; assignment {result.assignment.id} is {formatEnum(result.assignment.status)}.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          {context?.areaManagerDecision ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium text-slate-950">
                Area Manager decision:
              </span>{" "}
              {formatOffboardingBlockDecision(context.areaManagerDecision.blockDecision)}
            </div>
          ) : null}
          <div className="flex items-end">
            <Button disabled={isPending} onClick={finalize} type="button">
              {isPending ? "Confirming..." : "Confirm"}
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
