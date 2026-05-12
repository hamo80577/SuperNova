import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ApprovalStep, AssignmentStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

export type GeneratedApprovalStep = {
  step: ApprovalStep;
  approverRole: UserRole;
  approverId: string | null;
  chainId?: string | null;
};

@Injectable()
export class RequestApprovalRoutingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveAreaManagerStep(
    step: ApprovalStep,
    chainId: string
  ): Promise<GeneratedApprovalStep> {
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        chainId,
        status: AssignmentStatus.ACTIVE,
        areaManager: { accountStatus: "ACTIVE" }
      },
      include: { areaManager: true }
    });

    if (!assignment) {
      throw new BadRequestException(
        "No active Area Manager assignment exists for the Chain context."
      );
    }

    return {
      step,
      approverRole: UserRole.AREA_MANAGER,
      approverId: assignment.areaManagerId,
      chainId
    };
  }
}
