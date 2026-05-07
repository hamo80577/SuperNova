import { Injectable } from "@nestjs/common";

@Injectable()
export class UsersService {
  getFoundationStatus() {
    return {
      module: "users",
      status: "foundation-only"
    };
  }
}
