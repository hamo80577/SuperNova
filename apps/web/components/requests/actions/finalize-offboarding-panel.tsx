"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestsApi, type FinalizeOffboardingResponse, type RequestDetail } from "@/lib/api/requests";
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
  const requiresAreaManagerDecision =
    context?.targetRole === "PICKER" || context?.targetRole === "CHAMP";
  const areaManagerDecision = context?.areaManagerDecision ?? null;
  const forcedNoBlock = context?.targetRole === "AREA_MANAGER";
  const hasLegacyTemporaryDecision =
    areaManagerDecision?.blockDecision === "LEGACY_TEMPORARY_BLOCK";
  const canConfirm =
    Boolean(context) &&
    (forcedNoBlock ||
      (requiresAreaManagerDecision &&
        Boolean(areaManagerDecision) &&
        !hasLegacyTemporaryDecision));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizeOffboardingResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  function finalize() {
    if (!context) {
      setError("Resignation payload is not available.");
      return;
    }
    if (requiresAreaManagerDecision && !areaManagerDecision) {
      setError("Area Manager block decision is required before Admin finalization.");
      return;
    }
    if (hasLegacyTemporaryDecision) {
      setError("Legacy temporary block decisions cannot be confirmed.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const finalized = await requestsApi.finalizeOffboarding(request.id, {
          confirmInternalDeactivation: true
        });
        setResult(finalized);
        await onFinalized();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to finalize Resignation."
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      {result ? (
        <div className="rounded-xl border border-[oklch(0.80_0.08_150)] bg-[oklch(0.95_0.045_150)] px-3 py-2 text-sm text-[oklch(0.58_0.13_150)]">
          <p className="font-medium">{formatEnum(type)} completed.</p>
          <p className="mt-1">
            {formatEnum(result.user.role)} {result.user.nameEn} is now{" "}
            {formatEnum(result.user.accountStatus)}
            {result.assignment
              ? `; assignment ${result.assignment.id} is ${formatEnum(result.assignment.status)}.`
              : "."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 py-2 text-sm text-[color:var(--sn-body)]">
            <p>
              <span className="font-medium text-[color:var(--sn-ink)]">
                Block decision:
              </span>{" "}
              {forcedNoBlock
                ? "No block"
                : areaManagerDecision
                  ? formatOffboardingBlockDecision(areaManagerDecision.blockDecision)
                  : "Pending Area Manager decision"}
            </p>
            {areaManagerDecision?.blockReason ? (
              <p>
                <span className="font-medium text-[color:var(--sn-ink)]">Reason:</span>{" "}
                {areaManagerDecision.blockReason}
              </p>
            ) : null}
            {requiresAreaManagerDecision && !areaManagerDecision ? (
              <p className="text-[oklch(0.55_0.19_27)]">
                Area Manager block decision is required before confirmation.
              </p>
            ) : null}
            {hasLegacyTemporaryDecision ? (
              <p className="text-[oklch(0.55_0.19_27)]">
                This request contains a legacy temporary block decision and cannot
                be confirmed under the current Resignation rules.
              </p>
            ) : null}
          </div>
          <div className="flex items-end">
            <Button
              disabled={isPending || !canConfirm}
              onClick={finalize}
              type="button"
            >
              {isPending ? "Confirming..." : "Confirm Resignation"}
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
