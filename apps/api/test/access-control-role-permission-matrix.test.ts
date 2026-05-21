import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import {
  assertValidSystemRolePermissionMatrix,
  getPermissionsForRole,
  listPermissions,
  PermissionKeys,
  roleHasPermission,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionKey
} from "../src/access-control";

const catalogPermissionKeys = new Set(
  listPermissions().map((permission) => permission.key)
);

const lifecycleCreationPermissionKeys = [
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
];

const managementPermissionKeys = [
  PermissionKeys.APPROVALS_DECIDE_CHAIN,
  PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE,
  PermissionKeys.USERS_EDIT_PROFILE,
  PermissionKeys.USERS_MANAGE_TEMPORARY_PASSWORD,
  PermissionKeys.USERS_READ_TEMPORARY_PASSWORD,
  PermissionKeys.USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS,
  PermissionKeys.ORGANIZATION_MANAGE_CHAINS,
  PermissionKeys.ORGANIZATION_MANAGE_BRANCHES,
  PermissionKeys.ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS,
  PermissionKeys.ORGANIZATION_MANAGE_AREA_MANAGER_ASSIGNMENTS,
  PermissionKeys.REPORTS_EXPORT,
  PermissionKeys.AUDIT_LOGS_VIEW,
  PermissionKeys.AUDIT_LOGS_EXPORT,
  PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE_SECURITY,
  PermissionKeys.NOTIFICATIONS_TARGET_ADMINS,
  PermissionKeys.NOTIFICATIONS_SEND_SYSTEM
];

const pickerLifecyclePermissionKeys = [
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
];

const champLifecyclePermissionKeys = [
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP
];

const areaManagerLifecyclePermissionKeys = [
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER
];

function assertHasPermission(role: UserRole, permissionKey: PermissionKey) {
  assert.equal(
    roleHasPermission(role, permissionKey),
    true,
    `${role} should have ${permissionKey}`
  );
  assert.ok(
    getPermissionsForRole(role).includes(permissionKey),
    `${role} permission list should include ${permissionKey}`
  );
}

function assertMissingPermission(role: UserRole, permissionKey: PermissionKey) {
  assert.equal(
    roleHasPermission(role, permissionKey),
    false,
    `${role} should not have ${permissionKey}`
  );
}

const matrixRoleKeys = Object.keys(SYSTEM_ROLE_PERMISSIONS).sort();
const userRoleValues = Object.values(UserRole).sort();

assert.deepEqual(matrixRoleKeys, userRoleValues);
assert.doesNotThrow(() => assertValidSystemRolePermissionMatrix());

for (const role of Object.values(UserRole)) {
  const permissions = getPermissionsForRole(role);
  assert.equal(permissions, SYSTEM_ROLE_PERMISSIONS[role]);
  assert.equal(new Set(permissions).size, permissions.length);

  for (const permissionKey of permissions) {
    assert.ok(
      catalogPermissionKeys.has(permissionKey),
      `${role} references unknown permission ${permissionKey}`
    );
  }
}

assertHasPermission(UserRole.PICKER, PermissionKeys.REQUESTS_VIEW);
assertHasPermission(
  UserRole.PICKER,
  PermissionKeys.USERS_COMPLETE_OWN_PICKER_PROFILE
);
assertHasPermission(UserRole.PICKER, PermissionKeys.NOTIFICATIONS_VIEW);
assertHasPermission(UserRole.PICKER, PermissionKeys.NOTIFICATIONS_MANAGE_OWN);

for (const permissionKey of [
  ...lifecycleCreationPermissionKeys,
  ...managementPermissionKeys
]) {
  assertMissingPermission(UserRole.PICKER, permissionKey);
}

for (const permissionKey of pickerLifecyclePermissionKeys) {
  assertHasPermission(UserRole.CHAMP, permissionKey);
}

for (const permissionKey of [
  ...champLifecyclePermissionKeys,
  ...areaManagerLifecyclePermissionKeys
]) {
  assertMissingPermission(UserRole.CHAMP, permissionKey);
}

assertHasPermission(
  UserRole.CHAMP,
  PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE
);
assertHasPermission(UserRole.CHAMP, PermissionKeys.USERS_LIST_OPERATIONAL);
assertHasPermission(UserRole.CHAMP, PermissionKeys.REPORTS_VIEW_CHAMP);

for (const permissionKey of [
  ...pickerLifecyclePermissionKeys,
  ...champLifecyclePermissionKeys
]) {
  assertHasPermission(UserRole.AREA_MANAGER, permissionKey);
}

assertHasPermission(
  UserRole.AREA_MANAGER,
  PermissionKeys.APPROVALS_DECIDE_CHAIN
);

for (const permissionKey of areaManagerLifecyclePermissionKeys) {
  assertMissingPermission(UserRole.AREA_MANAGER, permissionKey);
}

assertHasPermission(
  UserRole.AREA_MANAGER,
  PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE
);
assertHasPermission(
  UserRole.AREA_MANAGER,
  PermissionKeys.USERS_LIST_OPERATIONAL
);
assertHasPermission(
  UserRole.AREA_MANAGER,
  PermissionKeys.REPORTS_VIEW_AREA_MANAGER
);

for (const permissionKey of [
  ...lifecycleCreationPermissionKeys,
  PermissionKeys.REQUESTS_CANCEL,
  PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE,
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
  PermissionKeys.AUDIT_LOGS_EXPORT
]) {
  assertHasPermission(UserRole.ADMIN, permissionKey);
}

for (const permissionKey of [
  PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE_SECURITY
]) {
  assertMissingPermission(UserRole.ADMIN, permissionKey);
}

for (const permissionKey of getPermissionsForRole(UserRole.ADMIN)) {
  assertHasPermission(UserRole.SUPER_ADMIN, permissionKey);
}

for (const permissionKey of [
  PermissionKeys.ACCESS_CONTROL_VIEW,
  PermissionKeys.ACCESS_CONTROL_VIEW_ROLE_MATRIX,
  PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX,
  PermissionKeys.SYSTEM_SETTINGS_VIEW,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE,
  PermissionKeys.SYSTEM_SETTINGS_MANAGE_SECURITY,
  PermissionKeys.NOTIFICATIONS_SEND_SYSTEM
]) {
  assertHasPermission(UserRole.SUPER_ADMIN, permissionKey);
}

const matrixPermissionKeys = Object.values(SYSTEM_ROLE_PERMISSIONS).flat();
const forbiddenWorkflowBypassKeys = [
  "pickers.create.direct",
  "pickers.transfer.direct",
  "pickers.archive.direct",
  "picker_assignments.edit_active.direct",
  "approvals.bypass"
];

for (const forbiddenKey of forbiddenWorkflowBypassKeys) {
  assert.equal(matrixPermissionKeys.includes(forbiddenKey as PermissionKey), false);
}
