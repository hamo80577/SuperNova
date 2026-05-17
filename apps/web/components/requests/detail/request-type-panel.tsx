import { MoveRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { type RequestDetail } from "@/lib/api/requests";
import { PickerAvatar } from "../forms/resignation/offboarding-picker-search";
import { EmptyState } from "../shared/request-empty-state";
import { Definition } from "../shared/request-field";
import { InfoCard } from "../shared/request-info-card";
import { formatEnum, formatOffboardingBlockDecision, parseNewHirePayload, parseOffboardingPayload, parseTransferPayload } from "../shared/request-utils";

export function RequestTypePanel({ request }: { request: RequestDetail }) {
  if (request.type === "NEW_HIRE") {
    return <NewHireRequestDetailPanel request={request} />;
  }

  if (request.type === "TRANSFER") {
    return (
      <InfoCard title="Transfer Details">
        <TransferContext payload={request.payload} request={request} />
      </InfoCard>
    );
  }

  return (
    <ResignationRequestDetailPanel request={request} />
  );
}

export function ResignationRequestDetailPanel({ request }: { request: RequestDetail }) {
  const context = parseOffboardingPayload(request.payload);

  if (!context) {
    return (
      <InfoCard title="Resignation">
        <EmptyState message="No Resignation context is available." compact />
      </InfoCard>
    );
  }

  return (
    <InfoCard title="Resignation">
      <div className="flex flex-wrap gap-2">
        <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
          Picker
        </Badge>
        <Badge variant="outline">{formatEnum(request.status)}</Badge>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex min-w-0 items-start gap-3">
          <PickerAvatar name={request.targetUser?.nameEn ?? "Picker"} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {request.targetUser?.nameEn ?? context.pickerId}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {request.targetUser?.phoneNumber ?? "Phone not available"} ·{" "}
              {request.sourceVendor?.vendorName ?? context.sourceVendorId}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <Definition
            label="Source Branch"
            value={request.sourceVendor?.vendorName ?? context.sourceVendorId}
          />
          <Definition
            label="Source Chain"
            value={request.sourceChain?.chainName ?? context.sourceChainId}
          />
          <Definition label="Assignment" value={context.pickerAssignmentId} />
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <Definition label="Last working day" value={context.effectiveDate} />
        <Definition label="Reason" value={context.reason} />
        <Definition label="Reason details" value={context.reasonDetails ?? "None"} />
        <Definition label="Notes" value={context.notes ?? "None"} />
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-950">
          Area Manager block recommendation
        </p>
        {context.areaManagerDecision ? (
          <>
            <Definition
              label="Decision"
              value={formatOffboardingBlockDecision(
                context.areaManagerDecision.blockDecision
              )}
            />
            <Definition
              label="Block status"
              value={formatEnum(context.areaManagerDecision.blockStatus)}
            />
            <Definition
              label="Block reason"
              value={context.areaManagerDecision.blockReason ?? "No block"}
            />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Waiting for Area Manager block decision.
          </p>
        )}
      </div>
      {context.finalization ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-950">Admin final result</p>
          <Definition
            label="Decision"
            value={formatOffboardingBlockDecision(context.finalization.blockDecision)}
          />
          <Definition
            label="Block status"
            value={formatEnum(context.finalization.blockStatus)}
          />
          <Definition
            label="Blocked until"
            value={context.finalization.blockedUntil ?? "Not applicable"}
          />
          <Definition
            label="Completed"
            value={new Date(context.finalization.completedAt).toLocaleString()}
          />
        </div>
      ) : null}
    </InfoCard>
  );
}

export function NewHireRequestDetailPanel({ request }: { request: RequestDetail }) {
  const context = parseNewHirePayload(request.payload);

  if (!context) {
    return (
      <InfoCard title="New Hire">
        <EmptyState message="No New Hire context is available." compact />
      </InfoCard>
    );
  }

  const isRehire = context.mode === "REHIRE";
  const selectedChainText =
    context.targetRole === "AREA_MANAGER"
      ? [
          request.sourceChain?.chainName,
          ...(context.source.chainIds ?? []).filter(
            (chainId) => chainId !== request.sourceChain?.id
          )
        ]
          .filter(Boolean)
          .join(", ") || "Not available"
      : request.sourceChain?.chainName ?? context.source.chainId ?? "Not available";

  return (
    <InfoCard title="New Hire">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <PickerAvatar name={context.nameEn ?? "New Hire"} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-950">
                {context.nameEn ?? "Not available"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {context.candidatePhone}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              {formatEnum(context.targetRole)}
            </Badge>
            <Badge variant="outline">{isRehire ? "Rehire" : "New User"}</Badge>
          </div>
        </div>

        <div className="grid gap-0 p-4">
          <ProfileRow label="National ID" value={context.nationalId ?? "Not available"} />
          <ProfileRow label="Arabic name" value={context.nameAr ?? "Not available"} />
          <ProfileRow label="Date of birth" value={context.dateOfBirth ?? "Not available"} />
          <ProfileRow label="Gender" value={formatEnum(context.gender)} />
          <ProfileRow label="Address" value={context.address ?? "Not available"} />
          <ProfileRow label="Source Chain" value={selectedChainText} />
          {context.targetRole !== "AREA_MANAGER" ? (
            <ProfileRow
              label="Source Branch"
              value={request.sourceVendor?.vendorName ?? context.source.vendorId ?? "Not available"}
            />
          ) : (
            <ProfileRow
              label="Selected Chain IDs"
              value={(context.source.chainIds ?? []).join(", ") || "Not available"}
            />
          )}
          <ProfileRow
            label="Hiring date"
            value={
              context.finalization?.completedAt
                ? `${new Date(context.finalization.completedAt).toLocaleDateString()} · Admin controlled`
                : "Set by Admin during final action"
            }
          />
          {context.rehireUserId ? (
            <ProfileRow label="Previous Picker ID" value={context.rehireUserId} />
          ) : null}
          <ProfileRow label="Notes" value={context.notes ?? "None"} />
        </div>
      </div>

      {context.finalization ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <Definition label="Finalized user" value={context.finalization.userId} />
          {request.targetUser ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              href={`/admin/users?userId=${request.targetUser.id}`}
              prefetch
            >
              Open user profile
            </Link>
          ) : null}
          <Definition
            label="Assignment type"
            value={context.finalization.assignmentType}
          />
          <Definition
            label="Assignment result"
            value={
              context.finalization.assignmentId ??
              context.finalization.assignmentIds?.join(", ") ??
              "Not available"
            }
          />
          <Definition
            label="Shopper ID"
            value={context.finalization.shopperId ?? "Not required"}
          />
          <Definition
            label="Completed"
            value={
              context.finalization.completedAt
                ? new Date(context.finalization.completedAt).toLocaleString()
                : "Not available"
            }
          />
        </div>
      ) : null}
    </InfoCard>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <span className="text-xs font-medium text-slate-500">
        {label}
      </span>
      <span className="min-w-0 break-words text-sm font-medium text-slate-950">
        {value}
      </span>
    </div>
  );
}

export function TransferContext({
  payload,
  request
}: {
  payload: unknown;
  request: RequestDetail;
}) {
  const context = parseTransferPayload(payload);

  if (!context) {
    return <EmptyState message="No Transfer context is available." compact />;
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <MoveRight className="h-4 w-4 text-primary" />
        {context.approvalPath === "CROSS_CHAIN"
          ? "Cross-chain Transfer"
          : "Same-chain Transfer"}
      </div>
      <Definition
        label="Picker"
        value={request.targetUser?.nameEn ?? context.pickerId}
      />
      <Definition
        label="Source Branch"
        value={request.sourceVendor?.vendorName ?? context.sourceVendorId}
      />
      <Definition
        label="Source Chain"
        value={request.sourceChain?.chainName ?? context.sourceChainId}
      />
      <Definition
        label="Destination Branch"
        value={
          request.destinationVendor?.vendorName ?? context.destinationVendorId
        }
      />
      <Definition
        label="Destination Chain"
        value={
          request.destinationChain?.chainName ?? context.destinationChainId
        }
      />
      <Definition label="Reason" value={context.reason} />
      <Definition
        label="Requested transfer date"
        value={context.requestedTransferDate ?? "Not set"}
      />
      <Definition label="Notes" value={context.notes ?? "None"} />
      <Definition
        label="Approval path"
        value={
          context.approvalPath === "CROSS_CHAIN"
            ? "Source Area Manager, then destination Area Manager"
            : "Source Area Manager only"
        }
      />
      {context.completedAt ? (
        <Definition
          label="Transfer applied"
          value={`${new Date(context.completedAt).toLocaleString()} · old ${context.oldAssignmentId} · new ${context.newAssignmentId}`}
        />
      ) : null}
    </>
  );
}
