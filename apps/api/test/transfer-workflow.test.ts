import assert from "node:assert/strict";

import {
  AccountStatus,
  ApprovalStep,
  ApprovalStatus,
  AssignmentStatus,
  ChainStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { TransferWorkflowService } from "../src/requests/workflows/transfer-workflow.service";

type HarnessOptions = {
  destinationChainId?: string;
};

type Harness = ReturnType<typeof createHarness>;

const sourceChainId = "chain-source";
const destinationChainId = "chain-destination";
const sourceVendorId = "vendor-source";
const destinationVendorId = "vendor-destination";
const pickerId = "picker-1";
const sourceAreaManagerId = "area-manager-source";
const destinationAreaManagerId = "area-manager-destination";
const wrongAreaManagerId = "area-manager-wrong";
const adminId = "admin-1";

function user(id: string, role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ibsId: null,
    shopperId: role === UserRole.PICKER ? `SHOP-${id}` : null,
    role,
    nameEn: id,
    nameAr: null,
    phoneNumber: `010${id.replace(/\D/g, "").padEnd(8, "0").slice(0, 8)}`,
    nationalId: null,
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    joiningDate: null,
    resignationDate: null,
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: "NO_BLOCK",
    blockedUntil: null,
    blockReason: null,
    passwordHash: "hashed",
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: new Date("2026-05-18T08:00:00.000Z"),
    updatedAt: new Date("2026-05-18T08:00:00.000Z"),
    ...overrides
  };
}

function chain(id: string) {
  return {
    id,
    chainName: id,
    chainCode: id.toUpperCase(),
    status: ChainStatus.ACTIVE,
    createdAt: new Date("2026-05-18T08:00:00.000Z"),
    updatedAt: new Date("2026-05-18T08:00:00.000Z")
  };
}

function vendor(id: string, chainId: string) {
  return {
    id,
    vendorName: id,
    vendorCode: id.toUpperCase(),
    vendorExternalId: null,
    status: VendorStatus.ACTIVE,
    chainId,
    address: null,
    area: null,
    city: null,
    createdAt: new Date("2026-05-18T08:00:00.000Z"),
    updatedAt: new Date("2026-05-18T08:00:00.000Z")
  };
}

function createHarness(options: HarnessOptions = {}) {
  const resolvedDestinationChainId =
    options.destinationChainId ?? destinationChainId;
  const state = {
    users: [
      user(adminId, UserRole.ADMIN),
      user(sourceAreaManagerId, UserRole.AREA_MANAGER),
      user(destinationAreaManagerId, UserRole.AREA_MANAGER),
      user(wrongAreaManagerId, UserRole.AREA_MANAGER),
      user(pickerId, UserRole.PICKER)
    ],
    chains: [chain(sourceChainId), chain(resolvedDestinationChainId)],
    vendors: [
      vendor(sourceVendorId, sourceChainId),
      vendor(destinationVendorId, resolvedDestinationChainId)
    ],
    pickerAssignments: [
      {
        id: "picker-assignment-source",
        pickerId,
        vendorId: sourceVendorId,
        status: AssignmentStatus.ACTIVE,
        startDate: new Date("2026-05-01T08:00:00.000Z"),
        endDate: null,
        createdByRequestId: null,
        createdAt: new Date("2026-05-01T08:00:00.000Z"),
        updatedAt: new Date("2026-05-01T08:00:00.000Z")
      }
    ],
    champAssignments: [],
    areaManagerAssignments: [
      {
        id: "source-area-manager-assignment",
        chainId: sourceChainId,
        areaManagerId: sourceAreaManagerId,
        status: AssignmentStatus.ACTIVE
      },
      {
        id: "destination-area-manager-assignment",
        chainId: resolvedDestinationChainId,
        areaManagerId: destinationAreaManagerId,
        status: AssignmentStatus.ACTIVE
      },
      {
        id: "wrong-area-manager-assignment",
        chainId: "chain-wrong",
        areaManagerId: wrongAreaManagerId,
        status: AssignmentStatus.ACTIVE
      }
    ],
    requests: [] as any[],
    approvals: [] as any[],
    notifications: [] as any[],
    auditLogs: [] as any[],
    nextId: 1
  };

  const findUser = (id: string | null | undefined) =>
    state.users.find((item) => item.id === id) ?? null;
  const findChain = (id: string | null | undefined) =>
    state.chains.find((item) => item.id === id) ?? null;
  const findVendor = (id: string | null | undefined) =>
    state.vendors.find((item) => item.id === id) ?? null;

  const nextId = (prefix: string) => `${prefix}-${state.nextId++}`;
  const now = () => new Date();
  const hydrateVendor = (item: any) =>
    item ? { ...item, chain: findChain(item.chainId) } : null;
  const hydratePickerAssignment = (item: any) =>
    item
      ? {
          ...item,
          picker: findUser(item.pickerId),
          vendor: hydrateVendor(findVendor(item.vendorId))
        }
      : null;
  const hydrateRequest = (item: any) => {
    if (!item) {
      return null;
    }

    return {
      ...item,
      createdBy: findUser(item.createdById),
      targetUser: findUser(item.targetUserId),
      sourceChain: findChain(item.sourceChainId),
      sourceVendor: hydrateVendor(findVendor(item.sourceVendorId)),
      destinationChain: findChain(item.destinationChainId),
      destinationVendor: hydrateVendor(findVendor(item.destinationVendorId)),
      approvals: state.approvals
        .filter((approval) => approval.requestId === item.id)
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime()
        )
        .map((approval) => ({
          ...approval,
          approver: findUser(approval.approverId)
        }))
    };
  };

  const matchesRequestWhere = (item: any, where: any) => {
    if (where.type && item.type !== where.type) {
      return false;
    }

    if (where.targetUserId && item.targetUserId !== where.targetUserId) {
      return false;
    }

    if (where.status?.notIn && where.status.notIn.includes(item.status)) {
      return false;
    }

    return true;
  };

  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => findUser(where.id)
    },
    vendor: {
      findUnique: async ({ where }: any) => hydrateVendor(findVendor(where.id))
    },
    pickerBranchAssignment: {
      findFirst: async ({ where }: any) => {
        const found = state.pickerAssignments.find((item) => {
          if (where.id && item.id !== where.id) {
            return false;
          }

          if (where.pickerId && item.pickerId !== where.pickerId) {
            return false;
          }

          if (where.vendorId && item.vendorId !== where.vendorId) {
            return false;
          }

          if (where.status && item.status !== where.status) {
            return false;
          }

          return true;
        });

        return hydratePickerAssignment(found);
      },
      update: async ({ where, data }: any) => {
        const found = state.pickerAssignments.find((item) => item.id === where.id);
        assert.ok(found, "picker assignment should exist");
        Object.assign(found, data, { updatedAt: now() });
        return hydratePickerAssignment(found);
      },
      create: async ({ data }: any) => {
        const created = {
          id: nextId("picker-assignment"),
          ...data,
          endDate: null,
          createdAt: now(),
          updatedAt: now()
        };
        state.pickerAssignments.push(created);
        return hydratePickerAssignment(created);
      }
    },
    vendorChampAssignment: {
      findFirst: async () => null
    },
    chainAreaManagerAssignment: {
      findFirst: async ({ where }: any) =>
        state.areaManagerAssignments.find((item) => {
          if (where.chainId && item.chainId !== where.chainId) {
            return false;
          }

          if (
            where.areaManagerId &&
            item.areaManagerId !== where.areaManagerId
          ) {
            return false;
          }

          if (where.status && item.status !== where.status) {
            return false;
          }

          return true;
        }) ?? null
    },
    request: {
      findFirst: async ({ where }: any) =>
        state.requests.find((item) => matchesRequestWhere(item, where)) ?? null,
      create: async ({ data }: any) => {
        const created = {
          id: nextId("request"),
          ...data,
          completedAt: null,
          createdAt: now(),
          updatedAt: now()
        };
        state.requests.push(created);
        return created;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const found = state.requests.find((item) => item.id === where.id);
        assert.ok(found, "request should exist");
        return hydrateRequest(found);
      },
      findUnique: async ({ where }: any) =>
        hydrateRequest(state.requests.find((item) => item.id === where.id)),
      update: async ({ where, data }: any) => {
        const found = state.requests.find((item) => item.id === where.id);
        assert.ok(found, "request should exist");
        Object.assign(found, data, { updatedAt: now() });
        return hydrateRequest(found);
      }
    },
    requestApproval: {
      createMany: async ({ data }: any) => {
        for (const item of data) {
          state.approvals.push({
            id: nextId("approval"),
            ...item,
            decisionAt: null,
            notes: null,
            createdAt: now(),
            updatedAt: now()
          });
        }

        return { count: data.length };
      },
      findUnique: async ({ where, include }: any) => {
        const found = state.approvals.find((item) => item.id === where.id);
        if (!found) {
          return null;
        }

        if (include?.request) {
          const request = state.requests.find(
            (item) => item.id === found.requestId
          );
          return {
            ...found,
            request: hydrateRequest(request)
          };
        }

        return found;
      },
      update: async ({ where, data }: any) => {
        const found = state.approvals.find((item) => item.id === where.id);
        assert.ok(found, "approval should exist");
        Object.assign(found, data, { updatedAt: now() });
        return found;
      }
    },
    notification: {
      create: async ({ data }: any) => {
        const created = {
          id: nextId("notification"),
          ...data,
          createdAt: now(),
          readAt: null
        };
        state.notifications.push(created);
        return created;
      }
    },
    auditLog: {
      createMany: async ({ data }: any) => {
        for (const item of data) {
          state.auditLogs.push({
            id: nextId("audit-log"),
            ...item,
            createdAt: now()
          });
        }

        return { count: data.length };
      }
    },
    $transaction: async (operation: any) =>
      typeof operation === "function" ? operation(prisma) : Promise.all(operation)
  };

  const auditService = {
    log: async (entry: any) => {
      state.auditLogs.push({
        id: nextId("audit-log"),
        ...entry,
        createdAt: now()
      });
    }
  };

  const notificationsService = {
    create: async (entry: any) => {
      state.notifications.push({
        id: nextId("notification"),
        ...entry,
        createdAt: now(),
        readAt: null
      });
    }
  };

  const requestApprovalRoutingService = {
    resolveAreaManagerStep: async (step: ApprovalStep, chainId: string) => ({
      step,
      approverRole: UserRole.AREA_MANAGER,
      approverId:
        chainId === sourceChainId
          ? sourceAreaManagerId
          : destinationAreaManagerId,
      chainId
    })
  };

  return {
    state,
    service: new TransferWorkflowService(
      auditService as any,
      notificationsService as any,
      prisma,
      requestApprovalRoutingService as any
    ),
    actors: {
      admin: { id: adminId, role: UserRole.ADMIN },
      sourceAreaManager: {
        id: sourceAreaManagerId,
        role: UserRole.AREA_MANAGER
      },
      destinationAreaManager: {
        id: destinationAreaManagerId,
        role: UserRole.AREA_MANAGER
      },
      wrongAreaManager: {
        id: wrongAreaManagerId,
        role: UserRole.AREA_MANAGER
      }
    }
  };
}

async function createTransfer(harness: Harness) {
  return harness.service.createTransfer(
    {
      targetUserId: pickerId,
      sourceVendorId,
      destinationVendorId,
      reason: "Operational reassignment"
    },
    { actor: harness.actors.admin as any }
  );
}

function approvalFor(harness: Harness, step: ApprovalStep) {
  const approval = harness.state.approvals.find((item) => item.step === step);
  assert.ok(approval, `${step} approval should exist`);
  return approval;
}

function activePickerAssignments(harness: Harness) {
  return harness.state.pickerAssignments.filter(
    (item) => item.pickerId === pickerId && item.status === AssignmentStatus.ACTIVE
  );
}

async function sameChainTransferAppliesAfterSourceApproval() {
  const harness = createHarness({ destinationChainId: sourceChainId });

  const created = await createTransfer(harness);
  assert.equal(created.status, RequestStatus.PENDING_AREA_MANAGER);

  const approved = await harness.service.approveTransferApproval(
    approvalFor(harness, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL).id,
    "approved",
    { actor: harness.actors.sourceAreaManager as any }
  );

  assert.equal(approved.status, RequestStatus.COMPLETED);
  assert.equal(activePickerAssignments(harness).length, 1);
  assert.equal(activePickerAssignments(harness)[0].vendorId, destinationVendorId);
  assert.equal(
    harness.state.pickerAssignments.find(
      (item) => item.id === "picker-assignment-source"
    )?.status,
    AssignmentStatus.CLOSED
  );
}

async function crossChainTransferWaitsForDestinationApproval() {
  const harness = createHarness();

  await createTransfer(harness);
  const sourceApproved = await harness.service.approveTransferApproval(
    approvalFor(harness, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL).id,
    "source approved",
    { actor: harness.actors.sourceAreaManager as any }
  );

  assert.equal(
    sourceApproved.status,
    RequestStatus.PENDING_DESTINATION_AREA_MANAGER
  );
  assert.equal(activePickerAssignments(harness).length, 1);
  assert.equal(activePickerAssignments(harness)[0].vendorId, sourceVendorId);
}

async function crossChainTransferAppliesAfterDestinationApproval() {
  const harness = createHarness();

  await createTransfer(harness);
  await harness.service.approveTransferApproval(
    approvalFor(harness, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL).id,
    "source approved",
    { actor: harness.actors.sourceAreaManager as any }
  );

  const completed = await harness.service.approveTransferApproval(
    approvalFor(harness, ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL).id,
    "destination approved",
    { actor: harness.actors.destinationAreaManager as any }
  );

  assert.equal(completed.status, RequestStatus.COMPLETED);
  assert.equal(activePickerAssignments(harness).length, 1);
  assert.equal(activePickerAssignments(harness)[0].vendorId, destinationVendorId);
}

async function wrongAreaManagerCannotApproveSourceOrDestinationStep() {
  const harness = createHarness();

  await createTransfer(harness);
  await assert.rejects(
    () =>
      harness.service.approveTransferApproval(
        approvalFor(harness, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL).id,
        "wrong approver",
        { actor: harness.actors.destinationAreaManager as any }
      ),
    /You do not own this approval step/
  );

  await harness.service.approveTransferApproval(
    approvalFor(harness, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL).id,
    "source approved",
    { actor: harness.actors.sourceAreaManager as any }
  );

  await assert.rejects(
    () =>
      harness.service.approveTransferApproval(
        approvalFor(harness, ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL).id,
        "wrong approver",
        { actor: harness.actors.sourceAreaManager as any }
      ),
    /You do not own this approval step/
  );
}

async function duplicatePendingTransferIsBlocked() {
  const harness = createHarness();
  harness.state.requests.push({
    id: "pending-transfer",
    type: RequestType.TRANSFER,
    status: RequestStatus.PENDING_AREA_MANAGER,
    createdById: adminId,
    targetUserId: pickerId,
    sourceChainId,
    sourceVendorId,
    destinationChainId,
    destinationVendorId,
    payload: null,
    currentStep: ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await assert.rejects(
    () => createTransfer(harness),
    /pending Transfer request already exists/
  );
}

async function pendingResignationBlocksTransfer() {
  const harness = createHarness();
  harness.state.requests.push({
    id: "pending-resignation",
    type: RequestType.RESIGNATION,
    status: RequestStatus.PENDING_AREA_MANAGER,
    createdById: adminId,
    targetUserId: pickerId,
    sourceChainId,
    sourceVendorId,
    destinationChainId: null,
    destinationVendorId: null,
    payload: null,
    currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await assert.rejects(
    () => createTransfer(harness),
    /pending Resignation request already exists/
  );
}

async function finalApprovalFailsWhenSourceAssignmentChanged() {
  const harness = createHarness({ destinationChainId: sourceChainId });

  await createTransfer(harness);
  const sourceAssignment = harness.state.pickerAssignments.find(
    (item) => item.id === "picker-assignment-source"
  );
  assert.ok(sourceAssignment);
  sourceAssignment.status = AssignmentStatus.CLOSED;

  await assert.rejects(
    () =>
      harness.service.approveTransferApproval(
        approvalFor(harness, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL).id,
        "approved",
        { actor: harness.actors.sourceAreaManager as any }
      ),
    /no longer has an active assignment to the source Branch/
  );
}

async function run() {
  await sameChainTransferAppliesAfterSourceApproval();
  await crossChainTransferWaitsForDestinationApproval();
  await crossChainTransferAppliesAfterDestinationApproval();
  await wrongAreaManagerCannotApproveSourceOrDestinationStep();
  await duplicatePendingTransferIsBlocked();
  await pendingResignationBlocksTransfer();
  await finalApprovalFailsWhenSourceAssignmentChanged();
}

void run();
