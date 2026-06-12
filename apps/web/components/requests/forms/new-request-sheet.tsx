"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { DeductionRequestForm } from "@/components/deductions/deduction-request-form";
import { type RequestSummary } from "@/lib/api/requests";
import { NewHireRequestModal } from "./new-hire/new-hire-request-modal";
import { RequestDiscardDialog } from "./request-discard-dialog";
import { ResignationRequestForm } from "./resignation/resignation-form";
import { LifecyclePickerRequestForm } from "./transfer/transfer-form";
import { type NewRequestDraft } from "../shared/request-types";
import { formatEnum } from "../shared/request-utils";

export function NewRequestSheet({
  draft,
  onClose,
  onCreated
}: {
  draft: NewRequestDraft;
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const title =
    draft.type === "NEW_HIRE"
      ? draft.targetRole
        ? `${formatEnum(draft.targetRole)} New Hire`
        : "New Hire request"
      : draft.type === "RESIGNATION" && draft.targetRole
        ? `${formatEnum(draft.targetRole)} Resignation`
        : draft.type === "DEDUCTION"
          ? "New Deduction Ticket"
          : `${formatEnum(draft.type)} request`;
  const draftKey =
    draft.type === "NEW_HIRE"
      ? `${draft.type}:${draft.targetRole ?? "select"}`
      : draft.type === "RESIGNATION"
        ? `${draft.type}:${draft.targetRole ?? "select"}:${draft.initialUser?.id ?? ""}`
        : draft.type === "DEDUCTION"
          ? `${draft.type}:${draft.targetRole ?? "select"}:${draft.initialTarget?.userId ?? ""}`
          : `${draft.type}:${draft.initialPicker?.user.id ?? ""}:${draft.initialPicker?.assignment?.id ?? ""}`;

  if (draft.type === "NEW_HIRE") {
    return (
      <NewHireRequestModal
        description="Create a New Hire workflow request from the current workspace."
        initialTargetRole={draft.targetRole ?? "PICKER"}
        lockTargetRole={Boolean(draft.targetRole)}
        onClose={onClose}
        onCreated={onCreated}
        title={title}
      />
    );
  }

  function requestClose() {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }

    onClose();
  }

  useEffect(() => {
    setIsDirty(false);
    setConfirmCloseOpen(false);
  }, [draftKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isDirty) {
          setConfirmCloseOpen(true);
          return;
        }

        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, onClose]);

  return (
    <ModalPortal>
    <div
      aria-modal="true"
      className="fixed inset-0 z-[220] grid place-items-end bg-[color:var(--tlb-burgundy)]/30 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <section className="max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] [scrollbar-width:none] sm:max-w-5xl sm:rounded-[1.75rem] sm:p-5 xl:max-w-6xl [&::-webkit-scrollbar]:hidden">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Badge className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]" variant="outline">
              New request
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-[color:var(--sn-ink)]">
              {draft.type === "DEDUCTION" ? title : `Create ${title}`}
            </h2>
          </div>
          <Button
            aria-label="Close new request"
            className="h-10 w-10 rounded-xl p-0"
            onClick={requestClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {draft.type === "RESIGNATION" ? (
          <ResignationRequestForm
            initialTargetRole={draft.targetRole}
            initialUser={draft.initialUser}
            onCancel={requestClose}
            onCreated={onCreated}
            onDirtyChange={setIsDirty}
          />
        ) : draft.type === "TRANSFER" ? (
          <LifecyclePickerRequestForm
            initialPicker={draft.initialPicker}
            onCancel={requestClose}
            onCreated={onCreated}
            onDirtyChange={setIsDirty}
            type={draft.type}
          />
        ) : draft.type === "DEDUCTION" ? (
          <DeductionRequestForm
            initialTarget={draft.initialTarget}
            initialTargetRole={draft.targetRole}
            onCancel={requestClose}
            onCreated={onCreated}
            onDirtyChange={setIsDirty}
          />
        ) : (
          <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-body)]">
            This request type is not available in the current workflow.
          </div>
        )}
      </section>
    </div>
    <RequestDiscardDialog
      onConfirm={onClose}
      onKeepEditing={() => setConfirmCloseOpen(false)}
      open={confirmCloseOpen}
    />
    </ModalPortal>
  );
}
