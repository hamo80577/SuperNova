import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  UserRole,
  type Prisma
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import type {
  DeductionTargetContext,
  DeductionTargetRole
} from "./deductions.types";

const TARGET_USER_SELECT = {
  id: true,
  nameEn: true,
  nameAr: true,
  role: true,
  shopperId: true,
  ibsId: true,
  phoneNumber: true,
  accountStatus: true
} satisfies Prisma.UserSelect;

@Injectable()
export class DeductionsScopeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveScopedTarget(
    targetUserId: string,
    targetRole: DeductionTargetRole,
    actor: AuthenticatedUser,
    sourceVendorId?: string | null
  ): Promise<DeductionTargetContext> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: TARGET_USER_SELECT
    });

    if (!targetUser || targetUser.accountStatus !== AccountStatus.ACTIVE) {
      throw new NotFoundException("Target user was not found or is not active.");
    }

    if (targetUser.role !== targetRole) {
      throw new BadRequestException(
        `Target user is not a ${targetRole === UserRole.PICKER ? "Picker" : "Champ"}.`
      );
    }

    if (targetRole === UserRole.PICKER) {
      return this.resolvePickerTarget(targetUser, actor, sourceVendorId);
    }

    return this.resolveChampTarget(targetUser, actor, sourceVendorId);
  }

  async resolveActorChainIds(actor: AuthenticatedUser) {
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: { areaManagerId: actor.id, status: AssignmentStatus.ACTIVE },
      select: { chainId: true }
    });

    return [...new Set(assignments.map((assignment) => assignment.chainId))];
  }

  async resolveActorVendorIds(actor: AuthenticatedUser) {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId: actor.id, status: AssignmentStatus.ACTIVE },
      select: { vendorId: true }
    });

    return [...new Set(assignments.map((assignment) => assignment.vendorId))];
  }

  async searchScopedTargets(
    actor: AuthenticatedUser,
    targetRole: DeductionTargetRole,
    q?: string | null
  ) {
    const search = q?.trim();

    if (!search || search.length < 2) {
      return [];
    }

    const searchWhere: Prisma.UserWhereInput = {
      OR: [
        { nameEn: { contains: search, mode: "insensitive" } },
        { nameAr: { contains: search, mode: "insensitive" } },
        { shopperId: { contains: search, mode: "insensitive" } },
        { ibsId: { contains: search, mode: "insensitive" } },
        { nationalId: { contains: search } },
        { phoneNumber: { contains: search } }
      ]
    };

    if (targetRole === UserRole.PICKER) {
      const vendorWhere = await this.pickerVendorScopeWhere(actor);
      const assignments = await this.prisma.pickerBranchAssignment.findMany({
        where: {
          status: AssignmentStatus.ACTIVE,
          ...vendorWhere,
          picker: {
            role: UserRole.PICKER,
            accountStatus: AccountStatus.ACTIVE,
            ...searchWhere
          }
        },
        include: {
          picker: { select: TARGET_USER_SELECT },
          vendor: { include: { chain: true } }
        },
        orderBy: { picker: { nameEn: "asc" } },
        take: 20
      });

      return assignments.map((assignment) => ({
        userId: assignment.picker.id,
        name: assignment.picker.nameEn,
        role: assignment.picker.role,
        shopperId: assignment.picker.shopperId,
        ibsId: assignment.picker.ibsId,
        vendorId: assignment.vendorId,
        vendorName: assignment.vendor.vendorName,
        chainId: assignment.vendor.chainId,
        chainName: assignment.vendor.chain.chainName
      }));
    }

    if (actor.role !== UserRole.AREA_MANAGER) {
      throw new ForbiddenException(
        "Only Area Managers can target Champs with Deduction tickets."
      );
    }

    const chainIds = await this.resolveActorChainIds(actor);
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: {
        status: AssignmentStatus.ACTIVE,
        vendor: { chainId: { in: chainIds } },
        champ: {
          role: UserRole.CHAMP,
          accountStatus: AccountStatus.ACTIVE,
          ...searchWhere
        }
      },
      include: {
        champ: { select: TARGET_USER_SELECT },
        vendor: { include: { chain: true } }
      },
      orderBy: { champ: { nameEn: "asc" } },
      take: 20
    });

    const seen = new Set<string>();
    return assignments
      .filter((assignment) => {
        if (seen.has(assignment.champId)) {
          return false;
        }
        seen.add(assignment.champId);
        return true;
      })
      .map((assignment) => ({
        userId: assignment.champ.id,
        name: assignment.champ.nameEn,
        role: assignment.champ.role,
        shopperId: assignment.champ.shopperId,
        ibsId: assignment.champ.ibsId,
        vendorId: assignment.vendorId,
        vendorName: assignment.vendor.vendorName,
        chainId: assignment.vendor.chainId,
        chainName: assignment.vendor.chain.chainName
      }));
  }

  private async pickerVendorScopeWhere(
    actor: AuthenticatedUser
  ): Promise<Prisma.PickerBranchAssignmentWhereInput> {
    if (actor.role === UserRole.CHAMP) {
      const vendorIds = await this.resolveActorVendorIds(actor);
      return { vendorId: { in: vendorIds } };
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      const chainIds = await this.resolveActorChainIds(actor);
      return { vendor: { chainId: { in: chainIds } } };
    }

    throw new ForbiddenException(
      "Only Champs and Area Managers can create Deduction tickets."
    );
  }

  private async resolvePickerTarget(
    targetUser: Prisma.UserGetPayload<{ select: typeof TARGET_USER_SELECT }>,
    actor: AuthenticatedUser,
    sourceVendorId?: string | null
  ): Promise<DeductionTargetContext> {
    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: {
        pickerId: targetUser.id,
        status: AssignmentStatus.ACTIVE,
        ...(sourceVendorId ? { vendorId: sourceVendorId } : {})
      },
      include: { vendor: { include: { chain: true } } }
    });

    if (!assignments.length) {
      throw new BadRequestException(
        "Target Picker has no active branch assignment in the given context."
      );
    }

    if (assignments.length > 1) {
      throw new BadRequestException(
        "Target Picker has multiple active assignments. sourceVendorId is required."
      );
    }

    const assignment = assignments[0];

    if (actor.role === UserRole.CHAMP) {
      const champAssignment = await this.prisma.vendorChampAssignment.findFirst({
        where: {
          champId: actor.id,
          vendorId: assignment.vendorId,
          status: AssignmentStatus.ACTIVE
        },
        select: { id: true }
      });

      if (!champAssignment) {
        throw new ForbiddenException(
          "You can create Deduction tickets only for Pickers in your assigned branches."
        );
      }
    } else if (actor.role === UserRole.AREA_MANAGER) {
      await this.assertActorOwnsChain(actor, assignment.vendor.chainId);
    } else {
      throw new ForbiddenException(
        "Only Champs and Area Managers can create Deduction tickets."
      );
    }

    return {
      targetUser,
      targetRole: UserRole.PICKER,
      assignmentId: assignment.id,
      assignmentType: "PickerBranchAssignment",
      sourceVendorId: assignment.vendorId,
      sourceVendorName: assignment.vendor.vendorName,
      sourceChainId: assignment.vendor.chainId,
      sourceChainName: assignment.vendor.chain.chainName
    };
  }

  private async resolveChampTarget(
    targetUser: Prisma.UserGetPayload<{ select: typeof TARGET_USER_SELECT }>,
    actor: AuthenticatedUser,
    sourceVendorId?: string | null
  ): Promise<DeductionTargetContext> {
    if (actor.role !== UserRole.AREA_MANAGER) {
      throw new ForbiddenException(
        "Only Area Managers can target Champs with Deduction tickets."
      );
    }

    const chainIds = await this.resolveActorChainIds(actor);
    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: {
        champId: targetUser.id,
        status: AssignmentStatus.ACTIVE,
        vendor: { chainId: { in: chainIds } },
        ...(sourceVendorId ? { vendorId: sourceVendorId } : {})
      },
      include: { vendor: { include: { chain: true } } }
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You can create Deduction tickets only for Champs in your assigned Chains."
      );
    }

    return {
      targetUser,
      targetRole: UserRole.CHAMP,
      assignmentId: assignment.id,
      assignmentType: "VendorChampAssignment",
      sourceVendorId: assignment.vendorId,
      sourceVendorName: assignment.vendor.vendorName,
      sourceChainId: assignment.vendor.chainId,
      sourceChainName: assignment.vendor.chain.chainName
    };
  }

  private async assertActorOwnsChain(actor: AuthenticatedUser, chainId: string) {
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        areaManagerId: actor.id,
        chainId,
        status: AssignmentStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You can create Deduction tickets only within your assigned Chains."
      );
    }
  }
}
