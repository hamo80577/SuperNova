import {
  Body,
  Controller,
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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { UpdateAdminProfileDto } from "./dto/admin-profile.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateProfileCompletionDto } from "./dto/profile-completion.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("status")
  getStatus() {
    return this.usersService.getFoundationStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const currentUser = await this.usersService.getSafeCurrentUser(user.id);

    if (!currentUser) {
      throw new NotFoundException("Current user was not found.");
    }

    return currentUser;
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/operational-profile")
  getOperationalProfile(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.getOperationalProfile(id, user);
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
  @Post(":id/password/reset")
  resetPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.usersService.resetPassword(id, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/password/regenerate-temporary")
  regenerateTemporaryPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.usersService.regenerateTemporaryPassword(id, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/password/temporary")
  getTemporaryPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.getTemporaryPassword(id, user);
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
