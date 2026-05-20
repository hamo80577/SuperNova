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
