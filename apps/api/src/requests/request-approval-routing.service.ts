import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  EmploymentStatus,
  UserRole,
  type User
} from "@prisma/client";

import { getAccountAccessFailure } from "../auth/account-access.utils";
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
    const now = new Date();
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        chainId,
        status: AssignmentStatus.ACTIVE,
        areaManager: {
          role: UserRole.AREA_MANAGER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE,
          OR: [
            { blockStatus: BlockStatus.NO_BLOCK },
            {
              blockStatus: BlockStatus.TEMPORARY_BLOCK,
              blockedUntil: { lte: now }
            }
          ]
        }
      },
      include: { areaManager: true }
    });

    if (!assignment || !this.isEligibleAreaManager(assignment.areaManager)) {
      throw new BadRequestException(
        "No eligible active Area Manager assignment exists for the Chain context."
      );
    }

    return {
      step,
      approverRole: UserRole.AREA_MANAGER,
      approverId: assignment.areaManagerId,
      chainId
    };
  }

  private isEligibleAreaManager(
    areaManager: Pick<
      User,
      | "role"
      | "accountStatus"
      | "employmentStatus"
      | "blockStatus"
      | "blockedUntil"
    >
  ) {
    return (
      areaManager.role === UserRole.AREA_MANAGER &&
      areaManager.employmentStatus === EmploymentStatus.ACTIVE &&
      getAccountAccessFailure(areaManager) === null
    );
  }
}
