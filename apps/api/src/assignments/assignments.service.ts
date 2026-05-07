import { Injectable } from "@nestjs/common";

@Injectable()
export class AssignmentsService {
  getFoundationStatus() {
    return {
      module: "assignments",
      status: "foundation-only",
      note: "Assignment lifecycle rules remain request-based and unimplemented in Phase 0."
    };
  }
}
