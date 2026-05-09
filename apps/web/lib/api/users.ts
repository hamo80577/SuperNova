import type { SafeUser, UserRole } from "@/lib/auth/types";
import { apiRequest, clearApiCache } from "./request";
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

export interface ProfileCompletionResponse {
  user: SafeUser;
  profileCompletion: {
    status: SafeUser["profileStatus"];
    requiredFields: string[];
    missingFields: string[];
    complete: boolean;
  };
  allowedFields: string[];
}

export interface UpdateProfileCompletionInput {
  nameEn?: string;
  nameAr?: string;
  nationalId?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: SafeUser["gender"];
  joiningDate?: string;
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
  },
  profileCompletion() {
    return apiRequest<ProfileCompletionResponse>("/users/me/profile-completion");
  },
  async updateProfileCompletion(input: UpdateProfileCompletionInput) {
    const response = await apiRequest<ProfileCompletionResponse>(
      "/users/me/profile-completion",
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    );
    clearApiCache("/workspaces/picker");
    return response;
  }
};
