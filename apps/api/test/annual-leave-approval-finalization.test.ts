import assert from "node:assert/strict";

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

import { PermissionKeys, type PermissionKey } from "../src/access-control";
import { ApprovalsService } from "../src/approvals/approvals.service";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { USER_METRICS_UPDATED_EVENT } from "../src/dashboard-cache/dashboard-cache.constants";

function actor(role: UserRole, id = `actor-${role.toLowerCase()}`) {
  return {
    id,
    role,
    nameEn: id,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  } as AuthenticatedUser;
}

function user(role: UserRole, id: string) {
  return {
    id,
    ibsId: null,
    shopperId: null,
    role,
    nameEn: id,
    nameAr: null,
    phoneNumber: "01000000000",
    nationalId: null,
    address: null,
    dateOfBirth: null,
    gender: "UNSPECIFIED",
    uiTheme: "ORANGE",
    joiningDate: new Date("2025-01-01T00:00:00.000Z"),
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

function annualLeaveAdminApproval() {
  const createdAt = new Date("2026-06-01T10:00:00.000Z");
  const request = {
    id: "annual-request-1",
    type: RequestType.ANNUAL_LEAVE,
    status: RequestStatus.PENDING_ADMIN,
    createdById: "picker-1",
    targetUserId: "picker-1",
    sourceChainId: "chain-1",
    sourceVendorId: "vendor-1",
    destinationChainId: null,
    destinationVendorId: null,
    payload: {
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      reason: "Family"
    },
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
    createdBy: user(UserRole.PICKER, "picker-1"),
    targetUser: user(UserRole.PICKER, "picker-1"),
    sourceChain: null,
    sourceVendor: null,
    destinationChain: null,
    destinationVendor: null,
    annualLeaveRequest: {
      targetUserId: "picker-1",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-03T00:00:00.000Z"),
      requestedDays: 3,
      reason: "Family",
      contextVendorId: "vendor-1",
      contextChainId: "chain-1",
      balanceCarriedSnapshot: null,
      balanceAccruedSnapshot: null,
      balanceTakenSnapshot: null,
      balanceHeldSnapshot: null,
      availableBeforeRequestSnapshot: null,
      availableAfterRequestSnapshot: null
    }
  };
  const approval = {
    id: "approval-admin-final",
    requestId: request.id,
    step: ApprovalStep.ADMIN_FINAL_APPROVAL,
    approverRole: UserRole.ADMIN,
    approverId: null,
    status: ApprovalStatus.PENDING,
    decisionAt: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
    approver: null,
    request
  };

  request.approvals = [approval] as never[];
  return approval;
}

async function run() {
  const admin = actor(UserRole.ADMIN, "admin-1");
  const approval = annualLeaveAdminApproval();
  const policyChecks: string[] = [];
  const annualLeaveValidations: string[] = [];
  const requestUpdates: Array<Record<string, unknown>> = [];
  const approvalUpdates: Array<Record<string, unknown>> = [];
  const forbiddenWrites: string[] = [];
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];

  const service = new (ApprovalsService as any)(
    { log: async () => undefined },
    {
      create: async () => undefined,
      notifyAdmins: async () => undefined
    },
    {
      requestApproval: {
        findUnique: async () => approval
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          requestApproval: {
            update: async ({ data }: { data: Record<string, unknown> }) => {
              approvalUpdates.push(data);
              return { ...approval, ...data };
            }
          },
          request: {
            update: async ({ data }: { data: Record<string, unknown> }) => {
              requestUpdates.push(data);
              return {
                ...approval.request,
                ...data,
                approvals: [{ ...approval, ...approvalUpdates.at(-1) }]
              };
            }
          },
          attendanceDailyRecord: {
            create: async () => {
              forbiddenWrites.push("attendanceDailyRecord.create");
              throw new Error("Attendance writes are out of scope.");
            },
            createMany: async () => {
              forbiddenWrites.push("attendanceDailyRecord.createMany");
              throw new Error("Attendance writes are out of scope.");
            }
          },
          user: {
            update: async () => {
              forbiddenWrites.push("user.update");
              throw new Error("User writes are out of scope.");
            }
          },
          pickerBranchAssignment: {
            update: async () => {
              forbiddenWrites.push("pickerBranchAssignment.update");
              throw new Error("Assignment writes are out of scope.");
            }
          }
        })
    },
    {
      statusForStep: () => RequestStatus.PENDING_ADMIN,
      userCanActOnStep: async () => true
    },
    { finalizeFromAdminApproval: async () => undefined },
    {
      assertCan: (_actor: AuthenticatedUser, permissionKey: PermissionKey) => {
        policyChecks.push(permissionKey);
      }
    },
    {
      assertApprovalStillValid: async (requestId: string, approvalId: string) => {
        annualLeaveValidations.push(`${requestId}:${approvalId}`);
      }
    },
    {
      emit: (name: string, payload: unknown) => {
        emittedEvents.push({ name, payload });
        return true;
      }
    }
  ) as ApprovalsService;

  const result = await service.approve(
    approval.id,
    { notes: "Approved" },
    { actor: admin, ipAddress: "127.0.0.1", userAgent: "test" }
  );

  assert.deepEqual(policyChecks, [
    PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
  ]);
  assert.deepEqual(annualLeaveValidations, [
    "annual-request-1:approval-admin-final"
  ]);

  const approvalUpdate = approvalUpdates[0];
  const requestUpdate = requestUpdates[0];
  assert.equal(approvalUpdate.status, ApprovalStatus.APPROVED);
  assert.equal(requestUpdate.status, RequestStatus.APPROVED);
  assert.equal(requestUpdate.currentStep, null);
  assert.ok(requestUpdate.completedAt instanceof Date);
  assert.equal(requestUpdate.completedAt, approvalUpdate.decisionAt);
  assert.equal(result.status, RequestStatus.APPROVED);
  assert.equal(result.currentStep, null);
  assert.equal(result.completedAt, requestUpdate.completedAt);
  assert.deepEqual(emittedEvents, [
    {
      name: USER_METRICS_UPDATED_EVENT,
      payload: {
        eventId: "annual-request-1",
        userId: "picker-1",
        month: "2026-07",
        source: "ANNUAL_LEAVE"
      }
    }
  ]);
  assert.deepEqual(forbiddenWrites, []);
}

void run();
