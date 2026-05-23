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
import type { ApprovalDecisionDto } from "../approvals/dto/approval-decision.dto";
import { toUserSummary } from "../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CancelRequestDto } from "./dto/cancel-request.dto";
import type { CreateNewHireRequestDto } from "./dto/create-new-hire-request.dto";
import type { CreateOffboardingRequestDto } from "./dto/create-offboarding-request.dto";
import type { CreateRequestDto } from "./dto/create-request.dto";
import type { CreateTransferRequestDto } from "./dto/create-transfer-request.dto";
import type { FinalizeNewHireDto } from "./dto/finalize-new-hire.dto";
import type { FinalizeOffboardingDto } from "./dto/finalize-offboarding.dto";
import type { ListRequestsQueryDto } from "./dto/list-requests-query.dto";
import type { LookupNewHireCandidateDto } from "./dto/lookup-new-hire-candidate.dto";
import type { SearchOffboardingPickersDto } from "./dto/search-offboarding-pickers.dto";
import {
  assertRequestTransition,
  isPendingRequestStatus
} from "./request-status-machine";
import {
  requestDetailInclude,
  requestInclude,
  type RequestDetailWithRelations,
  type RequestWithRelations
} from "./request-includes";
import {
  RequestApprovalRoutingService,
  type GeneratedApprovalStep
} from "./request-approval-routing.service";
import { assertRequestPayloadSafe } from "./request-payload.utils";
import {
  toRequestDetailSummary,
  toRequestSummary,
  toTimeline
} from "./request-response.utils";
import { NewHireWorkflowService } from "./workflows/new-hire-workflow.service";
import { OffboardingWorkflowService } from "./workflows/offboarding-workflow.service";
import { TransferWorkflowService } from "./workflows/transfer-workflow.service";

const MAX_PAGE_SIZE = 100;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class RequestsService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(NewHireWorkflowService)
    private readonly newHireWorkflowService: NewHireWorkflowService,
    @Inject(OffboardingWorkflowService)
    private readonly offboardingWorkflowService: OffboardingWorkflowService,
    @Inject(TransferWorkflowService)
    private readonly transferWorkflowService: TransferWorkflowService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService
  ) {}

  getFoundationStatus() {
    return {
      module: "requests",
      status: "active",
      note: "Generic request infrastructure is enabled. New Hire, Resignation, and Transfer are implemented through dedicated workflow endpoints."
    };
  }

  async lookupNewHireCandidate(
    dto: LookupNewHireCandidateDto,
    currentUser: AuthenticatedUser
  ) {
    return this.newHireWorkflowService.lookupNewHireCandidate(dto, currentUser);
  }

  async list(query: ListRequestsQueryDto, currentUser: AuthenticatedUser) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = await this.buildListWhere(query, currentUser);

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
    const request = await this.findRequestDetailOrThrow(id);

    if (!(await this.canViewRequest(request, currentUser))) {
      throw new ForbiddenException("You do not have access to this request.");
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { entityType: "Request", entityId: id },
      orderBy: { createdAt: "asc" }
    });

    return {
      ...toRequestDetailSummary(request, { includeTargetOperationalFields: true }),
      timeline: toTimeline(request, auditLogs)
    };
  }

  async create(dto: CreateRequestDto, context: RequestContext) {
    if (context.actor.role === UserRole.PICKER) {
      throw new ForbiddenException("Pickers cannot create lifecycle requests.");
    }

    if (dto.type === RequestType.NEW_HIRE) {
      throw new BadRequestException(
        "Use the Branch-first New Hire workflow endpoint."
      );
    }

    if (dto.type === RequestType.RESIGNATION) {
      throw new BadRequestException(
        "Use the Branch-first Resignation workflow endpoint."
      );
    }

    if (dto.type === RequestType.TRANSFER) {
      throw new BadRequestException(
        "Use the Branch-first Transfer workflow endpoint."
      );
    }

    const normalized = await this.normalizeAndValidateCreateDto(dto);
    assertRequestPayloadSafe(normalized.payload);

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

  async createNewHire(dto: CreateNewHireRequestDto, context: RequestContext) {
    return this.newHireWorkflowService.createNewHire(dto, context);
  }

  async createOffboarding(
    dto: CreateOffboardingRequestDto,
    context: RequestContext
  ) {
    return this.offboardingWorkflowService.createOffboarding(dto, context);
  }

  async searchOffboardingPickers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    return this.offboardingWorkflowService.searchOffboardingPickers(
      dto,
      currentUser
    );
  }

  async searchOffboardingEligibleUsers(
    dto: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) {
    return this.offboardingWorkflowService.searchOffboardingEligibleUsers(
      dto,
      currentUser
    );
  }

  async createTransfer(dto: CreateTransferRequestDto, context: RequestContext) {
    return this.transferWorkflowService.createTransfer(dto, context);
  }

  async finalizeNewHire(
    id: string,
    dto: FinalizeNewHireDto,
    context: RequestContext
  ) {
    return this.newHireWorkflowService.finalizeNewHire(id, dto, context);
  }

  async finalizeOffboarding(
    id: string,
    dto: FinalizeOffboardingDto,
    context: RequestContext
  ) {
    return this.offboardingWorkflowService.finalizeOffboarding(
      id,
      dto,
      context
    );
  }

  async approveOffboardingAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    return this.offboardingWorkflowService.approveAreaManagerApproval(
      approvalId,
      dto,
      context
    );
  }

  async approveNewHireAreaManagerApproval(
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: RequestContext
  ) {
    return this.newHireWorkflowService.approveAreaManagerApproval(
      approvalId,
      dto,
      context
    );
  }

  async approveTransferApproval(
    approvalId: string,
    notes: string | undefined,
    context: RequestContext,
    options: { suppressIntermediateCreatorNotification?: boolean } = {}
  ) {
    return this.transferWorkflowService.approveTransferApproval(
      approvalId,
      notes,
      context,
      options
    );
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

  private async findRequestDetailOrThrow(id: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: requestDetailInclude
    });

    if (!request) {
      throw new NotFoundException("Request was not found.");
    }

    return request;
  }

  async canViewRequest(
    request: RequestWithRelations | RequestDetailWithRelations,
    user: AuthenticatedUser
  ) {
    if (this.isAdmin(user)) {
      return true;
    }

    if (request.createdById === user.id || request.targetUserId === user.id) {
      return true;
    }

    if (await this.userCanViewRequestByOperationalScope(request, user)) {
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

  private async userCanViewRequestByOperationalScope(
    request: Pick<
      Request,
      "sourceVendorId" | "destinationVendorId" | "sourceChainId" | "destinationChainId"
    >,
    user: AuthenticatedUser
  ) {
    if (user.role === UserRole.CHAMP) {
      const vendorIds = [
        request.sourceVendorId,
        request.destinationVendorId
      ].filter((value): value is string => Boolean(value));

      if (!vendorIds.length) {
        return false;
      }

      const assignment = await this.prisma.vendorChampAssignment.findFirst({
        where: {
          champId: user.id,
          vendorId: { in: vendorIds },
          status: AssignmentStatus.ACTIVE
        },
        select: { id: true }
      });

      return Boolean(assignment);
    }

    if (user.role === UserRole.AREA_MANAGER) {
      const chainIds = [
        request.sourceChainId,
        request.destinationChainId
      ].filter((value): value is string => Boolean(value));

      if (!chainIds.length) {
        return false;
      }

      const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
        where: {
          areaManagerId: user.id,
          chainId: { in: chainIds },
          status: AssignmentStatus.ACTIVE
        },
        select: { id: true }
      });

      return Boolean(assignment);
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

  private async buildListWhere(
    query: ListRequestsQueryDto,
    currentUser: AuthenticatedUser
  ): Promise<Prisma.RequestWhereInput> {
    const search = query.q?.trim();
    const visibilityFilters = await this.buildRequestVisibilityWhere(
      query,
      currentUser
    );
    const baseFilters: Prisma.RequestWhereInput = {
      status: query.status,
      type: query.type,
      ...visibilityFilters
    };
    const searchFilters: Prisma.RequestWhereInput | undefined = search
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
      : undefined;

    return searchFilters ? { AND: [baseFilters, searchFilters] } : baseFilters;
  }

  private async buildRequestVisibilityWhere(
    query: ListRequestsQueryDto,
    currentUser: AuthenticatedUser
  ): Promise<Prisma.RequestWhereInput> {
    if (this.isAdmin(currentUser)) {
      return {
        createdById: query.createdById,
        targetUserId: query.targetUserId
      };
    }

    if (query.createdById === currentUser.id) {
      return { createdById: currentUser.id };
    }

    const baseVisibility: Prisma.RequestWhereInput[] = [
      { createdById: currentUser.id },
      { targetUserId: currentUser.id },
      { approvals: { some: { approverId: currentUser.id } } }
    ];

    if (currentUser.role === UserRole.CHAMP) {
      const scopedVendors = await this.prisma.vendorChampAssignment.findMany({
        where: {
          champId: currentUser.id,
          status: AssignmentStatus.ACTIVE
        },
        select: { vendorId: true }
      });
      const vendorIds = scopedVendors.map((assignment) => assignment.vendorId);
      if (vendorIds.length) {
        baseVisibility.push(
          { sourceVendorId: { in: vendorIds } },
          { destinationVendorId: { in: vendorIds } }
        );
      }
    }

    if (currentUser.role === UserRole.AREA_MANAGER) {
      const scopedChains = await this.prisma.chainAreaManagerAssignment.findMany({
        where: {
          areaManagerId: currentUser.id,
          status: AssignmentStatus.ACTIVE
        },
        select: { chainId: true }
      });
      const chainIds = scopedChains.map((assignment) => assignment.chainId);
      if (chainIds.length) {
        baseVisibility.push(
          { sourceChainId: { in: chainIds } },
          { destinationChainId: { in: chainIds } }
        );
      }
    }

    return { OR: baseVisibility };
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
      return this.transferWorkflowService.generateApprovalStepsForRequest(request);
    }

    if (!request.sourceChainId) {
      throw new BadRequestException(
        `${request.type} requests require source Chain context.`
      );
    }

    return [
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
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

  private formatRequestType(type: RequestType) {
    return type
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
