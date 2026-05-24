import { Inject, Injectable } from "@nestjs/common";
import { AssignmentStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type { AttendanceAssignmentSnapshot } from "./attendance.types";

@Injectable()
export class AttendanceAssignmentSnapshotService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolvePickerSnapshot(
    pickerId: string,
    attendanceDate: Date
  ): Promise<AttendanceAssignmentSnapshot> {
    const assignment = await this.prisma.pickerBranchAssignment.findFirst({
      where: {
        pickerId,
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.CLOSED] },
        startDate: { lte: attendanceDate },
        OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }]
      },
      include: {
        vendor: {
          select: {
            id: true,
            chainId: true
          }
        }
      },
      orderBy: { startDate: "desc" }
    });

    return {
      assignmentVendorId: assignment?.vendor.id ?? null,
      assignmentChainId: assignment?.vendor.chainId ?? null
    };
  }
}
