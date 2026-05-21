import type { UserRole } from "@/lib/auth/types";
import { apiGet } from "./request";

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  group: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignable: boolean;
  systemOnly: boolean;
}

export interface AccessControlOverview {
  permissions: PermissionDefinition[];
  permissionsByGroup: Record<string, PermissionDefinition[]>;
  systemRolePermissions: Record<UserRole, string[]>;
}

export const accessControlApi = {
  overview() {
    return apiGet<AccessControlOverview>("/access-control/overview");
  }
};
