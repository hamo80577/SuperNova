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

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AccessRoleAssignmentService } from "./access-role-assignment.service";
import { AccessRoleService } from "./access-role.service";
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
import { PermissionGuard } from "./permission.guard";
import { RequirePermission } from "./require-permission.decorator";
import { SYSTEM_ROLE_PERMISSIONS } from "./role-permission.matrix";

const SYSTEM_ROLE_PERMISSIONS_SOURCE = {
  source: "CODE_SYSTEM_ROLE_MATRIX",
  editable: false,
  note:
    "System role permissions are code-owned and seeded to DB as mirrors. Runtime policy may load the seeded DB cache at startup with code fallback."
} as const;

@Controller("access-control")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AccessControlController {
  constructor(
    @Inject(AccessRoleService)
    private readonly accessRoleService: AccessRoleService,
    @Inject(AccessRoleAssignmentService)
    private readonly accessRoleAssignmentService: AccessRoleAssignmentService
  ) {}

  @Get("overview")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_VIEW)
  getOverview() {
    return {
      permissions: listPermissions(),
      permissionsByGroup: listPermissionsByGroup(),
      systemRolePermissions: SYSTEM_ROLE_PERMISSIONS,
      systemRolePermissionsSource: SYSTEM_ROLE_PERMISSIONS_SOURCE
    };
  }

  @Get("roles")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES)
  listRoles(@Query() query: ListAccessRolesQueryDto) {
    return this.accessRoleService.listRoles(query);
  }

  @Get("effective-permissions/users/:id")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS)
  getUserEffectivePermissions(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.accessRoleAssignmentService.getUserEffectivePermissions(id, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Get("roles/:id")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES)
  getRole(@Param("id") id: string) {
    return this.accessRoleService.getRole(id);
  }

  @Post("roles")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES)
  createCustomRole(
    @Body() dto: CreateCustomAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.accessRoleService.createCustomRole(dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch("roles/:id")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES)
  updateCustomRole(
    @Param("id") id: string,
    @Body() dto: UpdateCustomAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.accessRoleService.updateCustomRoleMetadata(id, dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("roles/:id/deactivate")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES)
  deactivateCustomRole(
    @Param("id") id: string,
    @Body() dto: DeactivateCustomAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.accessRoleService.deactivateCustomRole(id, dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("roles/:id/permissions/sync")
  @RequirePermission(PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES)
  syncCustomRolePermissions(
    @Param("id") id: string,
    @Body() dto: SyncCustomAccessRolePermissionsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.accessRoleService.syncCustomRolePermissions(id, dto, {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
