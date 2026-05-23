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
  getPermissionsForRole,
  PermissionKeys,
  type PermissionKey
} from "../src/access-control";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedRequest } from "../src/auth/types/authenticated-request";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { UsersController } from "../src/users/users.controller";
import type { UsersService } from "../src/users/users.service";

type UserRow = {
  id: string;
  role: UserRole;
  nameEn: string;
  phoneNumber: string;
  accountStatus: AccountStatus;
  employmentStatus: EmploymentStatus;
};

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
    headers: { "user-agent": "access-control-user-assignments-test" }
  } as AuthenticatedRequest;
}

function user(overrides: Partial<UserRow>): UserRow {
  return {
    id: overrides.id ?? "user-1",
    role: overrides.role ?? UserRole.PICKER,
    nameEn: overrides.nameEn ?? "Target User",
    phoneNumber: overrides.phoneNumber ?? "01000000000",
    accountStatus: overrides.accountStatus ?? AccountStatus.ACTIVE,
    employmentStatus: overrides.employmentStatus ?? EmploymentStatus.ACTIVE
  };
}

function role(overrides: Partial<RoleRow>): RoleRow {
  const now = new Date("2026-05-23T10:00:00.000Z");

  return {
    id: overrides.id ?? "custom-role-1",
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

function permission(accessRoleId: string, permissionKey: string): PermissionRow {
  return {
    id: `${accessRoleId}:${permissionKey}`,
    accessRoleId,
    permissionKey
  };
}

function assignment(overrides: Partial<AssignmentRow>): AssignmentRow {
  const now = new Date("2026-05-23T10:00:00.000Z");

  return {
    id: overrides.id ?? "assignment-1",
    userId: overrides.userId ?? "target-user",
    accessRoleId: overrides.accessRoleId ?? "custom-role-1",
    status: overrides.status ?? AccessRoleAssignmentStatus.ACTIVE,
    startsAt: overrides.startsAt ?? new Date("2026-05-23T09:00:00.000Z"),
    endsAt: overrides.endsAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function createMockPrisma(params: {
  users?: UserRow[];
  roles?: RoleRow[];
  permissions?: PermissionRow[];
  assignments?: AssignmentRow[];
}) {
  const users = params.users ?? [];
  const roles = params.roles ?? [];
  const permissions = params.permissions ?? [];
  const assignments = params.assignments ?? [];
  const auditRows: unknown[] = [];

  function permissionsForRole(accessRoleId: string) {
    return permissions.filter((item) => item.accessRoleId === accessRoleId);
  }

  function decorateRole(accessRole: RoleRow) {
    return {
      ...accessRole,
      permissions: permissionsForRole(accessRole.id),
      _count: { permissions: permissionsForRole(accessRole.id).length }
    };
  }

  function decorateAssignment(accessRoleAssignment: AssignmentRow) {
    const accessRole = roles.find(
      (item) => item.id === accessRoleAssignment.accessRoleId
    );

    return {
      ...accessRoleAssignment,
      accessRole: accessRole ? decorateRole(accessRole) : null
    };
  }

  function matchesAssignmentWhere(
    accessRoleAssignment: AssignmentRow,
    where?: {
      id?: string;
      userId?: string;
      accessRoleId?: string;
      status?: AccessRoleAssignmentStatus;
      startsAt?: { lte?: Date };
      OR?: readonly ({ endsAt: null } | { endsAt: { gt?: Date } })[];
      accessRole?: {
        kind?: AccessRoleKind;
        status?: AccessRoleStatus;
        isSystem?: boolean;
      };
    }
  ) {
    if (!where) {
      return true;
    }

    if (where.id && accessRoleAssignment.id !== where.id) {
      return false;
    }

    if (where.userId && accessRoleAssignment.userId !== where.userId) {
      return false;
    }

    if (
      where.accessRoleId &&
      accessRoleAssignment.accessRoleId !== where.accessRoleId
    ) {
      return false;
    }

    if (where.status && accessRoleAssignment.status !== where.status) {
      return false;
    }

    if (
      where.startsAt?.lte &&
      accessRoleAssignment.startsAt > where.startsAt.lte
    ) {
      return false;
    }

    if (where.OR?.length) {
      const now = where.OR.find(
        (condition): condition is { endsAt: { gt?: Date } } =>
          typeof condition.endsAt === "object" &&
          condition.endsAt !== null &&
          "gt" in condition.endsAt
      )?.endsAt.gt;

      if (
        !where.OR.some((condition) => condition.endsAt === null) &&
        accessRoleAssignment.endsAt === null
      ) {
        return false;
      }

      if (
        accessRoleAssignment.endsAt &&
        now &&
        accessRoleAssignment.endsAt <= now
      ) {
        return false;
      }
    }

    if (where.accessRole) {
      const accessRole = roles.find(
        (item) => item.id === accessRoleAssignment.accessRoleId
      );

      if (!accessRole) {
        return false;
      }

      if (where.accessRole.kind && accessRole.kind !== where.accessRole.kind) {
        return false;
      }

      if (
        where.accessRole.status &&
        accessRole.status !== where.accessRole.status
      ) {
        return false;
      }

      if (
        where.accessRole.isSystem !== undefined &&
        accessRole.isSystem !== where.accessRole.isSystem
      ) {
        return false;
      }
    }

    return true;
  }

  const prisma = {
    $transaction: async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((item) => item.id === where.id) ?? null
    },
    accessRole: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const accessRole = roles.find((item) => item.id === where.id);
        return accessRole ? decorateRole(accessRole) : null;
      }
    },
    userAccessRoleAssignment: {
      findMany: async ({
        where
      }: {
        where?: Parameters<typeof matchesAssignmentWhere>[1];
      }) =>
        assignments
          .filter((item) => matchesAssignmentWhere(item, where))
          .map(decorateAssignment)
          .filter((item) => item.accessRole),
      findFirst: async ({
        where
      }: {
        where: Parameters<typeof matchesAssignmentWhere>[1];
      }) => {
        const accessRoleAssignment = assignments.find((item) =>
          matchesAssignmentWhere(item, where)
        );
        return accessRoleAssignment
          ? decorateAssignment(accessRoleAssignment)
          : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const accessRoleAssignment = assignments.find(
          (item) => item.id === where.id
        );
        return accessRoleAssignment
          ? decorateAssignment(accessRoleAssignment)
          : null;
      },
      create: async ({
        data
      }: {
        data: {
          userId: string;
          accessRoleId: string;
          status: AccessRoleAssignmentStatus;
          startsAt: Date;
          endsAt: Date | null;
        };
      }) => {
        const created = assignment({
          id: `assignment-${assignments.length + 1}`,
          ...data,
          createdAt: new Date("2026-05-23T11:00:00.000Z"),
          updatedAt: new Date("2026-05-23T11:00:00.000Z")
        });
        assignments.push(created);
        return decorateAssignment(created);
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<AssignmentRow>;
      }) => {
        const current = assignments.find((item) => item.id === where.id);

        if (!current) {
          throw new Error("assignment missing");
        }

        Object.assign(current, data, {
          updatedAt: new Date("2026-05-23T12:00:00.000Z")
        });

        return decorateAssignment(current);
      }
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        auditRows.push(data);
        return data;
      }
    }
  };

  return { prisma, users, roles, permissions, assignments, auditRows };
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

function usersServiceStub() {
  return {
    getFoundationStatus: () => ({ module: "users" })
  } as unknown as UsersService;
}

async function main() {
  const superAdmin = actor(UserRole.SUPER_ADMIN);
  const admin = actor(UserRole.ADMIN);
  const request = requestFor(superAdmin);
  const policyRecorder = createPolicyRecorder();
  const serviceCalls: string[] = [];
  const assignmentService = {
    listUserAccessRoleAssignments: async (userId: string) => {
      serviceCalls.push(`list:${userId}`);
      return { user: { id: userId }, assignments: [] };
    },
    assignCustomAccessRoleToUser: async (userId: string, dto: unknown) => {
      serviceCalls.push(`assign:${userId}:${JSON.stringify(dto)}`);
      return { assignment: { userId } };
    },
    revokeUserAccessRoleAssignment: async (
      userId: string,
      assignmentId: string,
      dto: unknown
    ) => {
      serviceCalls.push(`revoke:${userId}:${assignmentId}:${JSON.stringify(dto)}`);
      return { assignment: { id: assignmentId, userId } };
    },
    getUserEffectivePermissions: async (userId: string) => {
      serviceCalls.push(`effective:${userId}`);
      return { user: { id: userId }, effectivePermissions: [] };
    }
  } as AccessRoleAssignmentService;
  const usersController = new UsersController(
    usersServiceStub(),
    policyRecorder.policy,
    assignmentService
  );
  const accessControlController = new AccessControlController(
    policyRecorder.policy,
    {} as AccessRoleService,
    assignmentService
  );

  assert.deepEqual(
    Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype["listAccessRoleAssignments"]
    ),
    [UserRole.SUPER_ADMIN]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype["assignCustomAccessRole"]
    ),
    [UserRole.SUPER_ADMIN]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype["revokeCustomAccessRoleAssignment"]
    ),
    [UserRole.SUPER_ADMIN]
  );
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AccessControlController), [
    UserRole.SUPER_ADMIN
  ]);

  await usersController.listAccessRoleAssignments("target-user", superAdmin);
  await usersController.assignCustomAccessRole(
    "target-user",
    {
      accessRoleId: "custom-role-1",
      reason: "Assign role"
    },
    superAdmin,
    request
  );
  await usersController.revokeCustomAccessRoleAssignment(
    "target-user",
    "assignment-1",
    { reason: "Revoke role" },
    superAdmin,
    request
  );
  await accessControlController.getUserEffectivePermissions(
    "target-user",
    request
  );

  assert.deepEqual(policyRecorder.calls, [
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_REVOKE_CUSTOM_ROLES
    },
    {
      actor: superAdmin,
      permissionKey: PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS
    }
  ]);
  assert.deepEqual(serviceCalls, [
    "list:target-user",
    `assign:target-user:${JSON.stringify({
      accessRoleId: "custom-role-1",
      reason: "Assign role"
    })}`,
    `revoke:target-user:assignment-1:${JSON.stringify({ reason: "Revoke role" })}`,
    "effective:target-user"
  ]);

  const realPolicyUsersController = new UsersController(
    usersServiceStub(),
    new AccessPolicyService(),
    assignmentService
  );
  assert.throws(
    () => realPolicyUsersController.listAccessRoleAssignments("target-user", admin),
    /Missing required permission/
  );
  assert.equal(
    new AccessPolicyService().can(
      admin,
      PermissionKeys.ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES
    ),
    false
  );
  assert.equal(
    new AccessPolicyService().can(
      admin,
      PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS
    ),
    false
  );

  const activeUser = user({ id: "target-user", role: UserRole.PICKER });
  const inactiveUser = user({
    id: "inactive-user",
    accountStatus: AccountStatus.INACTIVE
  });
  const customRole = role({
    id: "custom-role-1",
    key: "custom.branch.viewer",
    name: "Branch Viewer"
  });
  const assignableCustomRole = role({
    id: "custom-role-2",
    key: "custom.temporary.viewer",
    name: "Temporary Viewer"
  });
  const dateValidationRole = role({
    id: "custom-role-3",
    key: "custom.date.validation",
    name: "Date Validation"
  });
  const inactiveCustomRole = role({
    id: "inactive-custom-role",
    key: "custom.inactive",
    status: AccessRoleStatus.INACTIVE
  });
  const systemRole = role({
    id: "system-role-1",
    key: "system.admin",
    kind: AccessRoleKind.SYSTEM,
    status: AccessRoleStatus.ACTIVE,
    isSystem: true,
    systemRole: UserRole.ADMIN
  });
  const expiredAssignment = assignment({
    id: "expired-assignment",
    userId: activeUser.id,
    accessRoleId: customRole.id,
    startsAt: new Date("2026-05-22T08:00:00.000Z"),
    endsAt: new Date("2026-05-22T09:00:00.000Z")
  });
  const futureAssignment = assignment({
    id: "future-assignment",
    userId: activeUser.id,
    accessRoleId: customRole.id,
    startsAt: new Date("2026-05-24T08:00:00.000Z"),
    endsAt: null
  });
  const inactiveAssignment = assignment({
    id: "inactive-assignment",
    userId: activeUser.id,
    accessRoleId: customRole.id,
    status: AccessRoleAssignmentStatus.INACTIVE
  });
  const activeAssignment = assignment({
    id: "active-assignment",
    userId: activeUser.id,
    accessRoleId: customRole.id
  });
  const otherUserAssignment = assignment({
    id: "other-user-assignment",
    userId: "other-user",
    accessRoleId: customRole.id
  });
  const systemAssignment = assignment({
    id: "system-assignment",
    userId: activeUser.id,
    accessRoleId: systemRole.id
  });
  const inactiveRoleAssignment = assignment({
    id: "inactive-role-assignment",
    userId: activeUser.id,
    accessRoleId: inactiveCustomRole.id
  });
  const store = createMockPrisma({
    users: [activeUser, inactiveUser, user({ id: "other-user" })],
    roles: [
      customRole,
      assignableCustomRole,
      dateValidationRole,
      inactiveCustomRole,
      systemRole
    ],
    permissions: [
      permission(customRole.id, PermissionKeys.REQUESTS_VIEW),
      permission(customRole.id, PermissionKeys.REPORTS_VIEW_ADMIN),
      permission(customRole.id, "unknown.permission"),
      permission(customRole.id, PermissionKeys.ACCESS_CONTROL_VIEW),
      permission(assignableCustomRole.id, PermissionKeys.REQUESTS_VIEW),
      permission(assignableCustomRole.id, PermissionKeys.REPORTS_VIEW_ADMIN),
      permission(assignableCustomRole.id, "unknown.permission"),
      permission(assignableCustomRole.id, PermissionKeys.ACCESS_CONTROL_VIEW),
      permission(inactiveCustomRole.id, PermissionKeys.NOTIFICATIONS_VIEW),
      permission(systemRole.id, PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES)
    ],
    assignments: [
      expiredAssignment,
      futureAssignment,
      inactiveAssignment,
      activeAssignment,
      otherUserAssignment,
      systemAssignment,
      inactiveRoleAssignment
    ]
  });
  const refreshRecorder = createRefreshRecorder();
  const service = new AccessRoleAssignmentService(
    store.prisma as never,
    refreshRecorder.policy
  );

  const listResponse = await service.listUserAccessRoleAssignments(activeUser.id);

  assert.equal(listResponse.user.id, activeUser.id);
  assert.deepEqual(
    listResponse.assignments.map((item) => item.id).sort(),
    [
      activeAssignment.id,
      expiredAssignment.id,
      futureAssignment.id,
      inactiveAssignment.id,
      inactiveRoleAssignment.id
    ].sort()
  );
  assert.ok(
    listResponse.assignments.every(
      (item) => item.accessRole.kind === AccessRoleKind.CUSTOM
    )
  );

  const assigned = await service.assignCustomAccessRoleToUser(
    activeUser.id,
    {
      accessRoleId: assignableCustomRole.id,
      startsAt: "2026-05-22T12:00:00.000Z",
      endsAt: "2026-05-24T12:00:00.000Z",
      reason: "Grant temporary visibility"
    },
    {
      actorUserId: superAdmin.id,
      ipAddress: "127.0.0.1",
      userAgent: "access-control-user-assignments-test"
    }
  );

  assert.equal(assigned.assignment.userId, activeUser.id);
  assert.equal(assigned.assignment.status, AccessRoleAssignmentStatus.ACTIVE);
  assert.equal(store.auditRows.at(-1)?.["action"], "USER_ACCESS_ROLE_ASSIGNED");
  assert.equal(refreshRecorder.refreshCount, 1);

  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        "missing-user",
        { accessRoleId: customRole.id, reason: "Missing user" },
        { actorUserId: superAdmin.id }
      ),
    /User was not found/
  );
  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        inactiveUser.id,
        { accessRoleId: customRole.id, reason: "Inactive user" },
        { actorUserId: superAdmin.id }
      ),
    /Target user must be active/
  );
  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        activeUser.id,
        { accessRoleId: "missing-role", reason: "Missing role" },
        { actorUserId: superAdmin.id }
      ),
    /Access role was not found/
  );
  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        activeUser.id,
        { accessRoleId: systemRole.id, reason: "System role" },
        { actorUserId: superAdmin.id }
      ),
    /SYSTEM access roles cannot be assigned/
  );
  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        activeUser.id,
        { accessRoleId: inactiveCustomRole.id, reason: "Inactive role" },
        { actorUserId: superAdmin.id }
      ),
    /active CUSTOM access roles/
  );
  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        activeUser.id,
        {
          accessRoleId: dateValidationRole.id,
          startsAt: "2026-05-24T12:00:00.000Z",
          endsAt: "2026-05-23T12:00:00.000Z",
          reason: "Invalid dates"
        },
        { actorUserId: superAdmin.id }
      ),
    /endsAt must be after startsAt/
  );
  await assert.rejects(
    () =>
      service.assignCustomAccessRoleToUser(
        activeUser.id,
        { accessRoleId: assignableCustomRole.id, reason: "Duplicate" },
        { actorUserId: superAdmin.id }
      ),
    /already has an active assignment/
  );

  const revoked = await service.revokeUserAccessRoleAssignment(
    activeUser.id,
    activeAssignment.id,
    { reason: "Remove visibility" },
    {
      actorUserId: superAdmin.id,
      ipAddress: "127.0.0.1",
      userAgent: "access-control-user-assignments-test"
    }
  );

  assert.equal(revoked.assignment.status, AccessRoleAssignmentStatus.INACTIVE);
  assert.equal(revoked.assignment.endsAt instanceof Date, true);
  assert.equal(store.auditRows.at(-1)?.["action"], "USER_ACCESS_ROLE_REVOKED");
  assert.equal(refreshRecorder.refreshCount, 2);

  await assert.rejects(
    () =>
      service.revokeUserAccessRoleAssignment(
        "missing-user",
        assigned.assignment.id,
        { reason: "Missing user" },
        { actorUserId: superAdmin.id }
      ),
    /User was not found/
  );
  await assert.rejects(
    () =>
      service.revokeUserAccessRoleAssignment(
        activeUser.id,
        "missing-assignment",
        { reason: "Missing assignment" },
        { actorUserId: superAdmin.id }
      ),
    /assignment was not found/
  );
  await assert.rejects(
    () =>
      service.revokeUserAccessRoleAssignment(
        activeUser.id,
        otherUserAssignment.id,
        { reason: "Wrong user" },
        { actorUserId: superAdmin.id }
      ),
    /does not belong to this user/
  );
  await assert.rejects(
    () =>
      service.revokeUserAccessRoleAssignment(
        activeUser.id,
        inactiveAssignment.id,
        { reason: "Inactive assignment" },
        { actorUserId: superAdmin.id }
      ),
    /Only active custom access-role assignments can be revoked/
  );
  await assert.rejects(
    () =>
      service.revokeUserAccessRoleAssignment(
        activeUser.id,
        systemAssignment.id,
        { reason: "System assignment" },
        { actorUserId: superAdmin.id }
      ),
    /SYSTEM access-role assignments cannot be revoked/
  );

  const effective = await service.getUserEffectivePermissions(activeUser.id, {
    actorUserId: superAdmin.id,
    ipAddress: "127.0.0.1",
    userAgent: "access-control-user-assignments-test"
  });

  assert.equal(effective.user.id, activeUser.id);
  assert.deepEqual(
    effective.baseRole.permissions.map((item) => item.key).sort(),
    [...getPermissionsForRole(UserRole.PICKER)].sort()
  );
  assert.equal(
    effective.customAssignments.some(
      (item) => item.assignmentId === assigned.assignment.id
    ),
    true
  );
  assert.equal(
    effective.customAssignments.some(
      (item) => item.assignmentId === expiredAssignment.id
    ),
    false
  );
  assert.equal(
    effective.customAssignments.some(
      (item) => item.assignmentId === futureAssignment.id
    ),
    false
  );
  assert.equal(
    effective.customAssignments.some(
      (item) => item.assignmentId === inactiveRoleAssignment.id
    ),
    false
  );

  const requestView = effective.effectivePermissions.find(
    (item) => item.key === PermissionKeys.REQUESTS_VIEW
  );
  assert.ok(requestView);
  assert.equal(
    requestView.sources.some((source) => source.type === "BASE_ROLE"),
    true
  );
  assert.equal(
    requestView.sources.some(
      (source) => source.type === "CUSTOM_ACCESS_ROLE"
    ),
    true
  );
  assert.ok(
    effective.effectivePermissions.find(
      (item) => item.key === PermissionKeys.REPORTS_VIEW_ADMIN
    )
  );
  assert.equal(
    effective.effectivePermissions.some(
      (item) => item.key === "unknown.permission"
    ),
    false
  );
  assert.equal(
    effective.effectivePermissions.some(
      (item) => item.key === PermissionKeys.ACCESS_CONTROL_VIEW
    ),
    false
  );
  assert.ok(
    effective.warnings.some((warning) =>
      warning.includes("Unknown permission unknown.permission")
    )
  );
  assert.ok(
    effective.warnings.some((warning) =>
      warning.includes("System-only permission access_control.view")
    )
  );
  assert.equal(
    store.auditRows.at(-1)?.["action"],
    "USER_EFFECTIVE_PERMISSIONS_VIEWED"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
