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

import { RequestsService } from "../src/requests/requests.service";

const now = new Date("2026-05-24T10:00:00.000Z");

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

function hrSyncLog(
  id: string,
  status: HrSyncStatus,
  createdAt: Date,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    requestId: "request-1",
    workflowType: HrSyncWorkflowType.PICKER_NEW_HIRE,
    targetSheet: HrSyncTargetSheet.NEW_HIRE,
    status,
    payloadSnapshot: {
      secret: "must-not-leak",
      fullNameEnglish: "Picker One"
    },
    responseSnapshot: {
      raw: "must-not-leak"
    },
    errorMessage: null,
    sentAt: status === HrSyncStatus.SENT ? new Date("2026-05-24T10:20:00.000Z") : null,
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

function requestWithHrSyncLogs(hrSyncLogs: any[]) {
  const createdBy = user("creator-1", UserRole.CHAMP);
  const targetUser = user("picker-1", UserRole.PICKER, {
    nameEn: "Picker One",
    shopperId: "SHOP_1"
  });

  return {
    id: "request-1",
    type: RequestType.NEW_HIRE,
    status: RequestStatus.COMPLETED,
    currentStep: null,
    createdById: createdBy.id,
    targetUserId: targetUser.id,
    sourceVendorId: vendor.id,
    sourceChainId: chain.id,
    destinationVendorId: null,
    destinationChainId: null,
    completedAt: new Date("2026-05-24T10:15:00.000Z"),
    createdAt: now,
    updatedAt: now,
    createdBy,
    targetUser,
    sourceVendor: vendor,
    sourceChain: chain,
    destinationVendor: null,
    destinationChain: null,
    payload: {
      targetRole: UserRole.PICKER,
      mode: "NEW_PICKER",
      candidate: {
        nameEn: "Picker One",
        phoneNumber: "01012345678",
        nationalId: "12345678901234",
        actualJoiningDate: "2026-06-01"
      },
      source: {
        vendorId: vendor.id,
        chainId: chain.id
      },
      finalization: {
        userId: targetUser.id,
        completedAt: "2026-05-24T10:15:00.000Z"
      }
    },
    approvals: [
      {
        id: "approval-1",
        requestId: "request-1",
        step: ApprovalStep.ADMIN_FINAL_APPROVAL,
        approverRole: UserRole.ADMIN,
        approverId: "admin-1",
        approver: user("admin-1", UserRole.ADMIN),
        status: ApprovalStatus.APPROVED,
        decisionAt: new Date("2026-05-24T10:15:00.000Z"),
        notes: null,
        createdAt: now,
        updatedAt: now
      }
    ],
    hrSyncLogs
  } as any;
}

function serviceForRequest(request: any) {
  const prisma = {
    request: {
      findUnique: async () => request
    },
    auditLog: {
      findMany: async () => []
    }
  };

  return new RequestsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    prisma as any,
    {} as any
  );
}

async function run() {
  {
    const sent = hrSyncLog(
      "sent-log",
      HrSyncStatus.SENT,
      new Date("2026-05-24T10:20:00.000Z")
    );

    const result = await serviceForRequest(
      requestWithHrSyncLogs([sent])
    ).getById("request-1", {
      id: "admin-1",
      role: UserRole.ADMIN
    } as any);

    assert.deepEqual(result.hrSync, {
      status: "SENT",
      workflowType: "PICKER_NEW_HIRE",
      targetSheet: "NEW_HIRE",
      sentAt: sent.sentAt,
      updatedAt: sent.updatedAt,
      errorMessage: null
    });
  }

  {
    const latest = hrSyncLog(
      "latest-log",
      HrSyncStatus.FAILED,
      new Date("2026-05-24T10:30:00.000Z"),
      {
        errorMessage: "Apps Script returned a failed response.",
        sentAt: null
      }
    );
    const older = hrSyncLog(
      "older-log",
      HrSyncStatus.SENT,
      new Date("2026-05-24T10:20:00.000Z")
    );

    const result = await serviceForRequest(
      requestWithHrSyncLogs([older, latest])
    ).getById("request-1", {
      id: "admin-1",
      role: UserRole.ADMIN
    } as any);

    assert.deepEqual(result.hrSync, {
      status: "FAILED",
      workflowType: "PICKER_NEW_HIRE",
      targetSheet: "NEW_HIRE",
      sentAt: null,
      updatedAt: latest.updatedAt,
      errorMessage: "Apps Script returned a failed response."
    });
    assert.equal("payloadSnapshot" in result.hrSync, false);
    assert.equal("responseSnapshot" in result.hrSync, false);
  }

  {
    const result = await serviceForRequest(
      requestWithHrSyncLogs([])
    ).getById("request-1", {
      id: "admin-1",
      role: UserRole.ADMIN
    } as any);

    assert.equal(result.hrSync, null);
  }
}

void run();
