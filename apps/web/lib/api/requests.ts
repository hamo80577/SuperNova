import type { ChainSummary, UserSummary, VendorSummary } from "@/lib/api/workspaces";
import { apiGet, apiRequest, clearApiCache } from "./request";
import type { PageMeta } from "./organization";

export type RequestType = "NEW_HIRE" | "RESIGNATION" | "TERMINATION" | "TRANSFER";
export type RequestStatus =
  | "DRAFT"
  | "PENDING_AREA_MANAGER"
  | "PENDING_DESTINATION_AREA_MANAGER"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
export type ApprovalStep =
  | "AREA_MANAGER_APPROVAL"
  | "SOURCE_AREA_MANAGER_APPROVAL"
  | "DESTINATION_AREA_MANAGER_APPROVAL"
  | "ADMIN_FINAL_APPROVAL";

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
  targetUser: UserSummary | null;
  sourceChain: ChainSummary | null;
  sourceVendor: VendorSummary | null;
  destinationChain: ChainSummary | null;
  destinationVendor: VendorSummary | null;
  approvals: RequestApprovalSummary[];
}

export interface RequestTimelineItem {
  id: string;
  type: string;
  label: string;
  at: string;
  actorUserId: string | null;
}

export interface RequestDetail extends RequestSummary {
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
    return cancelled;
  }
};
