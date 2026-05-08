import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
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
}
