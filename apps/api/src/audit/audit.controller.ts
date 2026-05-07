import { Controller, Get, Inject } from "@nestjs/common";

import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get("status")
  getStatus() {
    return this.auditService.getFoundationStatus();
  }
}
