"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import { type OffboardingBlockDecision } from "@/lib/api/requests";
import { ApprovalQueueCard } from "./approvals-center";
import { BlockDecisionFields } from "../forms/resignation/block-decision-fields";
import { EmptyState } from "../shared/request-empty-state";
import { ErrorState, LoadingState } from "../shared/request-states";
import { formatEnum } from "../shared/request-utils";

export function LegacyApprovalsCenter() {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [decision, setDecision] = useState<{
    action: "approve" | "reject";
    approval: PendingApproval;
  } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decisionBlockDecision, setDecisionBlockDecision] =
    useState<OffboardingBlockDecision>("NO_BLOCK");
  const [decisionBlockReason, setDecisionBlockReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadApprovals() {
    setLoading(true);
    setError(null);
    try {
      const response = await approvalsApi.pending();
      setItems(response.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load pending approvals."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApprovals();
  }, []);

  function decide() {
    if (!decision) {
      return;
    }
    const requiresBlockDecision =
      decision.action === "approve" &&
      decision.approval.request.type === "RESIGNATION" &&
      decision.approval.step === "AREA_MANAGER_APPROVAL";

    if (
      requiresBlockDecision &&
      decisionBlockDecision !== "NO_BLOCK" &&
      !decisionBlockReason.trim()
    ) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (decision.action === "approve") {
          await approvalsApi.approve(
            decision.approval.id,
            requiresBlockDecision
              ? {
                  blockDecision: decisionBlockDecision,
                  ...(decisionBlockReason.trim()
                    ? { blockReason: decisionBlockReason.trim() }
                    : {}),
                  ...(decisionNotes.trim() ? { notes: decisionNotes.trim() } : {})
                }
              : decisionNotes
          );
        } else {
          await approvalsApi.reject(decision.approval.id, decisionNotes);
        }
        setDecision(null);
        setDecisionNotes("");
        setDecisionBlockDecision("NO_BLOCK");
        setDecisionBlockReason("");
        await loadApprovals();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to decide approval."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <Badge variant="outline">Approval queue</Badge>
        <h1 className="mt-3 text-xl font-semibold">Pending Actions</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Backend scope checks decide which approval steps are actionable. This page
          only renders the authenticated user&apos;s pending queue.
        </p>
      </section>
      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingState label="Loading approvals" />
      ) : items.length ? (
        <div className="grid gap-3">
          {items.map((approval) => (
            <ApprovalQueueCard
              approval={approval}
              isPending={isPending}
              key={approval.id}
              onDecision={(action) => {
                  setDecision({ action, approval });
                  setDecisionNotes("");
                  setDecisionBlockDecision("NO_BLOCK");
                  setDecisionBlockReason("");
                }}
            />
          ))}
        </div>
      ) : (
        <EmptyState message="No pending approvals are assigned to you." />
      )}
      {decision ? (
        <ModalPortal>
        <div
          aria-modal="true"
          className="fixed inset-0 z-[140] grid place-items-center bg-black/40 p-4"
          role="dialog"
        >
          <section className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-xl">
            <Badge variant="outline">{formatEnum(decision.action)}</Badge>
            <h2 className="mt-3 text-lg font-semibold">
              {formatEnum(decision.approval.step)}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This records the approval decision. New Hire Admin final approval
              requires Shopper ID finalization from the request detail page.
              Offboarding Admin final approval requires block decision and internal
              deactivation confirmation from the request detail page.
            </p>
            {decision.action === "approve" &&
            decision.approval.request.type === "RESIGNATION" &&
            decision.approval.step === "AREA_MANAGER_APPROVAL" ? (
              <div className="mt-4">
                <BlockDecisionFields
                  blockDecision={decisionBlockDecision}
                  blockReason={decisionBlockReason}
                  onChange={(patch) => {
                    if (patch.blockDecision) {
                      setDecisionBlockDecision(patch.blockDecision);
                      if (patch.blockDecision === "NO_BLOCK") {
                        setDecisionBlockReason("");
                      }
                    }
                    if (patch.blockReason !== undefined) {
                      setDecisionBlockReason(patch.blockReason);
                    }
                  }}
                  title="Block decision"
                />
              </div>
            ) : null}
            <label className="mt-4 grid gap-1 text-sm font-medium">
              Decision notes
              <Input
                onChange={(event) => setDecisionNotes(event.target.value)}
                placeholder="Optional notes"
                value={decisionNotes}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => {
                  setDecision(null);
                  setDecisionNotes("");
                  setDecisionBlockDecision("NO_BLOCK");
                  setDecisionBlockReason("");
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} onClick={decide} type="button">
                Confirm {formatEnum(decision.action)}
              </Button>
            </div>
          </section>
        </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
