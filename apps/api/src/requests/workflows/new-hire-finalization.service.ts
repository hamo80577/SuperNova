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
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  Chain,
  ChainStatus,
  EmploymentStatus,
  Gender,
  HrSyncTargetSheet,
  HrSyncWorkflowType,
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
import { HrSyncService, type HrSyncEventType } from "../../hr-sync";
import { PrismaService } from "../../prisma/prisma.service";
import { TemporaryPasswordService } from "../../users/temporary-password.service";
import type { FinalizeNewHireDto } from "../dto/finalize-new-hire.dto";
import {
  requestInclude,
  type RequestWithRelations
} from "../request-includes";
import { toRequestSummary } from "../request-response.utils";
import { NewHireCandidateService } from "./new-hire-candidate.service";
import { parseNewHirePayload } from "./new-hire-payload";
import {
  PASSWORD_HASH_ROUNDS,
  TEMPORARY_PASSWORD_EXPIRY_HOURS
} from "./new-hire-workflow.constants";
import {
  getRehireBlockNormalizationFields,
  resolveNewHireFinalizationShopperId,
  type NewHireTargetRole
} from "./new-hire-workflow.policy";
import type {
  FinalizedAssignment,
  NewHirePayload,
  NewHireUserProfileFields,
  NormalizedNewHireCandidate,
  RequestContext
} from "./new-hire-workflow.types";

@Injectable()
export class NewHireFinalizationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NewHireCandidateService)
    private readonly newHireCandidateService: NewHireCandidateService,
    @Inject(TemporaryPasswordService)
    private readonly temporaryPasswordService: TemporaryPasswordService,
    @Inject(HrSyncService)
    private readonly hrSync: HrSyncService
  ) {}

  async finalizeNewHire(
    id: string,
    _dto: FinalizeNewHireDto,
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
      return this.finalizeAreaManagerNewHire(
        request,
        adminApproval,
        payload,
        context
      );
    }

    const finalizableTargetRole: Extract<UserRole, "PICKER" | "CHAMP"> =
      payload.targetRole === UserRole.PICKER ? UserRole.PICKER : UserRole.CHAMP;
    const areaManagerShopperId = payload.areaManagerDecision?.shopperId?.trim() ?? "";
    const isPicker = finalizableTargetRole === UserRole.PICKER;
    const isRehire = payload.mode === "REHIRE";

    const [existingPhone, existingNationalId, rehireUser, sourceVendor] =
      await Promise.all([
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

    if (isRehire && !rehireUser) {
      throw new BadRequestException("Stored Rehire user was not found.");
    }

    const shopperId = this.resolveFinalizationShopperId(
      finalizableTargetRole,
      areaManagerShopperId,
      rehireUser?.shopperId ?? null
    );

    const existingShopper =
      isPicker && shopperId
        ? await this.prisma.user.findUnique({ where: { shopperId } })
        : null;

    if (existingShopper && existingShopper.id !== rehireUser?.id) {
      throw new ConflictException("Shopper ID is already assigned to another user.");
    }

    if (existingPhone && existingPhone.id !== rehireUser?.id) {
      throw new ConflictException("Candidate phone number already belongs to a user.");
    }

    if (existingNationalId && existingNationalId.id !== rehireUser?.id) {
      throw new ConflictException("Candidate National ID already belongs to a user.");
    }

    if (isRehire && rehireUser) {
      const rehireCandidate =
        await this.newHireCandidateService.findCandidateUserById(rehireUser.id);

      if (!rehireCandidate) {
        throw new BadRequestException("Stored Rehire user was not found.");
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
          rehireValidation.reason ?? "Stored Rehire user is not eligible."
        );
      }
    }

    if (payload.targetRole === UserRole.CHAMP) {
      await this.assertBranchCanReceiveChampNewHire(sourceVendor.id);
    }

    const temporaryPasswordBundle = await this.createTemporaryPasswordBundle();
    const completedAt = new Date();

    let result: {
      assignment: FinalizedAssignment;
      completedRequest: RequestWithRelations;
      user: User;
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
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
                ...getRehireBlockNormalizationFields()
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
            ...(payload.targetRole === UserRole.PICKER && shopperId
              ? { shopperId }
              : {}),
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
              oldValue: {
                status: request.status,
                currentStep: request.currentStep
              },
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
              newValue: {
                status: RequestStatus.COMPLETED,
                targetUserId: user.id
              },
              ipAddress: context.ipAddress ?? null,
              userAgent: context.userAgent ?? null
            }
          ]
        });

        return { completedRequest, user, assignment };
      });
    } catch (error) {
      if (this.isActiveChampAssignmentConflict(error)) {
        throw new ConflictException(this.activeChampConflictMessage());
      }

      throw error;
    }

    await this.syncPickerNewHireToHr(request.id, payload, result.user, context);

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

  private async syncPickerNewHireToHr(
    requestId: string,
    payload: NewHirePayload,
    finalizedUser: User,
    context: RequestContext
  ) {
    if (payload.targetRole !== UserRole.PICKER) {
      return;
    }

    const isRehire = payload.mode === "REHIRE";
    const workflowType = isRehire
      ? HrSyncWorkflowType.PICKER_REHIRE
      : HrSyncWorkflowType.PICKER_NEW_HIRE;
    const eventType: HrSyncEventType = isRehire ? "REHIRE" : "NEW_HIRE";
    const actualJoiningDate = payload.candidate.actualJoiningDate?.trim();
    const baseInput = {
      finalizerDisplayName: this.finalizerDisplayName(context.actor),
      fullNameEnglish:
        finalizedUser.nameEn ?? payload.candidate.nameEn ?? "New Picker",
      nationalId: finalizedUser.nationalId ?? payload.candidate.nationalId,
      phoneNumber: finalizedUser.phoneNumber ?? payload.candidate.phoneNumber,
      homeAddress: finalizedUser.address ?? payload.candidate.address ?? ""
    };

    if (!actualJoiningDate) {
      await this.recordFailedHrSyncLog({
        requestId,
        workflowType,
        targetSheet: HrSyncTargetSheet.NEW_HIRE,
        payloadSnapshot: {
          ...baseInput,
          requestType: isRehire ? "Rehire" : "New Hire",
          actualJoiningDate: null
        },
        errorMessage: "Missing actualJoiningDate for HR sync."
      });
      return;
    }

    const hrPayload = isRehire
      ? this.hrSync.buildPickerRehirePayload({
          ...baseInput,
          actualJoiningDate
        })
      : this.hrSync.buildPickerNewHirePayload({
          ...baseInput,
          actualJoiningDate
        });

    await this.createAndSendHrSyncLog({
      requestId,
      workflowType,
      targetSheet: HrSyncTargetSheet.NEW_HIRE,
      eventType,
      payloadSnapshot: hrPayload,
      payload: hrPayload
    });
  }

  private async createAndSendHrSyncLog(params: {
    requestId: string;
    workflowType: HrSyncWorkflowType;
    targetSheet: HrSyncTargetSheet;
    eventType: HrSyncEventType;
    payloadSnapshot: Prisma.InputJsonValue;
    payload: object;
  }) {
    let logId: string | null = null;

    try {
      const log = await this.hrSync.createNotSentLog({
        requestId: params.requestId,
        workflowType: params.workflowType,
        targetSheet: params.targetSheet,
        payloadSnapshot: params.payloadSnapshot
      });
      logId = log.id;

      const result = await this.hrSync.sendToHrSheet({
        eventType: params.eventType,
        payload: params.payload
      });

      if (result.status === "SENT") {
        await this.hrSync.markSent(log.id, {
          responseSnapshot: result.rawResponse,
          sentAt: new Date()
        });
        return;
      }

      if (result.status === "SKIPPED") {
        await this.hrSync.markSkipped(log.id, {
          reason: result.reason,
          responseSnapshot: {
            status: "SKIPPED",
            reason: result.reason
          }
        });
        return;
      }

      await this.hrSync.markFailed(log.id, {
        errorMessage: result.error,
        responseSnapshot: result.rawResponse
          ? (result.rawResponse as Prisma.InputJsonValue)
          : null
      });
    } catch (error) {
      if (!logId) {
        return;
      }

      try {
        await this.hrSync.markFailed(logId, {
          errorMessage: this.formatHrSyncError(error),
          responseSnapshot: null
        });
      } catch {
        // HR Sync must never fail a completed workflow finalization.
      }
    }
  }

  private async recordFailedHrSyncLog(params: {
    requestId: string;
    workflowType: HrSyncWorkflowType;
    targetSheet: HrSyncTargetSheet;
    payloadSnapshot: Prisma.InputJsonValue;
    errorMessage: string;
  }) {
    try {
      const log = await this.hrSync.createNotSentLog({
        requestId: params.requestId,
        workflowType: params.workflowType,
        targetSheet: params.targetSheet,
        payloadSnapshot: params.payloadSnapshot
      });
      await this.hrSync.markFailed(log.id, {
        errorMessage: params.errorMessage,
        responseSnapshot: null
      });
    } catch {
      // HR Sync logging must never fail a completed workflow finalization.
    }
  }

  private finalizerDisplayName(user: AuthenticatedUser) {
    return user.nameEn ?? user.phoneNumber ?? user.id;
  }

  private formatHrSyncError(error: unknown) {
    return error instanceof Error ? error.message : "HR sync failed.";
  }

  private async finalizeAreaManagerNewHire(
    request: RequestWithRelations,
    adminApproval: RequestWithRelations["approvals"][number],
    payload: NewHirePayload,
    context: RequestContext
  ) {
    const [existingPhone, existingNationalId] = await Promise.all([
      this.prisma.user.findUnique({
        where: { phoneNumber: payload.candidate.phoneNumber }
      }),
      this.prisma.user.findUnique({
        where: { nationalId: payload.candidate.nationalId }
      })
    ]);

    if (existingPhone) {
      throw new ConflictException("Candidate phone number already belongs to a user.");
    }

    if (existingNationalId) {
      throw new ConflictException("Candidate National ID already belongs to a user.");
    }

    const temporaryPasswordBundle = await this.createTemporaryPasswordBundle();
    const completedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const areaManager = await tx.user.create({
        data: {
          role: UserRole.AREA_MANAGER,
          ...this.toUserProfileFields(
            UserRole.AREA_MANAGER,
            payload.candidate,
            temporaryPasswordBundle
          ),
          profileStatus: ProfileStatus.COMPLETE
        }
      });

      await tx.requestApproval.update({
        where: { id: adminApproval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          approverId: context.actor.id,
          notes: "Area Manager New Hire finalized."
        }
      });

      const completedPayload: NewHirePayload = {
        ...payload,
        finalization: {
          userId: areaManager.id,
          completedAt: completedAt.toISOString()
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          targetUserId: areaManager.id,
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      await tx.notification.create({
        data: {
          userId: request.createdById,
          type: "NEW_HIRE_COMPLETED",
          title: "New Hire completed",
          body: "Area Manager account was created. Assign Chains from the user profile for operational scope.",
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
            oldValue: {
              status: request.status,
              currentStep: request.currentStep
            },
            newValue: {
              status: RequestStatus.COMPLETED,
              targetRole: UserRole.AREA_MANAGER,
              userId: areaManager.id,
              mode: payload.mode
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
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: request.id,
            oldValue: { status: request.status },
            newValue: {
              status: RequestStatus.COMPLETED,
              targetUserId: areaManager.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, user: areaManager };
    });

    return {
      request: toRequestSummary(result.completedRequest),
      user: this.toFinalizedUserResponse(result.user),
      picker: this.toFinalizedUserResponse(result.user),
      assignment: null,
      assignments: []
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

  private async assertBranchCanReceiveChampNewHire(sourceVendorId: string) {
    const activeChampAssignment = await this.prisma.vendorChampAssignment.findFirst({
      where: {
        vendorId: sourceVendorId,
        status: AssignmentStatus.ACTIVE
      },
      include: { champ: true }
    });

    if (!activeChampAssignment) {
      return;
    }

    throw new ConflictException(
      this.activeChampConflictMessage(activeChampAssignment.champ.nameEn)
    );
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
      ReturnType<NewHireFinalizationService["createTemporaryPasswordBundle"]>
    >,
    shopperId?: string | null,
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
      gender: candidate.gender ?? existingUser?.gender ?? Gender.UNSPECIFIED,
      shopperId:
        targetRole === UserRole.PICKER
          ? (shopperId ?? existingUser?.shopperId ?? null)
          : null,
      joiningDate: this.resolveJoiningDate(targetRole, candidate, existingUser),
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

  // joiningDate is the Annual Leave source of truth for Pickers and Champs:
  // it must reflect the real joining/start date, not the finalization moment.
  private resolveJoiningDate(
    targetRole: NewHireTargetRole,
    candidate: NormalizedNewHireCandidate,
    existingUser?: User
  ): Date {
    if (targetRole === UserRole.PICKER || targetRole === UserRole.CHAMP) {
      if (candidate.actualJoiningDate) {
        return new Date(`${candidate.actualJoiningDate}T00:00:00.000Z`);
      }

      // Rehire without a new joining date preserves the existing one.
      if (existingUser?.joiningDate) {
        return existingUser.joiningDate;
      }
    }

    // Legacy request (no actualJoiningDate), fresh-hire fallback, or other roles.
    return new Date();
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

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  private resolveFinalizationShopperId(
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">,
    requestedShopperId: string | null | undefined,
    existingShopperId: string | null | undefined
  ) {
    try {
      return resolveNewHireFinalizationShopperId(
        targetRole,
        requestedShopperId,
        existingShopperId
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private activeChampConflictMessage(champName?: string | null) {
    return champName
      ? `Selected Branch already has an active Champ: ${champName}. One Branch can have one active Champ only.`
      : "Selected Branch already has an active Champ. One Branch can have one active Champ only.";
  }

  private isActiveChampAssignmentConflict(error: unknown) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      return false;
    }

    const target = error.meta?.target;
    return (
      error.meta?.modelName === "VendorChampAssignment" &&
      Array.isArray(target) &&
      target.includes("vendorId")
    );
  }
}
