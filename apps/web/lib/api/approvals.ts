import { apiGet, apiRequest, clearApiCache } from "./request";
import type { RequestApprovalSummary, RequestSummary } from "./requests";

export interface PendingApproval extends RequestApprovalSummary {
  request: RequestSummary;
}

export const approvalsApi = {
  pending() {
    return apiGet<{ items: PendingApproval[] }>("/approvals/pending");
  },
  async approve(approvalId: string, notes?: string) {
    const request = await apiRequest<RequestSummary>(
      `/approvals/${approvalId}/approve`,
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
