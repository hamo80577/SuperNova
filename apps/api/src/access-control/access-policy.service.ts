import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  Optional
} from "@nestjs/common";
import { AccessRoleKind, AccessRoleStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { roleHasPermission } from "./role-permission.matrix";
import type {
  AccessPolicyActor,
  AccessPolicyContext
} from "./access-policy.types";
import {
  PERMISSION_DEFINITION_BY_KEY,
  type PermissionKey
} from "./permissions";

type DbSystemRolePermissions = Partial<Record<UserRole, ReadonlySet<PermissionKey>>>;

type DbSystemAccessRoleRow = Readonly<{
  systemRole: UserRole | null;
  permissions: readonly Readonly<{ permissionKey: string }>[];
}>;

@Injectable()
export class AccessPolicyService implements OnModuleInit {
  private readonly logger = new Logger(AccessPolicyService.name);
  private dbSystemRolePermissions: DbSystemRolePermissions | null = null;
  private dbPermissionCacheReady = false;
  private dbPermissionCacheError: string | null = null;

  constructor(
    @Optional() private readonly prisma: PrismaService | undefined = undefined
  ) {}

  async onModuleInit() {
    await this.loadDbSystemRolePermissionCache();
  }

  hasPermission(
    actor: AccessPolicyActor,
    permissionKey: PermissionKey
  ): boolean {
    const dbPermissions = this.dbPermissionCacheReady
      ? this.dbSystemRolePermissions?.[actor.role]
      : undefined;

    if (dbPermissions) {
      return dbPermissions.has(permissionKey);
    }

    return roleHasPermission(actor.role, permissionKey);
  }

  can(
    actor: AccessPolicyActor,
    permissionKey: PermissionKey,
    context?: AccessPolicyContext
  ): boolean {
    void context;
    return this.hasPermission(actor, permissionKey);
  }

  assertCan(
    actor: AccessPolicyActor,
    permissionKey: PermissionKey,
    context?: AccessPolicyContext
  ): void {
    if (!this.can(actor, permissionKey, context)) {
      throw new ForbiddenException("Missing required permission.");
    }
  }

  private async loadDbSystemRolePermissionCache() {
    if (!this.prisma) {
      return;
    }

    try {
      const accessRoles = (await this.prisma.accessRole.findMany({
        where: {
          kind: AccessRoleKind.SYSTEM,
          status: AccessRoleStatus.ACTIVE,
          isSystem: true,
          systemRole: { not: null }
        },
        select: {
          systemRole: true,
          permissions: {
            select: { permissionKey: true }
          }
        }
      })) as DbSystemAccessRoleRow[];

      const cache = this.buildValidatedDbSystemRolePermissionCache(accessRoles);

      this.dbSystemRolePermissions = cache;
      this.dbPermissionCacheReady = true;
      this.dbPermissionCacheError = null;
    } catch (error) {
      this.dbSystemRolePermissions = null;
      this.dbPermissionCacheReady = false;
      this.dbPermissionCacheError =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Using code permission matrix fallback: ${this.dbPermissionCacheError}`
      );
    }
  }

  private buildValidatedDbSystemRolePermissionCache(
    accessRoles: readonly DbSystemAccessRoleRow[]
  ): DbSystemRolePermissions {
    if (accessRoles.length === 0) {
      throw new Error("No active SYSTEM access roles found.");
    }

    const systemRoles = Object.values(UserRole);
    const systemRoleSet = new Set<string>(systemRoles);
    const permissionsByRole: Partial<Record<UserRole, Set<PermissionKey>>> = {};

    for (const accessRole of accessRoles) {
      if (!accessRole.systemRole) {
        throw new Error("SYSTEM access role row is missing systemRole.");
      }

      if (!systemRoleSet.has(accessRole.systemRole)) {
        throw new Error(
          `Unknown SYSTEM access role systemRole ${accessRole.systemRole}.`
        );
      }

      if (permissionsByRole[accessRole.systemRole]) {
        throw new Error(
          `Duplicate SYSTEM access role row for ${accessRole.systemRole}.`
        );
      }

      const permissionSet = new Set<PermissionKey>();

      for (const permission of accessRole.permissions) {
        const permissionKey = permission.permissionKey as PermissionKey;

        if (!PERMISSION_DEFINITION_BY_KEY[permissionKey]) {
          throw new Error(
            `Unknown permission ${permission.permissionKey} in SYSTEM access role ${accessRole.systemRole}.`
          );
        }

        permissionSet.add(permissionKey);
      }

      permissionsByRole[accessRole.systemRole] = permissionSet;
    }

    for (const role of systemRoles) {
      if (!permissionsByRole[role]) {
        throw new Error(`Missing SYSTEM access role row for ${role}.`);
      }
    }

    return permissionsByRole;
  }
}
