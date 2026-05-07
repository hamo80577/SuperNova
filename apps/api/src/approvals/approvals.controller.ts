import { Controller, Get, Inject } from "@nestjs/common";

import { ApprovalsService } from "./approvals.service";

@Controller("approvals")
export class ApprovalsController {
  constructor(
    @Inject(ApprovalsService)
    private readonly approvalsService: ApprovalsService
  ) {}

  @Get("status")
  getStatus() {
    return this.approvalsService.getFoundationStatus();
  }
}
