import assert from "node:assert/strict";

import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import {
  AccessPolicyService,
  getPermissionsForRole,
  PermissionKeys,
  type AccessPolicyActor,
  type AccessPolicyContext
} from "../src/access-control";
import type { PermissionKey } from "../src/access-control";

function actor(role: UserRole): AccessPolicyActor {
  return {
    id: `actor-${role.toLowerCase()}`,
    role
  };
}

type MockAccessRoleRow = Readonly<{
  systemRole: UserRole | null;
  permissions: readonly Readonly<{ permissionKey: string }>[];
}>;

function mockPrisma(rows: readonly MockAccessRoleRow[]) {
  let findManyCalls = 0;

  return {
    accessRole: {
      findMany: async () => {
        findManyCalls += 1;
        return rows;
      }
    },
    get findManyCalls() {
      return findManyCalls;
    }
  };
}

function completeDbRows(
  overrides: Partial<Record<UserRole, readonly PermissionKey[]>> = {}
) {
  return Object.values(UserRole).map((role) => ({
    systemRole: role,
    permissions: [...(overrides[role] ?? getPermissionsForRole(role))].map(
      (permissionKey) => ({ permissionKey })
    )
  }));
}

function isPromiseLike(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

async function main() {
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

const validDbPrisma = mockPrisma(
  completeDbRows({
    [UserRole.PICKER]: [
      ...getPermissionsForRole(UserRole.PICKER),
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    ]
  })
);
const dbBackedService = new AccessPolicyService(validDbPrisma as never);

await dbBackedService.onModuleInit();

assert.equal(validDbPrisma.findManyCalls, 1);
assert.equal(
  dbBackedService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  true
);
assert.equal(
  dbBackedService.can(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  true
);
assert.doesNotThrow(() =>
  dbBackedService.assertCan(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  )
);
assert.equal(
  dbBackedService.hasPermission(
    actor(UserRole.ADMIN),
    PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX
  ),
  false
);

const syncHasPermissionResult = dbBackedService.hasPermission(
  actor(UserRole.PICKER),
  PermissionKeys.REQUESTS_VIEW
);
const syncCanResult = dbBackedService.can(
  actor(UserRole.PICKER),
  PermissionKeys.REQUESTS_VIEW
);
const syncAssertCanResult = dbBackedService.assertCan(
  actor(UserRole.PICKER),
  PermissionKeys.REQUESTS_VIEW
);

assert.equal(isPromiseLike(syncHasPermissionResult), false);
assert.equal(isPromiseLike(syncCanResult), false);
assert.equal(syncAssertCanResult, undefined);

const missingRoleService = new AccessPolicyService(
  mockPrisma(completeDbRows().filter((row) => row.systemRole !== UserRole.CHAMP)) as never
);

await assert.doesNotReject(() => missingRoleService.onModuleInit());
assert.equal(
  missingRoleService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.equal(
  missingRoleService.hasPermission(
    actor(UserRole.CHAMP),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  true
);

const unknownPermissionService = new AccessPolicyService(
  mockPrisma(
    completeDbRows({
      [UserRole.PICKER]: [
        ...getPermissionsForRole(UserRole.PICKER),
        "unknown.permission" as PermissionKey
      ]
    })
  ) as never
);

await assert.doesNotReject(() => unknownPermissionService.onModuleInit());
assert.equal(
  unknownPermissionService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);

const emptyDbService = new AccessPolicyService(mockPrisma([]) as never);

await assert.doesNotReject(() => emptyDbService.onModuleInit());
assert.equal(
  emptyDbService.hasPermission(actor(UserRole.PICKER), PermissionKeys.REQUESTS_VIEW),
  true
);
assert.equal(
  emptyDbService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);

const userAssignmentProbePrisma = {
  accessRole: {
    findMany: async () => completeDbRows()
  },
  userAccessRoleAssignment: {
    findMany: async () => {
      throw new Error("UserAccessRoleAssignment must not be read in Phase 7E.");
    }
  }
};
const userAssignmentProbeService = new AccessPolicyService(
  userAssignmentProbePrisma as never
);

await userAssignmentProbeService.onModuleInit();
assert.equal(
  userAssignmentProbeService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
