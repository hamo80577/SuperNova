import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AccessPolicyService } from "../access-control/access-policy.service";
import { PermissionKeys } from "../access-control/permissions";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  @Get("admin/overview")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminOverview(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAdminOverview();
  }

  @Get("area-manager/overview")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerOverview(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerOverview(user.id);
  }

  @Get("champ/overview")
  @Roles(UserRole.CHAMP)
  getChampOverview(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_CHAMP);
    return this.reportsService.getChampOverview(user.id);
  }
}
