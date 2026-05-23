import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AccessRoleService } from "./access-role.service";
import { AccessPolicyService } from "./access-policy.service";
import {
  CreateCustomAccessRoleDto,
  DeactivateCustomAccessRoleDto,
  ListAccessRolesQueryDto,
  SyncCustomAccessRolePermissionsDto,
  UpdateCustomAccessRoleDto
} from "./dto/access-role.dto";
import {
  listPermissions,
  listPermissionsByGroup,
  PermissionKeys
} from "./permissions";
import { SYSTEM_ROLE_PERMISSIONS } from "./role-permission.matrix";

const SYSTEM_ROLE_PERMISSIONS_SOURCE = {
  source: "CODE_SYSTEM_ROLE_MATRIX",
  editable: false,
  note:
    "System role permissions are code-owned and seeded to DB as mirrors. Runtime policy may load the seeded DB cache at startup with code fallback."
} as const;

@Controller("access-control")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AccessControlController {
  constructor(
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService,
    @Inject(AccessRoleService)
    private readonly accessRoleService: AccessRoleService
  ) {}

  @Get("overview")
  getOverview(@Req() request: AuthenticatedRequest) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_VIEW
    );

    return {
      permissions: listPermissions(),
      permissionsByGroup: listPermissionsByGroup(),
      systemRolePermissions: SYSTEM_ROLE_PERMISSIONS,
      systemRolePermissionsSource: SYSTEM_ROLE_PERMISSIONS_SOURCE
    };
  }

  @Get("roles")
  listRoles(
    @Query() query: ListAccessRolesQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES
    );

    return this.accessRoleService.listRoles(query);
  }

  @Get("roles/:id")
  getRole(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES
    );

    return this.accessRoleService.getRole(id);
  }

  @Post("roles")
  createCustomRole(
    @Body() dto: CreateCustomAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    );

    return this.accessRoleService.createCustomRole(dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch("roles/:id")
  updateCustomRole(
    @Param("id") id: string,
    @Body() dto: UpdateCustomAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    );

    return this.accessRoleService.updateCustomRoleMetadata(id, dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("roles/:id/deactivate")
  deactivateCustomRole(
    @Param("id") id: string,
    @Body() dto: DeactivateCustomAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    );

    return this.accessRoleService.deactivateCustomRole(id, dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("roles/:id/permissions/sync")
  syncCustomRolePermissions(
    @Param("id") id: string,
    @Body() dto: SyncCustomAccessRolePermissionsDto,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      request.user,
      PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES
    );

    return this.accessRoleService.syncCustomRolePermissions(id, dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
