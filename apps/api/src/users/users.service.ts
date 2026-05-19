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
  AssignmentStatus,
  ChainStatus,
  Prisma,
  ProfileStatus,
  User,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateAdminProfileDto } from "./dto/admin-profile.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { UpdateProfileCompletionDto } from "./dto/profile-completion.dto";
import { toSafeUser, type SafeUserDto } from "./dto/safe-user.dto";
import type { UpdateUserPreferencesDto } from "./dto/user-preferences.dto";
import { TemporaryPasswordService } from "./temporary-password.service";

const MAX_PAGE_SIZE = 100;
const PASSWORD_HASH_ROUNDS = 12;
const TEMPORARY_PASSWORD_EXPIRY_HOURS = 72;
const REQUIRED_PICKER_PROFILE_FIELDS = [
  "nationalId",
  "address",
  "dateOfBirth"
] as const;

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
          areaManager: context.areaManager
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
      recentRequests,
      activity
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
        take: 6
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: "User", entityId: user.id },
            { actorUserId: user.id }
          ]
        },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    ]);

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
      areaManagerAssignments
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
    const contexts = new Map<string, OperationalListContext>();

    for (const user of users) {
      if (user.role === UserRole.PICKER) {
        const assignment = this.selectDisplayAssignment(
          pickerAssignmentsByUserId.get(user.id)
        );

        if (!assignment) {
          contexts.set(user.id, this.emptyOperationalContext(user));
          continue;
        }

        const champ = assignment.vendor.champAssignments[0]?.champ ?? null;
        contexts.set(user.id, {
          key: assignment.id,
          assignment: this.toAssignmentSummary(assignment),
          vendor: this.toVendorSummary(assignment.vendor),
          chain: this.toChainSummary(assignment.vendor.chain),
          champ: champ ? this.toUserSummary(champ) : null,
          areaManager: null
        });
        continue;
      }

      if (user.role === UserRole.CHAMP) {
        const assignment = this.selectDisplayAssignment(
          champAssignmentsByUserId.get(user.id)
        );

        if (!assignment) {
          contexts.set(user.id, this.emptyOperationalContext(user));
          continue;
        }

        contexts.set(user.id, {
          key: assignment.id,
          assignment: this.toAssignmentSummary(assignment),
          vendor: this.toVendorSummary(assignment.vendor),
          chain: this.toChainSummary(assignment.vendor.chain),
          champ: this.toUserSummary(user),
          areaManager: null
        });
        continue;
      }

      if (user.role === UserRole.AREA_MANAGER) {
        const assignment = this.selectDisplayAssignment(
          areaManagerAssignmentsByUserId.get(user.id)
        );

        if (!assignment) {
          contexts.set(user.id, this.emptyOperationalContext(user));
          continue;
        }

        contexts.set(user.id, {
          key: assignment.id,
          assignment: this.toAssignmentSummary(assignment),
          vendor: null,
          chain: this.toChainSummary(assignment.chain),
          champ: null,
          areaManager: this.toUserSummary(user)
        });
      }
    }

    return contexts;
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

  private emptyOperationalContext(user: User): OperationalListContext {
    return {
      key: user.id,
      assignment: null,
      vendor: null,
      chain: null,
      champ: user.role === UserRole.CHAMP ? this.toUserSummary(user) : null,
      areaManager:
        user.role === UserRole.AREA_MANAGER ? this.toUserSummary(user) : null
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
