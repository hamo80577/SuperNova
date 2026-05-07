import { Injectable } from "@nestjs/common";

@Injectable()
export class VendorsService {
  getFoundationStatus() {
    return {
      module: "vendors",
      status: "foundation-only"
    };
  }
}
