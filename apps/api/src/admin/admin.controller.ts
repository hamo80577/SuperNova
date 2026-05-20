import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AdminService } from "./admin.service";
import {
  AdminAssignPickerDto,
  AdminReplaceBranchChampDto
} from "./dto/admin-organization-action.dto";
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

  @Get("organization")
  getOrganization() {
    return this.adminService.getOrganization();
  }

  @Get("organization/branches/:vendorId")
  getOrganizationBranch(
    @Param("vendorId", ParseUUIDPipe) vendorId: string
  ) {
    return this.adminService.getOrganizationBranch(vendorId);
  }

  @Post("organization/branches/:vendorId/assign-picker")
  assignPickerToBranch(
    @Param("vendorId", ParseUUIDPipe) vendorId: string,
    @Body() dto: AdminAssignPickerDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.adminService.assignPickerToBranch(vendorId, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("organization/branches/:vendorId/replace-champ")
  replaceBranchChamp(
    @Param("vendorId", ParseUUIDPipe) vendorId: string,
    @Body() dto: AdminReplaceBranchChampDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.adminService.replaceBranchChamp(vendorId, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("organization/chains/:chainId/replace-area-manager")
  replaceChainAreaManager() {
    return this.adminService.replaceChainAreaManager();
  }
}
