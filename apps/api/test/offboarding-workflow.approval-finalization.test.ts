import assert from "node:assert/strict";

import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { OffboardingApprovalService } from "../src/requests/workflows/offboarding-approval.service";
import { OffboardingFinalizationService } from "../src/requests/workflows/offboarding-finalization.service";

const now = new Date("2026-05-19T10:00:00.000Z");

function user(id: string, role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id,
    role,
    nameEn: id,
    nameAr: null,
    phoneNumber: `010${id.replace(/\D/g, "").padEnd(8, "0").slice(0, 8)}`,
    nationalId: `${id.replace(/\D/g, "").padEnd(14, "1").slice(0, 14)}`,
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    shopperId: null,
    ibsId: null,
    uiTheme: "ORANGE",
    joiningDate: now,
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null,
    passwordHash: "hashed",
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as any;
}

const chain = {
  id: "chain-1",
  chainName: "Chain One",
  chainCode: "C1",
  status: ChainStatus.ACTIVE,
  createdAt: now,
  updatedAt: now
};

const vendor = {
  id: "vendor-1",
  vendorName: "Branch One",
  vendorCode: "B1",
  vendorExternalId: null,
  status: VendorStatus.ACTIVE,
  chainId: chain.id,
  address: null,
  area: null,
  city: null,
  createdAt: now,
  updatedAt: now,
  chain
};

const noopHrSyncService = {
  buildPickerResignationPayload: (input: any) => ({
    ...input,
    requestType: "Resign",
    title: "Picker"
  }),
  createNotSentLog: async () => ({ id: "hr-sync-log-1" }),
  sendToHrSheet: async () => ({
    ok: true,
    status: "SKIPPED",
    reason: "test"
  }),
  markSent: async () => ({}),
  markFailed: async () => ({}),
  markSkipped: async () => ({})
};

function offboardingPayload(
  targetRole: UserRole.PICKER | UserRole.CHAMP | UserRole.AREA_MANAGER,
  overrides: Record<string, unknown> = {}
) {
  return {
    offboarding: {
      type: RequestType.RESIGNATION,
      reasonCode: "POLICY_VIOLATION",
      reason: "Policy violation",
      resignationDate: "2026-05-20",
      ...(targetRole === UserRole.PICKER
        ? { lastWorkingDate: "2026-05-20" }
        : {})
    },
    source:
      targetRole === UserRole.AREA_MANAGER
        ? { chainId: chain.id }
        : { vendorId: vendor.id, chainId: chain.id },
    target: {
      userId: `${targetRole.toLowerCase()}-1`,
      targetRole,
      assignmentId: "assignment-1",
      assignmentType:
        targetRole === UserRole.PICKER
          ? "PickerBranchAssignment"
          : targetRole === UserRole.CHAMP
            ? "VendorChampAssignment"
            : "ChainAreaManagerAssignment"
    },
    ...overrides
  };
}

function requestForFinalization(
  targetRole: UserRole.PICKER | UserRole.CHAMP | UserRole.AREA_MANAGER,
  payloadOverrides: Record<string, unknown> = {}
) {
  const targetUser = user(`${targetRole.toLowerCase()}-1`, targetRole);
  return {
    id: "request-1",
    type: RequestType.RESIGNATION,
    status: RequestStatus.PENDING_ADMIN,
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    createdById: "creator-1",
    targetUserId: targetUser.id,
    sourceVendorId: targetRole === UserRole.AREA_MANAGER ? null : vendor.id,
    sourceChainId: chain.id,
    destinationVendorId: null,
    destinationChainId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: user("creator-1", UserRole.CHAMP),
    targetUser,
    sourceVendor: targetRole === UserRole.AREA_MANAGER ? null : vendor,
    sourceChain: chain,
    destinationVendor: null,
    destinationChain: null,
    payload: offboardingPayload(targetRole, payloadOverrides),
    approvals: [
      {
        id: "admin-approval-1",
        requestId: "request-1",
        step: ApprovalStep.ADMIN_FINAL_APPROVAL,
        approverRole: UserRole.ADMIN,
        approverId: null,
        approver: null,
        status: ApprovalStatus.PENDING,
        decisionAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now
      }
    ]
  } as any;
}

function finalizationHarness(request: any) {
  let userUpdateData: any = null;
  let completedPayload: any = null;

  const prisma = {
    request: {
      findUnique: async () => request
    },
    user: {
      findUnique: async () => request.targetUser
    },
    $transaction: async (callback: any) =>
      callback({
        user: {
          update: async (args: any) => {
            userUpdateData = args.data;
            return {
              ...request.targetUser,
              ...args.data,
              updatedAt: now
            };
          }
        },
        requestApproval: {
          update: async () => ({})
        },
        request: {
          update: async (args: any) => {
            completedPayload = args.data.payload;
            return {
              ...request,
              status: args.data.status,
              currentStep: args.data.currentStep,
              completedAt: args.data.completedAt,
              payload: args.data.payload,
              targetUser: {
                ...request.targetUser,
                ...userUpdateData
              }
            };
          }
        },
        notification: {
          create: async () => ({})
        },
        auditLog: {
          createMany: async () => ({})
        }
      })
  };

  const targetService = {
    resolveActiveAssignmentsForFinalization: async () => [
      {
        id: "assignment-1",
        startDate: now,
        status: AssignmentStatus.ACTIVE
      }
    ],
    closeActiveAssignments: async (_tx: any, _targetRole: UserRole, assignments: any[], completedAt: Date) =>
      assignments.map((assignment) => ({
        ...assignment,
        status: AssignmentStatus.CLOSED,
        endDate: completedAt,
        vendorId: request.sourceVendorId,
        chainId: request.sourceChainId,
        pickerId:
          request.targetUser.role === UserRole.PICKER ? request.targetUser.id : undefined,
        champId:
          request.targetUser.role === UserRole.CHAMP ? request.targetUser.id : undefined,
        areaManagerId:
          request.targetUser.role === UserRole.AREA_MANAGER
            ? request.targetUser.id
            : undefined,
        createdByRequestId: request.id
      }))
  };

  return {
    service: new OffboardingFinalizationService(
      prisma as any,
      targetService as any,
      noopHrSyncService as any
    ),
    getUserUpdateData: () => userUpdateData,
    getCompletedPayload: () => completedPayload
  };
}

function requestForAreaManagerApproval(
  targetRole: UserRole.PICKER | UserRole.CHAMP = UserRole.PICKER
) {
  const request = {
    id: "request-approval-1",
    type: RequestType.RESIGNATION,
    status: RequestStatus.PENDING_AREA_MANAGER,
    currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
    createdById: "creator-1",
    targetUserId: `${targetRole.toLowerCase()}-1`,
    sourceVendorId: vendor.id,
    sourceChainId: chain.id,
    destinationVendorId: null,
    destinationChainId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: user("creator-1", UserRole.CHAMP),
    targetUser: user(`${targetRole.toLowerCase()}-1`, targetRole),
    sourceVendor: vendor,
    sourceChain: chain,
    destinationVendor: null,
    destinationChain: null,
    payload: offboardingPayload(targetRole),
    approvals: []
  } as any;

  const approval = {
    id: "approval-1",
    requestId: request.id,
    step: ApprovalStep.AREA_MANAGER_APPROVAL,
    approverRole: UserRole.AREA_MANAGER,
    approverId: "area-manager-1",
    approver: user("area-manager-1", UserRole.AREA_MANAGER),
    status: ApprovalStatus.PENDING,
    decisionAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    request
  } as any;

  request.approvals = [
    approval,
    {
      ...approval,
      id: "admin-approval-1",
      step: ApprovalStep.ADMIN_FINAL_APPROVAL,
      approverRole: UserRole.ADMIN,
      approverId: null
    }
  ];

  return { approval, request };
}

function approvalHarness(approval: any) {
  let updatedPayload: any = null;

  const prisma = {
    requestApproval: {
      findUnique: async () => approval
    },
    chainAreaManagerAssignment: {
      findFirst: async () => ({ id: "area-manager-assignment-1" })
    },
    $transaction: async (callback: any) =>
      callback({
        requestApproval: {
          update: async () => ({})
        },
        request: {
          update: async (args: any) => {
            updatedPayload = args.data.payload;
            return {
              ...approval.request,
              status: args.data.status,
              currentStep: args.data.currentStep,
              payload: args.data.payload
            };
          }
        },
        notification: {
          create: async () => ({}),
          createMany: async () => ({})
        },
        user: {
          findMany: async () => []
        },
        auditLog: {
          createMany: async () => ({})
        }
      })
  };

  return {
    service: new OffboardingApprovalService(prisma as any),
    getUpdatedPayload: () => updatedPayload
  };
}

async function run() {
  await assert.rejects(
    () =>
      approvalHarness(requestForAreaManagerApproval().approval).service
        .approveAreaManagerApproval(
          "approval-1",
          {},
          { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
        ),
    /Area Manager block decision is required/
  );

  {
    const harness = approvalHarness(requestForAreaManagerApproval().approval);
    await harness.service.approveAreaManagerApproval(
      "approval-1",
      { blockDecision: "NO_BLOCK" },
      { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
    );

    assert.equal(
      harness.getUpdatedPayload().areaManagerDecision.blockDecision,
      "NO_BLOCK"
    );
    assert.equal(
      harness.getUpdatedPayload().areaManagerDecision.blockStatus,
      BlockStatus.NO_BLOCK
    );
    assert.equal(harness.getUpdatedPayload().areaManagerDecision.blockReason, null);
  }

  {
    const harness = approvalHarness(requestForAreaManagerApproval().approval);
    await harness.service.approveAreaManagerApproval(
      "approval-1",
      { blockDecision: "PERMANENT", blockReason: "  policy breach  " },
      { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
    );

    assert.equal(
      harness.getUpdatedPayload().areaManagerDecision.blockDecision,
      "PERMANENT"
    );
    assert.equal(
      harness.getUpdatedPayload().areaManagerDecision.blockStatus,
      BlockStatus.PERMANENT_BLOCK
    );
    assert.equal(
      harness.getUpdatedPayload().areaManagerDecision.blockReason,
      "policy breach"
    );
  }

  await assert.rejects(
    () =>
      finalizationHarness(requestForFinalization(UserRole.PICKER)).service
        .finalizeOffboarding(
          "request-1",
          {
            blockDecision: "PERMANENT",
            blockReason: "Admin override",
            confirmInternalDeactivation: true
          } as any,
          { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
        ),
    /Area Manager block decision is required before Admin finalization/
  );

  {
    const harness = finalizationHarness(
      requestForFinalization(UserRole.PICKER, {
        areaManagerDecision: {
          decidedAt: now.toISOString(),
          decidedById: "area-manager-1",
          blockDecision: "PERMANENT",
          blockStatus: BlockStatus.PERMANENT_BLOCK,
          blockReason: "Policy breach"
        }
      })
    );

    await harness.service.finalizeOffboarding(
      "request-1",
      {
        blockDecision: "NO_BLOCK",
        confirmInternalDeactivation: true
      } as any,
      { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
    );

    assert.equal(harness.getUserUpdateData().blockStatus, BlockStatus.PERMANENT_BLOCK);
    assert.equal(harness.getUserUpdateData().blockReason, "Policy breach");
    assert.equal(harness.getUserUpdateData().blockedUntil, null);
    assert.equal(
      harness.getCompletedPayload().finalization.blockDecision,
      "PERMANENT"
    );
    assert.equal(
      "blockedUntil" in harness.getCompletedPayload().finalization,
      false
    );
  }

  {
    const harness = finalizationHarness(requestForFinalization(UserRole.AREA_MANAGER));
    await harness.service.finalizeOffboarding(
      "request-1",
      {
        blockDecision: "PERMANENT",
        blockReason: "Admin override",
        confirmInternalDeactivation: true
      } as any,
      { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
    );

    assert.equal(harness.getUserUpdateData().blockStatus, BlockStatus.NO_BLOCK);
    assert.equal(harness.getUserUpdateData().blockReason, null);
    assert.equal(harness.getUserUpdateData().blockedUntil, null);
    assert.equal(
      harness.getCompletedPayload().finalization.blockDecision,
      "NO_BLOCK"
    );
  }
}

void run();
