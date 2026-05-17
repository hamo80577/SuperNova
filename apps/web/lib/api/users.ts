import type { SafeUser, UiTheme, UserRole } from "@/lib/auth/types";
import { apiRequest, clearApiCache } from "./request";
import type { PageMeta } from "./organization";
import type { AssignmentStatus, ChainSummary, VendorSummary } from "./workspaces";

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
}

export interface UpdateUserPreferencesInput {
  uiTheme: UiTheme;
}

export interface OperationalProfileAssignment {
  id: string;
  status: AssignmentStatus;
  startDate: string;
  endDate: string | null;
  vendor?: VendorSummary;
  chain: ChainSummary;
}

export interface OperationalProfileResponse {
  user: SafeUser;
  workedDays: number | null;
  permissions: {
    mode: "ADMIN" | "AREA_MANAGER" | "CHAMP" | "SELF";
    canEditProfile: boolean;
    canResetPassword: boolean;
    canRegenerateTemporaryPassword: boolean;
    canReadTemporaryPassword: boolean;
  };
  password: {
    mustChangePassword: boolean;
    temporaryPasswordAvailable: boolean;
    temporaryPasswordExpiresAt: string | null;
    temporaryPasswordCreatedAt: string | null;
  };
  currentPickerAssignment: OperationalProfileAssignment | null;
  champAssignments: OperationalProfileAssignment[];
  areaManagerAssignments: OperationalProfileAssignment[];
  recentRequests: Array<{
    id: string;
    type: string;
    status: string;
    currentStep: string | null;
    createdAt: string;
    completedAt: string | null;
    sourceVendor: VendorSummary | null;
    destinationVendor: VendorSummary | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actor: {
      id: string;
      role: UserRole;
      nameEn: string;
      nameAr: string | null;
      phoneNumber: string;
    } | null;
    createdAt: string;
  }>;
}

export interface UpdateAdminProfileInput {
  nameEn?: string;
  nameAr?: string;
  phoneNumber?: string;
  nationalId?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: SafeUser["gender"];
  joiningDate?: string;
  shopperId?: string;
  ibsId?: string;
}

export interface TemporaryPasswordResponse {
  user?: SafeUser;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string | null;
  temporaryPasswordCreatedAt: string | null;
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
  operationalProfile(id: string) {
    return apiRequest<OperationalProfileResponse>(
      `/users/${id}/operational-profile`
    );
  },
  async updateAdminProfile(id: string, input: UpdateAdminProfileInput) {
    const response = await apiRequest<{ user: SafeUser }>(
      `/users/${id}/admin-profile`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    );
    clearApiCache("/admin/organization");
    clearApiCache("/workspaces");
    return response;
  },
  revealTemporaryPassword(id: string) {
    return apiRequest<TemporaryPasswordResponse>(
      `/users/${id}/reveal-temporary-password`,
      {
        method: "POST"
      }
    );
  },
  resetTemporaryPassword(id: string) {
    return apiRequest<TemporaryPasswordResponse>(
      `/users/${id}/reset-temporary-password`,
      {
        method: "POST"
      }
    );
  },
  profileCompletion() {
    return apiRequest<ProfileCompletionResponse>("/users/me/profile-completion");
  },
  async updatePreferences(input: UpdateUserPreferencesInput) {
    const response = await apiRequest<{ user: SafeUser }>(
      "/users/me/preferences",
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    );
    clearApiCache();
    return response;
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
