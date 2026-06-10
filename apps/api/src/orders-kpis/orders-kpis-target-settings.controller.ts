import { Body, Controller, Get, Headers, Inject, Put, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { OrdersKpisTargetSettingsService } from "./orders-kpis-target-settings.service";
import type { OrdersKpiTargetSettingsRequest } from "./orders-kpis.types";

@Controller("orders-kpis/settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class OrdersKpisTargetSettingsController {
  constructor(
    @Inject(OrdersKpisTargetSettingsService)
    private readonly targetSettingsService: OrdersKpisTargetSettingsService
  ) {}

  @Get("targets")
  getTargetSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.targetSettingsService.getTargetSettings({
      actor: user
    });
  }

  @Put("targets")
  updateTargetSettings(
    @Body() body: OrdersKpiTargetSettingsRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.targetSettingsService.updateTargetSettings(body, {
      actor: user,
      userAgent
    });
  }
}
