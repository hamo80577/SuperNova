import type { RequestDetail } from "@/lib/api/requests";

import { ApprovalStatusBadge } from "../shared/request-badges";
import { EmptyState } from "../shared/request-empty-state";
import { formatEnum } from "../shared/request-utils";

type ApprovalStep = RequestDetail["approvals"][number];

export function ApprovalStepsList({
  approvals,
  variant = "page"
}: {
  approvals: ApprovalStep[];
  variant?: "modal" | "page";
}) {
  if (!approvals.length) {
    return <EmptyState message="No approval steps generated yet." compact />;
  }

  if (variant === "modal") {
    return (
      <div className="grid gap-2">
        {approvals.map((approval) => (
          <ApprovalStepCard approval={approval} key={approval.id} variant="modal" />
        ))}
      </div>
    );
  }

  return (
    <>
      {approvals.map((approval) => (
        <ApprovalStepCard approval={approval} key={approval.id} variant="page" />
      ))}
    </>
  );
}

function ApprovalStepCard({
  approval,
  variant
}: {
  approval: ApprovalStep;
  variant: "modal" | "page";
}) {
  if (variant === "modal") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {formatEnum(approval.step)}
          </p>
          <p className="text-xs text-slate-500">
            {approval.approver?.nameEn ?? formatEnum(approval.approverRole)}
          </p>
        </div>
        <ApprovalStatusBadge status={approval.status} />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{formatEnum(approval.step)}</p>
        <ApprovalStatusBadge status={approval.status} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Owner: {approval.approver?.nameEn ?? formatEnum(approval.approverRole)}
      </p>
    </div>
  );
}
