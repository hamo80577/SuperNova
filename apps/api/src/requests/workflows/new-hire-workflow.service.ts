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
  ChainStatus,
  EmploymentStatus,
  Gender,
  Prisma,
  ProfileStatus,
  RequestStatus,
  RequestType,
  User,
  UserRole,
  VendorStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { toUserSummary } from "../../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { TemporaryPasswordService } from "../../users/temporary-password.service";
import type { CreateNewHireRequestDto } from "../dto/create-new-hire-request.dto";
import type { FinalizeNewHireDto } from "../dto/finalize-new-hire.dto";
import type { LookupNewHireCandidateDto } from "../dto/lookup-new-hire-candidate.dto";
import { RequestApprovalRoutingService } from "../request-approval-routing.service";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import { toRequestSummary } from "../request-response.utils";

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

type NewHirePayload = {
  mode: "NEW_PICKER" | "REHIRE";
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
  rehire?: {
    userId: string;
    matchedBy: Array<"phoneNumber" | "nationalId">;
    previousAccountStatus: AccountStatus;
    previousEmploymentStatus: EmploymentStatus;
    previousBlockStatus: BlockStatus;
    previousBlockedUntil?: string | null;
  };
  finalization?: {
    pickerId: string;
    assignmentId: string;
    shopperId: string;
    completedAt: string;
  };
};

type RequestWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type NormalizedNewHireCandidate = NewHirePayload["candidate"];
type NewHireCandidateDecision =
  | "ACTIVE_DUPLICATE"
  | "BLOCKED"
  | "REHIRE_AVAILABLE";
type NewHireCandidateMatch = {
  user: User;
  matchedBy: Array<"phoneNumber" | "nationalId">;
  decision: NewHireCandidateDecision;
  reason?: string;
  blockedUntil?: string | null;
};

@Injectable()
export class NewHireWorkflowService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService,
    @Inject(TemporaryPasswordService)
    private readonly temporaryPasswordService: TemporaryPasswordService
  ) {}

  async lookupNewHireCandidate(dto: LookupNewHireCandidateDto) {
    const phoneNumber = dto.phoneNumber?.trim();
    const nationalId = dto.nationalId?.trim();

    if (!phoneNumber && !nationalId) {
      throw new BadRequestException("Phone number or National ID is required.");
    }

    const matches = await this.findNewHireCandidateMatches({
      phoneNumber,
      nationalId
    });

    return {
      status: matches.some((match) => match.decision === "BLOCKED")
        ? "BLOCKED"
        : matches.some((match) => match.decision === "ACTIVE_DUPLICATE")
          ? "ACTIVE_DUPLICATE"
          : matches.length
            ? "REHIRE_AVAILABLE"
            : "CLEAR",
      candidates: matches.map((match) => ({
        decision: match.decision,
        matchedBy: match.matchedBy,
        reason: match.reason,
        blockedUntil: match.blockedUntil,
        user: toUserSummary(match.user),
        blockStatus: match.user.blockStatus,
        accountStatus: match.user.accountStatus,
        employmentStatus: match.user.employmentStatus,
        shopperId: match.user.shopperId,
        ibsId: match.user.ibsId,
        address: match.user.address,
        nationalId: match.user.nationalId,
        dateOfBirth: match.user.dateOfBirth,
        gender: match.user.gender
      }))
    };
  }

  async createNewHire(dto: CreateNewHireRequestDto, context: RequestContext) {
    if (context.actor.role !== UserRole.CHAMP && !this.isAdmin(context.actor)) {
      throw new ForbiddenException(
        "Only Champs and Admins can submit New Hire requests."
      );
    }

    const candidate = this.normalizeNewHireCandidate(dto);
    const rehireValidation = await this.validateNewHireCandidateForCreate(
      candidate,
      dto.rehireUserId
    );

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

    const areaManagerStep =
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
        ApprovalStep.AREA_MANAGER_APPROVAL,
        sourceVendor.chainId
      );

    const payload: NewHirePayload = {
      mode: rehireValidation.rehireUser ? "REHIRE" : "NEW_PICKER",
      candidate,
      source: {
        vendorId: sourceVendor.id,
        chainId: sourceVendor.chainId
      },
      ...(rehireValidation.rehireUser
        ? {
            rehire: {
              userId: rehireValidation.rehireUser.id,
              matchedBy: rehireValidation.matchedBy,
              previousAccountStatus: rehireValidation.rehireUser.accountStatus,
              previousEmploymentStatus:
                rehireValidation.rehireUser.employmentStatus,
              previousBlockStatus: rehireValidation.rehireUser.blockStatus,
              previousBlockedUntil:
                rehireValidation.rehireUser.blockedUntil?.toISOString() ?? null
            }
          }
        : {})
    };

    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.NEW_HIRE,
          status: RequestStatus.PENDING_AREA_MANAGER,
          currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: rehireValidation.rehireUser?.id,
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
          title: "New Hire request submitted",
          body: `${payload.mode === "REHIRE" ? "Rehire" : "New Hire"} request for ${candidate.phoneNumber} was submitted for Area Manager approval.`,
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
    const isRehire = payload.mode === "REHIRE";

    if (!shopperId && !isRehire) {
      throw new BadRequestException("Shopper ID is required.");
    }

    const [existingShopper, existingPhone, rehireUser, sourceVendor] =
      await Promise.all([
        shopperId
          ? this.prisma.user.findUnique({ where: { shopperId } })
          : Promise.resolve(null),
        this.prisma.user.findUnique({
          where: { phoneNumber: payload.candidate.phoneNumber }
        }),
        payload.rehire?.userId
          ? this.prisma.user.findUnique({ where: { id: payload.rehire.userId } })
          : Promise.resolve(null),
        this.prisma.vendor.findUnique({
          where: { id: payload.source.vendorId },
          include: { chain: true }
        })
      ]);

    const finalShopperId = shopperId || rehireUser?.shopperId;

    if (!finalShopperId) {
      throw new BadRequestException("Shopper ID is required.");
    }

    if (existingShopper && existingShopper.id !== rehireUser?.id) {
      throw new ConflictException("Shopper ID is already assigned to another user.");
    }

    if (existingPhone && existingPhone.id !== rehireUser?.id) {
      throw new ConflictException("Candidate phone number already belongs to a user.");
    }

    if (isRehire && !rehireUser) {
      throw new BadRequestException("Stored Rehire Picker was not found.");
    }

    if (isRehire && rehireUser) {
      const rehireValidation = this.evaluateNewHireMatch(rehireUser, {
        phoneNumber: payload.candidate.phoneNumber,
        nationalId: payload.candidate.nationalId
      });

      if (rehireValidation.decision !== "REHIRE_AVAILABLE") {
        throw new BadRequestException(
          rehireValidation.reason ?? "Stored Rehire Picker is not eligible."
        );
      }
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
      const profileFields = {
        nameEn:
          payload.candidate.nameEn ??
          payload.candidate.nameAr ??
          rehireUser?.nameEn ??
          "New Picker",
        nameAr: payload.candidate.nameAr ?? rehireUser?.nameAr ?? null,
        phoneNumber: payload.candidate.phoneNumber,
        nationalId: payload.candidate.nationalId ?? rehireUser?.nationalId ?? null,
        address: payload.candidate.address ?? rehireUser?.address ?? null,
        dateOfBirth: payload.candidate.dateOfBirth
          ? new Date(payload.candidate.dateOfBirth)
          : rehireUser?.dateOfBirth ?? null,
        gender: payload.candidate.gender,
        shopperId: finalShopperId,
        joiningDate: new Date(),
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE,
        passwordHash,
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
        temporaryPasswordCiphertext:
          this.temporaryPasswordService.encrypt(temporaryPassword),
        temporaryPasswordCreatedAt
      };

      const picker =
        isRehire && rehireUser
          ? await tx.user.update({
              where: { id: rehireUser.id },
              data: {
                ...profileFields,
                blockStatus: BlockStatus.NO_BLOCK,
                blockedUntil: null,
                blockReason: null
              }
            })
          : await tx.user.create({
              data: {
                role: UserRole.PICKER,
                ...profileFields,
                profileStatus: ProfileStatus.INCOMPLETE
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
          shopperId: finalShopperId,
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
            newValue: {
              status: RequestStatus.COMPLETED,
              shopperId: finalShopperId,
              mode: payload.mode
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: isRehire ? "USER_REACTIVATED" : "USER_CREATED",
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

  private async findRequestOrThrow(id: string): Promise<RequestWithRelations> {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: requestInclude
    });

    if (!request) {
      throw new NotFoundException("Request was not found.");
    }

    return request;
  }

  private async validateNewHireCandidateForCreate(
    candidate: NormalizedNewHireCandidate,
    rehireUserId?: string
  ) {
    const matches = await this.findNewHireCandidateMatches(candidate);
    const selectedMatch = rehireUserId
      ? matches.find((match) => match.user.id === rehireUserId)
      : null;

    if (rehireUserId && !selectedMatch) {
      throw new BadRequestException(
        "Selected previous Picker does not match this phone number or National ID."
      );
    }

    const blockingMatch = selectedMatch
      ? selectedMatch.decision !== "REHIRE_AVAILABLE"
        ? selectedMatch
        : null
      : matches.find(
          (match) =>
            match.decision === "ACTIVE_DUPLICATE" || match.decision === "BLOCKED"
        );

    if (blockingMatch) {
      throw new ConflictException(blockingMatch.reason ?? "Picker cannot be hired.");
    }

    const rehireMatch =
      selectedMatch ??
      matches.find((match) => match.decision === "REHIRE_AVAILABLE") ??
      null;

    if (rehireMatch && !rehireUserId) {
      throw new ConflictException(
        "Previous Picker record found. Select the previous Picker to submit this as a Rehire request."
      );
    }

    await this.assertNoDuplicatePendingNewHire(candidate, rehireMatch?.user.id);

    return {
      rehireUser: rehireMatch?.user ?? null,
      matchedBy: rehireMatch?.matchedBy ?? []
    };
  }

  private async findNewHireCandidateMatches(candidate: {
    phoneNumber?: string;
    nationalId?: string;
  }): Promise<NewHireCandidateMatch[]> {
    const phoneNumber = candidate.phoneNumber?.trim();
    const nationalId = candidate.nationalId?.trim();
    const or: Prisma.UserWhereInput[] = [];

    if (phoneNumber) {
      or.push({ phoneNumber });
    }

    if (nationalId) {
      or.push({ nationalId });
    }

    if (!or.length) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.PICKER,
        OR: or
      },
      orderBy: [{ accountStatus: "asc" }, { updatedAt: "desc" }]
    });

    return users.map((user) => this.evaluateNewHireMatch(user, candidate));
  }

  private evaluateNewHireMatch(
    user: User,
    candidate: { phoneNumber?: string; nationalId?: string }
  ): NewHireCandidateMatch {
    const matchedBy: Array<"phoneNumber" | "nationalId"> = [];
    if (candidate.phoneNumber && user.phoneNumber === candidate.phoneNumber) {
      matchedBy.push("phoneNumber");
    }
    if (candidate.nationalId && user.nationalId === candidate.nationalId) {
      matchedBy.push("nationalId");
    }

    if (
      user.accountStatus === AccountStatus.ACTIVE &&
      user.employmentStatus === EmploymentStatus.ACTIVE
    ) {
      return {
        user,
        matchedBy,
        decision: "ACTIVE_DUPLICATE",
        reason: "This Picker already exists and is currently active."
      };
    }

    if (user.blockStatus === BlockStatus.PERMANENT_BLOCK) {
      return {
        user,
        matchedBy,
        decision: "BLOCKED",
        reason: "This Picker has a permanent block and cannot be rehired."
      };
    }

    if (
      user.blockStatus === BlockStatus.TEMPORARY_BLOCK &&
      user.blockedUntil &&
      user.blockedUntil.getTime() > Date.now()
    ) {
      return {
        user,
        matchedBy,
        decision: "BLOCKED",
        blockedUntil: user.blockedUntil.toISOString(),
        reason: `This Picker has a temporary block until ${user.blockedUntil.toISOString()}.`
      };
    }

    return {
      user,
      matchedBy,
      decision: "REHIRE_AVAILABLE",
      reason: "Previous inactive Picker can be rehired."
    };
  }

  private async assertNoDuplicatePendingNewHire(
    candidate: NormalizedNewHireCandidate,
    rehireUserId?: string
  ) {
    const statusFilter = {
      notIn: [RequestStatus.REJECTED, RequestStatus.CANCELLED, RequestStatus.COMPLETED]
    };
    const or: Prisma.RequestWhereInput[] = [];

    if (rehireUserId) {
      or.push({ targetUserId: rehireUserId });
    }

    or.push({
      payload: {
        path: ["candidate", "phoneNumber"],
        equals: candidate.phoneNumber
      }
    });

    if (candidate.nationalId) {
      or.push({
        payload: {
          path: ["candidate", "nationalId"],
          equals: candidate.nationalId
        }
      });
    }

    const duplicate = await this.prisma.request.findFirst({
      where: {
        type: RequestType.NEW_HIRE,
        status: statusFilter,
        OR: or
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException(
        "A pending New Hire or Rehire request already exists for this Picker."
      );
    }
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
    const rehire = objectPayload.rehire;
    const mode = objectPayload.mode === "REHIRE" ? "REHIRE" : "NEW_PICKER";

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
    const rehirePayload =
      rehire && typeof rehire === "object" && !Array.isArray(rehire)
        ? (rehire as Record<string, unknown>)
        : null;
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
      mode,
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
      },
      ...(mode === "REHIRE" && rehirePayload
        ? {
            rehire: {
              userId:
                typeof rehirePayload.userId === "string"
                  ? rehirePayload.userId
                  : "",
              matchedBy: Array.isArray(rehirePayload.matchedBy)
                ? rehirePayload.matchedBy.filter(
                    (value): value is "phoneNumber" | "nationalId" =>
                      value === "phoneNumber" || value === "nationalId"
                  )
                : [],
              previousAccountStatus:
                typeof rehirePayload.previousAccountStatus === "string" &&
                Object.values(AccountStatus).includes(
                  rehirePayload.previousAccountStatus as AccountStatus
                )
                  ? (rehirePayload.previousAccountStatus as AccountStatus)
                  : AccountStatus.ARCHIVED,
              previousEmploymentStatus:
                typeof rehirePayload.previousEmploymentStatus === "string" &&
                Object.values(EmploymentStatus).includes(
                  rehirePayload.previousEmploymentStatus as EmploymentStatus
                )
                  ? (rehirePayload.previousEmploymentStatus as EmploymentStatus)
                  : EmploymentStatus.RESIGNED,
              previousBlockStatus:
                typeof rehirePayload.previousBlockStatus === "string" &&
                Object.values(BlockStatus).includes(
                  rehirePayload.previousBlockStatus as BlockStatus
                )
                  ? (rehirePayload.previousBlockStatus as BlockStatus)
                  : BlockStatus.NO_BLOCK,
              previousBlockedUntil:
                typeof rehirePayload.previousBlockedUntil === "string"
                  ? rehirePayload.previousBlockedUntil
                  : null
            }
          }
        : {})
    };
  }

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }
}
