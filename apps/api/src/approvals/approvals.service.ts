import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  ApprovalStatus,
  ApprovalStep,
  DeductionCaseStatus,
  Prisma,
  RequestApproval,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { AccessPolicyService } from "../access-control/access-policy.service";
import {
  isBranchAuthorityStep,
  isChainAuthorityStep,
  isFinalLifecycleAuthorityStep
} from "../access-control/approval-authority";
import { PermissionKeys } from "../access-control/permissions";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { USER_METRICS_UPDATED_EVENT } from "../dashboard-cache/dashboard-cache.constants";
import { DeductionsService } from "../deductions/deductions.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertRequestTransition
} from "../requests/request-status-machine";
import { requestInclude } from "../requests/request-includes";
import { toApprovalSummary, toRequestSummary } from "../requests/request-response.utils";
import { RequestsService } from "../requests/requests.service";
import { AnnualLeaveRequestService } from "../requests/workflows/annual-leave-request.service";
import type { ApprovalDecisionDto } from "./dto/approval-decision.dto";

const approvalInclude = {
  approver: true,
  request: {
    include: requestInclude
  }
} satisfies Prisma.RequestApprovalInclude;

type ApprovalWithRequest = Prisma.RequestApprovalGetPayload<{
  include: typeof approvalInclude;
}>;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestsService)
    private readonly requestsService: RequestsService,
    @Inject(DeductionsService)
    private readonly deductionsService: DeductionsService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService,
    @Inject(AnnualLeaveRequestService)
    private readonly annualLeaveRequestService: AnnualLeaveRequestService,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2
  ) {}

  getFoundationStatus() {
    return {
      module: "approvals",
      status: "active",
      note: "Generic approval decisions are enabled. New Hire and Resignation finalization use Branch-first request detail flows; Transfer applies automatically after the required Area Manager approvals."
    };
  }

  async listPending(currentUser: AuthenticatedUser) {
    const candidates = await this.prisma.requestApproval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        ...(currentUser.role === UserRole.ADMIN ||
        currentUser.role === UserRole.SUPER_ADMIN
          ? { step: ApprovalStep.ADMIN_FINAL_APPROVAL }
          : { approverRole: currentUser.role })
      },
      include: approvalInclude,
      orderBy: { createdAt: "asc" }
    });

    const items = [];
    for (const approval of candidates) {
      const expectedStatus = this.requestsService.statusForStep(approval.step);

      if (
        approval.status !== ApprovalStatus.PENDING ||
        approval.request.currentStep !== approval.step ||
        approval.request.status !== expectedStatus
      ) {
        continue;
      }

      if (
        await this.requestsService.userCanActOnStep(
          approval.request,
          approval.step,
          approval.approverId,
          currentUser
        )
      ) {
        items.push(this.toApprovalResponse(approval));
      }
    }

    return { items };
  }

  async approve(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    const approval = await this.findApprovalOrThrow(approvalId);
    this.assertApprovalDecisionPermission(approval, context.actor);
    await this.assertCanDecide(approval, context.actor);

    if (
      approval.request.type === RequestType.NEW_HIRE &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      const finalized = await this.requestsService.finalizeNewHire(
        approval.requestId,
        {},
        context
      );
      return finalized.request;
    }

    if (
      approval.request.type === RequestType.NEW_HIRE &&
      approval.step === ApprovalStep.AREA_MANAGER_APPROVAL
    ) {
      return this.requestsService.approveNewHireAreaManagerApproval(
        approval.id,
        dto,
        context
      );
    }

    if (
      approval.request.type === RequestType.RESIGNATION &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      throw new BadRequestException(
        "Resignation Admin final approval requires block decision and deactivation confirmation from the request detail page."
      );
    }

    if (
      approval.request.type === RequestType.RESIGNATION &&
      approval.step === ApprovalStep.AREA_MANAGER_APPROVAL
    ) {
      return this.requestsService.approveOffboardingAreaManagerApproval(
        approval.id,
        dto,
        context
      );
    }

    if (approval.request.type === RequestType.TRANSFER) {
      return this.requestsService.approveTransferApproval(
        approval.id,
        dto.notes,
        context
      );
    }

    if (
      approval.request.type === RequestType.DEDUCTION &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      return this.deductionsService.finalizeFromAdminApproval(
        approval.id,
        context,
        dto.notes
      );
    }

    if (approval.request.type === RequestType.ANNUAL_LEAVE) {
      // Re-check balance + active holds (excluding this request) before
      // advancing the chain. Never writes attendance.
      await this.annualLeaveRequestService.assertApprovalStillValid(
        approval.requestId,
        approval.id
      );
    }

    const pendingApprovals = this.sortApprovals(
      approval.request.approvals.filter(
        (item) => item.status === ApprovalStatus.PENDING && item.id !== approval.id
      )
    );
    const nextApproval = pendingApprovals[0] ?? null;
    const nextStatus = nextApproval
      ? this.requestsService.statusForStep(nextApproval.step)
      : RequestStatus.APPROVED;
    const decisionAt = new Date();
    const finalAnnualLeaveApproval =
      approval.request.type === RequestType.ANNUAL_LEAVE && !nextApproval;
    assertRequestTransition(approval.request.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt,
          notes: dto.notes,
          approverId: approval.approverId ?? context.actor.id
        }
      });

      return tx.request.update({
        where: { id: approval.requestId },
        data: {
          status: nextStatus,
          currentStep: nextApproval?.step ?? null,
          ...(finalAnnualLeaveApproval ? { completedAt: decisionAt } : {})
        },
        include: approvalInclude.request.include
      });
    });

    if (finalAnnualLeaveApproval && updated.annualLeaveRequest) {
      this.eventEmitter.emit(USER_METRICS_UPDATED_EVENT, {
        eventId: updated.id,
        userId: updated.annualLeaveRequest.targetUserId,
        month: updated.annualLeaveRequest.startDate.toISOString().slice(0, 7),
        source: "ANNUAL_LEAVE"
      });
    }

    await this.auditService.log({
      actorUserId: context.actor.id,
      action: "APPROVAL_APPROVED",
      entityType: "RequestApproval",
      entityId: approval.id,
      oldValue: this.toApprovalAuditValue(approval),
      newValue: {
        ...this.toApprovalAuditValue(approval),
        status: ApprovalStatus.APPROVED,
        notes: dto.notes ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await this.notificationsService.create({
      userId: approval.request.createdById,
      type: "APPROVAL_APPROVED",
      title: "Approval completed",
      body: `${approval.step} was approved.`,
      payload: { requestId: approval.requestId, approvalId: approval.id }
    });

    if (nextApproval) {
      await this.notifyNextApproval(nextApproval, updated.type, updated.id);
    } else {
      await this.auditService.log({
        actorUserId: context.actor.id,
        action: "REQUEST_APPROVED",
        entityType: "Request",
        entityId: updated.id,
        oldValue: { status: approval.request.status },
        newValue: {
          status: updated.status,
          ...(finalAnnualLeaveApproval
            ? { completedAt: decisionAt.toISOString() }
            : {})
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
      await this.notificationsService.create({
        userId: updated.createdById,
        type: "REQUEST_APPROVED",
        title: "Request approved",
        body: `${updated.type} request was approved.`,
        payload: { requestId: updated.id }
      });
    }

    return toRequestSummary(updated);
  }

  async reject(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    const approval = await this.findApprovalOrThrow(approvalId);
    this.assertApprovalDecisionPermission(approval, context.actor);
    await this.assertCanDecide(approval, context.actor);

    const notes = dto.notes?.trim();
    if (!notes) {
      throw new BadRequestException("Reject reason is required.");
    }

    assertRequestTransition(approval.request.status, RequestStatus.REJECTED);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.REJECTED,
          decisionAt: new Date(),
          notes,
          approverId: approval.approverId ?? context.actor.id
        }
      });
      await tx.requestApproval.updateMany({
        where: {
          requestId: approval.requestId,
          status: ApprovalStatus.PENDING,
          id: { not: approval.id }
        },
        data: { status: ApprovalStatus.SKIPPED }
      });

      if (approval.request.type === RequestType.DEDUCTION) {
        await this.deductionsService.markCaseTerminalInTransaction(
          tx,
          approval.requestId,
          DeductionCaseStatus.REJECTED
        );
      }

      return tx.request.update({
        where: { id: approval.requestId },
        data: {
          status: RequestStatus.REJECTED,
          currentStep: null
        },
        include: approvalInclude.request.include
      });
    });

    await this.auditService.log({
      actorUserId: context.actor.id,
      action: "APPROVAL_REJECTED",
      entityType: "RequestApproval",
      entityId: approval.id,
      oldValue: this.toApprovalAuditValue(approval),
      newValue: {
        ...this.toApprovalAuditValue(approval),
        status: ApprovalStatus.REJECTED,
        notes
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    await this.auditService.log({
      actorUserId: context.actor.id,
      action: "REQUEST_REJECTED",
      entityType: "Request",
      entityId: updated.id,
      oldValue: { status: approval.request.status },
      newValue: { status: updated.status },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await this.notificationsService.create({
      userId: updated.createdById,
      type: "REQUEST_REJECTED",
      title: "Request rejected",
      body: `${updated.type} request was rejected.`,
      payload: { requestId: updated.id, approvalId: approval.id }
    });

    return toRequestSummary(updated);
  }

  private async findApprovalOrThrow(id: string) {
    const approval = await this.prisma.requestApproval.findUnique({
      where: { id },
      include: approvalInclude
    });

    if (!approval) {
      throw new NotFoundException("Approval was not found.");
    }

    return approval;
  }

  private async assertCanDecide(
    approval: ApprovalWithRequest,
    user: AuthenticatedUser
  ) {
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException("Only PENDING approvals can be decided.");
    }

    const expectedStatus = this.requestsService.statusForStep(approval.step);
    if (
      approval.request.status !== expectedStatus ||
      approval.request.currentStep !== approval.step
    ) {
      throw new BadRequestException(
        "Approval is not the current pending step for this request."
      );
    }

    const canAct = await this.requestsService.userCanActOnStep(
      approval.request,
      approval.step,
      approval.approverId,
      user
    );

    if (!canAct) {
      throw new ForbiddenException("You do not own this approval step.");
    }
  }

  private assertApprovalDecisionPermission(
    approval: Pick<RequestApproval, "id" | "requestId" | "step">,
    user: AuthenticatedUser
  ) {
    if (isBranchAuthorityStep(approval.step)) {
      this.accessPolicy.assertCan(user, PermissionKeys.APPROVALS_DECIDE_BRANCH, {
        approvalId: approval.id,
        requestId: approval.requestId
      });
      return;
    }

    if (isChainAuthorityStep(approval.step)) {
      this.accessPolicy.assertCan(user, PermissionKeys.APPROVALS_DECIDE_CHAIN, {
        approvalId: approval.id,
        requestId: approval.requestId
      });
      return;
    }

    if (isFinalLifecycleAuthorityStep(approval.step)) {
      this.accessPolicy.assertCan(
        user,
        PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE,
        {
          approvalId: approval.id,
          requestId: approval.requestId
        }
      );
      return;
    }

    throw new BadRequestException(
      `Unsupported approval authority step ${approval.step}.`
    );
  }

  private sortApprovals<T extends Pick<RequestApproval, "step" | "createdAt">>(
    approvals: T[]
  ) {
    const priority: Record<ApprovalStep, number> = {
      [ApprovalStep.CHAMP_APPROVAL]: 0,
      [ApprovalStep.AREA_MANAGER_APPROVAL]: 1,
      [ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL]: 1,
      [ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL]: 2,
      [ApprovalStep.ADMIN_FINAL_APPROVAL]: 3
    };

    return [...approvals].sort((left, right) => {
      const byPriority = priority[left.step] - priority[right.step];
      return byPriority || left.createdAt.getTime() - right.createdAt.getTime();
    });
  }

  private async notifyNextApproval(
    approval: RequestApproval,
    requestType: string,
    requestId: string
  ) {
    const payload = { requestId, approvalId: approval.id, step: approval.step };

    if (approval.approverId) {
      await this.notificationsService.create({
        userId: approval.approverId,
        type: "APPROVAL_PENDING",
        title: "Approval pending",
        body: `${requestType} request requires your approval.`,
        payload
      });
      return;
    }

    if (approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL) {
      await this.notificationsService.notifyAdmins({
        type: "APPROVAL_PENDING",
        title: "Admin approval pending",
        body: `${requestType} request requires Admin approval.`,
        payload
      });
    }
  }

  private toApprovalResponse(approval: ApprovalWithRequest) {
    return {
      ...toApprovalSummary(approval),
      request: toRequestSummary(approval.request)
    };
  }

  private toApprovalAuditValue(approval: ApprovalWithRequest) {
    return {
      id: approval.id,
      requestId: approval.requestId,
      step: approval.step,
      approverRole: approval.approverRole,
      approverId: approval.approverId,
      status: approval.status
    };
  }
}
