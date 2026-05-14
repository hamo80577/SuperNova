import { apiGet, apiRequest, clearApiCache } from "./request";
import type {
  OffboardingBlockDecision,
  RequestApprovalSummary,
  RequestSummary
} from "./requests";

export interface PendingApproval extends RequestApprovalSummary {
  request: RequestSummary;
}

export type ApprovalDecisionInput =
  | string
  | {
      notes?: string;
      blockDecision?: OffboardingBlockDecision;
      blockReason?: string;
    };

export const approvalsApi = {
  pending() {
    return apiGet<{ items: PendingApproval[] }>("/approvals/pending");
  },
  async approve(approvalId: string, input?: ApprovalDecisionInput) {
    const body =
      typeof input === "string" || input === undefined ? { notes: input } : input;
    const request = await apiRequest<RequestSummary>(
      `/approvals/${approvalId}/approve`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );
    clearApiCache("/approvals");
    clearApiCache("/requests");
    clearApiCache("/workspaces");
    clearApiCache("/notifications");
    return request;
  },
  async reject(approvalId: string, notes?: string) {
    const request = await apiRequest<RequestSummary>(
      `/approvals/${approvalId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ notes })
      }
    );
    clearApiCache("/approvals");
    clearApiCache("/requests");
    clearApiCache("/workspaces");
    clearApiCache("/notifications");
    return request;
  }
};
