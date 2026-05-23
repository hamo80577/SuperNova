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

import { NewHireApprovalService } from "../src/requests/workflows/new-hire-approval.service";
import { NewHireFinalizationService } from "../src/requests/workflows/new-hire-finalization.service";
import { parseNewHirePayload } from "../src/requests/workflows/new-hire-payload";

const now = new Date("2026-01-01T10:00:00.000Z");

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
    joiningDate: null,
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

function newHireRequest(
  targetRole: UserRole.PICKER | UserRole.CHAMP,
  payloadOverrides: Record<string, unknown> = {}
) {
  return {
    id: "request-1",
    type: RequestType.NEW_HIRE,
    status: RequestStatus.PENDING_AREA_MANAGER,
    currentStep: ApprovalStep.AREA_MANAGER_APPROVAL,
    createdById: "creator-1",
    targetUserId: null,
    sourceVendorId: vendor.id,
    sourceChainId: chain.id,
    destinationVendorId: null,
    destinationChainId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: user("creator-1", UserRole.CHAMP),
    targetUser: null,
    sourceVendor: vendor,
    sourceChain: chain,
    destinationVendor: null,
    destinationChain: null,
    payload: {
      targetRole,
      mode: targetRole === UserRole.PICKER ? "NEW_PICKER" : "NEW_CHAMP",
      candidate: {
        nameEn: "Candidate",
        phoneNumber: "01012345678",
        nationalId: "12345678901234",
        ...(targetRole === UserRole.PICKER
          ? { actualJoiningDate: "2026-06-01" }
          : {}),
        gender: Gender.UNSPECIFIED
      },
      source: {
        vendorId: vendor.id,
        chainId: chain.id
      },
      ...payloadOverrides
    },
    approvals: []
  } as any;
}

function approvalForRequest(request: any) {
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

  return approval;
}

function approvalServiceHarness(request: any, options: { existingShopper?: any } = {}) {
  const approval = approvalForRequest(request);
  let updatedPayload: any = null;
  const prisma = {
    requestApproval: {
      findUnique: async () => approval
    },
    chainAreaManagerAssignment: {
      findFirst: async () => ({ id: "area-manager-assignment-1" })
    },
    user: {
      findUnique: async (args: any) =>
        args.where?.shopperId ? options.existingShopper ?? null : null
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
              ...request,
              status: args.data.status,
              currentStep: args.data.currentStep,
              payload: args.data.payload,
              approvals: request.approvals.map((item: any) =>
                item.id === approval.id
                  ? {
                      ...item,
                      status: ApprovalStatus.APPROVED,
                      decisionAt: now
                    }
                  : item
              )
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
    service: new NewHireApprovalService(prisma as any),
    getUpdatedPayload: () => updatedPayload
  };
}

function pendingAdminRequest(payloadOverrides: Record<string, unknown> = {}) {
  const request = {
    ...newHireRequest(UserRole.PICKER, payloadOverrides),
    status: RequestStatus.PENDING_ADMIN,
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL
  };
  request.approvals = [
    {
      id: "admin-approval-1",
      requestId: request.id,
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
  ];
  return request as any;
}

function pendingAdminAreaManagerRequest(payloadOverrides: Record<string, unknown> = {}) {
  const request = {
    id: "area-manager-request",
    type: RequestType.NEW_HIRE,
    status: RequestStatus.PENDING_ADMIN,
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    createdById: "admin-1",
    targetUserId: null,
    sourceVendorId: null,
    sourceChainId: null,
    destinationVendorId: null,
    destinationChainId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: user("admin-1", UserRole.ADMIN),
    targetUser: null,
    sourceVendor: null,
    sourceChain: null,
    destinationVendor: null,
    destinationChain: null,
    payload: {
      targetRole: UserRole.AREA_MANAGER,
      mode: "NEW_AREA_MANAGER",
      candidate: {
        nameEn: "New Area Manager",
        phoneNumber: "01055555555",
        nationalId: "55555555555555",
        gender: Gender.UNSPECIFIED
      },
      source: {},
      ...payloadOverrides
    },
    approvals: [
      {
        id: "admin-approval-1",
        requestId: "area-manager-request",
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
  request.approvals[0].request = request;
  return request;
}

function finalizationHarness(request: any) {
  let createdUserData: any = null;
  const createdUser = user("created-picker", UserRole.PICKER, {
    phoneNumber: "01012345678",
    nationalId: "12345678901234",
    shopperId: "SHOP_STORED",
    mustChangePassword: true,
    profileStatus: ProfileStatus.INCOMPLETE
  });
  const assignment = {
    id: "assignment-1",
    pickerId: createdUser.id,
    vendorId: vendor.id,
    status: AssignmentStatus.ACTIVE,
    startDate: now,
    endDate: null,
    createdByRequestId: request.id,
    createdAt: now,
    updatedAt: now
  } as any;

  const prisma = {
    request: {
      findUnique: async () => request
    },
    user: {
      findUnique: async () => null
    },
    vendor: {
      findUnique: async () => vendor
    },
    $transaction: async (callback: any) =>
      callback({
        user: {
          create: async (args: any) => {
            createdUserData = args.data;
            return {
              ...createdUser,
              shopperId: args.data.shopperId
            };
          },
          update: async () => {
            throw new Error("Rehire update should not run in this test.");
          }
        },
        pickerBranchAssignment: {
          create: async () => assignment
        },
        vendorChampAssignment: {
          create: async () => {
            throw new Error("Champ assignment should not run in this test.");
          },
          findMany: async () => []
        },
        requestApproval: {
          update: async () => ({})
        },
        request: {
          update: async (args: any) => ({
            ...request,
            status: args.data.status,
            currentStep: args.data.currentStep,
            completedAt: args.data.completedAt,
            targetUserId: createdUser.id,
            targetUser: createdUser,
            payload: args.data.payload
          })
        },
        notification: {
          create: async () => ({}),
          createMany: async () => ({})
        },
        chainAreaManagerAssignment: {
          findMany: async () => []
        },
        auditLog: {
          createMany: async () => ({})
        }
      })
  };

  return {
    service: new NewHireFinalizationService(
      prisma as any,
      {
        findCandidateUserById: async () => null,
        evaluateNewHireMatch: () => ({ decision: "ACTIVE_DUPLICATE" })
      } as any,
      {
        generate: () => "TempPass123",
        encrypt: () => "ciphertext"
      } as any
    ),
    getCreatedUserData: () => createdUserData
  };
}

function areaManagerFinalizationHarness(request: any) {
  let chainAssignmentCreateCalled = false;
  const createdUser = user("created-area-manager", UserRole.AREA_MANAGER, {
    phoneNumber: "01055555555",
    nationalId: "55555555555555",
    mustChangePassword: true,
    profileStatus: ProfileStatus.COMPLETE
  });

  const prisma = {
    request: {
      findUnique: async () => request
    },
    user: {
      findUnique: async () => null
    },
    $transaction: async (callback: any) =>
      callback({
        user: {
          create: async () => createdUser
        },
        chainAreaManagerAssignment: {
          create: async () => {
            chainAssignmentCreateCalled = true;
            throw new Error("Area Manager New Hire must not create Chain assignments.");
          }
        },
        requestApproval: {
          update: async () => ({})
        },
        request: {
          update: async (args: any) => ({
            ...request,
            status: args.data.status,
            currentStep: args.data.currentStep,
            completedAt: args.data.completedAt,
            targetUserId: createdUser.id,
            targetUser: createdUser,
            payload: args.data.payload
          })
        },
        notification: {
          create: async () => ({}),
          createMany: async () => ({})
        },
        auditLog: {
          createMany: async () => ({})
        }
      })
  };

  return {
    service: new NewHireFinalizationService(
      prisma as any,
      {
        findCandidateUserById: async () => null,
        evaluateNewHireMatch: () => ({ decision: "ACTIVE_DUPLICATE" })
      } as any,
      {
        generate: () => "TempPass123",
        encrypt: () => "ciphertext"
      } as any
    ),
    wasChainAssignmentCreateCalled: () => chainAssignmentCreateCalled
  };
}

async function run() {
  await assert.rejects(
    () =>
      approvalServiceHarness(newHireRequest(UserRole.PICKER)).service
        .approveAreaManagerApproval(
          "approval-1",
          {},
          { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
        ),
    /Shopper ID is required for Picker New Hire Area Manager approval/
  );

  {
    const harness = approvalServiceHarness(newHireRequest(UserRole.PICKER));
    await harness.service.approveAreaManagerApproval(
      "approval-1",
      { shopperId: " SHOP_123 ", notes: "Looks good" },
      { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
    );

    assert.equal(harness.getUpdatedPayload().areaManagerDecision.shopperId, "SHOP_123");
    assert.equal(
      harness.getUpdatedPayload().areaManagerDecision.approvedById,
      "area-manager-1"
    );
    assert.equal(harness.getUpdatedPayload().areaManagerDecision.notes, "Looks good");
  }

  await approvalServiceHarness(newHireRequest(UserRole.CHAMP)).service
    .approveAreaManagerApproval(
      "approval-1",
      {},
      { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
    );

  await assert.rejects(
    () =>
      approvalServiceHarness(newHireRequest(UserRole.CHAMP)).service
        .approveAreaManagerApproval(
          "approval-1",
          { shopperId: "SHOP_IGNORED" },
          { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
        ),
    /Shopper ID is only captured for Picker New Hire approvals/
  );

  await assert.rejects(
    () =>
      finalizationHarness(pendingAdminRequest()).service.finalizeNewHire(
        "request-1",
        {},
        { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
      ),
    /Shopper ID must be captured by the Area Manager before Admin final approval/
  );

  {
    const harness = finalizationHarness(
      pendingAdminRequest({
        areaManagerDecision: {
          shopperId: "SHOP_STORED",
          approvedById: "area-manager-1",
          approvedAt: now.toISOString()
        }
      })
    );
    await harness.service.finalizeNewHire(
      "request-1",
      {},
      { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
    );
    assert.equal(harness.getCreatedUserData().shopperId, "SHOP_STORED");
  }

  {
    const parsed = parseNewHirePayload({
      targetRole: UserRole.AREA_MANAGER,
      mode: "NEW_AREA_MANAGER",
      candidate: {
        nameEn: "New Area Manager",
        phoneNumber: "01055555555",
        nationalId: "55555555555555",
        gender: Gender.UNSPECIFIED
      },
      source: {}
    } as any);

    assert.equal(parsed.targetRole, UserRole.AREA_MANAGER);
    assert.deepEqual(parsed.source, {});
  }

  {
    const harness = areaManagerFinalizationHarness(
      pendingAdminAreaManagerRequest()
    );
    const result = await harness.service.finalizeNewHire(
      "area-manager-request",
      {},
      { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
    );

    assert.equal(result.user.role, UserRole.AREA_MANAGER);
    assert.equal(result.assignment, null);
    assert.deepEqual(result.assignments, []);
    assert.equal(harness.wasChainAssignmentCreateCalled(), false);
  }
}

void run();
