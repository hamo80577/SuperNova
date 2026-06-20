import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { USER_METRICS_UPDATED_EVENT } from "../src/dashboard-cache/dashboard-cache.constants";
import { RequestsService } from "../src/requests/requests.service";

const createdAt = new Date("2026-06-10T08:00:00.000Z");

function requestUser(id: string) {
  return {
    id,
    role: UserRole.PICKER,
    nameEn: "Picker One",
    nameAr: null,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE
  };
}

async function testAnnualLeaveCancellationEmitsTargetedEvent() {
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const request = {
    id: "annual-request-cancelled",
    type: RequestType.ANNUAL_LEAVE,
    status: RequestStatus.PENDING_ADMIN,
    currentStep: "ADMIN_FINAL_APPROVAL",
    payload: {},
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
    createdById: "picker-1",
    targetUserId: "picker-1",
    sourceChainId: null,
    sourceVendorId: null,
    destinationChainId: null,
    destinationVendorId: null,
    createdBy: requestUser("picker-1"),
    targetUser: requestUser("picker-1"),
    sourceChain: null,
    sourceVendor: null,
    destinationChain: null,
    destinationVendor: null,
    approvals: [],
    annualLeaveRequest: {
      targetUserId: "picker-1",
      startDate: new Date("2026-06-18T00:00:00.000Z"),
      endDate: new Date("2026-06-20T00:00:00.000Z"),
      requestedDays: 3,
      reason: "Family",
      contextVendorId: null,
      contextChainId: null,
      balanceCarriedSnapshot: null,
      balanceAccruedSnapshot: null,
      balanceTakenSnapshot: null,
      balanceHeldSnapshot: null,
      availableBeforeRequestSnapshot: null,
      availableAfterRequestSnapshot: null
    }
  };

  const prisma = {
    request: {
      findUnique: async () => request,
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        ...request,
        ...data
      })
    },
    requestApproval: {
      updateMany: async () => ({ count: 1 })
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma)
  };
  const service = new (RequestsService as any)(
    { log: async () => undefined },
    {},
    {},
    {},
    {
      create: async (data: Record<string, unknown>) => {
        notifications.push(data);
      }
    },
    prisma,
    {},
    {},
    {
      emit: (name: string, payload: unknown) => {
        emittedEvents.push({ name, payload });
        return true;
      }
    }
  ) as RequestsService;

  const result = await service.cancel(
    request.id,
    { notes: "Plans changed" },
    {
      actor: {
        id: "admin-1",
        role: UserRole.ADMIN
      } as never
    }
  );

  assert.equal(result.status, RequestStatus.CANCELLED);
  assert.equal(notifications.length, 1);
  assert.deepEqual(emittedEvents, [
    {
      name: USER_METRICS_UPDATED_EVENT,
      payload: {
        eventId: request.id,
        userId: "picker-1",
        month: "2026-06",
        source: "ANNUAL_LEAVE"
      }
    }
  ]);
}

void testAnnualLeaveCancellationEmitsTargetedEvent();
