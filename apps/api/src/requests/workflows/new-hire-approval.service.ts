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
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import type { ApprovalDecisionDto } from "../../approvals/dto/approval-decision.dto";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import {
  requestInclude,
  type RequestApprovalWithRequest
} from "../request-includes";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import { toRequestSummary } from "../request-response.utils";
import { assertRequestTransition } from "../request-status-machine";
import { parseNewHirePayload } from "./new-hire-payload";
import {
  normalizeNewHireShopperId,
  normalizeOptionalNewHireShopperId
} from "./new-hire-workflow.policy";
import type { NewHirePayload, RequestContext } from "./new-hire-workflow.types";

@Injectable()
export class NewHireApprovalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async approveAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    const approval = await this.findApprovalOrThrow(approvalId);

    if (
      approval.request.type !== RequestType.NEW_HIRE ||
      approval.step !== ApprovalStep.AREA_MANAGER_APPROVAL
    ) {
      throw new BadRequestException(
        "Only New Hire Area Manager approvals can be completed here."
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
        "New Hire request is not waiting for Area Manager approval."
      );
    }

    await this.assertCanApproveAreaManagerStep(approval, context.actor);

    const payload = parseNewHirePayload(approval.request.payload);
    const notes = dto.notes?.trim() || null;
    const shopperId = await this.resolveShopperId(payload, dto);
    assertRequestTransition(
      approval.request.status,
      RequestStatus.PENDING_ADMIN
    );

    const approvedAt = new Date();
    const updatedPayload: NewHirePayload = {
      ...payload,
      areaManagerDecision: {
        ...(shopperId ? { shopperId } : {}),
        approvedById: context.actor.id,
        approvedAt: approvedAt.toISOString(),
        notes
      }
    };
    assertRequestPayloadSafe(updatedPayload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: approvedAt,
          approverId: approval.approverId ?? context.actor.id,
          notes: notes ?? "Area Manager New Hire approval completed."
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
          title: "New Hire approval completed",
          body: "Area Manager approval was recorded. The request is waiting for Admin final approval.",
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
            title: "New Hire final approval pending",
            body: "New Hire request is waiting for Admin final approval.",
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
              requestId: approval.requestId,
              targetRole: payload.targetRole,
              shopperIdCaptured: Boolean(shopperId)
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

  private async resolveShopperId(
    payload: NewHirePayload,
    dto: ApprovalDecisionDto
  ) {
    if (payload.targetRole !== UserRole.PICKER) {
      const submittedShopperId = this.applyPolicyValidation(() =>
        normalizeOptionalNewHireShopperId(dto.shopperId)
      );
      if (submittedShopperId) {
        throw new BadRequestException(
          "Shopper ID is only captured for Picker New Hire approvals."
        );
      }

      return undefined;
    }

    const submittedShopperId = this.applyPolicyValidation(() =>
      normalizeOptionalNewHireShopperId(dto.shopperId)
    );
    const rehireUser = payload.rehire?.userId
      ? await this.prisma.user.findUnique({ where: { id: payload.rehire.userId } })
      : null;
    const fallbackShopperId = rehireUser?.shopperId?.trim() || undefined;
    const shopperId =
      submittedShopperId ??
      fallbackShopperId ??
      this.applyPolicyValidation(() =>
        normalizeNewHireShopperId(
          dto.shopperId,
          "Shopper ID is required for Picker New Hire Area Manager approval."
        )
      );

    const existingShopper = await this.prisma.user.findUnique({
      where: { shopperId }
    });

    if (existingShopper && existingShopper.id !== rehireUser?.id) {
      throw new ConflictException("Shopper ID is already assigned to another user.");
    }

    return shopperId;
  }

  private async assertCanApproveAreaManagerStep(
    approval: RequestApprovalWithRequest,
    actor: AuthenticatedUser
  ) {
    if (actor.role !== UserRole.AREA_MANAGER) {
      throw new ForbiddenException(
        "Only Area Managers can approve this New Hire step."
      );
    }

    if (approval.approverId && approval.approverId !== actor.id) {
      throw new ForbiddenException("This approval is assigned to another user.");
    }

    const chainId = approval.request.sourceChainId;
    if (!chainId) {
      throw new BadRequestException("New Hire request is missing Chain context.");
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
        "You can approve New Hire requests only within your assigned Chain scope."
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
