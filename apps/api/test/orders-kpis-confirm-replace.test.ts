import assert from "node:assert/strict";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException
} from "@nestjs/common";
import {
  OrdersKpiImportBatchStatus,
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  UserRole
} from "@prisma/client";

import { OrdersKpisImportService } from "../src/orders-kpis/orders-kpis-import.service";
import { OrdersKpisParserService } from "../src/orders-kpis/orders-kpis-parser.service";
import type { OrdersKpiImportActor } from "../src/orders-kpis/orders-kpis.types";
import { OrdersKpisValidatorService } from "../src/orders-kpis/orders-kpis-validator.service";

interface StoredBatch {
  id: string;
  fileName: string;
  fileHash: string;
  uploadedByUserId: string;
  uploadedAt: Date;
  status: OrdersKpiImportBatchStatus;
  rowCount: number;
  confirmableRows: number;
  skippedRows: number;
  errorRows: number;
  warningRows: number;
  coveredDates: unknown;
  coveredDateFrom: Date | null;
  coveredDateTo: Date | null;
  confirmedByUserId: string | null;
  confirmedAt: Date | null;
  rejectedByUserId: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStagingRow {
  id: string;
  sourceBatchId: string;
  rawRowNumber: number;
  rowHash: string;
  kpiDate: Date;
  sourceVendorId: string;
  matchedVendorId: string | null;
  matchedChainId: string | null;
  vendorNameSnapshot: string | null;
  chainNameSnapshot: string | null;
  vendorMatchStatus: OrdersKpiVendorMatchStatus;
  sourceShopperId: string | null;
  sourcePickerKey: string;
  userId: string | null;
  pickerNameSnapshot: string | null;
  pickerMatchStatus: OrdersKpiPickerMatchStatus;
  totalOrders: number;
  successfulOrders: number;
  qcFailedOrders: number;
  vendorFailedOrders: number;
  unhealthyOrders: number;
  orderNotOnTime: number;
  partialRefund: number;
  vendorDelay: number;
  preparationTime: number | null;
  outOfStock: number;
  firNotOnTime: number;
  priceModified: number;
  issuesCount: number;
}

interface StoredDailyRecord extends Omit<StoredStagingRow, "id" | "rawRowNumber" | "rowHash"> {
  id: string;
}

interface StoredAuditRow {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface OrdersKpiConfirmRejectService {
  confirmReplaceImport: (
    batchId: string,
    options: {
      actor: OrdersKpiImportActor;
      acknowledgeReplaceDates?: boolean;
      approveValidRowsOnly?: boolean;
      acknowledgeSkippedErrorRows?: boolean;
      ipAddress?: string | null;
      userAgent?: string | null;
      now?: Date;
    }
  ) => Promise<{
    batchId: string;
    status: OrdersKpiImportBatchStatus.CONFIRMED;
    coveredDates: string[];
    deletedRecords: number;
    insertedRecords: number;
    skippedRows: number;
    errorRows: number;
    warningRows: number;
    confirmedAt: string;
  }>;
  rejectImport: (
    batchId: string,
    options: {
      actor: OrdersKpiImportActor;
      reason?: string;
      ipAddress?: string | null;
      userAgent?: string | null;
      now?: Date;
    }
  ) => Promise<{
    batchId: string;
    status: OrdersKpiImportBatchStatus.REJECTED;
    rejectedAt: string;
    reason: string | null;
  }>;
}

const adminActor: OrdersKpiImportActor = {
  id: "admin-user-1",
  role: UserRole.ADMIN
};

const pickerActor: OrdersKpiImportActor = {
  id: "picker-user-1",
  role: UserRole.PICKER
};

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createBatch(
  id: string,
  overrides: Partial<StoredBatch> = {}
): StoredBatch {
  const now = new Date("2026-06-09T10:00:00.000Z");

  return {
    id,
    fileName: `${id}.csv`,
    fileHash: `hash-${id}`,
    uploadedByUserId: adminActor.id,
    uploadedAt: now,
    status: OrdersKpiImportBatchStatus.VALIDATED,
    rowCount: 2,
    confirmableRows: 2,
    skippedRows: 0,
    errorRows: 0,
    warningRows: 0,
    coveredDates: ["2026-06-03", "2026-06-05"],
    coveredDateFrom: dateOnly("2026-06-03"),
    coveredDateTo: dateOnly("2026-06-05"),
    confirmedByUserId: null,
    confirmedAt: null,
    rejectedByUserId: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createStagingRow(
  id: string,
  sourceBatchId: string,
  date: string,
  overrides: Partial<StoredStagingRow> = {}
): StoredStagingRow {
  return {
    id,
    sourceBatchId,
    rawRowNumber: 2,
    rowHash: `hash-${id}`,
    kpiDate: dateOnly(date),
    sourceVendorId: "V001",
    matchedVendorId: "vendor-1",
    matchedChainId: "chain-1",
    vendorNameSnapshot: "Vendor One",
    chainNameSnapshot: "Chain One",
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    sourceShopperId: "PICKER-1",
    sourcePickerKey: "PICKER-1",
    userId: "user-picker-1",
    pickerNameSnapshot: "Picker One",
    pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_PICKER,
    totalOrders: 10,
    successfulOrders: 9,
    qcFailedOrders: 1,
    vendorFailedOrders: 0,
    unhealthyOrders: 2,
    orderNotOnTime: 1,
    partialRefund: 0,
    vendorDelay: 3,
    preparationTime: 14.5,
    outOfStock: 0,
    firNotOnTime: 1,
    priceModified: 0,
    issuesCount: 0,
    ...overrides
  };
}

function createDailyRecord(
  id: string,
  date: string,
  overrides: Partial<StoredDailyRecord> = {}
): StoredDailyRecord {
  const staging = createStagingRow(`staging-${id}`, "old-batch", date);
  const { rawRowNumber: _rawRowNumber, rowHash: _rowHash, ...record } = staging;

  return {
    ...record,
    id,
    ...overrides
  };
}

function createStore() {
  const now = new Date("2026-06-10T08:00:00.000Z");
  const store = {
    now,
    nextDailyRecordNumber: 1,
    batches: [] as StoredBatch[],
    stagingRows: [] as StoredStagingRow[],
    dailyRecords: [] as StoredDailyRecord[],
    auditRows: [] as StoredAuditRow[],
    forbiddenMutationCalls: [] as string[]
  };

  const prisma = {
    ordersKpiImportBatch: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.batches.find((batch) => batch.id === where.id) ?? null,
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<StoredBatch>;
      }) => {
        const batch = store.batches.find((candidate) => candidate.id === where.id);
        assert.ok(batch, `Missing batch ${where.id}`);
        Object.assign(batch, data, { updatedAt: store.now });
        return batch;
      }
    },
    ordersKpiImportStagingRow: {
      findMany: async ({
        where
      }: {
        where: { sourceBatchId: string };
      }) =>
        store.stagingRows.filter((row) => row.sourceBatchId === where.sourceBatchId)
    },
    ordersKpiDailyRecord: {
      deleteMany: async ({
        where
      }: {
        where: { kpiDate: { in: Date[] } };
      }) => {
        const datesToReplace = new Set(
          where.kpiDate.in.map((date) => date.toISOString().slice(0, 10))
        );
        const beforeCount = store.dailyRecords.length;
        store.dailyRecords = store.dailyRecords.filter(
          (record) => !datesToReplace.has(record.kpiDate.toISOString().slice(0, 10))
        );
        return { count: beforeCount - store.dailyRecords.length };
      },
      createMany: async ({
        data
      }: {
        data: Array<Omit<StoredDailyRecord, "id">>;
      }) => {
        store.dailyRecords.push(
          ...data.map((record) => ({
            id: `daily-${store.nextDailyRecordNumber++}`,
            ...record
          }))
        );
        return { count: data.length };
      }
    },
    auditLog: {
      create: async ({ data }: { data: StoredAuditRow }) => {
        store.auditRows.push(data);
        return {
          id: `audit-${store.auditRows.length}`,
          ...data
        };
      }
    },
    user: {
      create: async () => {
        store.forbiddenMutationCalls.push("user.create");
        throw new Error("User mutation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("user.update");
        throw new Error("User mutation is out of scope.");
      }
    },
    vendor: {
      create: async () => {
        store.forbiddenMutationCalls.push("vendor.create");
        throw new Error("Vendor mutation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("vendor.update");
        throw new Error("Vendor mutation is out of scope.");
      }
    },
    pickerBranchAssignment: {
      create: async () => {
        store.forbiddenMutationCalls.push("pickerBranchAssignment.create");
        throw new Error("Assignment mutation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("pickerBranchAssignment.update");
        throw new Error("Assignment mutation is out of scope.");
      }
    },
    $transaction: async <T>(
      callback: (tx: typeof prisma) => Promise<T>,
      _options?: Record<string, unknown>
    ) => {
      const snapshot = {
        batches: store.batches.map((batch) => ({ ...batch })),
        dailyRecords: store.dailyRecords.map((record) => ({ ...record })),
        auditRows: store.auditRows.map((row) => ({ ...row }))
      };

      try {
        return await callback(prisma);
      } catch (error) {
        store.batches = snapshot.batches;
        store.dailyRecords = snapshot.dailyRecords;
        store.auditRows = snapshot.auditRows;
        throw error;
      }
    }
  };

  const auditService = {
    log: async (params: StoredAuditRow) => {
      store.auditRows.push(params);
      return {
        id: `audit-${store.auditRows.length}`,
        ...params
      };
    }
  };

  return {
    auditService,
    prisma,
    store
  };
}

function createService(context: ReturnType<typeof createStore>) {
  const parser = new OrdersKpisParserService();
  const service = new OrdersKpisImportService(
    context.prisma as never,
    context.auditService as never,
    parser,
    new OrdersKpisValidatorService(context.prisma as never)
  );

  return service as unknown as OrdersKpiConfirmRejectService;
}

async function testValidatedBatchConfirmsAndReplacesExactDates() {
  const context = createStore();
  const service = createService(context);
  context.store.batches.push(createBatch("batch-validated"));
  context.store.stagingRows.push(
    createStagingRow("staging-1", "batch-validated", "2026-06-03", {
      totalOrders: 13
    }),
    createStagingRow("staging-2", "batch-validated", "2026-06-05", {
      totalOrders: 15,
      sourcePickerKey: "__UNKNOWN__",
      sourceShopperId: null,
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNKNOWN_PICKER
    })
  );
  context.store.dailyRecords.push(
    createDailyRecord("old-june-3", "2026-06-03"),
    createDailyRecord("old-june-4", "2026-06-04"),
    createDailyRecord("old-june-5", "2026-06-05")
  );

  const response = await service.confirmReplaceImport("batch-validated", {
    actor: adminActor,
    acknowledgeReplaceDates: true,
    ipAddress: "127.0.0.1",
    userAgent: "orders-kpis-confirm-test",
    now: context.store.now
  });

  assert.equal(response.status, OrdersKpiImportBatchStatus.CONFIRMED);
  assert.deepEqual(response.coveredDates, ["2026-06-03", "2026-06-05"]);
  assert.equal(response.deletedRecords, 2);
  assert.equal(response.insertedRecords, 2);
  assert.equal(response.confirmedAt, context.store.now.toISOString());
  assert.equal(context.store.batches[0].status, OrdersKpiImportBatchStatus.CONFIRMED);
  assert.equal(context.store.batches[0].confirmedByUserId, adminActor.id);
  assert.equal(context.store.dailyRecords.length, 3);
  assert.ok(
    context.store.dailyRecords.some(
      (record) => record.id === "old-june-4" && record.totalOrders === 10
    )
  );
  assert.ok(
    context.store.dailyRecords.some(
      (record) =>
        record.sourceBatchId === "batch-validated" &&
        record.kpiDate.toISOString().startsWith("2026-06-03") &&
        record.totalOrders === 13
    )
  );
  assert.equal(
    context.store.auditRows[0].action,
    "ORDERS_KPI_IMPORT_CONFIRMED_REPLACE"
  );
  assert.deepEqual(context.store.forbiddenMutationCalls, []);
}

async function testNeedsReviewRequiresExplicitAcknowledgements() {
  const context = createStore();
  const service = createService(context);
  context.store.batches.push(
    createBatch("batch-review", {
      status: OrdersKpiImportBatchStatus.NEEDS_REVIEW,
      confirmableRows: 1,
      skippedRows: 2,
      errorRows: 2,
      warningRows: 1
    })
  );
  context.store.stagingRows.push(
    createStagingRow("staging-review-1", "batch-review", "2026-06-03")
  );

  await assert.rejects(
    service.confirmReplaceImport("batch-review", {
      actor: adminActor,
      acknowledgeReplaceDates: true,
      now: context.store.now
    }),
    BadRequestException
  );
  assert.equal(context.store.batches[0].status, OrdersKpiImportBatchStatus.NEEDS_REVIEW);
  assert.equal(context.store.dailyRecords.length, 0);

  const response = await service.confirmReplaceImport("batch-review", {
    actor: adminActor,
    acknowledgeReplaceDates: true,
    approveValidRowsOnly: true,
    acknowledgeSkippedErrorRows: true,
    now: context.store.now
  });

  assert.equal(response.status, OrdersKpiImportBatchStatus.CONFIRMED);
  assert.equal(response.insertedRecords, 1);
  assert.equal(response.skippedRows, 2);
  assert.equal(response.errorRows, 2);
  assert.equal(response.warningRows, 1);
  assert.equal(context.store.dailyRecords.length, 1);
}

async function testNonConfirmableStatusesFailSafely() {
  for (const status of [
    OrdersKpiImportBatchStatus.FAILED,
    OrdersKpiImportBatchStatus.REJECTED,
    OrdersKpiImportBatchStatus.CONFIRMED
  ]) {
    const context = createStore();
    const service = createService(context);
    context.store.batches.push(createBatch(`batch-${status}`, { status }));

    await assert.rejects(
      service.confirmReplaceImport(`batch-${status}`, {
        actor: adminActor,
        acknowledgeReplaceDates: true,
        now: context.store.now
      }),
      ConflictException
    );
    assert.equal(context.store.dailyRecords.length, 0);
    assert.equal(context.store.auditRows.length, 0);
  }
}

async function testRejectValidatedAndReviewBatchesWritesNoFacts() {
  for (const status of [
    OrdersKpiImportBatchStatus.VALIDATED,
    OrdersKpiImportBatchStatus.NEEDS_REVIEW
  ]) {
    const context = createStore();
    const service = createService(context);
    context.store.batches.push(createBatch(`reject-${status}`, { status }));

    const response = await service.rejectImport(`reject-${status}`, {
      actor: adminActor,
      reason: "Bad source file",
      now: context.store.now
    });

    assert.equal(response.status, OrdersKpiImportBatchStatus.REJECTED);
    assert.equal(response.reason, "Bad source file");
    assert.equal(context.store.batches[0].status, OrdersKpiImportBatchStatus.REJECTED);
    assert.equal(context.store.batches[0].rejectedByUserId, adminActor.id);
    assert.equal(context.store.dailyRecords.length, 0);
    assert.equal(context.store.auditRows[0].action, "ORDERS_KPI_IMPORT_REJECTED");
  }
}

async function testRejectConfirmedBatchFailsSafely() {
  const context = createStore();
  const service = createService(context);
  context.store.batches.push(
    createBatch("confirmed-batch", {
      status: OrdersKpiImportBatchStatus.CONFIRMED
    })
  );

  await assert.rejects(
    service.rejectImport("confirmed-batch", {
      actor: adminActor,
      reason: "Too late",
      now: context.store.now
    }),
    ConflictException
  );
  assert.equal(context.store.batches[0].status, OrdersKpiImportBatchStatus.CONFIRMED);
  assert.equal(context.store.auditRows.length, 0);
}

async function testPickerCannotConfirmOrReject() {
  const context = createStore();
  const service = createService(context);
  context.store.batches.push(createBatch("role-batch"));

  await assert.rejects(
    service.confirmReplaceImport("role-batch", {
      actor: pickerActor,
      acknowledgeReplaceDates: true
    }),
    ForbiddenException
  );
  await assert.rejects(
    service.rejectImport("role-batch", {
      actor: pickerActor
    }),
    ForbiddenException
  );
}

async function main() {
  await testValidatedBatchConfirmsAndReplacesExactDates();
  await testNeedsReviewRequiresExplicitAcknowledgements();
  await testNonConfirmableStatusesFailSafely();
  await testRejectValidatedAndReviewBatchesWritesNoFacts();
  await testRejectConfirmedBatchFailsSafely();
  await testPickerCannotConfirmOrReject();
}

void main();
