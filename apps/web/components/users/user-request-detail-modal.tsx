"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { ApprovalStepsIndicator } from "@/components/requests/detail/approval-steps-indicator";
import { RequestTimeline } from "@/components/requests/detail/request-timeline";
import { RequestTypePanel } from "@/components/requests/detail/request-type-panel";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import { requestsApi, type RequestDetail } from "@/lib/api/requests";

type RequestDetailState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: RequestDetail; error?: never };

export function UserRequestDetailModal({
  onClose,
  requestId
}: {
  onClose: () => void;
  requestId: string;
}) {
  const [state, setState] = useState<RequestDetailState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    requestsApi
      .get(requestId)
      .then((request) => {
        if (alive) setState({ status: "ready", data: request });
      })
      .catch((error) => {
        if (!alive) return;
        setState({
          status: "error",
          error:
            error instanceof Error ? error.message : "Unable to load request detail."
        });
      });

    return () => {
      alive = false;
    };
  }, [requestId]);

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[260] grid place-items-center bg-slate-950/55 p-3 sn-dialog-overlay-in"
        role="dialog"
      >
        <section className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sn-dialog-panel-in">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Request detail
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-slate-950">
                  {requestId}
                </h3>
                <CopyButton
                  aria-label="Copy request ID"
                  className="h-8 w-8 p-0"
                  iconOnly
                  size="sm"
                  text={requestId}
                />
              </div>
            </div>
            <Button
              aria-label="Close request detail"
              className="h-10 w-10 rounded-xl p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {state.status === "loading" ? (
              <DetailPanelSkeleton label="Loading request" />
            ) : state.status === "error" ? (
              <div className="grid min-h-48 place-items-center rounded-2xl bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {state.error}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                <ApprovalStepsIndicator request={state.data} />
                <RequestTypePanel request={state.data} />
                <RequestTimeline items={state.data.timeline} />
              </div>
            )}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
