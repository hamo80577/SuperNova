import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";

const MAX_PAGE_SIZE = 100;

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getFoundationStatus() {
    return {
      module: "notifications",
      status: "active",
      note: "In-app request and approval notifications are enabled."
    };
  }

  async create(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        payload: params.payload
      }
    });
  }

  async createForUsers(
    userIds: string[],
    params: {
      type: string;
      title: string;
      body: string;
      payload?: Prisma.InputJsonValue;
    }
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (!uniqueUserIds.length) {
      return { count: 0 };
    }

    return this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        payload: params.payload
      }))
    });
  }

  async notifyAdmins(params: {
    type: string;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
        accountStatus: "ACTIVE"
      },
      select: { id: true }
    });

    return this.createForUsers(
      admins.map((admin) => admin.id),
      params
    );
  }

  async listForUser(userId: string, query: ListNotificationsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {})
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      throw new NotFoundException("Notification was not found.");
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() }
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() }
    });
  }
}
