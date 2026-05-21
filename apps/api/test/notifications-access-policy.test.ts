import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import {
  AccessPolicyService,
  PermissionKeys,
  type PermissionKey
} from "../src/access-control";
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

const policyCalls: Array<{
  actor: AuthenticatedUser;
  permissionKey: PermissionKey;
}> = [];

const recordingPolicy = {
  assertCan: (policyActor: AuthenticatedUser, permissionKey: PermissionKey) => {
    policyCalls.push({ actor: policyActor, permissionKey });
  }
} as AccessPolicyService;

async function run() {
  const controller = new NotificationsController(
    notificationsService,
    recordingPolicy
  );
  const champ = actor(UserRole.CHAMP);
  const query = { page: 2, unreadOnly: true } satisfies ListNotificationsQueryDto;

  assert.equal(controller.getStatus(), responses.status);
  assert.equal(await controller.list(champ, query), responses.list);
  assert.equal(
    await controller.markRead(champ, "notification-1"),
    responses.markRead
  );
  assert.equal(await controller.markAllRead(champ), responses.markAllRead);

  assert.deepEqual(policyCalls, [
    { actor: champ, permissionKey: PermissionKeys.NOTIFICATIONS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.NOTIFICATIONS_MANAGE_OWN },
    { actor: champ, permissionKey: PermissionKeys.NOTIFICATIONS_MANAGE_OWN }
  ]);

  assert.deepEqual(serviceCalls, [
    "status",
    `list:${champ.id}:2:true`,
    `mark-read:${champ.id}:notification-1`,
    `mark-all-read:${champ.id}`
  ]);

  const realPolicyController = new NotificationsController(
    notificationsService,
    new AccessPolicyService()
  );

  for (const role of Object.values(UserRole)) {
    const roleActor = actor(role);

    await assert.doesNotReject(() =>
      realPolicyController.list(roleActor, query)
    );
    await assert.doesNotReject(() =>
      realPolicyController.markRead(roleActor, "notification-1")
    );
    await assert.doesNotReject(() =>
      realPolicyController.markAllRead(roleActor)
    );
  }
}

void run();
