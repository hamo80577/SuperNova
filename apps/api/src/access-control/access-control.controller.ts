import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AccessPolicyService } from "./access-policy.service";
import {
  listPermissions,
  listPermissionsByGroup,
  PermissionKeys
} from "./permissions";
import { SYSTEM_ROLE_PERMISSIONS } from "./role-permission.matrix";

@Controller("access-control")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AccessControlController {
  constructor(
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
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
      systemRolePermissions: SYSTEM_ROLE_PERMISSIONS
    };
  }
}
