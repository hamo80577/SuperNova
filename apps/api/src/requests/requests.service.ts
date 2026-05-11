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
  Chain,
  ChainStatus,
  EmploymentStatus,
  Gender,
  Prisma,
  ProfileStatus,
  Request,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus,
  Vendor
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { AuditService } from "../audit/audit.service";
import { toUserSummary } from "../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { findSensitiveJsonKey } from "../security/sensitive-data.utils";
import { TemporaryPasswordService } from "../users/temporary-password.service";
import type { CancelRequestDto } from "./dto/cancel-request.dto";
import type { CreateNewHireRequestDto } from "./dto/create-new-hire-request.dto";
import type { CreateOffboardingRequestDto } from "./dto/create-offboarding-request.dto";
import type { CreateRequestDto } from "./dto/create-request.dto";
import type { CreateTransferRequestDto } from "./dto/create-transfer-request.dto";
import type { FinalizeNewHireDto } from "./dto/finalize-new-hire.dto";
import type { FinalizeOffboardingDto } from "./dto/finalize-offboarding.dto";
import type { ListRequestsQueryDto } from "./dto/list-requests-query.dto";
import {
  assertRequestTransition,
  isPendingRequestStatus
} from "./request-status-machine";
import { toRequestSummary, toTimeline } from "./request-response.utils";

const MAX_PAGE_SIZE = 100;
const PASSWORD_HASH_ROUNDS = 12;
const TEMPORARY_PASSWORD_EXPIRY_HOURS = 24;

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

type TransferApprovalWithRequest = Prisma.RequestApprovalGetPayload<{
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

type GeneratedApprovalStep = {
  step: ApprovalStep;
  approverRole: UserRole;
  approverId: string | null;
  chainId?: string | null;
};

type NewHirePayload = {
  candidate: {
    nameEn?: string;
    nameAr?: string;
    phoneNumber: string;
    nationalId?: string;
    address?: string;
    dateOfBirth?: string;
    gender: Gender;
    notes?: string;
  };
  source: {
    vendorId: string;
    chainId: string;
  };
  finalization?: {
    pickerId: string;
    assignmentId: string;
    shopperId: string;
    completedAt: string;
  };
};

type OffboardingPayload = {
  offboarding: {
    type: RequestType;
    reason: string;
    notes?: string;
    resignationDate?: string;
    terminationDate?: string;
  };
  source: {
    vendorId: string;
    chainId: string;
  };
  target: {
    pickerId: string;
    pickerAssignmentId: string;
  };
  finalization?: {
    completedAt: string;
    assignmentId: string;
    blockStatus: BlockStatus;
    blockedUntil?: string | null;
    blockReason?: string | null;
    finalizedById: string;
    notes?: string;
  };
};

type TransferPayload = {
  transfer: {
    reason: string;
    notes?: string;
    requestedTransferDate?: string;
    approvalPath: "SAME_CHAIN" | "CROSS_CHAIN";
  };
  source: {
    vendorId: string;
    chainId: string;
    pickerAssignmentId: string;
  };
  destination: {
    vendorId: string;
    chainId: string;
  };
  target: {
    pickerId: string;
  };
  finalization?: {
    completedAt: string;
    oldAssignmentId: string;
    newAssignmentId: string;
    appliedByApprovalId: string;
  };
};

@Injectable()
export class RequestsService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TemporaryPasswordService)
    private readonly temporaryPasswordService: TemporaryPasswordService
  ) {}

  getFoundationStatus() {
    return {
      module: "requests",
      status: "active",
      note: "Generic request infrastructure is enabled. New Hire, Resignation/Termination, and Transfer are implemented through Branch-first workflows."
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

    if (dto.type === RequestType.NEW_HIRE) {
      throw new BadRequestException(
        "Use the Branch-first New Hire workflow endpoint."
      );
    }

    if (
      dto.type === RequestType.RESIGNATION ||
      dto.type === RequestType.TERMINATION
    ) {
      throw new BadRequestException(
        "Use the Branch-first Offboarding workflow endpoint."
      );
    }

    if (dto.type === RequestType.TRANSFER) {
      throw new BadRequestException(
        "Use the Branch-first Transfer workflow endpoint."
      );
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

  async createNewHire(dto: CreateNewHireRequestDto, context: RequestContext) {
    if (context.actor.role !== UserRole.CHAMP && !this.isAdmin(context.actor)) {
      throw new ForbiddenException(
        "Only Champs and Admins can submit New Hire requests."
      );
    }

    const candidate = this.normalizeNewHireCandidate(dto);

    const sourceVendor = this.isAdmin(context.actor)
      ? await this.prisma.vendor.findUnique({
          where: { id: dto.sourceVendorId },
          include: { chain: true }
        })
      : (
          await this.prisma.vendorChampAssignment.findFirst({
            where: {
              champId: context.actor.id,
              vendorId: dto.sourceVendorId,
              status: AssignmentStatus.ACTIVE
            },
            include: {
              vendor: {
                include: { chain: true }
              }
            }
          })
        )?.vendor;

    if (!sourceVendor) {
      throw new ForbiddenException(
        this.isAdmin(context.actor)
          ? "Selected Branch was not found."
          : "You can submit New Hire requests only for assigned active Branches."
      );
    }

    if (sourceVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch is not active.");
    }

    if (sourceVendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch Chain is not active.");
    }

    const areaManagerStep = await this.resolveAreaManagerStep(
      ApprovalStep.AREA_MANAGER_APPROVAL,
      sourceVendor.chainId
    );

    const payload: NewHirePayload = {
      candidate,
      source: {
        vendorId: sourceVendor.id,
        chainId: sourceVendor.chainId
      }
    };

    this.assertPayloadSafe(payload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.NEW_HIRE,
          status: RequestStatus.PENDING_AREA_MANAGER,
          currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          sourceVendorId: sourceVendor.id,
          sourceChainId: sourceVendor.chainId,
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
            action: "APPROVAL_GENERATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              step: areaManagerStep.step,
              approverRole: areaManagerStep.approverRole,
              approverId: areaManagerStep.approverId,
              chainId: areaManagerStep.chainId ?? null
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
              approverId: null
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
          body: `New Hire request for ${candidate.phoneNumber} was submitted for Area Manager approval.`,
          payload: { requestId: request.id }
        }
      });

      if (areaManagerStep.approverId) {
        await tx.notification.create({
          data: {
            userId: areaManagerStep.approverId,
            type: "APPROVAL_PENDING",
            title: "New Hire approval pending",
            body: `New Hire request for ${sourceVendor.vendorName} requires your approval.`,
            payload: {
              requestId: request.id,
              step: areaManagerStep.step
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

  async createOffboarding(
    dto: CreateOffboardingRequestDto,
    context: RequestContext
  ) {
    if (context.actor.role !== UserRole.CHAMP && !this.isAdmin(context.actor)) {
      throw new ForbiddenException(
        "Only Champs and Admins can submit Resignation or Termination requests."
      );
    }

    const offboarding = this.normalizeOffboardingRequest(dto);

    const assignment = this.isAdmin(context.actor)
      ? null
      : await this.prisma.vendorChampAssignment.findFirst({
          where: {
            champId: context.actor.id,
            vendorId: dto.sourceVendorId,
            status: AssignmentStatus.ACTIVE
          },
          include: {
            vendor: {
              include: {
                chain: true,
                pickerAssignments: {
                  where: {
                    pickerId: dto.targetUserId,
                    status: AssignmentStatus.ACTIVE
                  },
                  include: { picker: true }
                }
              }
            }
          }
        });

    const adminVendor = this.isAdmin(context.actor)
      ? await this.prisma.vendor.findUnique({
          where: { id: dto.sourceVendorId },
          include: {
            chain: true,
            pickerAssignments: {
              where: {
                pickerId: dto.targetUserId,
                status: AssignmentStatus.ACTIVE
              },
              include: { picker: true }
            }
          }
        })
      : null;

    const sourceContext = assignment
      ? { vendorId: assignment.vendorId, vendor: assignment.vendor }
      : adminVendor
        ? { vendorId: adminVendor.id, vendor: adminVendor }
        : null;

    if (!sourceContext) {
      throw new ForbiddenException(
        this.isAdmin(context.actor)
          ? "Selected Branch was not found."
          : "You can submit offboarding requests only for assigned active Branches."
      );
    }

    if (sourceContext.vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch is not active.");
    }

    if (sourceContext.vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch Chain is not active.");
    }

    const pickerAssignment = sourceContext.vendor.pickerAssignments[0];
    if (!pickerAssignment) {
      throw new BadRequestException(
        "Selected Picker is not actively assigned to this Branch."
      );
    }

    if (
      pickerAssignment.picker.role !== UserRole.PICKER ||
      pickerAssignment.picker.accountStatus !== AccountStatus.ACTIVE ||
      pickerAssignment.picker.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Selected user must be an active Picker under this Branch."
      );
    }

    const duplicate = await this.prisma.request.findFirst({
      where: {
        type: { in: [RequestType.RESIGNATION, RequestType.TERMINATION] },
        targetUserId: pickerAssignment.pickerId,
        status: {
          notIn: [
            RequestStatus.REJECTED,
            RequestStatus.CANCELLED,
            RequestStatus.COMPLETED
          ]
        }
      }
    });

    if (duplicate) {
      throw new ConflictException(
        "A pending offboarding request already exists for this Picker."
      );
    }

    const areaManagerStep = await this.resolveAreaManagerStep(
      ApprovalStep.AREA_MANAGER_APPROVAL,
      sourceContext.vendor.chainId
    );

    const payload: OffboardingPayload = {
      offboarding,
      source: {
        vendorId: sourceContext.vendorId,
        chainId: sourceContext.vendor.chainId
      },
      target: {
        pickerId: pickerAssignment.pickerId,
        pickerAssignmentId: pickerAssignment.id
      }
    };

    this.assertPayloadSafe(payload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: offboarding.type,
          status: RequestStatus.PENDING_AREA_MANAGER,
          currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: pickerAssignment.pickerId,
          sourceVendorId: sourceContext.vendorId,
          sourceChainId: sourceContext.vendor.chainId,
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
            action: "APPROVAL_GENERATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              step: areaManagerStep.step,
              approverRole: areaManagerStep.approverRole,
              approverId: areaManagerStep.approverId,
              chainId: areaManagerStep.chainId ?? null
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
              approverId: null
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
          title: `${this.formatRequestType(offboarding.type)} request submitted`,
          body: `${this.formatRequestType(offboarding.type)} request for ${pickerAssignment.picker.nameEn} was submitted for Area Manager approval.`,
          payload: { requestId: request.id, pickerId: pickerAssignment.pickerId }
        }
      });

      if (areaManagerStep.approverId) {
        await tx.notification.create({
          data: {
            userId: areaManagerStep.approverId,
            type: "APPROVAL_PENDING",
            title: `${this.formatRequestType(offboarding.type)} approval pending`,
            body: `${this.formatRequestType(offboarding.type)} request for ${sourceContext.vendor.vendorName} requires your approval.`,
            payload: {
              requestId: request.id,
              step: areaManagerStep.step,
              pickerId: pickerAssignment.pickerId
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

  async createTransfer(dto: CreateTransferRequestDto, context: RequestContext) {
    const canSubmitTransfer =
      context.actor.role === UserRole.CHAMP ||
      context.actor.role === UserRole.AREA_MANAGER ||
      this.isAdmin(context.actor);

    if (!canSubmitTransfer) {
      throw new ForbiddenException(
        "Only Champs, Area Managers, and Admins can submit Transfer requests."
      );
    }

    const transfer = this.normalizeTransferRequest(dto);

    if (dto.sourceVendorId === dto.destinationVendorId) {
      throw new BadRequestException(
        "Destination Branch must be different from the source Branch."
      );
    }

    const [
      sourcePickerAssignment,
      champSourceAssignment,
      areaManagerSourceAssignment,
      destinationVendor
    ] = await Promise.all([
      this.prisma.pickerBranchAssignment.findFirst({
        where: {
          pickerId: dto.targetUserId,
          vendorId: dto.sourceVendorId,
          status: AssignmentStatus.ACTIVE
        },
        include: {
          picker: true,
          vendor: {
            include: { chain: true }
          }
        }
      }),
      context.actor.role === UserRole.CHAMP
        ? this.prisma.vendorChampAssignment.findFirst({
            where: {
              champId: context.actor.id,
              vendorId: dto.sourceVendorId,
              status: AssignmentStatus.ACTIVE
            }
          })
        : null,
      context.actor.role === UserRole.AREA_MANAGER
        ? this.prisma.chainAreaManagerAssignment.findFirst({
            where: {
              areaManagerId: context.actor.id,
              chain: {
                vendors: {
                  some: { id: dto.sourceVendorId }
                }
              },
              status: AssignmentStatus.ACTIVE
            }
          })
        : null,
      this.prisma.vendor.findUnique({
        where: { id: dto.destinationVendorId },
        include: { chain: true }
      })
    ]);

    if (!sourcePickerAssignment) {
      throw new ForbiddenException(
        this.isAdmin(context.actor)
          ? "Selected Picker is not actively assigned to the source Branch."
          : context.actor.role === UserRole.AREA_MANAGER
            ? "Selected Picker is not actively assigned to a Branch in your Chain scope."
          : "You can submit Transfer requests only from assigned active Branches."
      );
    }

    if (context.actor.role === UserRole.CHAMP && !champSourceAssignment) {
      throw new ForbiddenException(
        "You can submit Transfer requests only from Branches you currently manage."
      );
    }

    if (context.actor.role === UserRole.AREA_MANAGER && !areaManagerSourceAssignment) {
      throw new ForbiddenException(
        "Area Managers can transfer only Pickers from Chains they currently manage."
      );
    }

    if (sourcePickerAssignment.vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is not active.");
    }

    if (sourcePickerAssignment.vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Source Branch Chain is not active.");
    }

    if (
      sourcePickerAssignment.picker.role !== UserRole.PICKER ||
      sourcePickerAssignment.picker.accountStatus !== AccountStatus.ACTIVE ||
      sourcePickerAssignment.picker.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Selected user must be an active Picker under this Branch."
      );
    }

    if (!destinationVendor) {
      throw new NotFoundException("Destination Branch was not found.");
    }

    if (destinationVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Destination Branch is not active.");
    }

    if (destinationVendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Destination Branch Chain is not active.");
    }

    const duplicateTransfer = await this.prisma.request.findFirst({
      where: {
        type: RequestType.TRANSFER,
        targetUserId: sourcePickerAssignment.pickerId,
        status: {
          notIn: [
            RequestStatus.REJECTED,
            RequestStatus.CANCELLED,
            RequestStatus.COMPLETED
          ]
        }
      }
    });

    if (duplicateTransfer) {
      throw new ConflictException(
        "A pending Transfer request already exists for this Picker."
      );
    }

    const pendingOffboarding = await this.prisma.request.findFirst({
      where: {
        type: { in: [RequestType.RESIGNATION, RequestType.TERMINATION] },
        targetUserId: sourcePickerAssignment.pickerId,
        status: {
          notIn: [
            RequestStatus.REJECTED,
            RequestStatus.CANCELLED,
            RequestStatus.COMPLETED
          ]
        }
      }
    });

    if (pendingOffboarding) {
      throw new ConflictException(
        "A pending offboarding request already exists for this Picker."
      );
    }

    const sourceStep = await this.resolveAreaManagerStep(
      ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
      sourcePickerAssignment.vendor.chainId
    );
    const isCrossChain =
      sourcePickerAssignment.vendor.chainId !== destinationVendor.chainId;
    const destinationStep = isCrossChain
      ? await this.resolveAreaManagerStep(
          ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL,
          destinationVendor.chainId
        )
      : null;

    const payload: TransferPayload = {
      transfer: {
        ...transfer,
        approvalPath: isCrossChain ? "CROSS_CHAIN" : "SAME_CHAIN"
      },
      source: {
        vendorId: sourcePickerAssignment.vendorId,
        chainId: sourcePickerAssignment.vendor.chainId,
        pickerAssignmentId: sourcePickerAssignment.id
      },
      destination: {
        vendorId: destinationVendor.id,
        chainId: destinationVendor.chainId
      },
      target: {
        pickerId: sourcePickerAssignment.pickerId
      }
    };

    this.assertPayloadSafe(payload as unknown as Record<string, unknown>);

    const steps = destinationStep ? [sourceStep, destinationStep] : [sourceStep];
    const shouldAutoApproveSource =
      context.actor.role === UserRole.AREA_MANAGER &&
      sourceStep.approverId === context.actor.id;

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.TRANSFER,
          status: RequestStatus.PENDING_AREA_MANAGER,
          currentStep: ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: sourcePickerAssignment.pickerId,
          sourceVendorId: sourcePickerAssignment.vendorId,
          sourceChainId: sourcePickerAssignment.vendor.chainId,
          destinationVendorId: destinationVendor.id,
          destinationChainId: destinationVendor.chainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.createMany({
        data: steps.map((step) => ({
          requestId: request.id,
          step: step.step,
          approverRole: step.approverRole,
          approverId: step.approverId,
          status: ApprovalStatus.PENDING
        }))
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
              destinationVendorId: request.destinationVendorId
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
          ...steps.map((step) => ({
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
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }))
        ]
      });

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "Transfer request submitted",
          body: shouldAutoApproveSource
            ? `Transfer request for ${sourcePickerAssignment.picker.nameEn} was submitted and source approval was applied.`
            : `Transfer request for ${sourcePickerAssignment.picker.nameEn} was submitted for source Area Manager approval.`,
          payload: {
            requestId: request.id,
            pickerId: sourcePickerAssignment.pickerId,
            sourceVendorId: sourcePickerAssignment.vendorId,
            destinationVendorId: destinationVendor.id
          }
        }
      });

      if (sourceStep.approverId && !shouldAutoApproveSource) {
        await tx.notification.create({
          data: {
            userId: sourceStep.approverId,
            type: "APPROVAL_PENDING",
            title: "Transfer approval pending",
            body: `Transfer request from ${sourcePickerAssignment.vendor.vendorName} requires your approval.`,
            payload: {
              requestId: request.id,
              step: sourceStep.step,
              pickerId: sourcePickerAssignment.pickerId
            }
          }
        });
      }

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    if (shouldAutoApproveSource) {
      const sourceApproval = updated.approvals.find(
        (approval) => approval.step === ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL
      );

      if (!sourceApproval) {
        throw new BadRequestException("Source Area Manager approval was not created.");
      }

      return this.approveTransferApproval(
        sourceApproval.id,
        "Source Area Manager initiated and auto-approved this Transfer.",
        context,
        { suppressIntermediateCreatorNotification: true }
      );
    }

    return toRequestSummary(updated);
  }

  async finalizeNewHire(
    id: string,
    dto: FinalizeNewHireDto,
    context: RequestContext
  ) {
    if (!this.isAdmin(context.actor)) {
      throw new ForbiddenException("Only Admins can finalize New Hire requests.");
    }

    const request = await this.findRequestOrThrow(id);

    if (request.type !== RequestType.NEW_HIRE) {
      throw new BadRequestException("Only NEW_HIRE requests can be finalized here.");
    }

    if (
      request.status !== RequestStatus.PENDING_ADMIN ||
      request.currentStep !== ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      throw new BadRequestException(
        "New Hire request is not waiting for Admin finalization."
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

    const payload = this.parseNewHirePayload(request.payload);
    const shopperId = dto.shopperId?.trim();

    if (!shopperId) {
      throw new BadRequestException("Shopper ID is required.");
    }

    const [existingShopper, existingPhone, sourceVendor] = await Promise.all([
      this.prisma.user.findUnique({ where: { shopperId } }),
      this.prisma.user.findUnique({
        where: { phoneNumber: payload.candidate.phoneNumber }
      }),
      this.prisma.vendor.findUnique({
        where: { id: payload.source.vendorId },
        include: { chain: true }
      })
    ]);

    if (existingShopper) {
      throw new ConflictException("Shopper ID is already assigned to another user.");
    }

    if (existingPhone) {
      throw new ConflictException("Candidate phone number already belongs to a user.");
    }

    if (!sourceVendor) {
      throw new NotFoundException("Source Branch was not found.");
    }

    if (sourceVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is no longer active.");
    }

    if (sourceVendor.chainId !== payload.source.chainId) {
      throw new BadRequestException(
        "Source Branch no longer belongs to the stored source Chain."
      );
    }

    const temporaryPassword = this.temporaryPasswordService.generate();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const temporaryPasswordExpiresAt = new Date(
      Date.now() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000
    );
    const temporaryPasswordCreatedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const picker = await tx.user.create({
        data: {
          role: UserRole.PICKER,
          nameEn: payload.candidate.nameEn ?? payload.candidate.nameAr ?? "New Picker",
          nameAr: payload.candidate.nameAr,
          phoneNumber: payload.candidate.phoneNumber,
          nationalId: payload.candidate.nationalId,
          address: payload.candidate.address,
          dateOfBirth: payload.candidate.dateOfBirth
            ? new Date(payload.candidate.dateOfBirth)
            : null,
          gender: payload.candidate.gender,
          shopperId,
          joiningDate: new Date(),
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE,
          profileStatus: ProfileStatus.INCOMPLETE,
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt,
          temporaryPasswordCiphertext:
            this.temporaryPasswordService.encrypt(temporaryPassword),
          temporaryPasswordCreatedAt
        }
      });

      const assignment = await tx.pickerBranchAssignment.create({
        data: {
          pickerId: picker.id,
          vendorId: sourceVendor.id,
          status: AssignmentStatus.ACTIVE,
          createdByRequestId: request.id
        },
        include: {
          vendor: { include: { chain: true } },
          picker: true
        }
      });

      await tx.requestApproval.update({
        where: { id: adminApproval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: new Date(),
          approverId: context.actor.id,
          notes: "New Hire finalized with Shopper ID."
        }
      });

      const completedPayload: NewHirePayload = {
        ...payload,
        finalization: {
          pickerId: picker.id,
          assignmentId: assignment.id,
          shopperId,
          completedAt: new Date().toISOString()
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt: new Date(),
          targetUserId: picker.id,
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: request.createdById,
          type: "NEW_HIRE_COMPLETED",
          title: "New Hire completed",
          body: `Picker credentials: phone ${picker.phoneNumber}, temporary password ${temporaryPassword}. The Picker must change this password on first login.`,
          payload: {
            requestId: request.id,
            pickerId: picker.id,
            phoneNumber: picker.phoneNumber,
            temporaryPassword,
            temporaryPasswordExpiresAt: temporaryPasswordExpiresAt.toISOString()
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
            action: "ADMIN_FINALIZED_NEW_HIRE",
            entityType: "Request",
            entityId: request.id,
            oldValue: { status: request.status, currentStep: request.currentStep },
            newValue: { status: RequestStatus.COMPLETED, shopperId },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "USER_CREATED",
            entityType: "User",
            entityId: picker.id,
            newValue: {
              role: picker.role,
              phoneNumber: picker.phoneNumber,
              shopperId: picker.shopperId,
              profileStatus: picker.profileStatus,
              mustChangePassword: picker.mustChangePassword
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "TEMPORARY_PASSWORD_GENERATED",
            entityType: "User",
            entityId: picker.id,
            newValue: {
              temporaryPasswordExpiresAt: temporaryPasswordExpiresAt.toISOString(),
              deliveredToUserId: request.createdById
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "PICKER_BRANCH_ASSIGNMENT_CREATED",
            entityType: "PickerBranchAssignment",
            entityId: assignment.id,
            newValue: {
              pickerId: picker.id,
              vendorId: sourceVendor.id,
              createdByRequestId: request.id
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
            newValue: { status: RequestStatus.COMPLETED, targetUserId: picker.id },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, picker, assignment };
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
        accountStatus: result.picker.accountStatus,
        employmentStatus: result.picker.employmentStatus,
        profileStatus: result.picker.profileStatus,
        mustChangePassword: result.picker.mustChangePassword
      },
      assignment: {
        id: result.assignment.id,
        status: result.assignment.status,
        startDate: result.assignment.startDate,
        vendorId: result.assignment.vendorId,
        pickerId: result.assignment.pickerId,
        createdByRequestId: result.assignment.createdByRequestId
      }
    };
  }

  async finalizeOffboarding(
    id: string,
    dto: FinalizeOffboardingDto,
    context: RequestContext
  ) {
    if (!this.isAdmin(context.actor)) {
      throw new ForbiddenException(
        "Only Admins can finalize Resignation or Termination requests."
      );
    }

    const request = await this.findRequestOrThrow(id);

    if (
      request.type !== RequestType.RESIGNATION &&
      request.type !== RequestType.TERMINATION
    ) {
      throw new BadRequestException(
        "Only RESIGNATION or TERMINATION requests can be finalized here."
      );
    }

    if (
      request.status !== RequestStatus.PENDING_ADMIN ||
      request.currentStep !== ApprovalStep.ADMIN_FINAL_APPROVAL
    ) {
      throw new BadRequestException(
        "Offboarding request is not waiting for Admin finalization."
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
    const finalizationInput = this.normalizeOffboardingFinalization(dto);

    if (request.targetUserId !== payload.target.pickerId) {
      throw new BadRequestException(
        "Request target Picker does not match the stored offboarding payload."
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
    const employmentStatus =
      request.type === RequestType.RESIGNATION
        ? EmploymentStatus.RESIGNED
        : EmploymentStatus.TERMINATED;
    const resignationDate =
      request.type === RequestType.RESIGNATION
        ? new Date(payload.offboarding.resignationDate ?? completedAt.toISOString())
        : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const picker = await tx.user.update({
        where: { id: targetPicker.id },
        data: {
          accountStatus: AccountStatus.ARCHIVED,
          employmentStatus,
          resignationDate,
          blockStatus: finalizationInput.blockStatus,
          blockedUntil: finalizationInput.blockedUntil,
          blockReason: finalizationInput.blockReason,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null
        }
      });

      const closedAssignment = await tx.pickerBranchAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: completedAt
        },
        include: {
          picker: true,
          vendor: { include: { chain: true } }
        }
      });

      await tx.requestApproval.update({
        where: { id: adminApproval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          approverId: context.actor.id,
          notes: finalizationInput.notes ?? "Offboarding finalized."
        }
      });

      const completedPayload: OffboardingPayload = {
        ...payload,
        finalization: {
          completedAt: completedAt.toISOString(),
          assignmentId: closedAssignment.id,
          blockStatus: finalizationInput.blockStatus,
          blockedUntil: finalizationInput.blockedUntil?.toISOString() ?? null,
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
          title: `${this.formatRequestType(request.type)} completed`,
          body: `${this.formatRequestType(request.type)} for ${picker.nameEn} was finalized. The Picker account is archived and the active Branch assignment is closed.`,
          payload: {
            requestId: request.id,
            pickerId: picker.id,
            assignmentId: closedAssignment.id,
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

  async approveTransferApproval(
    approvalId: string,
    notes: string | undefined,
    context: RequestContext,
    options: { suppressIntermediateCreatorNotification?: boolean } = {}
  ) {
    const approval = await this.prisma.requestApproval.findUnique({
      where: { id: approvalId },
      include: {
        request: {
          include: requestInclude
        }
      }
    });

    if (!approval) {
      throw new NotFoundException("Approval was not found.");
    }

    if (approval.request.type !== RequestType.TRANSFER) {
      throw new BadRequestException("Only Transfer approvals can be applied here.");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException("Only PENDING approvals can be decided.");
    }

    const expectedStatus = this.statusForStep(approval.step);
    if (
      approval.request.status !== expectedStatus ||
      approval.request.currentStep !== approval.step
    ) {
      throw new BadRequestException(
        "Approval is not the current pending step for this request."
      );
    }

    const canAct = await this.userCanActOnStep(
      approval.request,
      approval.step,
      approval.approverId,
      context.actor
    );

    if (!canAct) {
      throw new ForbiddenException("You do not own this approval step.");
    }

    const pendingApprovals = this.sortApprovals(
      approval.request.approvals.filter(
        (item) => item.status === ApprovalStatus.PENDING && item.id !== approval.id
      )
    );
    const nextApproval = pendingApprovals[0] ?? null;

    if (nextApproval) {
      const nextStatus = this.statusForStep(nextApproval.step);
      assertRequestTransition(approval.request.status, nextStatus);

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.requestApproval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.APPROVED,
            decisionAt: new Date(),
            notes,
            approverId: approval.approverId ?? context.actor.id
          }
        });

        const updatedRequest = await tx.request.update({
          where: { id: approval.requestId },
          data: {
            status: nextStatus,
            currentStep: nextApproval.step
          },
          include: requestInclude
        });

        if (nextApproval.approverId) {
          await tx.notification.create({
            data: {
              userId: nextApproval.approverId,
              type: "APPROVAL_PENDING",
              title: "Destination Transfer approval pending",
              body: "A cross-chain Transfer request requires your destination Chain approval.",
              payload: {
                requestId: approval.requestId,
                approvalId: nextApproval.id,
                step: nextApproval.step
              }
            }
          });
        }

        return updatedRequest;
      });

      await this.auditService.log({
        actorUserId: context.actor.id,
        action: "APPROVAL_APPROVED",
        entityType: "RequestApproval",
        entityId: approval.id,
        oldValue: {
          id: approval.id,
          requestId: approval.requestId,
          step: approval.step,
          status: approval.status
        },
        newValue: {
          id: approval.id,
          requestId: approval.requestId,
          step: approval.step,
          status: ApprovalStatus.APPROVED,
          notes: notes ?? null
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      if (!options.suppressIntermediateCreatorNotification) {
        await this.notificationsService.create({
          userId: approval.request.createdById,
          type: "APPROVAL_APPROVED",
          title: "Source Transfer approval completed",
          body: "The source Chain Area Manager approved the Transfer request. Destination approval is now pending.",
          payload: { requestId: approval.requestId, approvalId: approval.id }
        });
      }

      return toRequestSummary(updated);
    }

    return this.applyTransferAfterFinalApproval(approval, notes, context);
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

  private async applyTransferAfterFinalApproval(
    approval: TransferApprovalWithRequest,
    notes: string | undefined,
    context: RequestContext
  ) {
    const payload = this.parseTransferPayload(approval.request.payload);

    if (approval.request.targetUserId !== payload.target.pickerId) {
      throw new BadRequestException(
        "Request target Picker does not match the stored Transfer payload."
      );
    }

    if (
      approval.request.sourceVendorId !== payload.source.vendorId ||
      approval.request.sourceChainId !== payload.source.chainId ||
      approval.request.destinationVendorId !== payload.destination.vendorId ||
      approval.request.destinationChainId !== payload.destination.chainId
    ) {
      throw new BadRequestException(
        "Transfer request context does not match the stored payload."
      );
    }

    const [targetPicker, sourceVendor, destinationVendor, activeAssignment] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: payload.target.pickerId } }),
        this.prisma.vendor.findUnique({
          where: { id: payload.source.vendorId },
          include: { chain: true }
        }),
        this.prisma.vendor.findUnique({
          where: { id: payload.destination.vendorId },
          include: { chain: true }
        }),
        this.prisma.pickerBranchAssignment.findFirst({
          where: {
            id: payload.source.pickerAssignmentId,
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

    if (!destinationVendor) {
      throw new NotFoundException("Destination Branch was not found.");
    }

    if (sourceVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is no longer active.");
    }

    if (destinationVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Destination Branch is no longer active.");
    }

    if (
      sourceVendor.chainId !== payload.source.chainId ||
      destinationVendor.chainId !== payload.destination.chainId
    ) {
      throw new BadRequestException(
        "Source or destination Branch no longer matches the stored Chain context."
      );
    }

    if (!activeAssignment) {
      throw new BadRequestException(
        "Target Picker no longer has an active assignment to the source Branch."
      );
    }

    const completedAt = new Date();
    assertRequestTransition(approval.request.status, RequestStatus.COMPLETED);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          notes,
          approverId: approval.approverId ?? context.actor.id
        }
      });

      const closedAssignment = await tx.pickerBranchAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: completedAt
        },
        include: {
          picker: true,
          vendor: { include: { chain: true } }
        }
      });

      const newAssignment = await tx.pickerBranchAssignment.create({
        data: {
          pickerId: payload.target.pickerId,
          vendorId: payload.destination.vendorId,
          status: AssignmentStatus.ACTIVE,
          startDate: completedAt,
          createdByRequestId: approval.requestId
        },
        include: {
          picker: true,
          vendor: { include: { chain: true } }
        }
      });

      const completedPayload: TransferPayload = {
        ...payload,
        finalization: {
          completedAt: completedAt.toISOString(),
          oldAssignmentId: closedAssignment.id,
          newAssignmentId: newAssignment.id,
          appliedByApprovalId: approval.id
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: approval.requestId },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      const [sourceChampAssignment, destinationChampAssignment] = await Promise.all([
        tx.vendorChampAssignment.findFirst({
          where: {
            vendorId: sourceVendor.id,
            status: AssignmentStatus.ACTIVE
          },
          select: { champId: true }
        }),
        tx.vendorChampAssignment.findFirst({
          where: {
            vendorId: destinationVendor.id,
            status: AssignmentStatus.ACTIVE
          },
          select: { champId: true }
        })
      ]);

      const notifications = new Map<
        string,
        {
          type: string;
          title: string;
          body: string;
          payload: Prisma.InputJsonValue;
        }
      >();
      const addNotification = (
        userId: string | null | undefined,
        notification: {
          type: string;
          title: string;
          body: string;
          payload: Prisma.InputJsonValue;
        }
      ) => {
        if (userId && !notifications.has(userId)) {
          notifications.set(userId, notification);
        }
      };

      addNotification(approval.request.createdById, {
        type: "TRANSFER_COMPLETED",
        title: "Transfer completed",
        body: `${targetPicker.nameEn} was transferred from ${sourceVendor.vendorName} to ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          pickerId: targetPicker.id,
          oldAssignmentId: closedAssignment.id,
          newAssignmentId: newAssignment.id
        }
      });
      addNotification(targetPicker.id, {
        type: "TRANSFER_COMPLETED",
        title: "Branch transfer completed",
        body: `Your active Branch is now ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          vendorId: destinationVendor.id,
          chainId: destinationVendor.chainId
        }
      });
      addNotification(sourceChampAssignment?.champId, {
        type: "TRANSFER_COMPLETED",
        title: "Picker transferred out",
        body: `${targetPicker.nameEn} was transferred from ${sourceVendor.vendorName} to ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          pickerId: targetPicker.id,
          vendorId: sourceVendor.id,
          oldAssignmentId: closedAssignment.id
        }
      });
      addNotification(destinationChampAssignment?.champId, {
        type: "TRANSFER_COMPLETED",
        title: "Picker transferred in",
        body: `${targetPicker.nameEn} was transferred to ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          pickerId: targetPicker.id,
          vendorId: destinationVendor.id,
          newAssignmentId: newAssignment.id
        }
      });

      for (const [userId, notification] of notifications) {
        await tx.notification.create({
          data: {
            userId,
            ...notification
          }
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
              notes: notes ?? null
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "TRANSFER_APPLIED",
            entityType: "Request",
            entityId: approval.requestId,
            oldValue: {
              status: approval.request.status,
              currentStep: approval.request.currentStep,
              sourceVendorId: payload.source.vendorId,
              destinationVendorId: payload.destination.vendorId
            },
            newValue: {
              status: RequestStatus.COMPLETED,
              oldAssignmentId: closedAssignment.id,
              newAssignmentId: newAssignment.id
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
              pickerId: closedAssignment.pickerId,
              vendorId: closedAssignment.vendorId,
              status: AssignmentStatus.ACTIVE
            },
            newValue: {
              pickerId: closedAssignment.pickerId,
              vendorId: closedAssignment.vendorId,
              status: AssignmentStatus.CLOSED,
              endDate: completedAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "PICKER_BRANCH_ASSIGNMENT_CREATED",
            entityType: "PickerBranchAssignment",
            entityId: newAssignment.id,
            newValue: {
              pickerId: newAssignment.pickerId,
              vendorId: newAssignment.vendorId,
              createdByRequestId: approval.requestId
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
            newValue: {
              status: RequestStatus.COMPLETED,
              completedAt: completedAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, closedAssignment, newAssignment };
    });

    return toRequestSummary(result.completedRequest);
  }

  private normalizeTransferRequest(
    dto: CreateTransferRequestDto
  ): Omit<TransferPayload["transfer"], "approvalPath"> {
    const reason = dto.reason?.trim();
    const notes = dto.notes?.trim();

    if (!reason) {
      throw new BadRequestException("Transfer reason is required.");
    }

    return {
      reason,
      ...(notes ? { notes } : {}),
      ...(dto.requestedTransferDate
        ? { requestedTransferDate: dto.requestedTransferDate }
        : {})
    };
  }

  private normalizeOffboardingRequest(
    dto: CreateOffboardingRequestDto
  ): OffboardingPayload["offboarding"] {
    if (
      dto.type !== RequestType.RESIGNATION &&
      dto.type !== RequestType.TERMINATION
    ) {
      throw new BadRequestException(
        "Offboarding type must be RESIGNATION or TERMINATION."
      );
    }

    const reason = dto.reason?.trim();
    const notes = dto.notes?.trim();

    if (!reason) {
      throw new BadRequestException("Offboarding reason is required.");
    }

    if (dto.type === RequestType.RESIGNATION && !dto.resignationDate) {
      throw new BadRequestException("Resignation date is required.");
    }

    if (dto.type === RequestType.TERMINATION && !dto.terminationDate) {
      throw new BadRequestException("Termination date is required.");
    }

    return {
      type: dto.type,
      reason,
      ...(notes ? { notes } : {}),
      ...(dto.resignationDate ? { resignationDate: dto.resignationDate } : {}),
      ...(dto.terminationDate ? { terminationDate: dto.terminationDate } : {})
    };
  }

  private normalizeOffboardingFinalization(dto: FinalizeOffboardingDto) {
    if (!dto.confirmInternalDeactivation) {
      throw new BadRequestException(
        "Internal deactivation confirmation is required."
      );
    }

    const blockReason = dto.blockReason?.trim() || null;
    const notes = dto.notes?.trim();
    const blockedUntil = dto.blockedUntil ? new Date(dto.blockedUntil) : null;

    if (dto.blockStatus === BlockStatus.TEMPORARY_BLOCK && !blockedUntil) {
      throw new BadRequestException(
        "blockedUntil is required for a temporary block."
      );
    }

    if (
      (dto.blockStatus === BlockStatus.TEMPORARY_BLOCK ||
        dto.blockStatus === BlockStatus.PERMANENT_BLOCK) &&
      !blockReason
    ) {
      throw new BadRequestException(
        "blockReason is required for temporary or permanent blocks."
      );
    }

    return {
      blockStatus: dto.blockStatus,
      blockedUntil:
        dto.blockStatus === BlockStatus.TEMPORARY_BLOCK ? blockedUntil : null,
      blockReason:
        dto.blockStatus === BlockStatus.NO_BLOCK ? null : blockReason,
      ...(notes ? { notes } : {})
    };
  }

  private normalizeNewHireCandidate(dto: CreateNewHireRequestDto) {
    const nameEn = dto.nameEn?.trim();
    const nameAr = dto.nameAr?.trim();
    const phoneNumber = dto.phoneNumber.trim();
    const nationalId = dto.nationalId?.trim();
    const address = dto.address?.trim();
    const notes = dto.notes?.trim();

    if (!nameEn && !nameAr) {
      throw new BadRequestException("Candidate English or Arabic name is required.");
    }

    if (!phoneNumber) {
      throw new BadRequestException("Candidate phone number is required.");
    }

    return {
      ...(nameEn ? { nameEn } : {}),
      ...(nameAr ? { nameAr } : {}),
      phoneNumber,
      ...(nationalId ? { nationalId } : {}),
      ...(address ? { address } : {}),
      ...(dto.dateOfBirth ? { dateOfBirth: dto.dateOfBirth } : {}),
      gender: dto.gender ?? Gender.UNSPECIFIED,
      ...(notes ? { notes } : {})
    };
  }

  private parseNewHirePayload(payload: Prisma.JsonValue): NewHirePayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("New Hire request payload is invalid.");
    }

    const objectPayload = payload as Record<string, unknown>;
    const candidate = objectPayload.candidate;
    const source = objectPayload.source;

    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      !source ||
      typeof source !== "object" ||
      Array.isArray(source)
    ) {
      throw new BadRequestException("New Hire request payload is incomplete.");
    }

    const candidatePayload = candidate as Record<string, unknown>;
    const sourcePayload = source as Record<string, unknown>;
    const phoneNumber = candidatePayload.phoneNumber;
    const vendorId = sourcePayload.vendorId;
    const chainId = sourcePayload.chainId;

    if (
      typeof phoneNumber !== "string" ||
      typeof vendorId !== "string" ||
      typeof chainId !== "string"
    ) {
      throw new BadRequestException("New Hire request payload is missing context.");
    }

    return {
      candidate: {
        nameEn:
          typeof candidatePayload.nameEn === "string"
            ? candidatePayload.nameEn
            : undefined,
        nameAr:
          typeof candidatePayload.nameAr === "string"
            ? candidatePayload.nameAr
            : undefined,
        phoneNumber,
        nationalId:
          typeof candidatePayload.nationalId === "string"
            ? candidatePayload.nationalId
            : undefined,
        address:
          typeof candidatePayload.address === "string"
            ? candidatePayload.address
            : undefined,
        dateOfBirth:
          typeof candidatePayload.dateOfBirth === "string"
            ? candidatePayload.dateOfBirth
            : undefined,
        gender:
          typeof candidatePayload.gender === "string" &&
          Object.values(Gender).includes(candidatePayload.gender as Gender)
            ? (candidatePayload.gender as Gender)
            : Gender.UNSPECIFIED,
        notes:
          typeof candidatePayload.notes === "string"
            ? candidatePayload.notes
            : undefined
      },
      source: {
        vendorId,
        chainId
      }
    };
  }

  private parseTransferPayload(payload: Prisma.JsonValue): TransferPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Transfer request payload is invalid.");
    }

    const objectPayload = payload as Record<string, unknown>;
    const transfer = objectPayload.transfer;
    const source = objectPayload.source;
    const destination = objectPayload.destination;
    const target = objectPayload.target;

    if (
      !transfer ||
      typeof transfer !== "object" ||
      Array.isArray(transfer) ||
      !source ||
      typeof source !== "object" ||
      Array.isArray(source) ||
      !destination ||
      typeof destination !== "object" ||
      Array.isArray(destination) ||
      !target ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) {
      throw new BadRequestException("Transfer request payload is incomplete.");
    }

    const transferPayload = transfer as Record<string, unknown>;
    const sourcePayload = source as Record<string, unknown>;
    const destinationPayload = destination as Record<string, unknown>;
    const targetPayload = target as Record<string, unknown>;
    const reason = transferPayload.reason;
    const approvalPath = transferPayload.approvalPath;
    const sourceVendorId = sourcePayload.vendorId;
    const sourceChainId = sourcePayload.chainId;
    const pickerAssignmentId = sourcePayload.pickerAssignmentId;
    const destinationVendorId = destinationPayload.vendorId;
    const destinationChainId = destinationPayload.chainId;
    const pickerId = targetPayload.pickerId;

    if (
      typeof reason !== "string" ||
      (approvalPath !== "SAME_CHAIN" && approvalPath !== "CROSS_CHAIN") ||
      typeof sourceVendorId !== "string" ||
      typeof sourceChainId !== "string" ||
      typeof pickerAssignmentId !== "string" ||
      typeof destinationVendorId !== "string" ||
      typeof destinationChainId !== "string" ||
      typeof pickerId !== "string"
    ) {
      throw new BadRequestException(
        "Transfer request payload is missing required context."
      );
    }

    return {
      transfer: {
        reason,
        approvalPath,
        notes:
          typeof transferPayload.notes === "string"
            ? transferPayload.notes
            : undefined,
        requestedTransferDate:
          typeof transferPayload.requestedTransferDate === "string"
            ? transferPayload.requestedTransferDate
            : undefined
      },
      source: {
        vendorId: sourceVendorId,
        chainId: sourceChainId,
        pickerAssignmentId
      },
      destination: {
        vendorId: destinationVendorId,
        chainId: destinationChainId
      },
      target: {
        pickerId
      },
      finalization:
        objectPayload.finalization &&
        typeof objectPayload.finalization === "object" &&
        !Array.isArray(objectPayload.finalization)
          ? (objectPayload.finalization as TransferPayload["finalization"])
          : undefined
    };
  }

  private parseOffboardingPayload(payload: Prisma.JsonValue): OffboardingPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Offboarding request payload is invalid.");
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
      throw new BadRequestException("Offboarding request payload is incomplete.");
    }

    const offboardingPayload = offboarding as Record<string, unknown>;
    const sourcePayload = source as Record<string, unknown>;
    const targetPayload = target as Record<string, unknown>;
    const type = offboardingPayload.type;
    const reason = offboardingPayload.reason;
    const vendorId = sourcePayload.vendorId;
    const chainId = sourcePayload.chainId;
    const pickerId = targetPayload.pickerId;
    const pickerAssignmentId = targetPayload.pickerAssignmentId;

    if (
      (type !== RequestType.RESIGNATION && type !== RequestType.TERMINATION) ||
      typeof reason !== "string" ||
      typeof vendorId !== "string" ||
      typeof chainId !== "string" ||
      typeof pickerId !== "string" ||
      typeof pickerAssignmentId !== "string"
    ) {
      throw new BadRequestException(
        "Offboarding request payload is missing required context."
      );
    }

    return {
      offboarding: {
        type,
        reason,
        notes:
          typeof offboardingPayload.notes === "string"
            ? offboardingPayload.notes
            : undefined,
        resignationDate:
          typeof offboardingPayload.resignationDate === "string"
            ? offboardingPayload.resignationDate
            : undefined,
        terminationDate:
          typeof offboardingPayload.terminationDate === "string"
            ? offboardingPayload.terminationDate
            : undefined
      },
      source: {
        vendorId,
        chainId
      },
      target: {
        pickerId,
        pickerAssignmentId
      },
      finalization:
        objectPayload.finalization &&
        typeof objectPayload.finalization === "object" &&
        !Array.isArray(objectPayload.finalization)
          ? (objectPayload.finalization as OffboardingPayload["finalization"])
          : undefined
    };
  }

  private assertPayloadSafe(payload?: Record<string, unknown>) {
    if (!payload) {
      return;
    }

    const sensitiveKey = findSensitiveJsonKey(payload);
    if (sensitiveKey) {
      throw new BadRequestException(
        `Request payload must not contain passwords, secrets, tokens, credentials, or session material. Remove field "${sensitiveKey}".`
      );
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

  private sortApprovals<T extends { step: ApprovalStep; createdAt: Date }>(
    approvals: T[]
  ) {
    const priority: Record<ApprovalStep, number> = {
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
