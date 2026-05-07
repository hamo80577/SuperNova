import { Injectable } from "@nestjs/common";

@Injectable()
export class ApprovalsService {
  getFoundationStatus() {
    return {
      module: "approvals",
      status: "foundation-only"
    };
  }
}
