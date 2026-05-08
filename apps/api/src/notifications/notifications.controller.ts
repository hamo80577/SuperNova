import { Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService
  ) {}

  @Get("status")
  getStatus() {
    return this.notificationsService.getFoundationStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto
  ) {
    return this.notificationsService.listForUser(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/read")
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
