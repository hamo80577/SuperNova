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
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  ProfileStatus,
  RequestStatus,
  RequestType,
  User,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import { pendingRequestStatuses } from "../requests/request-status-machine";
import type { AreaManagerChainAssignmentDto } from "./dto/area-manager-chain-assignment.dto";
import type { UpdateAdminProfileDto } from "./dto/admin-profile.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { UpdateProfileCompletionDto } from "./dto/profile-completion.dto";
import { toSafeUser, type SafeUserDto } from "./dto/safe-user.dto";
import type { UpdateUserPreferencesDto } from "./dto/user-preferences.dto";
import type {
  WorkforceSummaryPeriod,
  WorkforceSummaryQueryDto,
  WorkforceSummaryRole
} from "./dto/workforce-summary-query.dto";
import { TemporaryPasswordService } from "./temporary-password.service";

const MAX_PAGE_SIZE = 100;
const PASSWORD_HASH_ROUNDS = 12;
const TEMPORARY_PASSWORD_EXPIRY_HOURS = 72;
const ADMIN_MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN] as const;
const REQUIRED_PICKER_PROFILE_FIELDS = [
  "nationalId",
  "address",
  "dateOfBirth"
] as const;

type WorkforcePeriod = {
  from: Date;
  to: Date;
  label: string;
};

type WorkforceMovementRequestType = Extract<
  RequestType,
  "NEW_HIRE" | "RESIGNATION"
>;

type ScopedWorkforceSummaryQuery = WorkforceSummaryQueryDto & {
  scopeChainIds?: string[];
  scopeVendorIds?: string[];
  includeChampWorkforce?: boolean;
  includeManagementWorkforce?: boolean;
  includeAdminManagementWorkforce?: boolean;
};

type OperationalAssignmentSummary = {
  id: string;
  status: AssignmentStatus;
  startDate: Date;
  endDate: Date | null;
};

type OperationalUserSummary = Pick<
  SafeUserDto,
  | "id"
  | "role"
  | "nameEn"
  | "nameAr"
  | "phoneNumber"
  | "accountStatus"
  | "employmentStatus"
  | "profileStatus"
>;

type OperationalChainSummary = {
  id: string;
  chainName: string;
  chainCode: string;
  status: string;
};

type OperationalVendorSummary = {
  id: string;
  vendorName: string;
  vendorCode: string;
  vendorExternalId: string | null;
  status: string;
  chainId: string;
  area: string | null;
  city: string | null;
};

type OperationalListContext = {
  key: string;
  assignment: OperationalAssignmentSummary | null;
  vendor: OperationalVendorSummary | null;
  chain: OperationalChainSummary | null;
  champ: OperationalUserSummary | null;
  areaManager: OperationalUserSummary | null;
  pendingRequest: OperationalPendingRequestSummary | null;
};

type OperationalPendingRequestSummary = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  currentStep: string | null;
  createdAt: Date;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TemporaryPasswordService)
    private readonly temporaryPasswordService: TemporaryPasswordService
  ) {}

  getFoundationStatus() {
    return {
      module: "users",
      status: "foundation-only"
    };
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id }
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: { phoneNumber }
    });
  }

  async list(query: ListUsersQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = this.buildWhere(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: items.map(toSafeUser),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async listOperational(query: ListUsersQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = this.buildWhere(query);

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    const contexts = await this.getOperationalListContexts(users);

    return {
      items: users.map((user) => {
        const context = contexts.get(user.id) ?? this.emptyOperationalContext(user);
        return {
          key: context.key,
          user: toSafeUser(user),
          assignment: context.assignment,
          vendor: context.vendor,
          chain: context.chain,
          champ: context.champ,
          areaManager: context.areaManager,
          pendingRequest: context.pendingRequest
        };
      }),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getWorkforceSummary(
    query: WorkforceSummaryQueryDto,
    currentUser: AuthenticatedUser
  ) {
    const period = this.resolveWorkforcePeriod(query.period ?? "this-month");
    const { role, scopedQuery } = await this.resolveWorkforceSummaryScope(
      query,
      currentUser
    );
    const [startingHeadcount, endingHeadcount, newHires, exited] =
      await Promise.all([
        this.countWorkforceHeadcountAt(role, scopedQuery, period.from),
        this.countWorkforceHeadcountAt(role, scopedQuery, period.to),
        this.countWorkforceMovement(
          role,
          scopedQuery,
          period,
          RequestType.NEW_HIRE
        ),
        this.countWorkforceMovement(
          role,
          scopedQuery,
          period,
          RequestType.RESIGNATION
        )
      ]);
    const averageHeadcount = this.roundWorkforceMetric(
      (startingHeadcount + endingHeadcount) / 2
    );
    const attritionRate = averageHeadcount
      ? this.roundWorkforceMetric((exited / averageHeadcount) * 100)
      : 0;

    return {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        label: period.label
      },
      role,
      startingHeadcount,
      newHires,
      exited,
      endingHeadcount,
      averageHeadcount,
      attritionRate,
      netMovement: newHires - exited
    };
  }

  async getSafeCurrentUser(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      return null;
    }

    return toSafeUser(user);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException("Current user was not found.");
    }

    if (user.uiTheme === dto.uiTheme) {
      return {
        user: toSafeUser(user)
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { uiTheme: dto.uiTheme }
    });

    await this.auditService.log({
      actorUserId: user.id,
      action: "USER_PREFERENCES_UPDATED",
      entityType: "User",
      entityId: user.id,
      oldValue: {
        uiTheme: user.uiTheme
      },
      newValue: {
        uiTheme: updatedUser.uiTheme
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      user: toSafeUser(updatedUser)
    };
  }

  async getProfileCompletion(userId: string) {
    const user = await this.getPickerForProfileCompletion(userId);

    return this.toProfileCompletionResponse(user);
  }

  async updateProfileCompletion(
    userId: string,
    dto: UpdateProfileCompletionDto,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const user = await this.getPickerForProfileCompletion(userId);

    if (user.profileStatus === ProfileStatus.COMPLETE) {
      throw new BadRequestException("Picker profile is already complete.");
    }

    if (user.mustChangePassword) {
      throw new BadRequestException(
        "Change your temporary password before completing your profile."
      );
    }

    const mergedProfile = {
      nameEn: dto.nameEn ?? user.nameEn,
      nameAr: dto.nameAr ?? user.nameAr,
      nationalId: dto.nationalId ?? user.nationalId,
      address: dto.address ?? user.address,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : user.dateOfBirth,
      gender: dto.gender ?? user.gender
    };

    if (!mergedProfile.nameEn && !mergedProfile.nameAr) {
      throw new BadRequestException("Either English name or Arabic name is required.");
    }

    const missingFields = this.getMissingProfileFields(mergedProfile);

    if (missingFields.length) {
      throw new BadRequestException(
        `Missing required profile fields: ${missingFields.join(", ")}.`
      );
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          nameEn: mergedProfile.nameEn,
          nameAr: mergedProfile.nameAr,
          nationalId: mergedProfile.nationalId,
          address: mergedProfile.address,
          dateOfBirth: mergedProfile.dateOfBirth,
          gender: mergedProfile.gender,
          profileStatus: ProfileStatus.COMPLETE
        }
      });

      await this.auditService.log({
        actorUserId: updatedUser.id,
        action: "PICKER_PROFILE_COMPLETED",
        entityType: "User",
        entityId: updatedUser.id,
        oldValue: {
          profileStatus: user.profileStatus,
          missingFields: this.getMissingProfileFields(user)
        },
        newValue: {
          profileStatus: updatedUser.profileStatus,
          updatedFields: Object.keys(dto)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return this.toProfileCompletionResponse(updatedUser);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "One of the submitted profile values is already in use."
        );
      }

      throw error;
    }
  }

  async getOperationalProfile(userId: string, currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    const permissions = await this.getOperationalPermissions(user, currentUser);

    const [
      currentPickerAssignment,
      champAssignments,
      areaManagerAssignments,
      recentRequests
    ] = await this.prisma.$transaction([
      this.prisma.pickerBranchAssignment.findFirst({
        where: { pickerId: user.id, status: AssignmentStatus.ACTIVE },
        include: { vendor: { include: { chain: true } } },
        orderBy: { startDate: "desc" }
      }),
      this.prisma.vendorChampAssignment.findMany({
        where: { champId: user.id, status: AssignmentStatus.ACTIVE },
        include: { vendor: { include: { chain: true } } },
        orderBy: { startDate: "desc" },
        take: 8
      }),
      this.prisma.chainAreaManagerAssignment.findMany({
        where: { areaManagerId: user.id, status: AssignmentStatus.ACTIVE },
        include: { chain: true },
        orderBy: { startDate: "desc" },
        take: 8
      }),
      this.prisma.request.findMany({
        where: {
          OR: [{ targetUserId: user.id }, { createdById: user.id }]
        },
        include: {
          sourceVendor: { include: { chain: true } },
          destinationVendor: { include: { chain: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 12
      })
    ]);
    const requestIds = recentRequests.map((request) => request.id);
    const activityFilters: Prisma.AuditLogWhereInput[] = [
      { entityType: "User", entityId: user.id },
      { actorUserId: user.id }
    ];

    if (requestIds.length) {
      activityFilters.push({ entityType: "Request", entityId: { in: requestIds } });
    }

    const activity = await this.prisma.auditLog.findMany({
      where: { OR: activityFilters },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return {
      user: toSafeUser(user),
      workedDays: this.getWorkedDays(user.joiningDate),
      permissions,
      password: {
        mustChangePassword: user.mustChangePassword,
        temporaryPasswordAvailable: permissions.canReadTemporaryPassword,
        temporaryPasswordExpiresAt: permissions.canReadTemporaryPassword
          ? user.temporaryPasswordExpiresAt
          : null,
        temporaryPasswordCreatedAt: permissions.canReadTemporaryPassword
          ? user.temporaryPasswordCreatedAt
          : null
      },
      currentPickerAssignment: currentPickerAssignment
        ? {
            id: currentPickerAssignment.id,
            status: currentPickerAssignment.status,
            startDate: currentPickerAssignment.startDate,
            endDate: currentPickerAssignment.endDate,
            vendor: this.toVendorSummary(currentPickerAssignment.vendor),
            chain: this.toChainSummary(currentPickerAssignment.vendor.chain)
          }
        : null,
      champAssignments: champAssignments.map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        vendor: this.toVendorSummary(assignment.vendor),
        chain: this.toChainSummary(assignment.vendor.chain)
      })),
      areaManagerAssignments: areaManagerAssignments.map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        chain: this.toChainSummary(assignment.chain)
      })),
      recentRequests: recentRequests.map((request) => ({
        id: request.id,
        type: request.type,
        status: request.status,
        currentStep: request.currentStep,
        createdAt: request.createdAt,
        completedAt: request.completedAt,
        sourceVendor: request.sourceVendor
          ? this.toVendorSummary(request.sourceVendor)
          : null,
        destinationVendor: request.destinationVendor
          ? this.toVendorSummary(request.destinationVendor)
          : null
      })),
      activity: activity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor ? this.toUserSummary(log.actor) : null,
        createdAt: log.createdAt
      }))
    };
  }

  async getAreaManagerChainAssignments(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    if (user.role !== UserRole.AREA_MANAGER) {
      throw new BadRequestException("Target user must be an Area Manager.");
    }

    return this.toAreaManagerChainAssignmentsResponse(user);
  }

  async addAreaManagerChainAssignments(
    userId: string,
    dto: AreaManagerChainAssignmentDto,
    currentUser: AuthenticatedUser,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    this.assertAdminActor(currentUser);
    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });

    this.assertAssignableAreaManager(targetUser);

    const chainIds = Array.from(new Set(dto.chainIds));
    const chains = await this.prisma.chain.findMany({
      where: {
        id: { in: chainIds },
        status: ChainStatus.ACTIVE
      }
    });

    if (chains.length !== chainIds.length) {
      throw new BadRequestException(
        "One or more selected Chains were not found or inactive."
      );
    }

    const existingAssignments =
      await this.prisma.chainAreaManagerAssignment.findMany({
        where: {
          areaManagerId: targetUser.id,
          chainId: { in: chainIds },
          status: AssignmentStatus.ACTIVE
        },
        select: { chainId: true }
      });
    const existingChainIds = new Set(
      existingAssignments.map((assignment) => assignment.chainId)
    );
    const newChainIds = chainIds.filter((chainId) => !existingChainIds.has(chainId));

    if (newChainIds.length) {
      await this.prisma.$transaction(async (tx) => {
        const created = await Promise.all(
          newChainIds.map((chainId) =>
            tx.chainAreaManagerAssignment.create({
              data: {
                areaManagerId: targetUser.id,
                chainId,
                status: AssignmentStatus.ACTIVE
              }
            })
          )
        );

        await tx.auditLog.createMany({
          data: created.map((assignment) => ({
            actorUserId: currentUser.id,
            action: "AREA_MANAGER_CHAIN_ASSIGNMENT_CREATED",
            entityType: "ChainAreaManagerAssignment",
            entityId: assignment.id,
            newValue: {
              areaManagerId: assignment.areaManagerId,
              chainId: assignment.chainId
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }))
        });
      });
    }

    return this.toAreaManagerChainAssignmentsResponse(targetUser);
  }

  async removeAreaManagerChainAssignment(
    userId: string,
    assignmentId: string,
    currentUser: AuthenticatedUser,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    this.assertAdminActor(currentUser);

    const assignment = await this.prisma.chainAreaManagerAssignment.findUnique({
      where: { id: assignmentId },
      include: { areaManager: true, chain: true }
    });

    if (!assignment) {
      throw new NotFoundException("Area Manager Chain assignment was not found.");
    }

    if (assignment.areaManagerId !== userId) {
      throw new BadRequestException(
        "Area Manager Chain assignment does not belong to this user."
      );
    }

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException("Only active Chain assignments can be removed.");
    }

    const openRequestCount = await this.countOpenRequestsForAreaManagerChain(
      assignment.areaManagerId,
      assignment.chainId
    );

    if (openRequestCount > 0) {
      throw new BadRequestException(
        "Cannot remove this Chain from the Area Manager while open requests require action on this Chain."
      );
    }

    const closedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.chainAreaManagerAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: closedAt
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: currentUser.id,
          action: "AREA_MANAGER_CHAIN_ASSIGNMENT_CLOSED",
          entityType: "ChainAreaManagerAssignment",
          entityId: assignment.id,
          oldValue: {
            status: assignment.status,
            areaManagerId: assignment.areaManagerId,
            chainId: assignment.chainId
          },
          newValue: {
            status: AssignmentStatus.CLOSED,
            areaManagerId: assignment.areaManagerId,
            chainId: assignment.chainId,
            endDate: closedAt.toISOString()
          },
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });
    });

    return this.toAreaManagerChainAssignmentsResponse(assignment.areaManager);
  }

  async updateAdminProfile(
    userId: string,
    dto: UpdateAdminProfileDto,
    currentUser: AuthenticatedUser,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException("Only Admin users can edit profiles.");
    }

    const data: Prisma.UserUpdateInput = {};
    const trimmed = {
      nameEn: dto.nameEn?.trim(),
      nameAr: dto.nameAr?.trim(),
      phoneNumber: dto.phoneNumber?.trim(),
      nationalId: dto.nationalId?.trim(),
      address: dto.address?.trim(),
      shopperId: dto.shopperId?.trim(),
      ibsId: dto.ibsId?.trim()
    };

    if (trimmed.nameEn !== undefined) data.nameEn = trimmed.nameEn;
    if (trimmed.nameAr !== undefined) data.nameAr = trimmed.nameAr || null;
    if (trimmed.phoneNumber !== undefined) data.phoneNumber = trimmed.phoneNumber;
    if (trimmed.nationalId !== undefined) data.nationalId = trimmed.nationalId || null;
    if (trimmed.address !== undefined) data.address = trimmed.address || null;
    if (trimmed.shopperId !== undefined) data.shopperId = trimmed.shopperId || null;
    if (trimmed.ibsId !== undefined) data.ibsId = trimmed.ibsId || null;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.joiningDate !== undefined) data.joiningDate = new Date(dto.joiningDate);

    if (!Object.keys(data).length) {
      throw new BadRequestException("No safe profile fields were submitted.");
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data
      });

      await this.auditService.log({
        actorUserId: currentUser.id,
        action: "ADMIN_PROFILE_UPDATED",
        entityType: "User",
        entityId: updatedUser.id,
        oldValue: {
          updatedFields: Object.keys(data),
          role: user.role
        },
        newValue: {
          updatedFields: Object.keys(data),
          role: updatedUser.role
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return {
        user: toSafeUser(updatedUser)
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "One of the submitted profile values is already in use."
        );
      }

      throw error;
    }
  }

  async revealTemporaryPassword(
    userId: string,
    currentUser: AuthenticatedUser,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    await this.assertCanManagePassword(user, currentUser);

    if (!user.mustChangePassword) {
      throw new BadRequestException(
        "User does not have an active temporary password."
      );
    }

    if (!user.temporaryPasswordCiphertext) {
      throw new BadRequestException("Temporary password is not available.");
    }

    if (
      user.temporaryPasswordExpiresAt &&
      user.temporaryPasswordExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException("Temporary password has expired.");
    }

    await this.auditService.log({
      actorUserId: currentUser.id,
      action: "TEMPORARY_PASSWORD_REVEALED",
      entityType: "User",
      entityId: user.id,
      newValue: {
        mustChangePassword: user.mustChangePassword,
        temporaryPasswordExpiresAt:
          user.temporaryPasswordExpiresAt?.toISOString() ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      temporaryPassword: this.temporaryPasswordService.decrypt(
        user.temporaryPasswordCiphertext
      ),
      temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt,
      temporaryPasswordCreatedAt: user.temporaryPasswordCreatedAt
    };
  }

  async resetTemporaryPassword(
    userId: string,
    currentUser: AuthenticatedUser,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    await this.assertCanManagePassword(user, currentUser);

    return this.issueTemporaryPassword(user, currentUser, context);
  }

  private async issueTemporaryPassword(
    user: User,
    currentUser: AuthenticatedUser,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const temporaryPassword = this.temporaryPasswordService.generate();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const temporaryPasswordExpiresAt = new Date(
      Date.now() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000
    );
    const temporaryPasswordCreatedAt = new Date();

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        temporaryPasswordCiphertext:
          this.temporaryPasswordService.encrypt(temporaryPassword),
        temporaryPasswordCreatedAt,
        temporaryPasswordExpiresAt
      }
    });

    await Promise.all([
      this.auditService.log({
        actorUserId: currentUser.id,
        action: "TEMPORARY_PASSWORD_RESET",
        entityType: "User",
        entityId: updatedUser.id,
        oldValue: {
          mustChangePassword: user.mustChangePassword,
          temporaryPasswordExpiresAt:
            user.temporaryPasswordExpiresAt?.toISOString() ?? null
        },
        newValue: {
          mustChangePassword: updatedUser.mustChangePassword,
          temporaryPasswordExpiresAt:
            updatedUser.temporaryPasswordExpiresAt?.toISOString() ?? null
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }),
      this.auditService.log({
        actorUserId: currentUser.id,
        action: "TEMPORARY_PASSWORD_GENERATED",
        entityType: "User",
        entityId: updatedUser.id,
        newValue: {
          temporaryPasswordExpiresAt:
            updatedUser.temporaryPasswordExpiresAt?.toISOString() ?? null
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      })
    ]);

    return {
      user: toSafeUser(updatedUser),
      temporaryPassword,
      temporaryPasswordExpiresAt,
      temporaryPasswordCreatedAt
    };
  }

  private async toAreaManagerChainAssignmentsResponse(user: User) {
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        areaManagerId: user.id,
        status: AssignmentStatus.ACTIVE
      },
      include: { chain: true },
      orderBy: [
        { startDate: "desc" },
        { updatedAt: "desc" }
      ]
    });

    return {
      user: toSafeUser(user),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        chain: this.toChainSummary(assignment.chain)
      }))
    };
  }

  private assertAdminActor(currentUser: AuthenticatedUser) {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException(
        "Only Admin users can manage Area Manager Chain assignments."
      );
    }
  }

  private assertAssignableAreaManager(user: User | null): asserts user is User {
    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    if (user.role !== UserRole.AREA_MANAGER) {
      throw new BadRequestException("Target user must be an Area Manager.");
    }

    if (
      user.accountStatus !== AccountStatus.ACTIVE ||
      user.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Area Manager must be active before Chains can be assigned."
      );
    }

    if (user.blockStatus === BlockStatus.PERMANENT_BLOCK) {
      throw new BadRequestException(
        "Permanently blocked Area Managers cannot receive Chain assignments."
      );
    }

    if (
      user.blockStatus === BlockStatus.TEMPORARY_BLOCK &&
      user.blockedUntil &&
      user.blockedUntil.getTime() > Date.now()
    ) {
      throw new BadRequestException(
        "Temporarily blocked Area Managers cannot receive Chain assignments."
      );
    }
  }

  private countOpenRequestsForAreaManagerChain(
    areaManagerId: string,
    chainId: string
  ) {
    const openStatuses = [
      RequestStatus.DRAFT,
      RequestStatus.PENDING_AREA_MANAGER,
      RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
      RequestStatus.PENDING_ADMIN
    ];

    return this.prisma.request.count({
      where: {
        status: { in: openStatuses },
        OR: [
          { sourceChainId: chainId },
          { destinationChainId: chainId },
          {
            approvals: {
              some: {
                approverId: areaManagerId,
                status: ApprovalStatus.PENDING
              }
            }
          }
        ]
      }
    });
  }

  private async getOperationalPermissions(
    targetUser: User,
    currentUser: AuthenticatedUser
  ) {
    const admin = this.isAdmin(currentUser);
    const scopedChampPicker =
      currentUser.role === UserRole.CHAMP &&
      targetUser.role === UserRole.PICKER &&
      (await this.isActivePickerInChampScope(targetUser.id, currentUser.id));
    const scopedAreaManagerUser =
      currentUser.role === UserRole.AREA_MANAGER &&
      (await this.isUserInAreaManagerScope(targetUser, currentUser.id));
    const canManagePassword = admin || scopedChampPicker || scopedAreaManagerUser;

    if (
      !admin &&
      !scopedChampPicker &&
      !scopedAreaManagerUser &&
      currentUser.id !== targetUser.id
    ) {
      throw new ForbiddenException("You cannot view this profile.");
    }

    return {
      mode: admin
        ? "ADMIN"
        : scopedChampPicker
          ? "CHAMP"
          : scopedAreaManagerUser
            ? "AREA_MANAGER"
            : "SELF",
      canEditProfile: admin,
      canResetPassword: canManagePassword && !targetUser.mustChangePassword,
      canRegenerateTemporaryPassword:
        canManagePassword && targetUser.mustChangePassword,
      canReadTemporaryPassword:
        canManagePassword && this.hasUsableTemporaryPassword(targetUser)
    };
  }

  private async assertCanManagePassword(
    targetUser: User,
    currentUser: AuthenticatedUser
  ) {
    if (this.isAdmin(currentUser)) {
      if (targetUser.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException("Super Admin passwords cannot be reset here.");
      }

      if (
        targetUser.role === UserRole.ADMIN &&
        currentUser.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException("Only Super Admin can reset Admin passwords.");
      }

      return;
    }

    if (
      currentUser.role === UserRole.CHAMP &&
      targetUser.role === UserRole.PICKER &&
      (await this.isActivePickerInChampScope(targetUser.id, currentUser.id))
    ) {
      return;
    }

    if (
      currentUser.role === UserRole.AREA_MANAGER &&
      (await this.isUserInAreaManagerScope(targetUser, currentUser.id))
    ) {
      return;
    }

    throw new ForbiddenException("You cannot manage this user's password.");
  }

  private hasUsableTemporaryPassword(
    user: Pick<
      User,
      | "mustChangePassword"
      | "temporaryPasswordCiphertext"
      | "temporaryPasswordExpiresAt"
    >
  ) {
    return (
      user.mustChangePassword &&
      Boolean(user.temporaryPasswordCiphertext) &&
      !this.hasExpiredTemporaryPassword(user)
    );
  }

  private hasExpiredTemporaryPassword(
    user: Pick<User, "mustChangePassword" | "temporaryPasswordExpiresAt">
  ) {
    if (!user.mustChangePassword || !user.temporaryPasswordExpiresAt) {
      return false;
    }

    return user.temporaryPasswordExpiresAt.getTime() <= Date.now();
  }

  private async getOperationalListContexts(users: User[]) {
    const userIds = users.map((user) => user.id);
    const pickerIds = users
      .filter((user) => user.role === UserRole.PICKER)
      .map((user) => user.id);
    const champIds = users
      .filter((user) => user.role === UserRole.CHAMP)
      .map((user) => user.id);
    const areaManagerIds = users
      .filter((user) => user.role === UserRole.AREA_MANAGER)
      .map((user) => user.id);

    const [
      pickerAssignments,
      champAssignments,
      areaManagerAssignments,
      pendingLifecycleRequests
    ] = await Promise.all([
      pickerIds.length
        ? this.prisma.pickerBranchAssignment.findMany({
            where: { pickerId: { in: pickerIds } },
            include: {
              vendor: {
                include: {
                  chain: true,
                  champAssignments: {
                    where: { status: AssignmentStatus.ACTIVE },
                    include: { champ: true },
                    orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
                    take: 1
                  }
                }
              }
            },
            orderBy: [
              { pickerId: "asc" },
              { startDate: "desc" },
              { endDate: "desc" },
              { updatedAt: "desc" }
            ]
          })
        : Promise.resolve([]),
      champIds.length
        ? this.prisma.vendorChampAssignment.findMany({
            where: { champId: { in: champIds } },
            include: { vendor: { include: { chain: true } } },
            orderBy: [
              { champId: "asc" },
              { startDate: "desc" },
              { endDate: "desc" },
              { updatedAt: "desc" }
            ]
          })
        : Promise.resolve([]),
      areaManagerIds.length
        ? this.prisma.chainAreaManagerAssignment.findMany({
            where: { areaManagerId: { in: areaManagerIds } },
            include: { chain: true },
            orderBy: [
              { areaManagerId: "asc" },
              { startDate: "desc" },
              { endDate: "desc" },
              { updatedAt: "desc" }
            ]
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.request.findMany({
            where: {
              targetUserId: { in: userIds },
              type: { in: [RequestType.RESIGNATION, RequestType.TRANSFER] },
              status: { in: [...pendingRequestStatuses] }
            },
            select: {
              id: true,
              type: true,
              status: true,
              currentStep: true,
              targetUserId: true,
              createdAt: true
            },
            orderBy: [{ targetUserId: "asc" }, { createdAt: "desc" }]
          })
        : Promise.resolve([])
    ]);
    const pickerAssignmentsByUserId = this.groupBy(
      pickerAssignments,
      (assignment) => assignment.pickerId
    );
    const champAssignmentsByUserId = this.groupBy(
      champAssignments,
      (assignment) => assignment.champId
    );
    const areaManagerAssignmentsByUserId = this.groupBy(
      areaManagerAssignments,
      (assignment) => assignment.areaManagerId
    );
    const pendingRequestsByUserId =
      this.mapPendingLifecycleRequestsByUserId(pendingLifecycleRequests);
    const contexts = new Map<string, OperationalListContext>();

    for (const user of users) {
      const pendingRequest = pendingRequestsByUserId.get(user.id) ?? null;

      if (user.role === UserRole.PICKER) {
        const assignment = this.selectDisplayAssignment(
          pickerAssignmentsByUserId.get(user.id)
        );

        if (!assignment) {
          contexts.set(user.id, this.emptyOperationalContext(user, pendingRequest));
          continue;
        }

        const champ = assignment.vendor.champAssignments[0]?.champ ?? null;
        contexts.set(user.id, {
          key: assignment.id,
          assignment: this.toAssignmentSummary(assignment),
          vendor: this.toVendorSummary(assignment.vendor),
          chain: this.toChainSummary(assignment.vendor.chain),
          champ: champ ? this.toUserSummary(champ) : null,
          areaManager: null,
          pendingRequest
        });
        continue;
      }

      if (user.role === UserRole.CHAMP) {
        const assignment = this.selectDisplayAssignment(
          champAssignmentsByUserId.get(user.id)
        );

        if (!assignment) {
          contexts.set(user.id, this.emptyOperationalContext(user, pendingRequest));
          continue;
        }

        contexts.set(user.id, {
          key: assignment.id,
          assignment: this.toAssignmentSummary(assignment),
          vendor: this.toVendorSummary(assignment.vendor),
          chain: this.toChainSummary(assignment.vendor.chain),
          champ: this.toUserSummary(user),
          areaManager: null,
          pendingRequest
        });
        continue;
      }

      if (user.role === UserRole.AREA_MANAGER) {
        const assignment = this.selectDisplayAssignment(
          areaManagerAssignmentsByUserId.get(user.id)
        );

        if (!assignment) {
          contexts.set(user.id, this.emptyOperationalContext(user, pendingRequest));
          continue;
        }

        contexts.set(user.id, {
          key: assignment.id,
          assignment: this.toAssignmentSummary(assignment),
          vendor: null,
          chain: this.toChainSummary(assignment.chain),
          champ: null,
          areaManager: this.toUserSummary(user),
          pendingRequest
        });
        continue;
      }

      contexts.set(user.id, this.emptyOperationalContext(user, pendingRequest));
    }

    return contexts;
  }

  private mapPendingLifecycleRequestsByUserId(
    requests: Array<{
      id: string;
      type: RequestType;
      status: RequestStatus;
      currentStep: string | null;
      targetUserId: string | null;
      createdAt: Date;
    }>
  ) {
    const mapped = new Map<string, OperationalPendingRequestSummary>();

    for (const request of requests) {
      if (!request.targetUserId || mapped.has(request.targetUserId)) {
        continue;
      }

      mapped.set(request.targetUserId, {
        id: request.id,
        type: request.type,
        status: request.status,
        currentStep: request.currentStep,
        createdAt: request.createdAt
      });
    }

    return mapped;
  }

  private groupBy<T>(items: T[], getKey: (item: T) => string) {
    const grouped = new Map<string, T[]>();

    for (const item of items) {
      const key = getKey(item);
      const current = grouped.get(key);
      if (current) {
        current.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    return grouped;
  }

  private selectDisplayAssignment<
    T extends {
      status: AssignmentStatus;
      startDate: Date;
      endDate: Date | null;
      updatedAt: Date;
    }
  >(assignments: T[] | undefined) {
    if (!assignments?.length) {
      return null;
    }

    return [...assignments].sort((left, right) => {
      if (left.status === AssignmentStatus.ACTIVE && right.status !== AssignmentStatus.ACTIVE) {
        return -1;
      }
      if (left.status !== AssignmentStatus.ACTIVE && right.status === AssignmentStatus.ACTIVE) {
        return 1;
      }

      return (
        right.startDate.getTime() - left.startDate.getTime() ||
        (right.endDate?.getTime() ?? 0) - (left.endDate?.getTime() ?? 0) ||
        right.updatedAt.getTime() - left.updatedAt.getTime()
      );
    })[0];
  }

  private emptyOperationalContext(
    user: User,
    pendingRequest: OperationalPendingRequestSummary | null = null
  ): OperationalListContext {
    return {
      key: user.id,
      assignment: null,
      vendor: null,
      chain: null,
      champ: user.role === UserRole.CHAMP ? this.toUserSummary(user) : null,
      areaManager:
        user.role === UserRole.AREA_MANAGER ? this.toUserSummary(user) : null,
      pendingRequest
    };
  }

  private toAssignmentSummary(assignment: {
    id: string;
    status: AssignmentStatus;
    startDate: Date;
    endDate: Date | null;
  }): OperationalAssignmentSummary {
    return {
      id: assignment.id,
      status: assignment.status,
      startDate: assignment.startDate,
      endDate: assignment.endDate
    };
  }

  private async isActivePickerInChampScope(pickerId: string, champId: string) {
    const assignment = await this.prisma.pickerBranchAssignment.findFirst({
      where: {
        pickerId,
        status: AssignmentStatus.ACTIVE,
        vendor: {
          champAssignments: {
            some: {
              champId,
              status: AssignmentStatus.ACTIVE
            }
          }
        }
      },
      select: { id: true }
    });

    return Boolean(assignment);
  }

  private async isUserInAreaManagerScope(
    targetUser: User,
    areaManagerId: string
  ) {
    if (
      targetUser.role !== UserRole.PICKER &&
      targetUser.role !== UserRole.CHAMP
    ) {
      return false;
    }

    const areaManagerAssignments =
      await this.prisma.chainAreaManagerAssignment.findMany({
        where: {
          areaManagerId,
          status: AssignmentStatus.ACTIVE,
          chain: { status: ChainStatus.ACTIVE }
        },
        select: { chainId: true }
      });
    const chainIds = areaManagerAssignments.map((assignment) => assignment.chainId);

    if (!chainIds.length) {
      return false;
    }

    if (targetUser.role === UserRole.PICKER) {
      const assignment = await this.prisma.pickerBranchAssignment.findFirst({
        where: {
          pickerId: targetUser.id,
          status: AssignmentStatus.ACTIVE,
          vendor: { chainId: { in: chainIds } }
        },
        select: { id: true }
      });

      return Boolean(assignment);
    }

    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: {
        champId: targetUser.id,
        status: AssignmentStatus.ACTIVE,
        vendor: { chainId: { in: chainIds } }
      },
      select: { id: true }
    });

    return Boolean(assignment);
  }

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  private getWorkedDays(joiningDate: Date | null) {
    if (!joiningDate) {
      return null;
    }

    const start = new Date(joiningDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.max(
      0,
      Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    );
  }

  private toUserSummary(user: User) {
    return {
      id: user.id,
      role: user.role,
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      phoneNumber: user.phoneNumber,
      accountStatus: user.accountStatus,
      employmentStatus: user.employmentStatus,
      profileStatus: user.profileStatus
    };
  }

  private toChainSummary(chain: {
    id: string;
    chainName: string;
    chainCode: string;
    status: string;
  }) {
    return {
      id: chain.id,
      chainName: chain.chainName,
      chainCode: chain.chainCode,
      status: chain.status
    };
  }

  private toVendorSummary(vendor: {
    id: string;
    vendorName: string;
    vendorCode: string;
    vendorExternalId: string | null;
    status: string;
    chainId: string;
    area: string | null;
    city: string | null;
  }) {
    return {
      id: vendor.id,
      vendorName: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      vendorExternalId: vendor.vendorExternalId,
      status: vendor.status,
      chainId: vendor.chainId,
      area: vendor.area,
      city: vendor.city
    };
  }

  private resolveWorkforcePeriod(period: WorkforceSummaryPeriod): WorkforcePeriod {
    if (period !== "this-month") {
      throw new BadRequestException("Unsupported workforce summary period.");
    }

    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    from.setHours(0, 0, 0, 0);

    return {
      from,
      to,
      label: "This month"
    };
  }

  private async resolveWorkforceSummaryScope(
    query: WorkforceSummaryQueryDto,
    currentUser: AuthenticatedUser
  ): Promise<{
    role: WorkforceSummaryRole;
    scopedQuery: ScopedWorkforceSummaryQuery;
  }> {
    const role = query.role ?? "PICKER";

    if (this.isAdmin(currentUser)) {
      return {
        role,
        scopedQuery: query
      };
    }

    if (currentUser.role === UserRole.AREA_MANAGER) {
      return this.resolveAreaManagerWorkforceSummaryScope(
        query,
        currentUser.id,
        role
      );
    }

    if (currentUser.role === UserRole.CHAMP) {
      return this.resolveChampWorkforceSummaryScope(query, currentUser.id, role);
    }

    throw new ForbiddenException("You cannot view workforce summary.");
  }

  private async resolveAreaManagerWorkforceSummaryScope(
    query: WorkforceSummaryQueryDto,
    areaManagerId: string,
    role: WorkforceSummaryRole
  ) {
    if (role === "MANAGEMENT") {
      throw new ForbiddenException(
        "Area Managers cannot view management workforce summary."
      );
    }

    const scopeChainIds =
      await this.getActiveAreaManagerWorkforceChainIds(areaManagerId);

    if (query.areaManagerId && query.areaManagerId !== areaManagerId) {
      throw new ForbiddenException(
        "Selected Area Manager is outside your workforce scope."
      );
    }

    if (query.chainId && !scopeChainIds.includes(query.chainId)) {
      throw new ForbiddenException("Selected Chain is outside your scope.");
    }

    if (query.vendorId) {
      await this.assertVendorInChainScope(query.vendorId, scopeChainIds);
    }

    if (query.champId) {
      await this.assertChampInChainScope(query.champId, scopeChainIds);
    }

    return {
      role,
      scopedQuery: {
        ...query,
        scopeChainIds,
        includeManagementWorkforce: false,
        includeAdminManagementWorkforce: false
      }
    };
  }

  private async resolveChampWorkforceSummaryScope(
    query: WorkforceSummaryQueryDto,
    champId: string,
    role: WorkforceSummaryRole
  ) {
    if (role === "CHAMP" || role === "MANAGEMENT") {
      throw new ForbiddenException(
        "Champs can view Picker workforce summary only."
      );
    }

    if (query.areaManagerId) {
      throw new ForbiddenException(
        "Area Manager filters are outside Champ workforce scope."
      );
    }

    if (query.champId && query.champId !== champId) {
      throw new ForbiddenException("Selected Champ is outside your scope.");
    }

    const branches = await this.getActiveChampWorkforceBranches(champId);
    const scopeVendorIds = branches.map((branch) => branch.vendorId);
    const scopeChainIds = Array.from(
      new Set(branches.map((branch) => branch.chainId))
    );

    if (query.vendorId && !scopeVendorIds.includes(query.vendorId)) {
      throw new ForbiddenException("Selected Branch is outside your scope.");
    }

    if (query.chainId && !scopeChainIds.includes(query.chainId)) {
      throw new ForbiddenException("Selected Chain is outside your scope.");
    }

    return {
      role,
      scopedQuery: {
        ...query,
        scopeVendorIds,
        includeChampWorkforce: false,
        includeManagementWorkforce: false,
        includeAdminManagementWorkforce: false
      }
    };
  }

  private async getActiveAreaManagerWorkforceChainIds(areaManagerId: string) {
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: {
        areaManagerId,
        status: AssignmentStatus.ACTIVE,
        chain: { status: ChainStatus.ACTIVE }
      },
      select: { chainId: true }
    });

    return assignments.map((assignment) => assignment.chainId);
  }

  private async getActiveChampWorkforceBranches(champId: string) {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: {
        champId,
        status: AssignmentStatus.ACTIVE
      },
      select: {
        vendorId: true,
        vendor: {
          select: { chainId: true }
        }
      }
    });

    return assignments.map((assignment) => ({
      vendorId: assignment.vendorId,
      chainId: assignment.vendor.chainId
    }));
  }

  private async assertVendorInChainScope(
    vendorId: string,
    chainIds: string[]
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        id: vendorId,
        chainId: { in: chainIds }
      },
      select: { id: true }
    });

    if (!vendor) {
      throw new ForbiddenException("Selected Branch is outside your scope.");
    }
  }

  private async assertChampInChainScope(champId: string, chainIds: string[]) {
    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: {
        champId,
        status: AssignmentStatus.ACTIVE,
        vendor: { chainId: { in: chainIds } }
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ForbiddenException("Selected Champ is outside your scope.");
    }
  }

  private async countWorkforceHeadcountAt(
    role: WorkforceSummaryRole,
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ) {
    let total = 0;

    if (role === "PICKER" || role === "ALL") {
      total += await this.countPickerHeadcountAt(query, asOf);
    }

    if (
      (role === "CHAMP" || role === "ALL") &&
      query.includeChampWorkforce !== false
    ) {
      total += await this.countChampHeadcountAt(query, asOf);
    }

    if (
      (role === "MANAGEMENT" || role === "ALL") &&
      query.includeManagementWorkforce !== false
    ) {
      total += await this.countAreaManagerHeadcountAt(query, asOf);

      if (
        query.includeAdminManagementWorkforce !== false &&
        !this.hasOperationalScope(query)
      ) {
        total += await this.countAdminManagementHeadcountAt(asOf);
      }
    }

    return total;
  }

  private async countPickerHeadcountAt(
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ) {
    const rows = await this.prisma.pickerBranchAssignment.findMany({
      where: this.buildPickerAssignmentSnapshotWhere(query, asOf),
      select: { pickerId: true },
      distinct: ["pickerId"]
    });

    return new Set(rows.map((row) => row.pickerId)).size;
  }

  private async countChampHeadcountAt(
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ) {
    const rows = await this.prisma.vendorChampAssignment.findMany({
      where: this.buildChampAssignmentSnapshotWhere(query, asOf),
      select: { champId: true },
      distinct: ["champId"]
    });

    return new Set(rows.map((row) => row.champId)).size;
  }

  private async countAreaManagerHeadcountAt(
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ) {
    const where = this.buildAreaManagerAssignmentSnapshotWhere(query, asOf);

    if (!where) {
      return 0;
    }

    const rows = await this.prisma.chainAreaManagerAssignment.findMany({
      where,
      select: { areaManagerId: true },
      distinct: ["areaManagerId"]
    });

    return new Set(rows.map((row) => row.areaManagerId)).size;
  }

  private async countWorkforceMovement(
    role: WorkforceSummaryRole,
    query: ScopedWorkforceSummaryQuery,
    period: WorkforcePeriod,
    type: WorkforceMovementRequestType
  ) {
    let total = 0;

    if (role === "PICKER" || role === "ALL") {
      total += await this.countLifecycleRequestsForRole(
        UserRole.PICKER,
        query,
        period,
        type
      );
    }

    if (
      (role === "CHAMP" || role === "ALL") &&
      query.includeChampWorkforce !== false
    ) {
      total += await this.countLifecycleRequestsForRole(
        UserRole.CHAMP,
        query,
        period,
        type
      );
    }

    if (
      (role === "MANAGEMENT" || role === "ALL") &&
      query.includeManagementWorkforce !== false
    ) {
      total += await this.countLifecycleRequestsForRole(
        UserRole.AREA_MANAGER,
        query,
        period,
        type
      );

      if (
        query.includeAdminManagementWorkforce !== false &&
        !this.hasOperationalScope(query)
      ) {
        total +=
          type === RequestType.NEW_HIRE
            ? await this.countAdminManagementNewHires(period)
            : await this.countAdminManagementExits(period);
      }
    }

    return total;
  }

  private async countLifecycleRequestsForRole(
    role: Extract<UserRole, "PICKER" | "CHAMP" | "AREA_MANAGER">,
    query: ScopedWorkforceSummaryQuery,
    period: WorkforcePeriod,
    type: WorkforceMovementRequestType
  ) {
    const scopeWhere = this.buildLifecycleRequestScopeWhere(role, query);

    if (!scopeWhere) {
      return 0;
    }

    return this.prisma.request.count({
      where: {
        AND: [
          {
            type,
            status: RequestStatus.COMPLETED,
            completedAt: {
              gte: period.from,
              lte: period.to
            },
            targetUser: {
              is: { role }
            }
          },
          scopeWhere
        ]
      }
    });
  }

  private async countAdminManagementHeadcountAt(asOf: Date) {
    return this.prisma.user.count({
      where: {
        role: { in: [...ADMIN_MANAGEMENT_ROLES] },
        AND: [
          this.buildUserJoinedOnOrBeforeWhere(asOf),
          {
            OR: [
              {
                accountStatus: AccountStatus.ACTIVE,
                employmentStatus: EmploymentStatus.ACTIVE,
                resignationDate: null
              },
              {
                resignationDate: { gt: asOf }
              }
            ]
          }
        ]
      }
    });
  }

  private async countAdminManagementNewHires(period: WorkforcePeriod) {
    return this.prisma.user.count({
      where: {
        role: { in: [...ADMIN_MANAGEMENT_ROLES] },
        OR: [
          {
            joiningDate: {
              gte: period.from,
              lte: period.to
            }
          },
          {
            joiningDate: null,
            createdAt: {
              gte: period.from,
              lte: period.to
            }
          }
        ]
      }
    });
  }

  private async countAdminManagementExits(period: WorkforcePeriod) {
    return this.prisma.user.count({
      where: {
        role: { in: [...ADMIN_MANAGEMENT_ROLES] },
        resignationDate: {
          gte: period.from,
          lte: period.to
        }
      }
    });
  }

  private buildPickerAssignmentSnapshotWhere(
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ): Prisma.PickerBranchAssignmentWhereInput {
    const and: Prisma.PickerBranchAssignmentWhereInput[] = [
      this.buildAssignmentActiveAtWhere(asOf)
    ];

    if (query.chainId) {
      and.push({ vendor: { chainId: query.chainId } });
    }

    if (query.scopeChainIds) {
      and.push({ vendor: { chainId: { in: query.scopeChainIds } } });
    }

    if (query.vendorId) {
      and.push({ vendorId: query.vendorId });
    }

    if (query.scopeVendorIds) {
      and.push({ vendorId: { in: query.scopeVendorIds } });
    }

    if (query.areaManagerId) {
      and.push({
        vendor: {
          chain: {
            areaManagerAssignments: {
              some: {
                areaManagerId: query.areaManagerId,
                ...this.buildAssignmentActiveAtWhere(asOf)
              }
            }
          }
        }
      });
    }

    if (query.champId) {
      and.push({
        vendor: {
          champAssignments: {
            some: {
              champId: query.champId,
              ...this.buildAssignmentActiveAtWhere(asOf)
            }
          }
        }
      });
    }

    return { AND: and };
  }

  private buildChampAssignmentSnapshotWhere(
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ): Prisma.VendorChampAssignmentWhereInput {
    const and: Prisma.VendorChampAssignmentWhereInput[] = [
      this.buildAssignmentActiveAtWhere(asOf)
    ];

    if (query.chainId) {
      and.push({ vendor: { chainId: query.chainId } });
    }

    if (query.scopeChainIds) {
      and.push({ vendor: { chainId: { in: query.scopeChainIds } } });
    }

    if (query.vendorId) {
      and.push({ vendorId: query.vendorId });
    }

    if (query.scopeVendorIds) {
      and.push({ vendorId: { in: query.scopeVendorIds } });
    }

    if (query.areaManagerId) {
      and.push({
        vendor: {
          chain: {
            areaManagerAssignments: {
              some: {
                areaManagerId: query.areaManagerId,
                ...this.buildAssignmentActiveAtWhere(asOf)
              }
            }
          }
        }
      });
    }

    if (query.champId) {
      and.push({ champId: query.champId });
    }

    return { AND: and };
  }

  private buildAreaManagerAssignmentSnapshotWhere(
    query: ScopedWorkforceSummaryQuery,
    asOf: Date
  ): Prisma.ChainAreaManagerAssignmentWhereInput | null {
    if (query.vendorId || query.champId) {
      return null;
    }

    const and: Prisma.ChainAreaManagerAssignmentWhereInput[] = [
      this.buildAssignmentActiveAtWhere(asOf)
    ];

    if (query.chainId) {
      and.push({ chainId: query.chainId });
    }

    if (query.scopeChainIds) {
      and.push({ chainId: { in: query.scopeChainIds } });
    }

    if (query.areaManagerId) {
      and.push({ areaManagerId: query.areaManagerId });
    }

    return { AND: and };
  }

  private buildLifecycleRequestScopeWhere(
    role: Extract<UserRole, "PICKER" | "CHAMP" | "AREA_MANAGER">,
    query: ScopedWorkforceSummaryQuery
  ): Prisma.RequestWhereInput | null {
    if (role === UserRole.AREA_MANAGER && (query.vendorId || query.champId)) {
      return null;
    }

    const and: Prisma.RequestWhereInput[] = [];

    if (query.chainId) {
      and.push(this.buildRequestChainScopeWhere([query.chainId]));
    }

    if (query.scopeChainIds) {
      and.push(this.buildRequestChainScopeWhere(query.scopeChainIds));
    }

    if (query.vendorId) {
      and.push(this.buildRequestVendorScopeWhere([query.vendorId]));
    }

    if (query.scopeVendorIds) {
      and.push(this.buildRequestVendorScopeWhere(query.scopeVendorIds));
    }

    if (query.areaManagerId) {
      if (role === UserRole.AREA_MANAGER) {
        and.push({ targetUserId: query.areaManagerId });
      } else {
        and.push({
          OR: [
            {
              sourceChain: {
                is: {
                  areaManagerAssignments: {
                    some: {
                      areaManagerId: query.areaManagerId,
                      status: AssignmentStatus.ACTIVE
                    }
                  }
                }
              }
            },
            {
              destinationChain: {
                is: {
                  areaManagerAssignments: {
                    some: {
                      areaManagerId: query.areaManagerId,
                      status: AssignmentStatus.ACTIVE
                    }
                  }
                }
              }
            },
            {
              sourceVendor: {
                is: {
                  chain: {
                    areaManagerAssignments: {
                      some: {
                        areaManagerId: query.areaManagerId,
                        status: AssignmentStatus.ACTIVE
                      }
                    }
                  }
                }
              }
            },
            {
              destinationVendor: {
                is: {
                  chain: {
                    areaManagerAssignments: {
                      some: {
                        areaManagerId: query.areaManagerId,
                        status: AssignmentStatus.ACTIVE
                      }
                    }
                  }
                }
              }
            }
          ]
        });
      }
    }

    if (query.champId) {
      if (role === UserRole.CHAMP) {
        and.push({ targetUserId: query.champId });
      } else {
        and.push({
          OR: [
            {
              sourceVendor: {
                is: {
                  champAssignments: {
                    some: {
                      champId: query.champId,
                      status: AssignmentStatus.ACTIVE
                    }
                  }
                }
              }
            },
            {
              destinationVendor: {
                is: {
                  champAssignments: {
                    some: {
                      champId: query.champId,
                      status: AssignmentStatus.ACTIVE
                    }
                  }
                }
              }
            }
          ]
        });
      }
    }

    return and.length ? { AND: and } : {};
  }

  private buildRequestChainScopeWhere(
    chainIds: string[]
  ): Prisma.RequestWhereInput {
    return {
      OR: [
        { sourceChainId: { in: chainIds } },
        { destinationChainId: { in: chainIds } },
        { sourceVendor: { is: { chainId: { in: chainIds } } } },
        { destinationVendor: { is: { chainId: { in: chainIds } } } }
      ]
    };
  }

  private buildRequestVendorScopeWhere(
    vendorIds: string[]
  ): Prisma.RequestWhereInput {
    return {
      OR: [
        { sourceVendorId: { in: vendorIds } },
        { destinationVendorId: { in: vendorIds } }
      ]
    };
  }

  private buildAssignmentActiveAtWhere(asOf: Date) {
    return {
      startDate: { lte: asOf },
      OR: [{ endDate: null }, { endDate: { gt: asOf } }]
    };
  }

  private buildUserJoinedOnOrBeforeWhere(asOf: Date): Prisma.UserWhereInput {
    return {
      OR: [
        { joiningDate: { lte: asOf } },
        {
          joiningDate: null,
          createdAt: { lte: asOf }
        }
      ]
    };
  }

  private hasOperationalScope(query: WorkforceSummaryQueryDto) {
    return Boolean(
      query.chainId || query.vendorId || query.areaManagerId || query.champId
    );
  }

  private roundWorkforceMetric(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private buildWhere(query: ListUsersQueryDto): Prisma.UserWhereInput {
    const search = query.q?.trim();
    const and: Prisma.UserWhereInput[] = [];

    const roleFilter = this.buildRoleFilter(query);
    if (roleFilter) {
      and.push(roleFilter);
    }

    if (query.status) {
      and.push({ accountStatus: query.status });
    }

    if (search) {
      and.push({
        OR: [
          { nameEn: { contains: search, mode: "insensitive" } },
          { nameAr: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
          { ibsId: { contains: search, mode: "insensitive" } },
          { shopperId: { contains: search, mode: "insensitive" } }
        ]
      });
    }

    const assignmentFilter = this.buildAssignmentScopeFilter(query);
    if (assignmentFilter) {
      and.push(assignmentFilter);
    }

    return and.length ? { AND: and } : {};
  }

  private buildRoleFilter(query: ListUsersQueryDto): Prisma.UserWhereInput | null {
    const roles = this.normalizeRoleList(query.roles);
    if (!roles.length && query.role) {
      roles.push(query.role);
    }

    if (!roles.length) {
      return null;
    }

    if (roles.length === 1) {
      return { role: roles[0] };
    }

    return { role: { in: roles } };
  }

  private normalizeRoleList(roles: ListUsersQueryDto["roles"]): UserRole[] {
    if (!roles) {
      return [];
    }

    if (Array.isArray(roles)) {
      return roles;
    }

    return String(roles)
      .split(",")
      .map((role) => role.trim())
      .filter((role): role is UserRole =>
        Object.values(UserRole).includes(role as UserRole)
      );
  }

  private buildAssignmentScopeFilter(
    query: ListUsersQueryDto
  ): Prisma.UserWhereInput | null {
    const and: Prisma.UserWhereInput[] = [];

    // Filters intentionally use active assignments only. Operational list rows
    // may still display latest historical context when no active assignment exists.

    if (query.chainId) {
      and.push({
        OR: [
          {
            role: UserRole.PICKER,
            pickerBranchAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendor: { chainId: query.chainId }
              }
            }
          },
          {
            role: UserRole.CHAMP,
            vendorChampAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendor: { chainId: query.chainId }
              }
            }
          },
          {
            role: UserRole.AREA_MANAGER,
            chainAreaManagerAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                chainId: query.chainId
              }
            }
          }
        ]
      });
    }

    if (query.vendorId) {
      and.push({
        OR: [
          {
            role: UserRole.PICKER,
            pickerBranchAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendorId: query.vendorId
              }
            }
          },
          {
            role: UserRole.CHAMP,
            vendorChampAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendorId: query.vendorId
              }
            }
          }
        ]
      });
    }

    if (query.areaManagerId) {
      and.push({
        OR: [
          {
            role: UserRole.PICKER,
            pickerBranchAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendor: {
                  chain: {
                    areaManagerAssignments: {
                      some: {
                        areaManagerId: query.areaManagerId,
                        status: AssignmentStatus.ACTIVE
                      }
                    }
                  }
                }
              }
            }
          },
          {
            role: UserRole.CHAMP,
            vendorChampAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendor: {
                  chain: {
                    areaManagerAssignments: {
                      some: {
                        areaManagerId: query.areaManagerId,
                        status: AssignmentStatus.ACTIVE
                      }
                    }
                  }
                }
              }
            }
          },
          {
            role: UserRole.AREA_MANAGER,
            id: query.areaManagerId
          }
        ]
      });
    }

    if (query.champId) {
      and.push({
        OR: [
          {
            role: UserRole.PICKER,
            pickerBranchAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                vendor: {
                  champAssignments: {
                    some: {
                      champId: query.champId,
                      status: AssignmentStatus.ACTIVE
                    }
                  }
                }
              }
            }
          },
          {
            role: UserRole.CHAMP,
            id: query.champId
          }
        ]
      });
    }

    return and.length ? { AND: and } : null;
  }

  private async getPickerForProfileCompletion(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException("Current user was not found.");
    }

    if (user.role !== UserRole.PICKER) {
      throw new BadRequestException(
        "Profile completion is only available for Pickers."
      );
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new BadRequestException("Picker account must be active.");
    }

    return user;
  }

  private toProfileCompletionResponse(user: User) {
    const missingFields = this.getMissingProfileFields(user);

    return {
      user: toSafeUser(user),
      profileCompletion: {
        status: user.profileStatus,
        requiredFields: [...REQUIRED_PICKER_PROFILE_FIELDS],
        missingFields,
        complete: missingFields.length === 0 && user.profileStatus === ProfileStatus.COMPLETE
      },
      allowedFields: [
        "nameEn",
        "nameAr",
        "nationalId",
        "address",
        "dateOfBirth",
        "gender"
      ]
    };
  }

  private getMissingProfileFields(
    user: Pick<User, "nationalId" | "address" | "dateOfBirth">
  ) {
    return REQUIRED_PICKER_PROFILE_FIELDS.filter((field) => !user[field]);
  }
}
