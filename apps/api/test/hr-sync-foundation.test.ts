import assert from "node:assert/strict";

import {
  HrSyncService,
  type PickerNewHireHrSyncInput,
  type PickerResignationHrSyncInput
} from "../src/hr-sync";
import {
  HrSyncStatus,
  HrSyncTargetSheet,
  HrSyncWorkflowType
} from "@prisma/client";

type HrSyncLogRow = {
  id: string;
  requestId: string;
  workflowType: HrSyncWorkflowType;
  targetSheet: HrSyncTargetSheet;
  status: HrSyncStatus;
  payloadSnapshot: unknown;
  responseSnapshot: unknown | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createMockPrisma() {
  const rows: HrSyncLogRow[] = [];
  let sequence = 0;
  const now = new Date("2026-05-23T10:00:00.000Z");

  return {
    rows,
    prisma: {
      hrSyncLog: {
        create: async ({ data }: { data: Partial<HrSyncLogRow> }) => {
          const row: HrSyncLogRow = {
            id: `hr-sync-log-${++sequence}`,
            requestId: data.requestId ?? "request-1",
            workflowType:
              data.workflowType ?? HrSyncWorkflowType.PICKER_NEW_HIRE,
            targetSheet: data.targetSheet ?? HrSyncTargetSheet.NEW_HIRE,
            status: data.status ?? HrSyncStatus.NOT_SENT,
            payloadSnapshot: data.payloadSnapshot ?? {},
            responseSnapshot: data.responseSnapshot ?? null,
            errorMessage: data.errorMessage ?? null,
            sentAt: data.sentAt ?? null,
            createdAt: data.createdAt ?? new Date(now.getTime() + sequence),
            updatedAt: data.updatedAt ?? new Date(now.getTime() + sequence)
          };

          rows.push(row);
          return row;
        },
        update: async ({
          where,
          data
        }: {
          where: { id: string };
          data: Partial<HrSyncLogRow>;
        }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          assert.ok(row, `Expected HR sync log ${where.id} to exist.`);
          Object.assign(row, data, {
            updatedAt: new Date("2026-05-23T11:00:00.000Z")
          });
          return row;
        },
        findFirst: async ({
          where
        }: {
          where: { requestId: string };
          orderBy: { createdAt: "desc" };
        }) => {
          return (
            rows
              .filter((row) => row.requestId === where.requestId)
              .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ??
            null
          );
        }
      }
    }
  };
}

function createMockConfig() {
  return {
    get: (key: string) => {
      if (key === "hrSync.enabled") return false;
      if (key === "hrSync.webAppUrl") return "";
      if (key === "hrSync.secret") return "";
      return undefined;
    }
  };
}

const newHireInput: PickerNewHireHrSyncInput = {
  finalizerDisplayName: "Admin Finalizer",
  fullNameEnglish: "Picker One",
  nationalId: "29801011234567",
  phoneNumber: "01012345678",
  actualJoiningDate: "2026-06-01",
  homeAddress: "Cairo"
};

const resignationInput: PickerResignationHrSyncInput = {
  finalizerDisplayName: "Admin Finalizer",
  type: "No Block",
  employeeName: "Picker One",
  nationalId: "29801011234567",
  lastWorkingDate: "2026-06-30"
};

const { prisma, rows } = createMockPrisma();
const service = new HrSyncService(prisma as never, createMockConfig() as never);

async function main() {
  assert.deepEqual(service.buildPickerNewHirePayload(newHireInput), {
    finalizerDisplayName: "Admin Finalizer",
    requestType: "New Hire",
    fullNameEnglish: "Picker One",
    nationalId: "29801011234567",
    phoneNumber: "01012345678",
    actualJoiningDate: "2026-06-01",
    homeAddress: "Cairo",
    vertical: "Local Shops",
    title: "Picker"
  });

  assert.deepEqual(service.buildPickerRehirePayload(newHireInput), {
    finalizerDisplayName: "Admin Finalizer",
    requestType: "Rehire",
    fullNameEnglish: "Picker One",
    nationalId: "29801011234567",
    phoneNumber: "01012345678",
    actualJoiningDate: "2026-06-01",
    homeAddress: "Cairo",
    vertical: "Local Shops",
    title: "Picker"
  });

  assert.deepEqual(service.buildPickerResignationPayload(resignationInput), {
    finalizerDisplayName: "Admin Finalizer",
    requestType: "Resign",
    type: "No Block",
    employeeName: "Picker One",
    nationalId: "29801011234567",
    lastWorkingDate: "2026-06-30",
    title: "Picker"
  });

  const notSentLog = await service.createNotSentLog({
    requestId: "request-1",
    workflowType: HrSyncWorkflowType.PICKER_NEW_HIRE,
    targetSheet: HrSyncTargetSheet.NEW_HIRE,
    payloadSnapshot: service.buildPickerNewHirePayload(newHireInput)
  });

  assert.equal(notSentLog.status, HrSyncStatus.NOT_SENT);
  assert.equal(notSentLog.requestId, "request-1");

  const skippedLog = await service.createSkippedLog({
    requestId: "request-2",
    workflowType: HrSyncWorkflowType.PICKER_RESIGNATION,
    targetSheet: HrSyncTargetSheet.RESIGN,
    payloadSnapshot: service.buildPickerResignationPayload(resignationInput),
    errorMessage: "HR sync disabled."
  });

  assert.equal(skippedLog.status, HrSyncStatus.SKIPPED);
  assert.equal(skippedLog.errorMessage, "HR sync disabled.");

  const sentAt = new Date("2026-05-23T12:00:00.000Z");
  const sentLog = await service.markSent(notSentLog.id, {
    responseSnapshot: { ok: true, rowNumber: 7 },
    sentAt
  });

  assert.equal(sentLog.status, HrSyncStatus.SENT);
  assert.deepEqual(sentLog.responseSnapshot, { ok: true, rowNumber: 7 });
  assert.equal(sentLog.sentAt?.toISOString(), sentAt.toISOString());

  const failedLog = await service.markFailed(skippedLog.id, {
    errorMessage: "Apps Script returned 500.",
    responseSnapshot: { ok: false }
  });

  assert.equal(failedLog.status, HrSyncStatus.FAILED);
  assert.equal(failedLog.errorMessage, "Apps Script returned 500.");
  assert.deepEqual(failedLog.responseSnapshot, { ok: false });

  const disabledSendLog = await service.createNotSentLog({
    requestId: "request-3",
    workflowType: HrSyncWorkflowType.PICKER_RESIGNATION,
    targetSheet: HrSyncTargetSheet.RESIGN,
    payloadSnapshot: service.buildPickerResignationPayload(resignationInput)
  });

  const markedSkippedLog = await service.markSkipped(disabledSendLog.id, {
    reason: "HR sync is disabled",
    responseSnapshot: {
      status: "SKIPPED",
      reason: "HR sync is disabled"
    }
  });

  assert.equal(markedSkippedLog.status, HrSyncStatus.SKIPPED);
  assert.equal(markedSkippedLog.errorMessage, "HR sync is disabled");
  assert.deepEqual(markedSkippedLog.responseSnapshot, {
    status: "SKIPPED",
    reason: "HR sync is disabled"
  });

  const latestForRequest = await service.getLatestForRequest("request-1");
  assert.equal(latestForRequest?.id, notSentLog.id);

  assert.equal(rows.length, 3);
}

main().catch((error: unknown) => {
  throw error;
});
