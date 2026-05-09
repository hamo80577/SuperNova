import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";
import {
  AdminPageQueryDto,
  ListArchivedUsersQueryDto,
  ListAuditLogsQueryDto
} from "./dto/list-admin-query.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get("pending-actions")
  listPendingActions(@Query() query: AdminPageQueryDto) {
    return this.adminService.listPendingActions(query);
  }

  @Get("archived-users")
  listArchivedUsers(@Query() query: ListArchivedUsersQueryDto) {
    return this.adminService.listArchivedUsers(query);
  }

  @Get("audit-logs")
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }
}
