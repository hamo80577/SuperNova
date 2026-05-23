import type {
  AuditLog,
  HrSyncLog,
  RequestApproval,
  User
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { redactJson } from "../security/sensitive-data.utils";
import type {
  RequestDetailWithRelations,
  RequestWithRelations
} from "./request-includes";

type RequestSummaryOptions = {
  includeTargetOperationalFields?: boolean;
};

export function toRequestSummary(
  request: RequestWithRelations,
  options: RequestSummaryOptions | number = {}
) {
  const normalizedOptions = typeof options === "number" ? {} : options;

  return {
    id: request.id,
    type: request.type,
    status: request.status,
    currentStep: request.currentStep,
    payload: redactJson(request.payload),
    completedAt: request.completedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    createdBy: toUserSummary(request.createdBy),
    targetUser: request.targetUser
      ? toRequestTargetUserSummary(
          request.targetUser,
          normalizedOptions.includeTargetOperationalFields
        )
      : null,
    sourceChain: request.sourceChain
      ? toChainSummary(request.sourceChain)
      : null,
    sourceVendor: request.sourceVendor
      ? toVendorSummary(request.sourceVendor)
      : null,
    destinationChain: request.destinationChain
      ? toChainSummary(request.destinationChain)
      : null,
    destinationVendor: request.destinationVendor
      ? toVendorSummary(request.destinationVendor)
      : null,
    approvals: request.approvals.map(toApprovalSummary)
  };
}

export function toRequestDetailSummary(
  request: RequestDetailWithRelations,
  options: RequestSummaryOptions | number = {}
) {
  return {
    ...toRequestSummary(request, options),
    hrSync: toRequestHrSyncStatus(request.hrSyncLogs)
  };
}

export function toRequestHrSyncStatus(hrSyncLogs?: HrSyncLog[] | null) {
  const latestLog = [...(hrSyncLogs ?? [])].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  )[0];

  if (!latestLog) {
    return null;
  }

  return {
    status: latestLog.status,
    workflowType: latestLog.workflowType,
    targetSheet: latestLog.targetSheet,
    sentAt: latestLog.sentAt,
    updatedAt: latestLog.updatedAt,
    errorMessage: latestLog.errorMessage
  };
}

function toRequestTargetUserSummary(
  user: User,
  includeOperationalFields = false
) {
  const summary = toUserSummary(user);

  if (!includeOperationalFields) {
    return summary;
  }

  return {
    ...summary,
    ibsId: user.ibsId,
    joiningDate: user.joiningDate,
    nationalId: user.nationalId,
    shopperId: user.shopperId
  };
}

export function toApprovalSummary(
  approval: RequestApproval & { approver?: User | null }
) {
  return {
    id: approval.id,
    requestId: approval.requestId,
    step: approval.step,
    approverRole: approval.approverRole,
    approverId: approval.approverId,
    approver: approval.approver ? toUserSummary(approval.approver) : null,
    status: approval.status,
    decisionAt: approval.decisionAt,
    notes: approval.notes,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt
  };
}

export function toTimeline(
  request: RequestWithRelations,
  auditLogs: AuditLog[]
) {
  const base = [
    {
      id: `${request.id}:created`,
      type: "REQUEST_CREATED",
      label: "Request created",
      at: request.createdAt,
      actorUserId: request.createdById
    },
    ...request.approvals.map((approval) => ({
      id: approval.id,
      type: `APPROVAL_${approval.status}`,
      label: `${approval.step} ${approval.status.toLowerCase()}`,
      at: approval.decisionAt ?? approval.createdAt,
      actorUserId: approval.approverId
    })),
    ...auditLogs.map((log) => ({
      id: log.id,
      type: log.action,
      label: log.action.replaceAll("_", " ").toLowerCase(),
      at: log.createdAt,
      actorUserId: log.actorUserId
    }))
  ];

  return [...base].sort((left, right) => left.at.getTime() - right.at.getTime());
}
