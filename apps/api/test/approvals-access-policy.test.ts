import assert from "node:assert/strict";

import { GUARDS_METADATA } from "@nestjs/common/constants";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  EmploymentStatus,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import {
  AccessPolicyService,
  PermissionGuard,
  PermissionKeys,
  REQUIRED_PERMISSION_KEY,
  type PermissionKey
} from "../src/access-control";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { ApprovalsController } from "../src/approvals/approvals.controller";
import { ApprovalsService } from "../src/approvals/approvals.service";
import type { ApprovalDecisionDto } from "../src/approvals/dto/approval-decision.dto";
import type { AuditService } from "../src/audit/audit.service";
import type { NotificationsService } from "../src/notifications/notifications.service";
import type { PrismaService } from "../src/prisma/prisma.service";
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

const areaManager = actor(UserRole.AREA_MANAGER);
const admin = actor(UserRole.ADMIN);
const champ = actor(UserRole.CHAMP);

const policyCalls: Array<{
  actor: AuthenticatedUser;
  permissionKey: PermissionKey;
}> = [];
const events: string[] = [];
const delegateEvents: string[] = [];
const mutationEvents: string[] = [];
const auditEvents: string[] = [];
const notificationEvents: string[] = [];
const approvalsById = new Map<string, any>();

let allowDecision = true;
let findManyApprovals: any[] = [];
let activeApproval: any = null;

const recordingPolicy = {
  assertCan(actorValue: AuthenticatedUser, permissionKey: PermissionKey) {
    policyCalls.push({ actor: actorValue, permissionKey });
    events.push(`policy:${permissionKey}`);
  }
} as unknown as AccessPolicyService;

function reset() {
  policyCalls.length = 0;
  events.length = 0;
  delegateEvents.length = 0;
  mutationEvents.length = 0;
  auditEvents.length = 0;
  notificationEvents.length = 0;
  approvalsById.clear();
  findManyApprovals = [];
  activeApproval = null;
  allowDecision = true;
}

function statusForStep(step: ApprovalStep): RequestStatus {
  if (
    step === ApprovalStep.AREA_MANAGER_APPROVAL ||
    step === ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL
  ) {
    return RequestStatus.PENDING_AREA_MANAGER;
  }

  if (step === ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL) {
    return RequestStatus.PENDING_DESTINATION_AREA_MANAGER;
  }

  return RequestStatus.PENDING_ADMIN;
}

function user(role: UserRole, id = `user-${role.toLowerCase()}`) {
  return {
    id,
    ibsId: null,
    shopperId: null,
    role,
    nameEn: role,
    nameAr: null,
    phoneNumber: `010${id.replaceAll("-", "").slice(0, 8).padEnd(8, "0")}`,
    nationalId: null,
    address: null,
    dateOfBirth: null,
    gender: "UNSPECIFIED",
    uiTheme: "ORANGE",
    joiningDate: null,
    employmentStatus: EmploymentStatus.ACTIVE,
    resignationDate: null,
    accountStatus: AccountStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: "NO_BLOCK",
    blockedUntil: null,
    blockReason: null,
    passwordHash: "redacted",
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

function requestFor(step: ApprovalStep, type: RequestType) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: `request-${step.toLowerCase()}-${type.toLowerCase()}`,
    type,
    status: statusForStep(step),
    createdById: "creator-1",
    targetUserId: null,
    sourceChainId: "chain-source",
    sourceVendorId: null,
    destinationChainId: "chain-destination",
    destinationVendorId: null,
    payload: null,
    currentStep: step,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: user(UserRole.CHAMP, "creator-1"),
    targetUser: null,
    sourceChain: null,
    sourceVendor: null,
    destinationChain: null,
    destinationVendor: null,
    approvals: []
  };
}

function approvalFor(step: ApprovalStep, type: RequestType) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const request = requestFor(step, type);
  const approval = {
    id: `approval-${step.toLowerCase()}-${type.toLowerCase()}`,
    requestId: request.id,
    step,
    approverRole:
      step === ApprovalStep.ADMIN_FINAL_APPROVAL
        ? UserRole.ADMIN
        : UserRole.AREA_MANAGER,
    approverId:
      step === ApprovalStep.ADMIN_FINAL_APPROVAL ? null : areaManager.id,
    status: ApprovalStatus.PENDING,
    decisionAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    approver: null,
    request
  };

  request.approvals = [approval] as never[];
  return approval;
}

function seedApproval(approval: any) {
  approvalsById.set(approval.id, approval);
  activeApproval = approval;
}

const prisma = {
  requestApproval: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      approvalsById.get(where.id) ?? null,
    findMany: async () => findManyApprovals
  },
  $transaction: async (callback: (tx: any) => Promise<unknown>) => {
    mutationEvents.push("transaction");

    return callback({
      requestApproval: {
        update: async ({ where, data }: any) => {
          mutationEvents.push(
            `requestApproval.update:${where.id}:${data.status}`
          );
        },
        updateMany: async ({ data }: any) => {
          mutationEvents.push(`requestApproval.updateMany:${data.status}`);
        }
      },
      request: {
        update: async ({ data }: any) => {
          mutationEvents.push(`request.update:${data.status}`);
          return {
            ...activeApproval.request,
            ...data,
            updatedAt: new Date("2026-01-01T00:00:01.000Z")
          };
        }
      }
    });
  }
} as unknown as PrismaService;

const auditService = {
  log: async ({ action }: { action: string }) => {
    auditEvents.push(action);
  }
} as unknown as AuditService;

const notificationsService = {
  create: async ({ type }: { type: string }) => {
    notificationEvents.push(`create:${type}`);
  },
  notifyAdmins: async ({ type }: { type: string }) => {
    notificationEvents.push(`notifyAdmins:${type}`);
  }
} as unknown as NotificationsService;

const requestsService = {
  statusForStep(step: ApprovalStep) {
    events.push(`status:${step}`);
    return statusForStep(step);
  },
  userCanActOnStep: async (
    _request: unknown,
    step: ApprovalStep,
    _approverId: string | null,
    actorValue: AuthenticatedUser
  ) => {
    events.push(`ownership:${step}:${actorValue.id}`);
    return allowDecision;
  },
  approveNewHireAreaManagerApproval: async (
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: { actor: AuthenticatedUser }
  ) => {
    delegateEvents.push(
      `newHireAreaManager:${approvalId}:${dto.notes ?? "none"}:${context.actor.id}`
    );
    return { id: "new-hire-area-manager-response" };
  },
  approveOffboardingAreaManagerApproval: async (
    approvalId: string,
    dto: ApprovalDecisionDto,
    context: { actor: AuthenticatedUser }
  ) => {
    delegateEvents.push(
      `offboardingAreaManager:${approvalId}:${dto.notes ?? "none"}:${context.actor.id}`
    );
    return { id: "offboarding-area-manager-response" };
  },
  approveTransferApproval: async (
    approvalId: string,
    notes: string | undefined,
    context: { actor: AuthenticatedUser }
  ) => {
    delegateEvents.push(
      `transfer:${approvalId}:${notes ?? "none"}:${context.actor.id}`
    );
    return { id: "transfer-response" };
  },
  finalizeNewHire: async (
    requestId: string,
    _dto: Record<string, never>,
    context: { actor: AuthenticatedUser }
  ) => {
    delegateEvents.push(`finalizeNewHire:${requestId}:${context.actor.id}`);
    return { request: { id: "new-hire-finalized" } };
  }
} as unknown as RequestsService;

function createService(
  accessPolicy: AccessPolicyService = recordingPolicy
): ApprovalsService {
  return new (ApprovalsService as any)(
    auditService,
    notificationsService,
    prisma,
    requestsService,
    { finalizeFromAdminApproval: async () => undefined } as never,
    accessPolicy,
    { assertApprovalStillValid: async () => undefined } as never
  ) as ApprovalsService;
}

function context(actorValue: AuthenticatedUser) {
  return {
    actor: actorValue,
    ipAddress: "127.0.0.1",
    userAgent: "approvals-policy-test"
  };
}

function requiredPermissionFor(methodName: keyof ApprovalsController) {
  return Reflect.getMetadata(
    REQUIRED_PERMISSION_KEY,
    ApprovalsController.prototype[methodName]
  );
}

function guardsFor(methodName: keyof ApprovalsController) {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    ApprovalsController.prototype[methodName]
  );
}

function assertPolicyBeforeOwnership(step: ApprovalStep) {
  const policyIndex = events.findIndex((event) => event.startsWith("policy:"));
  const ownershipIndex = events.findIndex((event) =>
    event.startsWith(`ownership:${step}:`)
  );

  assert.ok(policyIndex >= 0, "policy check should be recorded");
  assert.ok(ownershipIndex >= 0, "ownership check should be recorded");
  assert.ok(
    policyIndex < ownershipIndex,
    "policy check should run before ownership/current-step checks"
  );
}

async function run() {
  const controllerCalls: string[] = [];
  const controller = new ApprovalsController({
    getFoundationStatus: () => ({ module: "approvals" }),
    listPending: async (userValue: AuthenticatedUser) => {
      controllerCalls.push(`pending:${userValue.id}`);
      return [{ id: "approval-pending" }];
    },
    approve: async () => {
      controllerCalls.push("approve");
      return { id: "approved" };
    },
    reject: async () => {
      controllerCalls.push("reject");
      return { id: "rejected" };
    }
  } as unknown as ApprovalsService);

  assert.equal(
    requiredPermissionFor("listPending"),
    PermissionKeys.APPROVALS_VIEW_PENDING
  );
  assert.deepEqual(guardsFor("listPending"), [JwtAuthGuard, PermissionGuard]);
  assert.equal(requiredPermissionFor("approve"), undefined);
  assert.equal(requiredPermissionFor("reject"), undefined);
  assert.deepEqual(guardsFor("approve"), [JwtAuthGuard]);
  assert.deepEqual(guardsFor("reject"), [JwtAuthGuard]);

  const pendingPolicy = new AccessPolicyService();
  for (const role of Object.values(UserRole)) {
    assert.doesNotThrow(
      () =>
        pendingPolicy.assertCan(
          actor(role),
          PermissionKeys.APPROVALS_VIEW_PENDING
        ),
      `${role} should be able to view their pending approval inbox`
    );
  }

  assert.deepEqual(await controller.listPending(admin), [
    { id: "approval-pending" }
  ]);
  assert.deepEqual(controllerCalls, [`pending:${admin.id}`]);

  const service = createService();
  const decisionDto = { notes: "Approved" } satisfies ApprovalDecisionDto;
  const rejectDto = { notes: "Rejected" } satisfies ApprovalDecisionDto;

  reset();
  const areaApproval = approvalFor(
    ApprovalStep.AREA_MANAGER_APPROVAL,
    RequestType.NEW_HIRE
  );
  seedApproval(areaApproval);
  await service.approve(areaApproval.id, decisionDto, context(areaManager));
  assert.deepEqual(policyCalls, [
    {
      actor: areaManager,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_CHAIN
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.AREA_MANAGER_APPROVAL);
  assert.deepEqual(delegateEvents, [
    `newHireAreaManager:${areaApproval.id}:Approved:${areaManager.id}`
  ]);

  reset();
  const areaRejectApproval = approvalFor(
    ApprovalStep.AREA_MANAGER_APPROVAL,
    RequestType.RESIGNATION
  );
  seedApproval(areaRejectApproval);
  await service.reject(areaRejectApproval.id, rejectDto, context(areaManager));
  assert.deepEqual(policyCalls, [
    {
      actor: areaManager,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_CHAIN
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.AREA_MANAGER_APPROVAL);
  assert.ok(mutationEvents.includes("transaction"));
  assert.ok(auditEvents.includes("APPROVAL_REJECTED"));
  assert.ok(notificationEvents.includes("create:REQUEST_REJECTED"));

  reset();
  const sourceApproval = approvalFor(
    ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
    RequestType.TRANSFER
  );
  seedApproval(sourceApproval);
  await service.approve(sourceApproval.id, decisionDto, context(areaManager));
  assert.deepEqual(policyCalls, [
    {
      actor: areaManager,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_CHAIN
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL);
  assert.deepEqual(delegateEvents, [
    `transfer:${sourceApproval.id}:Approved:${areaManager.id}`
  ]);

  reset();
  const destinationApproval = approvalFor(
    ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL,
    RequestType.TRANSFER
  );
  seedApproval(destinationApproval);
  await service.approve(destinationApproval.id, decisionDto, context(areaManager));
  assert.deepEqual(policyCalls, [
    {
      actor: areaManager,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_CHAIN
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL);
  assert.deepEqual(delegateEvents, [
    `transfer:${destinationApproval.id}:Approved:${areaManager.id}`
  ]);

  reset();
  const adminApproval = approvalFor(
    ApprovalStep.ADMIN_FINAL_APPROVAL,
    RequestType.NEW_HIRE
  );
  seedApproval(adminApproval);
  await service.approve(adminApproval.id, decisionDto, context(admin));
  assert.deepEqual(policyCalls, [
    {
      actor: admin,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.ADMIN_FINAL_APPROVAL);
  assert.deepEqual(delegateEvents, [
    `finalizeNewHire:${adminApproval.requestId}:${admin.id}`
  ]);

  reset();
  const adminRejectApproval = approvalFor(
    ApprovalStep.ADMIN_FINAL_APPROVAL,
    RequestType.NEW_HIRE
  );
  seedApproval(adminRejectApproval);
  await service.reject(adminRejectApproval.id, rejectDto, context(admin));
  assert.deepEqual(policyCalls, [
    {
      actor: admin,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.ADMIN_FINAL_APPROVAL);
  assert.ok(mutationEvents.includes("transaction"));
  assert.ok(auditEvents.includes("APPROVAL_REJECTED"));
  assert.ok(notificationEvents.includes("create:REQUEST_REJECTED"));

  reset();
  allowDecision = false;
  const ownershipDeniedApproval = approvalFor(
    ApprovalStep.AREA_MANAGER_APPROVAL,
    RequestType.NEW_HIRE
  );
  seedApproval(ownershipDeniedApproval);
  await assert.rejects(
    () =>
      service.approve(
        ownershipDeniedApproval.id,
        decisionDto,
        context(areaManager)
      ),
    /You do not own this approval step/
  );
  assert.deepEqual(policyCalls, [
    {
      actor: areaManager,
      permissionKey: PermissionKeys.APPROVALS_DECIDE_CHAIN
    }
  ]);
  assertPolicyBeforeOwnership(ApprovalStep.AREA_MANAGER_APPROVAL);
  assert.deepEqual(delegateEvents, []);
  assert.deepEqual(mutationEvents, []);
  assert.deepEqual(auditEvents, []);
  assert.deepEqual(notificationEvents, []);

  reset();
  const realPolicyService = createService(new AccessPolicyService());
  const policyDeniedApproval = approvalFor(
    ApprovalStep.ADMIN_FINAL_APPROVAL,
    RequestType.NEW_HIRE
  );
  seedApproval(policyDeniedApproval);
  await assert.rejects(
    () =>
      realPolicyService.approve(
        policyDeniedApproval.id,
        decisionDto,
        context(champ)
      ),
    /Missing required permission/
  );
  assert.deepEqual(events, []);
  assert.deepEqual(delegateEvents, []);
  assert.deepEqual(mutationEvents, []);
  assert.deepEqual(auditEvents, []);
  assert.deepEqual(notificationEvents, []);

  reset();
  findManyApprovals = [];
  await service.listPending(admin);
  assert.deepEqual(policyCalls, []);
}

void run();
