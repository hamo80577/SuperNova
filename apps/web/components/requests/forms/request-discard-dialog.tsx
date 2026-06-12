"use client";

import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";

export function RequestDiscardDialog({
  description = "You have entered request data that has not been submitted yet.",
  onConfirm,
  onKeepEditing,
  open,
  title = "Discard this request?"
}: {
  description?: string;
  onConfirm: () => void;
  onKeepEditing: () => void;
  open: boolean;
  title?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="sn-dialog-overlay-in fixed inset-0 z-[240] grid place-items-center bg-[color:var(--tlb-burgundy)]/40 p-4 backdrop-blur-[2px]"
        role="alertdialog"
      >
        <section className="sn-dialog-panel-in w-full max-w-md rounded-2xl border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
                  {description}
                </p>
              </div>
            </div>
            <Button
              aria-label="Keep editing"
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              onClick={onKeepEditing}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="min-h-11 rounded-xl"
              onClick={onKeepEditing}
              type="button"
              variant="outline"
            >
              Keep editing
            </Button>
            <Button
              className="min-h-11 rounded-xl bg-[color:var(--tlb-orange)] text-white hover:bg-[#E85100]"
              onClick={onConfirm}
              type="button"
            >
              Discard and close
            </Button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
