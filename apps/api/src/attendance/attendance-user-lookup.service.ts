import { Inject, Injectable } from "@nestjs/common";
import {
  AssignmentStatus,
  AttendanceIdentifierType,
  AttendancePersonRole,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceMatchedUser,
  AttendanceUserLookup
} from "./attendance-preview.types";

@Injectable()
export class AttendanceUserLookupService implements AttendanceUserLookup {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Matches sheet Identifier values against both workforce roles:
   * - PICKER by User.shopperId (role = PICKER)
   * - CHAMP by User.ibsId (role = CHAMP)
   *
   * The same identifier value may resolve to a picker AND a champ (different
   * users); both are returned so callers can detect the ambiguous case.
   */
  async findByIdentifiers(
    identifiers: string[]
  ): Promise<AttendanceMatchedUser[]> {
    const normalized = Array.from(
      new Set(
        identifiers
          .map((identifier) => identifier.trim())
          .filter((identifier) => identifier.length > 0)
      )
    );

    if (normalized.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.PICKER, shopperId: { in: normalized } },
          { role: UserRole.CHAMP, ibsId: { in: normalized } }
        ]
      },
      select: {
        id: true,
        shopperId: true,
        ibsId: true,
        role: true,
        nameEn: true,
        pickerBranchAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { vendor: { select: { vendorName: true } } }
        },
        vendorChampAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { vendor: { select: { vendorName: true } } }
        }
      }
    });

    return users.flatMap((user): AttendanceMatchedUser[] => {
      if (user.role === UserRole.PICKER && user.shopperId) {
        const branchName =
          user.pickerBranchAssignments[0]?.vendor.vendorName ?? null;
        return [
          {
            id: user.id,
            role: user.role,
            personRole: AttendancePersonRole.PICKER,
            identifier: user.shopperId,
            identifierType: AttendanceIdentifierType.SHOPPER_ID,
            nameEn: user.nameEn,
            branchName,
            vendorName: branchName
          }
        ];
      }

      if (user.role === UserRole.CHAMP && user.ibsId) {
        const branchName =
          user.vendorChampAssignments[0]?.vendor.vendorName ?? null;
        return [
          {
            id: user.id,
            role: user.role,
            personRole: AttendancePersonRole.CHAMP,
            identifier: user.ibsId,
            identifierType: AttendanceIdentifierType.IBS_ID,
            nameEn: user.nameEn,
            branchName,
            vendorName: branchName
          }
        ];
      }

      return [];
    });
  }
}
