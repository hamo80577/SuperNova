"use client";

import { ArrowRight, Clock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type PendingApproval } from "@/lib/api/approvals";
import { type RequestSummary } from "@/lib/api/requests";
import { ApprovalProgressDots } from "../detail/approval-steps-indicator";
import { RequestStatusBadge } from "../shared/request-badges";
import { formatEnum, getRequestIcon, getRequestPrimaryContext, relativeTime } from "../shared/request-utils";

export function RequestOperationCard({
  actionRequired,
  approval,
  onOpen,
  request
}: {
  actionRequired: boolean;
  approval: PendingApproval | null;
  onOpen: () => void;
  request: RequestSummary;
}) {
  const Icon = getRequestIcon(request.type);
  const context = getRequestPrimaryContext(request);

  return (
    <button
      className="group grid min-h-[190px] text-left rounded-[1.25rem] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] transition hover:-translate-y-0.5 hover:border-[#FFD8BD] hover:shadow-[0_8px_32px_rgba(65,21,23,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[color:var(--sn-ink)]">
              {formatEnum(request.type)}
            </span>
            <span className="block text-xs text-[color:var(--sn-muted)]">
              {relativeTime(request.createdAt)}
            </span>
          </span>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="mt-4 grid gap-2">
        <p className="line-clamp-2 text-base font-semibold text-[color:var(--sn-ink)]">
          {context.title}
        </p>
        <p className="line-clamp-2 text-sm leading-5 text-[color:var(--sn-muted)]">
          {context.subtitle}
        </p>
      </div>

      <ApprovalProgressDots className="mt-4" request={request} />

      <div className="mt-4 grid gap-2 text-xs text-[color:var(--sn-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" />
          {request.createdBy.nameEn}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {approval
            ? formatEnum(approval.step)
            : request.currentStep
              ? formatEnum(request.currentStep)
              : "No pending step"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--sn-border)] pt-3">
        {actionRequired ? (
          <Badge className="bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]" variant="outline">
            Action required
          </Badge>
        ) : (
          <span className="text-xs font-medium text-[color:var(--sn-faint)]">Review</span>
        )}
        <span className="inline-flex items-center text-sm font-semibold text-[color:var(--tlb-orange)]">
          Open
          <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}
