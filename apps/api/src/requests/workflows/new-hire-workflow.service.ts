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
  AssignmentStatus,
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

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { TemporaryPasswordService } from "../../users/temporary-password.service";
import type { CreateNewHireRequestDto } from "../dto/create-new-hire-request.dto";
import type { FinalizeNewHireDto } from "../dto/finalize-new-hire.dto";
import type { LookupNewHireCandidateDto } from "../dto/lookup-new-hire-candidate.dto";
import { RequestApprovalRoutingService } from "../request-approval-routing.service";
import { requestInclude } from "../request-includes";
import { toRequestSummary } from "../request-response.utils";
import {
  normalizeNewHireTargetRole,
  validateEgyptNationalId,
  validateEgyptPhoneNumber,
  type NewHireTargetRole
} from "./new-hire-workflow.policy";
import { NewHireCandidateService } from "./new-hire-candidate.service";
import { NewHireFinalizationService } from "./new-hire-finalization.service";
import { NewHireRequestCreationService } from "./new-hire-request-creation.service";
import {
  PASSWORD_HASH_ROUNDS,
  TEMPORARY_PASSWORD_EXPIRY_HOURS
} from "./new-hire-workflow.constants";
import type {
  AreaManagerNewHireContext,
  BranchNewHireContext,
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
    @Inject(NewHireFinalizationService)
    private readonly newHireFinalizationService: NewHireFinalizationService,
    @Inject(NewHireRequestCreationService)
    private readonly newHireRequestCreationService: NewHireRequestCreationService,
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

    return this.newHireRequestCreationService.createBranchNewHire(
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
    return this.newHireFinalizationService.finalizeNewHire(id, dto, context);
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
      await this.assertBranchCanReceiveChampNewHire(targetRole, sourceVendor.id);

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

    await this.assertBranchCanReceiveChampNewHire(targetRole, sourceVendor.id);

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

  private async assertBranchCanReceiveChampNewHire(
    targetRole: Extract<UserRole, "PICKER" | "CHAMP">,
    sourceVendorId: string
  ) {
    if (targetRole !== UserRole.CHAMP) {
      return;
    }

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
      `Selected Branch already has an active Champ: ${activeChampAssignment.champ.nameEn}. One Branch can have one active Champ only.`
    );
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
