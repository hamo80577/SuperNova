import type { ChainSummary, UserSummary, VendorSummary } from "@/lib/api/workspaces";
import { apiGet, apiRequest, clearApiCache } from "./request";
import type { PageMeta } from "./organization";

export type RequestType =
  | "NEW_HIRE"
  | "RESIGNATION"
  | "TRANSFER"
  | "DEDUCTION"
  | "ANNUAL_LEAVE";
export type RequestStatus =
  | "DRAFT"
  | "PENDING_CHAMP"
  | "PENDING_AREA_MANAGER"
  | "PENDING_DESTINATION_AREA_MANAGER"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
export type ApprovalStep =
  | "CHAMP_APPROVAL"
  | "AREA_MANAGER_APPROVAL"
  | "SOURCE_AREA_MANAGER_APPROVAL"
  | "DESTINATION_AREA_MANAGER_APPROVAL"
  | "ADMIN_FINAL_APPROVAL";
export type HrSyncStatus = "NOT_SENT" | "SENT" | "FAILED" | "SKIPPED";
export type HrSyncWorkflowType =
  | "PICKER_NEW_HIRE"
  | "PICKER_REHIRE"
  | "PICKER_RESIGNATION";
export type HrSyncTargetSheet = "NEW_HIRE" | "RESIGN";
export type NewHireTargetRole = "PICKER" | "CHAMP" | "AREA_MANAGER";
export type ResignationTargetRole = "PICKER" | "CHAMP" | "AREA_MANAGER";
export type OffboardingReasonCode =
  | "BAD_ATTITUDE"
  | "BAD_PERFORMANCE"
  | "ATTENDANCE_ISSUES"
  | "POLICY_VIOLATION"
  | "NO_SHOW"
  | "VOLUNTARY_QUIT"
  | "OTHER";
export type OffboardingBlockDecision =
  | "NO_BLOCK"
  | "PERMANENT";

export const offboardingReasonLabels: Record<OffboardingReasonCode, string> = {
  BAD_ATTITUDE: "Bad attitude",
  BAD_PERFORMANCE: "Bad performance",
  ATTENDANCE_ISSUES: "Attendance issues",
  POLICY_VIOLATION: "Policy violation",
  NO_SHOW: "No show",
  VOLUNTARY_QUIT: "Voluntary quit",
  OTHER: "Other"
};

export const offboardingBlockDecisionLabels: Record<
  OffboardingBlockDecision,
  string
> = {
  NO_BLOCK: "No block",
  PERMANENT: "Permanent block"
};

export interface RequestApprovalSummary {
  id: string;
  requestId: string;
  step: ApprovalStep;
  approverRole: string;
  approverId: string | null;
  approver: UserSummary | null;
  status: ApprovalStatus;
  decisionAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualLeaveRequestSummary {
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  contextVendorId: string | null;
  contextChainId: string | null;
  balanceCarriedSnapshot: number | null;
  balanceAccruedSnapshot: number | null;
  balanceTakenSnapshot: number | null;
  balanceHeldSnapshot: number | null;
  availableBeforeRequestSnapshot: number | null;
  availableAfterRequestSnapshot: number | null;
}

export interface RequestSummary {
  id: string;
  type: RequestType;
  status: RequestStatus;
  currentStep: ApprovalStep | null;
  payload: unknown;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
  targetUser: RequestTargetUserSummary | null;
  sourceChain: ChainSummary | null;
  sourceVendor: VendorSummary | null;
  destinationChain: ChainSummary | null;
  destinationVendor: VendorSummary | null;
  approvals: RequestApprovalSummary[];
  annualLeave: AnnualLeaveRequestSummary | null;
}

export interface PendingLifecycleRequestSummary {
  id: string;
  type: Extract<RequestType, "RESIGNATION" | "TRANSFER">;
  status: RequestStatus;
  currentStep: ApprovalStep | null;
  createdAt: string;
}

export interface RequestTargetUserSummary extends UserSummary {
  ibsId?: string | null;
  joiningDate?: string | null;
  nationalId?: string | null;
  shopperId?: string | null;
}

export interface RequestTimelineItem {
  id: string;
  type: string;
  label: string;
  at: string;
  actorUserId: string | null;
}

export interface RequestHrSyncStatus {
  status: HrSyncStatus;
  workflowType: HrSyncWorkflowType;
  targetSheet: HrSyncTargetSheet;
  sentAt: string | null;
  updatedAt: string;
  errorMessage: string | null;
}

export interface RequestDetail extends RequestSummary {
  hrSync?: RequestHrSyncStatus | null;
  timeline: RequestTimelineItem[];
}

export interface PaginatedRequests {
  items: RequestSummary[];
  meta: PageMeta;
}

export interface ListRequestsParams {
  page?: number;
  pageSize?: number;
  status?: RequestStatus | "";
  type?: RequestType | "";
  q?: string;
}

export interface CreateRequestPayload {
  type: RequestType;
  sourceChainId?: string;
  sourceVendorId?: string;
  destinationChainId?: string;
  destinationVendorId?: string;
  targetUserId?: string;
  payload?: Record<string, unknown>;
}

export interface CreateNewHirePayload {
  targetRole?: NewHireTargetRole;
  sourceVendorId?: string;
  sourceChainId?: string;
  chainIds?: string[];
  rehireUserId?: string;
  firstNameEn?: string;
  secondNameEn?: string;
  thirdNameEn?: string;
  nameEn?: string;
  nameAr?: string;
  phoneNumber: string;
  nationalId: string;
  address?: string;
  dateOfBirth?: string;
  actualJoiningDate?: string;
  gender?: "MALE" | "FEMALE" | "UNSPECIFIED";
  notes?: string;
  shopperId?: string;
}

export interface NewHireLookupCandidate {
  decision:
    | "ACTIVE_DUPLICATE"
    | "BLOCKED"
    | "REHIRE_AVAILABLE"
    | "TEMPORARY_BLOCKED"
    | "PERMANENT_BLOCKED";
  matchedBy: Array<"phoneNumber" | "nationalId">;
  reason?: string;
  blockedUntil?: string | null;
  remainingDays?: number | null;
  user: UserSummary;
  role: string;
  blockStatus: string;
  accountStatus: string;
  employmentStatus: string;
  maskedNationalId: string | null;
  blockReason?: string | null;
  lastBranch?: VendorSummary | null;
  lastChain?: ChainSummary | null;
  dateOfBirth?: string | null;
  gender: "MALE" | "FEMALE" | "UNSPECIFIED";
}

export interface NewHireLookupResponse {
  status:
    | "CLEAR"
    | "ACTIVE_DUPLICATE"
    | "BLOCKED"
    | "REHIRE_AVAILABLE"
    | "TEMPORARY_BLOCKED"
    | "PERMANENT_BLOCKED";
  candidates: NewHireLookupCandidate[];
}

export interface CreateOffboardingPayload {
  type: "RESIGNATION";
  targetRole?: ResignationTargetRole;
  sourceVendorId?: string;
  sourceChainId?: string;
  targetUserId: string;
  resignationDate: string;
  lastWorkingDate?: string;
  reasonCode: OffboardingReasonCode;
  reasonDetails?: string;
  notes?: string;
  blockDecision?: OffboardingBlockDecision;
  blockReason?: string;
}

export interface OffboardingPickerSearchItem {
  assignmentId: string;
  assignmentType?: "PickerBranchAssignment";
  targetUserId?: string;
  targetRole?: "PICKER";
  pickerId: string;
  vendorId: string;
  chainId: string;
  assignmentStartDate: string;
  pendingResignationRequestId: string | null;
  hasPendingResignation: boolean;
  picker: UserSummary & {
    shopperId: string | null;
    ibsId: string | null;
    joiningDate: string | null;
    blockStatus: string;
  };
  vendor: VendorSummary;
  chain: ChainSummary;
}

export interface OffboardingPickerSearchResponse {
  items: OffboardingPickerSearchItem[];
}

export interface OffboardingEligibleUserSearchItem {
  assignmentId: string;
  assignmentType:
    | "PickerBranchAssignment"
    | "VendorChampAssignment"
    | "ChainAreaManagerAssignment";
  targetUserId: string;
  targetRole: ResignationTargetRole;
  userId: string;
  vendorId?: string;
  chainId: string;
  assignmentStartDate: string;
  pendingResignationRequestId: string | null;
  hasPendingResignation: boolean;
  role: ResignationTargetRole;
  user: UserSummary & {
    shopperId?: string | null;
    ibsId?: string | null;
    joiningDate?: string | null;
    blockStatus?: string;
  };
  vendor: VendorSummary | null;
  chain: ChainSummary;
}

export interface OffboardingEligibleUserSearchResponse {
  items: OffboardingEligibleUserSearchItem[];
}

export interface CreateTransferPayload {
  sourceVendorId: string;
  targetUserId: string;
  destinationVendorId: string;
  reason: string;
  requestedTransferDate?: string;
  notes?: string;
}

export interface FinalizedNewHireAssignment {
  id: string;
  assignmentType:
    | "PickerBranchAssignment"
    | "VendorChampAssignment";
  status: string;
  startDate: string;
  vendorId?: string;
  chainId?: string;
  userId: string | null;
  pickerId?: string;
  champId?: string;
  areaManagerId?: string;
  createdByRequestId?: string | null;
}

export interface FinalizeNewHireResponse {
  request: RequestSummary;
  user: {
    id: string;
    role: NewHireTargetRole;
    nameEn: string;
    nameAr: string | null;
    phoneNumber: string;
    shopperId: string | null;
    accountStatus: string;
    employmentStatus: string;
    profileStatus: string;
    mustChangePassword: boolean;
  };
  picker: {
    id: string;
    role: NewHireTargetRole;
    nameEn: string;
    nameAr: string | null;
    phoneNumber: string;
    shopperId: string | null;
    accountStatus: string;
    employmentStatus: string;
    profileStatus: string;
    mustChangePassword: boolean;
  };
  assignment: FinalizedNewHireAssignment | null;
  assignments?: FinalizedNewHireAssignment[];
}

export interface FinalizeOffboardingPayload {
  confirmInternalDeactivation: boolean;
  notes?: string;
}

export interface FinalizedResignationAssignment {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  vendorId?: string;
  chainId?: string;
  pickerId?: string;
  champId?: string;
  areaManagerId?: string;
  createdByRequestId?: string | null;
}

export interface FinalizeOffboardingResponse {
  request: RequestSummary;
  user: {
    id: string;
    role: ResignationTargetRole;
    nameEn: string;
    nameAr: string | null;
    phoneNumber: string;
    shopperId: string | null;
    accountStatus: string;
    employmentStatus: string;
    profileStatus: string;
    blockStatus: string;
    blockedUntil: string | null;
    blockReason: string | null;
  };
  picker?: FinalizeOffboardingResponse["user"];
  assignment: FinalizedResignationAssignment | null;
  assignments?: FinalizedResignationAssignment[];
}

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export interface CreateAnnualLeavePayload {
  startDate: string;
  endDate: string;
  reason: string;
  contextVendorId?: string;
}

export type AnnualLeaveEligibilityStatus =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NOT_APPLICABLE"
  | "MISSING_JOINING_DATE";

export interface AnnualLeaveAvailability {
  officialRemainingDays: number;
  heldDays: number;
  availableToRequestDays: number;
  eligibilityStatus: AnnualLeaveEligibilityStatus;
  eligibleFrom: string | null;
  message: string;
}

export interface AnnualLeavePreview {
  requestedDays: number;
  officialRemainingDays: number;
  heldDays: number;
  availableToRequestDays: number;
  availableAfterRequestDays: number;
  eligibilityStatus: AnnualLeaveEligibilityStatus;
  eligibleFrom: string | null;
  blockingReasons: string[];
}

export const requestsApi = {
  list(params: ListRequestsParams = {}) {
    return apiGet<PaginatedRequests>(
      `/requests${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        type: params.type,
        q: params.q
      })}`
    );
  },
  mySubmitted(params: ListRequestsParams = {}) {
    return apiGet<PaginatedRequests>(
      `/requests/my/submitted${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        type: params.type,
        q: params.q
      })}`
    );
  },
  get(id: string) {
    return apiGet<RequestDetail>(`/requests/${id}`);
  },
  async create(payload: CreateRequestPayload) {
    const created = await apiRequest<RequestSummary>("/requests", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    clearApiCache("/requests");
    clearApiCache("/workspaces");
    return created;
  },
  async createNewHire(payload: CreateNewHirePayload) {
    const created = await apiRequest<RequestSummary>("/requests/new-hire", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    return created;
  },
  lookupNewHireCandidate(payload: {
    targetRole?: NewHireTargetRole;
    sourceVendorId?: string;
    sourceChainId?: string;
    chainIds?: string[];
    phoneNumber?: string;
    nationalId?: string;
  }) {
    return apiRequest<NewHireLookupResponse>(
      "/requests/new-hire/lookup-candidate",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  },
  searchOffboardingPickers(params: { q?: string; sourceVendorId?: string } = {}) {
    return apiGet<OffboardingPickerSearchResponse>(
      `/requests/offboarding/pickers${toQuery({
        q: params.q,
        sourceVendorId: params.sourceVendorId
      })}`
    );
  },
  searchOffboardingEligibleUsers(
    params: {
      q?: string;
      targetRole?: ResignationTargetRole;
      sourceVendorId?: string;
      sourceChainId?: string;
    } = {}
  ) {
    return apiGet<OffboardingEligibleUserSearchResponse>(
      `/requests/offboarding/eligible-users${toQuery({
        q: params.q,
        targetRole: params.targetRole,
        sourceVendorId: params.sourceVendorId,
        sourceChainId: params.sourceChainId
      })}`
    );
  },
  async createOffboarding(payload: CreateOffboardingPayload) {
    const created = await apiRequest<RequestSummary>("/requests/offboarding", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    return created;
  },
  async createTransfer(payload: CreateTransferPayload) {
    const created = await apiRequest<RequestSummary>("/requests/transfer", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    return created;
  },
  previewAnnualLeave(payload: CreateAnnualLeavePayload) {
    return apiRequest<AnnualLeavePreview>("/requests/annual-leave/preview", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getAnnualLeaveAvailability() {
    return apiGet<AnnualLeaveAvailability>("/requests/annual-leave/availability");
  },
  async createAnnualLeave(payload: CreateAnnualLeavePayload) {
    const created = await apiRequest<RequestSummary>("/requests/annual-leave", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    return created;
  },
  async finalizeNewHire(id: string) {
    const finalized = await apiRequest<FinalizeNewHireResponse>(
      `/requests/${id}/finalize-new-hire`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    clearApiCache("/notifications");
    return finalized;
  },
  async finalizeOffboarding(id: string, payload: FinalizeOffboardingPayload) {
    const finalized = await apiRequest<FinalizeOffboardingResponse>(
      `/requests/${id}/finalize-offboarding`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    clearApiCache("/notifications");
    return finalized;
  },
  async submit(id: string) {
    const submitted = await apiRequest<RequestSummary>(`/requests/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({})
    });
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    return submitted;
  },
  async cancel(id: string, notes?: string) {
    const cancelled = await apiRequest<RequestSummary>(`/requests/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ notes })
    });
    clearApiCache("/requests");
    clearApiCache("/approvals");
    clearApiCache("/workspaces");
    clearApiCache("/deductions");
    return cancelled;
  }
};
