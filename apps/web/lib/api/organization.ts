import { apiRequest } from "./request";

export type ChainStatus = "ACTIVE" | "INACTIVE";
export type VendorStatus = "ACTIVE" | "INACTIVE";

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Chain {
  id: string;
  chainName: string;
  chainCode: string;
  status: ChainStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  vendorName: string;
  vendorCode: string;
  vendorExternalId: string | null;
  status: VendorStatus;
  chainId: string;
  address: string | null;
  area: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PageMeta;
}

export interface ListChainsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: ChainStatus | "";
}

export interface ListVendorsParams extends ListChainsParams {
  status?: VendorStatus | "";
  chainId?: string;
}

export interface ChainPayload {
  chainName: string;
  chainCode: string;
  status?: ChainStatus;
}

export interface VendorPayload {
  vendorName: string;
  vendorCode: string;
  vendorExternalId?: string | null;
  chainId: string;
  status?: VendorStatus;
  address?: string | null;
  area?: string | null;
  city?: string | null;
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

export const organizationApi = {
  listChains(params: ListChainsParams = {}) {
    return apiRequest<PaginatedResponse<Chain>>(
      `/chains${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        status: params.status
      })}`
    );
  },
  getChain(id: string) {
    return apiRequest<Chain>(`/chains/${id}`);
  },
  createChain(payload: ChainPayload) {
    return apiRequest<Chain>("/chains", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateChain(id: string, payload: Partial<ChainPayload>) {
    return apiRequest<Chain>(`/chains/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listVendors(params: ListVendorsParams = {}) {
    return apiRequest<PaginatedResponse<Vendor>>(
      `/vendors${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        status: params.status,
        chainId: params.chainId
      })}`
    );
  },
  getVendor(id: string) {
    return apiRequest<Vendor>(`/vendors/${id}`);
  },
  createVendor(payload: VendorPayload) {
    return apiRequest<Vendor>("/vendors", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateVendor(id: string, payload: Partial<VendorPayload>) {
    return apiRequest<Vendor>(`/vendors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }
};
