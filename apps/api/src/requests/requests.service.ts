import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalStep,
  ApprovalStatus,
  AssignmentStatus,
  Chain,
  Prisma,
  Request,
  RequestStatus,
  RequestType,
  UserRole,
  Vendor
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { toUserSummary } from "../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CancelRequestDto } from "./dto/cancel-request.dto";
import type { CreateRequestDto } from "./dto/create-request.dto";
import type { ListRequestsQueryDto } from "./dto/list-requests-query.dto";
import {
  assertRequestTransition,
  isPendingRequestStatus
} from "./request-status-machine";
import { toRequestSummary, toTimeline } from "./request-response.utils";

const MAX_PAGE_SIZE = 100;

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

type RequestWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type GeneratedApprovalStep = {
  step: ApprovalStep;
  approverRole: UserRole;
  approverId: string | null;
  chainId?: string | null;
};

@Injectable()
export class RequestsService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  getFoundationStatus() {
    return {
      module: "requests",
      status: "active",
      note: "Generic request infrastructure is enabled; workflow finalization remains out of scope."
    };
  }

  async list(query: ListRequestsQueryDto, currentUser: AuthenticatedUser) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = this.buildListWhere(query, currentUser);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        include: requestInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: items.map(toRequestSummary),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async listSubmitted(query: ListRequestsQueryDto, currentUser: AuthenticatedUser) {
    return this.list({ ...query, createdById: currentUser.id }, currentUser);
  }

  async getById(id: string, currentUser: AuthenticatedUser) {
    const request = await this.findRequestOrThrow(id);

    if (!(await this.canViewRequest(request, currentUser))) {
      throw new ForbiddenException("You do not have access to this request.");
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { entityType: "Request", entityId: id },
      orderBy: { createdAt: "asc" }
    });

    return {
      ...toRequestSummary(request),
      timeline: toTimeline(request, auditLogs)
    };
  }

  async create(dto: CreateRequestDto, context: RequestContext) {
    if (context.actor.role === UserRole.PICKER) {
      throw new ForbiddenException("Pickers cannot create lifecycle requests.");
    }

    const normalized = await this.normalizeAndValidateCreateDto(dto);
    this.assertPayloadSafe(normalized.payload);

    const request = await this.prisma.request.create({
      data: {
        type: normalized.type,
        status: RequestStatus.DRAFT,
        createdById: context.actor.id,
        targetUserId: normalized.targetUserId,
        sourceChainId: normalized.sourceChainId,
        sourceVendorId: normalized.sourceVendorId,
        destinationChainId: normalized.destinationChainId,
        destinationVendorId: normalized.destinationVendorId,
        payload: normalized.payload as Prisma.InputJsonValue | undefined
      },
      include: requestInclude
    });

    await this.auditService.log({
      actorUserId: context.actor.id,
      action: "REQUEST_CREATED",
      entityType: "Request",
      entityId: request.id,
      newValue: this.toRequestAuditValue(request),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return toRequestSummary(request);
  }

  async submit(id: string, context: RequestContext) {
    const request = await this.findRequestOrThrow(id);

    if (!this.isAdmin(context.actor) && request.createdById !== context.actor.id) {
      throw new ForbiddenException("Only the creator or Admin can submit this request.");
    }

    if (request.status !== RequestStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT requests can be submitted.");
    }

    const steps = await this.generateApprovalSteps(request);
    if (!steps.length) {
      throw new BadRequestException("No approval steps were generated.");
    }

    const nextStatus = this.statusForStep(steps[0].step);
    assertRequestTransition(request.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.deleteMany({ where: { requestId: request.id } });
      await tx.requestApproval.createMany({
        data: steps.map((step) => ({
          requestId: request.id,
          step: step.step,
          approverRole: step.approverRole,
          approverId: step.approverId,
          status: ApprovalStatus.PENDING
        }))
      });

      return tx.request.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          currentStep: steps[0].step
        },
        include: requestInclude
      });
    });

    await this.auditService.log({
      actorUserId: context.actor.id,
      action: "REQUEST_SUBMITTED",
      entityType: "Request",
      entityId: request.id,
      oldValue: this.toRequestAuditValue(request),
      newValue: this.toRequestAuditValue(updated),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await Promise.all(
      steps.map((step) =>
        this.auditService.log({
          actorUserId: context.actor.id,
          action: "APPROVAL_GENERATED",
          entityType: "Request",
          entityId: request.id,
          newValue: {
            step: step.step,
            approverRole: step.approverRole,
            approverId: step.approverId,
            chainId: step.chainId ?? null
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        })
      )
    );

    await this.notifyRequestSubmitted(updated);
    await this.notifyPendingApproval(steps[0], updated);

    return toRequestSummary(updated);
  }

  async cancel(id: string, dto: CancelRequestDto, context: RequestContext) {
    const request = await this.findRequestOrThrow(id);

    if (!this.isAdmin(context.actor) && request.createdById !== context.actor.id) {
      throw new ForbiddenException("Only the creator or Admin can cancel this request.");
    }

    if (
      request.status !== RequestStatus.DRAFT &&
      !isPendingRequestStatus(request.status)
    ) {
      throw new BadRequestException("Only DRAFT or pending requests can be cancelled.");
    }

    assertRequestTransition(request.status, RequestStatus.CANCELLED);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.updateMany({
        where: { requestId: request.id, status: ApprovalStatus.PENDING },
        data: { status: ApprovalStatus.SKIPPED }
      });

      return tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.CANCELLED,
          currentStep: null,
          payload: this.withSystemNote(request.payload, "cancelNotes", dto.notes)
        },
        include: requestInclude
      });
    });

    await this.auditService.log({
      actorUserId: context.actor.id,
      action: "REQUEST_CANCELLED",
      entityType: "Request",
      entityId: request.id,
      oldValue: this.toRequestAuditValue(request),
      newValue: this.toRequestAuditValue(updated),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await this.notificationsService.create({
      userId: updated.createdById,
      type: "REQUEST_CANCELLED",
      title: "Request cancelled",
      body: `${updated.type} request was cancelled.`,
      payload: { requestId: updated.id }
    });

    return toRequestSummary(updated);
  }

  async findRequestOrThrow(id: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: requestInclude
    });

    if (!request) {
      throw new NotFoundException("Request was not found.");
    }

    return request;
  }

  async canViewRequest(request: RequestWithRelations, user: AuthenticatedUser) {
    if (this.isAdmin(user)) {
      return true;
    }

    if (request.createdById === user.id || request.targetUserId === user.id) {
      return true;
    }

    for (const approval of request.approvals) {
      if (
        await this.userCouldOwnApproval(
          request,
          approval.step,
          approval.approverId,
          user
        )
      ) {
        return true;
      }
    }

    return false;
  }

  async userCanActOnStep(
    request: Request,
    step: ApprovalStep,
    approverId: string | null,
    user: AuthenticatedUser
  ) {
    if (approverId && approverId !== user.id) {
      return false;
    }

    return this.userCouldOwnApproval(request, step, approverId, user);
  }

  statusForStep(step: ApprovalStep) {
    if (
      step === ApprovalStep.AREA_MANAGER_APPROVAL ||
      step === ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL
    ) {
      return RequestStatus.PENDING_AREA_MANAGER;
    }

    if (step === ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL) {
      return RequestStatus.PENDING_DESTINATION_AREA_MANAGER;
    }

    return RequestStatus.PENDING_ADMIN;
  }

  private buildListWhere(
    query: ListRequestsQueryDto,
    currentUser: AuthenticatedUser
  ): Prisma.RequestWhereInput {
    const search = query.q?.trim();
    const adminFilters = this.isAdmin(currentUser)
      ? {
          createdById: query.createdById,
          targetUserId: query.targetUserId
        }
      : {
          createdById: currentUser.id
        };

    return {
      status: query.status,
      type: query.type,
      ...adminFilters,
      ...(search
        ? {
            OR: [
              { createdBy: { nameEn: { contains: search, mode: "insensitive" } } },
              { targetUser: { nameEn: { contains: search, mode: "insensitive" } } },
              {
                sourceVendor: {
                  vendorName: { contains: search, mode: "insensitive" }
                }
              },
              {
                destinationVendor: {
                  vendorName: { contains: search, mode: "insensitive" }
                }
              },
              { sourceChain: { chainName: { contains: search, mode: "insensitive" } } },
              {
                destinationChain: {
                  chainName: { contains: search, mode: "insensitive" }
                }
              }
            ]
          }
        : {})
    };
  }

  private async normalizeAndValidateCreateDto(dto: CreateRequestDto) {
    const [
      sourceVendor,
      destinationVendor,
      sourceChain,
      destinationChain,
      targetUser
    ] = await Promise.all([
      dto.sourceVendorId
        ? this.prisma.vendor.findUnique({
            where: { id: dto.sourceVendorId },
            include: { chain: true }
          })
        : null,
      dto.destinationVendorId
        ? this.prisma.vendor.findUnique({
            where: { id: dto.destinationVendorId },
            include: { chain: true }
          })
        : null,
      dto.sourceChainId
        ? this.prisma.chain.findUnique({ where: { id: dto.sourceChainId } })
        : null,
      dto.destinationChainId
        ? this.prisma.chain.findUnique({ where: { id: dto.destinationChainId } })
        : null,
      dto.targetUserId
        ? this.prisma.user.findUnique({ where: { id: dto.targetUserId } })
        : null
    ]);

    if (dto.sourceVendorId && !sourceVendor) {
      throw new NotFoundException("Source vendor was not found.");
    }

    if (dto.destinationVendorId && !destinationVendor) {
      throw new NotFoundException("Destination vendor was not found.");
    }

    if (dto.sourceChainId && !sourceChain) {
      throw new NotFoundException("Source chain was not found.");
    }

    if (dto.destinationChainId && !destinationChain) {
      throw new NotFoundException("Destination chain was not found.");
    }

    if (dto.targetUserId && !targetUser) {
      throw new NotFoundException("Target user was not found.");
    }

    const sourceChainId = this.resolveChainId(
      "source",
      dto.sourceChainId,
      sourceVendor
    );
    const destinationChainId = this.resolveChainId(
      "destination",
      dto.destinationChainId,
      destinationVendor
    );

    return {
      ...dto,
      sourceChainId,
      destinationChainId
    };
  }

  private resolveChainId(
    label: "source" | "destination",
    chainId: string | undefined,
    vendor: (Vendor & { chain: Chain }) | null
  ) {
    if (chainId && vendor && vendor.chainId !== chainId) {
      throw new BadRequestException(
        `${label} vendor does not belong to the selected ${label} chain.`
      );
    }

    return chainId ?? vendor?.chainId;
  }

  private async generateApprovalSteps(
    request: RequestWithRelations
  ): Promise<GeneratedApprovalStep[]> {
    if (request.type === RequestType.TRANSFER) {
      if (!request.sourceChainId || !request.destinationChainId) {
        throw new BadRequestException(
          "Transfer requests require source and destination Chain context."
        );
      }

      const sourceStep = await this.resolveAreaManagerStep(
        ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
        request.sourceChainId
      );

      if (request.sourceChainId === request.destinationChainId) {
        return [sourceStep];
      }

      return [
        sourceStep,
        await this.resolveAreaManagerStep(
          ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL,
          request.destinationChainId
        )
      ];
    }

    if (!request.sourceChainId) {
      throw new BadRequestException(
        `${request.type} requests require source Chain context.`
      );
    }

    return [
      await this.resolveAreaManagerStep(
        ApprovalStep.AREA_MANAGER_APPROVAL,
        request.sourceChainId
      ),
      {
        step: ApprovalStep.ADMIN_FINAL_APPROVAL,
        approverRole: UserRole.ADMIN,
        approverId: null
      }
    ];
  }

  private async resolveAreaManagerStep(step: ApprovalStep, chainId: string) {
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        chainId,
        status: AssignmentStatus.ACTIVE,
        areaManager: { accountStatus: "ACTIVE" }
      },
      include: { areaManager: true }
    });

    if (!assignment) {
      throw new BadRequestException(
        "No active Area Manager assignment exists for the Chain context."
      );
    }

    return {
      step,
      approverRole: UserRole.AREA_MANAGER,
      approverId: assignment.areaManagerId,
      chainId
    };
  }

  private async userCouldOwnApproval(
    request: Pick<Request, "sourceChainId" | "destinationChainId">,
    step: ApprovalStep,
    approverId: string | null,
    user: AuthenticatedUser
  ) {
    if (step === ApprovalStep.ADMIN_FINAL_APPROVAL) {
      return this.isAdmin(user);
    }

    if (user.role !== UserRole.AREA_MANAGER) {
      return false;
    }

    if (approverId && approverId === user.id) {
      return true;
    }

    const chainId =
      step === ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL
        ? request.destinationChainId
        : request.sourceChainId;

    if (!chainId) {
      return false;
    }

    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        chainId,
        areaManagerId: user.id,
        status: AssignmentStatus.ACTIVE
      }
    });

    return Boolean(assignment);
  }

  private assertPayloadSafe(payload?: Record<string, unknown>) {
    if (!payload) {
      return;
    }

    const unsafeKeys = ["password", "secret", "token", "credential"];
    const stack: unknown[] = [payload];

    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== "object") {
        continue;
      }

      for (const [key, nested] of Object.entries(value)) {
        if (unsafeKeys.some((unsafe) => key.toLowerCase().includes(unsafe))) {
          throw new BadRequestException(
            "Request payload must not contain passwords, secrets, tokens, or credentials."
          );
        }

        if (nested && typeof nested === "object") {
          stack.push(nested);
        }
      }
    }
  }

  private async notifyRequestSubmitted(request: RequestWithRelations) {
    await this.notificationsService.create({
      userId: request.createdById,
      type: "REQUEST_SUBMITTED",
      title: "Request submitted",
      body: `${request.type} request was submitted for approval.`,
      payload: { requestId: request.id }
    });
  }

  private async notifyPendingApproval(
    step: GeneratedApprovalStep,
    request: RequestWithRelations
  ) {
    const payload = { requestId: request.id, step: step.step };

    if (step.approverId) {
      await this.notificationsService.create({
        userId: step.approverId,
        type: "APPROVAL_PENDING",
        title: "Approval pending",
        body: `${request.type} request requires your approval.`,
        payload
      });
      return;
    }

    if (step.step === ApprovalStep.ADMIN_FINAL_APPROVAL) {
      await this.notificationsService.notifyAdmins({
        type: "APPROVAL_PENDING",
        title: "Admin approval pending",
        body: `${request.type} request requires Admin approval.`,
        payload
      });
    }
  }

  private withSystemNote(
    payload: Prisma.JsonValue,
    key: string,
    value?: string
  ): Prisma.InputJsonValue | undefined {
    if (!value) {
      return payload as Prisma.InputJsonValue | undefined;
    }

    const current =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {};

    return {
      ...current,
      [key]: value
    };
  }

  private toRequestAuditValue(request: RequestWithRelations) {
    return {
      id: request.id,
      type: request.type,
      status: request.status,
      currentStep: request.currentStep,
      createdBy: toUserSummary(request.createdBy),
      targetUserId: request.targetUserId,
      sourceChainId: request.sourceChainId,
      sourceVendorId: request.sourceVendorId,
      destinationChainId: request.destinationChainId,
      destinationVendorId: request.destinationVendorId
    };
  }

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }
}
