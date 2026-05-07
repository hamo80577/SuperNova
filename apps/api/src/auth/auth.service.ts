import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService {
  getFoundationStatus() {
    return {
      module: "auth",
      status: "foundation-only",
      note: "Authentication flows are intentionally deferred to Phase 1."
    };
  }
}
