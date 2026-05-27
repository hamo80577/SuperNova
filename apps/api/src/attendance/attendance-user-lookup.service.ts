import { Inject, Injectable } from "@nestjs/common";
import { AssignmentStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceMatchedUser,
  AttendanceUserLookup
} from "./attendance-preview.types";

@Injectable()
export class AttendanceUserLookupService implements AttendanceUserLookup {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
        nameEn: true,
        pickerBranchAssignments: {
          where: {
            status: AssignmentStatus.ACTIVE
          },
          orderBy: {
            startDate: "desc"
          },
          take: 1,
          select: {
            vendor: {
              select: {
                vendorName: true
              }
            }
          }
        }
      }
    });

    return users.flatMap((user) => {
      if (!user.shopperId) {
        return [];
      }

      return [{
        id: user.id,
        shopperId: user.shopperId,
        role: user.role,
        nameEn: user.nameEn,
        branchName: user.pickerBranchAssignments[0]?.vendor.vendorName ?? null,
        vendorName: user.pickerBranchAssignments[0]?.vendor.vendorName ?? null
      }];
    });
  }
}
