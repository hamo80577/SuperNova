import { Injectable } from "@nestjs/common";

@Injectable()
export class RequestsService {
  getFoundationStatus() {
    return {
      module: "requests",
      status: "foundation-only",
      note: "Workflow orchestration begins in a later phase."
    };
  }
}
