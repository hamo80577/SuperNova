import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { ApprovalStep, UserRole } from "@prisma/client";

import type { ApprovalDecisionDto } from "../../approvals/dto/approval-decision.dto";
import type { CreateOffboardingRequestDto } from "../dto/create-offboarding-request.dto";
import type { FinalizeOffboardingDto } from "../dto/finalize-offboarding.dto";
import type { SearchOffboardingPickersDto } from "../dto/search-offboarding-pickers.dto";
import { RequestApprovalRoutingService } from "../request-approval-routing.service";
import { OffboardingApprovalService } from "./offboarding-approval.service";
import { OffboardingFinalizationService } from "./offboarding-finalization.service";
import { OffboardingRequestCreationService } from "./offboarding-request-creation.service";
import { OffboardingSearchService } from "./offboarding-search.service";
import { OffboardingTargetService } from "./offboarding-target.service";
import type {
  OffboardingPayload,
  OffboardingRequestContext
} from "./offboarding-types";
import {
  getAllowedResignationTargetRolesForCreator,
  normalizeOffboardingBlockDecision,
  normalizeOffboardingReason,
  normalizeOffboardingTargetRole,
  type OffboardingTargetRole
} from "./offboarding-workflow.policy";

@Injectable()
export class OffboardingWorkflowService {
  constructor(
    @Inject(OffboardingSearchService)
    private readonly searchService: OffboardingSearchService,
    @Inject(OffboardingTargetService)
    private readonly targetService: OffboardingTargetService,
    @Inject(OffboardingRequestCreationService)
    private readonly requestCreationService: OffboardingRequestCreationService,
    @Inject(OffboardingApprovalService)
    private readonly approvalService: OffboardingApprovalService,
    @Inject(OffboardingFinalizationService)
    private readonly finalizationService: OffboardingFinalizationService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService
  ) {}

  async searchOffboardingPickers(
    dto: SearchOffboardingPickersDto,
    currentUser: OffboardingRequestContext["actor"]
  ) {
    return this.searchOffboardingEligibleUsers(
      { ...dto, targetRole: UserRole.PICKER },
      currentUser
    );
  }

  async searchOffboardingEligibleUsers(
    dto: SearchOffboardingPickersDto,
    currentUser: OffboardingRequestContext["actor"]
  ) {
    this.assertCanUseOffboarding(currentUser);
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    this.assertCanUseTargetRole(currentUser, targetRole);

    return this.searchService.searchOffboardingEligibleUsers(
      dto,
      currentUser,
      targetRole
    );
  }

  async createOffboarding(
    dto: CreateOffboardingRequestDto,
    context: OffboardingRequestContext
  ) {
    this.assertCanUseOffboarding(context.actor);
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    this.assertCanUseTargetRole(context.actor, targetRole);

    const offboarding = normalizeOffboardingReason(dto, targetRole);
    const target = await this.targetService.resolveScopedActiveTarget(
      dto.targetUserId,
      targetRole,
      dto.sourceVendorId,
      dto.sourceChainId,
      context.actor
    );
    await this.requestCreationService.assertNoPendingOffboarding(
      target.targetUser.id
    );

    if (context.actor.role === UserRole.AREA_MANAGER) {
      if (!dto.blockDecision?.trim()) {
        throw new BadRequestException(
          "Area Manager block decision is required for Picker or Champ Resignation."
        );
      }

      const decision = normalizeOffboardingBlockDecision({
        blockDecision: dto.blockDecision,
        blockReason: dto.blockReason
      });
      const payload: OffboardingPayload = {
        offboarding,
        source: {
          ...(target.sourceVendorId ? { vendorId: target.sourceVendorId } : {}),
          chainId: target.sourceChainId
        },
        target: {
          userId: target.targetUser.id,
          targetRole: target.targetRole,
          assignmentId: target.assignmentId,
          assignmentType: target.assignmentType
        },
        areaManagerDecision: {
          decidedAt: new Date().toISOString(),
          decidedById: context.actor.id,
          blockDecision: decision.blockDecision,
          blockStatus: decision.blockStatus,
          blockReason: decision.blockReason
        }
      };
      return this.requestCreationService.createAreaManagerSubmittedRequest(
        target,
        payload,
        context
      );
    }

    if (targetRole === UserRole.AREA_MANAGER) {
      const payload: OffboardingPayload = {
        offboarding,
        source: { chainId: target.sourceChainId },
        target: {
          userId: target.targetUser.id,
          targetRole: target.targetRole,
          assignmentId: target.assignmentId,
          assignmentType: target.assignmentType
        }
      };
      return this.requestCreationService.createAdminSubmittedRequest(
        target,
        payload,
        context
      );
    }

    const areaManagerStep =
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
        ApprovalStep.AREA_MANAGER_APPROVAL,
        target.sourceChainId
      );
    const payload: OffboardingPayload = {
      offboarding,
      source: {
        ...(target.sourceVendorId ? { vendorId: target.sourceVendorId } : {}),
        chainId: target.sourceChainId
      },
      target: {
        userId: target.targetUser.id,
        targetRole: target.targetRole,
        assignmentId: target.assignmentId,
        assignmentType: target.assignmentType
      }
    };
    return this.requestCreationService.createApprovalRoutedRequest(
      target,
      areaManagerStep,
      payload,
      context
    );
  }

  async approveAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: OffboardingRequestContext
  ) {
    return this.approvalService.approveAreaManagerApproval(
      approvalId,
      dto,
      context
    );
  }

  async finalizeOffboarding(
    id: string,
    dto: FinalizeOffboardingDto,
    context: OffboardingRequestContext
  ) {
    return this.finalizationService.finalizeOffboarding(id, dto, context);
  }

  private assertCanUseOffboarding(actor: OffboardingRequestContext["actor"]) {
    if (
      actor.role !== UserRole.CHAMP &&
      actor.role !== UserRole.AREA_MANAGER &&
      !this.isAdmin(actor)
    ) {
      throw new ForbiddenException(
        "Only Champs, Area Managers, and Admins can use Resignation workflows."
      );
    }
  }

  private normalizeTargetRole(
    targetRole: UserRole | string | null | undefined
  ) {
    return normalizeOffboardingTargetRole(targetRole);
  }

  private assertCanUseTargetRole(
    actor: OffboardingRequestContext["actor"],
    targetRole: OffboardingTargetRole
  ) {
    const allowedRoles = getAllowedResignationTargetRolesForCreator(actor.role);

    if (allowedRoles.includes(targetRole)) {
      return;
    }

    if (actor.role === UserRole.CHAMP) {
      throw new ForbiddenException("Champs can submit Picker Resignation only.");
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      throw new ForbiddenException(
        "Area Managers can submit Picker or Champ Resignation only."
      );
    }

    throw new ForbiddenException(
      "Only Champs, Area Managers, and Admins can submit Resignation requests."
    );
  }

  private isAdmin(actor: OffboardingRequestContext["actor"]) {
    return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  }
}
