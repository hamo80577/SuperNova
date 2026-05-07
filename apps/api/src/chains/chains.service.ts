import { Injectable } from "@nestjs/common";

@Injectable()
export class ChainsService {
  getFoundationStatus() {
    return {
      module: "chains",
      status: "foundation-only"
    };
  }
}
