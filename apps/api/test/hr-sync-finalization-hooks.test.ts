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
  HrSyncStatus,
  HrSyncTargetSheet,
  HrSyncWorkflowType,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { NewHireFinalizationService } from "../src/requests/workflows/new-hire-finalization.service";
import { OffboardingFinalizationService } from "../src/requests/workflows/offboarding-finalization.service";

const now = new Date("2026-05-24T10:00:00.000Z");

type HrSyncCall = Readonly<{
  method: string;
  input: any;
  inTransaction: boolean;
}>;

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

function adminContext() {
  return {
    actor: {
      id: "admin-1",
      role: UserRole.ADMIN,
      nameEn: "Admin Finalizer",
      phoneNumber: "01099999999"
    } as any,
    ipAddress: "127.0.0.1",
    userAgent: "test"
  };
}

function createHrSyncMock(
  options: {
    inTransaction?: () => boolean;
    sendResult?: any;
    sendThrows?: Error;
    createThrows?: Error;
  } = {}
) {
  const calls: HrSyncCall[] = [];
  let sequence = 0;
  const record = (method: string, input: any) => {
    calls.push({
      method,
      input,
      inTransaction: options.inTransaction?.() ?? false
    });
  };

  return {
    calls,
    service: {
      buildPickerNewHirePayload: (input: any) => {
        record("buildPickerNewHirePayload", input);
        return {
          ...input,
          requestType: "New Hire",
          vertical: "Local Shops",
          title: "Picker"
        };
      },
      buildPickerRehirePayload: (input: any) => {
        record("buildPickerRehirePayload", input);
        return {
          ...input,
          requestType: "Rehire",
          vertical: "Local Shops",
          title: "Picker"
        };
      },
      buildPickerResignationPayload: (input: any) => {
        record("buildPickerResignationPayload", input);
        return {
          ...input,
          requestType: "Resign",
          title: "Picker"
        };
      },
      createNotSentLog: async (input: any) => {
        record("createNotSentLog", input);
        if (options.createThrows) {
          throw options.createThrows;
        }

        return {
          id: `hr-sync-log-${++sequence}`,
          status: HrSyncStatus.NOT_SENT,
          ...input
        };
      },
      sendToHrSheet: async (input: any) => {
        record("sendToHrSheet", input);
        if (options.sendThrows) {
          throw options.sendThrows;
        }

        return (
          options.sendResult ?? {
            ok: true,
            status: "SENT",
            syncId: "sync-1",
            sheet: "New Hire",
            rowNumber: 7,
            message: "sent",
            rawResponse: {
              ok: true,
              syncId: "sync-1",
              sheet: "New Hire",
              rowNumber: 7
            }
          }
        );
      },
      markSent: async (id: string, input: any) => {
        record("markSent", { id, ...input });
        return { id, status: HrSyncStatus.SENT, ...input };
      },
      markFailed: async (id: string, input: any) => {
        record("markFailed", { id, ...input });
        return { id, status: HrSyncStatus.FAILED, ...input };
      },
      markSkipped: async (id: string, input: any) => {
        record("markSkipped", { id, ...input });
        return { id, status: HrSyncStatus.SKIPPED, ...input };
      }
    }
  };
}

function newHireRequest(
  targetRole: UserRole.PICKER | UserRole.CHAMP | UserRole.AREA_MANAGER,
  overrides: Record<string, unknown> = {}
) {
  const isAreaManager = targetRole === UserRole.AREA_MANAGER;
  const candidate = {
    nameEn:
      targetRole === UserRole.PICKER
        ? "Picker One"
        : targetRole === UserRole.CHAMP
          ? "Champ One"
          : "Area Manager One",
    phoneNumber: "01012345678",
    nationalId: "12345678901234",
    address: "Cairo",
    gender: Gender.UNSPECIFIED,
    ...(targetRole === UserRole.PICKER
      ? { actualJoiningDate: "2026-06-01" }
      : {})
  };

  const request = {
    id: "request-1",
    type: RequestType.NEW_HIRE,
    status: RequestStatus.PENDING_ADMIN,
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    createdById: "creator-1",
    targetUserId: null,
    sourceVendorId: isAreaManager ? null : vendor.id,
    sourceChainId: isAreaManager ? null : chain.id,
    destinationVendorId: null,
    destinationChainId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: user("creator-1", UserRole.CHAMP),
    targetUser: null,
    sourceVendor: isAreaManager ? null : vendor,
    sourceChain: isAreaManager ? null : chain,
    destinationVendor: null,
    destinationChain: null,
    payload: {
      targetRole,
      mode:
        targetRole === UserRole.PICKER
          ? "NEW_PICKER"
          : targetRole === UserRole.CHAMP
            ? "NEW_CHAMP"
            : "NEW_AREA_MANAGER",
      candidate,
      source: isAreaManager
        ? {}
        : {
            vendorId: vendor.id,
            chainId: chain.id
          },
      ...(targetRole === UserRole.PICKER
        ? {
            areaManagerDecision: {
              shopperId: "SHOP_123",
              approvedById: "area-manager-1",
              approvedAt: now.toISOString()
            }
          }
        : {}),
      ...overrides
    },
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
  request.approvals[0].request = request;
  return request;
}

function newHireHarness(
  request: any,
  options: {
    hrSync?: ReturnType<typeof createHrSyncMock>;
    rehireUser?: any;
  } = {}
) {
  let inTransaction = false;
  const targetRole = request.payload.targetRole as UserRole;
  const createdUser = user(
    targetRole === UserRole.AREA_MANAGER
      ? "created-area-manager"
      : targetRole === UserRole.CHAMP
        ? "created-champ"
        : "created-picker",
    targetRole,
    {
      nameEn: request.payload.candidate.nameEn,
      phoneNumber: request.payload.candidate.phoneNumber,
      nationalId: request.payload.candidate.nationalId,
      address: request.payload.candidate.address,
      shopperId: targetRole === UserRole.PICKER ? "SHOP_123" : null,
      mustChangePassword: true,
      profileStatus:
        targetRole === UserRole.PICKER
          ? ProfileStatus.INCOMPLETE
          : ProfileStatus.COMPLETE
    }
  );
  const rehireUser = options.rehireUser ?? createdUser;
  const assignment = {
    id: "assignment-1",
    pickerId: targetRole === UserRole.PICKER ? createdUser.id : undefined,
    champId: targetRole === UserRole.CHAMP ? createdUser.id : undefined,
    vendorId: vendor.id,
    status: AssignmentStatus.ACTIVE,
    startDate: now,
    endDate: null,
    createdByRequestId: request.id,
    createdAt: now,
    updatedAt: now
  } as any;

  const hrSync =
    options.hrSync ??
    createHrSyncMock({
      inTransaction: () => inTransaction
    });

  const prisma = {
    request: {
      findUnique: async () => request
    },
    user: {
      findUnique: async (args: any) => {
        if (
          request.payload.rehire?.userId &&
          args.where?.id === request.payload.rehire.userId
        ) {
          return rehireUser;
        }
        return null;
      }
    },
    vendor: {
      findUnique: async () => vendor
    },
    vendorChampAssignment: {
      findFirst: async () => null
    },
    $transaction: async (callback: any) => {
      inTransaction = true;
      try {
        return await callback({
          user: {
            create: async (args: any) => ({
              ...createdUser,
              ...args.data,
              id: createdUser.id
            }),
            update: async (args: any) => ({
              ...rehireUser,
              ...args.data,
              id: rehireUser.id
            })
          },
          pickerBranchAssignment: {
            create: async () => assignment
          },
          vendorChampAssignment: {
            create: async () => assignment,
            findMany: async () => []
          },
          chainAreaManagerAssignment: {
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
          auditLog: {
            createMany: async () => ({})
          }
        });
      } finally {
        inTransaction = false;
      }
    }
  };

  return {
    hrSync,
    service: new NewHireFinalizationService(
      prisma as any,
      {
        findCandidateUserById: async () => ({
          ...rehireUser,
          pickerBranchAssignments: [],
          vendorChampAssignments: [],
          chainAreaManagerAssignments: []
        }),
        evaluateNewHireMatch: () => ({ decision: "REHIRE_AVAILABLE" })
      } as any,
      {
        generate: () => "TempPass123",
        encrypt: () => "ciphertext"
      } as any,
      hrSync.service as any
    )
  };
}

function offboardingPayload(
  targetRole: UserRole.PICKER | UserRole.CHAMP | UserRole.AREA_MANAGER,
  overrides: Record<string, unknown> = {}
) {
  return {
    offboarding: {
      type: RequestType.RESIGNATION,
      reasonCode: "VOLUNTARY_QUIT",
      reason: "Voluntary quit",
      resignationDate: "2026-06-30",
      ...(targetRole === UserRole.PICKER
        ? { lastWorkingDate: "2026-06-30" }
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
    ...(targetRole === UserRole.AREA_MANAGER
      ? {}
      : {
          areaManagerDecision: {
            decidedAt: now.toISOString(),
            decidedById: "area-manager-1",
            blockDecision: "NO_BLOCK",
            blockStatus: BlockStatus.NO_BLOCK,
            blockReason: null
          }
        }),
    ...overrides
  };
}

function offboardingRequest(
  targetRole: UserRole.PICKER | UserRole.CHAMP | UserRole.AREA_MANAGER,
  payloadOverrides: Record<string, unknown> = {}
) {
  const targetUser = user(`${targetRole.toLowerCase()}-1`, targetRole, {
    nameEn:
      targetRole === UserRole.PICKER
        ? "Picker One"
        : targetRole === UserRole.CHAMP
          ? "Champ One"
          : "Area Manager One",
    nationalId: "12345678901234"
  });

  const request = {
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
  request.approvals[0].request = request;
  return request;
}

function offboardingHarness(
  request: any,
  options: {
    hrSync?: ReturnType<typeof createHrSyncMock>;
  } = {}
) {
  let inTransaction = false;
  let completedPayload: any = null;
  const hrSync =
    options.hrSync ??
    createHrSyncMock({
      inTransaction: () => inTransaction
    });

  const prisma = {
    request: {
      findUnique: async () => request
    },
    user: {
      findUnique: async () => request.targetUser
    },
    $transaction: async (callback: any) => {
      inTransaction = true;
      try {
        return await callback({
          user: {
            update: async (args: any) => ({
              ...request.targetUser,
              ...args.data,
              updatedAt: now
            })
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
                targetUser: {
                  ...request.targetUser,
                  accountStatus: AccountStatus.ARCHIVED,
                  employmentStatus: EmploymentStatus.RESIGNED
                },
                payload: args.data.payload
              };
            }
          },
          notification: {
            create: async () => ({})
          },
          auditLog: {
            createMany: async () => ({})
          }
        });
      } finally {
        inTransaction = false;
      }
    }
  };

  const targetService = {
    resolveActiveAssignmentsForFinalization: async () => [
      {
        id: "assignment-1",
        startDate: now,
        status: AssignmentStatus.ACTIVE
      }
    ],
    closeActiveAssignments: async (
      _tx: any,
      _targetRole: UserRole,
      assignments: any[],
      completedAt: Date
    ) =>
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
    hrSync,
    service: new OffboardingFinalizationService(
      prisma as any,
      targetService as any,
      hrSync.service as any
    ),
    getCompletedPayload: () => completedPayload
  };
}

function callMethods(calls: HrSyncCall[]) {
  return calls.map((call) => call.method);
}

async function run() {
  {
    const harness = newHireHarness(newHireRequest(UserRole.PICKER));
    const result = await harness.service.finalizeNewHire(
      "request-1",
      {},
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.deepEqual(callMethods(harness.hrSync.calls), [
      "buildPickerNewHirePayload",
      "createNotSentLog",
      "sendToHrSheet",
      "markSent"
    ]);
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "createNotSentLog")
        ?.input.workflowType,
      HrSyncWorkflowType.PICKER_NEW_HIRE
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "createNotSentLog")
        ?.input.targetSheet,
      HrSyncTargetSheet.NEW_HIRE
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "sendToHrSheet")
        ?.input.eventType,
      "NEW_HIRE"
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "sendToHrSheet")
        ?.input.payload.actualJoiningDate,
      "2026-06-01"
    );
    assert.equal(
      harness.hrSync.calls.some((call) => call.inTransaction),
      false,
      "HR Sync calls must run after the finalization transaction."
    );
  }

  {
    const rehireUser = user("rehire-picker", UserRole.PICKER, {
      nameEn: "Picker One",
      phoneNumber: "01012345678",
      nationalId: "12345678901234",
      address: "Old Cairo",
      accountStatus: AccountStatus.ARCHIVED,
      employmentStatus: EmploymentStatus.RESIGNED,
      shopperId: "SHOP_123"
    });
    const request = newHireRequest(UserRole.PICKER, {
      mode: "REHIRE",
      rehire: {
        userId: rehireUser.id,
        matchedBy: ["phoneNumber"],
        previousAccountStatus: AccountStatus.ARCHIVED,
        previousEmploymentStatus: EmploymentStatus.RESIGNED
      }
    });
    const harness = newHireHarness(request, { rehireUser });

    await harness.service.finalizeNewHire("request-1", {}, adminContext());

    assert.deepEqual(callMethods(harness.hrSync.calls).slice(0, 3), [
      "buildPickerRehirePayload",
      "createNotSentLog",
      "sendToHrSheet"
    ]);
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "createNotSentLog")
        ?.input.workflowType,
      HrSyncWorkflowType.PICKER_REHIRE
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "sendToHrSheet")
        ?.input.eventType,
      "REHIRE"
    );
  }

  {
    const hrSync = createHrSyncMock({
      sendResult: {
        ok: true,
        status: "SKIPPED",
        reason: "HR sync is disabled"
      }
    });
    const harness = newHireHarness(newHireRequest(UserRole.PICKER), { hrSync });
    const result = await harness.service.finalizeNewHire(
      "request-1",
      {},
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(hrSync.calls).includes("markSkipped"), true);
  }

  {
    const hrSync = createHrSyncMock({
      sendResult: {
        ok: false,
        status: "FAILED",
        error: "Apps Script failed.",
        rawResponse: { ok: false, error: "Apps Script failed." }
      }
    });
    const harness = newHireHarness(newHireRequest(UserRole.PICKER), { hrSync });
    const result = await harness.service.finalizeNewHire(
      "request-1",
      {},
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(hrSync.calls).includes("markFailed"), true);
    assert.match(
      hrSync.calls.find((call) => call.method === "markFailed")?.input.errorMessage,
      /Apps Script failed/
    );
  }

  {
    const hrSync = createHrSyncMock({
      sendThrows: new Error("Unexpected sender failure.")
    });
    const harness = newHireHarness(newHireRequest(UserRole.PICKER), { hrSync });
    const result = await harness.service.finalizeNewHire(
      "request-1",
      {},
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(hrSync.calls).includes("markFailed"), true);
    assert.match(
      hrSync.calls.find((call) => call.method === "markFailed")?.input.errorMessage,
      /Unexpected sender failure/
    );
  }

  {
    const hrSync = createHrSyncMock({
      createThrows: new Error("HR sync log unavailable.")
    });
    const harness = newHireHarness(newHireRequest(UserRole.PICKER), { hrSync });
    const result = await harness.service.finalizeNewHire(
      "request-1",
      {},
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.deepEqual(callMethods(hrSync.calls), [
      "buildPickerNewHirePayload",
      "createNotSentLog"
    ]);
  }

  {
    const request = newHireRequest(UserRole.PICKER, {
      candidate: {
        nameEn: "Legacy Picker",
        phoneNumber: "01012345678",
        nationalId: "12345678901234",
        gender: Gender.UNSPECIFIED
      }
    });
    const harness = newHireHarness(request);
    const result = await harness.service.finalizeNewHire(
      "request-1",
      {},
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(harness.hrSync.calls).includes("sendToHrSheet"), false);
    assert.equal(callMethods(harness.hrSync.calls).includes("markFailed"), true);
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "markFailed")?.input
        .errorMessage,
      "Missing actualJoiningDate for HR sync."
    );
  }

  for (const targetRole of [UserRole.CHAMP, UserRole.AREA_MANAGER] as const) {
    const harness = newHireHarness(newHireRequest(targetRole));
    await harness.service.finalizeNewHire("request-1", {}, adminContext());
    assert.deepEqual(harness.hrSync.calls, []);
  }

  {
    const request = {
      ...newHireRequest(UserRole.PICKER),
      status: RequestStatus.PENDING_AREA_MANAGER
    };
    const harness = newHireHarness(request);
    await assert.rejects(
      () => harness.service.finalizeNewHire("request-1", {}, adminContext()),
      /not waiting for Admin finalization/
    );
    assert.deepEqual(harness.hrSync.calls, []);
  }

  {
    const harness = offboardingHarness(offboardingRequest(UserRole.PICKER));
    const result = await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.deepEqual(callMethods(harness.hrSync.calls), [
      "buildPickerResignationPayload",
      "createNotSentLog",
      "sendToHrSheet",
      "markSent"
    ]);
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "createNotSentLog")
        ?.input.workflowType,
      HrSyncWorkflowType.PICKER_RESIGNATION
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "createNotSentLog")
        ?.input.targetSheet,
      HrSyncTargetSheet.RESIGN
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "sendToHrSheet")
        ?.input.eventType,
      "RESIGN"
    );
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "sendToHrSheet")
        ?.input.payload.lastWorkingDate,
      "2026-06-30"
    );
    assert.equal(
      harness.hrSync.calls.some((call) => call.inTransaction),
      false,
      "HR Sync calls must run after the finalization transaction."
    );
  }

  {
    const hrSync = createHrSyncMock({
      sendResult: {
        ok: true,
        status: "SKIPPED",
        reason: "HR sync is disabled"
      }
    });
    const harness = offboardingHarness(offboardingRequest(UserRole.PICKER), {
      hrSync
    });
    const result = await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(hrSync.calls).includes("markSkipped"), true);
  }

  {
    const hrSync = createHrSyncMock({
      sendResult: {
        ok: false,
        status: "FAILED",
        error: "Apps Script failed.",
        rawResponse: { ok: false, error: "Apps Script failed." }
      }
    });
    const harness = offboardingHarness(offboardingRequest(UserRole.PICKER), {
      hrSync
    });
    const result = await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(hrSync.calls).includes("markFailed"), true);
  }

  {
    const hrSync = createHrSyncMock({
      sendThrows: new Error("Unexpected sender failure.")
    });
    const harness = offboardingHarness(offboardingRequest(UserRole.PICKER), {
      hrSync
    });
    const result = await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(hrSync.calls).includes("markFailed"), true);
    assert.match(
      hrSync.calls.find((call) => call.method === "markFailed")?.input.errorMessage,
      /Unexpected sender failure/
    );
  }

  {
    const hrSync = createHrSyncMock({
      createThrows: new Error("HR sync log unavailable.")
    });
    const harness = offboardingHarness(offboardingRequest(UserRole.PICKER), {
      hrSync
    });
    const result = await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.deepEqual(callMethods(hrSync.calls), [
      "buildPickerResignationPayload",
      "createNotSentLog"
    ]);
  }

  {
    const request = offboardingRequest(UserRole.PICKER, {
      offboarding: {
        type: RequestType.RESIGNATION,
        reasonCode: "VOLUNTARY_QUIT",
        reason: "Voluntary quit",
        resignationDate: "2026-06-30"
      }
    });
    const harness = offboardingHarness(request);
    const result = await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );

    assert.equal(result.user.role, UserRole.PICKER);
    assert.equal(callMethods(harness.hrSync.calls).includes("sendToHrSheet"), false);
    assert.equal(callMethods(harness.hrSync.calls).includes("markFailed"), true);
    assert.equal(
      harness.hrSync.calls.find((call) => call.method === "markFailed")?.input
        .errorMessage,
      "Missing lastWorkingDate for HR sync."
    );
  }

  for (const targetRole of [UserRole.CHAMP, UserRole.AREA_MANAGER] as const) {
    const harness = offboardingHarness(offboardingRequest(targetRole));
    await harness.service.finalizeOffboarding(
      "request-1",
      { confirmInternalDeactivation: true } as any,
      adminContext()
    );
    assert.deepEqual(harness.hrSync.calls, []);
  }

  {
    const request = {
      ...offboardingRequest(UserRole.PICKER),
      status: RequestStatus.PENDING_AREA_MANAGER
    };
    const harness = offboardingHarness(request);
    await assert.rejects(
      () =>
        harness.service.finalizeOffboarding(
          "request-1",
          { confirmInternalDeactivation: true } as any,
          adminContext()
        ),
      /not waiting for Admin finalization/
    );
    assert.deepEqual(harness.hrSync.calls, []);
  }
}

void run();
