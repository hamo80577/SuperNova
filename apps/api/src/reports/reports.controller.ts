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
import { AccessPolicyService } from "../access-control/access-policy.service";
import { PermissionKeys } from "../access-control/permissions";
import {
  AttendanceBranchesQueryDto,
  AttendanceChainsQueryDto,
  AttendanceOverviewQueryDto,
  AttendanceUserDailyQueryDto,
  AttendanceUsersQueryDto
} from "./dto/attendance-report-query.dto";
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

  @Get("attendance/months")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAttendanceMonths(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAttendanceMonths();
  }

  @Get("attendance/overview")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAttendanceOverview(
    @Query() query: AttendanceOverviewQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAttendanceOverview(query);
  }

  @Get("attendance/chains")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAttendanceChainSummaries(
    @Query() query: AttendanceChainsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAttendanceChainSummaries(query);
  }

  @Get("attendance/branches")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAttendanceBranchSummaries(
    @Query() query: AttendanceBranchesQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAttendanceBranchSummaries(query);
  }

  @Get("attendance/users")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAttendanceUserSummaries(
    @Query() query: AttendanceUsersQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAttendanceUserSummaries(query);
  }

  @Get("attendance/users/:userId/daily")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAttendanceUserDailyDetails(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: AttendanceUserDailyQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_ADMIN);
    return this.reportsService.getAttendanceUserDailyDetails(userId, query);
  }

  @Get("attendance/area-manager/months")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerAttendanceMonths(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerAttendanceMonths(user.id);
  }

  @Get("attendance/area-manager/overview")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerAttendanceOverview(
    @Query() query: AttendanceOverviewQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerAttendanceOverview(user.id, query);
  }

  @Get("attendance/area-manager/chains")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerAttendanceChainSummaries(
    @Query() query: AttendanceChainsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerAttendanceChainSummaries(
      user.id,
      query
    );
  }

  @Get("attendance/area-manager/branches")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerAttendanceBranchSummaries(
    @Query() query: AttendanceBranchesQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerAttendanceBranchSummaries(
      user.id,
      query
    );
  }

  @Get("attendance/area-manager/users")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerAttendanceUserSummaries(
    @Query() query: AttendanceUsersQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerAttendanceUserSummaries(
      user.id,
      query
    );
  }

  @Get("attendance/area-manager/users/:userId/daily")
  @Roles(UserRole.AREA_MANAGER)
  getAreaManagerAttendanceUserDailyDetails(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: AttendanceUserDailyQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    );
    return this.reportsService.getAreaManagerAttendanceUserDailyDetails(
      user.id,
      userId,
      query
    );
  }

  @Get("attendance/champ/months")
  @Roles(UserRole.CHAMP)
  getChampAttendanceMonths(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_CHAMP);
    return this.reportsService.getChampAttendanceMonths(user.id);
  }

  @Get("attendance/champ/overview")
  @Roles(UserRole.CHAMP)
  getChampAttendanceOverview(
    @Query() query: AttendanceOverviewQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_CHAMP);
    return this.reportsService.getChampAttendanceOverview(user.id, query);
  }

  @Get("attendance/champ/branches")
  @Roles(UserRole.CHAMP)
  getChampAttendanceBranchSummaries(
    @Query() query: AttendanceBranchesQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_CHAMP);
    return this.reportsService.getChampAttendanceBranchSummaries(
      user.id,
      query
    );
  }

  @Get("attendance/champ/users")
  @Roles(UserRole.CHAMP)
  getChampAttendanceUserSummaries(
    @Query() query: AttendanceUsersQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_CHAMP);
    return this.reportsService.getChampAttendanceUserSummaries(user.id, query);
  }

  @Get("attendance/champ/users/:userId/daily")
  @Roles(UserRole.CHAMP)
  getChampAttendanceUserDailyDetails(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: AttendanceUserDailyQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REPORTS_VIEW_CHAMP);
    return this.reportsService.getChampAttendanceUserDailyDetails(
      user.id,
      userId,
      query
    );
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
