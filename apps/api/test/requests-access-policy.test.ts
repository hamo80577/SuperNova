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
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
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
  detail: { id: "request-1" }
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

  assert.equal(await controller.list(listQuery, champ), responses.list);
  assert.equal(
    await controller.listSubmitted(submittedQuery, champ),
    responses.submitted
  );
  assert.equal(await controller.getById("request-1", champ), responses.detail);

  assert.deepEqual(policyCalls, [
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW }
  ]);
  assert.deepEqual(serviceCalls, [
    `list:2:none:${champ.id}`,
    `submitted:3:none:${champ.id}`,
    `detail:request-1:${champ.id}`
  ]);
}

void run();
