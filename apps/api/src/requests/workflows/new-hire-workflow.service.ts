import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalStep,
  AssignmentStatus,
  ChainStatus,
  Gender,
  UserRole,
  VendorStatus
} from "@prisma/client";

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import type { ApprovalDecisionDto } from "../../approvals/dto/approval-decision.dto";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateNewHireRequestDto } from "../dto/create-new-hire-request.dto";
import type { FinalizeNewHireDto } from "../dto/finalize-new-hire.dto";
import type { LookupNewHireCandidateDto } from "../dto/lookup-new-hire-candidate.dto";
import { RequestApprovalRoutingService } from "../request-approval-routing.service";
import {
  getAllowedNewHireTargetRolesForCreator,
  normalizeNewHireShopperId,
  normalizeNewHireTargetRole,
  normalizeOptionalNewHireShopperId,
  validateEgyptNationalId,
  validateEgyptPhoneNumber,
  type NewHireTargetRole
} from "./new-hire-workflow.policy";
import { NewHireApprovalService } from "./new-hire-approval.service";
import { NewHireCandidateService } from "./new-hire-candidate.service";
import { NewHireFinalizationService } from "./new-hire-finalization.service";
import { NewHireRequestCreationService } from "./new-hire-request-creation.service";
import type { BranchNewHireContext, RequestContext } from "./new-hire-workflow.types";
import { normalizeRequiredDateOnly } from "./request-date";

@Injectable()
export class NewHireWorkflowService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NewHireCandidateService)
    private readonly newHireCandidateService: NewHireCandidateService,
    @Inject(NewHireFinalizationService)
    private readonly newHireFinalizationService: NewHireFinalizationService,
    @Inject(NewHireRequestCreationService)
    private readonly newHireRequestCreationService: NewHireRequestCreationService,
    @Inject(NewHireApprovalService)
    private readonly newHireApprovalService: NewHireApprovalService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService
  ) {}

  async lookupNewHireCandidate(
    dto: LookupNewHireCandidateDto,
    currentUser: AuthenticatedUser
  ) {
    return this.newHireCandidateService.lookupNewHireCandidate(dto, currentUser);
  }

  async createNewHire(dto: CreateNewHireRequestDto, context: RequestContext) {
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    this.assertCreatorCanCreateTargetRole(context.actor, targetRole);

    if (dto.rehireUserId && targetRole === UserRole.AREA_MANAGER) {
      throw new BadRequestException(
        "Rehire applies to Picker or Champ New Hire only."
      );
    }

    const candidate = this.normalizeNewHireCandidate(dto, targetRole);
    const rehireValidation =
      await this.newHireCandidateService.validateNewHireCandidateForCreate(
        candidate,
        dto.rehireUserId,
        targetRole
      );

    if (targetRole === UserRole.AREA_MANAGER) {
      this.assertNoCreateShopperId(dto);
      return this.newHireRequestCreationService.createAreaManagerNewHire(
        candidate,
        { targetRole: UserRole.AREA_MANAGER },
        context
      );
    }

    let branchContext = await this.resolveBranchNewHireContext(
      dto,
      context.actor,
      targetRole
    );

    if (context.actor.role === UserRole.AREA_MANAGER && targetRole === UserRole.PICKER) {
      const shopperId = this.normalizeShopperId(
        dto.shopperId,
        "Shopper ID is required when Area Manager submits Picker New Hire."
      );
      await this.assertShopperIdAvailable(
        shopperId,
        rehireValidation.rehireUser?.id
      );
      branchContext = {
        ...branchContext,
        areaManagerCapturedShopperId: shopperId
      };
    } else {
      this.assertNoCreateShopperId(dto);
    }

    return this.newHireRequestCreationService.createBranchNewHire(
      candidate,
      branchContext,
      rehireValidation,
      context
    );
  }

  async finalizeNewHire(
    id: string,
    dto: FinalizeNewHireDto,
    context: RequestContext
  ) {
    return this.newHireFinalizationService.finalizeNewHire(id, dto, context);
  }

  async approveAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    return this.newHireApprovalService.approveAreaManagerApproval(
      approvalId,
      dto,
      context
    );
  }

  private assertCreatorCanCreateTargetRole(
    actor: AuthenticatedUser,
    targetRole: NewHireTargetRole
  ) {
    const allowedRoles = getAllowedNewHireTargetRolesForCreator(actor.role);
    if (allowedRoles.includes(targetRole)) {
      return;
    }

    throw new ForbiddenException(
      "Only Champs, Area Managers, and Admins can submit New Hire requests."
    );
  }

  private async resolveBranchNewHireContext(
    dto: CreateNewHireRequestDto,
    actor: AuthenticatedUser,
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">
  ): Promise<BranchNewHireContext> {
    if (!dto.sourceVendorId) {
      throw new BadRequestException(
        `${this.formatTargetRole(targetRole)} New Hire requires sourceVendorId.`
      );
    }

    if (actor.role === UserRole.CHAMP) {
      const assignment = await this.prisma.vendorChampAssignment.findFirst({
        where: {
          champId: actor.id,
          vendorId: dto.sourceVendorId,
          status: AssignmentStatus.ACTIVE,
          vendor: {
            status: VendorStatus.ACTIVE,
            chain: { status: ChainStatus.ACTIVE }
          }
        },
        include: {
          vendor: { include: { chain: true } }
        }
      });

      if (!assignment) {
        throw new ForbiddenException(
          "You can submit New Hire requests only for assigned active Branches."
        );
      }

      return {
        targetRole,
        sourceVendor: assignment.vendor,
        areaManagerStep:
          await this.requestApprovalRoutingService.resolveAreaManagerStep(
            ApprovalStep.AREA_MANAGER_APPROVAL,
            assignment.vendor.chainId
          ),
        skipAreaManagerApproval: false
      };
    }

    const sourceVendor = await this.findActiveVendorOrThrow(dto.sourceVendorId);

    if (actor.role === UserRole.AREA_MANAGER) {
      await this.assertAreaManagerCanUseChain(
        actor.id,
        sourceVendor.chainId,
        "Area Managers can submit New Hire requests only within assigned Chain scope."
      );
      await this.assertBranchCanReceiveChampNewHire(targetRole, sourceVendor.id);

      return {
        targetRole,
        sourceVendor,
        areaManagerStep: {
          step: ApprovalStep.AREA_MANAGER_APPROVAL,
          approverRole: UserRole.AREA_MANAGER,
          approverId: actor.id,
          chainId: sourceVendor.chainId
        },
        skipAreaManagerApproval: true
      };
    }

    await this.assertBranchCanReceiveChampNewHire(targetRole, sourceVendor.id);

    return {
      targetRole,
      sourceVendor,
      areaManagerStep:
        await this.requestApprovalRoutingService.resolveAreaManagerStep(
          ApprovalStep.AREA_MANAGER_APPROVAL,
          sourceVendor.chainId
        ),
      skipAreaManagerApproval: false
    };
  }

  private async assertBranchCanReceiveChampNewHire(
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">,
    sourceVendorId: string
  ) {
    if (targetRole !== UserRole.CHAMP) {
      return;
    }

    const activeChampAssignment = await this.prisma.vendorChampAssignment.findFirst({
      where: {
        vendorId: sourceVendorId,
        status: AssignmentStatus.ACTIVE
      },
      include: { champ: true }
    });

    if (!activeChampAssignment) {
      return;
    }

    throw new ConflictException(
      `Selected Branch already has an active Champ: ${activeChampAssignment.champ.nameEn}. One Branch can have one active Champ only.`
    );
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

  private normalizeNewHireCandidate(
    dto: CreateNewHireRequestDto,
    targetRole: NewHireTargetRole
  ) {
    const nameEn = dto.nameEn?.trim();
    const nameAr = dto.nameAr?.trim();
    const address = dto.address?.trim();
    const notes = dto.notes?.trim();
    const isRehire = Boolean(dto.rehireUserId);
    const actualJoiningDate =
      targetRole === UserRole.PICKER
        ? this.applyPolicyValidation(() =>
            normalizeRequiredDateOnly(
              dto.actualJoiningDate,
              "actualJoiningDate",
              "actualJoiningDate is required for Picker New Hire/Rehire."
            )
          )
        : undefined;

    if (!nameEn && !nameAr && !isRehire) {
      throw new BadRequestException("Candidate English or Arabic name is required.");
    }

    return {
      ...(nameEn ? { nameEn } : {}),
      ...(nameAr ? { nameAr } : {}),
      phoneNumber: this.applyPolicyValidation(() =>
        validateEgyptPhoneNumber(dto.phoneNumber)
      ),
      nationalId: this.applyPolicyValidation(() =>
        validateEgyptNationalId(dto.nationalId)
      ),
      ...(address ? { address } : {}),
      ...(actualJoiningDate ? { actualJoiningDate } : {}),
      ...(dto.dateOfBirth ? { dateOfBirth: dto.dateOfBirth } : {}),
      ...(dto.gender ? { gender: dto.gender } : isRehire ? {} : { gender: Gender.UNSPECIFIED }),
      ...(notes ? { notes } : {})
    };
  }

  private normalizeTargetRole(
    targetRole: UserRole | string | null | undefined
  ): NewHireTargetRole {
    return this.applyPolicyValidation(() =>
      normalizeNewHireTargetRole(targetRole)
    );
  }

  private normalizeShopperId(value: string | null | undefined, message: string) {
    return this.applyPolicyValidation(() => normalizeNewHireShopperId(value, message));
  }

  private assertNoCreateShopperId(dto: CreateNewHireRequestDto) {
    const submittedShopperId = this.applyPolicyValidation(() =>
      normalizeOptionalNewHireShopperId(dto.shopperId)
    );

    if (submittedShopperId) {
      throw new BadRequestException(
        "Shopper ID can be submitted only by Area Managers for Picker New Hire."
      );
    }
  }

  private async assertShopperIdAvailable(shopperId: string, rehireUserId?: string) {
    const existingShopper = await this.prisma.user.findUnique({
      where: { shopperId }
    });

    if (existingShopper && existingShopper.id !== rehireUserId) {
      throw new ConflictException("Shopper ID is already assigned to another user.");
    }
  }

  private formatTargetRole(targetRole: NewHireTargetRole) {
    return String(targetRole)
      .toLowerCase()
      .split("_")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
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

}
