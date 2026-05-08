import type { SafeUser, UserRole } from "@/lib/auth/types";
import { apiRequest } from "./request";
import type { PageMeta } from "./organization";

export type UserLookupStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface PaginatedUsers {
  items: SafeUser[];
  meta: PageMeta;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  role?: UserRole;
  status?: UserLookupStatus;
  q?: string;
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

export const usersApi = {
  list(params: ListUsersParams = {}) {
    return apiRequest<PaginatedUsers>(
      `/users${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        role: params.role,
        status: params.status,
        q: params.q
      })}`
    );
  }
};
