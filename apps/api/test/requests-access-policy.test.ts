import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import {
  AccessPolicyService,
  PermissionKeys,
  type PermissionKey
} from "../src/access-control";
import type { AuthenticatedRequest } from "../src/auth/types/authenticated-request";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import type { CancelRequestDto } from "../src/requests/dto/cancel-request.dto";
import type { ListRequestsQueryDto } from "../src/requests/dto/list-requests-query.dto";
import { RequestsController } from "../src/requests/requests.controller";
import type { RequestsService } from "../src/requests/requests.service";

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
  list: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
  submitted: {
    items: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 }
  },
  detail: { id: "request-1" },
  submit: { id: "request-2", status: "PENDING_AREA_MANAGER" },
  cancel: { id: "request-3", status: "CANCELLED" }
};

const requestsService = {
  list: async (query: ListRequestsQueryDto, currentUser: AuthenticatedUser) => {
    serviceCalls.push(`list:${query.page}:${query.type ?? "none"}:${currentUser.id}`);
    return responses.list;
  },
  listSubmitted: async (
    query: ListRequestsQueryDto,
    currentUser: AuthenticatedUser
  ) => {
    serviceCalls.push(
      `submitted:${query.page}:${query.status ?? "none"}:${currentUser.id}`
    );
    return responses.submitted;
  },
  getById: async (requestId: string, currentUser: AuthenticatedUser) => {
    serviceCalls.push(`detail:${requestId}:${currentUser.id}`);
    return responses.detail;
  },
  submit: async (
    requestId: string,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `submit:${requestId}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.submit;
  },
  cancel: async (
    requestId: string,
    dto: CancelRequestDto,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `cancel:${requestId}:${dto.notes ?? "none"}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.cancel;
  }
} as unknown as RequestsService;

const policyCalls: Array<{
  actor: AuthenticatedUser;
  permissionKey: PermissionKey;
}> = [];

const recordingPolicy = {
  assertCan: (policyActor: AuthenticatedUser, permissionKey: PermissionKey) => {
    policyCalls.push({ actor: policyActor, permissionKey });
  }
} as AccessPolicyService;

function createController() {
  return Reflect.construct(RequestsController, [
    requestsService,
    recordingPolicy
  ]) as RequestsController;
}

async function run() {
  const controller = createController();
  const champ = actor(UserRole.CHAMP);
  const listQuery = { page: 2, type: undefined } satisfies ListRequestsQueryDto;
  const submittedQuery = {
    page: 3,
    status: undefined
  } satisfies ListRequestsQueryDto;
  const request = {
    ip: "127.0.0.1",
    headers: { "user-agent": "requests-policy-test" }
  } as AuthenticatedRequest;
  const cancelDto = { notes: "No longer needed" } satisfies CancelRequestDto;

  assert.equal(await controller.list(listQuery, champ), responses.list);
  assert.equal(
    await controller.listSubmitted(submittedQuery, champ),
    responses.submitted
  );
  assert.equal(await controller.getById("request-1", champ), responses.detail);
  assert.equal(await controller.submit("request-2", champ, request), responses.submit);
  assert.equal(
    await controller.cancel("request-3", cancelDto, champ, request),
    responses.cancel
  );

  assert.deepEqual(policyCalls, [
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_CANCEL }
  ]);
  assert.deepEqual(serviceCalls, [
    `list:2:none:${champ.id}`,
    `submitted:3:none:${champ.id}`,
    `detail:request-1:${champ.id}`,
    `submit:request-2:${champ.id}:127.0.0.1:requests-policy-test`,
    `cancel:request-3:No longer needed:${champ.id}:127.0.0.1:requests-policy-test`
  ]);
}

void run();
