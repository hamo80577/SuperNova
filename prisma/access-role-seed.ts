import {
  AccessRoleKind,
  AccessRoleStatus,
  type Prisma,
  type PrismaClient,
  UserRole
} from "@prisma/client";

import {
  assertValidSystemRolePermissionMatrix,
  SYSTEM_ROLE_PERMISSIONS
} from "../apps/api/src/access-control/role-permission.matrix";
import type { PermissionKey } from "../apps/api/src/access-control/permissions";

export type SystemAccessRoleDefinition = Readonly<{
  systemRole: UserRole;
  key: string;
  name: string;
  description: string;
}>;

export type SystemAccessRoleSyncResult = Readonly<{
  roleCount: number;
  permissionCount: number;
}>;

export const SYSTEM_ACCESS_ROLE_DEFINITIONS = [
  {
    systemRole: UserRole.PICKER,
    key: "system.picker",
    name: "Picker",
    description: "System access role for Picker users."
  },
  {
    systemRole: UserRole.CHAMP,
    key: "system.champ",
    name: "Champ",
    description: "System access role for Champ users."
  },
  {
    systemRole: UserRole.AREA_MANAGER,
    key: "system.area_manager",
    name: "Area Manager",
    description: "System access role for Area Manager users."
  },
  {
    systemRole: UserRole.ADMIN,
    key: "system.admin",
    name: "Admin",
    description: "System access role for operational Admin users."
  },
  {
    systemRole: UserRole.SUPER_ADMIN,
    key: "system.super_admin",
    name: "Super Admin",
    description: "System access role for Super Admin system owners."
  }
] as const satisfies readonly SystemAccessRoleDefinition[];

export function assertValidSystemAccessRoleDefinitions() {
  assertValidSystemRolePermissionMatrix();

  const definitionsByRole = new Map(
    SYSTEM_ACCESS_ROLE_DEFINITIONS.map((definition) => [
      definition.systemRole,
      definition
    ])
  );
  const definitionKeys = SYSTEM_ACCESS_ROLE_DEFINITIONS.map(
    (definition) => definition.key
  );
  const definitionRoles = SYSTEM_ACCESS_ROLE_DEFINITIONS.map(
    (definition) => definition.systemRole
  );

  if (new Set(definitionKeys).size !== definitionKeys.length) {
    throw new Error("Duplicate system access role keys found.");
  }

  if (new Set(definitionRoles).size !== definitionRoles.length) {
    throw new Error("Duplicate system access role UserRole values found.");
  }

  for (const role of Object.values(UserRole)) {
    if (!definitionsByRole.has(role)) {
      throw new Error(`Missing system access role definition for ${role}.`);
    }
  }

  for (const role of Object.keys(SYSTEM_ROLE_PERMISSIONS) as UserRole[]) {
    if (!definitionsByRole.has(role)) {
      throw new Error(
        `Missing system access role definition for matrix role ${role}.`
      );
    }
  }
}

export async function syncSystemAccessRoles(
  prisma: PrismaClient
): Promise<SystemAccessRoleSyncResult> {
  assertValidSystemAccessRoleDefinitions();

  return prisma.$transaction(async (tx) => {
    let permissionCount = 0;

    for (const definition of SYSTEM_ACCESS_ROLE_DEFINITIONS) {
      const permissions = SYSTEM_ROLE_PERMISSIONS[definition.systemRole];
      const accessRole = await tx.accessRole.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          description: definition.description,
          kind: AccessRoleKind.SYSTEM,
          systemRole: definition.systemRole,
          status: AccessRoleStatus.ACTIVE,
          isSystem: true
        },
        create: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          kind: AccessRoleKind.SYSTEM,
          systemRole: definition.systemRole,
          status: AccessRoleStatus.ACTIVE,
          isSystem: true
        }
      });

      await syncSystemAccessRolePermissions(tx, accessRole.id, permissions);
      permissionCount += permissions.length;
    }

    return {
      roleCount: SYSTEM_ACCESS_ROLE_DEFINITIONS.length,
      permissionCount
    };
  });
}

async function syncSystemAccessRolePermissions(
  tx: Prisma.TransactionClient,
  accessRoleId: string,
  permissions: readonly PermissionKey[]
) {
  const existingPermissions = await tx.accessRolePermission.findMany({
    where: { accessRoleId },
    select: { permissionKey: true }
  });
  const desiredPermissionKeys = new Set<string>(permissions);
  const existingPermissionKeys = new Set(
    existingPermissions.map((permission) => permission.permissionKey)
  );
  const missingPermissions = permissions.filter(
    (permissionKey) => !existingPermissionKeys.has(permissionKey)
  );
  const stalePermissions = existingPermissions
    .map((permission) => permission.permissionKey)
    .filter((permissionKey) => !desiredPermissionKeys.has(permissionKey));

  if (missingPermissions.length > 0) {
    await tx.accessRolePermission.createMany({
      data: missingPermissions.map((permissionKey) => ({
        accessRoleId,
        permissionKey
      })),
      skipDuplicates: true
    });
  }

  if (stalePermissions.length > 0) {
    await tx.accessRolePermission.deleteMany({
      where: {
        accessRoleId,
        permissionKey: { in: stalePermissions }
      }
    });
  }
}
