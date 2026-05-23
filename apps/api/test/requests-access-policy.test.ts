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
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedRequest } from "../src/auth/types/authenticated-request";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import type { CancelRequestDto } from "../src/requests/dto/cancel-request.dto";
import type { CreateNewHireRequestDto } from "../src/requests/dto/create-new-hire-request.dto";
import type { CreateOffboardingRequestDto } from "../src/requests/dto/create-offboarding-request.dto";
import type { CreateTransferRequestDto } from "../src/requests/dto/create-transfer-request.dto";
import type { FinalizeNewHireDto } from "../src/requests/dto/finalize-new-hire.dto";
import type { FinalizeOffboardingDto } from "../src/requests/dto/finalize-offboarding.dto";
import type { ListRequestsQueryDto } from "../src/requests/dto/list-requests-query.dto";
import type { LookupNewHireCandidateDto } from "../src/requests/dto/lookup-new-hire-candidate.dto";
import type { SearchOffboardingPickersDto } from "../src/requests/dto/search-offboarding-pickers.dto";
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
  offboardingPickers: { items: [{ id: "picker-1" }] },
  offboardingEligibleUsers: { items: [{ id: "eligible-user-1" }] },
  newHireLookup: { candidate: null },
  submit: { id: "request-2", status: "PENDING_AREA_MANAGER" },
  cancel: { id: "request-3", status: "CANCELLED" },
  newHire: { id: "request-4", type: "NEW_HIRE" },
  offboarding: { id: "request-5", type: "RESIGNATION" },
  transfer: { id: "request-6", type: "TRANSFER" },
  finalizeNewHire: { id: "request-7", status: "COMPLETED" },
  finalizeOffboarding: { id: "request-8", status: "COMPLETED" }
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
  searchOffboardingPickers: async (
    query: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) => {
    serviceCalls.push(
      `offboarding-pickers:${query.targetRole ?? "missing"}:${query.q ?? "none"}:${currentUser.id}`
    );
    return responses.offboardingPickers;
  },
  searchOffboardingEligibleUsers: async (
    query: SearchOffboardingPickersDto,
    currentUser: AuthenticatedUser
  ) => {
    serviceCalls.push(
      `offboarding-eligible:${query.targetRole ?? "missing"}:${query.q ?? "none"}:${currentUser.id}`
    );
    return responses.offboardingEligibleUsers;
  },
  lookupNewHireCandidate: async (
    dto: LookupNewHireCandidateDto,
    currentUser: AuthenticatedUser
  ) => {
    serviceCalls.push(
      `new-hire-lookup:${dto.targetRole ?? "missing"}:${dto.phoneNumber ?? "none"}:${currentUser.id}`
    );
    return responses.newHireLookup;
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
  },
  finalizeNewHire: async (
    requestId: string,
    dto: FinalizeNewHireDto,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `finalizeNewHire:${requestId}:${dto.shopperId ?? "none"}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.finalizeNewHire;
  },
  finalizeOffboarding: async (
    requestId: string,
    dto: FinalizeOffboardingDto,
    context: {
      actor: AuthenticatedUser;
      ipAddress?: string;
      userAgent?: string | null;
    }
  ) => {
    serviceCalls.push(
      `finalizeOffboarding:${requestId}:${dto.confirmInternalDeactivation}:${dto.notes ?? "none"}:${context.actor.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.finalizeOffboarding;
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

function createController(policy: AccessPolicyService = recordingPolicy) {
  return Reflect.construct(RequestsController, [
    requestsService,
    policy
  ]) as RequestsController;
}

function rolesFor(methodName: keyof RequestsController) {
  return Reflect.getMetadata(ROLES_KEY, RequestsController.prototype[methodName]);
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
  const admin = actor(UserRole.ADMIN);
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
  const finalizeNewHireDto = {
    shopperId: "SHOPPER-1"
  } satisfies FinalizeNewHireDto;
  const finalizeOffboardingDto = {
    confirmInternalDeactivation: true,
    notes: "Confirmed"
  } satisfies FinalizeOffboardingDto;

  assert.equal(await controller.list(listQuery, champ), responses.list);
  assert.equal(
    await controller.listSubmitted(submittedQuery, champ),
    responses.submitted
  );
  assert.equal(
    await controller.searchOffboardingPickers({ q: "pi" }, champ),
    responses.offboardingPickers
  );
  assert.equal(
    await controller.searchOffboardingPickers(
      { targetRole: UserRole.CHAMP, q: "ch" },
      admin
    ),
    responses.offboardingPickers
  );
  assert.equal(
    await controller.searchOffboardingPickers(
      { targetRole: UserRole.AREA_MANAGER, q: "am" },
      admin
    ),
    responses.offboardingPickers
  );
  assert.equal(
    await controller.searchOffboardingEligibleUsers({ q: "pi" }, champ),
    responses.offboardingEligibleUsers
  );
  assert.equal(
    await controller.searchOffboardingEligibleUsers(
      { targetRole: UserRole.CHAMP, q: "ch" },
      admin
    ),
    responses.offboardingEligibleUsers
  );
  assert.equal(
    await controller.searchOffboardingEligibleUsers(
      { targetRole: UserRole.AREA_MANAGER, q: "am" },
      admin
    ),
    responses.offboardingEligibleUsers
  );
  assert.equal(await controller.getById("request-1", champ), responses.detail);
  assert.equal(
    await controller.lookupNewHireCandidate({ phoneNumber: "01012345678" }, champ),
    responses.newHireLookup
  );
  assert.equal(
    await controller.lookupNewHireCandidate(
      { targetRole: UserRole.PICKER, phoneNumber: "01012345678" },
      champ
    ),
    responses.newHireLookup
  );
  assert.equal(
    await controller.lookupNewHireCandidate(
      { targetRole: UserRole.CHAMP, phoneNumber: "01012345678" },
      admin
    ),
    responses.newHireLookup
  );
  assert.equal(
    await controller.lookupNewHireCandidate(
      { targetRole: UserRole.AREA_MANAGER, phoneNumber: "01012345678" },
      admin
    ),
    responses.newHireLookup
  );
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
    await controller.createNewHire(newHireDto(), admin, request),
    responses.newHire
  );
  assert.equal(
    await controller.createNewHire(newHireDto(UserRole.PICKER), admin, request),
    responses.newHire
  );
  assert.equal(
    await controller.createNewHire(newHireDto(UserRole.CHAMP), admin, request),
    responses.newHire
  );
  assert.equal(
    await controller.createNewHire(
      newHireDto(UserRole.AREA_MANAGER),
      admin,
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
    await controller.createOffboarding(offboardingDto(), admin, request),
    responses.offboarding
  );
  assert.equal(
    await controller.createOffboarding(
      offboardingDto(UserRole.PICKER),
      admin,
      request
    ),
    responses.offboarding
  );
  assert.equal(
    await controller.createOffboarding(
      offboardingDto(UserRole.CHAMP),
      admin,
      request
    ),
    responses.offboarding
  );
  assert.equal(
    await controller.createOffboarding(
      offboardingDto(UserRole.AREA_MANAGER),
      admin,
      request
    ),
    responses.offboarding
  );
  assert.equal(
    await controller.createTransfer(transferDto(), champ, request),
    responses.transfer
  );
  assert.equal(
    await controller.finalizeNewHire(
      "request-7",
      finalizeNewHireDto,
      admin,
      request
    ),
    responses.finalizeNewHire
  );
  assert.equal(
    await controller.finalizeOffboarding(
      "request-8",
      finalizeOffboardingDto,
      admin,
      request
    ),
    responses.finalizeOffboarding
  );

  assert.deepEqual(policyCalls, [
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER
    },
    { actor: champ, permissionKey: PermissionKeys.REQUESTS_VIEW },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER
    },
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
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP
    },
    {
      actor: admin,
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
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
    }
  ]);
  assert.deepEqual(serviceCalls, [
    `list:2:none:${champ.id}`,
    `submitted:3:none:${champ.id}`,
    `offboarding-pickers:missing:pi:${champ.id}`,
    `offboarding-pickers:CHAMP:ch:${admin.id}`,
    `offboarding-pickers:AREA_MANAGER:am:${admin.id}`,
    `offboarding-eligible:missing:pi:${champ.id}`,
    `offboarding-eligible:CHAMP:ch:${admin.id}`,
    `offboarding-eligible:AREA_MANAGER:am:${admin.id}`,
    `detail:request-1:${champ.id}`,
    `new-hire-lookup:missing:01012345678:${champ.id}`,
    `new-hire-lookup:PICKER:01012345678:${champ.id}`,
    `new-hire-lookup:CHAMP:01012345678:${admin.id}`,
    `new-hire-lookup:AREA_MANAGER:01012345678:${admin.id}`,
    `submit:request-2:${champ.id}:127.0.0.1:requests-policy-test`,
    `cancel:request-3:No longer needed:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:missing:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:PICKER:${champ.id}:127.0.0.1:requests-policy-test`,
    `newHire:missing:${admin.id}:127.0.0.1:requests-policy-test`,
    `newHire:PICKER:${admin.id}:127.0.0.1:requests-policy-test`,
    `newHire:CHAMP:${admin.id}:127.0.0.1:requests-policy-test`,
    `newHire:AREA_MANAGER:${admin.id}:127.0.0.1:requests-policy-test`,
    `offboarding:missing:${champ.id}:127.0.0.1:requests-policy-test`,
    `offboarding:PICKER:${champ.id}:127.0.0.1:requests-policy-test`,
    `offboarding:missing:${admin.id}:127.0.0.1:requests-policy-test`,
    `offboarding:PICKER:${admin.id}:127.0.0.1:requests-policy-test`,
    `offboarding:CHAMP:${admin.id}:127.0.0.1:requests-policy-test`,
    `offboarding:AREA_MANAGER:${admin.id}:127.0.0.1:requests-policy-test`,
    `transfer:picker-1:${champ.id}:127.0.0.1:requests-policy-test`,
    `finalizeNewHire:request-7:SHOPPER-1:${admin.id}:127.0.0.1:requests-policy-test`,
    `finalizeOffboarding:request-8:true:Confirmed:${admin.id}:127.0.0.1:requests-policy-test`
  ]);
  assert.deepEqual(rolesFor("searchOffboardingPickers"), [
    UserRole.CHAMP,
    UserRole.AREA_MANAGER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("searchOffboardingEligibleUsers"), [
    UserRole.CHAMP,
    UserRole.AREA_MANAGER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("lookupNewHireCandidate"), [
    UserRole.CHAMP,
    UserRole.AREA_MANAGER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("finalizeNewHire"), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("finalizeOffboarding"), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);

  const realPolicyController = createController(new AccessPolicyService());
  serviceCalls.length = 0;

  await assert.rejects(
    async () =>
      realPolicyController.searchOffboardingPickers(
        { targetRole: UserRole.CHAMP },
        champ
      ),
    /Missing required permission/
  );
  await assert.rejects(
    async () =>
      realPolicyController.searchOffboardingEligibleUsers(
        { targetRole: UserRole.AREA_MANAGER },
        champ
      ),
    /Missing required permission/
  );
  await assert.rejects(
    async () =>
      realPolicyController.lookupNewHireCandidate(
        { targetRole: UserRole.CHAMP },
        champ
      ),
    /Missing required permission/
  );
  await assert.rejects(
    async () =>
      realPolicyController.createNewHire(
        newHireDto(UserRole.CHAMP),
        champ,
        request
      ),
    /Missing required permission/
  );
  await assert.rejects(
    async () =>
      realPolicyController.createNewHire(
        newHireDto(UserRole.AREA_MANAGER),
        champ,
        request
      ),
    /Missing required permission/
  );
  await assert.rejects(
    async () =>
      realPolicyController.createOffboarding(
        offboardingDto(UserRole.CHAMP),
        champ,
        request
      ),
    /Missing required permission/
  );
  await assert.rejects(
    async () =>
      realPolicyController.createOffboarding(
        offboardingDto(UserRole.AREA_MANAGER),
        champ,
        request
      ),
    /Missing required permission/
  );
  assert.deepEqual(serviceCalls, []);
}

void run();
