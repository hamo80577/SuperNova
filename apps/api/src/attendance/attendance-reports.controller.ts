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
import { AttendanceReportService } from "./attendance-report.service";
import { ListAttendanceDailyReportQueryDto } from "./dto/list-attendance-daily-report-query.dto";

@Controller("attendance/reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceReportsController {
  constructor(
    @Inject(AttendanceReportService)
    private readonly attendanceReportService: AttendanceReportService
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
    @Query() query: ListAttendanceDailyReportQueryDto
  ) {
    return this.attendanceReportService.getDailyReport(query, user);
  }
}
