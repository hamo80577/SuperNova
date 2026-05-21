import { Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";

import { AccessPolicyService } from "../access-control/access-policy.service";
import { PermissionKeys } from "../access-control/permissions";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
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
    this.accessPolicy.assertCan(user, PermissionKeys.NOTIFICATIONS_VIEW);
    return this.notificationsService.listForUser(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/read")
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.NOTIFICATIONS_MANAGE_OWN);
    return this.notificationsService.markRead(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    this.accessPolicy.assertCan(user, PermissionKeys.NOTIFICATIONS_MANAGE_OWN);
    return this.notificationsService.markAllRead(user.id);
  }
}
