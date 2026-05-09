import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService
  ) {}

  @Get("admin/overview")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminOverview() {
    return this.reportsService.getAdminOverview();
  }

  @Get("area-manager/overview")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getAreaManagerOverview(user.id);
  }

  @Get("champ/overview")
  @Roles(UserRole.CHAMP)
  getChampOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getChampOverview(user.id);
  }
}
