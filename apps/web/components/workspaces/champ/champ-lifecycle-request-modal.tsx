"use client";

import { ArrowRight, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import { RequestDiscardDialog } from "@/components/requests/forms/request-discard-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import type { RequestSummary } from "@/lib/api/requests";
import { ChampOffboardingForm } from "../champ-offboarding-form";
import { ChampTransferForm } from "../champ-transfer-form";

type LifecycleActionType = "RESIGNATION" | "TRANSFER";

export function ChampLifecycleRequestModal({
  initialPickerId,
  onClose,
  onCreated,
  type,
  vendorId
}: {
  initialPickerId?: string;
  onClose: () => void;
  onCreated: (request: RequestSummary) => void;
  type: LifecycleActionType;
  vendorId?: string;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const isTransfer = type === "TRANSFER";
  const Icon = isTransfer ? ArrowRight : ShieldAlert;
  const title = isTransfer ? "Transfer Picker" : "Resignation request";
  const badge = isTransfer ? "Transfer workflow" : "Resignation workflow";
  const description = isTransfer
    ? "Create a Branch-scoped Picker Transfer request without leaving this Branch workspace."
    : "Create a Branch-scoped Picker Resignation request without leaving this Branch workspace.";

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
        className="fixed inset-0 z-[160] grid place-items-end bg-[rgba(65,21,23,0.45)] p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
        role="dialog"
      >
        <section className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[color:var(--sn-border)] bg-white shadow-2xl sm:max-w-5xl sm:rounded-[1.75rem] xl:max-w-6xl">
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--sn-border)] p-4 sm:p-5">
            <div className="min-w-0">
              <Badge
                className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                variant="outline"
              >
                {badge}
              </Badge>
              <div className="mt-2 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[color:var(--sn-ink)] sm:text-xl">
                  {title}
                </h2>
                <Icon className="h-5 w-5 shrink-0 text-[color:var(--tlb-orange)]" />
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--sn-muted)]">
                {description}
              </p>
            </div>
            <Button
              aria-label={`Close ${title}`}
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              onClick={requestClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden">
            {isTransfer ? (
              <ChampTransferForm
                initialPickerId={initialPickerId}
                mode="modal"
                onCancel={requestClose}
                onCreated={onCreated}
                onDirtyChange={setIsDirty}
                vendorId={vendorId}
              />
            ) : (
              <ChampOffboardingForm
                initialPickerId={initialPickerId}
                mode="modal"
                onCancel={requestClose}
                onCreated={onCreated}
                onDirtyChange={setIsDirty}
                type="RESIGNATION"
                vendorId={vendorId}
              />
            )}
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
