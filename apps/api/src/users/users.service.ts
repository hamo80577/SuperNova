import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { toSafeUser } from "./dto/safe-user.dto";

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getFoundationStatus() {
    return {
      module: "users",
      status: "foundation-only"
    };
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id }
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: { phoneNumber }
    });
  }

  async getSafeCurrentUser(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      return null;
    }

    return toSafeUser(user);
  }
}
