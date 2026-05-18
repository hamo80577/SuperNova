"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestsApi, type FinalizeNewHireResponse, type RequestDetail } from "@/lib/api/requests";
import { Field } from "../shared/request-field";
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
  const [shopperId, setShopperId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeNewHireResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const targetRole = context?.targetRole ?? "PICKER";
  const isPicker = targetRole === "PICKER";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Completed.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          {isPicker ? (
            <Field label="Shopper ID">
              <Input
                onChange={(event) => setShopperId(event.target.value)}
                placeholder="Shopper ID"
                value={shopperId}
              />
            </Field>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {targetRole === "CHAMP"
                ? "Champ New Hire finalization does not require Shopper ID."
                : "Area Manager New Hire finalization does not require Shopper ID."}
            </div>
          )}
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
