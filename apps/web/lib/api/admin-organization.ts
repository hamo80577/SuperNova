import type { Chain, ChainStatus, Vendor, VendorStatus } from "./organization";
import { apiGet, apiRequest, clearApiCache } from "./request";
import type { RequestSummary } from "./requests";
import type { UserSummary } from "./workspaces";

export interface OrganizationBranchSummary
  extends Pick<
    Vendor,
    | "id"
    | "vendorName"
    | "vendorCode"
    | "vendorExternalId"
    | "status"
    | "chainId"
    | "address"
    | "area"
    | "city"
    | "createdAt"
    | "updatedAt"
  > {
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
  activePickerCount: number;
  requestCount: number;
  currentChamp: UserSummary | null;
}

export interface OrganizationChainSummary
  extends Pick<
    Chain,
    "id" | "chainName" | "chainCode" | "status" | "createdAt" | "updatedAt"
  > {
  branchCount: number;
  activePickerCount: number;
  requestCount: number;
  currentAreaManager: UserSummary | null;
  branches: OrganizationBranchSummary[];
}

export interface AdminOrganizationResponse {
  chains: OrganizationChainSummary[];
}

export interface BranchPersonRow {
  assignment: {
    id: string;
    status: "ACTIVE" | "CLOSED";
    startDate: string;
    endDate: string | null;
  };
  picker?: UserSummary;
  champ?: UserSummary;
}

export interface AdminOrganizationBranchDetail {
  branch: OrganizationBranchSummary;
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
  currentChamp: BranchPersonRow | null;
  pickers: Array<Required<Pick<BranchPersonRow, "assignment" | "picker">>>;
  requests: Array<
    Pick<
      RequestSummary,
      "id" | "type" | "status" | "currentStep" | "createdAt" | "updatedAt"
    > & {
      targetUser: UserSummary | null;
      route: string;
    }
  >;
}

export interface AdminAssignPickerResult {
  mode: "NO_CHANGE" | "ASSIGNMENT_CREATED" | "TRANSFER_REQUEST_CREATED";
  message?: string;
  assignment?: unknown;
  request?: RequestSummary;
}

export interface AdminReplaceAssignmentResult {
  mode: "NO_CHANGE" | "CHAMP_REPLACED" | "AREA_MANAGER_REPLACED";
  message?: string;
  assignment?: unknown;
}

export const adminOrganizationApi = {
  get() {
    return apiGet<AdminOrganizationResponse>("/admin/organization");
  },
  getBranch(vendorId: string) {
    return apiGet<AdminOrganizationBranchDetail>(
      `/admin/organization/branches/${vendorId}`
    );
  },
  async assignPicker(vendorId: string, payload: { pickerId: string; startDate?: string }) {
    const response = await apiRequest<AdminAssignPickerResult>(
      `/admin/organization/branches/${vendorId}/assign-picker`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    clearApiCache("/admin/organization");
    clearApiCache("/workspaces");
    return response;
  },
  async replaceChamp(
    vendorId: string,
    payload: { champId: string; startDate?: string }
  ) {
    const response = await apiRequest<AdminReplaceAssignmentResult>(
      `/admin/organization/branches/${vendorId}/replace-champ`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    clearApiCache("/admin/organization");
    clearApiCache("/workspaces");
    return response;
  },
  async replaceAreaManager(
    chainId: string,
    payload: { areaManagerId: string; startDate?: string }
  ) {
    const response = await apiRequest<AdminReplaceAssignmentResult>(
      `/admin/organization/chains/${chainId}/replace-area-manager`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    clearApiCache("/admin/organization");
    clearApiCache("/workspaces");
    return response;
  }
};

export type OrganizationStatus = ChainStatus | VendorStatus;
