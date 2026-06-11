import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  DeductionCaseStatus,
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import { RequestApprovalRoutingService } from "../requests/request-approval-routing.service";
import { assertRequestPayloadSafe } from "../requests/request-payload.utils";
import { requestInclude } from "../requests/request-includes";
import { toRequestSummary } from "../requests/request-response.utils";
import { assertRequestTransition } from "../requests/request-status-machine";
import { DeductionPolicyService } from "./deduction-policy.service";
import { DeductionsScopeService } from "./deductions-scope.service";
import type {
  CreateDeductionRequestDto,
  PreviewDeductionDto
} from "./dto/preview-deduction.dto";
import type { ListDeductionsQueryDto } from "./dto/list-deductions-query.dto";
import {
  type DeductionCaseSummary,
  type DeductionPreviewResult,
  type DeductionRequestContext,
  type DeductionRequestPayload,
  type DeductionTargetRole
} from "./deductions.types";

const DEFAULT_PAGE_SIZE = 25;
const OPEN_CASE_STATUSES = [
  DeductionCaseStatus.PENDING_APPROVAL,
  DeductionCaseStatus.EFFECTIVE
];

const caseInclude = {
  targetUser: {
    select: { id: true, nameEn: true, role: true, shopperId: true, ibsId: true }
  },
  createdBy: { select: { id: true, nameEn: true, role: true } },
  policyVersion: { select: { versionNumber: true } },
  request: {
    select: {
      id: true,
      status: true,
      sourceVendorId: true,
      sourceChainId: true,
      sourceVendor: { select: { vendorName: true } },
      sourceChain: { select: { chainName: true } }
    }
  }
} satisfies Prisma.DeductionCaseInclude;

type CaseWithContext = Prisma.DeductionCaseGetPayload<{
  include: typeof caseInclude;
}>;

@Injectable()
export class DeductionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(DeductionPolicyService)
    private readonly policyService: DeductionPolicyService,
    @Inject(DeductionsScopeService)
    private readonly scopeService: DeductionsScopeService,
    @Inject(RequestApprovalRoutingService)
    private readonly approvalRoutingService: RequestApprovalRoutingService
  ) {}

  async preview(
    dto: PreviewDeductionDto,
    actor: AuthenticatedUser
  ): Promise<DeductionPreviewResult> {
    this.assertCreatorRole(actor);
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    const incident = this.parseIncidentDate(dto.incidentDate);
    const target = await this.scopeService.resolveScopedTarget(
      dto.targetUserId,
      targetRole,
      actor,
      dto.sourceVendorId
    );
    const { policy, action } = await this.policyService.getActiveAction(
      dto.actionId
    );
    const occurrenceNumber = await this.nextOccurrenceNumber(
      target.targetUser.id,
      action.id,
      incident.incidentMonth
    );
    const penalty = this.policyService.matchRuleStep(
      action.ruleSteps,
      occurrenceNumber
    );

    return {
      target,
      action: { id: action.id, code: action.code, name: action.name },
      policyVersion: { id: policy.id, versionNumber: policy.versionNumber },
      incidentDate: incident.incidentDate,
      incidentMonth: incident.incidentMonth,
      occurrenceNumber,
      penalty,
      approvalPath: [
        {
          step: ApprovalStep.AREA_MANAGER_APPROVAL,
          skipped: actor.role === UserRole.AREA_MANAGER
        },
        { step: ApprovalStep.ADMIN_FINAL_APPROVAL, skipped: false }
      ]
    };
  }

  async createDeductionRequest(
    dto: CreateDeductionRequestDto,
    context: DeductionRequestContext
  ) {
    const preview = await this.preview(dto, context.actor);
    const { action: policyAction } = await this.policyService.getActiveAction(
      dto.actionId
    );
    const reason = dto.reason?.trim() || undefined;
    const notes = dto.notes?.trim() || undefined;
    const incidentDateValue = new Date(`${preview.incidentDate}T00:00:00.000Z`);
    const isAreaManagerCreator =
      context.actor.role === UserRole.AREA_MANAGER;

    const areaManagerStep = isAreaManagerCreator
      ? null
      : await this.approvalRoutingService.resolveAreaManagerStep(
          ApprovalStep.AREA_MANAGER_APPROVAL,
          preview.target.sourceChainId
        );

    const updated = await this.prisma.$transaction(async (tx) => {
      // Recompute occurrence + penalty inside the transaction so two
      // concurrent submissions for the same target+action+month can't both
      // settle on the same number; the partial unique index on
      // (targetUserId, actionId, incidentMonth, occurrenceNumber) for open
      // statuses is the final hard guard against a duplicate landing.
      const occurrenceNumber =
        (await tx.deductionCase.count({
          where: {
            targetUserId: preview.target.targetUser.id,
            actionId: preview.action.id,
            incidentMonth: preview.incidentMonth,
            status: { in: OPEN_CASE_STATUSES }
          }
        })) + 1;
      const penalty = this.policyService.matchRuleStep(
        policyAction.ruleSteps,
        occurrenceNumber
      );

      const payload: DeductionRequestPayload = {
        deduction: {
          type: "DEDUCTION",
          actionId: preview.action.id,
          actionCode: preview.action.code,
          actionName: preview.action.name,
          policyVersionId: preview.policyVersion.id,
          policyVersionNumber: preview.policyVersion.versionNumber,
          incidentDate: preview.incidentDate,
          incidentMonth: preview.incidentMonth,
          occurrenceNumber,
          penaltyType: penalty.penaltyType,
          deductionDays: penalty.deductionDays,
          penaltyLabel: penalty.label,
          ...(reason ? { reason } : {}),
          ...(notes ? { notes } : {})
        },
        source: {
          vendorId: preview.target.sourceVendorId,
          vendorName: preview.target.sourceVendorName,
          chainId: preview.target.sourceChainId,
          chainName: preview.target.sourceChainName
        },
        target: {
          userId: preview.target.targetUser.id,
          targetRole: preview.target.targetRole,
          name: preview.target.targetUser.nameEn,
          shopperId: preview.target.targetUser.shopperId,
          ibsId: preview.target.targetUser.ibsId
        }
      };
      assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);

      const request = await tx.request.create({
        data: {
          type: RequestType.DEDUCTION,
          status: isAreaManagerCreator
            ? RequestStatus.PENDING_ADMIN
            : RequestStatus.PENDING_AREA_MANAGER,
          currentStep: isAreaManagerCreator
            ? ApprovalStep.ADMIN_FINAL_APPROVAL
            : ApprovalStep.AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: preview.target.targetUser.id,
          sourceVendorId: preview.target.sourceVendorId,
          sourceChainId: preview.target.sourceChainId,
          payload: payload as unknown as Prisma.InputJsonValue
        }
      });

      const areaManagerApproval = await tx.requestApproval.create({
        data: {
          requestId: request.id,
          step: ApprovalStep.AREA_MANAGER_APPROVAL,
          approverRole: UserRole.AREA_MANAGER,
          approverId: isAreaManagerCreator
            ? context.actor.id
            : areaManagerStep?.approverId ?? null,
          status: isAreaManagerCreator
            ? ApprovalStatus.SKIPPED
            : ApprovalStatus.PENDING,
          ...(isAreaManagerCreator
            ? {
                decisionAt: new Date(),
                notes: "Area Manager submitted this Deduction; approval skipped."
              }
            : {})
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

      await tx.deductionCase.create({
        data: {
          requestId: request.id,
          targetUserId: preview.target.targetUser.id,
          createdById: context.actor.id,
          actionId: preview.action.id,
          policyVersionId: preview.policyVersion.id,
          incidentDate: incidentDateValue,
          incidentMonth: preview.incidentMonth,
          occurrenceNumber: occurrenceNumber,
          penaltyType: penalty.penaltyType,
          deductionDays: penalty.deductionDays,
          penaltyLabel: penalty.label,
          actionNameSnapshot: preview.action.name,
          policySnapshot: {
            policyVersionId: preview.policyVersion.id,
            versionNumber: preview.policyVersion.versionNumber,
            actionId: preview.action.id,
            actionCode: preview.action.code,
            actionName: preview.action.name,
            matchedRule: {
              occurrenceNumber: penalty.occurrenceNumber,
              appliesFromOccurrence: penalty.appliesFromOccurrence,
              penaltyType: penalty.penaltyType,
              deductionDays: penalty.deductionDays,
              label: penalty.label
            }
          } as Prisma.InputJsonValue,
          targetSnapshot: {
            userId: preview.target.targetUser.id,
            name: preview.target.targetUser.nameEn,
            role: preview.target.targetRole,
            shopperId: preview.target.targetUser.shopperId,
            ibsId: preview.target.targetUser.ibsId
          } as Prisma.InputJsonValue,
          scopeSnapshot: {
            vendorId: preview.target.sourceVendorId,
            vendorName: preview.target.sourceVendorName,
            chainId: preview.target.sourceChainId,
            chainName: preview.target.sourceChainName,
            assignmentId: preview.target.assignmentId,
            assignmentType: preview.target.assignmentType,
            createdByRole: context.actor.role
          } as Prisma.InputJsonValue,
          reason: reason ?? null,
          notes: notes ?? null,
          status: DeductionCaseStatus.PENDING_APPROVAL
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
          {
            actorUserId: context.actor.id,
            action: "DEDUCTION_CASE_CREATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              actionName: preview.action.name,
              occurrenceNumber: occurrenceNumber,
              penaltyType: penalty.penaltyType,
              deductionDays: penalty.deductionDays,
              incidentMonth: preview.incidentMonth
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
          title: "Deduction ticket submitted",
          body: `Deduction ticket for ${preview.target.targetUser.nameEn} (${preview.action.name}, occurrence ${occurrenceNumber}) was submitted.`,
          payload: {
            requestId: request.id,
            targetUserId: preview.target.targetUser.id
          }
        }
      });

      if (!isAreaManagerCreator && areaManagerStep?.approverId) {
        await tx.notification.create({
          data: {
            userId: areaManagerStep.approverId,
            type: "APPROVAL_PENDING",
            title: "Deduction approval pending",
            body: `Deduction ticket for ${preview.target.sourceVendorName} requires your approval.`,
            payload: {
              requestId: request.id,
              approvalId: areaManagerApproval.id,
              step: ApprovalStep.AREA_MANAGER_APPROVAL,
              targetUserId: preview.target.targetUser.id
            }
          }
        });
      }

      if (isAreaManagerCreator) {
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
              title: "Deduction final approval pending",
              body: "A Deduction ticket is waiting for Admin final approval.",
              payload: {
                requestId: request.id,
                step: ApprovalStep.ADMIN_FINAL_APPROVAL,
                targetUserId: preview.target.targetUser.id
              }
            }))
          });
        }
      }

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    return toRequestSummary(updated);
  }

  /**
   * Transition a deduction case to a terminal status when its parent request is
   * rejected through the shared approvals flow. The deductions module owns the
   * PENDING_APPROVAL -> terminal invariant so foreign modules don't re-encode
   * it; callers pass their open transaction.
   */
  async markCaseTerminalInTransaction(
    tx: Prisma.TransactionClient,
    requestId: string,
    status:
      | typeof DeductionCaseStatus.REJECTED
      | typeof DeductionCaseStatus.CANCELLED
  ) {
    await tx.deductionCase.updateMany({
      where: {
        requestId,
        status: DeductionCaseStatus.PENDING_APPROVAL
      },
      data: { status }
    });
  }

  async finalizeFromAdminApproval(
    approvalId: string,
    context: DeductionRequestContext
  ) {
    const approval = await this.prisma.requestApproval.findUnique({
      where: { id: approvalId },
      include: { request: { include: requestInclude } }
    });

    if (!approval) {
      throw new NotFoundException("Approval was not found.");
    }

    if (
      approval.request.type !== RequestType.DEDUCTION ||
      approval.step !== ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      throw new BadRequestException(
        "Only Deduction Admin final approvals can be completed here."
      );
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException("Approval is not pending.");
    }

    if (
      approval.request.status !== RequestStatus.PENDING_ADMIN ||
      approval.request.currentStep !== ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      throw new BadRequestException(
        "Deduction request is not waiting for Admin final approval."
      );
    }

    assertRequestTransition(approval.request.status, RequestStatus.COMPLETED);

    const completedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          approverId: approval.approverId ?? context.actor.id
        }
      });

      const existingPayload = (approval.request.payload ?? {}) as Record<
        string,
        unknown
      >;
      const request = await tx.request.update({
        where: { id: approval.requestId },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          payload: {
            ...existingPayload,
            finalization: {
              completedAt: completedAt.toISOString(),
              finalizedById: context.actor.id
            }
          } as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      const deductionCase = await tx.deductionCase.update({
        where: { requestId: approval.requestId },
        data: {
          status: DeductionCaseStatus.EFFECTIVE,
          finalApprovedById: context.actor.id,
          finalApprovedAt: completedAt
        }
      });

      await tx.auditLog.createMany({
        data: [
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_APPROVED",
            entityType: "RequestApproval",
            entityId: approval.id,
            oldValue: { status: approval.status, step: approval.step },
            newValue: { status: ApprovalStatus.APPROVED, step: approval.step },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "DEDUCTION_CASE_EFFECTIVE",
            entityType: "Request",
            entityId: approval.requestId,
            newValue: {
              deductionCaseId: deductionCase.id,
              penaltyType: deductionCase.penaltyType,
              deductionDays:
                deductionCase.deductionDays === null
                  ? null
                  : Number(deductionCase.deductionDays),
              occurrenceNumber: deductionCase.occurrenceNumber
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: approval.requestId,
            oldValue: { status: approval.request.status },
            newValue: { status: RequestStatus.COMPLETED },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      await tx.notification.createMany({
        data: [
          {
            userId: request.createdById,
            type: "DEDUCTION_COMPLETED",
            title: "Deduction ticket approved",
            body: `Deduction (${deductionCase.actionNameSnapshot}, ${deductionCase.penaltyLabel}) is now effective.`,
            payload: { requestId: request.id }
          },
          {
            userId: deductionCase.targetUserId,
            type: "DEDUCTION_ISSUED",
            title: "A deduction was recorded",
            body: `A deduction (${deductionCase.actionNameSnapshot}, ${deductionCase.penaltyLabel}) was recorded for ${deductionCase.incidentMonth}.`,
            payload: { requestId: request.id }
          }
        ]
      });

      return request;
    });

    return toRequestSummary(updated);
  }

  async list(query: ListDeductionsQueryDto, actor: AuthenticatedUser) {
    const page = toPositiveInt(query.page, 1);
    const pageSize = Math.min(
      toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE),
      100
    );
    const scopeWhere = await this.buildScopeWhere(actor);
    const filterWhere: Prisma.DeductionCaseWhereInput = {
      ...(query.month ? { incidentMonth: query.month } : {}),
      ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
      ...(query.actionId ? { actionId: query.actionId } : {}),
      ...(query.q
        ? {
            targetUser: {
              OR: [
                { nameEn: { contains: query.q, mode: "insensitive" } },
                { nameAr: { contains: query.q, mode: "insensitive" } },
                { shopperId: { contains: query.q, mode: "insensitive" } }
              ]
            }
          }
        : {})
    };
    const baseWhere: Prisma.DeductionCaseWhereInput = {
      AND: [scopeWhere, filterWhere]
    };
    const listWhere: Prisma.DeductionCaseWhereInput = query.status
      ? { AND: [baseWhere, { status: query.status }] }
      : baseWhere;

    const [items, total, summaryCases] = await Promise.all([
      this.prisma.deductionCase.findMany({
        where: listWhere,
        include: caseInclude,
        orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.deductionCase.count({ where: listWhere }),
      this.prisma.deductionCase.findMany({
        where: baseWhere,
        select: {
          status: true,
          penaltyType: true,
          deductionDays: true
        }
      })
    ]);

    const effective = summaryCases.filter(
      (item) => item.status === DeductionCaseStatus.EFFECTIVE
    );

    return {
      items: items.map((item) => this.toCaseSummary(item)),
      summary: {
        effectiveCount: effective.length,
        warningCount: effective.filter(
          (item) => item.penaltyType === "WARNING"
        ).length,
        deductionDaysTotal: roundTwoDecimals(
          effective.reduce(
            (sum, item) =>
              sum + (item.deductionDays === null ? 0 : Number(item.deductionDays)),
            0
          )
        ),
        pendingCount: summaryCases.filter(
          (item) => item.status === DeductionCaseStatus.PENDING_APPROVAL
        ).length
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getById(id: string, actor: AuthenticatedUser) {
    const deductionCase = await this.prisma.deductionCase.findUnique({
      where: { id },
      include: caseInclude
    });

    if (!deductionCase) {
      throw new NotFoundException("Deduction case was not found.");
    }

    if (!(await this.canViewCase(deductionCase, actor))) {
      throw new ForbiddenException("You do not have access to this deduction.");
    }

    return this.toCaseSummary(deductionCase);
  }

  async searchTargets(
    actor: AuthenticatedUser,
    targetRole: DeductionTargetRole,
    q?: string | null
  ) {
    this.assertCreatorRole(actor);
    return this.scopeService.searchScopedTargets(actor, targetRole, q);
  }

  normalizeTargetRole(targetRole: UserRole | string | null | undefined) {
    const normalized = targetRole ?? UserRole.PICKER;

    if (normalized === UserRole.PICKER || normalized === UserRole.CHAMP) {
      return normalized as DeductionTargetRole;
    }

    throw new BadRequestException("targetRole must be PICKER or CHAMP.");
  }

  private assertCreatorRole(actor: AuthenticatedUser) {
    if (
      actor.role !== UserRole.CHAMP &&
      actor.role !== UserRole.AREA_MANAGER
    ) {
      throw new ForbiddenException(
        "Only Champs and Area Managers can create Deduction tickets in this phase."
      );
    }
  }

  private parseIncidentDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isRealCalendarDate(value)) {
      throw new BadRequestException("incidentDate is invalid.");
    }

    // Validate against the server's calendar date and compare date strings.
    // The client bounds the picker by its local calendar date the same way,
    // so this is immune to the UTC/local instant mismatches that otherwise
    // appear at day and month boundaries.
    const today = localDateString(new Date());
    if (value > today) {
      throw new BadRequestException("incidentDate cannot be in the future.");
    }

    const incidentMonth = value.slice(0, 7);
    if (incidentMonth !== today.slice(0, 7)) {
      throw new BadRequestException(
        "Deductions can only be recorded for the current month."
      );
    }

    return {
      incidentDate: value,
      incidentMonth
    };
  }

  private async nextOccurrenceNumber(
    targetUserId: string,
    actionId: string,
    incidentMonth: string
  ) {
    const existing = await this.prisma.deductionCase.count({
      where: {
        targetUserId,
        actionId,
        incidentMonth,
        status: { in: OPEN_CASE_STATUSES }
      }
    });

    return existing + 1;
  }

  private async buildScopeWhere(
    actor: AuthenticatedUser
  ): Promise<Prisma.DeductionCaseWhereInput> {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (actor.role === UserRole.PICKER) {
      return {
        targetUserId: actor.id,
        status: DeductionCaseStatus.EFFECTIVE
      };
    }

    if (actor.role === UserRole.CHAMP) {
      const vendorIds = await this.scopeService.resolveActorVendorIds(actor);
      return {
        OR: [
          {
            targetUserId: actor.id,
            status: DeductionCaseStatus.EFFECTIVE
          },
          {
            // Champs supervise Pickers in their branches only. Restrict to
            // PICKER targets so a Champ can never see his own pending/rejected
            // case (its sourceVendorId is his own branch) or a peer Champ's.
            targetUser: { role: UserRole.PICKER },
            request: { sourceVendorId: { in: vendorIds } }
          }
        ]
      };
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      const chainIds = await this.scopeService.resolveActorChainIds(actor);
      return { request: { sourceChainId: { in: chainIds } } };
    }

    throw new ForbiddenException("You do not have access to deductions.");
  }

  private async canViewCase(
    deductionCase: CaseWithContext,
    actor: AuthenticatedUser
  ) {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (deductionCase.createdById === actor.id) {
      return true;
    }

    if (
      deductionCase.targetUserId === actor.id &&
      deductionCase.status === DeductionCaseStatus.EFFECTIVE
    ) {
      return true;
    }

    if (actor.role === UserRole.CHAMP) {
      if (deductionCase.targetUser.role !== UserRole.PICKER) {
        return false;
      }
      const vendorIds = await this.scopeService.resolveActorVendorIds(actor);
      return (
        !!deductionCase.request.sourceVendorId &&
        vendorIds.includes(deductionCase.request.sourceVendorId)
      );
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      const chainIds = await this.scopeService.resolveActorChainIds(actor);
      return (
        !!deductionCase.request.sourceChainId &&
        chainIds.includes(deductionCase.request.sourceChainId)
      );
    }

    return false;
  }

  private toCaseSummary(deductionCase: CaseWithContext): DeductionCaseSummary {
    return {
      id: deductionCase.id,
      requestId: deductionCase.requestId,
      status: deductionCase.status,
      incidentDate: deductionCase.incidentDate.toISOString().slice(0, 10),
      incidentMonth: deductionCase.incidentMonth,
      occurrenceNumber: deductionCase.occurrenceNumber,
      penaltyType: deductionCase.penaltyType,
      deductionDays:
        deductionCase.deductionDays === null
          ? null
          : Number(deductionCase.deductionDays),
      penaltyLabel: deductionCase.penaltyLabel,
      actionId: deductionCase.actionId,
      actionName: deductionCase.actionNameSnapshot,
      policyVersionNumber: deductionCase.policyVersion?.versionNumber ?? null,
      reason: deductionCase.reason,
      notes: deductionCase.notes,
      target: {
        id: deductionCase.targetUser.id,
        nameEn: deductionCase.targetUser.nameEn,
        role: deductionCase.targetUser.role,
        shopperId: deductionCase.targetUser.shopperId,
        ibsId: deductionCase.targetUser.ibsId
      },
      createdBy: {
        id: deductionCase.createdBy.id,
        nameEn: deductionCase.createdBy.nameEn,
        role: deductionCase.createdBy.role
      },
      source: {
        vendorId: deductionCase.request.sourceVendorId,
        vendorName: deductionCase.request.sourceVendor?.vendorName ?? null,
        chainId: deductionCase.request.sourceChainId,
        chainName: deductionCase.request.sourceChain?.chainName ?? null
      },
      finalApprovedById: deductionCase.finalApprovedById,
      finalApprovedAt: deductionCase.finalApprovedAt
        ? deductionCase.finalApprovedAt.toISOString()
        : null,
      createdAt: deductionCase.createdAt.toISOString()
    };
  }
}

function roundTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isRealCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
