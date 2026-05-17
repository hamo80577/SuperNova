"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { requestsApi, type RequestDetail } from "@/lib/api/requests";
import { FinalizeNewHirePanel } from "../actions/finalize-new-hire-panel";
import { FinalizeOffboardingPanel } from "../actions/finalize-offboarding-panel";
import { ApprovalStepsList } from "./approval-steps-list";
import { RequestTimeline } from "./request-timeline";
import { NewHireRequestDetailPanel, ResignationRequestDetailPanel, TransferContext } from "./request-type-panel";
import { WorkflowStateSummary } from "./workflow-state-summary";
import { RequestStatusBadge } from "../shared/request-badges";
import { EmptyState } from "../shared/request-empty-state";
import { Definition } from "../shared/request-field";
import { InfoCard } from "../shared/request-info-card";
import { ErrorState, LoadingState } from "../shared/request-states";
import { formatEnum, getRequestLoadErrorMessage } from "../shared/request-utils";

export function RequestDetailView() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadRequest() {
    setLoading(true);
    setError(null);
    try {
      setRequest(await requestsApi.get(params.id));
    } catch (caughtError) {
      setError(getRequestLoadErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequest();
  }, [params.id]);

  function submit() {
    startTransition(async () => {
      try {
        await requestsApi.submit(params.id);
        await loadRequest();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit request."
        );
      }
    });
  }

  function cancel() {
    const notes = window.prompt("Cancellation notes") ?? undefined;
    startTransition(async () => {
      try {
        await requestsApi.cancel(params.id, notes);
        await loadRequest();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to cancel request."
        );
      }
    });
  }

  if (loading) {
    return <LoadingState label="Loading request detail" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!request) {
    return <EmptyState message="Request was not found." />;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">{formatEnum(request.type)}</Badge>
            <h1 className="mt-3 text-xl font-semibold">Request Detail</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Created by {request.createdBy.nameEn} on{" "}
              {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestStatusBadge status={request.status} />
            {request.status === "DRAFT" ? (
              <Button disabled={isPending} onClick={submit} size="sm" type="button">
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            ) : null}
            {["DRAFT", "PENDING_AREA_MANAGER", "PENDING_DESTINATION_AREA_MANAGER", "PENDING_ADMIN"].includes(
              request.status
            ) ? (
              <Button
                disabled={isPending}
                onClick={cancel}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            ) : null}
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href="/tickets"
              prefetch
            >
              Back
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Context">
          <Definition label="Source Chain" value={request.sourceChain?.chainName ?? "None"} />
          <Definition label="Source Vendor" value={request.sourceVendor?.vendorName ?? "None"} />
          <Definition
            label="Destination Chain"
            value={request.destinationChain?.chainName ?? "None"}
          />
          <Definition
            label="Destination Vendor"
            value={request.destinationVendor?.vendorName ?? "None"}
          />
          <Definition label="Target User" value={request.targetUser?.nameEn ?? "None"} />
        </InfoCard>
        {request.type !== "NEW_HIRE" ? (
          <InfoCard title="Workflow State">
            <WorkflowStateSummary request={request} />
          </InfoCard>
        ) : null}
        {request.type === "NEW_HIRE" ? (
          <NewHireRequestDetailPanel request={request} />
        ) : null}
        {request.type === "RESIGNATION" ? (
          <ResignationRequestDetailPanel request={request} />
        ) : null}
        {request.type === "TRANSFER" ? (
          <InfoCard title="Transfer Context">
            <TransferContext payload={request.payload} request={request} />
          </InfoCard>
        ) : null}
        {request.type !== "NEW_HIRE" ? (
          <InfoCard title="Approval Steps">
            <ApprovalStepsList approvals={request.approvals} />
          </InfoCard>
        ) : null}
      </section>

      {request.type === "NEW_HIRE" &&
      request.status === "PENDING_ADMIN" &&
      request.currentStep === "ADMIN_FINAL_APPROVAL" &&
      (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
        <FinalizeNewHirePanel
          onFinalized={async () => {
            await loadRequest();
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
          }}
          request={request}
        type="RESIGNATION"
      />
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Timeline</h2>
        <RequestTimeline
          importantOnly={request.type === "NEW_HIRE"}
          items={request.timeline}
        />
      </section>
    </div>
  );
}
