import assert from "node:assert/strict";

import { GUARDS_METADATA } from "@nestjs/common/constants";
import { UserRole } from "@prisma/client";

import {
  AccessControlController,
  AccessRoleAssignmentService,
  AccessRoleService,
  listPermissions,
  listPermissionsByGroup,
  PermissionGuard,
  PermissionKeys,
  REQUIRED_PERMISSION_KEY,
  SYSTEM_ROLE_PERMISSIONS
} from "../src/access-control";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";

function requiredPermissionFor(methodName: keyof AccessControlController) {
  return Reflect.getMetadata(
    REQUIRED_PERMISSION_KEY,
    AccessControlController.prototype[methodName]
  );
}

assert.equal(Reflect.getMetadata(ROLES_KEY, AccessControlController), undefined);

const controllerGuards = Reflect.getMetadata(
  GUARDS_METADATA,
  AccessControlController
);
assert.deepEqual(controllerGuards, [JwtAuthGuard, PermissionGuard]);

assert.equal(
  requiredPermissionFor("getOverview"),
  PermissionKeys.ACCESS_CONTROL_VIEW
);
assert.equal(
  requiredPermissionFor("listRoles"),
  PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES
);
assert.equal(
  requiredPermissionFor("getRole"),
  PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES
);
assert.equal(
  requiredPermissionFor("createCustomRole"),
  PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
);
assert.equal(
  requiredPermissionFor("updateCustomRole"),
  PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
);
assert.equal(
  requiredPermissionFor("deactivateCustomRole"),
  PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
);
assert.equal(
  requiredPermissionFor("syncCustomRolePermissions"),
  PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
);
assert.equal(
  requiredPermissionFor("getUserEffectivePermissions"),
  PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS
);

const accessRoleService = {} as AccessRoleService;
const controller = new AccessControlController(
  accessRoleService,
  {} as AccessRoleAssignmentService
);
const overview = controller.getOverview();

assert.equal(overview.permissions, listPermissions());
assert.equal(overview.permissionsByGroup, listPermissionsByGroup());
assert.equal(overview.systemRolePermissions, SYSTEM_ROLE_PERMISSIONS);
assert.deepEqual(overview.systemRolePermissionsSource, {
  source: "CODE_SYSTEM_ROLE_MATRIX",
  editable: false,
  note:
    "System role permissions are code-owned and seeded to DB as mirrors. Runtime policy may load the seeded DB cache at startup with code fallback."
});
assert.deepEqual(Object.keys(overview).sort(), [
  "permissions",
  "permissionsByGroup",
  "systemRolePermissionsSource",
  "systemRolePermissions"
].sort());

assert.ok(overview.permissions.length > 0);
assert.ok(
  overview.systemRolePermissions[UserRole.SUPER_ADMIN].length >
    overview.systemRolePermissions[UserRole.ADMIN].length
);
assert.equal(
  overview.systemRolePermissions[UserRole.ADMIN].includes(
    "access_control.system_role_matrix.manage"
  ),
  false
);
