import { UserRole } from "@prisma/client";

import {
  PERMISSION_DEFINITION_BY_KEY,
  PermissionKeys,
  type PermissionKey
} from "./permissions";

export type SystemRolePermissionMatrix = Readonly<
  Record<UserRole, readonly PermissionKey[]>
>;

const PICKER_PERMISSIONS = [
  PermissionKeys.REQUESTS_VIEW,
  PermissionKeys.USERS_VIEW_SELF,
  PermissionKeys.USERS_EDIT_OWN_PREFERENCES,
  PermissionKeys.USERS_COMPLETE_OWN_PICKER_PROFILE,
  PermissionKeys.NOTIFICATIONS_VIEW,
  PermissionKeys.NOTIFICATIONS_MANAGE_OWN
] as const satisfies readonly PermissionKey[];

const CHAMP_PERMISSIONS = [
  PermissionKeys.REQUESTS_VIEW,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER,
  PermissionKeys.USERS_VIEW_SELF,
  PermissionKeys.USERS_EDIT_OWN_PREFERENCES,
  PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE,
  PermissionKeys.USERS_LIST_OPERATIONAL,
  PermissionKeys.REPORTS_VIEW_CHAMP,
  PermissionKeys.NOTIFICATIONS_VIEW,
  PermissionKeys.NOTIFICATIONS_MANAGE_OWN
] as const satisfies readonly PermissionKey[];

const AREA_MANAGER_PERMISSIONS = [
  PermissionKeys.REQUESTS_VIEW,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER,
  PermissionKeys.APPROVALS_DECIDE_CHAIN,
  PermissionKeys.USERS_VIEW_SELF,
  PermissionKeys.USERS_EDIT_OWN_PREFERENCES,
  PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE,
  PermissionKeys.USERS_LIST_OPERATIONAL,
  PermissionKeys.REPORTS_VIEW_AREA_MANAGER,
  PermissionKeys.NOTIFICATIONS_VIEW,
  PermissionKeys.NOTIFICATIONS_MANAGE_OWN
] as const satisfies readonly PermissionKey[];

const ADMIN_PERMISSIONS = [
  PermissionKeys.REQUESTS_VIEW,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER,
  PermissionKeys.REQUESTS_CANCEL,
  PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE,
  PermissionKeys.USERS_VIEW_SELF,
  PermissionKeys.USERS_EDIT_OWN_PREFERENCES,
  PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE,
  PermissionKeys.USERS_LIST_OPERATIONAL,
  PermissionKeys.USERS_EDIT_PROFILE,
  PermissionKeys.USERS_MANAGE_TEMPORARY_PASSWORD,
  PermissionKeys.USERS_READ_TEMPORARY_PASSWORD,
  PermissionKeys.USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS,
  PermissionKeys.ORGANIZATION_VIEW,
  PermissionKeys.ORGANIZATION_MANAGE_CHAINS,
  PermissionKeys.ORGANIZATION_MANAGE_BRANCHES,
  PermissionKeys.ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS,
  PermissionKeys.ORGANIZATION_MANAGE_AREA_MANAGER_ASSIGNMENTS,
  PermissionKeys.ASSIGNMENTS_VIEW,
  PermissionKeys.REPORTS_VIEW_ADMIN,
  PermissionKeys.REPORTS_EXPORT,
  PermissionKeys.AUDIT_LOGS_VIEW,
  PermissionKeys.AUDIT_LOGS_EXPORT,
  PermissionKeys.NOTIFICATIONS_VIEW,
  PermissionKeys.NOTIFICATIONS_MANAGE_OWN
] as const satisfies readonly PermissionKey[];

const SUPER_ADMIN_PERMISSIONS = [
  ...ADMIN_PERMISSIONS,
  PermissionKeys.ACCESS_CONTROL_VIEW,
  PermissionKeys.ACCESS_CONTROL_VIEW_ROLE_MATRIX,
  PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX,
  PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES,
  PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES,
  PermissionKeys.ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES,
  PermissionKeys.ACCESS_CONTROL_REVOKE_CUSTOM_ROLES,
  PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS,
  PermissionKeys.ACCESS_CONTROL_VIEW_ACCESS_AUDIT,
  PermissionKeys.SYSTEM_SETTINGS_VIEW,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE_SECURITY,
  PermissionKeys.NOTIFICATIONS_SEND_SYSTEM
] as const satisfies readonly PermissionKey[];

export const SYSTEM_ROLE_PERMISSIONS = {
  [UserRole.PICKER]: PICKER_PERMISSIONS,
  [UserRole.CHAMP]: CHAMP_PERMISSIONS,
  [UserRole.AREA_MANAGER]: AREA_MANAGER_PERMISSIONS,
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS
} as const satisfies SystemRolePermissionMatrix;

export function getPermissionsForRole(
  role: UserRole
): readonly PermissionKey[] {
  return SYSTEM_ROLE_PERMISSIONS[role];
}

export function roleHasPermission(
  role: UserRole,
  permissionKey: PermissionKey
) {
  return getPermissionsForRole(role).includes(permissionKey);
}

export function assertValidSystemRolePermissionMatrix() {
  const matrixRoles = Object.keys(SYSTEM_ROLE_PERMISSIONS) as UserRole[];
  const systemRoles = Object.values(UserRole);

  for (const role of systemRoles) {
    if (!matrixRoles.includes(role)) {
      throw new Error(`Missing system role permission matrix entry for ${role}`);
    }
  }

  for (const role of matrixRoles) {
    if (!systemRoles.includes(role)) {
      throw new Error(`Unknown system role permission matrix entry for ${role}`);
    }

    const permissions = getPermissionsForRole(role);
    if (new Set(permissions).size !== permissions.length) {
      throw new Error(`Duplicate permissions found for ${role}`);
    }

    for (const permissionKey of permissions) {
      if (!PERMISSION_DEFINITION_BY_KEY[permissionKey]) {
        throw new Error(
          `Unknown permission ${permissionKey} in system role ${role}`
        );
      }
    }
  }
}
