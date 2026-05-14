import type { SafeUser } from "@/lib/auth/types";
import { apiRequest } from "./request";
import type { Chain, PageMeta, Vendor } from "./organization";

export type AssignmentStatus = "ACTIVE" | "CLOSED";

export type UserSummary = Pick<
    SafeUser,
    | "id"
    | "role"
    | "nameEn"
    | "nameAr"
    | "phoneNumber"
    | "accountStatus"
    | "employmentStatus"
    | "profileStatus"
  >;

export interface AssignmentRecord {
  id: string;
  status: AssignmentStatus;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PickerBranchAssignment extends AssignmentRecord {
  pickerId: string;
  vendorId: string;
  createdByRequestId: string | null;
  picker: UserSummary;
  vendor: Vendor;
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
}

export interface VendorChampAssignment extends AssignmentRecord {
  vendorId: string;
  champId: string;
  vendor: Vendor;
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
  champ: UserSummary;
}

export interface ChainAreaManagerAssignment extends AssignmentRecord {
  chainId: string;
  areaManagerId: string;
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
  areaManager: UserSummary;
}

export interface PaginatedAssignments<T> {
  items: T[];
  meta: PageMeta;
}

export interface ListAssignmentsParams {
  page?: number;
  pageSize?: number;
  status?: AssignmentStatus | "";
  q?: string;
}

export interface PickerCurrentContext {
  picker: UserSummary;
  pickerBranchAssignment: AssignmentRecord | null;
  vendor: Vendor | null;
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status"> | null;
  vendorChampAssignment: AssignmentRecord | null;
  champ: UserSummary | null;
  chainAreaManagerAssignment: AssignmentRecord | null;
  areaManager: UserSummary | null;
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

export const assignmentsApi = {
  listPickerBranchAssignments(params: ListAssignmentsParams = {}) {
    return apiRequest<PaginatedAssignments<PickerBranchAssignment>>(
      `/assignments/pickers${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        q: params.q
      })}`
    );
  },
  listVendorChampAssignments(params: ListAssignmentsParams = {}) {
    return apiRequest<PaginatedAssignments<VendorChampAssignment>>(
      `/assignments/vendor-champs${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        q: params.q
      })}`
    );
  },
  listChainAreaManagerAssignments(params: ListAssignmentsParams = {}) {
    return apiRequest<PaginatedAssignments<ChainAreaManagerAssignment>>(
      `/assignments/chain-area-managers${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        q: params.q
      })}`
    );
  },
  createVendorChampAssignment(payload: {
    vendorId: string;
    champId: string;
    startDate?: string;
  }) {
    return apiRequest<VendorChampAssignment>("/assignments/vendor-champ", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createChainAreaManagerAssignment(payload: {
    chainId: string;
    areaManagerId: string;
    startDate?: string;
  }) {
    return apiRequest<ChainAreaManagerAssignment>(
      "/assignments/chain-area-manager",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  },
  closeVendorChampAssignment(id: string) {
    return apiRequest<VendorChampAssignment>(
      `/assignments/vendor-champ/${id}/close`,
      {
        method: "PATCH",
        body: JSON.stringify({})
      }
    );
  },
  closeChainAreaManagerAssignment(id: string) {
    return apiRequest<ChainAreaManagerAssignment>(
      `/assignments/chain-area-manager/${id}/close`,
      {
        method: "PATCH",
        body: JSON.stringify({})
      }
    );
  },
  getPickerCurrentContext(pickerId: string) {
    return apiRequest<PickerCurrentContext>(
      `/assignments/picker/${pickerId}/current`
    );
  }
};
