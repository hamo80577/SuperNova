"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type RequestSummary } from "@/lib/api/requests";
import { NewHireRequestForm } from "./new-hire/new-hire-form";
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
  const title =
    draft.type === "NEW_HIRE"
      ? `${formatEnum(draft.targetRole)} New Hire`
      : `${formatEnum(draft.type)} request`;

  function requestClose() {
    if (isDirty && !window.confirm("Discard the New Hire data you entered?")) {
      return;
    }

    onClose();
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[130] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <section className="max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl [scrollbar-width:none] sm:max-w-5xl sm:rounded-[1.75rem] sm:p-5 xl:max-w-6xl [&::-webkit-scrollbar]:hidden">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              New request
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Create {title}
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
        {draft.type === "NEW_HIRE" ? (
          <NewHireRequestForm
            initialTargetRole={draft.targetRole}
            key={draft.targetRole}
            lockTargetRole
            onCreated={onCreated}
            onDirtyChange={setIsDirty}
          />
        ) : draft.type === "RESIGNATION" ? (
          <ResignationRequestForm onCreated={onCreated} />
        ) : draft.type === "TRANSFER" ? (
          <LifecyclePickerRequestForm onCreated={onCreated} type={draft.type} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            This request type is not available in the current workflow.
          </div>
        )}
      </section>
    </div>
  );
}
