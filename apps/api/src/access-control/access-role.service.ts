import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  AccessRole,
  AccessRoleAssignmentStatus,
  AccessRoleKind,
  AccessRolePermission,
  AccessRoleStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AccessPolicyService } from "./access-policy.service";
import type {
  CreateCustomAccessRoleDto,
  DeactivateCustomAccessRoleDto,
  ListAccessRolesQueryDto,
  SyncCustomAccessRolePermissionsDto,
  UpdateCustomAccessRoleDto
} from "./dto/access-role.dto";
import {
  PERMISSION_DEFINITION_BY_KEY,
  PermissionRiskLevels,
  type PermissionDefinition,
  type PermissionKey
} from "./permissions";

const MAX_PAGE_SIZE = 100;
const RESERVED_SYSTEM_ROLE_PREFIX = "system.";

type AccessRoleMutationContext = Readonly<{
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

type AccessRoleWithCounts = AccessRole & {
  permissions?: AccessRolePermission[];
  _count: {
    permissions: number;
    userAssignments: number;
  };
};

@Injectable()
export class AccessRoleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  async listRoles(query: ListAccessRolesQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = this.buildRoleWhere(query);

    const [total, items] = await Promise.all([
      this.prisma.accessRole.count({ where }),
      this.prisma.accessRole.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.roleCountInclude()
      })
    ]);

    return {
      items: items.map((role) => this.toRoleListItem(role)),
      total,
      page,
      pageSize
    };
  }

  async getRole(id: string) {
    const role = await this.findRoleWithPermissions(id);

    return {
      role: this.toRoleDetail(role)
    };
  }

  async createCustomRole(
    dto: CreateCustomAccessRoleDto,
    context: AccessRoleMutationContext
  ) {
    const key = this.normalizeKey(dto.key);
    const name = this.normalizeRequiredText(dto.name, "Role name");
    const description = this.normalizeDescription(dto.description);
    const reason = this.normalizeReason(dto.reason);
    const permissionKeys = this.validateCustomRolePermissionKeys(
      dto.permissionKeys ?? []
    );

    await this.ensureKeyAvailable(key);

    const result = await this.prisma.$transaction(async (tx) => {
      const role = await tx.accessRole.create({
        data: {
          key,
          name,
          description,
          kind: AccessRoleKind.CUSTOM,
          status: AccessRoleStatus.ACTIVE,
          isSystem: false,
          systemRole: null
        }
      });

      if (permissionKeys.length > 0) {
        await tx.accessRolePermission.createMany({
          data: permissionKeys.map((permissionKey) => ({
            accessRoleId: role.id,
            permissionKey
          })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "ACCESS_ROLE_CREATED",
          entityType: "AccessRole",
          entityId: role.id,
          oldValue: Prisma.JsonNull,
          newValue: this.toAuditJson({
            role: this.toRoleAuditValue(role),
            permissionKeys,
            permissionRiskSummary:
              this.buildPermissionRiskSummary(permissionKeys),
            reason
          }),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return {
        role: this.toRoleDetail({
          ...role,
          permissions: permissionKeys.map((permissionKey) => ({
            id: `${role.id}:${permissionKey}`,
            accessRoleId: role.id,
            permissionKey,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt
          })),
          _count: {
            permissions: permissionKeys.length,
            userAssignments: 0
          }
        })
      };
    });

    await this.refreshPermissionCachesAfterMutation();

    return result;
  }

  async updateCustomRoleMetadata(
    id: string,
    dto: UpdateCustomAccessRoleDto,
    context: AccessRoleMutationContext
  ) {
    const current = await this.findCustomRoleOrThrow(
      id,
      "SYSTEM access roles cannot be updated."
    );
    const reason = this.normalizeReason(dto.reason);
    const data: Prisma.AccessRoleUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = this.normalizeRequiredText(dto.name, "Role name");
    }

    if (dto.description !== undefined) {
      data.description = this.normalizeDescription(dto.description);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        "At least one custom role metadata field is required."
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.accessRole.update({
        where: { id },
        data,
        include: this.roleCountInclude()
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "ACCESS_ROLE_UPDATED",
          entityType: "AccessRole",
          entityId: id,
          oldValue: this.toAuditJson({
            name: current.name,
            description: current.description,
            reason
          }),
          newValue: this.toAuditJson({
            name: updated.name,
            description: updated.description,
            reason
          }),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return {
        role: this.toRoleListItem(updated)
      };
    });

    await this.refreshPermissionCachesAfterMutation();

    return result;
  }

  async deactivateCustomRole(
    id: string,
    dto: DeactivateCustomAccessRoleDto,
    context: AccessRoleMutationContext
  ) {
    const current = await this.findCustomRoleOrThrow(
      id,
      "SYSTEM access roles cannot be deactivated."
    );
    const reason = this.normalizeReason(dto.reason);
    const revokeActiveAssignments = dto.revokeActiveAssignments === true;

    if (current.status === AccessRoleStatus.INACTIVE) {
      throw new BadRequestException("Custom access role is already inactive.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const activeAssignmentCount = await tx.userAccessRoleAssignment.count({
        where: {
          accessRoleId: id,
          status: AccessRoleAssignmentStatus.ACTIVE
        }
      });
      const updated = await tx.accessRole.update({
        where: { id },
        data: { status: AccessRoleStatus.INACTIVE },
        include: this.roleCountInclude()
      });
      const revokedAssignments = revokeActiveAssignments
        ? await tx.userAccessRoleAssignment.updateMany({
            where: {
              accessRoleId: id,
              status: AccessRoleAssignmentStatus.ACTIVE
            },
            data: {
              status: AccessRoleAssignmentStatus.INACTIVE,
              endsAt: new Date()
            }
          })
        : { count: 0 };

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "ACCESS_ROLE_DEACTIVATED",
          entityType: "AccessRole",
          entityId: id,
          oldValue: this.toAuditJson({
            status: current.status,
            activeAssignmentCount,
            reason
          }),
          newValue: this.toAuditJson({
            status: updated.status,
            revokeActiveAssignments,
            revokedAssignmentCount: revokedAssignments.count,
            reason
          }),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return {
        role: this.toRoleListItem(updated),
        revokedAssignmentCount: revokedAssignments.count
      };
    });

    await this.refreshPermissionCachesAfterMutation();

    return result;
  }

  async syncCustomRolePermissions(
    id: string,
    dto: SyncCustomAccessRolePermissionsDto,
    context: AccessRoleMutationContext
  ) {
    const current = await this.findCustomRoleOrThrow(
      id,
      "SYSTEM access role permissions cannot be changed."
    );
    const reason = this.normalizeReason(dto.reason);
    const permissionKeys = this.validateCustomRolePermissionKeys(
      dto.permissionKeys
    );
    const previousPermissionKeys = this.sortedPermissionKeys(
      current.permissions?.map((permission) => permission.permissionKey) ?? []
    );
    const nextPermissionKeys = this.sortedPermissionKeys(permissionKeys);
    const addedPermissionKeys = nextPermissionKeys.filter(
      (permissionKey) => !previousPermissionKeys.includes(permissionKey)
    );
    const removedPermissionKeys = previousPermissionKeys.filter(
      (permissionKey) => !nextPermissionKeys.includes(permissionKey)
    );

    const result = await this.prisma.$transaction(async (tx) => {
      if (removedPermissionKeys.length > 0) {
        await tx.accessRolePermission.deleteMany({
          where: {
            accessRoleId: id,
            permissionKey: { in: removedPermissionKeys }
          }
        });
      }

      if (addedPermissionKeys.length > 0) {
        await tx.accessRolePermission.createMany({
          data: addedPermissionKeys.map((permissionKey) => ({
            accessRoleId: id,
            permissionKey
          })),
          skipDuplicates: true
        });
      }

      const updated = await tx.accessRole.update({
        where: { id },
        data: { updatedAt: new Date() },
        include: this.roleCountInclude()
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "ACCESS_ROLE_PERMISSIONS_SYNCED",
          entityType: "AccessRole",
          entityId: id,
          oldValue: this.toAuditJson({
            permissionKeys: previousPermissionKeys,
            reason
          }),
          newValue: this.toAuditJson({
            permissionKeys: nextPermissionKeys,
            addedPermissionKeys,
            removedPermissionKeys,
            permissionRiskSummary:
              this.buildPermissionRiskSummary(nextPermissionKeys),
            reason
          }),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return {
        role: {
          ...this.toRoleListItem(updated),
          permissions: nextPermissionKeys
        },
        addedPermissionKeys,
        removedPermissionKeys
      };
    });

    await this.refreshPermissionCachesAfterMutation();

    return result;
  }

  private buildRoleWhere(
    query: ListAccessRolesQueryDto
  ): Prisma.AccessRoleWhereInput {
    const search = query.search?.trim();

    return {
      kind: query.kind,
      status: query.status,
      ...(search
        ? {
            OR: [
              { key: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private roleCountInclude() {
    return {
      _count: {
        select: {
          permissions: true,
          userAssignments: {
            where: { status: AccessRoleAssignmentStatus.ACTIVE }
          }
        }
      }
    } satisfies Prisma.AccessRoleInclude;
  }

  private async findRoleWithPermissions(id: string) {
    const role = await this.prisma.accessRole.findUnique({
      where: { id },
      include: {
        permissions: { orderBy: { permissionKey: "asc" } },
        ...this.roleCountInclude()
      }
    });

    if (!role) {
      throw new NotFoundException("Access role was not found.");
    }

    return role;
  }

  private async findCustomRoleOrThrow(id: string, systemRoleMessage: string) {
    const role = await this.findRoleWithPermissions(id);

    if (role.kind !== AccessRoleKind.CUSTOM || role.isSystem || role.systemRole) {
      throw new BadRequestException(systemRoleMessage);
    }

    return role;
  }

  private async ensureKeyAvailable(key: string) {
    const existing = await this.prisma.accessRole.findUnique({
      where: { key },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException("Access role key already exists.");
    }
  }

  private validateCustomRolePermissionKeys(
    permissionKeys: unknown
  ): PermissionKey[] {
    if (!Array.isArray(permissionKeys)) {
      throw new BadRequestException(
        "permissionKeys must be an array of permission key strings."
      );
    }

    const normalizedPermissionKeys = permissionKeys.map((permissionKey) => {
      if (typeof permissionKey !== "string" || !permissionKey.trim()) {
        throw new BadRequestException(
          "permissionKeys must contain non-empty strings."
        );
      }

      return permissionKey.trim();
    });

    if (
      new Set(normalizedPermissionKeys).size !== normalizedPermissionKeys.length
    ) {
      throw new BadRequestException("Duplicate permission keys are not allowed.");
    }

    return normalizedPermissionKeys.map((permissionKey) => {
      const definition =
        PERMISSION_DEFINITION_BY_KEY[permissionKey as PermissionKey];

      if (!definition) {
        throw new BadRequestException(`Unknown permission ${permissionKey}.`);
      }

      if (definition.systemOnly) {
        throw new BadRequestException(
          `Permission ${permissionKey} is system-only and cannot be assigned to CUSTOM roles.`
        );
      }

      if (!definition.assignable) {
        throw new BadRequestException(
          `Permission ${permissionKey} is not assignable to CUSTOM roles.`
        );
      }

      return definition.key;
    });
  }

  private normalizeKey(value: string) {
    const key = this.normalizeRequiredText(value, "Role key").toLowerCase();

    if (key.startsWith(RESERVED_SYSTEM_ROLE_PREFIX)) {
      throw new BadRequestException(
        "Custom access role keys cannot use the reserved system prefix."
      );
    }

    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(key)) {
      throw new BadRequestException(
        "Custom access role key must use lowercase letters, numbers, dots, underscores, or dashes."
      );
    }

    return key;
  }

  private normalizeRequiredText(value: string | undefined, label: string) {
    const trimmed = value?.trim();

    if (!trimmed) {
      throw new BadRequestException(`${label} is required.`);
    }

    return trimmed;
  }

  private normalizeDescription(value?: string | null) {
    if (value === undefined) {
      return null;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeReason(value: string | undefined) {
    return this.normalizeRequiredText(value, "Access role mutation reason");
  }

  private sortedPermissionKeys(permissionKeys: readonly string[]) {
    return [...permissionKeys].sort() as PermissionKey[];
  }

  private toRoleListItem(role: AccessRoleWithCounts) {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      kind: role.kind,
      status: role.status,
      isSystem: role.isSystem,
      systemRole: role.systemRole,
      permissionCount: role._count.permissions,
      activeAssignmentCount: role._count.userAssignments,
      readOnly: this.isReadOnlyRole(role),
      source:
        role.kind === AccessRoleKind.SYSTEM
          ? "SYSTEM_CODE_MIRROR"
          : "CUSTOM_DB_ROLE",
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }

  private toRoleDetail(role: AccessRoleWithCounts) {
    return {
      ...this.toRoleListItem(role),
      permissions: (role.permissions ?? []).map((permission) =>
        this.toPermissionMetadata(permission.permissionKey)
      )
    };
  }

  private toPermissionMetadata(permissionKey: string) {
    const definition =
      PERMISSION_DEFINITION_BY_KEY[permissionKey as PermissionKey];

    if (!definition) {
      return {
        key: permissionKey,
        label: "Unknown permission",
        description: "Permission is not present in the code catalog.",
        group: "Unknown",
        riskLevel: "UNKNOWN",
        assignable: false,
        systemOnly: true
      };
    }

    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      group: definition.group,
      riskLevel: definition.riskLevel,
      assignable: definition.assignable,
      systemOnly: definition.systemOnly
    };
  }

  private toRoleAuditValue(role: AccessRole) {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      kind: role.kind,
      status: role.status,
      isSystem: role.isSystem,
      systemRole: role.systemRole
    };
  }

  private buildPermissionRiskSummary(permissionKeys: readonly PermissionKey[]) {
    const definitions = permissionKeys.map(
      (permissionKey) =>
        PERMISSION_DEFINITION_BY_KEY[permissionKey] as PermissionDefinition
    );

    return {
      highRiskPermissionKeys: definitions
        .filter(
          (definition) => definition.riskLevel === PermissionRiskLevels.HIGH
        )
        .map((definition) => definition.key),
      criticalPermissionKeys: definitions
        .filter(
          (definition) =>
            definition.riskLevel === PermissionRiskLevels.CRITICAL
        )
        .map((definition) => definition.key)
    };
  }

  private isReadOnlyRole(role: Pick<AccessRole, "kind" | "isSystem">) {
    return role.kind === AccessRoleKind.SYSTEM || role.isSystem;
  }

  private async refreshPermissionCachesAfterMutation() {
    try {
      await this.accessPolicy.refreshPermissionCaches();
    } catch {
      // The DB mutation has already committed; surface an explicit stale-cache
      // failure so operators can restart the process or retry cache refresh.
      throw new ServiceUnavailableException(
        "Access role mutation succeeded, but permission cache refresh failed. Restart or retry refresh is required."
      );
    }
  }

  private toAuditJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }
}
