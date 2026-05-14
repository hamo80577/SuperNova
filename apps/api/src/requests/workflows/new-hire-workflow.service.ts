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
  RequestStatus,
  RequestType,
  User,
  UserRole,
  Vendor,
  VendorStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { TemporaryPasswordService } from "../../users/temporary-password.service";
import type { CreateNewHireRequestDto } from "../dto/create-new-hire-request.dto";
import type { FinalizeNewHireDto } from "../dto/finalize-new-hire.dto";
import type { LookupNewHireCandidateDto } from "../dto/lookup-new-hire-candidate.dto";
import { RequestApprovalRoutingService } from "../request-approval-routing.service";
import {
  requestInclude,
  type RequestWithRelations
} from "../request-includes";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import { toRequestSummary } from "../request-response.utils";
import {
  normalizeNewHireTargetRole,
  validateEgyptNationalId,
  validateEgyptPhoneNumber,
  type NewHireTargetRole
} from "./new-hire-workflow.policy";
import { NewHireCandidateService } from "./new-hire-candidate.service";
import { parseNewHirePayload } from "./new-hire-payload";
import {
  PASSWORD_HASH_ROUNDS,
  TEMPORARY_PASSWORD_EXPIRY_HOURS
} from "./new-hire-workflow.constants";
import type {
  AreaManagerNewHireContext,
  BranchNewHireContext,
  CandidateUser,
  FinalizedAssignment,
  NewHirePayload,
  NewHireUserProfileFields,
  NormalizedNewHireCandidate,
  RequestContext
} from "./new-hire-workflow.types";

@Injectable()
export class NewHireWorkflowService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NewHireCandidateService)
    private readonly newHireCandidateService: NewHireCandidateService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService,
    @Inject(TemporaryPasswordService)
    private readonly temporaryPasswordService: TemporaryPasswordService
  ) {}

  async lookupNewHireCandidate(
    dto: LookupNewHireCandidateDto,
    currentUser: AuthenticatedUser
  ) {
    return this.newHireCandidateService.lookupNewHireCandidate(dto, currentUser);
  }

  async createNewHire(dto: CreateNewHireRequestDto, context: RequestContext) {
    const targetRole = this.normalizeTargetRole(dto.targetRole);
    this.assertCreatorCanCreateTargetRole(context.actor, targetRole);

    const candidate = this.normalizeNewHireCandidate(dto);
    const rehireValidation =
      await this.newHireCandidateService.validateNewHireCandidateForCreate(
        candidate,
        dto.rehireUserId,
        targetRole
      );

    if (targetRole === UserRole.AREA_MANAGER) {
      const areaManagerContext = await this.resolveAreaManagerNewHireContext(dto);
      return this.createCompletedAreaManagerNewHire(
        candidate,
        areaManagerContext,
        context
      );
    }

    const branchContext = await this.resolveBranchNewHireContext(
      dto,
      context.actor,
      targetRole
    );

    return this.createBranchNewHire(
      candidate,
      branchContext,
      rehireValidation,
      context
    );
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

    const payload = parseNewHirePayload(request.payload);

    if (payload.targetRole === UserRole.AREA_MANAGER) {
      throw new BadRequestException(
        "AREA_MANAGER New Hire requests are completed at creation time."
      );
    }

    const finalizableTargetRole: Extract<UserRole, "PICKER" | "CHAMP"> =
      payload.targetRole === UserRole.PICKER ? UserRole.PICKER : UserRole.CHAMP;
    const shopperId = dto.shopperId?.trim() ?? "";
    const isPicker = finalizableTargetRole === UserRole.PICKER;
    const isRehire = payload.mode === "REHIRE";

    if (isPicker && !shopperId) {
      throw new BadRequestException("Shopper ID is required for Picker New Hire.");
    }

    const [existingShopper, existingPhone, existingNationalId, rehireUser, sourceVendor] =
      await Promise.all([
        isPicker && shopperId
          ? this.prisma.user.findUnique({ where: { shopperId } })
          : Promise.resolve(null),
        this.prisma.user.findUnique({
          where: { phoneNumber: payload.candidate.phoneNumber }
        }),
        this.prisma.user.findUnique({
          where: { nationalId: payload.candidate.nationalId }
        }),
        payload.rehire?.userId
          ? this.prisma.user.findUnique({ where: { id: payload.rehire.userId } })
          : Promise.resolve(null),
        payload.source.vendorId
          ? this.prisma.vendor.findUnique({
              where: { id: payload.source.vendorId },
              include: { chain: true }
            })
          : Promise.resolve(null)
      ]);

    if (!sourceVendor) {
      throw new NotFoundException("Source Branch was not found.");
    }

    if (sourceVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is no longer active.");
    }

    if (sourceVendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Source Branch Chain is no longer active.");
    }

    if (
      sourceVendor.chainId !== payload.source.chainId ||
      request.sourceChainId !== payload.source.chainId ||
      request.sourceVendorId !== payload.source.vendorId
    ) {
      throw new BadRequestException(
        "Source Branch and Chain no longer match the stored New Hire context."
      );
    }

    if (existingShopper && existingShopper.id !== rehireUser?.id) {
      throw new ConflictException("Shopper ID is already assigned to another user.");
    }

    if (existingPhone && existingPhone.id !== rehireUser?.id) {
      throw new ConflictException("Candidate phone number already belongs to a user.");
    }

    if (existingNationalId && existingNationalId.id !== rehireUser?.id) {
      throw new ConflictException("Candidate National ID already belongs to a user.");
    }

    if (isRehire && !rehireUser) {
      throw new BadRequestException("Stored Rehire Picker was not found.");
    }

    if (isRehire && rehireUser) {
      const rehireCandidate =
        await this.newHireCandidateService.findCandidateUserById(rehireUser.id);

      if (!rehireCandidate) {
        throw new BadRequestException("Stored Rehire Picker was not found.");
      }

      const rehireValidation = this.newHireCandidateService.evaluateNewHireMatch(
        rehireCandidate,
        {
          phoneNumber: payload.candidate.phoneNumber,
          nationalId: payload.candidate.nationalId
        },
        payload.targetRole
      );

      if (rehireValidation.decision !== "REHIRE_AVAILABLE") {
        throw new BadRequestException(
          rehireValidation.reason ?? "Stored Rehire Picker is not eligible."
        );
      }
    }

    const temporaryPasswordBundle = await this.createTemporaryPasswordBundle();
    const completedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const user = isRehire && rehireUser
        ? await tx.user.update({
            where: { id: rehireUser.id },
            data: {
              ...this.toUserProfileFields(
                payload.targetRole,
                payload.candidate,
                temporaryPasswordBundle,
                shopperId,
                rehireUser
              ),
              blockStatus: BlockStatus.NO_BLOCK,
              blockedUntil: null,
              blockReason: null
            }
          })
        : await tx.user.create({
            data: {
              role: payload.targetRole,
              ...this.toUserProfileFields(
                payload.targetRole,
                payload.candidate,
                temporaryPasswordBundle,
                shopperId
              ),
              profileStatus:
                payload.targetRole === UserRole.PICKER
                  ? ProfileStatus.INCOMPLETE
                  : ProfileStatus.COMPLETE
            }
          });

      const assignment =
        payload.targetRole === UserRole.PICKER
          ? await tx.pickerBranchAssignment.create({
              data: {
                pickerId: user.id,
                vendorId: sourceVendor.id,
                status: AssignmentStatus.ACTIVE,
                createdByRequestId: request.id
              }
            })
          : await tx.vendorChampAssignment.create({
              data: {
                champId: user.id,
                vendorId: sourceVendor.id,
                status: AssignmentStatus.ACTIVE
              }
            });

      await tx.requestApproval.update({
        where: { id: adminApproval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          approverId: context.actor.id,
          notes: `${this.formatTargetRole(payload.targetRole)} New Hire finalized.`
        }
      });

      const completedPayload: NewHirePayload = {
        ...payload,
        finalization: {
          userId: user.id,
          assignmentId: assignment.id,
          assignmentType:
            payload.targetRole === UserRole.PICKER
              ? "PickerBranchAssignment"
              : "VendorChampAssignment",
          ...(payload.targetRole === UserRole.PICKER ? { shopperId } : {}),
          completedAt: completedAt.toISOString()
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          targetUserId: user.id,
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: request.createdById,
          type: "NEW_HIRE_COMPLETED",
          title: "New Hire completed",
          body: `${this.formatTargetRole(payload.targetRole)} New Hire for ${user.phoneNumber} was completed. Open the user profile for credential handoff.`,
          payload: {
            requestId: request.id,
            userId: user.id,
            targetRole: payload.targetRole
          }
        }
      });

      await this.notifyBranchCredentialHandoff(tx, {
        requestId: request.id,
        user,
        sourceVendor,
        targetRole: finalizableTargetRole
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
              targetRole: payload.targetRole,
              userId: user.id,
              mode: payload.mode
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: isRehire ? "USER_REACTIVATED" : "USER_CREATED",
            entityType: "User",
            entityId: user.id,
            newValue: {
              role: user.role,
              phoneNumber: user.phoneNumber,
              shopperId: user.shopperId,
              profileStatus: user.profileStatus,
              mustChangePassword: user.mustChangePassword
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "TEMPORARY_PASSWORD_GENERATED",
            entityType: "User",
            entityId: user.id,
            newValue: {
              temporaryPasswordExpiresAt:
                temporaryPasswordBundle.temporaryPasswordExpiresAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action:
              finalizableTargetRole === UserRole.PICKER
                ? "PICKER_BRANCH_ASSIGNMENT_CREATED"
                : "VENDOR_CHAMP_ASSIGNMENT_CREATED",
            entityType:
              finalizableTargetRole === UserRole.PICKER
                ? "PickerBranchAssignment"
                : "VendorChampAssignment",
            entityId: assignment.id,
            newValue: this.toAssignmentAuditValue(
              assignment,
              finalizableTargetRole
            ),
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: request.id,
            oldValue: { status: request.status },
            newValue: { status: RequestStatus.COMPLETED, targetUserId: user.id },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, user, assignment };
    });

    return {
      request: toRequestSummary(result.completedRequest),
      user: this.toFinalizedUserResponse(result.user),
      picker: this.toFinalizedUserResponse(result.user),
      assignment: this.toFinalizedAssignmentResponse(
        result.assignment,
        finalizableTargetRole
      )
    };
  }

  private async createBranchNewHire(
    candidate: NormalizedNewHireCandidate,
    branchContext: BranchNewHireContext,
    rehireValidation: {
      rehireUser: CandidateUser | null;
      matchedBy: Array<"phoneNumber" | "nationalId">;
    },
    context: RequestContext
  ) {
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

    const createdAt = new Date();
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

  private async createCompletedAreaManagerNewHire(
    candidate: NormalizedNewHireCandidate,
    areaManagerContext: AreaManagerNewHireContext,
    context: RequestContext
  ) {
    const temporaryPasswordBundle = await this.createTemporaryPasswordBundle();
    const completedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const areaManager = await tx.user.create({
        data: {
          role: UserRole.AREA_MANAGER,
          ...this.toUserProfileFields(
            UserRole.AREA_MANAGER,
            candidate,
            temporaryPasswordBundle
          ),
          profileStatus: ProfileStatus.COMPLETE
        }
      });

      const request = await tx.request.create({
        data: {
          type: RequestType.NEW_HIRE,
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          createdById: context.actor.id,
          targetUserId: areaManager.id,
          sourceChainId: areaManagerContext.chainIds[0],
          payload: {
            targetRole: UserRole.AREA_MANAGER,
            mode: "NEW_AREA_MANAGER",
            candidate,
            source: {
              chainId: areaManagerContext.chainIds[0],
              chainIds: areaManagerContext.chainIds
            }
          } satisfies NewHirePayload as Prisma.InputJsonValue
        }
      });

      const assignments = await Promise.all(
        areaManagerContext.chainIds.map((chainId) =>
          tx.chainAreaManagerAssignment.create({
            data: {
              areaManagerId: areaManager.id,
              chainId,
              status: AssignmentStatus.ACTIVE
            }
          })
        )
      );

      const completedPayload: NewHirePayload = {
        targetRole: UserRole.AREA_MANAGER,
        mode: "NEW_AREA_MANAGER",
        candidate,
        source: {
          chainId: areaManagerContext.chainIds[0],
          chainIds: areaManagerContext.chainIds
        },
        finalization: {
          userId: areaManager.id,
          assignmentIds: assignments.map((assignment) => assignment.id),
          assignmentType: "ChainAreaManagerAssignment",
          completedAt: completedAt.toISOString()
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: request.id },
        data: { payload: completedPayload as Prisma.InputJsonValue },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "NEW_HIRE_COMPLETED",
          title: "Area Manager New Hire completed",
          body: "Area Manager account was created. Open the user profile for credential handoff.",
          payload: {
            requestId: request.id,
            userId: areaManager.id,
            targetRole: UserRole.AREA_MANAGER
          }
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
              status: request.status,
              targetRole: UserRole.AREA_MANAGER,
              targetUserId: areaManager.id,
              sourceChainId: request.sourceChainId
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              id: request.id,
              status: RequestStatus.COMPLETED,
              targetRole: UserRole.AREA_MANAGER,
              targetUserId: areaManager.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "ADMIN_FINALIZED_NEW_HIRE",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              status: RequestStatus.COMPLETED,
              targetRole: UserRole.AREA_MANAGER,
              userId: areaManager.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "USER_CREATED",
            entityType: "User",
            entityId: areaManager.id,
            newValue: {
              role: areaManager.role,
              phoneNumber: areaManager.phoneNumber,
              profileStatus: areaManager.profileStatus,
              mustChangePassword: areaManager.mustChangePassword
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "TEMPORARY_PASSWORD_GENERATED",
            entityType: "User",
            entityId: areaManager.id,
            newValue: {
              temporaryPasswordExpiresAt:
                temporaryPasswordBundle.temporaryPasswordExpiresAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          ...assignments.map((assignment) => ({
            actorUserId: context.actor.id,
            action: "CHAIN_AREA_MANAGER_ASSIGNMENT_CREATED",
            entityType: "ChainAreaManagerAssignment",
            entityId: assignment.id,
            newValue: {
              areaManagerId: assignment.areaManagerId,
              chainId: assignment.chainId
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }))
        ]
      });

      return completedRequest;
    });

    return toRequestSummary(result);
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

  private assertCreatorCanCreateTargetRole(
    actor: AuthenticatedUser,
    targetRole: NewHireTargetRole
  ) {
    if (actor.role === UserRole.CHAMP) {
      if (targetRole !== UserRole.PICKER) {
        throw new ForbiddenException("Champs can create Picker New Hire only.");
      }
      return;
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      if (targetRole === UserRole.PICKER || targetRole === UserRole.CHAMP) {
        return;
      }

      throw new ForbiddenException(
        "Area Managers can create Picker or Champ New Hire only."
      );
    }

    if (this.isAdmin(actor)) {
      return;
    }

    throw new ForbiddenException(
      "Only Champs, Area Managers, and Admins can submit New Hire requests."
    );
  }

  private async resolveBranchNewHireContext(
    dto: CreateNewHireRequestDto,
    actor: AuthenticatedUser,
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">
  ): Promise<BranchNewHireContext> {
    if (!dto.sourceVendorId) {
      throw new BadRequestException(
        `${this.formatTargetRole(targetRole)} New Hire requires sourceVendorId.`
      );
    }

    if (actor.role === UserRole.CHAMP) {
      const assignment = await this.prisma.vendorChampAssignment.findFirst({
        where: {
          champId: actor.id,
          vendorId: dto.sourceVendorId,
          status: AssignmentStatus.ACTIVE,
          vendor: {
            status: VendorStatus.ACTIVE,
            chain: { status: ChainStatus.ACTIVE }
          }
        },
        include: {
          vendor: { include: { chain: true } }
        }
      });

      if (!assignment) {
        throw new ForbiddenException(
          "You can submit New Hire requests only for assigned active Branches."
        );
      }

      return {
        targetRole,
        sourceVendor: assignment.vendor,
        areaManagerStep:
          await this.requestApprovalRoutingService.resolveAreaManagerStep(
            ApprovalStep.AREA_MANAGER_APPROVAL,
            assignment.vendor.chainId
          ),
        skipAreaManagerApproval: false
      };
    }

    const sourceVendor = await this.findActiveVendorOrThrow(dto.sourceVendorId);

    if (actor.role === UserRole.AREA_MANAGER) {
      await this.assertAreaManagerCanUseChain(
        actor.id,
        sourceVendor.chainId,
        "Area Managers can submit New Hire requests only within assigned Chain scope."
      );

      return {
        targetRole,
        sourceVendor,
        areaManagerStep: {
          step: ApprovalStep.AREA_MANAGER_APPROVAL,
          approverRole: UserRole.AREA_MANAGER,
          approverId: actor.id,
          chainId: sourceVendor.chainId
        },
        skipAreaManagerApproval: true
      };
    }

    return {
      targetRole,
      sourceVendor,
      areaManagerStep:
        await this.requestApprovalRoutingService.resolveAreaManagerStep(
          ApprovalStep.AREA_MANAGER_APPROVAL,
          sourceVendor.chainId
        ),
      skipAreaManagerApproval: false
    };
  }

  private async resolveAreaManagerNewHireContext(
    dto: CreateNewHireRequestDto
  ): Promise<AreaManagerNewHireContext> {
    const chainIds = this.normalizeChainIds(dto);

    if (!chainIds.length) {
      throw new BadRequestException(
        "AREA_MANAGER New Hire requires at least one sourceChainId or chainIds value."
      );
    }

    const chains = await this.prisma.chain.findMany({
      where: { id: { in: chainIds } }
    });

    if (chains.length !== chainIds.length) {
      throw new NotFoundException("One or more selected Chains were not found.");
    }

    const inactiveChain = chains.find((chain) => chain.status !== ChainStatus.ACTIVE);
    if (inactiveChain) {
      throw new BadRequestException(
        `Selected Chain ${inactiveChain.chainName} is not active.`
      );
    }

    return {
      targetRole: UserRole.AREA_MANAGER,
      chains,
      chainIds
    };
  }

  private async findActiveVendorOrThrow(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { chain: true }
    });

    if (!vendor) {
      throw new NotFoundException("Selected Branch was not found.");
    }

    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch is not active.");
    }

    if (vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Selected Branch Chain is not active.");
    }

    return vendor;
  }

  private async assertAreaManagerCanUseChain(
    areaManagerId: string,
    chainId: string,
    message: string
  ) {
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        areaManagerId,
        chainId,
        status: AssignmentStatus.ACTIVE,
        chain: { status: ChainStatus.ACTIVE }
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ForbiddenException(message);
    }
  }

  private normalizeNewHireCandidate(dto: CreateNewHireRequestDto) {
    const nameEn = dto.nameEn?.trim();
    const nameAr = dto.nameAr?.trim();
    const address = dto.address?.trim();
    const notes = dto.notes?.trim();

    if (!nameEn && !nameAr) {
      throw new BadRequestException("Candidate English or Arabic name is required.");
    }

    return {
      ...(nameEn ? { nameEn } : {}),
      ...(nameAr ? { nameAr } : {}),
      phoneNumber: this.applyPolicyValidation(() =>
        validateEgyptPhoneNumber(dto.phoneNumber)
      ),
      nationalId: this.applyPolicyValidation(() =>
        validateEgyptNationalId(dto.nationalId)
      ),
      ...(address ? { address } : {}),
      ...(dto.dateOfBirth ? { dateOfBirth: dto.dateOfBirth } : {}),
      gender: dto.gender ?? Gender.UNSPECIFIED,
      ...(notes ? { notes } : {})
    };
  }

  private async createTemporaryPasswordBundle() {
    const temporaryPassword = this.temporaryPasswordService.generate();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const temporaryPasswordExpiresAt = new Date(
      Date.now() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000
    );
    const temporaryPasswordCreatedAt = new Date();

    return {
      passwordHash,
      temporaryPasswordExpiresAt,
      temporaryPasswordCreatedAt,
      temporaryPasswordCiphertext:
        this.temporaryPasswordService.encrypt(temporaryPassword)
    };
  }

  private toUserProfileFields(
    targetRole: NewHireTargetRole,
    candidate: NormalizedNewHireCandidate,
    temporaryPasswordBundle: Awaited<
      ReturnType<NewHireWorkflowService["createTemporaryPasswordBundle"]>
    >,
    shopperId?: string,
    existingUser?: User
  ): NewHireUserProfileFields {
    return {
      nameEn:
        candidate.nameEn ??
        candidate.nameAr ??
        existingUser?.nameEn ??
        this.defaultNameForRole(targetRole),
      nameAr: candidate.nameAr ?? existingUser?.nameAr ?? null,
      phoneNumber: candidate.phoneNumber,
      nationalId: candidate.nationalId,
      address: candidate.address ?? existingUser?.address ?? null,
      dateOfBirth: candidate.dateOfBirth
        ? new Date(candidate.dateOfBirth)
        : existingUser?.dateOfBirth ?? null,
      gender: candidate.gender,
      shopperId: targetRole === UserRole.PICKER ? (shopperId ?? null) : null,
      joiningDate: new Date(),
      accountStatus: AccountStatus.ACTIVE,
      employmentStatus: EmploymentStatus.ACTIVE,
      passwordHash: temporaryPasswordBundle.passwordHash,
      mustChangePassword: true,
      temporaryPasswordExpiresAt:
        temporaryPasswordBundle.temporaryPasswordExpiresAt,
      temporaryPasswordCiphertext:
        temporaryPasswordBundle.temporaryPasswordCiphertext,
      temporaryPasswordCreatedAt:
        temporaryPasswordBundle.temporaryPasswordCreatedAt
    };
  }

  private async notifyBranchCredentialHandoff(
    tx: Prisma.TransactionClient,
    params: {
      requestId: string;
      user: User;
      sourceVendor: Vendor & { chain: Chain };
      targetRole: Extract<UserRole, "PICKER" | "CHAMP">;
    }
  ) {
    const champAssignments = await tx.vendorChampAssignment.findMany({
      where: {
        vendorId: params.sourceVendor.id,
        status: AssignmentStatus.ACTIVE,
        champ: {
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        }
      },
      select: { champId: true }
    });
    const champIds = Array.from(
      new Set(champAssignments.map((assignment) => assignment.champId))
    );

    if (champIds.length) {
      await tx.notification.createMany({
        data: champIds.map((champId) => ({
          userId: champId,
          type: "NEW_HIRE_CREDENTIAL_HANDOFF",
          title: `${this.formatTargetRole(params.targetRole)} profile ready`,
          body: `${this.formatTargetRole(params.targetRole)} ${params.user.phoneNumber} was created for ${params.sourceVendor.vendorName}. Open the user profile for credential handoff.`,
          payload: {
            requestId: params.requestId,
            userId: params.user.id,
            vendorId: params.sourceVendor.id,
            targetRole: params.targetRole
          }
        }))
      });
      return;
    }

    const areaManagers = await tx.chainAreaManagerAssignment.findMany({
      where: {
        chainId: params.sourceVendor.chainId,
        status: AssignmentStatus.ACTIVE,
        areaManager: {
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        }
      },
      select: { areaManagerId: true }
    });

    if (areaManagers.length) {
      await tx.notification.createMany({
        data: Array.from(
          new Set(areaManagers.map((assignment) => assignment.areaManagerId))
        ).map((areaManagerId) => ({
          userId: areaManagerId,
          type: "NEW_HIRE_BRANCH_WITHOUT_CHAMP",
          title: "New Hire created without Branch Champ",
          body: `${this.formatTargetRole(params.targetRole)} ${params.user.phoneNumber} was created for ${params.sourceVendor.vendorName}, but the Branch has no active Champ.`,
          payload: {
            requestId: params.requestId,
            userId: params.user.id,
            vendorId: params.sourceVendor.id,
            chainId: params.sourceVendor.chainId,
            targetRole: params.targetRole
          }
        }))
      });
    }
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

  private normalizeTargetRole(
    targetRole: UserRole | string | null | undefined
  ): NewHireTargetRole {
    return this.applyPolicyValidation(() =>
      normalizeNewHireTargetRole(targetRole)
    );
  }

  private normalizeChainIds(dto: {
    sourceChainId?: string;
    chainIds?: string[];
  }) {
    return Array.from(
      new Set([...(dto.chainIds ?? []), dto.sourceChainId].filter(Boolean))
    ) as string[];
  }

  private toAssignmentAuditValue(
    assignment: FinalizedAssignment,
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">
  ) {
    if (targetRole === UserRole.PICKER && "pickerId" in assignment) {
      return {
        pickerId: assignment.pickerId,
        vendorId: assignment.vendorId,
        createdByRequestId: assignment.createdByRequestId
      };
    }

    return {
      champId: "champId" in assignment ? assignment.champId : null,
      vendorId: assignment.vendorId
    };
  }

  private toFinalizedAssignmentResponse(
    assignment: FinalizedAssignment,
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">
  ) {
    return {
      id: assignment.id,
      assignmentType:
        targetRole === UserRole.PICKER
          ? "PickerBranchAssignment"
          : "VendorChampAssignment",
      status: assignment.status,
      startDate: assignment.startDate,
      vendorId: assignment.vendorId,
      userId:
        targetRole === UserRole.PICKER && "pickerId" in assignment
          ? assignment.pickerId
          : "champId" in assignment
            ? assignment.champId
            : null,
      pickerId:
        targetRole === UserRole.PICKER && "pickerId" in assignment
          ? assignment.pickerId
          : undefined,
      champId:
        targetRole === UserRole.CHAMP && "champId" in assignment
          ? assignment.champId
          : undefined,
      createdByRequestId:
        "createdByRequestId" in assignment ? assignment.createdByRequestId : null
    };
  }

  private toFinalizedUserResponse(user: User) {
    return {
      id: user.id,
      role: user.role,
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      phoneNumber: user.phoneNumber,
      shopperId: user.shopperId,
      accountStatus: user.accountStatus,
      employmentStatus: user.employmentStatus,
      profileStatus: user.profileStatus,
      mustChangePassword: user.mustChangePassword
    };
  }

  private defaultNameForRole(targetRole: NewHireTargetRole) {
    return targetRole === UserRole.PICKER
      ? "New Picker"
      : targetRole === UserRole.CHAMP
        ? "New Champ"
        : "New Area Manager";
  }

  private formatTargetRole(targetRole: NewHireTargetRole) {
    return String(targetRole)
      .toLowerCase()
      .split("_")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
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

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }
}
