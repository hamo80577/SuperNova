import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toVendorSummary
} from "../../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { SearchOffboardingPickersDto } from "../dto/search-offboarding-pickers.dto";
import {
  areaManagerAssignmentInclude,
  champAssignmentInclude,
  openRequestStatuses,
  pickerAssignmentInclude
} from "./offboarding-types";
import type { OffboardingTargetRole } from "./offboarding-workflow.policy";
import {
  toEligibleUserSearchCard,
  toPickerSearchCard
} from "./offboarding-response.utils";

@Injectable()
export class OffboardingSearchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async searchOffboardingEligibleUsers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser,
    targetRole: OffboardingTargetRole
  ) {
    if (targetRole === UserRole.PICKER) {
      return this.searchScopedPickers(dto, currentUser);
    }

    if (targetRole === UserRole.CHAMP) {
      return this.searchScopedChamps(dto, currentUser);
    }

    return this.searchScopedAreaManagers(dto, currentUser);
  }

  async searchScopedPickers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    const q = dto.q?.trim();
    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: this.buildScopedPickerAssignmentWhere(
        currentUser,
        dto.sourceVendorId,
        q
      ),
      include: pickerAssignmentInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 20
    });

    const pendingByUserId = await this.getPendingResignationByUserId(
      assignments.map((assignment) => assignment.pickerId)
    );

    return {
      items: assignments.map((assignment) =>
        toPickerSearchCard(
          assignment,
          pendingByUserId.get(assignment.pickerId) ?? null
        )
      )
    };
  }

  async searchScopedChamps(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: this.buildScopedChampAssignmentWhere(
        currentUser,
        dto.sourceVendorId,
        dto.sourceChainId,
        dto.q
      ),
      include: champAssignmentInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 20
    });
    const pendingByUserId = await this.getPendingResignationByUserId(
      assignments.map((assignment) => assignment.champId)
    );

    return {
      items: assignments.map((assignment) =>
        toEligibleUserSearchCard({
          assignmentId: assignment.id,
          assignmentStartDate: assignment.startDate,
          assignmentType: "VendorChampAssignment",
          chain: toChainSummary(assignment.vendor.chain),
          pendingResignationRequestId:
            pendingByUserId.get(assignment.champId) ?? null,
          role: UserRole.CHAMP,
          user: assignment.champ,
          vendor: toVendorSummary(assignment.vendor)
        })
      )
    };
  }

  async searchScopedAreaManagers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException(
        "Only Admins can search Area Managers for Resignation."
      );
    }

    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: this.buildScopedAreaManagerAssignmentWhere(dto.sourceChainId, dto.q),
      include: areaManagerAssignmentInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 20
    });
    const pendingByUserId = await this.getPendingResignationByUserId(
      assignments.map((assignment) => assignment.areaManagerId)
    );

    return {
      items: assignments.map((assignment) =>
        toEligibleUserSearchCard({
          assignmentId: assignment.id,
          assignmentStartDate: assignment.startDate,
          assignmentType: "ChainAreaManagerAssignment",
          chain: toChainSummary(assignment.chain),
          pendingResignationRequestId:
            pendingByUserId.get(assignment.areaManagerId) ?? null,
          role: UserRole.AREA_MANAGER,
          user: assignment.areaManager
        })
      )
    };
  }

  buildScopedPickerAssignmentWhere(
    actor: AuthenticatedUser,
    sourceVendorId?: string,
    q?: string
  ): Prisma.PickerBranchAssignmentWhereInput {
    const search = q?.trim();
    const vendorWhere: Prisma.VendorWhereInput = {
      status: VendorStatus.ACTIVE,
      chain: { status: ChainStatus.ACTIVE }
    };

    if (sourceVendorId) {
      vendorWhere.id = sourceVendorId;
    }

    if (actor.role === UserRole.CHAMP) {
      vendorWhere.champAssignments = {
        some: { champId: actor.id, status: AssignmentStatus.ACTIVE }
      };
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      vendorWhere.chain = {
        status: ChainStatus.ACTIVE,
        areaManagerAssignments: {
          some: { areaManagerId: actor.id, status: AssignmentStatus.ACTIVE }
        }
      };
    }

    const where: Prisma.PickerBranchAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      vendor: vendorWhere,
      picker: {
        role: UserRole.PICKER,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE
      }
    };

    if (search) {
      where.OR = [
        { picker: { nameEn: { contains: search, mode: "insensitive" } } },
        { picker: { nameAr: { contains: search, mode: "insensitive" } } },
        { picker: { phoneNumber: { contains: search } } },
        { picker: { shopperId: { contains: search, mode: "insensitive" } } },
        { picker: { ibsId: { contains: search, mode: "insensitive" } } },
        { vendor: { vendorName: { contains: search, mode: "insensitive" } } },
        { vendor: { vendorCode: { contains: search, mode: "insensitive" } } },
        {
          vendor: {
            chain: { chainName: { contains: search, mode: "insensitive" } }
          }
        },
        {
          vendor: {
            chain: { chainCode: { contains: search, mode: "insensitive" } }
          }
        }
      ];
    }

    return where;
  }

  buildScopedChampAssignmentWhere(
    actor: AuthenticatedUser,
    sourceVendorId?: string,
    sourceChainId?: string,
    q?: string
  ): Prisma.VendorChampAssignmentWhereInput {
    const search = q?.trim();
    const vendorWhere: Prisma.VendorWhereInput = {
      status: VendorStatus.ACTIVE,
      chain: { status: ChainStatus.ACTIVE }
    };

    if (sourceVendorId) {
      vendorWhere.id = sourceVendorId;
    }

    if (sourceChainId) {
      vendorWhere.chainId = sourceChainId;
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      vendorWhere.chain = {
        status: ChainStatus.ACTIVE,
        areaManagerAssignments: {
          some: { areaManagerId: actor.id, status: AssignmentStatus.ACTIVE }
        }
      };
    }

    const where: Prisma.VendorChampAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      vendor: vendorWhere,
      champ: {
        role: UserRole.CHAMP,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE
      }
    };

    if (search) {
      where.OR = [
        { champ: { nameEn: { contains: search, mode: "insensitive" } } },
        { champ: { nameAr: { contains: search, mode: "insensitive" } } },
        { champ: { phoneNumber: { contains: search } } },
        { vendor: { vendorName: { contains: search, mode: "insensitive" } } },
        { vendor: { vendorCode: { contains: search, mode: "insensitive" } } },
        {
          vendor: {
            chain: { chainName: { contains: search, mode: "insensitive" } }
          }
        },
        {
          vendor: {
            chain: { chainCode: { contains: search, mode: "insensitive" } }
          }
        }
      ];
    }

    return where;
  }

  buildScopedAreaManagerAssignmentWhere(
    sourceChainId?: string,
    q?: string
  ): Prisma.ChainAreaManagerAssignmentWhereInput {
    const search = q?.trim();
    const where: Prisma.ChainAreaManagerAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      chain: {
        status: ChainStatus.ACTIVE,
        ...(sourceChainId ? { id: sourceChainId } : {})
      },
      areaManager: {
        role: UserRole.AREA_MANAGER,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE
      }
    };

    if (search) {
      where.OR = [
        { areaManager: { nameEn: { contains: search, mode: "insensitive" } } },
        { areaManager: { nameAr: { contains: search, mode: "insensitive" } } },
        { areaManager: { phoneNumber: { contains: search } } },
        { chain: { chainName: { contains: search, mode: "insensitive" } } },
        { chain: { chainCode: { contains: search, mode: "insensitive" } } }
      ];
    }

    return where;
  }

  async getPendingResignationByUserId(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds));
    const pendingRequests = uniqueIds.length
      ? await this.prisma.request.findMany({
          where: {
            type: RequestType.RESIGNATION,
            targetUserId: { in: uniqueIds },
            status: { in: openRequestStatuses }
          },
          select: { id: true, targetUserId: true }
        })
      : [];

    return new Map(
      pendingRequests.map((request) => [request.targetUserId, request.id])
    );
  }

  private isAdmin(actor: AuthenticatedUser) {
    return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  }
}
