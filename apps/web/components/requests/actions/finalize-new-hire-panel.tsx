"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestsApi, type FinalizeNewHireResponse, type RequestDetail } from "@/lib/api/requests";
import { ErrorState } from "../shared/request-states";
import { parseNewHirePayload } from "../shared/request-utils";

export function FinalizeNewHirePanel({
  onFinalized,
  request
}: {
  onFinalized: () => Promise<void>;
  request: RequestDetail;
}) {
  const context = parseNewHirePayload(request.payload);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeNewHireResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const targetRole = context?.targetRole ?? "PICKER";
  const isPicker = targetRole === "PICKER";
  const capturedShopperId =
    context?.areaManagerDecision?.shopperId ?? context?.finalization?.shopperId;
  const missingPickerShopperId = isPicker && !capturedShopperId;

  function finalize() {
    if (missingPickerShopperId) {
      setError(
        "Shopper ID must be captured by the Area Manager before Admin final approval."
      );
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeNewHire(request.id);
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Completed.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          {isPicker ? (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                capturedShopperId
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Area Manager Shopper ID
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {capturedShopperId ?? "Not captured"}
              </p>
              {!capturedShopperId ? (
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Area Manager approval must capture a Shopper ID before Admin can
                  approve this Picker New Hire.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {targetRole === "CHAMP"
                ? "Champ New Hire finalization does not require Shopper ID."
                : "Area Manager New Hire finalization does not require Shopper ID."}
            </div>
          )}
          <div className="flex items-end">
            <Button
              disabled={isPending || missingPickerShopperId}
              onClick={finalize}
              type="button"
            >
              {isPending ? "Approving..." : "Approve New Hire"}
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
