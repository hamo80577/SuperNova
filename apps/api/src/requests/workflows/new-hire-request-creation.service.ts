import { Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { requestInclude } from "../request-includes";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import { toRequestSummary } from "../request-response.utils";
import type { NewHireTargetRole } from "./new-hire-workflow.policy";
import type {
  AreaManagerNewHireContext,
  BranchNewHireContext,
  CandidateUser,
  NewHirePayload,
  NormalizedNewHireCandidate,
  RequestContext
} from "./new-hire-workflow.types";

@Injectable()
export class NewHireRequestCreationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async createBranchNewHire(
    candidate: NormalizedNewHireCandidate,
    branchContext: BranchNewHireContext,
    rehireValidation: {
      rehireUser: CandidateUser | null;
      matchedBy: Array<"phoneNumber" | "nationalId">;
    },
    context: RequestContext
  ) {
    const createdAt = new Date();
    const mode = rehireValidation.rehireUser
      ? "REHIRE"
      : branchContext.targetRole === UserRole.PICKER
        ? "NEW_PICKER"
        : "NEW_CHAMP";
    const payload: NewHirePayload = {
      targetRole: branchContext.targetRole,
      mode,
      candidate,
      source: {
        vendorId: branchContext.sourceVendor.id,
        chainId: branchContext.sourceVendor.chainId
      },
      ...(branchContext.skipAreaManagerApproval &&
      branchContext.targetRole === UserRole.PICKER &&
      branchContext.areaManagerCapturedShopperId
        ? {
            areaManagerDecision: {
              shopperId: branchContext.areaManagerCapturedShopperId,
              approvedById: context.actor.id,
              approvedAt: createdAt.toISOString(),
              notes: null
            }
          }
        : {}),
      ...(rehireValidation.rehireUser
        ? {
            rehire: {
              userId: rehireValidation.rehireUser.id,
              matchedBy: rehireValidation.matchedBy,
              previousAccountStatus:
                rehireValidation.rehireUser.accountStatus,
              previousEmploymentStatus:
                rehireValidation.rehireUser.employmentStatus,
              previousBlockStatus: rehireValidation.rehireUser.blockStatus,
              previousBlockedUntil:
                rehireValidation.rehireUser.blockedUntil?.toISOString() ?? null,
              previousProfileStatus: rehireValidation.rehireUser.profileStatus
            }
          }
        : {})
    };

    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.NEW_HIRE,
          status: branchContext.skipAreaManagerApproval
            ? RequestStatus.PENDING_ADMIN
            : RequestStatus.PENDING_AREA_MANAGER,
          currentStep: branchContext.skipAreaManagerApproval
            ? ApprovalStep.ADMIN_FINAL_APPROVAL
            : ApprovalStep.AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: rehireValidation.rehireUser?.id,
          sourceVendorId: branchContext.sourceVendor.id,
          sourceChainId: branchContext.sourceVendor.chainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.createMany({
        data: [
          {
            requestId: request.id,
            step: ApprovalStep.AREA_MANAGER_APPROVAL,
            approverRole: UserRole.AREA_MANAGER,
            approverId: branchContext.areaManagerStep.approverId,
            status: branchContext.skipAreaManagerApproval
              ? ApprovalStatus.SKIPPED
              : ApprovalStatus.PENDING,
            decisionAt: branchContext.skipAreaManagerApproval ? createdAt : null,
            notes: branchContext.skipAreaManagerApproval
              ? "Area Manager-created New Hire skips Area Manager approval."
              : null
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
              targetRole: branchContext.targetRole,
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
              currentStep: request.currentStep,
              targetRole: branchContext.targetRole
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_GENERATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              step: ApprovalStep.AREA_MANAGER_APPROVAL,
              approverRole: UserRole.AREA_MANAGER,
              approverId: branchContext.areaManagerStep.approverId,
              status: branchContext.skipAreaManagerApproval
                ? ApprovalStatus.SKIPPED
                : ApprovalStatus.PENDING,
              chainId: branchContext.sourceVendor.chainId
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_GENERATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              step: ApprovalStep.ADMIN_FINAL_APPROVAL,
              approverRole: UserRole.ADMIN,
              approverId: null,
              status: ApprovalStatus.PENDING
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "New Hire request submitted",
          body: `${this.formatTargetRole(branchContext.targetRole)} New Hire request for ${candidate.phoneNumber} was submitted.`,
          payload: {
            requestId: request.id,
            targetRole: branchContext.targetRole
          }
        }
      });

      if (branchContext.skipAreaManagerApproval) {
        await this.createAdminPendingNotifications(tx, {
          requestId: request.id,
          targetRole: branchContext.targetRole
        });
      } else if (branchContext.areaManagerStep.approverId) {
        await tx.notification.create({
          data: {
            userId: branchContext.areaManagerStep.approverId,
            type: "APPROVAL_PENDING",
            title: "New Hire approval pending",
            body: `${this.formatTargetRole(branchContext.targetRole)} New Hire request for ${branchContext.sourceVendor.vendorName} requires your approval.`,
            payload: {
              requestId: request.id,
              step: ApprovalStep.AREA_MANAGER_APPROVAL,
              targetRole: branchContext.targetRole
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

  async createAreaManagerNewHire(
    candidate: NormalizedNewHireCandidate,
    _areaManagerContext: AreaManagerNewHireContext,
    context: RequestContext
  ) {
    const payload: NewHirePayload = {
      targetRole: UserRole.AREA_MANAGER,
      mode: "NEW_AREA_MANAGER",
      candidate,
      source: {}
    };

    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.NEW_HIRE,
          status: RequestStatus.PENDING_ADMIN,
          currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
          createdById: context.actor.id,
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
              targetRole: UserRole.AREA_MANAGER,
              chainAssignmentManagedFrom: "AREA_MANAGER_PROFILE"
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
              currentStep: request.currentStep,
              targetRole: UserRole.AREA_MANAGER
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_GENERATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              step: ApprovalStep.ADMIN_FINAL_APPROVAL,
              approverRole: UserRole.ADMIN,
              approverId: null,
              status: ApprovalStatus.PENDING
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "New Hire request submitted",
          body: `Area Manager New Hire request for ${candidate.phoneNumber} was submitted for Admin finalization.`,
          payload: {
            requestId: request.id,
            targetRole: UserRole.AREA_MANAGER
          }
        }
      });

      await this.createAdminPendingNotifications(tx, {
        requestId: request.id,
        targetRole: UserRole.AREA_MANAGER
      });

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    return toRequestSummary(updated);
  }

  private async createAdminPendingNotifications(
    tx: Prisma.TransactionClient,
    params: {
      requestId: string;
      targetRole: NewHireTargetRole;
    }
  ) {
    const admins = await tx.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        accountStatus: AccountStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!admins.length) {
      return;
    }

    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "APPROVAL_PENDING",
        title: "Admin finalization pending",
        body: `${this.formatTargetRole(params.targetRole)} New Hire requires Admin finalization.`,
        payload: {
          requestId: params.requestId,
          step: ApprovalStep.ADMIN_FINAL_APPROVAL,
          targetRole: params.targetRole
        }
      }))
    });
  }

  private formatTargetRole(targetRole: NewHireTargetRole) {
    return String(targetRole)
      .toLowerCase()
      .split("_")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
