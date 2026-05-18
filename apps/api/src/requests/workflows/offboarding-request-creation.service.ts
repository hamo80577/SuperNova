import { ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStep,
  ApprovalStatus,
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import type { GeneratedApprovalStep } from "../request-approval-routing.service";
import { requestInclude } from "../request-includes";
import { toRequestSummary } from "../request-response.utils";
import type {
  OffboardingPayload,
  OffboardingRequestContext,
  ResignationTargetContext
} from "./offboarding-types";
import { openRequestStatuses } from "./offboarding-types";

@Injectable()
export class OffboardingRequestCreationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertNoPendingOffboarding(userId: string) {
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

  async createApprovalRoutedRequest(
    target: ResignationTargetContext,
    areaManagerStep: GeneratedApprovalStep,
    payload: OffboardingPayload,
    context: OffboardingRequestContext
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

  async createAreaManagerSubmittedRequest(
    target: ResignationTargetContext,
    payload: OffboardingPayload,
    context: OffboardingRequestContext
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

  async createAdminSubmittedRequest(
    target: ResignationTargetContext,
    payload: OffboardingPayload,
    context: OffboardingRequestContext
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
    context: OffboardingRequestContext,
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
}
