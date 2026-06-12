"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approvalsApi } from "@/lib/api/approvals";
import {
  type OffboardingBlockDecision,
  type RequestApprovalSummary,
  type RequestDetail
} from "@/lib/api/requests";
import { BlockDecisionFields } from "../forms/resignation/block-decision-fields";
import { Field } from "../shared/request-field";
import { ErrorState } from "../shared/request-states";
import { parseNewHirePayload } from "../shared/request-utils";

export function RequestApprovalDecisionPanel({
  approval,
  onChanged,
  onRejected,
  request
}: {
  approval: RequestApprovalSummary;
  onChanged: () => Promise<void>;
  onRejected?: () => void;
  request: RequestDetail;
}) {
  const isResignationAreaManager =
    request.type === "RESIGNATION" && approval.step === "AREA_MANAGER_APPROVAL";
  const newHireContext = parseNewHirePayload(request.payload);
  const requiresShopperId =
    request.type === "NEW_HIRE" &&
    approval.step === "AREA_MANAGER_APPROVAL" &&
    newHireContext?.targetRole === "PICKER";
  const [notes, setNotes] = useState("");
  const [shopperId, setShopperId] = useState("");
  const [resignationBlockDecision, setResignationBlockDecision] = useState<
    OffboardingBlockDecision | ""
  >("");
  const [resignationBlockReason, setResignationBlockReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPending, startTransition] = useTransition();

  function approve() {
    const normalizedShopperId = shopperId.trim();
    if (requiresShopperId && !normalizedShopperId) {
      setError("Shopper ID is required before approving Picker New Hire.");
      return;
    }
    if (isResignationAreaManager && !resignationBlockDecision) {
      setError("Choose a block decision before approving Resignation.");
      return;
    }
    if (
      isResignationAreaManager &&
      resignationBlockDecision === "PERMANENT" &&
      !resignationBlockReason.trim()
    ) {
      setError("Block reason is required for Permanent block.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        await approvalsApi.approve(
          approval.id,
          isResignationAreaManager
            ? {
                blockDecision: resignationBlockDecision as OffboardingBlockDecision,
                ...(resignationBlockReason.trim()
                  ? { blockReason: resignationBlockReason.trim() }
                  : {})
              }
            : requiresShopperId
              ? {
                  shopperId: normalizedShopperId
                }
            : undefined
        );
        setNotes("");
        setShopperId("");
        setResignationBlockDecision("");
        setResignationBlockReason("");
        setIsRejecting(false);
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
        setIsRejecting(false);
        await onChanged();
        onRejected?.();
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
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      {error ? <ErrorState message={error} /> : null}
      {isRejecting ? (
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-[color:var(--sn-ink)]">
            Reject reason
            <textarea
              className="min-h-24 rounded-xl border border-[color:var(--sn-border)] bg-white px-3 py-2 text-sm text-[color:var(--sn-ink)] outline-none transition focus:border-[#FFD8BD] focus:ring-2 focus:ring-[#FFE8D9]"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Write the rejection reason"
              value={notes}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              className="min-h-11 rounded-xl border-[oklch(0.80_0.06_27)] bg-[oklch(0.55_0.19_27)] text-white hover:bg-[oklch(0.48_0.19_27)]"
              disabled={isPending}
              onClick={reject}
              type="button"
            >
              {isPending ? "Rejecting..." : "Confirm reject"}
            </Button>
            <Button
              className="min-h-11 rounded-xl"
              disabled={isPending}
              onClick={() => {
                setIsRejecting(false);
                setNotes("");
                setError(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {isResignationAreaManager ? (
            <BlockDecisionFields
              blockDecision={resignationBlockDecision}
              blockReason={resignationBlockReason}
              onChange={(patch) => {
                if (patch.blockDecision) {
                  setResignationBlockDecision(patch.blockDecision);
                  if (patch.blockDecision === "NO_BLOCK") {
                    setResignationBlockReason("");
                  }
                }
                if (patch.blockReason !== undefined) {
                  setResignationBlockReason(patch.blockReason);
                }
              }}
              title="Area Manager block decision"
            />
          ) : null}
          {requiresShopperId ? (
            <div className="mb-1 w-full sm:mb-0 sm:max-w-xs">
              <Field label="Shopper ID">
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => setShopperId(event.target.value)}
                  placeholder="Shopper ID"
                  value={shopperId}
                />
              </Field>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              className="min-h-11 rounded-xl bg-[oklch(0.58_0.13_150)] text-white hover:bg-[oklch(0.52_0.13_150)]"
              disabled={isPending}
              onClick={approve}
              type="button"
            >
              {isPending ? "Approving..." : "Approve"}
            </Button>
            <Button
              className="min-h-11 rounded-xl border-[oklch(0.85_0.06_27)] text-[oklch(0.55_0.19_27)] hover:bg-[oklch(0.95_0.035_27)] hover:text-[oklch(0.48_0.19_27)]"
              disabled={isPending}
              onClick={() => {
                setIsRejecting(true);
                setError(null);
              }}
              type="button"
              variant="outline"
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
