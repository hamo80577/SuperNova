import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { OrdersKpisReportService } from "./orders-kpis-report.service";
import type { OrdersKpiPerformanceReportQuery } from "./orders-kpis.types";

@Controller("orders-kpis/reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.AREA_MANAGER,
  UserRole.CHAMP
)
export class OrdersKpisReportsController {
  constructor(
    @Inject(OrdersKpisReportService)
    private readonly ordersKpisReportService: OrdersKpisReportService
  ) {}

  @Get("performance")
  getPerformanceReport(
    @Query() query: OrdersKpiPerformanceReportQuery,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.ordersKpisReportService.getPerformanceReport(query, {
      actor: user
    });
  }
}
