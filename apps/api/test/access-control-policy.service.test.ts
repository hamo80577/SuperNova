import assert from "node:assert/strict";

import { ForbiddenException } from "@nestjs/common";
import {
  AccessRoleAssignmentStatus,
  AccessRoleKind,
  AccessRoleStatus,
  UserRole
} from "@prisma/client";

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

type MockUserAccessRoleAssignmentRow = Readonly<{
  userId: string;
  status: AccessRoleAssignmentStatus;
  startsAt: Date;
  endsAt: Date | null;
  accessRole: Readonly<{
    kind: AccessRoleKind;
    status: AccessRoleStatus;
    isSystem: boolean;
    permissions: readonly Readonly<{ permissionKey: string }>[];
  }>;
}>;

function mockPrisma(
  rows: readonly MockAccessRoleRow[],
  userAccessRoleAssignmentRows: readonly MockUserAccessRoleAssignmentRow[] = []
) {
  let findManyCalls = 0;
  let userAccessRoleAssignmentFindManyCalls = 0;

  return {
    accessRole: {
      findMany: async () => {
        findManyCalls += 1;
        return rows;
      }
    },
    userAccessRoleAssignment: {
      findMany: async (query?: {
        where?: {
          status?: AccessRoleAssignmentStatus;
          startsAt?: { lte?: Date };
          OR?: readonly (
            | { endsAt: null }
            | { endsAt: { gt?: Date } }
          )[];
          accessRole?: {
            kind?: AccessRoleKind;
            status?: AccessRoleStatus;
            isSystem?: boolean;
          };
        };
      }) => {
        userAccessRoleAssignmentFindManyCalls += 1;
        const now = query?.where?.startsAt?.lte;
        const usesExpectedFilter =
          query?.where?.status === AccessRoleAssignmentStatus.ACTIVE &&
          now instanceof Date &&
          query.where.OR?.some((condition) => condition.endsAt === null) &&
          query.where.OR?.some(
            (condition) =>
              typeof condition.endsAt === "object" &&
              condition.endsAt?.gt instanceof Date
          ) &&
          query.where.accessRole?.kind === AccessRoleKind.CUSTOM &&
          query.where.accessRole.status === AccessRoleStatus.ACTIVE &&
          query.where.accessRole.isSystem === false;
        const matchingRows = usesExpectedFilter
          ? userAccessRoleAssignmentRows.filter(
              (row) =>
                row.status === AccessRoleAssignmentStatus.ACTIVE &&
                row.startsAt <= now &&
                (row.endsAt === null || row.endsAt > now) &&
                row.accessRole.kind === AccessRoleKind.CUSTOM &&
                row.accessRole.status === AccessRoleStatus.ACTIVE &&
                row.accessRole.isSystem === false
            )
          : userAccessRoleAssignmentRows;

        return matchingRows.map((row) => ({
          userId: row.userId,
          accessRole: {
            permissions: row.accessRole.permissions
          }
        }));
      }
    },
    get findManyCalls() {
      return findManyCalls;
    },
    get userAccessRoleAssignmentFindManyCalls() {
      return userAccessRoleAssignmentFindManyCalls;
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

function customAssignmentRow(
  userId: string,
  permissions: readonly (PermissionKey | string)[],
  overrides: Partial<MockUserAccessRoleAssignmentRow> = {}
): MockUserAccessRoleAssignmentRow {
  const now = Date.now();

  return {
    userId,
    status: AccessRoleAssignmentStatus.ACTIVE,
    startsAt: new Date(now - 60_000),
    endsAt: null,
    accessRole: {
      kind: AccessRoleKind.CUSTOM,
      status: AccessRoleStatus.ACTIVE,
      isSystem: false,
      permissions: permissions.map((permissionKey) => ({ permissionKey }))
    },
    ...overrides
  };
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
assert.equal(validDbPrisma.userAccessRoleAssignmentFindManyCalls, 1);
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

const assignedPicker = actor(UserRole.PICKER);
const unassignedPicker = {
  id: "unassigned-picker",
  role: UserRole.PICKER
} satisfies AccessPolicyActor;
const customGrantPrisma = mockPrisma(completeDbRows(), [
  customAssignmentRow(assignedPicker.id, [
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ])
]);
const customGrantService = new AccessPolicyService(customGrantPrisma as never);

await customGrantService.onModuleInit();

assert.equal(customGrantPrisma.findManyCalls, 1);
assert.equal(customGrantPrisma.userAccessRoleAssignmentFindManyCalls, 1);
assert.equal(
  customGrantService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  true
);
assert.equal(
  customGrantService.hasPermission(
    unassignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.doesNotThrow(() =>
  customGrantService.assertCan(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  )
);
assert.throws(
  () =>
    customGrantService.assertCan(
      unassignedPicker,
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    ),
  ForbiddenException
);
assert.equal(
  customGrantService.hasPermission(assignedPicker, PermissionKeys.REQUESTS_VIEW),
  true
);
assert.equal(
  customGrantService.hasPermission(
    actor(UserRole.ADMIN),
    PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
  ),
  true
);
assert.equal(
  customGrantService.hasPermission(
    actor(UserRole.SUPER_ADMIN),
    PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX
  ),
  true
);

const customSyncHasPermissionResult = customGrantService.hasPermission(
  assignedPicker,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
);
const customSyncCanResult = customGrantService.can(
  assignedPicker,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
);
const customSyncAssertCanResult = customGrantService.assertCan(
  assignedPicker,
  PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
);

assert.equal(isPromiseLike(customSyncHasPermissionResult), false);
assert.equal(isPromiseLike(customSyncCanResult), false);
assert.equal(customSyncAssertCanResult, undefined);

const emptyCustomAssignmentService = new AccessPolicyService(
  mockPrisma(completeDbRows(), []) as never
);

await emptyCustomAssignmentService.onModuleInit();
assert.equal(
  emptyCustomAssignmentService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_VIEW
  ),
  true
);
assert.equal(
  emptyCustomAssignmentService.hasPermission(
    actor(UserRole.PICKER),
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);

const systemAssignmentIgnoredService = new AccessPolicyService(
  mockPrisma(completeDbRows(), [
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    ], {
      accessRole: {
        kind: AccessRoleKind.SYSTEM,
        status: AccessRoleStatus.ACTIVE,
        isSystem: true,
        permissions: [
          { permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER }
        ]
      }
    })
  ]) as never
);

await systemAssignmentIgnoredService.onModuleInit();
assert.equal(
  systemAssignmentIgnoredService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);

const inactiveExpiredFutureAssignmentService = new AccessPolicyService(
  mockPrisma(completeDbRows(), [
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    ], {
      status: AccessRoleAssignmentStatus.INACTIVE
    }),
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    ], {
      endsAt: new Date(Date.now() - 60_000)
    }),
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
    ], {
      startsAt: new Date(Date.now() + 60_000)
    })
  ]) as never
);

await inactiveExpiredFutureAssignmentService.onModuleInit();
assert.equal(
  inactiveExpiredFutureAssignmentService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.equal(
  inactiveExpiredFutureAssignmentService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
  ),
  false
);
assert.equal(
  inactiveExpiredFutureAssignmentService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
  ),
  false
);

const invalidCustomPermissionService = new AccessPolicyService(
  mockPrisma(completeDbRows(), [
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
      "unknown.permission"
    ])
  ]) as never
);

await assert.doesNotReject(() => invalidCustomPermissionService.onModuleInit());
assert.equal(
  invalidCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.equal(
  invalidCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_VIEW
  ),
  true
);

const systemOnlyCustomPermissionService = new AccessPolicyService(
  mockPrisma(completeDbRows(), [
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
      PermissionKeys.ACCESS_CONTROL_VIEW
    ])
  ]) as never
);

await assert.doesNotReject(() =>
  systemOnlyCustomPermissionService.onModuleInit()
);
assert.equal(
  systemOnlyCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.equal(
  systemOnlyCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.ACCESS_CONTROL_VIEW
  ),
  false
);
assert.equal(
  systemOnlyCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_VIEW
  ),
  true
);

const nonAssignableCustomPermissionService = new AccessPolicyService(
  mockPrisma(completeDbRows(), [
    customAssignmentRow(assignedPicker.id, [
      PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
      PermissionKeys.ACCESS_CONTROL_VIEW_ROLE_MATRIX
    ])
  ]) as never
);

await assert.doesNotReject(() =>
  nonAssignableCustomPermissionService.onModuleInit()
);
assert.equal(
  nonAssignableCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
  ),
  false
);
assert.equal(
  nonAssignableCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.ACCESS_CONTROL_VIEW_ROLE_MATRIX
  ),
  false
);
assert.equal(
  nonAssignableCustomPermissionService.hasPermission(
    assignedPicker,
    PermissionKeys.REQUESTS_VIEW
  ),
  true
);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
