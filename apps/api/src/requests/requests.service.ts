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
import { randomBytes } from "crypto";

import { AuditService } from "../audit/audit.service";
import { toUserSummary } from "../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CancelRequestDto } from "./dto/cancel-request.dto";
import type { CreateNewHireRequestDto } from "./dto/create-new-hire-request.dto";
import type { CreateOffboardingRequestDto } from "./dto/create-offboarding-request.dto";
import type { CreateRequestDto } from "./dto/create-request.dto";
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
      note: "Generic request infrastructure is enabled. New Hire and Resignation/Termination finalization are implemented through Branch-first workflows; Transfer finalization remains a later phase."
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
    if (context.actor.role !== UserRole.CHAMP) {
      throw new ForbiddenException("Only Champs can submit New Hire requests.");
    }

    const candidate = this.normalizeNewHireCandidate(dto);

    const assignment = await this.prisma.vendorChampAssignment.findFirst({
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
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You can submit New Hire requests only for assigned active Branches."
      );
    }

    if (assignment.vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch is not active.");
    }

    if (assignment.vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch Chain is not active.");
    }

    const areaManagerStep = await this.resolveAreaManagerStep(
      ApprovalStep.AREA_MANAGER_APPROVAL,
      assignment.vendor.chainId
    );

    const payload: NewHirePayload = {
      candidate,
      source: {
        vendorId: assignment.vendorId,
        chainId: assignment.vendor.chainId
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
          sourceVendorId: assignment.vendorId,
          sourceChainId: assignment.vendor.chainId,
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
            body: `New Hire request for ${assignment.vendor.vendorName} requires your approval.`,
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
    if (context.actor.role !== UserRole.CHAMP) {
      throw new ForbiddenException(
        "Only Champs can submit Resignation or Termination requests."
      );
    }

    const offboarding = this.normalizeOffboardingRequest(dto);

    const assignment = await this.prisma.vendorChampAssignment.findFirst({
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

    if (!assignment) {
      throw new ForbiddenException(
        "You can submit offboarding requests only for assigned active Branches."
      );
    }

    if (assignment.vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch is not active.");
    }

    if (assignment.vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch Chain is not active.");
    }

    const pickerAssignment = assignment.vendor.pickerAssignments[0];
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
      assignment.vendor.chainId
    );

    const payload: OffboardingPayload = {
      offboarding,
      source: {
        vendorId: assignment.vendorId,
        chainId: assignment.vendor.chainId
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
          sourceVendorId: assignment.vendorId,
          sourceChainId: assignment.vendor.chainId,
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
            body: `${this.formatRequestType(offboarding.type)} request for ${assignment.vendor.vendorName} requires your approval.`,
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

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const temporaryPasswordExpiresAt = new Date(
      Date.now() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000
    );

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
          temporaryPasswordExpiresAt
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
        mustChangePassword: result.picker.mustChangePassword,
        temporaryPasswordExpiresAt: result.picker.temporaryPasswordExpiresAt
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

  private generateTemporaryPassword() {
    return `SN-${randomBytes(12).toString("base64url")}`;
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

  private formatRequestType(type: RequestType) {
    return type
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
