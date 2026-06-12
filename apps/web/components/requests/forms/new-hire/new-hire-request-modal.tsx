"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import type {
  NewHireTargetRole,
  RequestSummary
} from "@/lib/api/requests";
import type { LockedNewHireBranchContext } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";
import { NewHireRequestForm } from "./new-hire-form";
import { RequestDiscardDialog } from "../request-discard-dialog";

export function NewHireRequestModal({
  description,
  fixedSourceVendorId,
  initialTargetRole = "PICKER",
  lockedBranchContext,
  lockTargetRole = false,
  onClose,
  onCreated,
  title
}: {
  description?: string;
  fixedSourceVendorId?: string;
  initialTargetRole?: NewHireTargetRole;
  lockedBranchContext?: LockedNewHireBranchContext;
  lockTargetRole?: boolean;
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
  title?: string;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const resolvedTitle =
    title ?? `${formatEnum(initialTargetRole)} New Hire request`;

  function requestClose() {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }

    onClose();
  }

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
        className="fixed inset-0 z-[160] grid place-items-end bg-[color:var(--tlb-burgundy)]/35 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
        role="dialog"
      >
        <section className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:max-w-5xl sm:rounded-[1.75rem] xl:max-w-6xl">
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--sn-border)] p-4 sm:p-5">
            <div className="min-w-0">
              <Badge
                className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                variant="outline"
              >
                New Hire workflow
              </Badge>
              <h2 className="mt-2 text-lg font-semibold text-[color:var(--sn-ink)] sm:text-xl">
                {resolvedTitle}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--sn-muted)]">
                {description ??
                  "Submit a workflow request. This does not create or assign a user directly."}
              </p>
            </div>
            <Button
              aria-label="Close New Hire"
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              onClick={requestClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden">
            <NewHireRequestForm
              fixedSourceVendorId={fixedSourceVendorId}
              initialTargetRole={initialTargetRole}
              lockedBranchContext={lockedBranchContext}
              lockTargetRole={lockTargetRole}
              onCancel={requestClose}
              onCreated={onCreated}
              onDirtyChange={setIsDirty}
            />
          </div>
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
