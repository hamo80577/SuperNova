import type { PageMeta } from "./organization";
import { apiGet } from "./request";
import type { ChainSummary, UserSummary, VendorSummary } from "./workspaces";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
export type EmploymentStatus =
  | "NEW_HIRE_PENDING"
  | "ACTIVE"
  | "RESIGNED"
  | "TERMINATED"
  | "ARCHIVED";
export type BlockStatus = "NO_BLOCK" | "TEMPORARY_BLOCK" | "PERMANENT_BLOCK";
export type AdminUserRole =
  | "PICKER"
  | "CHAMP"
  | "AREA_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";
export type AdminRequestType =
  | "NEW_HIRE"
  | "RESIGNATION"
  | "TERMINATION"
  | "TRANSFER";
export type AdminRequestStatus =
  | "DRAFT"
  | "PENDING_AREA_MANAGER"
  | "PENDING_DESTINATION_AREA_MANAGER"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export interface AdminPendingAction {
  id: string;
  type: AdminRequestType;
  status: AdminRequestStatus;
  currentStep: string | null;
  createdAt: string;
  createdBy: UserSummary;
  targetUser: UserSummary | null;
  sourceChain: ChainSummary | null;
  sourceVendor: VendorSummary | null;
  destinationChain: ChainSummary | null;
  destinationVendor: VendorSummary | null;
  requiredActionLabel: string;
  route: string;
}

export interface AdminPendingActionsResponse {
  pendingCount: number;
  items: AdminPendingAction[];
  meta: PageMeta;
}

export interface AdminArchivedUser {
  id: string;
  role: AdminUserRole;
  nameEn: string;
  nameAr: string | null;
  phoneNumber: string;
  shopperId: string | null;
  accountStatus: AccountStatus;
  employmentStatus: EmploymentStatus;
  resignationDate: string | null;
  blockStatus: BlockStatus;
  blockedUntil: string | null;
  blockReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestOffboardingRequest: {
    id: string;
    type: "RESIGNATION" | "TERMINATION";
    status: AdminRequestStatus;
    createdAt: string;
    sourceChain: ChainSummary | null;
    sourceVendor: VendorSummary | null;
  } | null;
  closedAssignments: Array<{
    id: string;
    status: "ACTIVE" | "CLOSED";
    startDate: string;
    endDate: string | null;
    vendor: VendorSummary;
    chain: ChainSummary;
  }>;
}

export interface AdminAuditLog {
  id: string;
  actor: UserSummary | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PaginatedAdminResponse<T> {
  items: T[];
  meta: PageMeta;
}

interface ListPendingActionsParams {
  page?: number;
  pageSize?: number;
}

interface ListArchivedUsersParams extends ListPendingActionsParams {
  q?: string;
  role?: AdminUserRole | "";
  employmentStatus?: EmploymentStatus | "";
  accountStatus?: AccountStatus | "";
  blockStatus?: BlockStatus | "";
}

interface ListAuditLogsParams extends ListPendingActionsParams {
  q?: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
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

export const adminApi = {
  listPendingActions(params: ListPendingActionsParams = {}) {
    return apiGet<AdminPendingActionsResponse>(
      `/admin/pending-actions${toQuery({
        page: params.page,
        pageSize: params.pageSize
      })}`
    );
  },
  listArchivedUsers(params: ListArchivedUsersParams = {}) {
    return apiGet<PaginatedAdminResponse<AdminArchivedUser>>(
      `/admin/archived-users${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        role: params.role,
        employmentStatus: params.employmentStatus,
        accountStatus: params.accountStatus,
        blockStatus: params.blockStatus
      })}`
    );
  },
  listAuditLogs(params: ListAuditLogsParams = {}) {
    return apiGet<PaginatedAdminResponse<AdminAuditLog>>(
      `/admin/audit-logs${toQuery({
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        from: params.from,
        to: params.to
      })}`
    );
  }
};
