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
import { toRequestSummary } from "../request-response.utils";
import { assertRequestTransition } from "../request-status-machine";
import {
  calculateBlockedUntil,
  normalizeOffboardingBlockDecision,
  normalizeOffboardingReason,
  type OffboardingBlockDecision,
  type OffboardingReasonCode
} from "./offboarding-workflow.policy";

const requestInclude = {
  createdBy: true,
  targetUser: true,
  sourceChain: true,
  sourceVendor: { include: { chain: true } },
  destinationChain: true,
  destinationVendor: { include: { chain: true } },
  approvals: {
    include: { approver: true },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.RequestInclude;

const pickerAssignmentInclude = {
  picker: true,
  vendor: { include: { chain: true } }
} satisfies Prisma.PickerBranchAssignmentInclude;

type PickerAssignmentWithContext = Prisma.PickerBranchAssignmentGetPayload<{
  include: typeof pickerAssignmentInclude;
}>;

type RequestApprovalWithRequest = Prisma.RequestApprovalGetPayload<{
  include: {
    request: {
      include: typeof requestInclude;
    };
  };
}>;

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
    vendorId: string;
    chainId: string;
  };
  target: {
    pickerId: string;
    pickerAssignmentId: string;
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
    blockDecision: OffboardingBlockDecision;
    blockStatus: BlockStatus;
    blockedUntil?: string | null;
    blockReason?: string | null;
    finalizedById: string;
    notes?: string;
  };
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
    this.assertCanUseOffboarding(currentUser);

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

    const pickerIds = assignments.map((assignment) => assignment.pickerId);
    const pendingRequests = pickerIds.length
      ? await this.prisma.request.findMany({
          where: {
            type: RequestType.RESIGNATION,
            targetUserId: { in: pickerIds },
            status: { in: openRequestStatuses }
          },
          select: { id: true, targetUserId: true }
        })
      : [];
    const pendingByPickerId = new Map(
      pendingRequests.map((request) => [request.targetUserId, request.id])
    );

    return {
      items: assignments.map((assignment) =>
        this.toPickerSearchCard(
          assignment,
          pendingByPickerId.get(assignment.pickerId) ?? null
        )
      )
    };
  }

  async createOffboarding(
    dto: CreateOffboardingRequestDto,
    context: RequestContext
  ) {
    this.assertCanUseOffboarding(context.actor);

    const offboarding = normalizeOffboardingReason(dto);
    const assignment = await this.resolveScopedActivePickerAssignment(
      dto.targetUserId,
      dto.sourceVendorId,
      context.actor
    );
    await this.assertNoPendingOffboarding(assignment.pickerId);

    if (context.actor.role === UserRole.AREA_MANAGER) {
      const decision = normalizeOffboardingBlockDecision({
        blockDecision: dto.blockDecision,
        blockReason: dto.blockReason
      });
      const payload: OffboardingPayload = {
        offboarding,
        source: { vendorId: assignment.vendorId, chainId: assignment.vendor.chainId },
        target: { pickerId: assignment.pickerId, pickerAssignmentId: assignment.id },
        areaManagerDecision: {
          decidedAt: new Date().toISOString(),
          decidedById: context.actor.id,
          blockDecision: decision.blockDecision,
          blockStatus: decision.blockStatus,
          blockReason: decision.blockReason
        }
      };
      return this.createAreaManagerSubmittedRequest(assignment, payload, context);
    }

    const areaManagerStep =
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
        ApprovalStep.AREA_MANAGER_APPROVAL,
        assignment.vendor.chainId
      );
    const payload: OffboardingPayload = {
      offboarding,
      source: { vendorId: assignment.vendorId, chainId: assignment.vendor.chainId },
      target: { pickerId: assignment.pickerId, pickerAssignmentId: assignment.id }
    };
    return this.createApprovalRoutedRequest(
      assignment,
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

    if (request.targetUserId !== payload.target.pickerId) {
      throw new BadRequestException(
        "Request target Picker does not match the stored resignation payload."
      );
    }

    const [targetPicker, sourceVendor, activeAssignment] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.target.pickerId } }),
      this.prisma.vendor.findUnique({
        where: { id: payload.source.vendorId },
        include: { chain: true }
      }),
      this.prisma.pickerBranchAssignment.findFirst({
        where: {
          id: payload.target.pickerAssignmentId,
          pickerId: payload.target.pickerId,
          vendorId: payload.source.vendorId,
          status: AssignmentStatus.ACTIVE
        }
      })
    ]);

    if (!targetPicker) {
      throw new NotFoundException("Target Picker was not found.");
    }

    if (
      targetPicker.role !== UserRole.PICKER ||
      targetPicker.accountStatus !== AccountStatus.ACTIVE ||
      targetPicker.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException("Target Picker is no longer active.");
    }

    if (!sourceVendor) {
      throw new NotFoundException("Source Branch was not found.");
    }

    if (sourceVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is no longer active.");
    }

    if (
      sourceVendor.chainId !== payload.source.chainId ||
      request.sourceChainId !== payload.source.chainId ||
      request.sourceVendorId !== payload.source.vendorId
    ) {
      throw new BadRequestException(
        "Source Branch and Chain no longer match the stored request context."
      );
    }

    if (!activeAssignment) {
      throw new BadRequestException(
        "Target Picker no longer has an active assignment to the source Branch."
      );
    }

    const completedAt = new Date();
    const blockedUntil = calculateBlockedUntil(
      finalizationInput.blockDecision,
      completedAt
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const picker = await tx.user.update({
        where: { id: targetPicker.id },
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

      const closedAssignment = await tx.pickerBranchAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: completedAt
        },
        include: pickerAssignmentInclude
      });

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
          assignmentId: closedAssignment.id,
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
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: request.createdById,
          type: "OFFBOARDING_COMPLETED",
          title: "Resignation completed",
          body: `Resignation for ${picker.nameEn} was finalized. The Picker account is archived and the active Branch assignment is closed.`,
          payload: {
            requestId: request.id,
            pickerId: picker.id,
            assignmentId: closedAssignment.id,
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
              targetUserId: picker.id,
              blockDecision: finalizationInput.blockDecision,
              blockStatus: finalizationInput.blockStatus
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "PICKER_ARCHIVED",
            entityType: "User",
            entityId: picker.id,
            oldValue: {
              accountStatus: targetPicker.accountStatus,
              employmentStatus: targetPicker.employmentStatus,
              blockStatus: targetPicker.blockStatus
            },
            newValue: {
              accountStatus: picker.accountStatus,
              employmentStatus: picker.employmentStatus,
              blockStatus: picker.blockStatus,
              blockedUntil: picker.blockedUntil?.toISOString() ?? null
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "PICKER_BRANCH_ASSIGNMENT_CLOSED",
            entityType: "PickerBranchAssignment",
            entityId: closedAssignment.id,
            oldValue: {
              status: activeAssignment.status,
              pickerId: activeAssignment.pickerId,
              vendorId: activeAssignment.vendorId
            },
            newValue: {
              status: closedAssignment.status,
              endDate: closedAssignment.endDate?.toISOString() ?? null,
              requestId: request.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: request.id,
            oldValue: { status: request.status },
            newValue: {
              status: RequestStatus.COMPLETED,
              targetUserId: picker.id,
              completedAt: completedAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, picker, closedAssignment };
    });

    return {
      request: toRequestSummary(result.completedRequest),
      picker: {
        id: result.picker.id,
        role: result.picker.role,
        nameEn: result.picker.nameEn,
        nameAr: result.picker.nameAr,
        phoneNumber: result.picker.phoneNumber,
        shopperId: result.picker.shopperId,
        ibsId: result.picker.ibsId,
        accountStatus: result.picker.accountStatus,
        employmentStatus: result.picker.employmentStatus,
        profileStatus: result.picker.profileStatus,
        blockStatus: result.picker.blockStatus,
        blockedUntil: result.picker.blockedUntil,
        blockReason: result.picker.blockReason
      },
      assignment: {
        id: result.closedAssignment.id,
        status: result.closedAssignment.status,
        startDate: result.closedAssignment.startDate,
        endDate: result.closedAssignment.endDate,
        vendorId: result.closedAssignment.vendorId,
        pickerId: result.closedAssignment.pickerId,
        createdByRequestId: result.closedAssignment.createdByRequestId
      }
    };
  }

  private async createApprovalRoutedRequest(
    assignment: PickerAssignmentWithContext,
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
          targetUserId: assignment.pickerId,
          sourceVendorId: assignment.vendorId,
          sourceChainId: assignment.vendor.chainId,
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
          body: `Resignation request for ${assignment.picker.nameEn} was submitted for Area Manager approval.`,
          payload: { requestId: request.id, pickerId: assignment.pickerId }
        }
      });

      if (areaManagerStep.approverId) {
        await tx.notification.create({
          data: {
            userId: areaManagerStep.approverId,
            type: "APPROVAL_PENDING",
            title: "Resignation approval pending",
            body: `Resignation request for ${assignment.vendor.vendorName} requires your block decision.`,
            payload: {
              requestId: request.id,
              step: areaManagerStep.step,
              pickerId: assignment.pickerId
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
    assignment: PickerAssignmentWithContext,
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
          targetUserId: assignment.pickerId,
          sourceVendorId: assignment.vendorId,
          sourceChainId: assignment.vendor.chainId,
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
          body: `Resignation request for ${assignment.picker.nameEn} was submitted for Admin finalization.`,
          payload: { requestId: request.id, pickerId: assignment.pickerId }
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
              pickerId: assignment.pickerId
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

  private async assertNoPendingOffboarding(pickerId: string) {
    const duplicate = await this.prisma.request.findFirst({
      where: {
        type: RequestType.RESIGNATION,
        targetUserId: pickerId,
        status: { in: openRequestStatuses }
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException(
        "A pending Resignation request already exists for this Picker."
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
    const pickerId = targetPayload.pickerId;
    const pickerAssignmentId = targetPayload.pickerAssignmentId;

    if (
      type !== RequestType.RESIGNATION ||
      typeof reason !== "string" ||
      typeof resignationDate !== "string" ||
      typeof vendorId !== "string" ||
      typeof chainId !== "string" ||
      typeof pickerId !== "string" ||
      typeof pickerAssignmentId !== "string"
    ) {
      throw new BadRequestException(
        "Resignation request payload is missing required context."
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
      source: { vendorId, chainId },
      target: { pickerId, pickerAssignmentId },
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
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain)
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
}
