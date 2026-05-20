"use client";

import { MoveRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { type RequestDetail } from "@/lib/api/requests";
import { PickerAvatar } from "../forms/resignation/offboarding-picker-search";
import { RequestStatusBadge } from "../shared/request-badges";
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

  const displayedDecision = context.finalization ?? context.areaManagerDecision;
  const blockDecision =
    displayedDecision?.blockDecision ??
    (context.targetRole === "AREA_MANAGER" ? "NO_BLOCK" : null);

  return (
    <InfoCard title="Resignation">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <PickerAvatar name={request.targetUser?.nameEn ?? formatEnum(context.targetRole)} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-950">
                {request.targetUser?.nameEn ?? context.targetUserId}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {request.targetUser?.phoneNumber ?? "Phone not available"} ·{" "}
                {request.sourceVendor?.vendorName ??
                  request.sourceChain?.chainName ??
                  context.sourceChainId}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              {request.targetUser?.role
                ? formatEnum(request.targetUser.role)
                : formatEnum(context.targetRole)}
            </Badge>
            <RequestStatusBadge status={request.status} />
          </div>
        </div>

        <div className="grid gap-0 p-4">
          <ProfileRow
            label="User name"
            value={request.targetUser?.nameEn ?? context.targetUserId}
          />
          <ProfileRow
            label="Role"
            value={
              request.targetUser?.role
                ? formatEnum(request.targetUser.role)
                : formatEnum(context.targetRole)
            }
          />
          <ProfileRow
            copyValue={request.targetUser?.phoneNumber}
            label="Phone"
            value={request.targetUser?.phoneNumber ?? "Not available"}
          />
          {context.targetRole !== "AREA_MANAGER" ? (
            <ProfileRow
              label="Branch name"
              value={request.sourceVendor?.vendorName ?? context.sourceVendorId}
            />
          ) : null}
          <ProfileRow
            label="Chain"
            value={request.sourceChain?.chainName ?? context.sourceChainId}
          />
          <ProfileRow
            copyValue={request.targetUser?.shopperId}
            label="Shopper ID"
            value={request.targetUser?.shopperId ?? "Not available"}
          />
          <ProfileRow
            copyValue={request.targetUser?.ibsId}
            label="IBS ID"
            value={request.targetUser?.ibsId ?? "Not available"}
          />
          <ProfileRow
            copyValue={request.targetUser?.nationalId}
            label="National ID"
            value={request.targetUser?.nationalId ?? "Not available"}
          />
          <ProfileRow
            label="Last working day"
            value={formatDateValue(context.effectiveDate)}
          />
          <ProfileRow
            label="Hiring date"
            value={formatDateValue(request.targetUser?.joiningDate)}
          />
          <ProfileRow label="Reason" value={context.reason} />
          {context.reasonDetails ? (
            <ProfileRow label="Reason details" value={context.reasonDetails} />
          ) : null}
          <ProfileRow
            label="Block decision"
            value={
              blockDecision
                ? formatOffboardingBlockDecision(blockDecision)
                : "Pending Area Manager decision"
            }
          />
          {displayedDecision?.blockReason ? (
            <ProfileRow label="Block reason" value={displayedDecision.blockReason} />
          ) : null}
        </div>
      </div>
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
    request.sourceChain?.chainName ?? context.source.chainId ?? "Not available";

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
          <ProfileRow label="Date of birth" value={formatDateValue(context.dateOfBirth)} />
          <ProfileRow label="Gender" value={formatEnum(context.gender)} />
          <ProfileRow label="Address" value={context.address ?? "Not available"} />
          {context.targetRole !== "AREA_MANAGER" ? (
            <>
              <ProfileRow label="Source Chain" value={selectedChainText} />
              <ProfileRow
                label="Source Branch"
                value={request.sourceVendor?.vendorName ?? context.source.vendorId ?? "Not available"}
              />
            </>
          ) : (
            <ProfileRow
              label="Chain assignment"
              value="Chain assignment is managed from the Area Manager profile after creation."
            />
          )}
          {context.targetRole === "PICKER" ? (
            <ProfileRow
              label="Area Manager Shopper ID"
              value={context.areaManagerDecision?.shopperId ?? "Not captured"}
            />
          ) : null}
          <ProfileRow
            label="Hiring date"
            value={
              context.finalization?.completedAt
                ? `${formatDateValue(context.finalization.completedAt)} · Admin controlled`
                : "Set by Admin during final action"
            }
          />
          {context.rehireUserId ? (
            <ProfileRow
              label={`Previous ${formatEnum(context.targetRole)} ID`}
              value={context.rehireUserId}
            />
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
              href={`/users?userId=${request.targetUser.id}`}
              prefetch
            >
              Open user profile
            </Link>
          ) : null}
          <Definition
            label="Assignment type"
            value={
              context.finalization.assignmentType ??
              (context.targetRole === "AREA_MANAGER"
                ? "Managed from Area Manager profile"
                : "Not available")
            }
          />
          <Definition
            label="Assignment result"
            value={
              context.finalization.assignmentId ??
              context.finalization.assignmentIds?.join(", ") ??
              (context.targetRole === "AREA_MANAGER"
                ? "No Chain assignment created during New Hire"
                : "Not available")
            }
          />
          <Definition
            label="Finalized Shopper ID"
            value={context.finalization.shopperId ?? "Not required"}
          />
          <Definition
            label="Completed"
            value={
              context.finalization.completedAt
                ? formatDateTimeValue(context.finalization.completedAt)
                : "Not available"
            }
          />
        </div>
      ) : null}
    </InfoCard>
  );
}

function ProfileRow({
  copyValue,
  label,
  value
}: {
  copyValue?: string | null;
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <span className="text-xs font-medium text-slate-500">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-medium text-slate-950">
          {value}
        </span>
        {copyValue ? <CopyValueButton label={label} value={copyValue} /> : null}
      </span>
    </div>
  );
}

function CopyValueButton({ label, value }: { label: string; value: string }) {
  return (
    <CopyButton
      aria-label={`Copy ${label}`}
      iconOnly
      label={`Copy ${label}`}
      size="sm"
      text={value}
    />
  );
}

function formatDateValue(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return formatDateParts(value, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTimeValue(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return formatDateParts(value, {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateParts(value: string, options: Intl.DateTimeFormatOptions) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsedDate = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      )
    : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", options).format(parsedDate);
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700">
            <MoveRight className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-950">
              {request.targetUser?.nameEn ?? context.pickerId}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {request.sourceVendor?.vendorName ?? context.sourceVendorId} to{" "}
              {request.destinationVendor?.vendorName ?? context.destinationVendorId}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
            {context.approvalPath === "CROSS_CHAIN"
              ? "Cross-chain Transfer"
              : "Same-chain Transfer"}
          </Badge>
          <RequestStatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid gap-0 p-4">
        <ProfileRow label="Picker" value={request.targetUser?.nameEn ?? context.pickerId} />
        <ProfileRow
          label="Source Branch"
          value={request.sourceVendor?.vendorName ?? context.sourceVendorId}
        />
        <ProfileRow
          label="Source Chain"
          value={request.sourceChain?.chainName ?? context.sourceChainId}
        />
        <ProfileRow
          label="Destination Branch"
          value={request.destinationVendor?.vendorName ?? context.destinationVendorId}
        />
        <ProfileRow
          label="Destination Chain"
          value={request.destinationChain?.chainName ?? context.destinationChainId}
        />
        <ProfileRow label="Reason" value={context.reason} />
        <ProfileRow
          label="Requested transfer date"
          value={formatDateValue(context.requestedTransferDate)}
        />
        <ProfileRow label="Notes" value={context.notes ?? "None"} />
        {context.completedAt ? (
          <ProfileRow
            label="Transfer applied"
            value={`${formatDateTimeValue(context.completedAt)} · old ${context.oldAssignmentId} · new ${context.newAssignmentId}`}
          />
        ) : null}
      </div>
    </div>
  );
}
