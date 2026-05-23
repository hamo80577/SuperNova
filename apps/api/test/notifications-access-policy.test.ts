import assert from "node:assert/strict";

import { GUARDS_METADATA } from "@nestjs/common/constants";
import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import {
  PermissionGuard,
  PermissionKeys,
  REQUIRED_PERMISSION_KEY
} from "../src/access-control";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import { NotificationsController } from "../src/notifications/notifications.controller";
import type { ListNotificationsQueryDto } from "../src/notifications/dto/list-notifications-query.dto";
import type { NotificationsService } from "../src/notifications/notifications.service";

function actor(role: UserRole): AuthenticatedUser {
  return {
    id: `actor-${role.toLowerCase()}`,
    role,
    nameEn: role,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

const serviceCalls: string[] = [];
const responses = {
  status: {
    module: "notifications",
    status: "active",
    note: "In-app request and approval notifications are enabled."
  },
  list: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
  markRead: { id: "notification-1", readAt: new Date("2026-05-21T00:00:00Z") },
  markAllRead: { count: 3 }
};

const notificationsService = {
  getFoundationStatus: () => {
    serviceCalls.push("status");
    return responses.status;
  },
  listForUser: async (userId: string, query: ListNotificationsQueryDto) => {
    serviceCalls.push(`list:${userId}:${query.page}:${query.unreadOnly}`);
    return responses.list;
  },
  markRead: async (userId: string, notificationId: string) => {
    serviceCalls.push(`mark-read:${userId}:${notificationId}`);
    return responses.markRead;
  },
  markAllRead: async (userId: string) => {
    serviceCalls.push(`mark-all-read:${userId}`);
    return responses.markAllRead;
  }
} as unknown as NotificationsService;

function requiredPermissionFor(methodName: keyof NotificationsController) {
  return Reflect.getMetadata(
    REQUIRED_PERMISSION_KEY,
    NotificationsController.prototype[methodName]
  );
}

function guardsFor(methodName: keyof NotificationsController) {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    NotificationsController.prototype[methodName]
  );
}

async function run() {
  assert.equal(
    requiredPermissionFor("list"),
    PermissionKeys.NOTIFICATIONS_VIEW
  );
  assert.equal(
    requiredPermissionFor("markRead"),
    PermissionKeys.NOTIFICATIONS_MANAGE_OWN
  );
  assert.equal(
    requiredPermissionFor("markAllRead"),
    PermissionKeys.NOTIFICATIONS_MANAGE_OWN
  );
  assert.equal(requiredPermissionFor("getStatus"), undefined);

  assert.deepEqual(guardsFor("list"), [JwtAuthGuard, PermissionGuard]);
  assert.deepEqual(guardsFor("markRead"), [JwtAuthGuard, PermissionGuard]);
  assert.deepEqual(guardsFor("markAllRead"), [JwtAuthGuard, PermissionGuard]);
  assert.equal(guardsFor("getStatus"), undefined);

  const controller = new NotificationsController(notificationsService);
  const champ = actor(UserRole.CHAMP);
  const query = { page: 2, unreadOnly: true } satisfies ListNotificationsQueryDto;

  assert.equal(controller.getStatus(), responses.status);
  assert.equal(await controller.list(champ, query), responses.list);
  assert.equal(
    await controller.markRead(champ, "notification-1"),
    responses.markRead
  );
  assert.equal(await controller.markAllRead(champ), responses.markAllRead);

  assert.deepEqual(serviceCalls, [
    "status",
    `list:${champ.id}:2:true`,
    `mark-read:${champ.id}:notification-1`,
    `mark-all-read:${champ.id}`
  ]);
}

void run();
