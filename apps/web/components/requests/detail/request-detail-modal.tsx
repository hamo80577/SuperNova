"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { requestsApi, type RequestDetail } from "@/lib/api/requests";
import { FinalizeNewHirePanel } from "../actions/finalize-new-hire-panel";
import { FinalizeOffboardingPanel } from "../actions/finalize-offboarding-panel";
import { RequestApprovalDecisionPanel } from "../actions/request-approval-decision-panel";
import { ApprovalStepsList } from "./approval-steps-list";
import { RequestModalHero } from "./request-modal-hero";
import { RequestTimeline } from "./request-timeline";
import { RequestTypePanel } from "./request-type-panel";
import { WorkflowStateSummary } from "./workflow-state-summary";
import { InfoCard } from "../shared/request-info-card";
import { ErrorState, LoadingState } from "../shared/request-states";
import { formatEnum, getRequestLoadErrorMessage } from "../shared/request-utils";

export function RequestDetailModal({
  onChanged,
  onClose,
  requestId
}: {
  onChanged: () => Promise<void>;
  onClose: () => void;
  requestId: string;
}) {
  const { user } = useAuth();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRequest() {
    setLoading(true);
    setError(null);
    try {
      setRequest(await requestsApi.get(requestId));
    } catch (caughtError) {
      setError(getRequestLoadErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequest();
  }, [requestId]);

  const actionableApproval = request?.approvals.find(
    (approval) =>
      approval.status === "PENDING" &&
      approval.step === request.currentStep &&
      (approval.approverId === user?.id ||
        approval.approverRole === user?.role ||
        ((user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
          approval.step === "ADMIN_FINAL_APPROVAL"))
  );

  return (
    <ModalPortal>
    <div
      aria-modal="true"
      className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <section className="max-h-[94dvh] w-full overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl sm:max-w-4xl sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              Request profile
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {request ? formatEnum(request.type) : "Loading request"}
            </h2>
          </div>
          <Button
            aria-label="Close request"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[calc(94dvh-88px)] overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden">
          {loading ? <LoadingState label="Loading request detail" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {request ? (
            <div className="grid gap-4">
              <RequestModalHero request={request} />
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <RequestTypePanel request={request} />
                <InfoCard title="Workflow">
                  <WorkflowStateSummary request={request} />
                </InfoCard>
              </div>
              <InfoCard title="Approval Steps">
                <ApprovalStepsList approvals={request.approvals} variant="modal" />
              </InfoCard>

              {actionableApproval &&
              !(
                request.type === "NEW_HIRE" &&
                actionableApproval.step === "ADMIN_FINAL_APPROVAL"
              ) &&
              !(
                request.type === "RESIGNATION" &&
                actionableApproval.step === "ADMIN_FINAL_APPROVAL"
              ) ? (
                <RequestApprovalDecisionPanel
                  approval={actionableApproval}
                  onChanged={async () => {
                    await loadRequest();
                    await onChanged();
                  }}
                  request={request}
                />
              ) : null}

              {request.type === "NEW_HIRE" &&
              request.status === "PENDING_ADMIN" &&
              request.currentStep === "ADMIN_FINAL_APPROVAL" &&
              (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
                <FinalizeNewHirePanel
                  onFinalized={async () => {
                    await loadRequest();
                    await onChanged();
                  }}
                  request={request}
                />
              ) : null}

              {request.type === "RESIGNATION" &&
              request.status === "PENDING_ADMIN" &&
              request.currentStep === "ADMIN_FINAL_APPROVAL" &&
              (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
                <FinalizeOffboardingPanel
                  onFinalized={async () => {
                    await loadRequest();
                    await onChanged();
                  }}
                  request={request}
                  type="RESIGNATION"
                />
              ) : null}

              <InfoCard title="Timeline">
                <RequestTimeline items={request.timeline} limit={8} variant="modal" />
              </InfoCard>
            </div>
          ) : null}
        </div>
      </section>
    </div>
    </ModalPortal>
  );
}
