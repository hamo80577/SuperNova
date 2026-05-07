import { Controller, Get, Inject } from "@nestjs/common";

import { AssignmentsService } from "./assignments.service";

@Controller("assignments")
export class AssignmentsController {
  constructor(
    @Inject(AssignmentsService)
    private readonly assignmentsService: AssignmentsService
  ) {}

  @Get("status")
  getStatus() {
    return this.assignmentsService.getFoundationStatus();
  }
}
