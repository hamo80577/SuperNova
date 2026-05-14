"use client";

import { UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestsApi, type FinalizeNewHireResponse, type RequestDetail } from "@/lib/api/requests";
import { Field } from "../shared/request-field";
import { ErrorState } from "../shared/request-states";
import { formatEnum, parseNewHirePayload } from "../shared/request-utils";

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
