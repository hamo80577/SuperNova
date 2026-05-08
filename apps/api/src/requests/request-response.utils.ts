import type {
  AuditLog,
  Chain,
  Request,
  RequestApproval,
  User,
  Vendor
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";

type RequestWithRelations = Request & {
  createdBy: User;
  targetUser: User | null;
  sourceChain: Chain | null;
  destinationChain: Chain | null;
  sourceVendor: (Vendor & { chain?: Chain }) | null;
  destinationVendor: (Vendor & { chain?: Chain }) | null;
  approvals: Array<RequestApproval & { approver: User | null }>;
};

export function toRequestSummary(request: RequestWithRelations) {
  return {
    id: request.id,
    type: request.type,
    status: request.status,
    currentStep: request.currentStep,
    payload: request.payload,
    completedAt: request.completedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    createdBy: toUserSummary(request.createdBy),
    targetUser: request.targetUser ? toUserSummary(request.targetUser) : null,
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
