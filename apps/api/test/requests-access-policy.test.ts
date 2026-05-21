import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  RequestType,
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
import type { CreateNewHireRequestDto } from "../src/requests/dto/create-new-hire-request.dto";
import type { CreateOffboardingRequestDto } from "../src/requests/dto/create-offboarding-request.dto";
import type { CreateTransferRequestDto } from "../src/requests/dto/create-transfer-request.dto";
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
  cancel: { id: "request-3", status: "CANCELLED" },
  newHire: { id: "request-4", type: "NEW_HIRE" },
  offboarding: { id: "request-5", type: "RESIGNATION" },
  transfer: { id: "request-6", type: "TRANSFER" }
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
  },
  createNewHire: async (
    dto: CreateNewHireRequestDto,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `newHire:${dto.targetRole ?? "missing"}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.newHire;
  },
  createOffboarding: async (
    dto: CreateOffboardingRequestDto,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `offboarding:${dto.targetRole ?? "missing"}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.offboarding;
  },
  createTransfer: async (
    dto: CreateTransferRequestDto,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `transfer:${dto.targetUserId}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.transfer;
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

function newHireDto(targetRole?: UserRole): CreateNewHireRequestDto {
  const dto: CreateNewHireRequestDto = {
    phoneNumber: "01012345678",
    nationalId: "12345678901234"
  };

  if (targetRole) {
    dto.targetRole = targetRole;
  }

  return dto;
}

function offboardingDto(targetRole?: UserRole): CreateOffboardingRequestDto {
  const dto: CreateOffboardingRequestDto = {
    type: RequestType.RESIGNATION,
    targetUserId: "target-user-1",
    reasonCode: "VOLUNTARY_QUIT",
    resignationDate: "2026-06-01"
  };

  if (targetRole) {
    dto.targetRole = targetRole;
  }

  return dto;
}

function transferDto(): CreateTransferRequestDto {
  return {
    sourceVendorId: "source-branch-1",
    targetUserId: "picker-1",
    destinationVendorId: "destination-branch-1",
    reason: "Operational move"
  };
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
  assert.equal(
    await controller.createNewHire(newHireDto(), champ, request),
    responses.newHire
  );
  assert.equal(
    await controller.createNewHire(newHireDto(UserRole.PICKER), champ, request),
    responses.newHire
  );
  assert.equal(
    await controller.createNewHire(newHireDto(UserRole.CHAMP), champ, request),
    responses.newHire
  );
  assert.equal(
    await controller.createNewHire(
      newHireDto(UserRole.AREA_MANAGER),
      champ,
      request
    ),
    responses.newHire
  );
  assert.equal(
    await controller.createOffboarding(offboardingDto(), champ, request),
    responses.offboarding
  );
  assert.equal(
    await controller.createOffboarding(
      offboardingDto(UserRole.PICKER),
      champ,
      request
    ),
    responses.offboarding
  );
  assert.equal(
    await controller.createOffboarding(
      offboardingDto(UserRole.CHAMP),
      champ,
      request
    ),
    responses.offboarding
  );
  assert.equal(
    await controller.createOffboarding(
      offboardingDto(UserRole.AREA_MANAGER),
      champ,
      request
    ),
    responses.offboarding
  );
  assert.equal(
    await controller.createTransfer(transferDto(), champ, request),
    responses.transfer
  );

  assert.deepEqual(policyCalls, [
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_CANCEL },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
    }
  ]);
  assert.deepEqual(serviceCalls, [
    `list:2:none:${champ.id}`,
    `submitted:3:none:${champ.id}`,
    `detail:request-1:${champ.id}`,
    `submit:request-2:${champ.id}:127.0.0.1:requests-policy-test`,
    `cancel:request-3:No longer needed:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:missing:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:PICKER:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:CHAMP:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:AREA_MANAGER:${champ.id}:127.0.0.1:requests-policy-test`,
    `offboarding:missing:${champ.id}:127.0.0.1:requests-policy-test`,
    `offboarding:PICKER:${champ.id}:127.0.0.1:requests-policy-test`,
    `offboarding:CHAMP:${champ.id}:127.0.0.1:requests-policy-test`,
    `offboarding:AREA_MANAGER:${champ.id}:127.0.0.1:requests-policy-test`,
    `transfer:picker-1:${champ.id}:127.0.0.1:requests-policy-test`
  ]);
}

void run();
