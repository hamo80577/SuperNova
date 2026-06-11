import { type UserRole } from "@/lib/auth/types";
import { apiGet, apiRequest, clearApiCache } from "./request";
import { type RequestSummary } from "./requests";

export type DeductionTargetRole = "PICKER" | "CHAMP";

export function getAllowedDeductionTargetRoles(
  role: UserRole | undefined
): DeductionTargetRole[] {
  if (role === "CHAMP") return ["PICKER"];
  if (role === "AREA_MANAGER") return ["PICKER", "CHAMP"];
  return [];
}

export function isDeductionTargetRole(
  role: UserRole
): role is DeductionTargetRole {
  return role === "PICKER" || role === "CHAMP";
}

export type DeductionPenaltyType =
  | "WARNING"
  | "DEDUCTION_DAYS"
  | "LIFECYCLE_REVIEW_REQUIRED";

export type DeductionCaseStatus =
  | "PENDING_APPROVAL"
  | "EFFECTIVE"
  | "REJECTED"
  | "CANCELLED";

export const deductionPenaltyTypeLabels: Record<DeductionPenaltyType, string> =
  {
    WARNING: "Warning",
    DEDUCTION_DAYS: "Deduction days",
    LIFECYCLE_REVIEW_REQUIRED: "Lifecycle review required"
  };

export const deductionCaseStatusLabels: Record<DeductionCaseStatus, string> = {
  PENDING_APPROVAL: "Pending approval",
  EFFECTIVE: "Effective",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled"
};

export type DeductionActionStatus = "ACTIVE" | "INACTIVE";

export interface DeductionPolicyRuleStep {
  id: string;
  occurrenceNumber: number;
  appliesFromOccurrence: number | null;
  penaltyType: DeductionPenaltyType;
  /**
   * Prisma Decimal serialized as a string; always wrap with Number() before
   * display.
   */
  deductionDays: string | number | null;
  label: string;
}

export interface DeductionPolicyAction {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: DeductionActionStatus;
  ruleSteps: DeductionPolicyRuleStep[];
}

export interface DeductionRuleStepInput {
  occurrenceNumber: number;
  /**
   * Marks the rule open-ended ("Nth+"); when provided it must equal
   * occurrenceNumber.
   */
  appliesFromOccurrence?: number;
  penaltyType: DeductionPenaltyType;
  /** Required and > 0 when penaltyType is DEDUCTION_DAYS. */
  deductionDays?: number;
  label: string;
}

export interface CreateDeductionPolicyActionPayload {
  code: string;
  name: string;
  description?: string;
  ruleSteps: DeductionRuleStepInput[];
}

export interface UpdateDeductionPolicyActionPayload {
  name?: string;
  description?: string;
  status?: DeductionActionStatus;
  /** Full replacement of the action's rule steps. */
  ruleSteps?: DeductionRuleStepInput[];
}

export interface ActiveDeductionPolicy {
  id: string;
  versionNumber: number;
  status: "ACTIVE";
  effectiveFrom: string | null;
  actions: DeductionPolicyAction[];
}

export interface DeductionTargetSearchItem {
  userId: string;
  name: string;
  role: DeductionTargetRole;
  shopperId: string | null;
  ibsId: string | null;
  vendorId: string;
  vendorName: string;
  chainId: string;
  chainName: string;
}

export interface DeductionTargetsSearchParams {
  q?: string;
  role?: DeductionTargetRole;
}

export interface DeductionPreviewPayload {
  targetUserId: string;
  targetRole?: DeductionTargetRole;
  actionId: string;
  incidentDate: string;
  sourceVendorId?: string;
}

export interface CreateDeductionRequestPayload extends DeductionPreviewPayload {
  reason?: string;
  notes?: string;
}

export type DeductionApprovalPathStep = {
  step: "AREA_MANAGER_APPROVAL" | "ADMIN_FINAL_APPROVAL";
  skipped: boolean;
};

export interface DeductionPreviewResponse {
  target: {
    targetUser: {
      id: string;
      nameEn: string;
      nameAr: string | null;
      role: string;
      shopperId: string | null;
      ibsId: string | null;
      phoneNumber: string;
    };
    targetRole: DeductionTargetRole;
    assignmentId: string;
    assignmentType: string;
    sourceVendorId: string;
    sourceVendorName: string;
    sourceChainId: string;
    sourceChainName: string;
  };
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
  penalty: {
    ruleStepId: string;
    occurrenceNumber: number;
    appliesFromOccurrence: number | null;
    penaltyType: DeductionPenaltyType;
    deductionDays: number | null;
    label: string;
  };
  approvalPath: DeductionApprovalPathStep[];
}

export interface DeductionCaseSummary {
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
    role: string;
    shopperId: string | null;
    ibsId: string | null;
  };
  createdBy: {
    id: string;
    nameEn: string;
    role: string;
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
}

export interface DeductionListSummary {
  effectiveCount: number;
  warningCount: number;
  deductionDaysTotal: number;
  pendingCount: number;
}

export interface DeductionListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DeductionListResponse {
  items: DeductionCaseSummary[];
  summary: DeductionListSummary;
  meta: DeductionListMeta;
}

export interface ListDeductionsQuery {
  month?: string;
  targetUserId?: string;
  actionId?: string;
  status?: DeductionCaseStatus | "";
  q?: string;
  page?: number;
  pageSize?: number;
}

export function buildActiveDeductionPolicyPath(includeInactive = false) {
  return includeInactive
    ? "/deductions/policy/active?includeInactive=true"
    : "/deductions/policy/active";
}

export function buildDeductionPolicyActionsPath() {
  return "/deductions/policy/actions";
}

export function buildDeductionPolicyActionPath(id: string) {
  return `/deductions/policy/actions/${encodeURIComponent(id)}`;
}

export function buildDeductionTargetsSearchPath(
  params: DeductionTargetsSearchParams = {}
) {
  const query = new URLSearchParams();

  appendQueryParam(query, "q", params.q);
  appendQueryParam(query, "role", params.role);

  const search = query.toString();
  return `/deductions/targets/search${search ? `?${search}` : ""}`;
}

export function buildDeductionPreviewPath() {
  return "/deductions/preview";
}

export function buildDeductionRequestsPath() {
  return "/deductions/requests";
}

export function buildDeductionsListPath(query: ListDeductionsQuery = {}) {
  const params = new URLSearchParams();

  appendQueryParam(params, "month", query.month);
  appendQueryParam(params, "targetUserId", query.targetUserId);
  appendQueryParam(params, "actionId", query.actionId);
  appendQueryParam(params, "status", query.status);
  appendQueryParam(params, "q", query.q);
  appendQueryParam(params, "page", query.page);
  appendQueryParam(params, "pageSize", query.pageSize);

  const search = params.toString();
  return `/deductions${search ? `?${search}` : ""}`;
}

export function buildDeductionCasePath(id: string) {
  return `/deductions/${encodeURIComponent(id)}`;
}

export function clearDeductionsCache() {
  clearApiCache("/deductions");
}

export const deductionsApi = {
  activePolicy(options: { includeInactive?: boolean } = {}) {
    return apiGet<ActiveDeductionPolicy>(
      buildActiveDeductionPolicyPath(options.includeInactive ?? false)
    );
  },
  async createPolicyAction(payload: CreateDeductionPolicyActionPayload) {
    const created = await apiRequest<DeductionPolicyAction>(
      buildDeductionPolicyActionsPath(),
      {
        body: JSON.stringify(payload),
        method: "POST"
      }
    );
    clearApiCache("/deductions/policy");
    return created;
  },
  async updatePolicyAction(
    id: string,
    payload: UpdateDeductionPolicyActionPayload
  ) {
    const updated = await apiRequest<DeductionPolicyAction>(
      buildDeductionPolicyActionPath(id),
      {
        body: JSON.stringify(payload),
        method: "PATCH"
      }
    );
    clearApiCache("/deductions/policy");
    return updated;
  },
  searchTargets(params: DeductionTargetsSearchParams = {}) {
    return apiGet<DeductionTargetSearchItem[]>(
      buildDeductionTargetsSearchPath(params)
    );
  },
  preview(payload: DeductionPreviewPayload) {
    return apiRequest<DeductionPreviewResponse>(buildDeductionPreviewPath(), {
      body: JSON.stringify(payload),
      method: "POST"
    });
  },
  async createDeductionRequest(payload: CreateDeductionRequestPayload) {
    const created = await apiRequest<RequestSummary>(
      buildDeductionRequestsPath(),
      {
        body: JSON.stringify(payload),
        method: "POST"
      }
    );
    clearDeductionsCache();
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    clearApiCache("/notifications");
    return created;
  },
  list(query: ListDeductionsQuery = {}) {
    return apiGet<DeductionListResponse>(buildDeductionsListPath(query));
  },
  getById(id: string) {
    return apiGet<DeductionCaseSummary>(buildDeductionCasePath(id));
  }
};

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: number | string | null | undefined
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}
