import { Controller, Get } from "@nestjs/common";

import { ChainsService } from "./chains.service";

@Controller("chains")
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}

  @Get("status")
  getStatus() {
    return this.chainsService.getFoundationStatus();
  }
}
