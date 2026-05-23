import assert from "node:assert/strict";

import {
  getPermissionDefinition,
  listPermissions,
  listPermissionsByGroup,
  PermissionGroups,
  PermissionKeys,
  PermissionRiskLevels,
  type PermissionKey
} from "../src/access-control";

const requiredGroups = [
  PermissionGroups.REQUESTS_APPROVALS,
  PermissionGroups.USERS_PROFILES,
  PermissionGroups.ORGANIZATION,
  PermissionGroups.REPORTS,
  PermissionGroups.AUDIT_LOGS,
  PermissionGroups.ACCESS_CONTROL,
  PermissionGroups.SYSTEM_SETTINGS,
  PermissionGroups.NOTIFICATIONS
];

const permissions = listPermissions();
const permissionsByGroup = listPermissionsByGroup();

assert.ok(permissions.length > 0);

for (const group of requiredGroups) {
  assert.ok(
    permissionsByGroup[group]?.length > 0,
    `Expected permissions for ${group}`
  );
}

const keys = permissions.map((permission) => permission.key);
assert.equal(new Set(keys).size, keys.length);

for (const permission of permissions) {
  assert.equal(getPermissionDefinition(permission.key), permission);
  assert.ok(permission.label.trim().length > 0);
  assert.ok(permission.description.trim().length > 0);
  assert.ok(requiredGroups.includes(permission.group));
  assert.ok(Object.values(PermissionRiskLevels).includes(permission.riskLevel));
  assert.equal(typeof permission.assignable, "boolean");
  assert.equal(typeof permission.systemOnly, "boolean");
  if (permission.systemOnly) {
    assert.equal(permission.assignable, false);
  }
}

assert.deepEqual(getPermissionDefinition(PermissionKeys.REQUESTS_VIEW), {
  key: PermissionKeys.REQUESTS_VIEW,
  label: "View requests",
  description: "View lifecycle requests within the actor's allowed scope.",
  group: PermissionGroups.REQUESTS_APPROVALS,
  riskLevel: PermissionRiskLevels.MEDIUM,
  assignable: true,
  systemOnly: false
});

assert.deepEqual(getPermissionDefinition(PermissionKeys.USERS_VIEW_SELF), {
  key: PermissionKeys.USERS_VIEW_SELF,
  label: "View own profile",
  description: "View the authenticated user's own safe profile.",
  group: PermissionGroups.USERS_PROFILES,
  riskLevel: PermissionRiskLevels.LOW,
  assignable: true,
  systemOnly: false
});

assert.deepEqual(
  getPermissionDefinition(PermissionKeys.USERS_EDIT_OWN_PREFERENCES),
  {
    key: PermissionKeys.USERS_EDIT_OWN_PREFERENCES,
    label: "Edit own preferences",
    description: "Update the authenticated user's own UI/user preferences.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  }
);

const targetRoleLifecyclePermissionKeys = [
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
];

const customRoleManagementPermissionDefinitions = [
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES,
    label: "View custom access roles",
    description: "View custom access roles and read-only access role metadata.",
    riskLevel: PermissionRiskLevels.HIGH
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES,
    label: "Manage custom access roles",
    description:
      "Create, update, deactivate, and manage custom access role metadata.",
    riskLevel: PermissionRiskLevels.CRITICAL
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES,
    label: "Assign custom access roles",
    description: "Assign active custom access roles to users.",
    riskLevel: PermissionRiskLevels.CRITICAL
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_REVOKE_CUSTOM_ROLES,
    label: "Revoke custom access roles",
    description: "Revoke active custom access role assignments from users.",
    riskLevel: PermissionRiskLevels.CRITICAL
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS,
    label: "View effective permissions",
    description:
      "View a user's effective permissions from base role and custom access role assignments.",
    riskLevel: PermissionRiskLevels.HIGH
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_ACCESS_AUDIT,
    label: "View access-control audit",
    description:
      "View audit records related to access roles, permission changes, and user access-role assignments.",
    riskLevel: PermissionRiskLevels.HIGH
  }
];

for (const definition of customRoleManagementPermissionDefinitions) {
  const actualDefinition = getPermissionDefinition(definition.key);

  assert.ok(keys.includes(definition.key), `Expected ${definition.key}`);
  assert.deepEqual(actualDefinition, {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: definition.riskLevel,
    assignable: false,
    systemOnly: true
  });
}

for (const permissionKey of targetRoleLifecyclePermissionKeys) {
  assert.ok(keys.includes(permissionKey), `Expected ${permissionKey}`);
  assert.equal(
    getPermissionDefinition(permissionKey).group,
    PermissionGroups.REQUESTS_APPROVALS
  );
}

const ambiguousLifecycleCreateKeys = [
  "requests.new_hire.create",
  "requests.resignation.create",
  "requests.transfer.create"
];

for (const ambiguousKey of ambiguousLifecycleCreateKeys) {
  assert.equal(keys.includes(ambiguousKey as PermissionKey), false);
}

const forbiddenWorkflowBypassKeys = [
  "pickers.create.direct",
  "pickers.transfer.direct",
  "pickers.archive.direct",
  "picker_assignments.edit_active.direct",
  "approvals.bypass"
];

for (const forbiddenKey of forbiddenWorkflowBypassKeys) {
  assert.equal(keys.includes(forbiddenKey as PermissionKey), false);
}
