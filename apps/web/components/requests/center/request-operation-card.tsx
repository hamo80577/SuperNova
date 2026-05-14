"use client";

import { ArrowRight, Clock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type PendingApproval } from "@/lib/api/approvals";
import { type RequestSummary } from "@/lib/api/requests";
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
      className="group grid min-h-[190px] text-left rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">
              {formatEnum(request.type)}
            </span>
            <span className="block text-xs text-slate-500">
              {relativeTime(request.createdAt)}
            </span>
          </span>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="mt-4 grid gap-2">
        <p className="line-clamp-2 text-base font-semibold text-slate-950">
          {context.title}
        </p>
        <p className="line-clamp-2 text-sm leading-5 text-slate-500">
          {context.subtitle}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500">
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

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        {actionRequired ? (
          <Badge className="bg-orange-50 text-orange-700" variant="outline">
            Action required
          </Badge>
        ) : (
          <span className="text-xs font-medium text-slate-400">Review</span>
        )}
        <span className="inline-flex items-center text-sm font-semibold text-orange-600">
          Open
          <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}
