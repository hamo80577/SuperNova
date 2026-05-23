import {
  BadRequestException,
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
  EmploymentStatus,
  HrSyncTargetSheet,
  HrSyncWorkflowType,
  Prisma,
  RequestStatus,
  RequestType,
  User,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { HrSyncService, type HrSyncEventType } from "../../hr-sync";
import { PrismaService } from "../../prisma/prisma.service";
import type { FinalizeOffboardingDto } from "../dto/finalize-offboarding.dto";
import { requestInclude } from "../request-includes";
import { toRequestSummary } from "../request-response.utils";
import { assertRequestTransition } from "../request-status-machine";
import { parseOffboardingPayload } from "./offboarding-payload";
import {
  formatOffboardingTargetRole,
  toResignedUserResponse
} from "./offboarding-response.utils";
import { OffboardingTargetService } from "./offboarding-target.service";
import type { OffboardingPayload, OffboardingRequestContext } from "./offboarding-types";
import {
  normalizeOffboardingBlockDecision
} from "./offboarding-workflow.policy";

@Injectable()
export class OffboardingFinalizationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OffboardingTargetService)
    private readonly targetService: OffboardingTargetService,
    @Inject(HrSyncService)
    private readonly hrSync: HrSyncService
  ) {}

  async finalizeOffboarding(
    id: string,
    dto: FinalizeOffboardingDto,
    context: OffboardingRequestContext
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

    const payload = parseOffboardingPayload(request.payload);
    const finalizationInput =
      payload.target.targetRole === UserRole.AREA_MANAGER
        ? normalizeOffboardingBlockDecision({
            blockDecision: "NO_BLOCK",
            notes: dto.notes
          })
        : this.resolveAreaManagerFinalizationDecision(payload, dto);

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

    const activeAssignments =
      await this.targetService.resolveActiveAssignmentsForFinalization(
        payload,
        request
      );

    const completedAt = new Date();
    assertRequestTransition(request.status, RequestStatus.COMPLETED);

    const result = await this.prisma.$transaction(async (tx) => {
      const resignedUser = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          accountStatus: AccountStatus.ARCHIVED,
          employmentStatus: EmploymentStatus.RESIGNED,
          resignationDate: new Date(payload.offboarding.resignationDate),
          blockStatus: finalizationInput.blockStatus,
          blockedUntil: null,
          blockReason: finalizationInput.blockReason,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          temporaryPasswordCiphertext: null,
          temporaryPasswordCreatedAt: null
        }
      });

      const closedAssignments = await this.targetService.closeActiveAssignments(
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
          body: `Resignation for ${resignedUser.nameEn} was finalized. The ${formatOffboardingTargetRole(payload.target.targetRole)} account is archived and active assignments are closed.`,
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
              blockedUntil: null
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

    await this.syncPickerResignationToHr(
      request.id,
      payload,
      finalizationInput.blockStatus,
      result.resignedUser,
      context
    );

    const user = toResignedUserResponse(result.resignedUser);

    return {
      request: toRequestSummary(result.completedRequest),
      user,
      picker: payload.target.targetRole === UserRole.PICKER ? user : undefined,
      assignment: result.closedAssignments[0] ?? null,
      assignments: result.closedAssignments
    };
  }

  private async syncPickerResignationToHr(
    requestId: string,
    payload: OffboardingPayload,
    blockStatus: BlockStatus,
    resignedUser: User,
    context: OffboardingRequestContext
  ) {
    if (payload.target.targetRole !== UserRole.PICKER) {
      return;
    }

    const lastWorkingDate = payload.offboarding.lastWorkingDate?.trim();
    const baseInput = {
      finalizerDisplayName: this.finalizerDisplayName(context.actor),
      type: this.formatHrSyncResignationType(blockStatus),
      employeeName: resignedUser.nameEn,
      nationalId: resignedUser.nationalId ?? "",
      lastWorkingDate: lastWorkingDate ?? null
    };

    if (!lastWorkingDate) {
      await this.recordFailedHrSyncLog({
        requestId,
        workflowType: HrSyncWorkflowType.PICKER_RESIGNATION,
        targetSheet: HrSyncTargetSheet.RESIGN,
        payloadSnapshot: {
          ...baseInput,
          requestType: "Resign"
        },
        errorMessage: "Missing lastWorkingDate for HR sync."
      });
      return;
    }

    const hrPayload = this.hrSync.buildPickerResignationPayload({
      ...baseInput,
      lastWorkingDate
    });

    await this.createAndSendHrSyncLog({
      requestId,
      workflowType: HrSyncWorkflowType.PICKER_RESIGNATION,
      targetSheet: HrSyncTargetSheet.RESIGN,
      eventType: "RESIGN",
      payloadSnapshot: hrPayload,
      payload: hrPayload
    });
  }

  private async createAndSendHrSyncLog(params: {
    requestId: string;
    workflowType: HrSyncWorkflowType;
    targetSheet: HrSyncTargetSheet;
    eventType: HrSyncEventType;
    payloadSnapshot: Prisma.InputJsonValue;
    payload: object;
  }) {
    let logId: string | null = null;

    try {
      const log = await this.hrSync.createNotSentLog({
        requestId: params.requestId,
        workflowType: params.workflowType,
        targetSheet: params.targetSheet,
        payloadSnapshot: params.payloadSnapshot
      });
      logId = log.id;

      const result = await this.hrSync.sendToHrSheet({
        eventType: params.eventType,
        payload: params.payload
      });

      if (result.status === "SENT") {
        await this.hrSync.markSent(log.id, {
          responseSnapshot: result.rawResponse,
          sentAt: new Date()
        });
        return;
      }

      if (result.status === "SKIPPED") {
        await this.hrSync.markSkipped(log.id, {
          reason: result.reason,
          responseSnapshot: {
            status: "SKIPPED",
            reason: result.reason
          }
        });
        return;
      }

      await this.hrSync.markFailed(log.id, {
        errorMessage: result.error,
        responseSnapshot: result.rawResponse
          ? (result.rawResponse as Prisma.InputJsonValue)
          : null
      });
    } catch (error) {
      if (!logId) {
        return;
      }

      try {
        await this.hrSync.markFailed(logId, {
          errorMessage: this.formatHrSyncError(error),
          responseSnapshot: null
        });
      } catch {
        // HR Sync must never fail a completed workflow finalization.
      }
    }
  }

  private async recordFailedHrSyncLog(params: {
    requestId: string;
    workflowType: HrSyncWorkflowType;
    targetSheet: HrSyncTargetSheet;
    payloadSnapshot: Prisma.InputJsonValue;
    errorMessage: string;
  }) {
    try {
      const log = await this.hrSync.createNotSentLog({
        requestId: params.requestId,
        workflowType: params.workflowType,
        targetSheet: params.targetSheet,
        payloadSnapshot: params.payloadSnapshot
      });
      await this.hrSync.markFailed(log.id, {
        errorMessage: params.errorMessage,
        responseSnapshot: null
      });
    } catch {
      // HR Sync logging must never fail a completed workflow finalization.
    }
  }

  private formatHrSyncResignationType(blockStatus: BlockStatus | string) {
    if (
      blockStatus === BlockStatus.PERMANENT_BLOCK ||
      blockStatus === "PERMANENT"
    ) {
      return "Permanent Block";
    }

    if (
      blockStatus === BlockStatus.TEMPORARY_BLOCK ||
      blockStatus === "TEMPORARY"
    ) {
      return "Temporary Block";
    }

    return "No Block";
  }

  private finalizerDisplayName(user: AuthenticatedUser) {
    return user.nameEn ?? user.phoneNumber ?? user.id;
  }

  private formatHrSyncError(error: unknown) {
    return error instanceof Error ? error.message : "HR sync failed.";
  }

  private resolveAreaManagerFinalizationDecision(
    payload: OffboardingPayload,
    dto: FinalizeOffboardingDto
  ) {
    if (!payload.areaManagerDecision) {
      throw new BadRequestException(
        "Area Manager block decision is required before Admin finalization."
      );
    }

    return normalizeOffboardingBlockDecision({
      blockDecision: payload.areaManagerDecision.blockDecision,
      blockReason: payload.areaManagerDecision.blockReason ?? undefined,
      notes: dto.notes
    });
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

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }
}
