import { Controller, Get, NotFoundException, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("status")
  getStatus() {
    return this.usersService.getFoundationStatus();
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
