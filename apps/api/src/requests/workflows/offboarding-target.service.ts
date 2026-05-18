import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  AssignmentStatus,
  ChainStatus,
  Prisma,
  UserRole,
  VendorStatus
} from "@prisma/client";

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { OffboardingSearchService } from "./offboarding-search.service";
import type {
  OffboardingPayload,
  ResignationTargetContext
} from "./offboarding-types";
import {
  areaManagerAssignmentInclude,
  champAssignmentInclude,
  pickerAssignmentInclude
} from "./offboarding-types";
import type { OffboardingTargetRole } from "./offboarding-workflow.policy";

@Injectable()
export class OffboardingTargetService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OffboardingSearchService)
    private readonly searchService: OffboardingSearchService
  ) {}

  async resolveScopedActiveTarget(
    targetUserId: string,
    targetRole: OffboardingTargetRole,
    sourceVendorId: string | undefined,
    sourceChainId: string | undefined,
    actor: AuthenticatedUser
  ): Promise<ResignationTargetContext> {
    if (targetRole === UserRole.PICKER) {
      const assignment = await this.resolveScopedActivePickerAssignment(
        targetUserId,
        sourceVendorId,
        actor
      );
      return {
        assignmentId: assignment.id,
        assignmentType: "PickerBranchAssignment",
        sourceChainId: assignment.vendor.chainId,
        sourceVendorId: assignment.vendorId,
        sourceLabel: assignment.vendor.vendorName,
        targetUser: assignment.picker,
        targetRole
      };
    }

    if (targetRole === UserRole.CHAMP) {
      const assignments = await this.prisma.vendorChampAssignment.findMany({
        where: {
          ...this.searchService.buildScopedChampAssignmentWhere(
            actor,
            sourceVendorId,
            sourceChainId
          ),
          champId: targetUserId
        },
        include: champAssignmentInclude,
        take: 3
      });

      if (!assignments.length) {
        throw new ForbiddenException(
          "Selected Champ is not in your Resignation scope or is no longer active."
        );
      }

      const assignment = assignments[0];
      return {
        assignmentId: assignment.id,
        assignmentType: "VendorChampAssignment",
        sourceChainId: assignment.vendor.chainId,
        sourceVendorId: assignment.vendorId,
        sourceLabel: assignment.vendor.vendorName,
        targetUser: assignment.champ,
        targetRole
      };
    }

    if (!this.isAdmin(actor)) {
      throw new ForbiddenException("Only Admins can resign Area Managers.");
    }

    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        ...this.searchService.buildScopedAreaManagerAssignmentWhere(sourceChainId),
        areaManagerId: targetUserId
      },
      include: areaManagerAssignmentInclude,
      take: 3
    });

    if (!assignments.length) {
      throw new ForbiddenException(
        "Selected Area Manager is not active or has no active Chain assignment."
      );
    }

    const assignment = assignments[0];
    return {
      assignmentId: assignment.id,
      assignmentType: "ChainAreaManagerAssignment",
      sourceChainId: assignment.chainId,
      sourceLabel: assignment.chain.chainName,
      targetUser: assignment.areaManager,
      targetRole
    };
  }

  async resolveActiveAssignmentsForFinalization(
    payload: OffboardingPayload,
    request: { sourceChainId: string | null; sourceVendorId: string | null }
  ) {
    if (request.sourceChainId !== payload.source.chainId) {
      throw new BadRequestException(
        "Source Chain no longer matches the stored request context."
      );
    }

    if (payload.target.targetRole === UserRole.PICKER) {
      if (
        !payload.source.vendorId ||
        request.sourceVendorId !== payload.source.vendorId
      ) {
        throw new BadRequestException(
          "Source Branch no longer matches the stored request context."
        );
      }

      const assignment = await this.prisma.pickerBranchAssignment.findFirst({
        where: {
          id: payload.target.assignmentId,
          pickerId: payload.target.userId,
          vendorId: payload.source.vendorId,
          status: AssignmentStatus.ACTIVE
        },
        include: pickerAssignmentInclude
      });

      if (!assignment) {
        throw new BadRequestException(
          "Target Picker no longer has an active assignment to the source Branch."
        );
      }

      if (
        assignment.vendor.status !== VendorStatus.ACTIVE ||
        assignment.vendor.chain.status !== ChainStatus.ACTIVE ||
        assignment.vendor.chainId !== payload.source.chainId
      ) {
        throw new BadRequestException("Source Branch is no longer active.");
      }

      return [assignment];
    }

    if (payload.target.targetRole === UserRole.CHAMP) {
      if (
        !payload.source.vendorId ||
        request.sourceVendorId !== payload.source.vendorId
      ) {
        throw new BadRequestException(
          "Source Branch no longer matches the stored request context."
        );
      }

      const sourceAssignment = await this.prisma.vendorChampAssignment.findFirst({
        where: {
          id: payload.target.assignmentId,
          champId: payload.target.userId,
          vendorId: payload.source.vendorId,
          status: AssignmentStatus.ACTIVE
        },
        include: champAssignmentInclude
      });

      if (!sourceAssignment) {
        throw new BadRequestException(
          "Target Champ no longer has an active assignment to the source Branch."
        );
      }

      if (
        sourceAssignment.vendor.status !== VendorStatus.ACTIVE ||
        sourceAssignment.vendor.chain.status !== ChainStatus.ACTIVE ||
        sourceAssignment.vendor.chainId !== payload.source.chainId
      ) {
        throw new BadRequestException("Source Branch is no longer active.");
      }

      return this.prisma.vendorChampAssignment.findMany({
        where: {
          champId: payload.target.userId,
          status: AssignmentStatus.ACTIVE
        },
        include: champAssignmentInclude
      });
    }

    const sourceAssignment =
      await this.prisma.chainAreaManagerAssignment.findFirst({
        where: {
          id: payload.target.assignmentId,
          areaManagerId: payload.target.userId,
          chainId: payload.source.chainId,
          status: AssignmentStatus.ACTIVE
        },
        include: areaManagerAssignmentInclude
      });

    if (!sourceAssignment) {
      throw new BadRequestException(
        "Target Area Manager no longer has an active assignment to the source Chain."
      );
    }

    if (sourceAssignment.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Source Chain is no longer active.");
    }

    return this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        areaManagerId: payload.target.userId,
        status: AssignmentStatus.ACTIVE
      },
      include: areaManagerAssignmentInclude
    });
  }

  async closeActiveAssignments(
    tx: Prisma.TransactionClient,
    targetRole: OffboardingTargetRole,
    activeAssignments: Array<{ id: string }>,
    completedAt: Date
  ) {
    if (targetRole === UserRole.PICKER) {
      return Promise.all(
        activeAssignments.map((assignment) =>
          tx.pickerBranchAssignment.update({
            where: { id: assignment.id },
            data: { status: AssignmentStatus.CLOSED, endDate: completedAt }
          })
        )
      );
    }

    if (targetRole === UserRole.CHAMP) {
      return Promise.all(
        activeAssignments.map((assignment) =>
          tx.vendorChampAssignment.update({
            where: { id: assignment.id },
            data: { status: AssignmentStatus.CLOSED, endDate: completedAt }
          })
        )
      );
    }

    return Promise.all(
      activeAssignments.map((assignment) =>
        tx.chainAreaManagerAssignment.update({
          where: { id: assignment.id },
          data: { status: AssignmentStatus.CLOSED, endDate: completedAt }
        })
      )
    );
  }

  private async resolveScopedActivePickerAssignment(
    targetUserId: string,
    sourceVendorId: string | undefined,
    actor: AuthenticatedUser
  ) {
    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: {
        ...this.searchService.buildScopedPickerAssignmentWhere(
          actor,
          sourceVendorId
        ),
        pickerId: targetUserId
      },
      include: pickerAssignmentInclude,
      take: 3
    });

    if (!assignments.length) {
      throw new ForbiddenException(
        "Selected Picker is not in your Resignation scope or is no longer active."
      );
    }

    if (!sourceVendorId && assignments.length > 1) {
      throw new BadRequestException(
        "Selected Picker has multiple active Branch assignments. Submit with sourceVendorId."
      );
    }

    if (assignments.length > 1) {
      throw new BadRequestException(
        "Selected Picker has an invalid active assignment state."
      );
    }

    return assignments[0];
  }

  private isAdmin(actor: AuthenticatedUser) {
    return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  }
}
