import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import {
  AccessControlController,
  listPermissions,
  listPermissionsByGroup,
  SYSTEM_ROLE_PERMISSIONS
} from "../src/access-control";

const controller = new AccessControlController();
const overview = controller.getOverview();

assert.deepEqual(
  Reflect.getMetadata(ROLES_KEY, AccessControlController),
  [UserRole.SUPER_ADMIN]
);

assert.equal(overview.permissions, listPermissions());
assert.equal(overview.permissionsByGroup, listPermissionsByGroup());
assert.equal(overview.systemRolePermissions, SYSTEM_ROLE_PERMISSIONS);

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
