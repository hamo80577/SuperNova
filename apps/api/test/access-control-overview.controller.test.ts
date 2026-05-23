import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedRequest } from "../src/auth/types/authenticated-request";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import {
  AccessControlController,
  AccessPolicyService,
  listPermissions,
  listPermissionsByGroup,
  PermissionKeys,
  SYSTEM_ROLE_PERMISSIONS
} from "../src/access-control";
import type { AccessRoleService } from "../src/access-control";

function actor(role: UserRole): AuthenticatedUser {
  return {
    id: `actor-${role.toLowerCase()}`,
    role,
    nameEn: role,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function requestFor(user: AuthenticatedUser): AuthenticatedRequest {
  return { user } as AuthenticatedRequest;
}

assert.deepEqual(
  Reflect.getMetadata(ROLES_KEY, AccessControlController),
  [UserRole.SUPER_ADMIN]
);

const policyCalls: Array<{
  actor: AuthenticatedUser;
  permissionKey: string;
}> = [];

const recordingPolicy = {
  assertCan: (policyActor: AuthenticatedUser, permissionKey: string) => {
    policyCalls.push({ actor: policyActor, permissionKey });
  }
};

const accessRoleService = {} as AccessRoleService;
const controller = new AccessControlController(
  recordingPolicy as AccessPolicyService,
  accessRoleService
);
const superAdminRequest = requestFor(actor(UserRole.SUPER_ADMIN));
const overview = controller.getOverview(superAdminRequest);

assert.deepEqual(policyCalls, [
  {
    actor: superAdminRequest.user,
    permissionKey: PermissionKeys.ACCESS_CONTROL_VIEW
  }
]);

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

const realPolicyController = new AccessControlController(
  new AccessPolicyService(),
  accessRoleService
);

assert.doesNotThrow(() =>
  realPolicyController.getOverview(requestFor(actor(UserRole.SUPER_ADMIN)))
);

assert.throws(
  () => realPolicyController.getOverview(requestFor(actor(UserRole.ADMIN))),
  /Missing required permission/
);
