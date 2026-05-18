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
  ApprovalStep,
  ApprovalStatus,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  RequestStatus,
  RequestType,
  User,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../../assignments/assignment-response.utils";
import type { ApprovalDecisionDto } from "../../approvals/dto/approval-decision.dto";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateOffboardingRequestDto } from "../dto/create-offboarding-request.dto";
import type { FinalizeOffboardingDto } from "../dto/finalize-offboarding.dto";
import type { SearchOffboardingPickersDto } from "../dto/search-offboarding-pickers.dto";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import {
  RequestApprovalRoutingService,
  type GeneratedApprovalStep
} from "../request-approval-routing.service";
import {
  requestInclude,
  type RequestApprovalWithRequest
} from "../request-includes";
import { toRequestSummary } from "../request-response.utils";
import { assertRequestTransition } from "../request-status-machine";
import {
  calculateBlockedUntil,
  getAllowedResignationTargetRolesForCreator,
  normalizeOffboardingBlockDecision,
  normalizeOffboardingReason,
  normalizeOffboardingTargetRole,
  type OffboardingBlockDecision,
  type OffboardingReasonCode,
  type OffboardingTargetRole
} from "./offboarding-workflow.policy";

const pickerAssignmentInclude = {
  picker: true,
  vendor: { include: { chain: true } }
} satisfies Prisma.PickerBranchAssignmentInclude;

type PickerAssignmentWithContext = Prisma.PickerBranchAssignmentGetPayload<{
  include: typeof pickerAssignmentInclude;
}>;

const champAssignmentInclude = {
  champ: true,
  vendor: { include: { chain: true } }
} satisfies Prisma.VendorChampAssignmentInclude;

const areaManagerAssignmentInclude = {
  areaManager: true,
  chain: true
} satisfies Prisma.ChainAreaManagerAssignmentInclude;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type OffboardingPayload = {
  offboarding: {
    type: "RESIGNATION";
    reasonCode: OffboardingReasonCode;
    reason: string;
    reasonDetails?: string;
    notes?: string;
    resignationDate: string;
  };
  source: {
    vendorId?: string;
    chainId: string;
  };
  target: {
    userId: string;
    targetRole: OffboardingTargetRole;
    assignmentId: string;
    assignmentType:
      | "PickerBranchAssignment"
      | "VendorChampAssignment"
      | "ChainAreaManagerAssignment";
  };
  areaManagerDecision?: {
    decidedAt: string;
    decidedById: string;
    blockDecision: OffboardingBlockDecision;
    blockStatus: BlockStatus;
    blockReason: string | null;
    notes?: string;
  };
  finalization?: {
    completedAt: string;
    assignmentId: string;
    assignmentIds?: string[];
    blockDecision: OffboardingBlockDecision;
    blockStatus: BlockStatus;
    blockedUntil?: string | null;
    blockReason?: string | null;
    finalizedById: string;
    notes?: string;
  };
};

type ResignationTargetContext = {
  assignmentId: string;
  assignmentType: OffboardingPayload["target"]["assignmentType"];
  sourceChainId: string;
  sourceVendorId?: string;
  sourceLabel: string;
  targetUser: User;
  targetRole: OffboardingTargetRole;
};

const openRequestStatuses = [
  RequestStatus.DRAFT,
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN,
  RequestStatus.APPROVED
];

@Injectable()
export class OffboardingWorkflowService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService
  ) {}

  async searchOffboardingPickers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    return this.searchOffboardingEligibleUsers(
      { ...dto, targetRole: UserRole.PICKER },
      currentUser
    );
  }

  async searchOffboardingEligibleUsers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    this.assertCanUseOffboarding(currentUser);
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    this.assertCanUseTargetRole(currentUser, targetRole);

    if (targetRole === UserRole.PICKER) {
      return this.searchScopedPickers(dto, currentUser);
    }

    if (targetRole === UserRole.CHAMP) {
      return this.searchScopedChamps(dto, currentUser);
    }

    return this.searchScopedAreaManagers(dto, currentUser);
  }

  async createOffboarding(
    dto: CreateOffboardingRequestDto,
    context: RequestContext
  ) {
    this.assertCanUseOffboarding(context.actor);
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    this.assertCanUseTargetRole(context.actor, targetRole);

    const offboarding = normalizeOffboardingReason(dto);
    const target = await this.resolveScopedActiveTarget(
      dto.targetUserId,
      targetRole,
      dto.sourceVendorId,
      dto.sourceChainId,
      context.actor
    );
    await this.assertNoPendingOffboarding(target.targetUser.id);

    if (context.actor.role === UserRole.AREA_MANAGER) {
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
      return this.createAreaManagerSubmittedRequest(target, payload, context);
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
      return this.createAdminSubmittedRequest(target, payload, context);
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
    return this.createApprovalRoutedRequest(
      target,
      areaManagerStep,
      payload,
      context
    );
  }

  async approveAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    const approval = await this.findApprovalOrThrow(approvalId);

    if (
      approval.request.type !== RequestType.RESIGNATION ||
      approval.step !== ApprovalStep.AREA_MANAGER_APPROVAL
    ) {
      throw new BadRequestException(
        "Only Resignation Area Manager approvals can be completed here."
      );
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException("Approval is not pending.");
    }

    if (
      approval.request.status !== RequestStatus.PENDING_AREA_MANAGER ||
      approval.request.currentStep !== ApprovalStep.AREA_MANAGER_APPROVAL
    ) {
      throw new BadRequestException(
        "Resignation request is not waiting for Area Manager approval."
      );
    }

    await this.assertCanApproveAreaManagerStep(approval, context.actor);

    const payload = this.parseOffboardingPayload(approval.request.payload);
    const decision = normalizeOffboardingBlockDecision(dto);
    assertRequestTransition(
      approval.request.status,
      RequestStatus.PENDING_ADMIN
    );

    const decidedAt = new Date();
    const updatedPayload: OffboardingPayload = {
      ...payload,
      areaManagerDecision: {
        decidedAt: decidedAt.toISOString(),
        decidedById: context.actor.id,
        blockDecision: decision.blockDecision,
        blockStatus: decision.blockStatus,
        blockReason: decision.blockReason,
        ...(decision.notes ? { notes: decision.notes } : {})
      }
    };
    assertRequestPayloadSafe(updatedPayload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: decidedAt,
          approverId: approval.approverId ?? context.actor.id,
          notes: decision.notes ?? "Area Manager block decision recorded."
        }
      });

      const request = await tx.request.update({
        where: { id: approval.requestId },
        data: {
          status: RequestStatus.PENDING_ADMIN,
          currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
          payload: updatedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: approval.request.createdById,
          type: "APPROVAL_APPROVED",
          title: "Resignation approval completed",
          body: "Area Manager block decision was recorded. The request is waiting for Admin finalization.",
          payload: { requestId: approval.requestId, approvalId: approval.id }
        }
      });

      const admins = await tx.user.findMany({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          accountStatus: AccountStatus.ACTIVE
        },
        select: { id: true }
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: "APPROVAL_PENDING",
            title: "Resignation finalization pending",
            body: "Resignation request is waiting for Admin finalization.",
            payload: {
              requestId: approval.requestId,
              step: ApprovalStep.ADMIN_FINAL_APPROVAL
            }
          }))
        });
      }

      await tx.auditLog.createMany({
        data: [
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_APPROVED",
            entityType: "RequestApproval",
            entityId: approval.id,
            oldValue: {
              status: approval.status,
              step: approval.step,
              requestId: approval.requestId
            },
            newValue: {
              status: ApprovalStatus.APPROVED,
              step: approval.step,
              blockDecision: decision.blockDecision,
              blockStatus: decision.blockStatus
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_UPDATED",
            entityType: "Request",
            entityId: approval.requestId,
            oldValue: {
              status: approval.request.status,
              currentStep: approval.request.currentStep
            },
            newValue: {
              status: RequestStatus.PENDING_ADMIN,
              currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return request;
    });

    return toRequestSummary(updated);
  }

  async finalizeOffboarding(
    id: string,
    dto: FinalizeOffboardingDto,
    context: RequestContext
  ) {
    if (!this.isAdmin(context.actor)) {
      throw new ForbiddenException(
        "Only Admins can finalize Resignation requests."
      );
    }

    if (!dto.confirmInternalDeactivation) {
      throw new BadRequestException(
        "Internal deactivation confirmation is required."
      );
    }

    const request = await this.findRequestOrThrow(id);

    if (request.type !== RequestType.RESIGNATION) {
      throw new BadRequestException(
        "Only RESIGNATION requests can be finalized here."
      );
    }

    if (
      request.status !== RequestStatus.PENDING_ADMIN ||
      request.currentStep !== ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      throw new BadRequestException(
        "Resignation request is not waiting for Admin finalization."
      );
    }

    const adminApproval = request.approvals.find(
      (approval) =>
        approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL &&
        approval.status === ApprovalStatus.PENDING
    );

    if (!adminApproval) {
      throw new BadRequestException("Pending Admin final approval was not found.");
    }

    const payload = this.parseOffboardingPayload(request.payload);
    const finalizationInput = normalizeOffboardingBlockDecision({
      blockDecision:
        dto.blockDecision ?? payload.areaManagerDecision?.blockDecision,
      blockReason:
        dto.blockReason ?? payload.areaManagerDecision?.blockReason ?? undefined,
      notes: dto.notes
    });

    if (request.targetUserId !== payload.target.userId) {
      throw new BadRequestException(
        "Request target user does not match the stored resignation payload."
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: payload.target.userId }
    });

    if (!targetUser) {
      throw new NotFoundException("Target user was not found.");
    }

    if (
      targetUser.role !== payload.target.targetRole ||
      targetUser.accountStatus !== AccountStatus.ACTIVE ||
      targetUser.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException("Target user is no longer active for Resignation.");
    }

    const activeAssignments = await this.resolveActiveAssignmentsForFinalization(
      payload,
      request
    );

    const completedAt = new Date();
    const blockedUntil = calculateBlockedUntil(
      finalizationInput.blockDecision,
      completedAt
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const resignedUser = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          accountStatus: AccountStatus.ARCHIVED,
          employmentStatus: EmploymentStatus.RESIGNED,
          resignationDate: new Date(payload.offboarding.resignationDate),
          blockStatus: finalizationInput.blockStatus,
          blockedUntil,
          blockReason: finalizationInput.blockReason,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          temporaryPasswordCiphertext: null,
          temporaryPasswordCreatedAt: null
        }
      });

      const closedAssignments = await this.closeActiveAssignments(
        tx,
        payload.target.targetRole,
        activeAssignments,
        completedAt
      );

      await tx.requestApproval.update({
        where: { id: adminApproval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          approverId: context.actor.id,
          notes: finalizationInput.notes ?? "Resignation finalized."
        }
      });

      const completedPayload: OffboardingPayload = {
        ...payload,
        finalization: {
          completedAt: completedAt.toISOString(),
          assignmentId: closedAssignments[0]?.id ?? payload.target.assignmentId,
          assignmentIds: closedAssignments.map((assignment) => assignment.id),
          blockDecision: finalizationInput.blockDecision,
          blockStatus: finalizationInput.blockStatus,
          blockedUntil: blockedUntil?.toISOString() ?? null,
          blockReason: finalizationInput.blockReason,
          finalizedById: context.actor.id,
          ...(finalizationInput.notes ? { notes: finalizationInput.notes } : {})
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          targetUserId: resignedUser.id,
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: request.createdById,
          type: "OFFBOARDING_COMPLETED",
          title: "Resignation completed",
          body: `Resignation for ${resignedUser.nameEn} was finalized. The ${this.formatTargetRole(payload.target.targetRole)} account is archived and active assignments are closed.`,
          payload: {
            requestId: request.id,
            targetUserId: resignedUser.id,
            targetRole: payload.target.targetRole,
            assignmentIds: closedAssignments.map((assignment) => assignment.id),
            blockDecision: finalizationInput.blockDecision,
            blockStatus: finalizationInput.blockStatus
          }
        }
      });

      await tx.auditLog.createMany({
        data: [
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_APPROVED",
            entityType: "RequestApproval",
            entityId: adminApproval.id,
            oldValue: {
              status: adminApproval.status,
              step: adminApproval.step,
              requestId: request.id
            },
            newValue: {
              status: ApprovalStatus.APPROVED,
              step: adminApproval.step,
              requestId: request.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "ADMIN_FINALIZED_OFFBOARDING",
            entityType: "Request",
            entityId: request.id,
            oldValue: { status: request.status, currentStep: request.currentStep },
            newValue: {
              status: RequestStatus.COMPLETED,
              type: request.type,
              targetUserId: resignedUser.id,
              targetRole: payload.target.targetRole,
              blockDecision: finalizationInput.blockDecision,
              blockStatus: finalizationInput.blockStatus
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: `${payload.target.targetRole}_RESIGNED`,
            entityType: "User",
            entityId: resignedUser.id,
            oldValue: {
              accountStatus: targetUser.accountStatus,
              employmentStatus: targetUser.employmentStatus,
              blockStatus: targetUser.blockStatus
            },
            newValue: {
              accountStatus: resignedUser.accountStatus,
              employmentStatus: resignedUser.employmentStatus,
              blockStatus: resignedUser.blockStatus,
              blockedUntil: resignedUser.blockedUntil?.toISOString() ?? null
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          ...closedAssignments.map((closedAssignment) => ({
            actorUserId: context.actor.id,
            action: `${payload.target.assignmentType.toUpperCase()}_CLOSED`,
            entityType: payload.target.assignmentType,
            entityId: closedAssignment.id,
            oldValue: {
              status: AssignmentStatus.ACTIVE,
              targetUserId: resignedUser.id
            },
            newValue: {
              status: closedAssignment.status,
              endDate: closedAssignment.endDate?.toISOString() ?? null,
              requestId: request.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          })),
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: request.id,
            oldValue: { status: request.status },
            newValue: {
              status: RequestStatus.COMPLETED,
              targetUserId: resignedUser.id,
              completedAt: completedAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, resignedUser, closedAssignments };
    });

    const user = this.toResignedUserResponse(result.resignedUser);

    return {
      request: toRequestSummary(result.completedRequest),
      user,
      picker: payload.target.targetRole === UserRole.PICKER ? user : undefined,
      assignment: result.closedAssignments[0] ?? null,
      assignments: result.closedAssignments
    };
  }

  private async createApprovalRoutedRequest(
    target: ResignationTargetContext,
    areaManagerStep: GeneratedApprovalStep,
    payload: OffboardingPayload,
    context: RequestContext
  ) {
    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.RESIGNATION,
          status: RequestStatus.PENDING_AREA_MANAGER,
          currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: target.targetUser.id,
          sourceVendorId: target.sourceVendorId,
          sourceChainId: target.sourceChainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.createMany({
        data: [
          {
            requestId: request.id,
            step: areaManagerStep.step,
            approverRole: areaManagerStep.approverRole,
            approverId: areaManagerStep.approverId,
            status: ApprovalStatus.PENDING
          },
          {
            requestId: request.id,
            step: ApprovalStep.ADMIN_FINAL_APPROVAL,
            approverRole: UserRole.ADMIN,
            approverId: null,
            status: ApprovalStatus.PENDING
          }
        ]
      });

      await this.createSubmissionAuditLogs(tx, request, context, [
        {
          step: areaManagerStep.step,
          approverRole: areaManagerStep.approverRole,
          approverId: areaManagerStep.approverId,
          chainId: areaManagerStep.chainId ?? null
        },
        {
          step: ApprovalStep.ADMIN_FINAL_APPROVAL,
          approverRole: UserRole.ADMIN,
          approverId: null
        }
      ]);

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "Resignation request submitted",
          body: `Resignation request for ${target.targetUser.nameEn} was submitted for Area Manager approval.`,
          payload: {
            requestId: request.id,
            targetUserId: target.targetUser.id,
            targetRole: target.targetRole
          }
        }
      });

      if (areaManagerStep.approverId) {
        await tx.notification.create({
          data: {
            userId: areaManagerStep.approverId,
            type: "APPROVAL_PENDING",
            title: "Resignation approval pending",
            body: `Resignation request for ${target.sourceLabel} requires your block decision.`,
            payload: {
              requestId: request.id,
              step: areaManagerStep.step,
              targetUserId: target.targetUser.id,
              targetRole: target.targetRole
            }
          }
        });
      }

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    return toRequestSummary(updated);
  }

  private async createAreaManagerSubmittedRequest(
    target: ResignationTargetContext,
    payload: OffboardingPayload,
    context: RequestContext
  ) {
    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.RESIGNATION,
          status: RequestStatus.PENDING_ADMIN,
          currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
          createdById: context.actor.id,
          targetUserId: target.targetUser.id,
          sourceVendorId: target.sourceVendorId,
          sourceChainId: target.sourceChainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.createMany({
        data: [
          {
            requestId: request.id,
            step: ApprovalStep.AREA_MANAGER_APPROVAL,
            approverRole: UserRole.AREA_MANAGER,
            approverId: context.actor.id,
            status: ApprovalStatus.SKIPPED,
            decisionAt: new Date(),
            notes: "Area Manager submitted this Resignation; approval skipped."
          },
          {
            requestId: request.id,
            step: ApprovalStep.ADMIN_FINAL_APPROVAL,
            approverRole: UserRole.ADMIN,
            approverId: null,
            status: ApprovalStatus.PENDING
          }
        ]
      });

      await this.createSubmissionAuditLogs(tx, request, context, [
        {
          step: ApprovalStep.AREA_MANAGER_APPROVAL,
          approverRole: UserRole.AREA_MANAGER,
          approverId: context.actor.id,
          skipped: true
        },
        {
          step: ApprovalStep.ADMIN_FINAL_APPROVAL,
          approverRole: UserRole.ADMIN,
          approverId: null
        }
      ]);

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "Resignation request submitted",
          body: `Resignation request for ${target.targetUser.nameEn} was submitted for Admin finalization.`,
          payload: {
            requestId: request.id,
            targetUserId: target.targetUser.id,
            targetRole: target.targetRole
          }
        }
      });

      const admins = await tx.user.findMany({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          accountStatus: AccountStatus.ACTIVE
        },
        select: { id: true }
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: "APPROVAL_PENDING",
            title: "Resignation finalization pending",
            body: "Resignation request is waiting for Admin finalization.",
            payload: {
              requestId: request.id,
              step: ApprovalStep.ADMIN_FINAL_APPROVAL,
              targetUserId: target.targetUser.id,
              targetRole: target.targetRole
            }
          }))
        });
      }

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    return toRequestSummary(updated);
  }

  private async createAdminSubmittedRequest(
    target: ResignationTargetContext,
    payload: OffboardingPayload,
    context: RequestContext
  ) {
    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.RESIGNATION,
          status: RequestStatus.PENDING_ADMIN,
          currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
          createdById: context.actor.id,
          targetUserId: target.targetUser.id,
          sourceVendorId: target.sourceVendorId,
          sourceChainId: target.sourceChainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.create({
        data: {
          requestId: request.id,
          step: ApprovalStep.ADMIN_FINAL_APPROVAL,
          approverRole: UserRole.ADMIN,
          approverId: null,
          status: ApprovalStatus.PENDING
        }
      });

      await this.createSubmissionAuditLogs(tx, request, context, [
        {
          step: ApprovalStep.ADMIN_FINAL_APPROVAL,
          approverRole: UserRole.ADMIN,
          approverId: null
        }
      ]);

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "Resignation request submitted",
          body: `Resignation request for ${target.targetUser.nameEn} was submitted for Admin finalization.`,
          payload: {
            requestId: request.id,
            targetUserId: target.targetUser.id,
            targetRole: target.targetRole
          }
        }
      });

      const admins = await tx.user.findMany({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          accountStatus: AccountStatus.ACTIVE
        },
        select: { id: true }
      });

      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: "APPROVAL_PENDING",
            title: "Resignation finalization pending",
            body: "Resignation request is waiting for Admin finalization.",
            payload: {
              requestId: request.id,
              step: ApprovalStep.ADMIN_FINAL_APPROVAL,
              targetUserId: target.targetUser.id,
              targetRole: target.targetRole
            }
          }))
        });
      }

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    return toRequestSummary(updated);
  }

  private async searchScopedPickers(
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
        this.toPickerSearchCard(
          assignment,
          pendingByUserId.get(assignment.pickerId) ?? null
        )
      )
    };
  }

  private async searchScopedChamps(
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
        this.toEligibleUserSearchCard({
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

  private async searchScopedAreaManagers(
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
        this.toEligibleUserSearchCard({
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

  private async resolveScopedActiveTarget(
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
          ...this.buildScopedChampAssignmentWhere(
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
        ...this.buildScopedAreaManagerAssignmentWhere(sourceChainId),
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

  private async resolveActiveAssignmentsForFinalization(
    payload: OffboardingPayload,
    request: { sourceChainId: string | null; sourceVendorId: string | null }
  ) {
    if (request.sourceChainId !== payload.source.chainId) {
      throw new BadRequestException(
        "Source Chain no longer matches the stored request context."
      );
    }

    if (payload.target.targetRole === UserRole.PICKER) {
      if (!payload.source.vendorId || request.sourceVendorId !== payload.source.vendorId) {
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
      if (!payload.source.vendorId || request.sourceVendorId !== payload.source.vendorId) {
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

  private async closeActiveAssignments(
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
        ...this.buildScopedPickerAssignmentWhere(actor, sourceVendorId),
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

  private buildScopedPickerAssignmentWhere(
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

  private buildScopedChampAssignmentWhere(
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

  private buildScopedAreaManagerAssignmentWhere(
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

  private async getPendingResignationByUserId(userIds: string[]) {
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

  private async assertNoPendingOffboarding(userId: string) {
    const duplicate = await this.prisma.request.findFirst({
      where: {
        type: RequestType.RESIGNATION,
        targetUserId: userId,
        status: { in: openRequestStatuses }
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException(
        "A pending Resignation request already exists for this user."
      );
    }
  }

  private async assertCanApproveAreaManagerStep(
    approval: RequestApprovalWithRequest,
    actor: AuthenticatedUser
  ) {
    if (actor.role !== UserRole.AREA_MANAGER) {
      throw new ForbiddenException(
        "Only Area Managers can approve this Resignation step."
      );
    }

    if (approval.approverId && approval.approverId !== actor.id) {
      throw new ForbiddenException("This approval is assigned to another user.");
    }

    const chainId = approval.request.sourceChainId;
    if (!chainId) {
      throw new BadRequestException("Resignation request is missing Chain context.");
    }

    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        chainId,
        areaManagerId: actor.id,
        status: AssignmentStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You can approve Resignation requests only within your assigned Chain scope."
      );
    }
  }

  private async findRequestOrThrow(id: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: requestInclude
    });

    if (!request) {
      throw new NotFoundException("Request was not found.");
    }

    return request;
  }

  private async findApprovalOrThrow(id: string) {
    const approval = await this.prisma.requestApproval.findUnique({
      where: { id },
      include: { request: { include: requestInclude } }
    });

    if (!approval) {
      throw new NotFoundException("Approval was not found.");
    }

    return approval;
  }

  private parseOffboardingPayload(payload: Prisma.JsonValue): OffboardingPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Resignation request payload is invalid.");
    }

    const objectPayload = payload as Record<string, unknown>;
    const offboarding = objectPayload.offboarding;
    const source = objectPayload.source;
    const target = objectPayload.target;

    if (
      !offboarding ||
      typeof offboarding !== "object" ||
      Array.isArray(offboarding) ||
      !source ||
      typeof source !== "object" ||
      Array.isArray(source) ||
      !target ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) {
      throw new BadRequestException("Resignation request payload is incomplete.");
    }

    const offboardingPayload = offboarding as Record<string, unknown>;
    const sourcePayload = source as Record<string, unknown>;
    const targetPayload = target as Record<string, unknown>;
    const type = offboardingPayload.type;
    const reason = offboardingPayload.reason;
    const reasonCode =
      typeof offboardingPayload.reasonCode === "string"
        ? offboardingPayload.reasonCode
        : "OTHER";
    const resignationDate = offboardingPayload.resignationDate;
    const vendorId = sourcePayload.vendorId;
    const chainId = sourcePayload.chainId;
    const targetRole = this.normalizeTargetRole(
      typeof targetPayload.targetRole === "string"
        ? targetPayload.targetRole
        : undefined
    );
    const userId =
      typeof targetPayload.userId === "string"
        ? targetPayload.userId
        : typeof targetPayload.pickerId === "string"
          ? targetPayload.pickerId
          : undefined;
    const assignmentId =
      typeof targetPayload.assignmentId === "string"
        ? targetPayload.assignmentId
        : typeof targetPayload.pickerAssignmentId === "string"
          ? targetPayload.pickerAssignmentId
          : undefined;
    const assignmentType =
      typeof targetPayload.assignmentType === "string"
        ? targetPayload.assignmentType
        : "PickerBranchAssignment";

    if (
      type !== RequestType.RESIGNATION ||
      typeof reason !== "string" ||
      typeof resignationDate !== "string" ||
      typeof chainId !== "string" ||
      typeof userId !== "string" ||
      typeof assignmentId !== "string"
    ) {
      throw new BadRequestException(
        "Resignation request payload is missing required context."
      );
    }

    if (
      (targetRole === UserRole.PICKER &&
        (assignmentType !== "PickerBranchAssignment" ||
          typeof vendorId !== "string")) ||
      (targetRole === UserRole.CHAMP &&
        (assignmentType !== "VendorChampAssignment" ||
          typeof vendorId !== "string")) ||
      (targetRole === UserRole.AREA_MANAGER &&
        assignmentType !== "ChainAreaManagerAssignment")
    ) {
      throw new BadRequestException(
        "Resignation request payload has invalid assignment context."
      );
    }

    return {
      offboarding: {
        type,
        reasonCode: reasonCode as OffboardingReasonCode,
        reason,
        reasonDetails:
          typeof offboardingPayload.reasonDetails === "string"
            ? offboardingPayload.reasonDetails
            : undefined,
        notes:
          typeof offboardingPayload.notes === "string"
            ? offboardingPayload.notes
            : undefined,
        resignationDate
      },
      source: {
        ...(typeof vendorId === "string" ? { vendorId } : {}),
        chainId
      },
      target: {
        userId,
        targetRole,
        assignmentId,
        assignmentType: assignmentType as OffboardingPayload["target"]["assignmentType"]
      },
      areaManagerDecision: this.parseStoredBlockDecision(
        objectPayload.areaManagerDecision
      ),
      finalization:
        objectPayload.finalization &&
        typeof objectPayload.finalization === "object" &&
        !Array.isArray(objectPayload.finalization)
          ? (objectPayload.finalization as OffboardingPayload["finalization"])
          : undefined
    };
  }

  private parseStoredBlockDecision(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const payload = value as Record<string, unknown>;
    const blockDecision =
      typeof payload.blockDecision === "string"
        ? payload.blockDecision
        : this.blockStatusToDecision(payload.blockStatus);

    if (!blockDecision || typeof payload.blockStatus !== "string") {
      return undefined;
    }

    return {
      decidedAt:
        typeof payload.decidedAt === "string"
          ? payload.decidedAt
          : new Date(0).toISOString(),
      decidedById:
        typeof payload.decidedById === "string" ? payload.decidedById : "",
      blockDecision: blockDecision as OffboardingBlockDecision,
      blockStatus: payload.blockStatus as BlockStatus,
      blockReason:
        typeof payload.blockReason === "string" ? payload.blockReason : null,
      notes: typeof payload.notes === "string" ? payload.notes : undefined
    };
  }

  private blockStatusToDecision(value: unknown) {
    if (value === BlockStatus.NO_BLOCK) return "NO_BLOCK";
    if (value === BlockStatus.PERMANENT_BLOCK) return "PERMANENT";
    if (value === BlockStatus.TEMPORARY_BLOCK) return "THREE_MONTHS";
    return null;
  }

  private async createSubmissionAuditLogs(
    tx: Prisma.TransactionClient,
    request: {
      id: string;
      type: RequestType;
      targetUserId: string | null;
      sourceVendorId: string | null;
      sourceChainId: string | null;
      status: RequestStatus;
      currentStep: ApprovalStep | null;
    },
    context: RequestContext,
    approvals: Array<Record<string, unknown>>
  ) {
    await tx.auditLog.createMany({
      data: [
        {
          actorUserId: context.actor.id,
          action: "REQUEST_CREATED",
          entityType: "Request",
          entityId: request.id,
          newValue: {
            id: request.id,
            type: request.type,
            targetUserId: request.targetUserId,
            sourceVendorId: request.sourceVendorId,
            sourceChainId: request.sourceChainId
          },
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        },
        {
          actorUserId: context.actor.id,
          action: "REQUEST_SUBMITTED",
          entityType: "Request",
          entityId: request.id,
          newValue: {
            id: request.id,
            status: request.status,
            currentStep: request.currentStep
          },
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        },
        ...approvals.map((approval) => ({
          actorUserId: context.actor.id,
          action: "APPROVAL_GENERATED",
          entityType: "Request",
          entityId: request.id,
          newValue: approval as Prisma.InputJsonValue,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }))
      ]
    });
  }

  private toPickerSearchCard(
    assignment: PickerAssignmentWithContext,
    pendingResignationRequestId: string | null
  ) {
    return {
      assignmentId: assignment.id,
      assignmentType: "PickerBranchAssignment",
      targetUserId: assignment.pickerId,
      targetRole: UserRole.PICKER,
      pickerId: assignment.pickerId,
      vendorId: assignment.vendorId,
      chainId: assignment.vendor.chainId,
      assignmentStartDate: assignment.startDate,
      pendingResignationRequestId,
      hasPendingResignation: Boolean(pendingResignationRequestId),
      picker: {
        ...toUserSummary(assignment.picker),
        shopperId: assignment.picker.shopperId,
        ibsId: assignment.picker.ibsId,
        joiningDate: assignment.picker.joiningDate,
        blockStatus: assignment.picker.blockStatus
      },
      user: {
        ...toUserSummary(assignment.picker),
        shopperId: assignment.picker.shopperId,
        ibsId: assignment.picker.ibsId,
        joiningDate: assignment.picker.joiningDate,
        blockStatus: assignment.picker.blockStatus
      },
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain)
    };
  }

  private toEligibleUserSearchCard(params: {
    assignmentId: string;
    assignmentStartDate: Date;
    assignmentType: OffboardingPayload["target"]["assignmentType"];
    chain: ReturnType<typeof toChainSummary>;
    pendingResignationRequestId: string | null;
    role: OffboardingTargetRole;
    user: User;
    vendor?: ReturnType<typeof toVendorSummary>;
  }) {
    return {
      assignmentId: params.assignmentId,
      assignmentType: params.assignmentType,
      targetUserId: params.user.id,
      targetRole: params.role,
      userId: params.user.id,
      vendorId: params.vendor?.id,
      chainId: params.chain.id,
      assignmentStartDate: params.assignmentStartDate,
      pendingResignationRequestId: params.pendingResignationRequestId,
      hasPendingResignation: Boolean(params.pendingResignationRequestId),
      role: params.role,
      user: {
        ...toUserSummary(params.user),
        shopperId: params.user.shopperId,
        ibsId: params.user.ibsId,
        joiningDate: params.user.joiningDate,
        blockStatus: params.user.blockStatus
      },
      vendor: params.vendor ?? null,
      chain: params.chain
    };
  }

  private assertCanUseOffboarding(actor: AuthenticatedUser) {
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

  private isAdmin(actor: AuthenticatedUser) {
    return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  }

  private normalizeTargetRole(
    targetRole: UserRole | string | null | undefined
  ) {
    return normalizeOffboardingTargetRole(targetRole);
  }

  private assertCanUseTargetRole(
    actor: AuthenticatedUser,
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

  private toResignedUserResponse(user: User) {
    return {
      id: user.id,
      role: user.role,
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      phoneNumber: user.phoneNumber,
      shopperId: user.shopperId,
      ibsId: user.ibsId,
      accountStatus: user.accountStatus,
      employmentStatus: user.employmentStatus,
      profileStatus: user.profileStatus,
      blockStatus: user.blockStatus,
      blockedUntil: user.blockedUntil,
      blockReason: user.blockReason
    };
  }

  private formatTargetRole(targetRole: OffboardingTargetRole) {
    return targetRole
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
