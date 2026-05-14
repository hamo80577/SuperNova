"use client";

import { UserCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approvalsApi } from "@/lib/api/approvals";
import { type OffboardingBlockDecision, type RequestApprovalSummary, type RequestDetail } from "@/lib/api/requests";
import { BlockDecisionFields } from "../forms/resignation/block-decision-fields";
import { ErrorState } from "../shared/request-states";

export function RequestApprovalDecisionPanel({
  approval,
  onChanged,
  request
}: {
  approval: RequestApprovalSummary;
  onChanged: () => Promise<void>;
  request: RequestDetail;
}) {
  const isResignationAreaManager =
    request.type === "RESIGNATION" && approval.step === "AREA_MANAGER_APPROVAL";
  const [notes, setNotes] = useState("");
  const [blockDecision, setBlockDecision] =
    useState<OffboardingBlockDecision>("NO_BLOCK");
  const [blockReason, setBlockReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function approve() {
    if (isResignationAreaManager && blockDecision !== "NO_BLOCK" && !blockReason.trim()) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        await approvalsApi.approve(
          approval.id,
          isResignationAreaManager
            ? {
                blockDecision,
                ...(blockReason.trim() ? { blockReason: blockReason.trim() } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {})
              }
            : notes.trim() || undefined
        );
        setNotes("");
        setBlockDecision("NO_BLOCK");
        setBlockReason("");
        await onChanged();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to approve request."
        );
      }
    });
  }

  function reject() {
    if (!notes.trim()) {
      setError("Reject reason is required before rejecting this request.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        await approvalsApi.reject(approval.id, notes.trim());
        setNotes("");
        setBlockDecision("NO_BLOCK");
        setBlockReason("");
        await onChanged();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to reject request."
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-orange-950">
            Approval decision
          </h3>
          <p className="mt-1 text-sm text-orange-800">
            Approve applies immediately. Reject requires a written reason before
            the request can be rejected.
          </p>
          {isResignationAreaManager ? (
            <p className="mt-2 text-xs font-medium text-orange-700">
              Block decision defaults to No block. Choose a duration only when the
              Picker should be blocked.
            </p>
          ) : null}
        </div>
        <UserCheck className="h-5 w-5 text-orange-700" />
      </div>
      <div className="mt-4 grid gap-4">
        {isResignationAreaManager ? (
          <BlockDecisionFields
            blockDecision={blockDecision}
            blockReason={blockReason}
            onChange={(patch) => {
              if (patch.blockDecision) {
                setBlockDecision(patch.blockDecision);
                if (patch.blockDecision === "NO_BLOCK") {
                  setBlockReason("");
                }
              }
              if (patch.blockReason !== undefined) {
                setBlockReason(patch.blockReason);
              }
            }}
            title="Block decision"
          />
        ) : null}
        <label className="grid gap-1 text-sm font-medium text-orange-950">
          Decision notes
          <textarea
            className="min-h-24 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional for approve. Required for reject."
            value={notes}
          />
          <span className="text-xs font-normal text-orange-700">
            Approval can be submitted without notes. Rejection needs a clear reason.
          </span>
        </label>
        {error ? <ErrorState message={error} /> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            className="min-h-11 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isPending}
            onClick={approve}
            type="button"
          >
            {isPending ? "Submitting..." : "Approve request"}
          </Button>
          <Button
            className="min-h-11 rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            disabled={isPending}
            onClick={reject}
            type="button"
            variant="outline"
          >
            Reject request
          </Button>
        </div>
      </div>
    </section>
  );
}
