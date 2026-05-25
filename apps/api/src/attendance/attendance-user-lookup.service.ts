import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceMatchedUser,
  AttendanceUserLookup
} from "./attendance-preview.types";

@Injectable()
export class AttendanceUserLookupService implements AttendanceUserLookup {
  constructor(private readonly prisma: PrismaService) {}

  async findByShopperIds(shopperIds: string[]): Promise<AttendanceMatchedUser[]> {
    const normalizedShopperIds = Array.from(
      new Set(
        shopperIds
          .map((shopperId) => shopperId.trim())
          .filter((shopperId) => shopperId.length > 0)
      )
    );

    if (normalizedShopperIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        shopperId: {
          in: normalizedShopperIds
        }
      },
      select: {
        id: true,
        shopperId: true,
        role: true,
        nameEn: true
      }
    });

    return users
      .filter((user): user is AttendanceMatchedUser => user.shopperId !== null)
      .map((user) => ({
        id: user.id,
        shopperId: user.shopperId,
        role: user.role,
        nameEn: user.nameEn
      }));
  }
}
