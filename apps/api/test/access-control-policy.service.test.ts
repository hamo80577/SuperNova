import assert from "node:assert/strict";

import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import {
  AccessPolicyService,
  PermissionKeys,
  type AccessPolicyActor,
  type AccessPolicyContext
} from "../src/access-control";

function actor(role: UserRole): AccessPolicyActor {
  return {
    id: `actor-${role.toLowerCase()}`,
    role
  };
}

const service = new AccessPolicyService();

assert.equal(AccessPolicyService.length, 0);

assert.equal(
  service.hasPermission(actor(UserRole.PICKER), PermissionKeys.REQUESTS_VIEW),
  true
);
assert.equal(
  service.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.USERS_COMPLETE_OWN_PICKER_PROFILE
  ),
  true
);
assert.equal(
  service.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.equal(
  service.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.USERS_MANAGE_TEMPORARY_PASSWORD
  ),
  false
);

for (const permissionKey of [
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
  PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
  PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
]) {
  assert.equal(service.can(actor(UserRole.CHAMP), permissionKey), true);
}

assert.equal(
  service.can(
    actor(UserRole.CHAMP),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP
  ),
  false
);

assert.equal(
  service.can(
    actor(UserRole.AREA_MANAGER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP
  ),
  true
);
assert.equal(
  service.can(actor(UserRole.AREA_MANAGER), PermissionKeys.APPROVALS_DECIDE_CHAIN),
  true
);
assert.equal(
  service.can(
    actor(UserRole.AREA_MANAGER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER
  ),
  false
);

assert.equal(
  service.can(
    actor(UserRole.ADMIN),
    PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
  ),
  true
);
assert.equal(
  service.can(
    actor(UserRole.ADMIN),
    PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX
  ),
  false
);

assert.equal(
  service.can(
    actor(UserRole.SUPER_ADMIN),
    PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX
  ),
  true
);
assert.equal(
  service.can(actor(UserRole.SUPER_ADMIN), PermissionKeys.SYSTEM_SETTINGS_MANAGE),
  true
);
assert.equal(
  service.can(
    actor(UserRole.SUPER_ADMIN),
    PermissionKeys.SYSTEM_SETTINGS_MANAGE_SECURITY
  ),
  true
);

assert.doesNotThrow(() =>
  service.assertCan(
    actor(UserRole.ADMIN),
    PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
  )
);

assert.throws(
  () =>
    service.assertCan(
      actor(UserRole.ADMIN),
      PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX
    ),
  ForbiddenException
);

const futureScopeContext = {
  chainId: "chain-1",
  vendorId: "vendor-1",
  requestId: "request-1",
  approvalId: "approval-1",
  targetUserId: "user-1",
  sourceChainId: "source-chain-1",
  destinationChainId: "destination-chain-1"
} satisfies AccessPolicyContext;

assert.equal(
  service.can(
    actor(UserRole.AREA_MANAGER),
    PermissionKeys.APPROVALS_DECIDE_CHAIN,
    futureScopeContext
  ),
  true
);
assert.equal(
  service.can(
    actor(UserRole.CHAMP),
    PermissionKeys.APPROVALS_DECIDE_CHAIN,
    futureScopeContext
  ),
  false
);
