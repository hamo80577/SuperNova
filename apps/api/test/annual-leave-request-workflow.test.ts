import assert from "node:assert/strict";

import {
  ApprovalStep,
  AssignmentStatus,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { AnnualLeaveRequestService } from "../src/requests/workflows/annual-leave-request.service";
import type { AnnualLeaveBalance } from "../src/users/annual-leave-balance.service";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";

const now = new Date("2026-06-13T10:00:00.000Z");

function actor(role: UserRole, id = `${role.toLowerCase()}-1`): AuthenticatedUser {
  return {
    id,
    role,
    nameEn: id,
    phoneNumber: "01000000000",
    accountStatus: "ACTIVE",
    employmentStatus: "ACTIVE",
    profileStatus: "COMPLETE",
    mustChangePassword: false
  } as AuthenticatedUser;
}

function eligibleBalance(
  overrides: Partial<AnnualLeaveBalance> = {}
): AnnualLeaveBalance {
  return {
    year: 2026,
    asOfDate: "2026-06-13",
    joiningDate: "2025-01-01",
    role: UserRole.PICKER,
    eligibilityStatus: "ELIGIBLE",
    eligibleFrom: "2025-04-01",
    carriedBalanceDays: 7,
    currentYearAccruedDays: 10.5,
    accruedPreviewDays: 10.5,
    annualTakenThisYear: 0,
    remainingDays: 17.5,
    attendanceCoverageFrom: null,
    attendanceCoverageTo: null,
    message: "ok",
    ...overrides
  };
}

interface StoreOptions {
  balance?: AnnualLeaveBalance;
  joiningDate?: Date | null;
  pickerAssignments?: Array<{ vendorId: string; chainId: string }>;
  champAssignments?: Array<{ vendorId: string; chainId: string }>;
  // Champs on each vendor (for resolving the Champ approver of a Picker).
  champsByVendor?: Record<string, string | null>;
  // Other active-hold annual leave requests for this user.
  otherLeaves?: Array<{
    requestId: string;
    startDate: Date;
    endDate: Date;
    status: RequestStatus;
  }>;
  attendanceAnnualDates?: string[];
  // Persisted annual leave row for assertApprovalStillValid.
  storedAnnualLeave?: {
    requestId: string;
    targetUserId: string;
    role: UserRole;
    joiningDate: Date | null;
    requestedDays: number;
    startDate: Date;
    endDate: Date;
  };
}

function buildHarness(role: UserRole, options: StoreOptions = {}) {
  const balance = options.balance ?? eligibleBalance({ role });
  const createdRequests: Record<string, unknown>[] = [];
  const createdApprovals: Record<string, unknown>[][] = [];
  const createdAnnualLeaves: Record<string, unknown>[] = [];
  const auditLogs: Record<string, unknown>[] = [];
  const forbiddenAttendanceWrites: string[] = [];
  const userWrites: Record<string, unknown>[] = [];

  const pickerAssignments = options.pickerAssignments ?? [];
  const champAssignments = options.champAssignments ?? [];
  const otherLeaves = options.otherLeaves ?? [];
  const attendanceAnnualDates = options.attendanceAnnualDates ?? [];

  function activeHold(status: RequestStatus) {
    return [
      RequestStatus.PENDING_CHAMP,
      RequestStatus.PENDING_AREA_MANAGER,
      RequestStatus.PENDING_ADMIN,
      RequestStatus.APPROVED
    ].includes(status);
  }

  const prisma = {
    user: {
      findUnique: async (args: any) => {
        if (args.where?.id) {
          return {
            id: args.where.id,
            role,
            joiningDate:
              options.joiningDate === undefined
                ? new Date("2025-01-01T00:00:00.000Z")
                : options.joiningDate
          };
        }
        return null;
      },
      create: async (args: any) => {
        userWrites.push(args.data);
        throw new Error("User creation is out of scope for annual leave.");
      },
      update: async (args: any) => {
        userWrites.push(args.data);
        throw new Error("User update is out of scope for annual leave.");
      }
    },
    pickerBranchAssignment: {
      findMany: async () =>
        pickerAssignments.map((assignment) => ({
          vendorId: assignment.vendorId,
          vendor: { id: assignment.vendorId, chainId: assignment.chainId }
        }))
    },
    vendorChampAssignment: {
      findMany: async () =>
        champAssignments.map((assignment) => ({
          vendorId: assignment.vendorId,
          vendor: { id: assignment.vendorId, chainId: assignment.chainId }
        })),
      findFirst: async (args: any) => {
        const vendorId = args.where?.vendorId;
        const champId = options.champsByVendor?.[vendorId] ?? null;
        return champId ? { champId } : null;
      }
    },
    annualLeaveRequest: {
      findMany: async (args: any) => {
        const excludeId = args.where?.requestId?.not ?? null;
        return otherLeaves
          .filter((leave) => activeHold(leave.status))
          .filter((leave) => (excludeId ? leave.requestId !== excludeId : true))
          .map((leave) => ({
            startDate: leave.startDate,
            endDate: leave.endDate
          }));
      },
      findFirst: async (args: any) => {
        const excludeId = args.where?.requestId?.not ?? null;
        const start = args.where?.endDate?.gte as Date;
        const end = args.where?.startDate?.lte as Date;
        const match = otherLeaves
          .filter((leave) => activeHold(leave.status))
          .filter((leave) => (excludeId ? leave.requestId !== excludeId : true))
          .find(
            (leave) =>
              leave.startDate.getTime() <= end.getTime() &&
              leave.endDate.getTime() >= start.getTime()
          );
        return match ? { id: match.requestId } : null;
      },
      findUnique: async () => {
        const stored = options.storedAnnualLeave;
        if (!stored) {
          return null;
        }
        return {
          requestId: stored.requestId,
          targetUserId: stored.targetUserId,
          requestedDays: stored.requestedDays,
          startDate: stored.startDate,
          endDate: stored.endDate,
          targetUser: {
            id: stored.targetUserId,
            role: stored.role,
            joiningDate: stored.joiningDate
          }
        };
      },
      create: async (args: any) => {
        createdAnnualLeaves.push(args.data);
        return { id: "annual-leave-1", ...args.data };
      }
    },
    attendanceDailyRecord: {
      findMany: async () =>
        attendanceAnnualDates.map((date) => ({
          shiftDate: new Date(`${date}T00:00:00.000Z`)
        })),
      create: async () => {
        forbiddenAttendanceWrites.push("create");
        throw new Error("Attendance write is out of scope.");
      },
      createMany: async () => {
        forbiddenAttendanceWrites.push("createMany");
        throw new Error("Attendance write is out of scope.");
      },
      update: async () => {
        forbiddenAttendanceWrites.push("update");
        throw new Error("Attendance write is out of scope.");
      }
    },
    request: {
      findUniqueOrThrow: async (args: any) => {
        const request = createdRequests.find((item) => item.id === args.where.id);
        return {
          ...request,
          createdBy: { id: (request as any).createdById, role },
          targetUser: { id: (request as any).targetUserId, role },
          sourceChain: null,
          sourceVendor: null,
          destinationChain: null,
          destinationVendor: null,
          approvals: (createdApprovals.at(-1) ?? []).map((approval) => ({
            ...approval,
            approver: null,
            decisionAt: null,
            notes: null,
            createdAt: now,
            updatedAt: now
          })),
          annualLeaveRequest: createdAnnualLeaves.at(-1) ?? null
        };
      }
    },
    requestApproval: {
      createMany: async (args: any) => {
        createdApprovals.push(args.data);
        return { count: args.data.length };
      }
    },
    auditLog: {
      create: async (args: any) => {
        auditLogs.push(args.data);
        return { id: "audit-1", ...args.data };
      }
    },
    $transaction: async (callback: any) => callback(prisma)
  };

  const balanceService = {
    getForUser: async () => balance
  };

  const approvalRoutingService = {
    resolveAreaManagerStep: async (step: ApprovalStep, chainId: string) => ({
      step,
      approverRole: UserRole.AREA_MANAGER,
      approverId: `am-for-${chainId}`,
      chainId
    })
  };

  const auditService = {
    log: async (params: any) => {
      auditLogs.push(params);
      return { id: "audit-1" };
    }
  };

  const service = new AnnualLeaveRequestService(
    prisma as never,
    balanceService as never,
    approvalRoutingService as never,
    auditService as never
  );

  return {
    service,
    createdRequests,
    createdApprovals,
    createdAnnualLeaves,
    auditLogs,
    forbiddenAttendanceWrites,
    userWrites,
    prisma,
    persistRequest: (request: Record<string, unknown>) => {
      createdRequests.push(request);
    }
  };
}

// Wraps request.create so we record the created request and assign an id.
function withRequestCreate(harness: ReturnType<typeof buildHarness>) {
  (harness.prisma as any).request.create = async (args: any) => {
    const request = { id: "request-1", ...args.data };
    harness.persistRequest(request);
    return request;
  };
  return harness;
}

const context = { ipAddress: "127.0.0.1", userAgent: "test-agent" };

async function run() {
  // Picker creates a self request: 3 steps CHAMP -> AM -> ADMIN, PENDING_CHAMP.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ role: UserRole.PICKER, remainingDays: 17.5 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    const result = await harness.service.createSelfRequest(
      actor(UserRole.PICKER),
      { startDate: "2026-07-01", endDate: "2026-07-03", reason: "Family trip" },
      { actor: actor(UserRole.PICKER), ...context }
    );

    assert.equal(result.status, RequestStatus.PENDING_CHAMP);
    assert.equal(result.currentStep, ApprovalStep.CHAMP_APPROVAL);
    const steps = harness.createdApprovals.at(-1)!;
    assert.deepEqual(
      steps.map((step) => step.step),
      [
        ApprovalStep.CHAMP_APPROVAL,
        ApprovalStep.AREA_MANAGER_APPROVAL,
        ApprovalStep.ADMIN_FINAL_APPROVAL
      ]
    );
    assert.equal(steps[0].approverId, "champ-9");
    assert.equal(steps[0].approverRole, UserRole.CHAMP);
    assert.equal(steps[1].approverId, "am-for-chain-1");
    assert.equal(steps[2].approverId, null);
    assert.equal(steps[2].approverRole, UserRole.ADMIN);

    const annual = harness.createdAnnualLeaves.at(-1)!;
    assert.equal(annual.requestedDays, 3);
    assert.equal(annual.targetRole, UserRole.PICKER);
    assert.equal((annual.balanceHeldSnapshot as any).toNumber(), 0);
    assert.equal((annual.availableBeforeRequestSnapshot as any).toNumber(), 17.5);
    assert.equal((annual.availableAfterRequestSnapshot as any).toNumber(), 14.5);
    assert.ok(
      harness.auditLogs.some(
        (log) => log.action === "ANNUAL_LEAVE_REQUEST_CREATED"
      )
    );
    assert.deepEqual(harness.forbiddenAttendanceWrites, []);
    assert.deepEqual(harness.userWrites, []);
  }

  // Champ creates a self request: 2 steps AM -> ADMIN, PENDING_AREA_MANAGER.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.CHAMP, {
        balance: eligibleBalance({ role: UserRole.CHAMP, remainingDays: 10 }),
        champAssignments: [{ vendorId: "vendor-7", chainId: "chain-7" }]
      })
    );

    const result = await harness.service.createSelfRequest(
      actor(UserRole.CHAMP),
      { startDate: "2026-08-01", endDate: "2026-08-01", reason: "Personal" },
      { actor: actor(UserRole.CHAMP), ...context }
    );

    assert.equal(result.status, RequestStatus.PENDING_AREA_MANAGER);
    assert.equal(result.currentStep, ApprovalStep.AREA_MANAGER_APPROVAL);
    const steps = harness.createdApprovals.at(-1)!;
    assert.deepEqual(
      steps.map((step) => step.step),
      [ApprovalStep.AREA_MANAGER_APPROVAL, ApprovalStep.ADMIN_FINAL_APPROVAL]
    );
    assert.equal(steps[0].approverId, "am-for-chain-7");
    // same-day allowed -> 1 day.
    assert.equal(harness.createdAnnualLeaves.at(-1)!.requestedDays, 1);
    assert.deepEqual(harness.forbiddenAttendanceWrites, []);
  }

  // Picker blocked without an active branch assignment.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, { pickerAssignments: [] })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-01", endDate: "2026-07-03", reason: "Trip" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      /no active branch assignment/
    );
  }

  // Picker blocked when the branch has no active Champ to approve.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": null }
      })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-01", endDate: "2026-07-03", reason: "Trip" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      /No active Champ on your branch/
    );
  }

  // Champ with multiple branches requires a valid contextVendorId.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.CHAMP, {
        champAssignments: [
          { vendorId: "vendor-a", chainId: "chain-a" },
          { vendorId: "vendor-b", chainId: "chain-b" }
        ]
      })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.CHAMP),
          { startDate: "2026-08-01", endDate: "2026-08-02", reason: "x" },
          { actor: actor(UserRole.CHAMP), ...context }
        ),
      /assigned to multiple branches/
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.CHAMP),
          {
            startDate: "2026-08-01",
            endDate: "2026-08-02",
            reason: "x",
            contextVendorId: "vendor-z"
          },
          { actor: actor(UserRole.CHAMP), ...context }
        ),
      /not one of your active assignments/
    );

    // A valid contextVendorId resolves and routes via that branch's chain.
    const ok = await harness.service.createSelfRequest(
      actor(UserRole.CHAMP),
      {
        startDate: "2026-08-01",
        endDate: "2026-08-02",
        reason: "x",
        contextVendorId: "vendor-b"
      },
      { actor: actor(UserRole.CHAMP), ...context }
    );
    assert.equal(ok.status, RequestStatus.PENDING_AREA_MANAGER);
    assert.equal(
      harness.createdApprovals.at(-1)![0].approverId,
      "am-for-chain-b"
    );
  }

  // Not-eligible blocks (NOT_ELIGIBLE).
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({
          eligibilityStatus: "NOT_ELIGIBLE",
          remainingDays: null,
          eligibleFrom: "2026-09-01"
        }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-01", endDate: "2026-07-03", reason: "Trip" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      ForbiddenException
    );
  }

  // Missing joining date blocks.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({
          eligibilityStatus: "MISSING_JOINING_DATE",
          remainingDays: null,
          eligibleFrom: null,
          joiningDate: null
        }),
        joiningDate: null,
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-01", endDate: "2026-07-03", reason: "Trip" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      /Joining date is not set/
    );
  }

  // Insufficient available balance blocks.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 2 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-01", endDate: "2026-07-05", reason: "Trip" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      /exceed the available balance/
    );
  }

  // Pending/approved requests contribute to held -> availableToRequest drops.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 10 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" },
        otherLeaves: [
          {
            requestId: "other-1",
            // 4 days in 2026 currently held.
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: new Date("2026-05-04T00:00:00.000Z"),
            status: RequestStatus.PENDING_ADMIN
          }
        ]
      })
    );

    const preview = await harness.service.preview(actor(UserRole.PICKER), {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      reason: "Trip"
    });

    assert.equal(preview.officialRemainingDays, 10);
    assert.equal(preview.heldDays, 4);
    assert.equal(preview.availableToRequestDays, 6);
    assert.equal(preview.blockingReasons.length, 0);
  }

  // Preview with an invalid date returns a blocking reason instead of throwing.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 10 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    const preview = await harness.service.preview(actor(UserRole.PICKER), {
      startDate: "not-a-date",
      endDate: "2026-07-02",
      reason: "Trip"
    });

    assert.ok(preview.blockingReasons.length > 0);
    assert.equal(preview.requestedDays, 0);
  }

  // Preview for an ineligible user surfaces the eligibility blocking reason
  // without throwing.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({
          eligibilityStatus: "NOT_ELIGIBLE",
          remainingDays: null,
          eligibleFrom: "2026-09-01"
        }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    const preview = await harness.service.preview(actor(UserRole.PICKER), {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      reason: "Trip"
    });

    assert.equal(preview.eligibilityStatus, "NOT_ELIGIBLE");
    assert.ok(preview.blockingReasons.length > 0);
  }

  // Whitespace-only reason is treated as missing: blocks preview AND create.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 10 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );

    const preview = await harness.service.preview(actor(UserRole.PICKER), {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      reason: "   "
    });
    assert.ok(preview.blockingReasons.some((reason) => /reason/i.test(reason)));

    await assert.rejects(
      harness.service.createSelfRequest(
        actor(UserRole.PICKER),
        { startDate: "2026-07-01", endDate: "2026-07-02", reason: "   " },
        { actor: actor(UserRole.PICKER) }
      ),
      BadRequestException
    );
  }

  // Rejected/cancelled requests do NOT contribute to held.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 10 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" },
        otherLeaves: [
          {
            requestId: "rejected-1",
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: new Date("2026-05-04T00:00:00.000Z"),
            status: RequestStatus.REJECTED
          },
          {
            requestId: "cancelled-1",
            startDate: new Date("2026-05-10T00:00:00.000Z"),
            endDate: new Date("2026-05-12T00:00:00.000Z"),
            status: RequestStatus.CANCELLED
          }
        ]
      })
    );

    const preview = await harness.service.preview(actor(UserRole.PICKER), {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      reason: "Trip"
    });

    assert.equal(preview.heldDays, 0);
    assert.equal(preview.availableToRequestDays, 10);
  }

  // Overlapping active request is blocked.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 20 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" },
        otherLeaves: [
          {
            requestId: "overlap-1",
            startDate: new Date("2026-07-02T00:00:00.000Z"),
            endDate: new Date("2026-07-04T00:00:00.000Z"),
            status: RequestStatus.PENDING_AREA_MANAGER
          }
        ]
      })
    );

    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-03", endDate: "2026-07-05", reason: "Trip" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      /overlapping annual leave request/
    );
  }

  // Attendance annual-leave dates remove matching dates from the effective hold.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        balance: eligibleBalance({ remainingDays: 10 }),
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" },
        otherLeaves: [
          {
            requestId: "held-1",
            // 4 held dates: May 1-4.
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: new Date("2026-05-04T00:00:00.000Z"),
            status: RequestStatus.APPROVED
          }
        ],
        // Two of those days already posted to attendance as annual leave.
        attendanceAnnualDates: ["2026-05-01", "2026-05-02"]
      })
    );

    const preview = await harness.service.preview(actor(UserRole.PICKER), {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      reason: "Trip"
    });

    // 4 held - 2 already-posted = 2 effective held.
    assert.equal(preview.heldDays, 2);
    assert.equal(preview.availableToRequestDays, 8);
  }

  // assertApprovalStillValid throws when balance is now insufficient.
  {
    const harness = buildHarness(UserRole.PICKER, {
      balance: eligibleBalance({ remainingDays: 2 }),
      storedAnnualLeave: {
        requestId: "request-1",
        targetUserId: "picker-1",
        role: UserRole.PICKER,
        joiningDate: new Date("2025-01-01T00:00:00.000Z"),
        requestedDays: 3,
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-03T00:00:00.000Z")
      }
    });

    await assert.rejects(
      () => harness.service.assertApprovalStillValid("request-1", "approval-1"),
      /no longer sufficient to approve/
    );
  }

  // assertApprovalStillValid passes when the balance still covers it, and it
  // excludes the request itself from the held calculation.
  {
    const harness = buildHarness(UserRole.PICKER, {
      balance: eligibleBalance({ remainingDays: 5 }),
      otherLeaves: [
        {
          // The request under approval must be excluded from held.
          requestId: "request-1",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-03T00:00:00.000Z"),
          status: RequestStatus.PENDING_CHAMP
        }
      ],
      storedAnnualLeave: {
        requestId: "request-1",
        targetUserId: "picker-1",
        role: UserRole.PICKER,
        joiningDate: new Date("2025-01-01T00:00:00.000Z"),
        requestedDays: 3,
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-03T00:00:00.000Z")
      }
    });

    await assert.doesNotReject(() =>
      harness.service.assertApprovalStillValid("request-1", "approval-1")
    );
    assert.deepEqual(harness.forbiddenAttendanceWrites, []);
  }

  // Non Picker/Champ roles cannot request annual leave.
  {
    const harness = withRequestCreate(buildHarness(UserRole.AREA_MANAGER));
    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.AREA_MANAGER),
          { startDate: "2026-07-01", endDate: "2026-07-02", reason: "x" },
          { actor: actor(UserRole.AREA_MANAGER), ...context }
        ),
      ForbiddenException
    );
  }

  // startDate after endDate is rejected.
  {
    const harness = withRequestCreate(
      buildHarness(UserRole.PICKER, {
        pickerAssignments: [{ vendorId: "vendor-1", chainId: "chain-1" }],
        champsByVendor: { "vendor-1": "champ-9" }
      })
    );
    await assert.rejects(
      () =>
        harness.service.createSelfRequest(
          actor(UserRole.PICKER),
          { startDate: "2026-07-05", endDate: "2026-07-01", reason: "x" },
          { actor: actor(UserRole.PICKER), ...context }
        ),
      BadRequestException
    );
  }

  assert.ok(AnnualLeaveRequestService);
}

void run();
