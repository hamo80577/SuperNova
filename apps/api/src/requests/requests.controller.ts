import { Controller, Get, Inject } from "@nestjs/common";

import { RequestsService } from "./requests.service";

@Controller("requests")
export class RequestsController {
  constructor(
    @Inject(RequestsService)
    private readonly requestsService: RequestsService
  ) {}

  @Get("status")
  getStatus() {
    return this.requestsService.getFoundationStatus();
  }
}
