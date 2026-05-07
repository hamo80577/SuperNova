import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  getFoundationStatus() {
    return {
      module: "notifications",
      status: "foundation-only"
    };
  }
}
