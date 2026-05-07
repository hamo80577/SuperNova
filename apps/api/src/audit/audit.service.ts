import { Injectable } from "@nestjs/common";

@Injectable()
export class AuditService {
  getFoundationStatus() {
    return {
      module: "audit",
      status: "foundation-only"
    };
  }
}
