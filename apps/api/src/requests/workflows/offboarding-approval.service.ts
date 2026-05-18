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
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import type { ApprovalDecisionDto } from "../../approvals/dto/approval-decision.dto";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import {
  requestInclude,
  type RequestApprovalWithRequest
} from "../request-includes";
import { toRequestSummary } from "../request-response.utils";
import { assertRequestTransition } from "../request-status-machine";
import { parseOffboardingPayload } from "./offboarding-payload";
import {
  normalizeOffboardingBlockDecision
} from "./offboarding-workflow.policy";
import type {
  OffboardingPayload,
  OffboardingRequestContext
} from "./offboarding-types";

@Injectable()
export class OffboardingApprovalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async approveAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: OffboardingRequestContext
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

    const payload = parseOffboardingPayload(approval.request.payload);
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
}
