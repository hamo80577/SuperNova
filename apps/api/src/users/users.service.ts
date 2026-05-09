import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  Prisma,
  ProfileStatus,
  User,
  UserRole
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { UpdateProfileCompletionDto } from "./dto/profile-completion.dto";
import { toSafeUser } from "./dto/safe-user.dto";

const MAX_PAGE_SIZE = 100;
const REQUIRED_PICKER_PROFILE_FIELDS = [
  "nationalId",
  "address",
  "dateOfBirth",
  "joiningDate"
] as const;

@Injectable()
export class UsersService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService
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

  async getSafeCurrentUser(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      return null;
    }

    return toSafeUser(user);
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
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : user.joiningDate,
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
          joiningDate: mergedProfile.joiningDate,
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

  private buildWhere(query: ListUsersQueryDto): Prisma.UserWhereInput {
    const search = query.q?.trim();

    return {
      role: query.role,
      accountStatus: query.status,
      ...(search
        ? {
            OR: [
              { nameEn: { contains: search, mode: "insensitive" } },
              { nameAr: { contains: search, mode: "insensitive" } },
              { phoneNumber: { contains: search, mode: "insensitive" } },
              { ibsId: { contains: search, mode: "insensitive" } },
              { shopperId: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };
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
        "gender",
        "joiningDate"
      ]
    };
  }

  private getMissingProfileFields(
    user: Pick<User, "nationalId" | "address" | "dateOfBirth" | "joiningDate">
  ) {
    return REQUIRED_PICKER_PROFILE_FIELDS.filter((field) => !user[field]);
  }
}
