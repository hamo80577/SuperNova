import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AdminPerformanceSummaryService } from "./admin-performance-summary.service";
import { AreaManagerPerformanceSummaryService } from "./area-manager-performance-summary.service";
import { AdminPerformanceSummaryQueryDto } from "./dto/admin-performance-summary-query.dto";
import { AreaManagerPerformanceSummaryQueryDto } from "./dto/area-manager-performance-summary-query.dto";
import { ChampPerformanceSummaryQueryDto } from "./dto/champ-performance-summary-query.dto";
import { PickerPerformanceSummaryQueryDto } from "./dto/picker-performance-summary-query.dto";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService)
    private readonly workspacesService: WorkspacesService,
    @Inject(AreaManagerPerformanceSummaryService)
    private readonly areaManagerPerformanceSummaryService: AreaManagerPerformanceSummaryService,
    @Inject(AdminPerformanceSummaryService)
    private readonly adminPerformanceSummaryService: AdminPerformanceSummaryService
  ) {}

  @Get("picker")
  @Roles(UserRole.PICKER)
  getPickerWorkspace(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getPickerWorkspace(user.id);
  }

  @Get("picker/performance-summary")
  @Roles(UserRole.PICKER)
  getPickerPerformanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PickerPerformanceSummaryQueryDto
  ) {
    return this.workspacesService.getPickerPerformanceSummary(user.id, query);
  }

  @Get("champ")
  @Roles(UserRole.CHAMP)
  getChampWorkspace(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getChampWorkspace(user.id);
  }

  @Get("champ/performance-summary")
  @Roles(UserRole.CHAMP)
  getChampPerformanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ChampPerformanceSummaryQueryDto
  ) {
    return this.workspacesService.getChampPerformanceSummary(user.id, query);
  }

  @Get("champ/branches")
  @Roles(UserRole.CHAMP)
  getChampBranches(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getChampBranches(user.id);
  }

  @Get("champ/branches/:vendorId")
  @Roles(UserRole.CHAMP)
  getChampBranchDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("vendorId", ParseUUIDPipe) vendorId: string
  ) {
    return this.workspacesService.getChampBranchDetail(user.id, vendorId);
  }

  @Get("area-manager")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerWorkspace(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getAreaManagerWorkspace(user.id);
  }

  @Get("area-manager/performance-summary")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerPerformanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AreaManagerPerformanceSummaryQueryDto
  ) {
    return this.areaManagerPerformanceSummaryService.getSummary(user.id, query);
  }

  @Get("admin")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminWorkspace() {
    return this.workspacesService.getAdminWorkspace();
  }

  @Get("admin/performance-summary")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminPerformanceSummary(
    @Query() query: AdminPerformanceSummaryQueryDto
  ) {
    return this.adminPerformanceSummaryService.getSummary(query);
  }
}
