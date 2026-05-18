"use client";

import { KeyRound, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { type PendingApproval } from "@/lib/api/approvals";
import { RequestOperationsCenter } from "../center/request-operations-center";
import { RequestStatusBadge } from "../shared/request-badges";
import { formatEnum } from "../shared/request-utils";

export function ApprovalsCenter() {
  return <RequestOperationsCenter defaultMode="action" />;
}

export function ApprovalQueueCard({
  approval,
  isPending,
  onDecision
}: {
  approval: PendingApproval;
  isPending: boolean;
  onDecision: (action: "approve" | "reject") => void;
}) {
  const requiresNewHireFinalization =
    approval.request.type === "NEW_HIRE" &&
    approval.step === "ADMIN_FINAL_APPROVAL";
  const requiresResignationFinalization =
    approval.request.type === "RESIGNATION" &&
    approval.step === "ADMIN_FINAL_APPROVAL";

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="outline">{formatEnum(approval.request.type)}</Badge>
          <h2 className="mt-3 text-base font-semibold">
            {formatEnum(approval.step)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted by {approval.request.createdBy.nameEn}
          </p>
        </div>
        <RequestStatusBadge status={approval.request.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {requiresNewHireFinalization ? (
          <Link
            className={buttonVariants({ size: "sm" })}
            href={`/tickets?requestId=${approval.request.id}`}
            prefetch
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Finalize with Shopper ID
          </Link>
        ) : requiresResignationFinalization ? (
          <Link
            className={buttonVariants({
              size: "sm",
              className:
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            })}
            href={`/tickets?requestId=${approval.request.id}`}
            prefetch
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Finalize Resignation
          </Link>
        ) : (
          <Button
            disabled={isPending}
            onClick={() => onDecision("approve")}
            type="button"
          >
            Approve
          </Button>
        )}
        <Button
          disabled={isPending}
          onClick={() => onDecision("reject")}
          type="button"
          variant="outline"
        >
          Reject
        </Button>
      </div>
      <Link
        className="mt-4 inline-flex text-sm font-medium text-primary"
        href={`/tickets?requestId=${approval.request.id}`}
      >
        View request detail
      </Link>
    </section>
  );
}
