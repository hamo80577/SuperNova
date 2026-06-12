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
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      {result ? (
        <div className="rounded-xl border border-[oklch(0.80_0.08_150)] bg-[oklch(0.95_0.045_150)] px-3 py-2 text-sm font-medium text-[oklch(0.58_0.13_150)]">
          Completed.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          {isPicker ? (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                capturedShopperId
                  ? "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]"
                  : "border-[oklch(0.85_0.08_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--sn-muted)]">
                Area Manager Shopper ID
              </p>
              <p className="mt-1 font-semibold text-[color:var(--sn-ink)]">
                {capturedShopperId ?? "Not captured"}
              </p>
              {!capturedShopperId ? (
                <p className="mt-1 text-xs leading-5 text-[oklch(0.55_0.13_70)]">
                  Area Manager approval must capture a Shopper ID before Admin can
                  approve this Picker New Hire.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 py-2 text-sm text-[color:var(--sn-body)]">
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
