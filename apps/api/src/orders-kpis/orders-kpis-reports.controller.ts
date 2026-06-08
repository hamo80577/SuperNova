import {
  Controller,
  Get,
  Inject,
  Query,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { ListOrdersKpiDailyReportQueryDto } from "./dto/list-orders-kpi-daily-report-query.dto";
import { ListOrdersKpiPerformanceReportQueryDto } from "./dto/list-orders-kpi-performance-report-query.dto";
import { OrdersKpisReportService } from "./orders-kpis-report.service";

@Controller("orders-kpis/reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersKpisReportsController {
  constructor(
    @Inject(OrdersKpisReportService)
    private readonly ordersKpisReportService: OrdersKpisReportService
  ) {}

  @Get("daily")
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.AREA_MANAGER,
    UserRole.CHAMP,
    UserRole.PICKER
  )
  getDailyReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersKpiDailyReportQueryDto
  ) {
    return this.ordersKpisReportService.getDailyReport(query, user);
  }

  @Get("performance")
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.AREA_MANAGER,
    UserRole.CHAMP,
    UserRole.PICKER
  )
  getPerformanceReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersKpiPerformanceReportQueryDto
  ) {
    return this.ordersKpisReportService.getPerformanceReport(query, user);
  }
}
