import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { AccessPolicyService } from "../access-control/access-policy.service";
import { PermissionKeys } from "../access-control/permissions";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { UpdateAdminProfileDto } from "./dto/admin-profile.dto";
import { AreaManagerChainAssignmentDto } from "./dto/area-manager-chain-assignment.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateProfileCompletionDto } from "./dto/profile-completion.dto";
import { UpdateUserPreferencesDto } from "./dto/user-preferences.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  @Get("status")
  getStatus() {
    return this.usersService.getFoundationStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.USERS_LIST_OPERATIONAL);
    return this.usersService.list(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get("operational-list")
  listOperational(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.USERS_LIST_OPERATIONAL);
    return this.usersService.listOperational(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(user, PermissionKeys.USERS_VIEW_SELF);

    const currentUser = await this.usersService.getSafeCurrentUser(user.id);

    if (!currentUser) {
      throw new NotFoundException("Current user was not found.");
    }

    return currentUser;
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/preferences")
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserPreferencesDto,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.USERS_EDIT_OWN_PREFERENCES
    );

    return this.usersService.updatePreferences(user.id, dto, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/operational-profile")
  getOperationalProfile(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE
    );
    return this.usersService.getOperationalProfile(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get(":id/area-manager-chain-assignments")
  getAreaManagerChainAssignments(@Param("id") id: string) {
    return this.usersService.getAreaManagerChainAssignments(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post(":id/area-manager-chain-assignments")
  addAreaManagerChainAssignments(
    @Param("id") id: string,
    @Body() dto: AreaManagerChainAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.usersService.addAreaManagerChainAssignments(id, dto, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete(":id/area-manager-chain-assignments/:assignmentId")
  removeAreaManagerChainAssignment(
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.usersService.removeAreaManagerChainAssignment(
      id,
      assignmentId,
      user,
      {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? null
      }
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(":id/admin-profile")
  updateAdminProfile(
    @Param("id") id: string,
    @Body() dto: UpdateAdminProfileDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.usersService.updateAdminProfile(id, dto, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/reveal-temporary-password")
  revealTemporaryPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.USERS_READ_TEMPORARY_PASSWORD
    );

    return this.usersService.revealTemporaryPassword(id, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/reset-temporary-password")
  resetTemporaryPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.USERS_MANAGE_TEMPORARY_PASSWORD
    );

    return this.usersService.resetTemporaryPassword(id, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PICKER)
  @Get("me/profile-completion")
  getProfileCompletion(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfileCompletion(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PICKER)
  @Patch("me/profile-completion")
  updateProfileCompletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileCompletionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.usersService.updateProfileCompletion(user.id, dto, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
