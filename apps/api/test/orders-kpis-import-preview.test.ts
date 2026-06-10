import assert from "node:assert/strict";

import ExcelJS from "exceljs";
import {
  OrdersKpiImportBatchStatus,
  OrdersKpiIssueCode,
  OrdersKpiIssueSeverity,
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  UserRole
} from "@prisma/client";

import { OrdersKpisImportService } from "../src/orders-kpis/orders-kpis-import.service";
import { OrdersKpisParserService } from "../src/orders-kpis/orders-kpis-parser.service";
import type { OrdersKpiImportActor } from "../src/orders-kpis/orders-kpis.types";
import { OrdersKpisValidatorService } from "../src/orders-kpis/orders-kpis-validator.service";

const requiredHeaders = [
  "date",
  "shopperId",
  "vendor id",
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

type OrdersKpiSourceRow = Record<string, string | number | Date | null | undefined>;

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

interface StoredIssue {
  batchId: string;
  rowNumber: number | null;
  sourceVendorId: string | null;
  sourceShopperId: string | null;
  severity: OrdersKpiIssueSeverity;
  issueCode: OrdersKpiIssueCode;
  fieldName: string | null;
  message: string;
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

const adminActor: OrdersKpiImportActor = {
  id: "admin-user-1",
  role: UserRole.ADMIN
};

function baseRow(overrides: OrdersKpiSourceRow = {}): OrdersKpiSourceRow {
  return {
    date: "2026-06-07",
    shopperId: "PICKER-1",
    "vendor id": "V001",
    "Total orders": 10,
    "Successful orders": 9,
    "QC Failed orders": 1,
    "Vendor Failed orders": 0,
    "Unhealthy orders": 2,
    "Order not on time": 1,
    "Partial refund": 0,
    "Vendor delay": 3,
    "Preparation time": 14.5,
    "Out of Stock": 0,
    "Fir Not On Time": 1,
    "Price modified": 0,
    ...overrides
  };
}

function csvBuffer(rows: OrdersKpiSourceRow[], headers = requiredHeaders) {
  const lines = [
    headers.map(toCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => toCsvCell(row[header] ?? "")).join(","))
  ];

  return Buffer.from(lines.join("\n"), "utf8");
}

async function workbookBuffer(rows: OrdersKpiSourceRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Orders KPIs");

  worksheet.addRow(requiredHeaders);
  for (const row of rows) {
    worksheet.addRow(requiredHeaders.map((header) => row[header] ?? ""));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function toCsvCell(value: string | number | Date | null | undefined) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

function createStore() {
  const now = new Date("2026-06-09T10:00:00.000Z");
  const store = {
    now,
    nextBatchNumber: 1,
    nextStagingNumber: 1,
    users: [
      {
        id: "user-picker-1",
        shopperId: "PICKER-1",
        role: UserRole.PICKER,
        nameEn: "Picker One"
      },
      {
        id: "user-champ-1",
        shopperId: "CHAMP-1",
        role: UserRole.CHAMP,
        nameEn: "Champ One"
      }
    ],
    vendors: [
      {
        id: "vendor-1",
        vendorCode: "V001",
        vendorExternalId: null,
        vendorName: "Vendor One",
        chainId: "chain-1",
        chain: {
          id: "chain-1",
          chainName: "Chain One"
        }
      },
      {
        id: "vendor-2",
        vendorCode: "V002",
        vendorExternalId: "EXT-2",
        vendorName: "Vendor Two",
        chainId: "chain-2",
        chain: {
          id: "chain-2",
          chainName: "Chain Two"
        }
      }
    ],
    batches: [] as StoredBatch[],
    stagingRows: [] as StoredStagingRow[],
    issues: [] as StoredIssue[],
    auditRows: [] as StoredAuditRow[],
    forbiddenMutationCalls: [] as string[]
  };

  const prisma = {
    user: {
      findMany: async ({
        where
      }: {
        where: { shopperId?: { in?: string[] } };
      }) => {
        const shopperIds = where.shopperId?.in ?? [];
        return store.users.filter((user) => shopperIds.includes(user.shopperId));
      },
      create: async () => {
        store.forbiddenMutationCalls.push("user.create");
        throw new Error("User creation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("user.update");
        throw new Error("User update is out of scope.");
      }
    },
    vendor: {
      findMany: async ({
        where
      }: {
        where: {
          OR?: Array<{
            vendorCode?: { in?: string[] };
            vendorExternalId?: { in?: string[] };
          }>;
        };
      }) => {
        const lookupValues = new Set<string>();
        for (const condition of where.OR ?? []) {
          for (const value of condition.vendorCode?.in ?? []) {
            lookupValues.add(value.toUpperCase());
          }
          for (const value of condition.vendorExternalId?.in ?? []) {
            lookupValues.add(value.toUpperCase());
          }
        }

        return store.vendors.filter(
          (vendor) =>
            lookupValues.has(vendor.vendorCode.toUpperCase()) ||
            (vendor.vendorExternalId
              ? lookupValues.has(vendor.vendorExternalId.toUpperCase())
              : false)
        );
      },
      create: async () => {
        store.forbiddenMutationCalls.push("vendor.create");
        throw new Error("Vendor creation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("vendor.update");
        throw new Error("Vendor update is out of scope.");
      }
    },
    ordersKpiImportBatch: {
      create: async ({
        data
      }: {
        data: Omit<StoredBatch, "id" | "createdAt" | "updatedAt">;
      }) => {
        const batch: StoredBatch = {
          id: `batch-${store.nextBatchNumber++}`,
          createdAt: store.now,
          updatedAt: store.now,
          ...data
        };
        store.batches.push(batch);
        return batch;
      }
    },
    ordersKpiImportStagingRow: {
      createMany: async ({ data }: { data: Omit<StoredStagingRow, "id">[] }) => {
        store.stagingRows.push(
          ...data.map((row) => ({
            id: `staging-${store.nextStagingNumber++}`,
            ...row
          }))
        );
        return { count: data.length };
      }
    },
    ordersKpiImportIssue: {
      createMany: async ({ data }: { data: StoredIssue[] }) => {
        store.issues.push(...data);
        return { count: data.length };
      }
    },
    ordersKpiDailyRecord: {
      create: async () => {
        store.forbiddenMutationCalls.push("ordersKpiDailyRecord.create");
        throw new Error("Daily record insertion is out of scope.");
      },
      createMany: async () => {
        store.forbiddenMutationCalls.push("ordersKpiDailyRecord.createMany");
        throw new Error("Daily record insertion is out of scope.");
      },
      deleteMany: async () => {
        store.forbiddenMutationCalls.push("ordersKpiDailyRecord.deleteMany");
        throw new Error("Daily record replacement is out of scope.");
      },
      upsert: async () => {
        store.forbiddenMutationCalls.push("ordersKpiDailyRecord.upsert");
        throw new Error("Daily record upsert is out of scope.");
      }
    },
    $transaction: async <T>(callback: (client: typeof prisma) => Promise<T>) =>
      callback(prisma)
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

function createService(storeContext: ReturnType<typeof createStore>) {
  const parser = new OrdersKpisParserService();
  const validator = new OrdersKpisValidatorService(storeContext.prisma as never);

  return new OrdersKpisImportService(
    storeContext.prisma as never,
    storeContext.auditService as never,
    parser,
    validator
  );
}

async function runMixedCsvPreviewTest() {
  const context = createStore();
  const service = createService(context);

  const response = await service.previewImport(
    csvBuffer([
      baseRow({ "vendor id": "v001" }),
      baseRow({
        date: "Jun 7, 2026",
        shopperId: "",
        "vendor id": "ext-2",
        "Preparation time": "No data"
      }),
      baseRow({
        shopperId: "NO-SUCH",
        "vendor id": "UNKNOWN-VENDOR"
      }),
      baseRow({
        shopperId: "CHAMP-1",
        "vendor id": "V001"
      }),
      baseRow({
        date: "2026-06-08",
        "vendor id": ""
      })
    ]),
    {
      actor: adminActor,
      fileName: "orders-kpis.csv",
      ipAddress: "127.0.0.1",
      userAgent: "orders-kpis-test"
    }
  );

  assert.equal(response.batch.status, OrdersKpiImportBatchStatus.NEEDS_REVIEW);
  assert.equal(response.batch.rowCount, 5);
  assert.equal(response.batch.confirmableRows, 4);
  assert.equal(response.batch.errorRows, 1);
  assert.equal(response.batch.canConfirm, false);
  assert.equal(response.batch.requiresReviewDecision, true);
  assert.deepEqual(response.batch.coveredDates, ["2026-06-07", "2026-06-08"]);
  assert.equal(response.batch.coveredDateFrom, "2026-06-07");
  assert.equal(response.batch.coveredDateTo, "2026-06-08");

  assert.equal(context.store.batches.length, 1);
  assert.equal(context.store.stagingRows.length, 4);
  assert.equal(context.store.stagingRows[0].matchedVendorId, "vendor-1");
  assert.equal(context.store.stagingRows[0].matchedChainId, "chain-1");
  assert.equal(context.store.stagingRows[0].userId, "user-picker-1");
  assert.equal(
    context.store.stagingRows[0].vendorMatchStatus,
    OrdersKpiVendorMatchStatus.MATCHED_VENDOR
  );
  assert.equal(
    context.store.stagingRows[0].pickerMatchStatus,
    OrdersKpiPickerMatchStatus.MATCHED_PICKER
  );

  const unknownPickerRow = context.store.stagingRows.find(
    (row) => row.sourcePickerKey === "__UNKNOWN__"
  );
  assert.ok(unknownPickerRow);
  assert.equal(unknownPickerRow.sourceShopperId, null);
  assert.equal(
    unknownPickerRow.pickerMatchStatus,
    OrdersKpiPickerMatchStatus.UNKNOWN_PICKER
  );
  assert.equal(unknownPickerRow.preparationTime, null);

  const unmappedVendorRow = context.store.stagingRows.find(
    (row) => row.sourceVendorId === "UNKNOWN-VENDOR"
  );
  assert.ok(unmappedVendorRow);
  assert.equal(unmappedVendorRow.matchedVendorId, null);
  assert.equal(
    unmappedVendorRow.vendorMatchStatus,
    OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID
  );

  const issueCodes = context.store.issues.map((issue) => issue.issueCode);
  assert.ok(issueCodes.includes(OrdersKpiIssueCode.MISSING_VENDOR_ID));
  assert.ok(issueCodes.includes(OrdersKpiIssueCode.MISSING_SHOPPER_ID));
  assert.ok(issueCodes.includes(OrdersKpiIssueCode.PREPARATION_TIME_MISSING));
  assert.ok(issueCodes.includes(OrdersKpiIssueCode.UNMAPPED_VENDOR_ID));
  assert.ok(issueCodes.includes(OrdersKpiIssueCode.UNMATCHED_SHOPPER_ID));
  assert.ok(issueCodes.includes(OrdersKpiIssueCode.MATCHED_USER_NOT_PICKER));

  assert.equal(response.summary.matchedVendorRows, 3);
  assert.equal(response.summary.unmappedVendorRows, 1);
  assert.equal(response.summary.matchedPickerRows, 1);
  assert.equal(response.summary.unmatchedShopperRows, 1);
  assert.equal(response.summary.unknownPickerRows, 1);
  assert.equal(response.summary.matchedUserNotPickerRows, 1);
  assert.equal(context.store.auditRows.length, 1);
  assert.equal(context.store.auditRows[0].action, "ORDERS_KPI_IMPORT_PREVIEWED");
  assert.deepEqual(context.store.forbiddenMutationCalls, []);
}

async function runXlsxPreviewTest() {
  const context = createStore();
  const service = createService(context);

  const response = await service.previewImport(
    await workbookBuffer([
      baseRow({
        date: new Date("2026-06-07T00:00:00.000Z"),
        shopperId: "PICKER-1",
        "vendor id": "V001"
      })
    ]),
    {
      actor: adminActor,
      fileName: "orders-kpis.xlsx",
      ipAddress: null,
      userAgent: null
    }
  );

  assert.equal(response.batch.status, OrdersKpiImportBatchStatus.VALIDATED);
  assert.equal(response.batch.canConfirm, true);
  assert.equal(response.batch.requiresReviewDecision, false);
  assert.equal(context.store.stagingRows.length, 1);
  assert.equal(context.store.issues.length, 0);
}

async function runMissingRequiredColumnsTest() {
  const context = createStore();
  const service = createService(context);
  const headers = requiredHeaders.filter((header) => header !== "Price modified");

  const response = await service.previewImport(csvBuffer([baseRow()], headers), {
    actor: adminActor,
    fileName: "missing-column.csv",
    ipAddress: null,
    userAgent: null
  });

  assert.equal(response.batch.status, OrdersKpiImportBatchStatus.FAILED);
  assert.equal(response.batch.canConfirm, false);
  assert.equal(context.store.stagingRows.length, 0);
  assert.equal(context.store.issues.length, 1);
  assert.equal(
    context.store.issues[0].issueCode,
    OrdersKpiIssueCode.MISSING_REQUIRED_COLUMNS
  );
  assert.equal(context.store.auditRows[0].action, "ORDERS_KPI_IMPORT_PREVIEWED");
}

async function runInvalidMetricTest() {
  const context = createStore();
  const service = createService(context);

  const response = await service.previewImport(
    csvBuffer([
      baseRow({
        "Total orders": -1
      }),
      baseRow({
        "Total orders": "not a number"
      })
    ]),
    {
      actor: adminActor,
      fileName: "invalid-metrics.csv",
      ipAddress: null,
      userAgent: null
    }
  );

  assert.equal(response.batch.status, OrdersKpiImportBatchStatus.FAILED);
  assert.equal(response.batch.confirmableRows, 0);
  assert.equal(context.store.stagingRows.length, 0);
  assert.ok(
    context.store.issues.some(
      (issue) => issue.issueCode === OrdersKpiIssueCode.NEGATIVE_METRIC
    )
  );
  assert.ok(
    context.store.issues.some(
      (issue) => issue.issueCode === OrdersKpiIssueCode.INVALID_NUMERIC_METRIC
    )
  );
}

async function runDuplicateAggregationTest() {
  const context = createStore();
  const service = createService(context);

  const response = await service.previewImport(
    csvBuffer([
      baseRow({
        "Total orders": 5,
        "Successful orders": 4,
        "Preparation time": 10
      }),
      baseRow({
        "Total orders": 7,
        "Successful orders": 6,
        "Preparation time": 20
      })
    ]),
    {
      actor: adminActor,
      fileName: "duplicate.csv",
      ipAddress: null,
      userAgent: null
    }
  );

  assert.equal(response.batch.status, OrdersKpiImportBatchStatus.VALIDATED);
  assert.equal(response.previewRows.length, 2);
  assert.equal(context.store.stagingRows.length, 1);
  assert.equal(context.store.stagingRows[0].totalOrders, 12);
  assert.equal(context.store.stagingRows[0].successfulOrders, 10);
  assert.equal(context.store.stagingRows[0].preparationTime, 15.8333);
}

async function main() {
  await runMixedCsvPreviewTest();
  await runXlsxPreviewTest();
  await runMissingRequiredColumnsTest();
  await runInvalidMetricTest();
  await runDuplicateAggregationTest();
}

void main();
