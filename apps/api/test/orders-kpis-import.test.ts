import assert from "node:assert/strict";

import {
  AssignmentStatus,
  OrdersKpiImportBatchStatus,
  UserRole
} from "@prisma/client";

import { OrdersKpisImportService } from "../src/orders-kpis/orders-kpis-import.service";
import { OrdersKpisParserService } from "../src/orders-kpis/orders-kpis-parser.service";
import { OrdersKpisValidatorService } from "../src/orders-kpis/orders-kpis-validator.service";

const NEEDS_REVIEW = "NEEDS_REVIEW" as OrdersKpiImportBatchStatus;
const REJECTED = "REJECTED" as OrdersKpiImportBatchStatus;

const headers = [
  "shopperId",
  "vendor id",
  "date",
  "Total orders",
  "Successful orders",
  "QC Failed orders",
  "Vendor Failed orders",
  "Unhealthy orders",
  "Order not on time",
  "Partial refund",
  "Vendor delay",
  "Preparation time",
  "Out of Stock",
  "Fir Not On Time",
  "Price modified"
];

const adminActor = {
  id: "admin-1",
  role: UserRole.ADMIN
};

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    shopperId: "SHOPPER-1",
    "vendor id": "100001",
    date: "Jun 7, 2026",
    "Total orders": 10,
    "Successful orders": 8,
    "QC Failed orders": 1,
    "Vendor Failed orders": 1,
    "Unhealthy orders": 2,
    "Order not on time": 1,
    "Partial refund": 0,
    "Vendor delay": 1,
    "Preparation time": 12.5,
    "Out of Stock": 0,
    "Fir Not On Time": 1,
    "Price modified": 0,
    ...overrides
  };
}

function csvBuffer(rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header] ?? "")).join(",")
    )
  ];

  return Buffer.from(lines.join("\n"), "utf8");
}

function csvCell(value: unknown) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createStore() {
  const now = new Date("2026-06-08T09:00:00.000Z");
  const store = {
    now,
    nextBatchNumber: 1,
    nextRecordNumber: 1,
    forbiddenMutationCalls: [] as string[],
    users: [
      {
        id: "picker-1",
        shopperId: "SHOPPER-1",
        role: UserRole.PICKER,
        nameEn: "Picker One"
      },
      {
        id: "picker-2",
        shopperId: "SHOPPER-2",
        role: UserRole.PICKER,
        nameEn: "Picker Two"
      },
      {
        id: "champ-user",
        shopperId: "CHAMP-1",
        role: UserRole.CHAMP,
        nameEn: "Champ One"
      }
    ],
    vendors: [
      {
        id: "vendor-a",
        vendorCode: "100001",
        vendorExternalId: null,
        chainId: "chain-a"
      },
      {
        id: "vendor-external",
        vendorCode: "EXT-1",
        vendorExternalId: "200002",
        chainId: "chain-b"
      }
    ],
    pickerBranchAssignments: [
      {
        pickerId: "picker-1",
        vendorId: "vendor-a",
        status: AssignmentStatus.ACTIVE
      }
    ],
    batches: [] as Array<Record<string, unknown>>,
    issues: [] as Array<Record<string, unknown>>,
    stagingRows: [] as Array<Record<string, unknown>>,
    dailyRecords: [] as Array<Record<string, unknown>>,
    auditRows: [] as Array<Record<string, unknown>>
  };

  const prisma = {
    user: {
      findMany: async ({ where }: { where: { shopperId: { in: string[] } } }) =>
        store.users.filter(
          (user) => user.shopperId && where.shopperId.in.includes(user.shopperId)
        ),
      create: forbiddenWrite("user.create", store.forbiddenMutationCalls),
      update: forbiddenWrite("user.update", store.forbiddenMutationCalls)
    },
    vendor: {
      findMany: async ({
        where
      }: {
        where: {
          OR?: Array<{
            vendorCode?: { in: string[] };
            vendorExternalId?: { in: string[] };
          }>;
        };
      }) => {
        const values = new Set<string>();
        for (const condition of where.OR ?? []) {
          for (const item of condition.vendorCode?.in ?? []) {
            values.add(item);
          }
          for (const item of condition.vendorExternalId?.in ?? []) {
            values.add(item);
          }
        }

        return store.vendors.filter(
          (vendor) =>
            values.has(vendor.vendorCode) ||
            (vendor.vendorExternalId ? values.has(vendor.vendorExternalId) : false)
        );
      },
      create: forbiddenWrite("vendor.create", store.forbiddenMutationCalls),
      update: forbiddenWrite("vendor.update", store.forbiddenMutationCalls)
    },
    pickerBranchAssignment: {
      findMany: async ({
        where
      }: {
        where: {
          pickerId?: { in: string[] };
          status?: AssignmentStatus;
        };
      }) =>
        store.pickerBranchAssignments.filter(
          (assignment) =>
            (!where.pickerId?.in || where.pickerId.in.includes(assignment.pickerId)) &&
            (!where.status || assignment.status === where.status)
        ),
      create: forbiddenWrite(
        "pickerBranchAssignment.create",
        store.forbiddenMutationCalls
      ),
      update: forbiddenWrite(
        "pickerBranchAssignment.update",
        store.forbiddenMutationCalls
      )
    },
    ordersKpiImportBatch: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const batch = {
          id: `batch-${store.nextBatchNumber++}`,
          createdAt: store.now,
          updatedAt: store.now,
          ...data
        };
        store.batches.push(batch);
        return batch;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.batches.find((batch) => batch["id"] === where.id) ?? null,
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const batch = store.batches.find((item) => item["id"] === where.id);
        assert.ok(batch, `Missing batch ${where.id}`);
        Object.assign(batch, data, { updatedAt: store.now });
        return batch;
      }
    },
    ordersKpiImportIssue: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        store.issues.push(...data);
        return { count: data.length };
      }
    },
    ordersKpiImportStagingRow: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        store.stagingRows.push(...data);
        return { count: data.length };
      },
      findMany: async ({ where }: { where: { sourceBatchId: string } }) =>
        store.stagingRows.filter(
          (row) => row["sourceBatchId"] === where.sourceBatchId
        )
    },
    ordersKpiDailyRecord: {
      findMany: async ({
        where
      }: {
        where: { OR?: Array<Record<string, unknown>> };
      }) =>
        store.dailyRecords.filter((record) =>
          (where.OR ?? []).some(
            (key) =>
              sameDate(record["kpiDate"], key["kpiDate"]) &&
              record["shopperId"] === key["shopperId"] &&
              record["sourceVendorId"] === key["sourceVendorId"]
          )
        ),
      upsert: async ({
        create,
        update,
        where
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: {
          kpiDate_shopperId_sourceVendorId: {
            kpiDate: Date;
            shopperId: string;
            sourceVendorId: string;
          };
        };
      }) => {
        const key = where.kpiDate_shopperId_sourceVendorId;
        const existing = store.dailyRecords.find(
          (record) =>
            sameDate(record["kpiDate"], key.kpiDate) &&
            record["shopperId"] === key.shopperId &&
            record["sourceVendorId"] === key.sourceVendorId
        );

        if (existing) {
          Object.assign(existing, update, { updatedAt: store.now });
          return existing;
        }

        const record = {
          id: `daily-${store.nextRecordNumber++}`,
          createdAt: store.now,
          updatedAt: store.now,
          ...create
        };
        store.dailyRecords.push(record);
        return record;
      }
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        store.auditRows.push(data);
        return { id: `audit-${store.auditRows.length}`, ...data };
      }
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) =>
      callback(prisma)
  };

  return { prisma, store };
}

function createService(prisma: unknown) {
  return new OrdersKpisImportService(
    prisma as never,
    new OrdersKpisParserService(),
    new OrdersKpisValidatorService()
  );
}

async function previewRows(
  rows: Array<Record<string, unknown>>,
  options: {
    fileName?: string;
    prisma?: unknown;
    now?: Date | string;
  } = {}
) {
  const service = createService(options.prisma ?? createStore().prisma);

  return service.previewImport(csvBuffer(rows), {
    actor: adminActor,
    fileName: options.fileName ?? "orders-kpis.csv",
    now: options.now ?? "2026-06-08T09:00:00.000Z"
  });
}

async function run() {
  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ "Preparation time": "No data" })
    ], { prisma });

    assert.equal(result.status, OrdersKpiImportBatchStatus.VALIDATED);
    assert.equal(result.canConfirm, true);
    assert.equal(result.canApproveValidRows, false);
    assert.equal(result.canReject, true);
    assert.equal(result.preview.rowCount, 1);
    assert.equal(result.preview.matchedRows, 1);
    assert.equal(result.preview.warningRows, 1);
    assert.equal(result.preview.dateFrom, "2026-06-07");
    assert.equal(result.preview.dateTo, "2026-06-07");
    assert.equal(store.stagingRows.length, 1);
    assert.equal(store.stagingRows[0]?.["preparationTime"], null);
    assert.equal(store.stagingRows[0]?.["firNotOnTime"], 1);
    assert.equal(store.auditRows[0]?.["action"], "ORDERS_KPI_IMPORT_PREVIEW_CREATED");
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow(),
      baseRow({ shopperId: "No data" })
    ], { prisma });

    assert.equal(result.status, NEEDS_REVIEW);
    assert.equal(result.canConfirm, false);
    assert.equal(result.canApproveValidRows, true);
    assert.equal(result.canReject, true);
    assert.equal(result.preview.errorRows, 1);
    assert.equal(result.skippedErrorRows, 1);
    assert.equal(store.stagingRows.length, 1);
    assert.equal(store.stagingRows[0]?.["shopperId"], "SHOPPER-1");
    assert.ok(
      result.preview.issues.some(
        (issue) => issue.issueCode === "MISSING_SHOPPER_ID"
      )
    );
    assert.equal(store.auditRows[0]?.["action"], "ORDERS_KPI_IMPORT_REVIEW_CREATED");
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([
      baseRow(),
      baseRow({ shopperId: "No data" })
    ], { prisma });

    await assert.rejects(
      () =>
        service.approveValidRows(preview.batchId, {
          actor: adminActor,
          acknowledgeSkippedErrorRows: false,
          now: store.now
        }),
      /acknowledge/i
    );
    assert.equal(store.dailyRecords.length, 0);
    assert.equal(store.batches[0]?.["status"], NEEDS_REVIEW);
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([
      baseRow(),
      baseRow({ shopperId: "No data" })
    ], { prisma });
    const approved = await service.approveValidRows(preview.batchId, {
      actor: adminActor,
      acknowledgeSkippedErrorRows: true,
      now: store.now
    });

    assert.equal(approved.status, OrdersKpiImportBatchStatus.CONFIRMED);
    assert.equal(approved.insertedCount, 1);
    assert.equal(approved.updatedCount, 0);
    assert.equal(approved.skippedErrorRows, 1);
    assert.equal(approved.approvedWithErrors, true);
    assert.equal(store.dailyRecords.length, 1);
    assert.equal(store.dailyRecords[0]?.["shopperId"], "SHOPPER-1");
    assert.equal(store.dailyRecords[0]?.["sourceVendorId"], "100001");
    assert.equal(store.auditRows.at(-1)?.["action"], "ORDERS_KPI_IMPORT_VALID_ROWS_APPROVED");

    await assert.rejects(
      () =>
        service.rejectImport(preview.batchId, {
          actor: adminActor,
          now: store.now
        }),
      /validated|review/i
    );
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([
      baseRow(),
      baseRow({ shopperId: "No data" })
    ], { prisma });
    const rejected = await service.rejectImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.equal(rejected.status, REJECTED);
    assert.equal(rejected.stagingRowCount, 1);
    assert.equal(store.dailyRecords.length, 0);
    assert.equal(store.batches[0]?.["status"], REJECTED);
    assert.equal(store.auditRows.at(-1)?.["action"], "ORDERS_KPI_IMPORT_REJECTED");

    await assert.rejects(
      () =>
        service.approveValidRows(preview.batchId, {
          actor: adminActor,
          acknowledgeSkippedErrorRows: true,
          now: store.now
        }),
      /review/i
    );
  }

  {
    const result = await previewRows([
      baseRow({ date: "2026-05-31" }),
      baseRow({
        shopperId: "SHOPPER-2",
        "vendor id": "200002",
        date: "Jun 7, 2026"
      })
    ], { prisma: createStore().prisma });

    assert.equal(result.preview.dateFrom, "2026-05-31");
    assert.equal(result.preview.dateTo, "2026-06-07");
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([baseRow()], { prisma });
    const confirmed = await service.confirmImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.equal(confirmed.status, OrdersKpiImportBatchStatus.CONFIRMED);
    assert.equal(confirmed.insertedCount, 1);
    assert.equal(confirmed.updatedCount, 0);
    assert.equal(store.dailyRecords.length, 1);
    assert.equal(store.dailyRecords[0]?.["sourceVendorId"], "100001");
    assert.equal(store.dailyRecords[0]?.["matchedVendorId"], "vendor-a");
    assert.equal(formatDate(store.dailyRecords[0]?.["kpiDate"]), "2026-06-07");
    assert.equal(store.auditRows.at(-1)?.["action"], "ORDERS_KPI_IMPORT_CONFIRMED");
    assert.deepEqual(store.forbiddenMutationCalls, []);

    await assert.rejects(
      () =>
        service.confirmImport(preview.batchId, {
          actor: adminActor,
          now: store.now
        }),
      /validated/i
    );
  }

  {
    const { prisma, store } = createStore();
    store.dailyRecords.push({
      id: "existing-record",
      sourceBatchId: "old-batch",
      kpiDate: date("2026-06-07"),
      shopperId: "SHOPPER-1",
      userId: "picker-1",
      pickerNameSnapshot: "Old Picker Name",
      sourceVendorId: "100001",
      matchedVendorId: "vendor-a",
      matchedChainId: "chain-a",
      totalOrders: 2,
      successfulOrders: 1
    });
    const service = createService(prisma);
    const preview = await previewRows([
      baseRow({ "Total orders": 12, "Successful orders": 11 })
    ], { prisma });
    const confirmed = await service.confirmImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.equal(confirmed.insertedCount, 0);
    assert.equal(confirmed.updatedCount, 1);
    assert.equal(store.dailyRecords.length, 1);
    assert.equal(store.dailyRecords[0]?.["id"], "existing-record");
    assert.equal(store.dailyRecords[0]?.["totalOrders"], 12);
    assert.equal(store.dailyRecords[0]?.["successfulOrders"], 11);
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([
      baseRow({ date: "2025-01-15" })
    ], {
      prisma,
      now: "2026-06-08T09:00:00.000Z"
    });
    await service.confirmImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.equal(formatDate(store.dailyRecords[0]?.["kpiDate"]), "2025-01-15");
    assert.notEqual(formatDate(store.dailyRecords[0]?.["kpiDate"]), "2026-06-08");
  }
}

function forbiddenWrite(name: string, calls: string[]) {
  return async () => {
    calls.push(name);
    throw new Error(`${name} is out of scope for Orders KPI imports.`);
  };
}

function sameDate(left: unknown, right: unknown) {
  return left instanceof Date &&
    right instanceof Date &&
    left.toISOString() === right.toISOString();
}

function formatDate(value: unknown) {
  assert.ok(value instanceof Date);
  return value.toISOString().slice(0, 10);
}

void run();
