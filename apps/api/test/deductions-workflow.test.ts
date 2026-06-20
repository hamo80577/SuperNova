import "reflect-metadata";

import assert from "node:assert/strict";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException
} from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  DeductionCaseStatus,
  DeductionPenaltyType,
  EmploymentStatus,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { ApprovalsService } from "../src/approvals/approvals.service";
import { PermissionKeys } from "../src/access-control/permissions";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/access-control/role-permission.matrix";
import { DeductionPolicyService } from "../src/deductions/deduction-policy.service";
import { DeductionsScopeService } from "../src/deductions/deductions-scope.service";
import { DeductionsService } from "../src/deductions/deductions.service";
import { USER_METRICS_UPDATED_EVENT } from "../src/dashboard-cache/dashboard-cache.constants";
import { RequestApprovalRoutingService } from "../src/requests/request-approval-routing.service";
import { RequestsService } from "../src/requests/requests.service";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";

type StoredUser = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  role: UserRole;
  shopperId: string | null;
  ibsId: string | null;
  phoneNumber: string;
  accountStatus: AccountStatus;
  employmentStatus: EmploymentStatus;
  blockStatus: BlockStatus;
  blockedUntil: Date | null;
};

type StoredRuleStep = {
  id: string;
  occurrenceNumber: number;
  appliesFromOccurrence: number | null;
  penaltyType: DeductionPenaltyType;
  deductionDays: number | null;
  label: string;
};

type StoredCase = Record<string, unknown> & {
  id: string;
  requestId: string;
  targetUserId: string;
  actionId: string | null;
  incidentMonth: string;
  status: DeductionCaseStatus;
};

function actor(id: string, role: UserRole): AuthenticatedUser {
  return {
    id,
    role,
    nameEn: id,
    phoneNumber: "0100000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: "COMPLETE",
    mustChangePassword: false
  } as AuthenticatedUser;
}

function user(
  id: string,
  role: UserRole,
  overrides: Partial<StoredUser> = {}
): StoredUser {
  return {
    id,
    nameEn: `User ${id}`,
    nameAr: null,
    role,
    shopperId: role === UserRole.PICKER ? `SH-${id}` : null,
    ibsId: null,
    phoneNumber: `010${id}`,
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    ...overrides
  };
}

function createStore() {
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  const store = {
    users: [
      user("admin-1", UserRole.ADMIN),
      user("am-1", UserRole.AREA_MANAGER),
      user("am-2", UserRole.AREA_MANAGER),
      user("champ-1", UserRole.CHAMP),
      user("champ-2", UserRole.CHAMP),
      user("picker-1", UserRole.PICKER),
      user("picker-2", UserRole.PICKER)
    ],
    chains: [
      { id: "chain-1", chainName: "Chain One" },
      { id: "chain-2", chainName: "Chain Two" }
    ],
    vendors: [
      { id: "vendor-a", vendorName: "Vendor A", chainId: "chain-1" },
      { id: "vendor-b", vendorName: "Vendor B", chainId: "chain-2" }
    ],
    pickerAssignments: [
      {
        id: "pa-1",
        pickerId: "picker-1",
        vendorId: "vendor-a",
        status: AssignmentStatus.ACTIVE
      },
      {
        id: "pa-2",
        pickerId: "picker-2",
        vendorId: "vendor-b",
        status: AssignmentStatus.ACTIVE
      }
    ],
    champAssignments: [
      {
        id: "ca-1",
        champId: "champ-1",
        vendorId: "vendor-a",
        status: AssignmentStatus.ACTIVE
      },
      {
        id: "ca-2",
        champId: "champ-2",
        vendorId: "vendor-b",
        status: AssignmentStatus.ACTIVE
      }
    ],
    areaManagerAssignments: [
      {
        id: "ama-1",
        areaManagerId: "am-1",
        chainId: "chain-1",
        status: AssignmentStatus.ACTIVE
      },
      {
        id: "ama-2",
        areaManagerId: "am-2",
        chainId: "chain-2",
        status: AssignmentStatus.ACTIVE
      }
    ],
    policy: {
      id: "policy-v1",
      versionNumber: 1,
      status: "ACTIVE",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      actions: [
        {
          id: "action-attitude",
          code: "ATTITUDE",
          name: "Attitude",
          description: "Attitude violations",
          status: "ACTIVE",
          ruleSteps: [
            rule("rs-1", 1, null, DeductionPenaltyType.DEDUCTION_DAYS, 0.5, "0.5 day"),
            rule("rs-2", 2, null, DeductionPenaltyType.DEDUCTION_DAYS, 1, "1 day"),
            rule(
              "rs-3",
              3,
              null,
              DeductionPenaltyType.LIFECYCLE_REVIEW_REQUIRED,
              null,
              "Lifecycle review required"
            )
          ]
        },
        {
          id: "action-absent",
          code: "ABSENT_WITHOUT_PERMISSION",
          name: "Absent without Permission",
          description: "Absence violations",
          status: "ACTIVE",
          ruleSteps: [
            rule("rs-4", 1, null, DeductionPenaltyType.DEDUCTION_DAYS, 1, "1 day"),
            rule("rs-5", 2, null, DeductionPenaltyType.DEDUCTION_DAYS, 2, "2 days"),
            rule("rs-6", 3, null, DeductionPenaltyType.DEDUCTION_DAYS, 3, "3 days"),
            rule("rs-7", 4, null, DeductionPenaltyType.DEDUCTION_DAYS, 3, "3 days"),
            rule(
              "rs-8",
              5,
              5,
              DeductionPenaltyType.LIFECYCLE_REVIEW_REQUIRED,
              null,
              "Lifecycle review required"
            )
          ]
        }
      ]
    },
    requests: [] as Array<Record<string, unknown> & { id: string }>,
    approvals: [] as Array<Record<string, unknown> & { id: string; requestId: string }>,
    cases: [] as StoredCase[],
    notifications: [] as Array<Record<string, unknown>>,
    auditLogs: [] as Array<Record<string, unknown>>,
    emittedEvents: [] as Array<{ name: string; payload: unknown }>,
    forbiddenMutationCalls: [] as string[]
  };

  const forbiddenMutation = (name: string) => async () => {
    store.forbiddenMutationCalls.push(name);
    throw new Error(`${name} is out of scope.`);
  };

  const findUser = (id: string) => store.users.find((item) => item.id === id);
  const vendorWithChain = (vendorId: string) => {
    const vendor = store.vendors.find((item) => item.id === vendorId);
    if (!vendor) return null;
    return {
      ...vendor,
      chain: store.chains.find((item) => item.id === vendor.chainId)
    };
  };

  const hydrateRequest = (row: Record<string, unknown> & { id: string }) => ({
    ...row,
    createdBy: findUser(row.createdById as string) ?? null,
    targetUser: row.targetUserId ? findUser(row.targetUserId as string) ?? null : null,
    sourceChain: row.sourceChainId
      ? store.chains.find((item) => item.id === row.sourceChainId) ?? null
      : null,
    sourceVendor: row.sourceVendorId
      ? vendorWithChain(row.sourceVendorId as string)
      : null,
    destinationChain: null,
    destinationVendor: null,
    approvals: store.approvals
      .filter((approval) => approval.requestId === row.id)
      .map((approval) => ({
        ...approval,
        approver: approval.approverId
          ? findUser(approval.approverId as string) ?? null
          : null
      }))
  });

  const prisma: Record<string, unknown> = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const found = findUser(where.id);
        return found ? { ...found } : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const roleIn =
          (where.role as { in?: UserRole[] } | undefined)?.in ?? null;
        return store.users
          .filter(
            (item) =>
              (!roleIn || roleIn.includes(item.role)) &&
              (!where.accountStatus || item.accountStatus === where.accountStatus)
          )
          .map((item) => ({ id: item.id }));
      },
      create: forbiddenMutation("user.create"),
      update: forbiddenMutation("user.update"),
      updateMany: forbiddenMutation("user.updateMany")
    },
    pickerBranchAssignment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        store.pickerAssignments
          .filter(
            (item) =>
              (!where.pickerId || item.pickerId === where.pickerId) &&
              (!where.status || item.status === where.status) &&
              (!where.vendorId || item.vendorId === where.vendorId)
          )
          .map((item) => ({ ...item, vendor: vendorWithChain(item.vendorId) })),
      create: forbiddenMutation("pickerBranchAssignment.create"),
      update: forbiddenMutation("pickerBranchAssignment.update"),
      updateMany: forbiddenMutation("pickerBranchAssignment.updateMany")
    },
    vendorChampAssignment: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const vendorScope = where.vendor as
          | { chainId?: { in?: string[] } }
          | undefined;
        const match = store.champAssignments.find((item) => {
          if (where.champId && item.champId !== where.champId) return false;
          if (where.status && item.status !== where.status) return false;
          if (where.vendorId && item.vendorId !== where.vendorId) return false;
          if (vendorScope?.chainId?.in) {
            const vendor = store.vendors.find((v) => v.id === item.vendorId);
            if (!vendor || !vendorScope.chainId.in.includes(vendor.chainId)) {
              return false;
            }
          }
          return true;
        });
        if (!match) return null;
        return { ...match, vendor: vendorWithChain(match.vendorId) };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        store.champAssignments
          .filter(
            (item) =>
              (!where.champId || item.champId === where.champId) &&
              (!where.status || item.status === where.status)
          )
          .map((item) => ({ vendorId: item.vendorId })),
      create: forbiddenMutation("vendorChampAssignment.create"),
      update: forbiddenMutation("vendorChampAssignment.update"),
      updateMany: forbiddenMutation("vendorChampAssignment.updateMany")
    },
    chainAreaManagerAssignment: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.areaManagerId) {
          const match = store.areaManagerAssignments.find(
            (item) =>
              item.areaManagerId === where.areaManagerId &&
              (!where.chainId || item.chainId === where.chainId) &&
              (!where.status || item.status === where.status)
          );
          return match ? { id: match.id } : null;
        }

        const match = store.areaManagerAssignments.find(
          (item) =>
            item.chainId === where.chainId &&
            (!where.status || item.status === where.status)
        );
        if (!match) return null;
        const areaManager = findUser(match.areaManagerId);
        if (!areaManager || areaManager.role !== UserRole.AREA_MANAGER) {
          return null;
        }
        return { ...match, areaManager: { ...areaManager } };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        store.areaManagerAssignments
          .filter(
            (item) =>
              item.areaManagerId === where.areaManagerId &&
              (!where.status || item.status === where.status)
          )
          .map((item) => ({ chainId: item.chainId })),
      create: forbiddenMutation("chainAreaManagerAssignment.create"),
      update: forbiddenMutation("chainAreaManagerAssignment.update"),
      updateMany: forbiddenMutation("chainAreaManagerAssignment.updateMany")
    },
    deductionPolicyVersion: {
      findFirst: async () => ({
        ...store.policy,
        actions: store.policy.actions.map((action) => ({
          ...action,
          ruleSteps: [...action.ruleSteps]
        }))
      })
    },
    deductionAction: {
      findFirst: async ({
        where
      }: {
        where: { policyVersionId?: string; code?: string };
      }) => {
        const match = store.policy.actions.find(
          (action) => action.code === where.code
        );
        return match ? { id: match.id } : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const action = store.policy.actions.find((item) => item.id === where.id);
        if (!action) return null;
        return {
          ...action,
          policyVersion: { status: store.policy.status },
          ruleSteps: action.ruleSteps.map((step) => ({ ...step }))
        };
      },
      create: async ({
        data
      }: {
        data: Record<string, unknown> & {
          ruleSteps?: { create: Array<Record<string, unknown>> };
        };
      }) => {
        const ruleSteps = (data.ruleSteps?.create ?? []).map((step, index) => ({
          id: nextId("rule"),
          ...step
        })) as StoredRuleStep[];
        const action = {
          id: nextId("action"),
          code: data.code as string,
          name: data.name as string,
          description: (data.description as string) ?? null,
          status: "ACTIVE",
          ruleSteps
        };
        store.policy.actions.push(action as never);
        return { ...action };
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const action = store.policy.actions.find((item) => item.id === where.id);
        if (!action) throw new Error("action not found");
        if (data.name !== undefined) action.name = data.name as string;
        if (data.description !== undefined) {
          (action as { description: string | null }).description =
            data.description as string | null;
        }
        if (data.status !== undefined) {
          (action as { status: string }).status = data.status as string;
        }
        return { ...action, ruleSteps: action.ruleSteps.map((s) => ({ ...s })) };
      }
    },
    deductionRuleStep: {
      deleteMany: async ({ where }: { where: { actionId: string } }) => {
        const action = store.policy.actions.find(
          (item) => item.id === where.actionId
        );
        if (action) action.ruleSteps = [];
        return { count: 1 };
      },
      createMany: async ({
        data
      }: {
        data: Array<Record<string, unknown> & { actionId: string }>;
      }) => {
        const action = store.policy.actions.find(
          (item) => item.id === data[0]?.actionId
        );
        if (action) {
          action.ruleSteps = data.map((step) => ({
            id: nextId("rule"),
            ...step
          })) as StoredRuleStep[];
        }
        return { count: data.length };
      }
    },
    deductionCase: {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        store.cases.filter((item) => matchesCaseWhere(item, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId("case"), ...data } as StoredCase;
        store.cases.push(row);
        return { ...row };
      },
      update: async ({
        where,
        data
      }: {
        where: { requestId: string };
        data: Record<string, unknown>;
      }) => {
        const row = store.cases.find((item) => item.requestId === where.requestId);
        if (!row) throw new Error("case not found");
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({
        where,
        data
      }: {
        where: { requestId: string; status?: DeductionCaseStatus };
        data: Record<string, unknown>;
      }) => {
        store.cases
          .filter(
            (item) =>
              item.requestId === where.requestId &&
              (!where.status || item.status === where.status)
          )
          .forEach((item) => Object.assign(item, data));
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id?: string; requestId?: string } }) => {
        const row = store.cases.find(
          (item) =>
            (where.id && item.id === where.id) ||
            (where.requestId && item.requestId === where.requestId)
        );
        return row ? { ...row } : null;
      },
      findMany: async ({
        where,
        skip,
        take
      }: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
      } = {}) => {
        const matched = store.cases.filter((item) =>
          matchesCaseWhere(item, where)
        );
        const sliced =
          skip !== undefined || take !== undefined
            ? matched.slice(skip ?? 0, (skip ?? 0) + (take ?? matched.length))
            : matched;
        return sliced.map((item) => ({ ...item }));
      }
    },
    request: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextId("request"),
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          destinationChainId: null,
          destinationVendorId: null,
          targetUserId: null,
          sourceChainId: null,
          sourceVendorId: null,
          payload: null,
          currentStep: null,
          ...data
        };
        store.requests.push(row);
        return { ...row };
      },
      update: async ({
        where,
        data,
        include
      }: {
        where: { id: string };
        data: Record<string, unknown>;
        include?: unknown;
      }) => {
        const row = store.requests.find((item) => item.id === where.id);
        if (!row) throw new Error("request not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return include ? hydrateRequest(row) : { ...row };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = store.requests.find((item) => item.id === where.id);
        return row ? hydrateRequest(row) : null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = store.requests.find((item) => item.id === where.id);
        if (!row) throw new Error("request not found");
        return hydrateRequest(row);
      }
    },
    requestApproval: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextId("approval"),
          decisionAt: null,
          notes: null,
          approverId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data
        } as Record<string, unknown> & { id: string; requestId: string };
        store.approvals.push(row);
        return { ...row };
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = store.approvals.find((item) => item.id === where.id);
        if (!row) throw new Error("approval not found");
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({
        where,
        data
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const notId = (where.id as { not?: string } | undefined)?.not;
        store.approvals
          .filter(
            (item) =>
              item.requestId === where.requestId &&
              (!where.status || item.status === where.status) &&
              (!notId || item.id !== notId)
          )
          .forEach((item) => Object.assign(item, data));
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = store.approvals.find((item) => item.id === where.id);
        if (!row) return null;
        const request = store.requests.find((item) => item.id === row.requestId);
        return {
          ...row,
          approver: row.approverId ? findUser(row.approverId as string) ?? null : null,
          request: request ? hydrateRequest(request) : null
        };
      }
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        store.notifications.push(data);
        return { id: nextId("notification"), ...data };
      },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        store.notifications.push(...data);
        return { count: data.length };
      }
    },
    auditLog: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        store.auditLogs.push(...data);
        return { count: data.length };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        store.auditLogs.push(data);
        return { id: nextId("audit"), ...data };
      }
    }
  };

  const policyService = new DeductionPolicyService(prisma as never);
  const scopeService = new DeductionsScopeService(prisma as never);
  const routingService = new RequestApprovalRoutingService(prisma as never);
  const eventEmitter = {
    emit: (name: string, payload: unknown) => {
      store.emittedEvents.push({ name, payload });
      return true;
    }
  };
  const deductionsService = new (DeductionsService as any)(
    prisma as never,
    policyService,
    scopeService,
    routingService,
    eventEmitter
  ) as DeductionsService;
  const statusForStep = (step: ApprovalStep) =>
    step === ApprovalStep.AREA_MANAGER_APPROVAL ||
    step === ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL
      ? RequestStatus.PENDING_AREA_MANAGER
      : step === ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL
        ? RequestStatus.PENDING_DESTINATION_AREA_MANAGER
        : RequestStatus.PENDING_ADMIN;
  const approvalsService = new (ApprovalsService as any)(
    { log: async () => undefined } as never,
    {
      create: async () => undefined,
      createForUsers: async () => undefined,
      notifyAdmins: async () => undefined
    } as never,
    prisma as never,
    {
      statusForStep,
      userCanActOnStep: async () => true
    } as never,
    deductionsService,
    { assertCan: () => undefined } as never,
    {} as never,
    eventEmitter
  ) as ApprovalsService;
  const requestsService = new (RequestsService as any)(
    { log: async () => undefined } as never,
    {} as never,
    {} as never,
    {} as never,
    { create: async () => undefined } as never,
    prisma as never,
    routingService,
    {} as never,
    eventEmitter
  ) as RequestsService;

  return {
    approvalsService,
    deductionsService,
    policyService,
    requestsService,
    store
  };
}

function rule(
  id: string,
  occurrenceNumber: number,
  appliesFromOccurrence: number | null,
  penaltyType: DeductionPenaltyType,
  deductionDays: number | null,
  label: string
): StoredRuleStep {
  return { id, occurrenceNumber, appliesFromOccurrence, penaltyType, deductionDays, label };
}

// Honors the subset of Prisma where semantics the deductions list/scope code
// builds: AND[]/OR[], scalar equality, status {in}, and the relation filters on
// targetUser.role and request.sourceVendorId/sourceChainId {in}. Keeping the
// stub faithful is what stops list-scope assertions from passing vacuously.
function matchesCaseWhere(
  row: Record<string, unknown>,
  where?: Record<string, unknown>
): boolean {
  if (!where) return true;

  if (Array.isArray(where.AND)) {
    if (!where.AND.every((nested) => matchesCaseWhere(row, nested as Record<string, unknown>))) {
      return false;
    }
  }
  if (Array.isArray(where.OR)) {
    if (!where.OR.some((nested) => matchesCaseWhere(row, nested as Record<string, unknown>))) {
      return false;
    }
  }

  for (const key of ["targetUserId", "actionId", "incidentMonth"] as const) {
    if (where[key] !== undefined && row[key] !== where[key]) {
      return false;
    }
  }

  if (where.status !== undefined) {
    const filter = where.status as { in?: unknown[] } | string;
    if (typeof filter === "object" && Array.isArray(filter.in)) {
      if (!filter.in.includes(row.status)) return false;
    } else if (row.status !== filter) {
      return false;
    }
  }

  const targetUser = where.targetUser as { role?: string } | undefined;
  if (targetUser?.role !== undefined) {
    const rowTarget = row.targetUser as { role?: string } | undefined;
    if (rowTarget?.role !== targetUser.role) return false;
  }

  const request = where.request as
    | {
        sourceVendorId?: { in?: unknown[] };
        sourceChainId?: { in?: unknown[] };
      }
    | undefined;
  if (request) {
    const rowRequest = row.request as
      | { sourceVendorId?: string | null; sourceChainId?: string | null }
      | undefined;
    if (
      request.sourceVendorId?.in &&
      !request.sourceVendorId.in.includes(rowRequest?.sourceVendorId)
    ) {
      return false;
    }
    if (
      request.sourceChainId?.in &&
      !request.sourceChainId.in.includes(rowRequest?.sourceChainId)
    ) {
      return false;
    }
  }

  return true;
}

// Build a fully-hydrated DeductionCase row (matching caseInclude) for list/
// getById scoping tests, which read targetUser.role and request.source*.
function richCase(overrides: {
  id: string;
  targetUserId: string;
  targetRole: UserRole;
  createdById: string;
  status: DeductionCaseStatus;
  sourceVendorId: string;
  sourceChainId: string;
  incidentMonth?: string;
  actionId?: string;
  occurrenceNumber?: number;
  deductionDays?: number | null;
  penaltyType?: DeductionPenaltyType;
}) {
  return {
    id: overrides.id,
    requestId: `req-${overrides.id}`,
    targetUserId: overrides.targetUserId,
    createdById: overrides.createdById,
    actionId: overrides.actionId ?? "action-attitude",
    policyVersionId: "policy-v1",
    incidentDate: new Date(`${MONTH_START_DATE}T00:00:00.000Z`),
    incidentMonth: overrides.incidentMonth ?? CURRENT_MONTH,
    occurrenceNumber: overrides.occurrenceNumber ?? 1,
    penaltyType: overrides.penaltyType ?? DeductionPenaltyType.DEDUCTION_DAYS,
    deductionDays: overrides.deductionDays ?? 0.5,
    penaltyLabel: "0.5 day",
    actionNameSnapshot: "Attitude",
    reason: null,
    notes: null,
    status: overrides.status,
    finalApprovedById: null,
    finalApprovedAt: null,
    createdAt: new Date(),
    targetUser: {
      id: overrides.targetUserId,
      nameEn: `User ${overrides.targetUserId}`,
      role: overrides.targetRole,
      shopperId: null,
      ibsId: null
    },
    createdBy: { id: overrides.createdById, nameEn: "Creator", role: UserRole.CHAMP },
    policyVersion: { versionNumber: 1 },
    request: {
      id: `req-${overrides.id}`,
      status: RequestStatus.PENDING_ADMIN,
      sourceVendorId: overrides.sourceVendorId,
      sourceChainId: overrides.sourceChainId,
      sourceVendor: { vendorName: "Vendor" },
      sourceChain: { chainName: "Chain" }
    }
  } as unknown as StoredCase;
}

const champActor = actor("champ-1", UserRole.CHAMP);
const areaManagerActor = actor("am-1", UserRole.AREA_MANAGER);
const adminActor = actor("admin-1", UserRole.ADMIN);

// Use local calendar parts to match the service's localDateString() authority.
function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const now = new Date();
const TODAY_DATE = toLocalDateString(now);
const CURRENT_MONTH = TODAY_DATE.slice(0, 7);
const MONTH_START_DATE = `${CURRENT_MONTH}-01`;
const PREVIOUS_MONTH_DATE = (() => {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return toLocalDateString(previous);
})();
const PREVIOUS_MONTH = PREVIOUS_MONTH_DATE.slice(0, 7);

function createDto(overrides: Record<string, unknown> = {}) {
  return {
    targetUserId: "picker-1",
    actionId: "action-attitude",
    incidentDate: MONTH_START_DATE,
    ...overrides
  } as never;
}

async function testChampCreatesScopedPickerDeduction() {
  const context = createStore();
  const summary = await context.deductionsService.createDeductionRequest(
    createDto({ reason: "Repeated attitude issue" }),
    { actor: champActor }
  );

  assert.equal(summary.type, RequestType.DEDUCTION);
  assert.equal(summary.status, RequestStatus.PENDING_AREA_MANAGER);
  assert.equal(summary.currentStep, ApprovalStep.AREA_MANAGER_APPROVAL);

  const approvals = context.store.approvals;
  assert.equal(approvals.length, 2);
  assert.equal(approvals[0].step, ApprovalStep.AREA_MANAGER_APPROVAL);
  assert.equal(approvals[0].status, ApprovalStatus.PENDING);
  assert.equal(approvals[0].approverId, "am-1");
  assert.equal(approvals[1].step, ApprovalStep.ADMIN_FINAL_APPROVAL);
  assert.equal(approvals[1].status, ApprovalStatus.PENDING);

  const deductionCase = context.store.cases[0];
  assert.equal(deductionCase.status, DeductionCaseStatus.PENDING_APPROVAL);
  assert.equal(deductionCase.occurrenceNumber, 1);
  assert.equal(deductionCase.penaltyType, DeductionPenaltyType.DEDUCTION_DAYS);
  assert.equal(deductionCase.deductionDays, 0.5);
  assert.equal(deductionCase.penaltyLabel, "0.5 day");
  assert.equal(deductionCase.incidentMonth, CURRENT_MONTH);
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testChampCannotCreateOutsideBranchScope() {
  const context = createStore();

  await assert.rejects(
    context.deductionsService.createDeductionRequest(
      createDto({ targetUserId: "picker-2" }),
      { actor: champActor }
    ),
    ForbiddenException
  );

  await assert.rejects(
    context.deductionsService.createDeductionRequest(
      createDto({ targetUserId: "picker-2" }),
      { actor: areaManagerActor }
    ),
    ForbiddenException
  );
  assert.equal(context.store.cases.length, 0);
  assert.equal(context.store.requests.length, 0);
}

async function testAreaManagerCreatesForPickerAndChampDirectToAdmin() {
  const context = createStore();
  const pickerSummary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: areaManagerActor }
  );

  assert.equal(pickerSummary.status, RequestStatus.PENDING_ADMIN);
  assert.equal(pickerSummary.currentStep, ApprovalStep.ADMIN_FINAL_APPROVAL);
  const amStep = context.store.approvals.find(
    (approval) =>
      approval.requestId === pickerSummary.id &&
      approval.step === ApprovalStep.AREA_MANAGER_APPROVAL
  );
  assert.equal(amStep?.status, ApprovalStatus.SKIPPED);

  const champSummary = await context.deductionsService.createDeductionRequest(
    createDto({
      targetUserId: "champ-1",
      targetRole: UserRole.CHAMP,
      actionId: "action-absent"
    }),
    { actor: areaManagerActor }
  );
  assert.equal(champSummary.status, RequestStatus.PENDING_ADMIN);
  assert.equal(champSummary.targetUser?.id, "champ-1");

  await assert.rejects(
    context.deductionsService.createDeductionRequest(
      createDto({ targetUserId: "champ-2", targetRole: UserRole.CHAMP }),
      { actor: areaManagerActor }
    ),
    ForbiddenException
  );
}

async function testOccurrenceUsesIncidentMonth() {
  const context = createStore();

  const first = await context.deductionsService.preview(createDto(), champActor);
  assert.equal(first.occurrenceNumber, 1);
  assert.equal(first.penalty.label, "0.5 day");
  await context.deductionsService.createDeductionRequest(createDto(), {
    actor: champActor
  });

  const second = await context.deductionsService.preview(
    createDto({ incidentDate: TODAY_DATE }),
    champActor
  );
  assert.equal(second.occurrenceNumber, 2);
  assert.equal(second.penalty.label, "1 day");

  context.store.cases.push(
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `previous-${index}`,
      requestId: `previous-request-${index}`,
      targetUserId: "picker-1",
      actionId: "action-attitude",
      incidentMonth: PREVIOUS_MONTH,
      status: DeductionCaseStatus.EFFECTIVE
    }))
  );
  const stillSecond = await context.deductionsService.preview(
    createDto({ incidentDate: TODAY_DATE }),
    champActor
  );
  assert.equal(
    stillSecond.occurrenceNumber,
    2,
    "previous-month cases must not count toward the current month"
  );

  await assert.rejects(
    context.deductionsService.preview(
      createDto({ incidentDate: PREVIOUS_MONTH_DATE }),
      champActor
    ),
    BadRequestException,
    "old-month deductions must be rejected"
  );

  const openEnded = await context.deductionsService.preview(
    createDto({ actionId: "action-absent" }),
    champActor
  );
  assert.equal(openEnded.occurrenceNumber, 1);
  context.store.cases.push(
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `seeded-${index}`,
      requestId: `seeded-request-${index}`,
      targetUserId: "picker-1",
      actionId: "action-absent",
      incidentMonth: CURRENT_MONTH,
      status: DeductionCaseStatus.EFFECTIVE
    }))
  );
  const seventh = await context.deductionsService.preview(
    createDto({ actionId: "action-absent", incidentDate: TODAY_DATE }),
    champActor
  );
  assert.equal(seventh.occurrenceNumber, 7);
  assert.equal(
    seventh.penalty.penaltyType,
    DeductionPenaltyType.LIFECYCLE_REVIEW_REQUIRED
  );
}

async function testOverflowOccurrenceRepeatsHighestRule() {
  const context = createStore();
  context.store.cases.push(
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `attitude-${index}`,
      requestId: `attitude-request-${index}`,
      targetUserId: "picker-1",
      actionId: "action-attitude",
      incidentMonth: CURRENT_MONTH,
      status: DeductionCaseStatus.EFFECTIVE
    }))
  );

  const fourth = await context.deductionsService.preview(
    createDto({ incidentDate: TODAY_DATE }),
    champActor
  );

  assert.equal(fourth.occurrenceNumber, 4);
  assert.equal(
    fourth.penalty.penaltyType,
    DeductionPenaltyType.LIFECYCLE_REVIEW_REQUIRED,
    "occurrences past the last rule must repeat the highest rule"
  );
  assert.equal(fourth.penalty.label, "Lifecycle review required");
}

async function testPolicySnapshotsAreImmutable() {
  const context = createStore();
  await context.deductionsService.createDeductionRequest(createDto(), {
    actor: champActor
  });
  const storedCase = context.store.cases[0];
  assert.equal(storedCase.penaltyLabel, "0.5 day");

  const secondRule = context.store.policy.actions[0].ruleSteps[1];
  secondRule.deductionDays = 9;
  secondRule.label = "9 days";

  assert.equal(storedCase.penaltyLabel, "0.5 day");
  assert.equal(storedCase.deductionDays, 0.5);
  const snapshot = storedCase.policySnapshot as {
    matchedRule: { label: string };
  };
  assert.equal(snapshot.matchedRule.label, "0.5 day");

  const newPreview = await context.deductionsService.preview(
    createDto({ incidentDate: TODAY_DATE }),
    champActor
  );
  assert.equal(newPreview.occurrenceNumber, 2);
  assert.equal(newPreview.penalty.label, "9 days");
}

async function testAdminFinalApprovalMakesDeductionEffective() {
  const context = createStore();
  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: areaManagerActor }
  );
  const adminApproval = context.store.approvals.find(
    (approval) =>
      approval.requestId === summary.id &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
  );
  assert.ok(adminApproval);

  const finalized = await context.approvalsService.approve(
    adminApproval.id,
    {} as never,
    { actor: adminActor }
  );

  assert.equal(finalized.status, RequestStatus.COMPLETED);
  const storedCase = context.store.cases[0];
  assert.equal(storedCase.status, DeductionCaseStatus.EFFECTIVE);
  assert.equal(storedCase.finalApprovedById, "admin-1");
  assert.ok(storedCase.finalApprovedAt);
  assert.ok(
    context.store.notifications.some(
      (notification) => notification.type === "DEDUCTION_ISSUED"
    ),
    "target user should be notified when the deduction becomes effective"
  );
  assert.deepEqual(context.store.emittedEvents, [
    {
      name: USER_METRICS_UPDATED_EVENT,
      payload: {
        eventId: summary.id,
        userId: storedCase.targetUserId,
        month: CURRENT_MONTH,
        source: "DEDUCTION"
      }
    }
  ]);
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testRejectDoesNotCreateEffectiveDeduction() {
  const context = createStore();
  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: champActor }
  );
  const amApproval = context.store.approvals.find(
    (approval) =>
      approval.requestId === summary.id &&
      approval.step === ApprovalStep.AREA_MANAGER_APPROVAL
  );
  assert.ok(amApproval);

  const rejected = await context.approvalsService.reject(
    amApproval.id,
    { notes: "Not justified" } as never,
    { actor: areaManagerActor }
  );

  assert.equal(rejected.status, RequestStatus.REJECTED);
  assert.equal(context.store.cases[0].status, DeductionCaseStatus.REJECTED);
  assert.deepEqual(context.store.emittedEvents, []);
}

async function testCancelDoesNotCreateEffectiveDeduction() {
  const context = createStore();
  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: champActor }
  );

  const cancelled = await context.requestsService.cancel(
    summary.id,
    { notes: "Created by mistake" } as never,
    { actor: adminActor }
  );

  assert.equal(cancelled.status, RequestStatus.CANCELLED);
  assert.equal(context.store.cases[0].status, DeductionCaseStatus.CANCELLED);
}

async function testTerminationOutcomeIsLifecycleReviewOnly() {
  const context = createStore();
  context.store.cases.push(
    {
      id: "seed-1",
      requestId: "seed-request-1",
      targetUserId: "picker-1",
      actionId: "action-attitude",
      incidentMonth: CURRENT_MONTH,
      status: DeductionCaseStatus.EFFECTIVE
    },
    {
      id: "seed-2",
      requestId: "seed-request-2",
      targetUserId: "picker-1",
      actionId: "action-attitude",
      incidentMonth: CURRENT_MONTH,
      status: DeductionCaseStatus.EFFECTIVE
    }
  );

  const summary = await context.deductionsService.createDeductionRequest(
    createDto({ incidentDate: TODAY_DATE }),
    { actor: areaManagerActor }
  );
  const storedCase = context.store.cases.find(
    (item) => item.requestId === summary.id
  );
  assert.equal(storedCase?.occurrenceNumber, 3);
  assert.equal(
    storedCase?.penaltyType,
    DeductionPenaltyType.LIFECYCLE_REVIEW_REQUIRED
  );
  assert.equal(storedCase?.deductionDays, null);

  const adminApproval = context.store.approvals.find(
    (approval) =>
      approval.requestId === summary.id &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
  );
  assert.ok(adminApproval);
  await context.approvalsService.approve(adminApproval.id, {} as never, {
    actor: adminActor
  });

  assert.equal(
    context.store.cases.find((item) => item.requestId === summary.id)?.status,
    DeductionCaseStatus.EFFECTIVE
  );
  assert.equal(
    context.store.forbiddenMutationCalls.length,
    0,
    "termination outcome must never mutate the user account"
  );
}

async function testGenericCreateBlockedAndMatrixGrants() {
  const context = createStore();

  await assert.rejects(
    context.requestsService.create(
      { type: RequestType.DEDUCTION } as never,
      { actor: champActor }
    ),
    BadRequestException
  );

  const champKeys = SYSTEM_ROLE_PERMISSIONS[UserRole.CHAMP];
  const amKeys = SYSTEM_ROLE_PERMISSIONS[UserRole.AREA_MANAGER];
  const adminKeys = SYSTEM_ROLE_PERMISSIONS[UserRole.ADMIN];
  const pickerKeys = SYSTEM_ROLE_PERMISSIONS[UserRole.PICKER];

  assert.ok(champKeys.includes(PermissionKeys.REQUESTS_CREATE_DEDUCTION_PICKER));
  assert.ok(!champKeys.includes(PermissionKeys.REQUESTS_CREATE_DEDUCTION_CHAMP));
  assert.ok(amKeys.includes(PermissionKeys.REQUESTS_CREATE_DEDUCTION_PICKER));
  assert.ok(amKeys.includes(PermissionKeys.REQUESTS_CREATE_DEDUCTION_CHAMP));
  assert.ok(pickerKeys.includes(PermissionKeys.DEDUCTIONS_VIEW));
  assert.ok(adminKeys.includes(PermissionKeys.DEDUCTIONS_VIEW));
  assert.ok(adminKeys.includes(PermissionKeys.DEDUCTIONS_POLICY_MANAGE));
  assert.ok(!adminKeys.includes(PermissionKeys.REQUESTS_CREATE_DEDUCTION_PICKER));
  assert.ok(!adminKeys.includes(PermissionKeys.REQUESTS_CREATE_DEDUCTION_CHAMP));
}

async function testListAndGetByIdScoping() {
  const context = createStore();
  // Picker-1 (vendor-a/chain-1): one effective + one pending.
  // A deduction filed AGAINST champ-1 (his own vendor-a) — must stay hidden
  // from champ-1 while pending, and from picker views entirely.
  context.store.cases.push(
    richCase({
      id: "picker1-eff",
      targetUserId: "picker-1",
      targetRole: UserRole.PICKER,
      createdById: "champ-1",
      status: DeductionCaseStatus.EFFECTIVE,
      sourceVendorId: "vendor-a",
      sourceChainId: "chain-1"
    }),
    richCase({
      id: "picker1-pending",
      targetUserId: "picker-1",
      targetRole: UserRole.PICKER,
      createdById: "champ-1",
      status: DeductionCaseStatus.PENDING_APPROVAL,
      sourceVendorId: "vendor-a",
      sourceChainId: "chain-1",
      occurrenceNumber: 2
    }),
    richCase({
      id: "champ1-against",
      targetUserId: "champ-1",
      targetRole: UserRole.CHAMP,
      createdById: "am-1",
      status: DeductionCaseStatus.PENDING_APPROVAL,
      sourceVendorId: "vendor-a",
      sourceChainId: "chain-1"
    }),
    richCase({
      id: "picker2-eff",
      targetUserId: "picker-2",
      targetRole: UserRole.PICKER,
      createdById: "champ-2",
      status: DeductionCaseStatus.EFFECTIVE,
      sourceVendorId: "vendor-b",
      sourceChainId: "chain-2"
    })
  );

  // Picker sees only their own EFFECTIVE record — never the pending one.
  const pickerActor = actor("picker-1", UserRole.PICKER);
  const pickerList = await context.deductionsService.list({}, pickerActor);
  assert.deepEqual(
    pickerList.items.map((item) => item.id).sort(),
    ["picker1-eff"]
  );

  // Champ sees Pickers in his branch (pending + effective) but NOT the case
  // filed against himself — the scope-leak guard.
  const champList = await context.deductionsService.list({}, champActor);
  const champIds = champList.items.map((item) => item.id).sort();
  assert.deepEqual(champIds, ["picker1-eff", "picker1-pending"]);
  assert.ok(!champIds.includes("champ1-against"));
  assert.ok(!champIds.includes("picker2-eff"));

  // Area Manager sees everything in his chain (incl. champ-targeted + pending).
  const amList = await context.deductionsService.list({}, areaManagerActor);
  assert.deepEqual(
    amList.items.map((item) => item.id).sort(),
    ["champ1-against", "picker1-eff", "picker1-pending"]
  );

  // getById mirrors the same rules.
  await assert.rejects(
    context.deductionsService.getById("champ1-against", champActor),
    ForbiddenException,
    "Champ must not open a deduction filed against himself while pending"
  );
  const champView = await context.deductionsService.getById(
    "picker1-pending",
    champActor
  );
  assert.equal(champView.id, "picker1-pending");
  await assert.rejects(
    context.deductionsService.getById("picker1-pending", pickerActor),
    ForbiddenException,
    "Picker must not open his own pending deduction"
  );
  const pickerView = await context.deductionsService.getById(
    "picker1-eff",
    pickerActor
  );
  assert.equal(pickerView.id, "picker1-eff");
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testAdminRejectAfterAreaManagerApproval() {
  const context = createStore();
  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: champActor }
  );
  const amApproval = context.store.approvals.find(
    (approval) =>
      approval.requestId === summary.id &&
      approval.step === ApprovalStep.AREA_MANAGER_APPROVAL
  );
  assert.ok(amApproval);

  // AM approves via the generic approvals path -> request advances to admin.
  const advanced = await context.approvalsService.approve(
    amApproval.id,
    {} as never,
    { actor: areaManagerActor }
  );
  assert.equal(advanced.status, RequestStatus.PENDING_ADMIN);
  assert.equal(
    context.store.cases[0].status,
    DeductionCaseStatus.PENDING_APPROVAL
  );

  // Admin rejects at the final step -> case becomes REJECTED, never effective.
  const adminApproval = context.store.approvals.find(
    (approval) =>
      approval.requestId === summary.id &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
  );
  assert.ok(adminApproval);
  const rejected = await context.approvalsService.reject(
    adminApproval.id,
    { notes: "Insufficient evidence" } as never,
    { actor: adminActor }
  );
  assert.equal(rejected.status, RequestStatus.REJECTED);
  assert.equal(context.store.cases[0].status, DeductionCaseStatus.REJECTED);
}

async function testPolicyManagementValidationAndImmutability() {
  const context = createStore();
  const policyService = context.policyService;
  const ctx = { actor: adminActor };

  // Seed an effective case to prove its snapshot survives a later policy edit.
  context.store.cases.push(
    richCase({
      id: "snapshot-eff",
      targetUserId: "picker-1",
      targetRole: UserRole.PICKER,
      createdById: "champ-1",
      status: DeductionCaseStatus.EFFECTIVE,
      sourceVendorId: "vendor-a",
      sourceChainId: "chain-1",
      deductionDays: 0.5
    })
  );

  // Valid full-replacement edit.
  await policyService.updateAction(
    "action-attitude",
    {
      ruleSteps: [
        { occurrenceNumber: 1, penaltyType: "DEDUCTION_DAYS", deductionDays: 0.75, label: "0.75 day" },
        { occurrenceNumber: 2, penaltyType: "DEDUCTION_DAYS", deductionDays: 1.5, label: "1.5 day" }
      ]
    },
    ctx
  );
  const updatedAction = context.store.policy.actions.find(
    (action) => action.id === "action-attitude"
  );
  assert.equal(updatedAction?.ruleSteps.length, 2);
  assert.equal(updatedAction?.ruleSteps[0].deductionDays, 0.75);
  // Historical effective case keeps its original snapshot/penalty.
  assert.equal(context.store.cases.find((c) => c.id === "snapshot-eff")?.deductionDays, 0.5);

  // Gap (no occurrence 1) rejected.
  await assert.rejects(
    policyService.updateAction(
      "action-attitude",
      {
        ruleSteps: [
          { occurrenceNumber: 2, penaltyType: "WARNING", label: "Warning" }
        ]
      },
      ctx
    ),
    BadRequestException
  );

  // Open-ended rule not in the last position rejected.
  await assert.rejects(
    policyService.updateAction(
      "action-attitude",
      {
        ruleSteps: [
          { occurrenceNumber: 1, appliesFromOccurrence: 1, penaltyType: "WARNING", label: "Warning" },
          { occurrenceNumber: 2, penaltyType: "DEDUCTION_DAYS", deductionDays: 1, label: "1 day" }
        ]
      },
      ctx
    ),
    BadRequestException
  );

  // Duplicate code on create rejected.
  await assert.rejects(
    policyService.createAction(
      {
        code: "ATTITUDE",
        name: "Attitude duplicate",
        ruleSteps: [
          { occurrenceNumber: 1, penaltyType: "WARNING", label: "Warning" }
        ]
      },
      ctx
    ),
    ConflictException
  );
}

function seedCase(
  context: ReturnType<typeof createStore>,
  status: DeductionCaseStatus,
  overrides: Partial<StoredCase> = {}
) {
  context.store.cases.push({
    id: `seed-${context.store.cases.length + 1}`,
    requestId: `seed-req-${context.store.cases.length + 1}`,
    targetUserId: "picker-1",
    actionId: "action-attitude",
    incidentMonth: CURRENT_MONTH,
    status,
    ...overrides
  } as StoredCase);
}

async function testDuplicatePendingDeductionBlocked() {
  const context = createStore();
  await context.deductionsService.createDeductionRequest(createDto(), {
    actor: champActor
  });

  await assert.rejects(
    context.deductionsService.createDeductionRequest(createDto(), {
      actor: champActor
    }),
    ConflictException,
    "a second pending ticket for the same target/action/month must be blocked"
  );

  const persisted = context.store.cases.filter(
    (c) =>
      c.targetUserId === "picker-1" &&
      c.actionId === "action-attitude" &&
      c.incidentMonth === CURRENT_MONTH
  );
  assert.equal(persisted.length, 1, "only the first ticket should persist");
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testEffectivePreviousDoesNotBlockAndIncrements() {
  const context = createStore();
  seedCase(context, DeductionCaseStatus.EFFECTIVE);

  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: champActor }
  );
  const created = context.store.cases.find((c) => c.requestId === summary.id);

  assert.equal(created?.status, DeductionCaseStatus.PENDING_APPROVAL);
  assert.equal(
    created?.occurrenceNumber,
    2,
    "an effective prior case must count toward the next occurrence"
  );
  assert.equal(created?.penaltyLabel, "1 day");
}

async function testRejectedPreviousDoesNotBlock() {
  const context = createStore();
  seedCase(context, DeductionCaseStatus.REJECTED);

  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: champActor }
  );
  const created = context.store.cases.find((c) => c.requestId === summary.id);

  assert.equal(created?.status, DeductionCaseStatus.PENDING_APPROVAL);
  assert.equal(
    created?.occurrenceNumber,
    1,
    "a rejected prior case must neither block nor count"
  );
}

async function testCancelledPreviousDoesNotBlock() {
  const context = createStore();
  seedCase(context, DeductionCaseStatus.CANCELLED);

  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: champActor }
  );
  const created = context.store.cases.find((c) => c.requestId === summary.id);

  assert.equal(created?.status, DeductionCaseStatus.PENDING_APPROVAL);
  assert.equal(
    created?.occurrenceNumber,
    1,
    "a cancelled prior case must neither block nor count"
  );
}

async function testAdminFinalApprovalSavesNotes() {
  const context = createStore();
  const summary = await context.deductionsService.createDeductionRequest(
    createDto(),
    { actor: areaManagerActor }
  );
  const adminApproval = context.store.approvals.find(
    (approval) =>
      approval.requestId === summary.id &&
      approval.step === ApprovalStep.ADMIN_FINAL_APPROVAL
  );
  assert.ok(adminApproval);

  const result = await context.approvalsService.approve(
    adminApproval.id,
    { notes: "Confirmed with branch evidence." } as never,
    { actor: adminActor }
  );

  assert.equal(result.status, RequestStatus.COMPLETED);
  assert.equal(
    context.store.approvals.find((a) => a.id === adminApproval.id)?.notes,
    "Confirmed with branch evidence.",
    "Admin final approval notes must be saved on the approval step"
  );
  assert.equal(
    context.store.cases.find((c) => c.requestId === summary.id)?.status,
    DeductionCaseStatus.EFFECTIVE
  );
}

async function main() {
  await testChampCreatesScopedPickerDeduction();
  await testChampCannotCreateOutsideBranchScope();
  await testAreaManagerCreatesForPickerAndChampDirectToAdmin();
  await testOccurrenceUsesIncidentMonth();
  await testOverflowOccurrenceRepeatsHighestRule();
  await testPolicySnapshotsAreImmutable();
  await testAdminFinalApprovalMakesDeductionEffective();
  await testRejectDoesNotCreateEffectiveDeduction();
  await testCancelDoesNotCreateEffectiveDeduction();
  await testTerminationOutcomeIsLifecycleReviewOnly();
  await testGenericCreateBlockedAndMatrixGrants();
  await testListAndGetByIdScoping();
  await testAdminRejectAfterAreaManagerApproval();
  await testPolicyManagementValidationAndImmutability();
  await testDuplicatePendingDeductionBlocked();
  await testEffectivePreviousDoesNotBlockAndIncrements();
  await testRejectedPreviousDoesNotBlock();
  await testCancelledPreviousDoesNotBlock();
  await testAdminFinalApprovalSavesNotes();
  console.log("deductions workflow tests passed");
}

void main();
