import { Controller, Get } from "@nestjs/common";

import { VendorsService } from "./vendors.service";

@Controller("vendors")
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get("status")
  getStatus() {
    return this.vendorsService.getFoundationStatus();
  }
}
