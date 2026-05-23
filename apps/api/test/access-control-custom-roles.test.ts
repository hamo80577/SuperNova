import assert from "node:assert/strict";

import {
  AccessRoleAssignmentStatus,
  AccessRoleKind,
  AccessRoleStatus,
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import {
  AccessControlController,
  AccessPolicyService,
  AccessRoleAssignmentService,
  AccessRoleService,
  PermissionKeys,
  type PermissionKey
} from "../src/access-control";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedRequest } from "../src/auth/types/authenticated-request";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  kind: AccessRoleKind;
  systemRole: UserRole | null;
  status: AccessRoleStatus;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PermissionRow = {
  id: string;
  accessRoleId: string;
  permissionKey: string;
  createdAt: Date;
  updatedAt: Date;
};

type AssignmentRow = {
  id: string;
  userId: string;
  accessRoleId: string;
  status: AccessRoleAssignmentStatus;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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
  return {
    user,
    cookies: {},
    ip: "127.0.0.1",
    headers: { "user-agent": "access-control-custom-roles-test" }
  } as AuthenticatedRequest;
}

function createRoleRow(overrides: Partial<RoleRow>): RoleRow {
  const now = new Date("2026-05-23T10:00:00.000Z");

  return {
    id: overrides.id ?? `role-${Math.random().toString(16).slice(2)}`,
    key: overrides.key ?? "custom.default",
    name: overrides.name ?? "Custom Default",
    description: overrides.description ?? null,
    kind: overrides.kind ?? AccessRoleKind.CUSTOM,
    systemRole: overrides.systemRole ?? null,
    status: overrides.status ?? AccessRoleStatus.ACTIVE,
    isSystem: overrides.isSystem ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function createPermissionRow(
  accessRoleId: string,
  permissionKey: string
): PermissionRow {
  const now = new Date("2026-05-23T10:00:00.000Z");

  return {
    id: `permission-${accessRoleId}-${permissionKey}`,
    accessRoleId,
    permissionKey,
    createdAt: now,
    updatedAt: now
  };
}

function createMockPrisma(params: {
  roles?: RoleRow[];
  permissions?: PermissionRow[];
  assignments?: AssignmentRow[];
}) {
  const roles = params.roles ?? [];
  const permissions = params.permissions ?? [];
  const assignments = params.assignments ?? [];
  const auditRows: unknown[] = [];

  function permissionsForRole(accessRoleId: string) {
    return permissions.filter((permission) => permission.accessRoleId === accessRoleId);
  }

  function activeAssignmentsForRole(accessRoleId: string) {
    return assignments.filter(
      (assignment) =>
        assignment.accessRoleId === accessRoleId &&
        assignment.status === AccessRoleAssignmentStatus.ACTIVE
    );
  }

  function decorateRole(role: RoleRow) {
    return {
      ...role,
      permissions: permissionsForRole(role.id),
      _count: {
        permissions: permissionsForRole(role.id).length,
        userAssignments: activeAssignmentsForRole(role.id).length
      }
    };
  }

  function matchesRoleWhere(role: RoleRow, where?: Record<string, unknown>) {
    if (!where) {
      return true;
    }

    if (where.kind && role.kind !== where.kind) {
      return false;
    }

    if (where.status && role.status !== where.status) {
      return false;
    }

    if (where.id && role.id !== where.id) {
      return false;
    }

    if (where.key && role.key !== where.key) {
      return false;
    }

    if (Array.isArray(where.OR)) {
      const search = String(
        (where.OR[0] as { key?: { contains?: string } }).key?.contains ?? ""
      ).toLowerCase();

      return [role.key, role.name, role.description ?? ""].some((value) =>
        value.toLowerCase().includes(search)
      );
    }

    return true;
  }

  const prisma = {
    $transaction: async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    accessRole: {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        roles.filter((role) => matchesRoleWhere(role, where)).length,
      findMany: async ({
        where,
        skip,
        take
      }: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
      } = {}) => {
        const filtered = roles.filter((role) => matchesRoleWhere(role, where));
        const start = skip ?? 0;
        const end = take === undefined ? undefined : start + take;
        return filtered.slice(start, end).map(decorateRole);
      },
      findUnique: async ({
        where
      }: {
        where: { id?: string; key?: string };
      }) => {
        const role = roles.find(
          (item) =>
            (where.id !== undefined && item.id === where.id) ||
            (where.key !== undefined && item.key === where.key)
        );

        return role ? decorateRole(role) : null;
      },
      create: async ({ data }: { data: Partial<RoleRow> }) => {
        if (roles.some((role) => role.key === data.key)) {
          throw new Error("duplicate key");
        }

        const now = new Date("2026-05-23T11:00:00.000Z");
        const role = createRoleRow({
          id: `role-${roles.length + 1}`,
          key: data.key,
          name: data.name,
          description: data.description ?? null,
          kind: data.kind,
          systemRole: null,
          status: data.status,
          isSystem: data.isSystem,
          createdAt: now,
          updatedAt: now
        });

        roles.push(role);
        return role;
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<RoleRow>;
      }) => {
        const role = roles.find((item) => item.id === where.id);

        if (!role) {
          throw new Error("role missing");
        }

        Object.assign(role, data, {
          updatedAt: new Date("2026-05-23T12:00:00.000Z")
        });

        return decorateRole(role);
      }
    },
    accessRolePermission: {
      findMany: async ({ where }: { where: { accessRoleId: string } }) =>
        permissionsForRole(where.accessRoleId),
      createMany: async ({
        data
      }: {
        data: Array<{ accessRoleId: string; permissionKey: string }>;
      }) => {
        for (const item of data) {
          if (
            !permissions.some(
              (permission) =>
                permission.accessRoleId === item.accessRoleId &&
                permission.permissionKey === item.permissionKey
            )
          ) {
            permissions.push(
              createPermissionRow(item.accessRoleId, item.permissionKey)
            );
          }
        }

        return { count: data.length };
      },
      deleteMany: async ({
        where
      }: {
        where: { accessRoleId: string; permissionKey?: { in?: string[] } };
      }) => {
        const before = permissions.length;
        const requestedKeys = where.permissionKey?.in;

        for (let index = permissions.length - 1; index >= 0; index -= 1) {
          const permission = permissions[index];

          if (
            permission.accessRoleId === where.accessRoleId &&
            (!requestedKeys || requestedKeys.includes(permission.permissionKey))
          ) {
            permissions.splice(index, 1);
          }
        }

        return { count: before - permissions.length };
      }
    },
    userAccessRoleAssignment: {
      count: async ({ where }: { where: { accessRoleId: string } }) =>
        activeAssignmentsForRole(where.accessRoleId).length,
      updateMany: async ({
        where,
        data
      }: {
        where: {
          accessRoleId: string;
          status?: AccessRoleAssignmentStatus;
        };
        data: Partial<AssignmentRow>;
      }) => {
        let count = 0;

        for (const assignment of assignments) {
          if (
            assignment.accessRoleId === where.accessRoleId &&
            (!where.status || assignment.status === where.status)
          ) {
            Object.assign(assignment, data, {
              updatedAt: new Date("2026-05-23T12:30:00.000Z")
            });
            count += 1;
          }
        }

        return { count };
      }
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        auditRows.push(data);
        return data;
      }
    }
  };

  return {
    prisma,
    roles,
    permissions,
    assignments,
    auditRows
  };
}

function createPolicyRecorder() {
  const calls: Array<{ actor: AuthenticatedUser; permissionKey: PermissionKey }> = [];

  return {
    calls,
    policy: {
      assertCan: (policyActor: AuthenticatedUser, permissionKey: PermissionKey) => {
        calls.push({ actor: policyActor, permissionKey });
      }
    } as AccessPolicyService
  };
}

function createRefreshRecorder() {
  let refreshCount = 0;

  return {
    get refreshCount() {
      return refreshCount;
    },
    policy: {
      refreshPermissionCaches: async () => {
        refreshCount += 1;
      }
    } as AccessPolicyService
  };
}

async function main() {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AccessControlController), [
    UserRole.SUPER_ADMIN
  ]);

  const superAdmin = actor(UserRole.SUPER_ADMIN);
  const admin = actor(UserRole.ADMIN);
  const request = requestFor(superAdmin);
  const policyRecorder = createPolicyRecorder();
  const serviceCalls: string[] = [];
  const roleService = {
    listRoles: async (query: unknown) => {
      serviceCalls.push(`list:${JSON.stringify(query)}`);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    },
    getRole: async (id: string) => {
      serviceCalls.push(`get:${id}`);
      return { role: { id } };
    },
    createCustomRole: async (dto: unknown) => {
      serviceCalls.push(`create:${JSON.stringify(dto)}`);
      return { role: { id: "created-role" } };
    },
    updateCustomRoleMetadata: async (id: string, dto: unknown) => {
      serviceCalls.push(`update:${id}:${JSON.stringify(dto)}`);
      return { role: { id } };
    },
    deactivateCustomRole: async (id: string, dto: unknown) => {
      serviceCalls.push(`deactivate:${id}:${JSON.stringify(dto)}`);
      return { role: { id } };
    },
    syncCustomRolePermissions: async (id: string, dto: unknown) => {
      serviceCalls.push(`sync:${id}:${JSON.stringify(dto)}`);
      return { role: { id } };
    }
  } as AccessRoleService;
  const controller = new AccessControlController(
    policyRecorder.policy,
    roleService,
    {} as AccessRoleAssignmentService
  );

  await controller.listRoles({ kind: AccessRoleKind.CUSTOM }, request);
  await controller.getRole("role-1", request);
  await controller.createCustomRole(
    {
      key: "custom.ops.viewer",
      name: "Ops Viewer",
      reason: "Create role"
    },
    request
  );
  await controller.updateCustomRole(
    "role-1",
    { name: "Updated", reason: "Rename" },
    request
  );
  await controller.deactivateCustomRole(
    "role-1",
    { reason: "Retire", revokeActiveAssignments: true },
    request
  );
  await controller.syncCustomRolePermissions(
    "role-1",
    { permissionKeys: [PermissionKeys.REQUESTS_VIEW], reason: "Sync" },
    request
  );

  assert.deepEqual(policyRecorder.calls, [
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    }
  ]);
  assert.deepEqual(serviceCalls, [
    `list:${JSON.stringify({ kind: AccessRoleKind.CUSTOM })}`,
    "get:role-1",
    `create:${JSON.stringify({
      key: "custom.ops.viewer",
      name: "Ops Viewer",
      reason: "Create role"
    })}`,
    `update:role-1:${JSON.stringify({ name: "Updated", reason: "Rename" })}`,
    `deactivate:role-1:${JSON.stringify({
      reason: "Retire",
      revokeActiveAssignments: true
    })}`,
    `sync:role-1:${JSON.stringify({
      permissionKeys: [PermissionKeys.REQUESTS_VIEW],
      reason: "Sync"
    })}`
  ]);

  const denyingController = new AccessControlController(
    new AccessPolicyService(),
    roleService,
    {} as AccessRoleAssignmentService
  );
  assert.throws(
    () => denyingController.listRoles({}, requestFor(admin)),
    /Missing required permission/
  );

  assert.equal("assignUserAccessRole" in AccessControlController.prototype, false);
  assert.equal(
    "revokeUserAccessRoleAssignment" in AccessControlController.prototype,
    false
  );

  const customRole = createRoleRow({
    id: "custom-role-1",
    key: "custom.ops.viewer",
    name: "Ops Viewer"
  });
  const systemRole = createRoleRow({
    id: "system-role-1",
    key: "system.admin",
    name: "Admin",
    kind: AccessRoleKind.SYSTEM,
    systemRole: UserRole.ADMIN,
    isSystem: true
  });
  const store = createMockPrisma({
    roles: [customRole, systemRole],
    permissions: [
      createPermissionRow(customRole.id, PermissionKeys.REQUESTS_VIEW),
      createPermissionRow(customRole.id, PermissionKeys.REPORTS_VIEW_ADMIN)
    ],
    assignments: [
      {
        id: "assignment-1",
        userId: "user-1",
        accessRoleId: customRole.id,
        status: AccessRoleAssignmentStatus.ACTIVE,
        startsAt: new Date("2026-05-23T09:00:00.000Z"),
        endsAt: null,
        createdAt: new Date("2026-05-23T09:00:00.000Z"),
        updatedAt: new Date("2026-05-23T09:00:00.000Z")
      }
    ]
  });
  const refreshRecorder = createRefreshRecorder();
  const service = new AccessRoleService(
    store.prisma as never,
    refreshRecorder.policy
  );

  const listResponse = await service.listRoles({
    kind: AccessRoleKind.CUSTOM,
    search: "ops",
    page: 1,
    pageSize: 10
  });

  assert.equal(listResponse.total, 1);
  assert.equal(listResponse.items[0].id, customRole.id);
  assert.equal(listResponse.items[0].permissionCount, 2);
  assert.equal(listResponse.items[0].activeAssignmentCount, 1);
  assert.equal(listResponse.items[0].readOnly, false);

  const detailResponse = await service.getRole(customRole.id);

  assert.equal(detailResponse.role.id, customRole.id);
  assert.deepEqual(
    detailResponse.role.permissions.map((permission) => permission.key).sort(),
    [PermissionKeys.REPORTS_VIEW_ADMIN, PermissionKeys.REQUESTS_VIEW].sort()
  );
  assert.equal(detailResponse.role.activeAssignmentCount, 1);

  const createdResponse = await service.createCustomRole(
    {
      key: "custom.branch.viewer",
      name: "Branch Viewer",
      description: "Can see scoped branch context",
      permissionKeys: [
        PermissionKeys.REQUESTS_VIEW,
        PermissionKeys.REPORTS_VIEW_CHAMP
      ],
      reason: "Create a read-only branch role."
    },
    {
      actorUserId: superAdmin.id,
      ipAddress: "127.0.0.1",
      userAgent: "access-control-custom-roles-test"
    }
  );

  assert.equal(createdResponse.role.kind, AccessRoleKind.CUSTOM);
  assert.equal(createdResponse.role.status, AccessRoleStatus.ACTIVE);
  assert.equal(createdResponse.role.isSystem, false);
  assert.equal(createdResponse.role.systemRole, null);
  assert.deepEqual(
    store.permissions
      .filter((permission) => permission.accessRoleId === createdResponse.role.id)
      .map((permission) => permission.permissionKey)
      .sort(),
    [PermissionKeys.REPORTS_VIEW_CHAMP, PermissionKeys.REQUESTS_VIEW].sort()
  );
  assert.equal(store.auditRows.at(-1)?.["action"], "ACCESS_ROLE_CREATED");
  assert.equal(refreshRecorder.refreshCount, 1);

  await assert.rejects(
    () =>
      service.createCustomRole(
        {
          key: "system.bad",
          name: "Bad",
          reason: "Reserved key"
        },
        { actorUserId: superAdmin.id }
      ),
    /system prefix/
  );
  await assert.rejects(
    () =>
      service.createCustomRole(
        {
          key: "custom.duplicate.permissions",
          name: "Duplicate Permissions",
          permissionKeys: [PermissionKeys.REQUESTS_VIEW, PermissionKeys.REQUESTS_VIEW],
          reason: "Duplicate permissions"
        },
        { actorUserId: superAdmin.id }
      ),
    /Duplicate permission/
  );
  await assert.rejects(
    () =>
      service.createCustomRole(
        {
          key: "custom.unknown.permission",
          name: "Unknown Permission",
          permissionKeys: ["unknown.permission" as PermissionKey],
          reason: "Unknown permission"
        },
        { actorUserId: superAdmin.id }
      ),
    /Unknown permission/
  );
  await assert.rejects(
    () =>
      service.createCustomRole(
        {
          key: "custom.system.only",
          name: "System Only",
          permissionKeys: [PermissionKeys.ACCESS_CONTROL_VIEW],
          reason: "System only"
        },
        { actorUserId: superAdmin.id }
      ),
    /system-only|not assignable/
  );
  await assert.rejects(
    () =>
      service.createCustomRole(
        {
          key: "custom.not.assignable",
          name: "Not Assignable",
          permissionKeys: [PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES],
          reason: "Not assignable"
        },
        { actorUserId: superAdmin.id }
      ),
    /not assignable|system-only/
  );

  const updatedResponse = await service.updateCustomRoleMetadata(
    customRole.id,
    {
      name: "Ops Viewer Updated",
      description: null,
      reason: "Rename role",
      key: "custom.should.not.change"
    } as never,
    {
      actorUserId: superAdmin.id,
      ipAddress: "127.0.0.1",
      userAgent: "access-control-custom-roles-test"
    }
  );

  assert.equal(updatedResponse.role.name, "Ops Viewer Updated");
  assert.equal(updatedResponse.role.key, "custom.ops.viewer");
  assert.equal(store.auditRows.at(-1)?.["action"], "ACCESS_ROLE_UPDATED");
  assert.equal(refreshRecorder.refreshCount, 2);

  await assert.rejects(
    () =>
      service.updateCustomRoleMetadata(
        systemRole.id,
        { name: "System Rename", reason: "Should fail" },
        { actorUserId: superAdmin.id }
      ),
    /SYSTEM access roles cannot be updated/
  );

  const syncResponse = await service.syncCustomRolePermissions(
    customRole.id,
    {
      permissionKeys: [
        PermissionKeys.REQUESTS_VIEW,
        PermissionKeys.NOTIFICATIONS_VIEW
      ],
      reason: "Replace permission set"
    },
    {
      actorUserId: superAdmin.id,
      ipAddress: "127.0.0.1",
      userAgent: "access-control-custom-roles-test"
    }
  );

  assert.deepEqual(syncResponse.addedPermissionKeys, [
    PermissionKeys.NOTIFICATIONS_VIEW
  ]);
  assert.deepEqual(syncResponse.removedPermissionKeys, [
    PermissionKeys.REPORTS_VIEW_ADMIN
  ]);
  assert.deepEqual(
    store.permissions
      .filter((permission) => permission.accessRoleId === customRole.id)
      .map((permission) => permission.permissionKey)
      .sort(),
    [PermissionKeys.NOTIFICATIONS_VIEW, PermissionKeys.REQUESTS_VIEW].sort()
  );
  assert.equal(
    store.auditRows.at(-1)?.["action"],
    "ACCESS_ROLE_PERMISSIONS_SYNCED"
  );
  assert.equal(refreshRecorder.refreshCount, 3);

  await assert.rejects(
    () =>
      service.syncCustomRolePermissions(
        systemRole.id,
        { permissionKeys: [PermissionKeys.REQUESTS_VIEW], reason: "Should fail" },
        { actorUserId: superAdmin.id }
      ),
    /SYSTEM access role permissions cannot be changed/
  );

  const deactivateResponse = await service.deactivateCustomRole(
    customRole.id,
    { reason: "Retire role", revokeActiveAssignments: true },
    {
      actorUserId: superAdmin.id,
      ipAddress: "127.0.0.1",
      userAgent: "access-control-custom-roles-test"
    }
  );

  assert.equal(deactivateResponse.role.status, AccessRoleStatus.INACTIVE);
  assert.equal(deactivateResponse.revokedAssignmentCount, 1);
  assert.equal(store.assignments[0].status, AccessRoleAssignmentStatus.INACTIVE);
  assert.equal(store.auditRows.at(-1)?.["action"], "ACCESS_ROLE_DEACTIVATED");
  assert.equal(refreshRecorder.refreshCount, 4);

  await assert.rejects(
    () =>
      service.deactivateCustomRole(
        systemRole.id,
        { reason: "Should fail" },
        { actorUserId: superAdmin.id }
      ),
    /SYSTEM access roles cannot be deactivated/
  );
  await assert.rejects(
    () =>
      service.deactivateCustomRole(
        customRole.id,
        { reason: "Already inactive" },
        { actorUserId: superAdmin.id }
      ),
    /already inactive/
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
