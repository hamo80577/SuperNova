"use client";

import {
  CheckCircle2,
  ChevronRight,
  KeyRound,
  ShieldAlert,
  XCircle
} from "lucide-react";
import { type MouseEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { approvalsApi, type PendingApproval } from "@/lib/api/approvals";
import { type OffboardingBlockDecision } from "@/lib/api/requests";
import { cn } from "@/lib/utils";

import { BlockDecisionFields } from "../forms/resignation/block-decision-fields";
import { ErrorState } from "../shared/request-states";
import { formatEnum, parseNewHirePayload } from "../shared/request-utils";

export type QuickApprovalDecision = {
  action: "approve" | "reject";
  approval: PendingApproval;
};

export function requiresDetailApproval(approval: PendingApproval) {
  return (
    approval.step === "ADMIN_FINAL_APPROVAL" &&
    (approval.request.type === "NEW_HIRE" ||
      approval.request.type === "RESIGNATION")
  );
}

export function RequestQuickActions({
  approval,
  className,
  isMobile = false,
  onDecision,
  onOpenDetails
}: {
  approval: PendingApproval | null;
  className?: string;
  isMobile?: boolean;
  onDecision: (decision: QuickApprovalDecision) => void;
  onOpenDetails: () => void;
}) {
  function stopAndRun(event: MouseEvent<HTMLButtonElement>, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  if (!approval) {
    return (
      <Button
        aria-label="Open ticket"
        className={cn(
          "h-9 rounded-xl px-2 text-[color:var(--sn-muted)]",
          isMobile ? "min-w-10 px-3" : "w-9",
          className
        )}
        onClick={(event) => stopAndRun(event, onOpenDetails)}
        size="sm"
        title="Open ticket"
        type="button"
        variant="ghost"
      >
        <ChevronRight className="h-4 w-4" />
        {isMobile ? <span className="ml-1 text-xs">Open</span> : null}
      </Button>
    );
  }

  const detailApproval = requiresDetailApproval(approval);
  const FinalizeIcon =
    approval.request.type === "RESIGNATION" ? ShieldAlert : KeyRound;

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1.5",
        isMobile ? "w-full justify-between" : "",
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {detailApproval ? (
        <Button
          aria-label={`Open final action for ${formatEnum(approval.request.type)}`}
          className={cn(
            "h-9 rounded-xl bg-[color:var(--tlb-orange)] px-3 text-white hover:bg-[#E85100]",
            isMobile ? "min-w-10 flex-1 px-2" : ""
          )}
          onClick={(event) => stopAndRun(event, onOpenDetails)}
          size="sm"
          title={`Open final action for ${formatEnum(approval.request.type)}`}
          type="button"
        >
          <FinalizeIcon className="h-4 w-4" />
          <span className={cn("ml-1.5", isMobile ? "text-xs" : "")}>
            Finalize
          </span>
        </Button>
      ) : (
        <Button
          aria-label="Approve ticket"
          className={cn(
            "h-9 rounded-xl border border-[oklch(0.80_0.08_150)] bg-[oklch(0.95_0.04_150)] px-3 text-[oklch(0.42_0.13_150)] hover:bg-[oklch(0.91_0.055_150)]",
            isMobile ? "min-w-10 flex-1 px-2" : ""
          )}
          onClick={(event) =>
            stopAndRun(event, () => onDecision({ action: "approve", approval }))
          }
          size="sm"
          title="Approve ticket"
          type="button"
          variant="outline"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className={cn("ml-1.5", isMobile ? "text-xs" : "")}>
            Approve
          </span>
        </Button>
      )}
      <Button
        aria-label="Reject ticket"
        className={cn(
          "h-9 rounded-xl border-[oklch(0.85_0.06_27)] px-3 text-[oklch(0.55_0.19_27)] hover:bg-[oklch(0.95_0.035_27)] hover:text-[oklch(0.48_0.19_27)]",
          isMobile ? "min-w-10 flex-1 px-2" : ""
        )}
        onClick={(event) =>
          stopAndRun(event, () => onDecision({ action: "reject", approval }))
        }
        size="sm"
        title="Reject ticket"
        type="button"
        variant="outline"
      >
        <XCircle className="h-4 w-4" />
        <span className={cn("ml-1.5", isMobile ? "text-xs" : "")}>
          Reject
        </span>
      </Button>
    </div>
  );
}

export function RequestQuickDecisionDialog({
  decision,
  onChanged,
  onClose
}: {
  decision: QuickApprovalDecision;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [blockDecision, setBlockDecision] = useState<OffboardingBlockDecision | "">(
    ""
  );
  const [blockReason, setBlockReason] = useState("");
  const [shopperId, setShopperId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { action, approval } = decision;
  const isApprove = action === "approve";
  const requiresBlockDecision =
    isApprove &&
    approval.request.type === "RESIGNATION" &&
    approval.step === "AREA_MANAGER_APPROVAL";
  const newHireContext = parseNewHirePayload(approval.request.payload);
  const requiresShopperId =
    isApprove &&
    approval.request.type === "NEW_HIRE" &&
    approval.step === "AREA_MANAGER_APPROVAL" &&
    newHireContext?.targetRole === "PICKER";

  function submitDecision() {
    const normalizedNotes = notes.trim();
    const normalizedShopperId = shopperId.trim();

    if (action === "reject" && !normalizedNotes) {
      setError("Reject reason is required before rejecting this ticket.");
      return;
    }
    if (requiresShopperId && !normalizedShopperId) {
      setError("Shopper ID is required before approving Picker New Hire.");
      return;
    }
    if (requiresBlockDecision && !blockDecision) {
      setError("Choose a block decision before approving Resignation.");
      return;
    }
    if (
      requiresBlockDecision &&
      blockDecision === "PERMANENT" &&
      !blockReason.trim()
    ) {
      setError("Block reason is required for Permanent block.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (action === "approve") {
          await approvalsApi.approve(
            approval.id,
            requiresBlockDecision
              ? {
                  blockDecision: blockDecision as OffboardingBlockDecision,
                  ...(blockReason.trim() ? { blockReason: blockReason.trim() } : {}),
                  ...(normalizedNotes ? { notes: normalizedNotes } : {})
                }
              : requiresShopperId
                ? {
                    shopperId: normalizedShopperId,
                    ...(normalizedNotes ? { notes: normalizedNotes } : {})
                  }
                : normalizedNotes || undefined
          );
        } else {
          await approvalsApi.reject(approval.id, normalizedNotes);
        }
        await onChanged();
        onClose();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to save approval decision."
        );
      }
    });
  }

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[140] grid place-items-end bg-[color:var(--tlb-burgundy)]/35 p-0 sm:place-items-center sm:p-4"
        role="dialog"
      >
        <section className="w-full rounded-t-[1.5rem] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_8px_32px_rgba(65,21,23,0.16)] sm:max-w-lg sm:rounded-[1.5rem] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
                {formatEnum(approval.step)}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[color:var(--sn-ink)]">
                {isApprove ? "Approve ticket" : "Reject ticket"}
              </h2>
              <p className="mt-1 text-sm leading-5 text-[color:var(--sn-muted)]">
                {formatEnum(approval.request.type)} ·{" "}
                {approval.request.targetUser?.nameEn ??
                  approval.request.createdBy.nameEn}
              </p>
            </div>
          </div>

          {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

          <div className="mt-4 grid gap-4">
            {requiresBlockDecision ? (
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
                title="Area Manager block decision"
              />
            ) : null}

            {requiresShopperId ? (
              <label className="grid gap-1 text-sm font-medium text-[color:var(--sn-ink)]">
                Shopper ID
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => setShopperId(event.target.value)}
                  placeholder="Shopper ID"
                  value={shopperId}
                />
              </label>
            ) : null}

            <label className="grid gap-1 text-sm font-medium text-[color:var(--sn-ink)]">
              {action === "reject" ? "Reject reason" : "Decision notes"}
              <textarea
                className="min-h-24 rounded-xl border border-[color:var(--sn-border)] bg-white px-3 py-2 text-sm text-[color:var(--sn-ink)] outline-none transition focus:border-[#FFD8BD] focus:ring-2 focus:ring-[#FFE8D9]"
                onChange={(event) => setNotes(event.target.value)}
                placeholder={
                  action === "reject"
                    ? "Write the rejection reason"
                    : "Optional notes"
                }
                value={notes}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="min-h-11 rounded-xl"
              disabled={isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className={cn(
                "min-h-11 rounded-xl",
                isApprove
                  ? "bg-[oklch(0.58_0.13_150)] text-white hover:bg-[oklch(0.52_0.13_150)]"
                  : "border-[oklch(0.80_0.06_27)] bg-[oklch(0.55_0.19_27)] text-white hover:bg-[oklch(0.48_0.19_27)]"
              )}
              disabled={isPending}
              onClick={submitDecision}
              type="button"
            >
              {isPending
                ? "Saving..."
                : isApprove
                  ? "Confirm approve"
                  : "Confirm reject"}
            </Button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
