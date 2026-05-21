import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { listPermissions, listPermissionsByGroup } from "./permissions";
import { SYSTEM_ROLE_PERMISSIONS } from "./role-permission.matrix";

@Controller("access-control")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AccessControlController {
  @Get("overview")
  getOverview() {
    return {
      permissions: listPermissions(),
      permissionsByGroup: listPermissionsByGroup(),
      systemRolePermissions: SYSTEM_ROLE_PERMISSIONS
    };
  }
}
