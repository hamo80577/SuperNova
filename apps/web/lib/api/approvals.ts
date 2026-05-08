import { apiRequest } from "./request";
import type { RequestApprovalSummary, RequestSummary } from "./requests";

export interface PendingApproval extends RequestApprovalSummary {
  request: RequestSummary;
}

export const approvalsApi = {
  pending() {
    return apiRequest<{ items: PendingApproval[] }>("/approvals/pending");
  },
  approve(approvalId: string, notes?: string) {
    return apiRequest<RequestSummary>(`/approvals/${approvalId}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes })
    });
  },
  reject(approvalId: string, notes?: string) {
    return apiRequest<RequestSummary>(`/approvals/${approvalId}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes })
    });
  }
};
