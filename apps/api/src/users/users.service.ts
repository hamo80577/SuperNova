import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { toSafeUser } from "./dto/safe-user.dto";

const MAX_PAGE_SIZE = 100;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
}
