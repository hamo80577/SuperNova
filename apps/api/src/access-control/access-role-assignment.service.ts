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
  AccountStatus,
  EmploymentStatus,
  Prisma,
  User,
  UserAccessRoleAssignment,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AccessPolicyService } from "./access-policy.service";
import type {
  AssignCustomAccessRoleDto,
  RevokeCustomAccessRoleAssignmentDto
} from "./dto/access-role-assignment.dto";
import {
  PERMISSION_DEFINITION_BY_KEY,
  type PermissionDefinition,
  type PermissionKey
} from "./permissions";
import { getPermissionsForRole } from "./role-permission.matrix";

type AccessRoleAssignmentMutationContext = Readonly<{
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

type AccessRoleAssignmentWithRole = UserAccessRoleAssignment & {
  accessRole: AccessRole & {
    permissions?: AccessRolePermission[];
    _count?: {
      permissions: number;
    };
  };
};

type EffectivePermissionSource =
  | Readonly<{ type: "BASE_ROLE"; role: UserRole }>
  | Readonly<{
      type: "CUSTOM_ACCESS_ROLE";
      accessRoleId: string;
      assignmentId: string;
    }>;

@Injectable()
export class AccessRoleAssignmentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  async listUserAccessRoleAssignments(userId: string) {
    const user = await this.findUserOrThrow(userId);
    const assignments = await this.prisma.userAccessRoleAssignment.findMany({
      where: {
        userId,
        accessRole: { kind: AccessRoleKind.CUSTOM }
      },
      include: {
        accessRole: {
          include: {
            _count: { select: { permissions: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return {
      user: this.toUserSummary(user),
      assignments: assignments.map((assignment) =>
        this.toAssignmentListItem(assignment)
      )
    };
  }

  async assignCustomAccessRoleToUser(
    userId: string,
    dto: AssignCustomAccessRoleDto,
    context: AccessRoleAssignmentMutationContext
  ) {
    const user = await this.findUserOrThrow(userId);

    if (
      user.accountStatus !== AccountStatus.ACTIVE ||
      user.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Target user account and employment status must be active."
      );
    }

    const accessRole = await this.prisma.accessRole.findUnique({
      where: { id: dto.accessRoleId },
      include: {
        _count: { select: { permissions: true } }
      }
    });

    if (!accessRole) {
      throw new NotFoundException("Access role was not found.");
    }

    this.assertAssignableCustomAccessRole(accessRole);

    const startsAt = dto.startsAt ? this.parseDate(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? this.parseDate(dto.endsAt) : null;
    const reason = this.normalizeReason(dto.reason);

    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt.");
    }

    const existingAssignment =
      await this.prisma.userAccessRoleAssignment.findFirst({
        where: {
          userId,
          accessRoleId: accessRole.id,
          status: AccessRoleAssignmentStatus.ACTIVE
        }
      });

    if (existingAssignment) {
      throw new ConflictException(
        "User already has an active assignment for this access role."
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const assignment = await tx.userAccessRoleAssignment.create({
          data: {
            userId,
            accessRoleId: accessRole.id,
            status: AccessRoleAssignmentStatus.ACTIVE,
            startsAt,
            endsAt
          },
          include: {
            accessRole: {
              include: {
                _count: { select: { permissions: true } }
              }
            }
          }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: context.actorUserId,
            action: "USER_ACCESS_ROLE_ASSIGNED",
            entityType: "UserAccessRoleAssignment",
            entityId: assignment.id,
            oldValue: Prisma.JsonNull,
            newValue: this.toAuditJson({
              targetUserId: userId,
              accessRoleId: accessRole.id,
              accessRoleKey: accessRole.key,
              status: assignment.status,
              startsAt: assignment.startsAt.toISOString(),
              endsAt: assignment.endsAt?.toISOString() ?? null,
              reason
            }),
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        });

        return {
          assignment: this.toAssignmentListItem(assignment)
        };
      });

      await this.refreshPermissionCachesAfterMutation();

      return result;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          "User already has an active assignment for this access role."
        );
      }

      throw error;
    }
  }

  async revokeUserAccessRoleAssignment(
    userId: string,
    assignmentId: string,
    dto: RevokeCustomAccessRoleAssignmentDto,
    context: AccessRoleAssignmentMutationContext
  ) {
    await this.findUserOrThrow(userId);
    const reason = this.normalizeReason(dto.reason);
    const current = await this.prisma.userAccessRoleAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        accessRole: {
          include: {
            _count: { select: { permissions: true } }
          }
        }
      }
    });

    if (!current) {
      throw new NotFoundException("User access role assignment was not found.");
    }

    if (current.userId !== userId) {
      throw new BadRequestException(
        "User access role assignment does not belong to this user."
      );
    }

    if (
      current.accessRole.kind !== AccessRoleKind.CUSTOM ||
      current.accessRole.isSystem ||
      current.accessRole.systemRole
    ) {
      throw new BadRequestException(
        "SYSTEM access-role assignments cannot be revoked."
      );
    }

    if (current.status !== AccessRoleAssignmentStatus.ACTIVE) {
      throw new BadRequestException(
        "Only active custom access-role assignments can be revoked."
      );
    }

    const now = new Date();
    const endsAt =
      current.endsAt === null || current.endsAt > now ? now : current.endsAt;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userAccessRoleAssignment.update({
        where: { id: assignmentId },
        data: {
          status: AccessRoleAssignmentStatus.INACTIVE,
          endsAt
        },
        include: {
          accessRole: {
            include: {
              _count: { select: { permissions: true } }
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "USER_ACCESS_ROLE_REVOKED",
          entityType: "UserAccessRoleAssignment",
          entityId: assignmentId,
          oldValue: this.toAuditJson({
            targetUserId: userId,
            accessRoleId: current.accessRoleId,
            accessRoleKey: current.accessRole.key,
            status: current.status,
            startsAt: current.startsAt.toISOString(),
            endsAt: current.endsAt?.toISOString() ?? null
          }),
          newValue: this.toAuditJson({
            targetUserId: userId,
            accessRoleId: updated.accessRoleId,
            accessRoleKey: updated.accessRole.key,
            status: updated.status,
            startsAt: updated.startsAt.toISOString(),
            endsAt: updated.endsAt?.toISOString() ?? null,
            reason
          }),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return {
        assignment: this.toAssignmentListItem(updated)
      };
    });

    await this.refreshPermissionCachesAfterMutation();

    return result;
  }

  async getUserEffectivePermissions(
    userId: string,
    context: AccessRoleAssignmentMutationContext
  ) {
    const now = new Date();
    const user = await this.findUserOrThrow(userId);
    const activeAssignments =
      await this.prisma.userAccessRoleAssignment.findMany({
        where: {
          userId,
          status: AccessRoleAssignmentStatus.ACTIVE,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          accessRole: {
            kind: AccessRoleKind.CUSTOM,
            status: AccessRoleStatus.ACTIVE,
            isSystem: false
          }
        },
        include: {
          accessRole: {
            include: {
              permissions: { orderBy: { permissionKey: "asc" } },
              _count: { select: { permissions: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

    const warnings: string[] = [];
    const effectivePermissions = new Map<
      string,
      ReturnType<typeof this.toPermissionMetadata> & {
        sources: EffectivePermissionSource[];
      }
    >();

    const addPermission = (
      permissionKey: PermissionKey,
      source: EffectivePermissionSource
    ) => {
      const metadata = this.toPermissionMetadata(permissionKey);
      const existing = effectivePermissions.get(permissionKey);

      if (existing) {
        existing.sources.push(source);
        return;
      }

      effectivePermissions.set(permissionKey, {
        ...metadata,
        sources: [source]
      });
    };

    for (const permissionKey of getPermissionsForRole(user.role)) {
      addPermission(permissionKey, {
        type: "BASE_ROLE",
        role: user.role
      });
    }

    const customAssignments = activeAssignments.map((assignment) => {
      const validPermissions: PermissionDefinition[] = [];

      for (const permission of assignment.accessRole.permissions ?? []) {
        const definition =
          PERMISSION_DEFINITION_BY_KEY[permission.permissionKey as PermissionKey];

        if (!definition) {
          warnings.push(
            `Unknown permission ${permission.permissionKey} ignored for access role ${assignment.accessRole.key}.`
          );
          continue;
        }

        if (definition.systemOnly) {
          warnings.push(
            `System-only permission ${definition.key} ignored for access role ${assignment.accessRole.key}.`
          );
          continue;
        }

        if (!definition.assignable) {
          warnings.push(
            `Non-assignable permission ${definition.key} ignored for access role ${assignment.accessRole.key}.`
          );
          continue;
        }

        validPermissions.push(definition);
        addPermission(definition.key, {
          type: "CUSTOM_ACCESS_ROLE",
          accessRoleId: assignment.accessRoleId,
          assignmentId: assignment.id
        });
      }

      return {
        assignmentId: assignment.id,
        accessRoleId: assignment.accessRoleId,
        accessRoleKey: assignment.accessRole.key,
        accessRoleName: assignment.accessRole.name,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        permissions: validPermissions.map((definition) =>
          this.toPermissionMetadata(definition.key)
        )
      };
    });

    const response = {
      user: this.toUserSummary(user),
      baseRole: {
        role: user.role,
        permissions: getPermissionsForRole(user.role).map((permissionKey) =>
          this.toPermissionMetadata(permissionKey)
        )
      },
      customAssignments,
      effectivePermissions: [...effectivePermissions.values()].sort((a, b) =>
        a.key.localeCompare(b.key)
      ),
      warnings
    };

    await this.prisma.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        action: "USER_EFFECTIVE_PERMISSIONS_VIEWED",
        entityType: "User",
        entityId: userId,
        oldValue: Prisma.JsonNull,
        newValue: this.toAuditJson({
          viewedUserId: userId,
          permissionCount: response.effectivePermissions.length,
          customAssignmentCount: customAssignments.length,
          warnings
        }),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null
      }
    });

    return response;
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        nameEn: true,
        phoneNumber: true,
        accountStatus: true,
        employmentStatus: true
      }
    });

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    return user;
  }

  private assertAssignableCustomAccessRole(
    accessRole: Pick<
      AccessRole,
      "kind" | "status" | "isSystem" | "systemRole"
    >
  ) {
    if (
      accessRole.kind !== AccessRoleKind.CUSTOM ||
      accessRole.isSystem ||
      accessRole.systemRole
    ) {
      throw new BadRequestException("SYSTEM access roles cannot be assigned.");
    }

    if (accessRole.status !== AccessRoleStatus.ACTIVE) {
      throw new BadRequestException("Only active CUSTOM access roles can be assigned.");
    }
  }

  private parseDate(value: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Invalid access-role assignment date.");
    }

    return parsed;
  }

  private normalizeReason(value: string | undefined) {
    const trimmed = value?.trim();

    if (!trimmed) {
      throw new BadRequestException("Access role assignment reason is required.");
    }

    return trimmed;
  }

  private toUserSummary(
    user: Pick<
      User,
      "id" | "role" | "nameEn" | "phoneNumber" | "accountStatus" | "employmentStatus"
    >
  ) {
    return {
      id: user.id,
      role: user.role,
      nameEn: user.nameEn,
      phoneNumber: user.phoneNumber,
      accountStatus: user.accountStatus,
      employmentStatus: user.employmentStatus
    };
  }

  private toAssignmentListItem(assignment: AccessRoleAssignmentWithRole) {
    return {
      id: assignment.id,
      userId: assignment.userId,
      accessRoleId: assignment.accessRoleId,
      status: assignment.status,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      accessRole: {
        id: assignment.accessRole.id,
        key: assignment.accessRole.key,
        name: assignment.accessRole.name,
        description: assignment.accessRole.description,
        kind: assignment.accessRole.kind,
        status: assignment.accessRole.status,
        isSystem: assignment.accessRole.isSystem,
        permissionCount: assignment.accessRole._count?.permissions ?? 0
      }
    };
  }

  private toPermissionMetadata(permissionKey: PermissionKey) {
    const definition = PERMISSION_DEFINITION_BY_KEY[permissionKey];

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

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
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
