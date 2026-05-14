import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { LookupNewHireCandidateDto } from "../dto/lookup-new-hire-candidate.dto";
import {
  normalizeNewHireTargetRole,
  toNewHireLookupStatus,
  validateEgyptNationalId,
  validateEgyptPhoneNumber,
  type NewHireTargetRole
} from "./new-hire-workflow.policy";
import type {
  CandidateUser,
  NewHireCandidateMatch,
  NormalizedNewHireCandidate
} from "./new-hire-workflow.types";

const candidateUserInclude = {
  pickerBranchAssignments: {
    include: { vendor: { include: { chain: true } } },
    orderBy: { startDate: "desc" as const },
    take: 5
  },
  vendorChampAssignments: {
    include: { vendor: { include: { chain: true } } },
    orderBy: { startDate: "desc" as const },
    take: 5
  },
  chainAreaManagerAssignments: {
    include: { chain: true },
    orderBy: { startDate: "desc" as const },
    take: 5
  }
} satisfies Prisma.UserInclude;

type CandidateIdentity = {
  phoneNumber?: string;
  nationalId?: string;
};

@Injectable()
export class NewHireCandidateService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async lookupNewHireCandidate(
    dto: LookupNewHireCandidateDto,
    currentUser: AuthenticatedUser
  ) {
    const targetRole = this.normalizeTargetRole(dto.targetRole);

    if (
      currentUser.role !== UserRole.CHAMP &&
      currentUser.role !== UserRole.AREA_MANAGER &&
      !this.isAdmin(currentUser)
    ) {
      throw new ForbiddenException(
        "Only Champs, Area Managers, and Admins can look up New Hire candidates."
      );
    }

    await this.assertLookupScope(dto, targetRole, currentUser);

    const candidate = this.normalizeLookupIdentity(dto);
    const matches = await this.findNewHireCandidateMatches(candidate, targetRole);

    return {
      status: toNewHireLookupStatus(matches.map((match) => match.decision)),
      candidates: matches.map((match) => ({
        decision: match.decision,
        matchedBy: match.matchedBy,
        reason: match.reason,
        user: toUserSummary(match.user),
        role: match.user.role,
        blockStatus: match.user.blockStatus,
        accountStatus: match.user.accountStatus,
        employmentStatus: match.user.employmentStatus,
        maskedNationalId: this.maskNationalId(match.user.nationalId),
        blockReason: match.user.blockReason,
        blockedUntil: match.blockedUntil,
        remainingDays: match.remainingDays,
        lastBranch: this.getLastBranch(match.user),
        lastChain: this.getLastChain(match.user),
        gender: match.user.gender
      }))
    };
  }

  async validateNewHireCandidateForCreate(
    candidate: NormalizedNewHireCandidate,
    rehireUserId: string | undefined,
    targetRole: NewHireTargetRole
  ) {
    if (rehireUserId && targetRole !== UserRole.PICKER) {
      throw new BadRequestException("Rehire applies to Picker New Hire only.");
    }

    const matches = await this.findNewHireCandidateMatches(candidate, targetRole);
    const selectedMatch = rehireUserId
      ? matches.find((match) => match.user.id === rehireUserId)
      : null;

    if (rehireUserId && !selectedMatch) {
      throw new BadRequestException(
        "Selected previous Picker does not match this phone number or National ID."
      );
    }

    const blockingMatch = selectedMatch
      ? selectedMatch.decision !== "REHIRE_AVAILABLE"
        ? selectedMatch
        : null
      : matches.find((match) => match.decision !== "REHIRE_AVAILABLE");

    if (blockingMatch) {
      throw new ConflictException(
        blockingMatch.reason ?? "Candidate cannot be submitted for New Hire."
      );
    }

    const rehireMatch =
      selectedMatch ??
      matches.find((match) => match.decision === "REHIRE_AVAILABLE") ??
      null;

    if (rehireMatch && !rehireUserId) {
      throw new ConflictException(
        "Previous Picker record found. Select the previous Picker to submit this as a Rehire request."
      );
    }

    await this.assertNoDuplicatePendingNewHire(candidate, rehireMatch?.user.id);

    return {
      rehireUser: rehireMatch?.user ?? null,
      matchedBy: rehireMatch?.matchedBy ?? []
    };
  }

  async findCandidateUserById(userId: string): Promise<CandidateUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: candidateUserInclude
    });
  }

  evaluateNewHireMatch(
    user: CandidateUser,
    candidate: CandidateIdentity,
    targetRole: NewHireTargetRole
  ): NewHireCandidateMatch {
    const matchedBy: Array<"phoneNumber" | "nationalId"> = [];
    if (candidate.phoneNumber && user.phoneNumber === candidate.phoneNumber) {
      matchedBy.push("phoneNumber");
    }
    if (candidate.nationalId && user.nationalId === candidate.nationalId) {
      matchedBy.push("nationalId");
    }

    if (user.blockStatus === BlockStatus.PERMANENT_BLOCK) {
      return {
        user,
        matchedBy,
        decision: "PERMANENT_BLOCKED",
        reason:
          "This user has a permanent block and cannot be rehired until Admin removes the block."
      };
    }

    if (
      user.blockStatus === BlockStatus.TEMPORARY_BLOCK &&
      (!user.blockedUntil || user.blockedUntil.getTime() > Date.now())
    ) {
      return {
        user,
        matchedBy,
        decision: "TEMPORARY_BLOCKED",
        blockedUntil: user.blockedUntil?.toISOString() ?? null,
        remainingDays: this.getRemainingDays(user.blockedUntil),
        reason: user.blockedUntil
          ? `This user has a temporary block until ${user.blockedUntil.toISOString()}.`
          : "This user has an active temporary block."
      };
    }

    const activePickerAssignment = user.pickerBranchAssignments.some(
      (assignment) => assignment.status === AssignmentStatus.ACTIVE
    );
    const canRehirePicker =
      targetRole === UserRole.PICKER &&
      user.role === UserRole.PICKER &&
      user.accountStatus !== AccountStatus.ACTIVE &&
      user.employmentStatus !== EmploymentStatus.ACTIVE &&
      !activePickerAssignment;

    if (canRehirePicker) {
      return {
        user,
        matchedBy,
        decision: "REHIRE_AVAILABLE",
        reason: "Previous inactive Picker can be rehired."
      };
    }

    return {
      user,
      matchedBy,
      decision: "ACTIVE_DUPLICATE",
      reason:
        user.role === UserRole.PICKER && activePickerAssignment
          ? "Previous Picker already has an active Branch assignment."
          : "A user already exists with this phone number or National ID."
    };
  }

  private async findNewHireCandidateMatches(
    candidate: CandidateIdentity,
    targetRole: NewHireTargetRole
  ): Promise<NewHireCandidateMatch[]> {
    const phoneNumber = candidate.phoneNumber?.trim();
    const nationalId = candidate.nationalId?.trim();
    const or: Prisma.UserWhereInput[] = [];

    if (phoneNumber) {
      or.push({ phoneNumber });
    }

    if (nationalId) {
      or.push({ nationalId });
    }

    if (!or.length) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { OR: or },
      include: candidateUserInclude,
      orderBy: [{ accountStatus: "asc" }, { updatedAt: "desc" }]
    });

    return users.map((user) =>
      this.evaluateNewHireMatch(user, candidate, targetRole)
    );
  }

  private async assertLookupScope(
    dto: LookupNewHireCandidateDto,
    targetRole: NewHireTargetRole,
    currentUser: AuthenticatedUser
  ) {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (currentUser.role === UserRole.CHAMP) {
      if (targetRole !== UserRole.PICKER) {
        throw new ForbiddenException("Champs can look up Picker New Hire only.");
      }

      await this.assertChampCanUseSourceVendor(currentUser.id, dto.sourceVendorId);
      return;
    }

    if (currentUser.role === UserRole.AREA_MANAGER) {
      if (targetRole === UserRole.AREA_MANAGER) {
        throw new ForbiddenException(
          "Area Managers cannot look up Area Manager New Hire candidates."
        );
      }

      if (dto.sourceVendorId) {
        const vendor = await this.findActiveVendorOrThrow(dto.sourceVendorId);
        await this.assertAreaManagerCanUseChain(
          currentUser.id,
          vendor.chainId,
          "Area Managers can look up candidates only within assigned Chain scope."
        );
        return;
      }

      const chainIds = this.normalizeChainIds(dto);
      if (!chainIds.length) {
        throw new BadRequestException(
          "sourceVendorId, sourceChainId, or chainIds is required for Area Manager New Hire candidate lookup."
        );
      }

      await this.assertAreaManagerCanUseChains(
        currentUser.id,
        chainIds,
        "Area Managers can look up candidates only within assigned Chain scope."
      );
    }
  }

  private async assertChampCanUseSourceVendor(
    champId: string,
    sourceVendorId?: string
  ) {
    if (!sourceVendorId) {
      throw new BadRequestException(
        "sourceVendorId is required for Champ New Hire candidate lookup."
      );
    }

    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: {
        champId,
        vendorId: sourceVendorId,
        status: AssignmentStatus.ACTIVE,
        vendor: {
          status: VendorStatus.ACTIVE,
          chain: { status: ChainStatus.ACTIVE }
        }
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You can use New Hire only for assigned active Branches."
      );
    }
  }

  private async assertAreaManagerCanUseChain(
    areaManagerId: string,
    chainId: string,
    message: string
  ) {
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        areaManagerId,
        chainId,
        status: AssignmentStatus.ACTIVE,
        chain: { status: ChainStatus.ACTIVE }
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ForbiddenException(message);
    }
  }

  private async assertAreaManagerCanUseChains(
    areaManagerId: string,
    chainIds: string[],
    message: string
  ) {
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        areaManagerId,
        chainId: { in: chainIds },
        status: AssignmentStatus.ACTIVE,
        chain: { status: ChainStatus.ACTIVE }
      },
      select: { chainId: true }
    });

    const assignedChainIds = new Set(
      assignments.map((assignment) => assignment.chainId)
    );
    const missing = chainIds.filter((chainId) => !assignedChainIds.has(chainId));

    if (missing.length) {
      throw new ForbiddenException(message);
    }
  }

  private async findActiveVendorOrThrow(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { chain: true }
    });

    if (!vendor) {
      throw new NotFoundException("Selected Branch was not found.");
    }

    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch is not active.");
    }

    if (vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch Chain is not active.");
    }

    return vendor;
  }

  private async assertNoDuplicatePendingNewHire(
    candidate: NormalizedNewHireCandidate,
    rehireUserId?: string
  ) {
    const statusFilter = {
      notIn: [RequestStatus.REJECTED, RequestStatus.CANCELLED, RequestStatus.COMPLETED]
    };
    const or: Prisma.RequestWhereInput[] = [];

    if (rehireUserId) {
      or.push({ targetUserId: rehireUserId });
    }

    or.push({
      payload: {
        path: ["candidate", "phoneNumber"],
        equals: candidate.phoneNumber
      }
    });

    or.push({
      payload: {
        path: ["candidate", "nationalId"],
        equals: candidate.nationalId
      }
    });

    const duplicate = await this.prisma.request.findFirst({
      where: {
        type: RequestType.NEW_HIRE,
        status: statusFilter,
        OR: or
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException(
        "A pending New Hire or Rehire request already exists for this candidate."
      );
    }
  }

  private normalizeLookupIdentity(dto: LookupNewHireCandidateDto) {
    const phoneNumber = dto.phoneNumber?.trim();
    const nationalId = dto.nationalId?.trim();

    if (!phoneNumber && !nationalId) {
      throw new BadRequestException("Phone number or National ID is required.");
    }

    return {
      ...(phoneNumber
        ? {
            phoneNumber: this.applyPolicyValidation(() =>
              validateEgyptPhoneNumber(phoneNumber)
            )
          }
        : {}),
      ...(nationalId
        ? {
            nationalId: this.applyPolicyValidation(() =>
              validateEgyptNationalId(nationalId)
            )
          }
        : {})
    };
  }

  private normalizeTargetRole(
    targetRole: UserRole | string | null | undefined
  ): NewHireTargetRole {
    return this.applyPolicyValidation(() =>
      normalizeNewHireTargetRole(targetRole)
    );
  }

  private normalizeChainIds(dto: {
    sourceChainId?: string;
    chainIds?: string[];
  }) {
    return Array.from(
      new Set([...(dto.chainIds ?? []), dto.sourceChainId].filter(Boolean))
    ) as string[];
  }

  private getLastBranch(user: CandidateUser) {
    const pickerAssignment = user.pickerBranchAssignments[0];
    if (pickerAssignment) {
      return toVendorSummary(pickerAssignment.vendor);
    }

    const champAssignment = user.vendorChampAssignments[0];
    if (champAssignment) {
      return toVendorSummary(champAssignment.vendor);
    }

    return null;
  }

  private getLastChain(user: CandidateUser) {
    const lastBranch = this.getLastBranch(user);
    if (lastBranch?.chain) {
      return lastBranch.chain;
    }

    const areaManagerAssignment = user.chainAreaManagerAssignments[0];
    if (areaManagerAssignment) {
      return toChainSummary(areaManagerAssignment.chain);
    }

    return null;
  }

  private getRemainingDays(blockedUntil: Date | null) {
    if (!blockedUntil) {
      return null;
    }

    return Math.max(
      0,
      Math.ceil((blockedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
  }

  private maskNationalId(nationalId: string | null) {
    if (!nationalId) {
      return null;
    }

    if (nationalId.length <= 4) {
      return "*".repeat(nationalId.length);
    }

    const visibleSuffix = nationalId.slice(-4);
    return `${"*".repeat(Math.max(0, nationalId.length - visibleSuffix.length))}${visibleSuffix}`;
  }

  private applyPolicyValidation<T>(callback: () => T) {
    try {
      return callback();
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }
}
