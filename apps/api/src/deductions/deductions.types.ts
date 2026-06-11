import type {
  DeductionCaseStatus,
  DeductionPenaltyType,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../auth/types/authenticated-user";

export type DeductionRequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type DeductionTargetRole =
  | Extract<UserRole, "PICKER">
  | Extract<UserRole, "CHAMP">;

export type DeductionTargetContext = {
  targetUser: {
    id: string;
    nameEn: string;
    nameAr: string | null;
    role: UserRole;
    shopperId: string | null;
    ibsId: string | null;
    phoneNumber: string;
  };
  targetRole: DeductionTargetRole;
  assignmentId: string;
  assignmentType: "PickerBranchAssignment" | "VendorChampAssignment";
  sourceVendorId: string;
  sourceVendorName: string;
  sourceChainId: string;
  sourceChainName: string;
};

export type DeductionRuleMatch = {
  ruleStepId: string;
  occurrenceNumber: number;
  appliesFromOccurrence: number | null;
  penaltyType: DeductionPenaltyType;
  deductionDays: number | null;
  label: string;
};

export type DeductionPreviewResult = {
  target: DeductionTargetContext;
  action: {
    id: string;
    code: string;
    name: string;
  };
  policyVersion: {
    id: string;
    versionNumber: number;
  };
  incidentDate: string;
  incidentMonth: string;
  occurrenceNumber: number;
  penalty: DeductionRuleMatch;
  approvalPath: Array<{
    step: "AREA_MANAGER_APPROVAL" | "ADMIN_FINAL_APPROVAL";
    skipped: boolean;
  }>;
};

export type DeductionRequestPayload = {
  deduction: {
    type: "DEDUCTION";
    actionId: string;
    actionCode: string;
    actionName: string;
    policyVersionId: string;
    policyVersionNumber: number;
    incidentDate: string;
    incidentMonth: string;
    occurrenceNumber: number;
    penaltyType: DeductionPenaltyType;
    deductionDays: number | null;
    penaltyLabel: string;
    reason?: string;
    notes?: string;
  };
  source: {
    vendorId: string;
    vendorName: string;
    chainId: string;
    chainName: string;
  };
  target: {
    userId: string;
    targetRole: DeductionTargetRole;
    name: string;
    shopperId: string | null;
    ibsId: string | null;
  };
  finalization?: {
    completedAt: string;
    finalizedById: string;
  };
};

export type DeductionCaseSummary = {
  id: string;
  requestId: string;
  status: DeductionCaseStatus;
  incidentDate: string;
  incidentMonth: string;
  occurrenceNumber: number;
  penaltyType: DeductionPenaltyType;
  deductionDays: number | null;
  penaltyLabel: string;
  actionId: string | null;
  actionName: string;
  policyVersionNumber: number | null;
  reason: string | null;
  notes: string | null;
  target: {
    id: string;
    nameEn: string;
    role: UserRole;
    shopperId: string | null;
    ibsId: string | null;
  };
  createdBy: {
    id: string;
    nameEn: string;
    role: UserRole;
  };
  source: {
    vendorId: string | null;
    vendorName: string | null;
    chainId: string | null;
    chainName: string | null;
  };
  finalApprovedById: string | null;
  finalApprovedAt: string | null;
  createdAt: string;
};

export function toIncidentMonth(incidentDate: Date) {
  const year = incidentDate.getUTCFullYear();
  const month = String(incidentDate.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
