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
import { ApprovalStepsIndicator } from "./approval-steps-indicator";
import { HrSyncStatusCard } from "./hr-sync-status-card";
import { RequestTimeline } from "./request-timeline";
import { RequestTypePanel } from "./request-type-panel";
import { RequestStatusBadge } from "../shared/request-badges";
import { EmptyState } from "../shared/request-empty-state";
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
      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">{formatEnum(request.type)}</Badge>
            <h1 className="mt-3 text-xl font-semibold text-[color:var(--sn-ink)]">Request Detail</h1>
            <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
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

      <RequestTypePanel request={request} />
      <HrSyncStatusCard hrSync={request.hrSync} />

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

      <ApprovalStepsIndicator request={request} />

      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">Timeline</h2>
        <RequestTimeline
          importantOnly
          items={request.timeline}
        />
      </section>
    </div>
  );
}
