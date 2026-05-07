import { Controller, Get, Inject } from "@nestjs/common";

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
}
