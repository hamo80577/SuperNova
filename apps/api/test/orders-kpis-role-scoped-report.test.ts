import "reflect-metadata";

import assert from "node:assert/strict";

import { ForbiddenException } from "@nestjs/common";
import {
  AssignmentStatus,
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  UserRole
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { OrdersKpisImportsController } from "../src/orders-kpis/orders-kpis-imports.controller";
import { OrdersKpisReportService } from "../src/orders-kpis/orders-kpis-report.service";
import { OrdersKpisReportsController } from "../src/orders-kpis/orders-kpis-reports.controller";
import { OrdersKpisTargetSettingsController } from "../src/orders-kpis/orders-kpis-target-settings.controller";
import { OrdersKpisTargetSettingsService } from "../src/orders-kpis/orders-kpis-target-settings.service";
import type {
  OrdersKpiImportActor,
  OrdersKpiPerformanceReportResponse
} from "../src/orders-kpis/orders-kpis.types";

interface StoredDailyRecord {
  id: string;
  sourceBatchId: string;
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

type ReportQuery = Parameters<OrdersKpisReportService["getPerformanceReport"]>[0];

const adminActor: OrdersKpiImportActor = {
  id: "admin-user-1",
  role: UserRole.ADMIN
};

const superAdminActor: OrdersKpiImportActor = {
  id: "super-admin-user-1",
  role: UserRole.SUPER_ADMIN
};

const areaManagerActor: OrdersKpiImportActor = {
  id: "area-manager-1",
  role: UserRole.AREA_MANAGER
};

const unassignedAreaManagerActor: OrdersKpiImportActor = {
  id: "area-manager-2",
  role: UserRole.AREA_MANAGER
};

const champActor: OrdersKpiImportActor = {
  id: "champ-1",
  role: UserRole.CHAMP
};

const pickerActor: OrdersKpiImportActor = {
  id: "picker-user-1",
  role: UserRole.PICKER
};

const chainAreaManagerAssignments = [
  {
    areaManagerId: "area-manager-1",
    chainId: "chain-1",
    status: AssignmentStatus.ACTIVE
  },
  {
    areaManagerId: "area-manager-1",
    chainId: "chain-2",
    status: AssignmentStatus.CLOSED
  }
];

const vendorChampAssignments = [
  {
    champId: "champ-1",
    vendorId: "vendor-a",
    status: AssignmentStatus.ACTIVE
  },
  {
    champId: "champ-1",
    vendorId: "vendor-c",
    status: AssignmentStatus.CLOSED
  }
];

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createDailyRecord(
  id: string,
  date: string,
  overrides: Partial<StoredDailyRecord> = {}
): StoredDailyRecord {
  return {
    id,
    sourceBatchId: "batch-1",
    kpiDate: dateOnly(date),
    sourceVendorId: "V-A",
    matchedVendorId: "vendor-a",
    matchedChainId: "chain-1",
    vendorNameSnapshot: "Vendor A",
    chainNameSnapshot: "Chain One",
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    sourceShopperId: "S-1",
    sourcePickerKey: "S-1",
    userId: "user-picker-1",
    pickerNameSnapshot: "Picker One",
    pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_PICKER,
    totalOrders: 0,
    successfulOrders: 0,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders: 0,
    orderNotOnTime: 0,
    partialRefund: 0,
    vendorDelay: 0,
    preparationTime: null,
    outOfStock: 0,
    firNotOnTime: 0,
    priceModified: 0,
    issuesCount: 0,
    ...overrides
  };
}

function createScopedReportRecords() {
  return [
    createDailyRecord("vendor-a-matched", "2026-06-03", {
      totalOrders: 100,
      unhealthyOrders: 10
    }),
    createDailyRecord("vendor-a-unknown-picker", "2026-06-03", {
      sourceShopperId: null,
      sourcePickerKey: "__UNKNOWN__",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNKNOWN_PICKER,
      totalOrders: 50,
      unhealthyOrders: 5
    }),
    createDailyRecord("vendor-a-unmatched-shopper", "2026-06-03", {
      sourceShopperId: "777",
      sourcePickerKey: "777",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID,
      totalOrders: 30,
      unhealthyOrders: 3
    }),
    createDailyRecord("vendor-b-matched", "2026-06-03", {
      sourceVendorId: "V-B",
      matchedVendorId: "vendor-b",
      vendorNameSnapshot: "Vendor B",
      sourceShopperId: "S-2",
      sourcePickerKey: "S-2",
      userId: "user-picker-2",
      pickerNameSnapshot: "Picker Two",
      totalOrders: 40,
      unhealthyOrders: 4
    }),
    createDailyRecord("vendor-c-matched", "2026-06-03", {
      sourceVendorId: "V-C",
      matchedVendorId: "vendor-c",
      matchedChainId: "chain-2",
      vendorNameSnapshot: "Vendor C",
      chainNameSnapshot: "Chain Two",
      sourceShopperId: "S-3",
      sourcePickerKey: "S-3",
      userId: "user-picker-3",
      pickerNameSnapshot: "Picker Three",
      totalOrders: 60,
      unhealthyOrders: 6
    }),
    createDailyRecord("unmapped-vendor", "2026-06-03", {
      sourceVendorId: "U-9",
      matchedVendorId: null,
      matchedChainId: null,
      vendorNameSnapshot: null,
      chainNameSnapshot: null,
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      totalOrders: 25,
      unhealthyOrders: 2
    }),
    createDailyRecord("previous-vendor-a", "2026-06-02", {
      totalOrders: 80,
      unhealthyOrders: 8
    }),
    createDailyRecord("previous-vendor-c", "2026-06-02", {
      sourceVendorId: "V-C",
      matchedVendorId: "vendor-c",
      matchedChainId: "chain-2",
      vendorNameSnapshot: "Vendor C",
      chainNameSnapshot: "Chain Two",
      totalOrders: 70,
      unhealthyOrders: 7
    }),
    createDailyRecord("previous-unmapped", "2026-06-02", {
      sourceVendorId: "U-9",
      matchedVendorId: null,
      matchedChainId: null,
      vendorNameSnapshot: null,
      chainNameSnapshot: null,
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      totalOrders: 15,
      unhealthyOrders: 1
    })
  ];
}

function createStore() {
  const store = {
    dailyRecords: createScopedReportRecords(),
    assignmentQueryCalls: [] as string[],
    forbiddenMutationCalls: [] as string[]
  };
  const forbiddenMutation = (name: string) => async () => {
    store.forbiddenMutationCalls.push(name);
    throw new Error(`${name} is out of scope.`);
  };
  const prisma = {
    ordersKpiDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        store.dailyRecords.filter((record) => matchesRecordWhere(record, where)),
      create: forbiddenMutation("ordersKpiDailyRecord.create"),
      createMany: forbiddenMutation("ordersKpiDailyRecord.createMany"),
      update: forbiddenMutation("ordersKpiDailyRecord.update"),
      delete: forbiddenMutation("ordersKpiDailyRecord.delete"),
      deleteMany: forbiddenMutation("ordersKpiDailyRecord.deleteMany"),
      upsert: forbiddenMutation("ordersKpiDailyRecord.upsert")
    },
    chainAreaManagerAssignment: {
      findMany: async ({
        where
      }: {
        where: { areaManagerId: string; status: AssignmentStatus };
      }) => {
        store.assignmentQueryCalls.push("chainAreaManagerAssignment.findMany");
        return chainAreaManagerAssignments
          .filter(
            (assignment) =>
              assignment.areaManagerId === where.areaManagerId &&
              assignment.status === where.status
          )
          .map((assignment) => ({ chainId: assignment.chainId }));
      },
      create: forbiddenMutation("chainAreaManagerAssignment.create"),
      update: forbiddenMutation("chainAreaManagerAssignment.update")
    },
    vendorChampAssignment: {
      findMany: async ({
        where
      }: {
        where: { champId: string; status: AssignmentStatus };
      }) => {
        store.assignmentQueryCalls.push("vendorChampAssignment.findMany");
        return vendorChampAssignments
          .filter(
            (assignment) =>
              assignment.champId === where.champId &&
              assignment.status === where.status
          )
          .map((assignment) => ({ vendorId: assignment.vendorId }));
      },
      create: forbiddenMutation("vendorChampAssignment.create"),
      update: forbiddenMutation("vendorChampAssignment.update")
    },
    ordersKpiTargetSettings: {
      findUnique: async () => null,
      upsert: forbiddenMutation("ordersKpiTargetSettings.upsert")
    },
    pickerBranchAssignment: {
      findMany: forbiddenMutation("pickerBranchAssignment.findMany"),
      create: forbiddenMutation("pickerBranchAssignment.create"),
      update: forbiddenMutation("pickerBranchAssignment.update")
    },
    user: {
      findMany: forbiddenMutation("user.findMany"),
      create: forbiddenMutation("user.create"),
      update: forbiddenMutation("user.update")
    },
    vendor: {
      findMany: forbiddenMutation("vendor.findMany"),
      create: forbiddenMutation("vendor.create"),
      update: forbiddenMutation("vendor.update")
    },
    chain: {
      findMany: forbiddenMutation("chain.findMany"),
      create: forbiddenMutation("chain.create"),
      update: forbiddenMutation("chain.update")
    }
  };

  const targetSettingsService = new OrdersKpisTargetSettingsService(
    prisma as never,
    { log: forbiddenMutation("audit.log") } as never
  );

  return {
    prisma,
    service: new OrdersKpisReportService(prisma as never, targetSettingsService),
    store
  };
}

function matchesRecordWhere(
  record: StoredDailyRecord,
  where: Record<string, unknown>
): boolean {
  if (Array.isArray(where.AND)) {
    if (
      !where.AND.every((nested) =>
        matchesRecordWhere(record, nested as Record<string, unknown>)
      )
    ) {
      return false;
    }
  }

  return (
    matchesDateFilter(record, where.kpiDate) &&
    matchesScalarFilter(record.matchedChainId, where.matchedChainId) &&
    matchesScalarFilter(record.matchedVendorId, where.matchedVendorId) &&
    matchesScalarFilter(record.sourceVendorId, where.sourceVendorId) &&
    matchesScalarFilter(record.userId, where.userId) &&
    matchesScalarFilter(record.sourceShopperId, where.sourceShopperId) &&
    matchesScalarFilter(record.sourcePickerKey, where.sourcePickerKey) &&
    matchesScalarFilter(record.vendorMatchStatus, where.vendorMatchStatus)
  );
}

function matchesDateFilter(record: StoredDailyRecord, filter: unknown) {
  if (!filter || typeof filter !== "object") {
    return true;
  }

  const dateFilter = filter as { gte?: Date; lte?: Date; lt?: Date };
  const time = record.kpiDate.getTime();
  return (
    (!dateFilter.gte || time >= dateFilter.gte.getTime()) &&
    (!dateFilter.lte || time <= dateFilter.lte.getTime()) &&
    (!dateFilter.lt || time < dateFilter.lt.getTime())
  );
}

function matchesScalarFilter(actual: string | null, filter: unknown) {
  if (filter === undefined) {
    return true;
  }

  if (
    filter !== null &&
    typeof filter === "object" &&
    Array.isArray((filter as { in?: unknown[] }).in)
  ) {
    return ((filter as { in: unknown[] }).in.includes(actual));
  }

  return actual === filter;
}

function reportQuery(overrides: Partial<ReportQuery> = {}): ReportQuery {
  return {
    dateFrom: "2026-06-03",
    dateTo: "2026-06-03",
    view: "CHAIN",
    ...overrides
  };
}

function rowTotal(response: OrdersKpiPerformanceReportResponse) {
  return response.rows.reduce((sum, row) => sum + row.metrics.totalOrders, 0);
}

async function testAdminAndSuperAdminSeeAllDataIncludingUnmapped() {
  const context = createStore();
  const adminResponse = await context.service.getPerformanceReport(reportQuery(), {
    actor: adminActor
  });
  const superAdminResponse = await context.service.getPerformanceReport(
    reportQuery(),
    { actor: superAdminActor }
  );

  assert.equal(adminResponse.summary.totalOrders, 305);
  assert.equal(adminResponse.rows.length, 3);
  assert.ok(
    adminResponse.rows.some((row) => row.groupType === "UNMAPPED_CHAIN")
  );
  assert.ok(
    adminResponse.filterOptions.chains.some((option) => option.unmappedOnly)
  );
  assert.deepEqual(superAdminResponse.summary, adminResponse.summary);
  assert.equal(context.store.assignmentQueryCalls.length, 0);
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testAreaManagerSeesOnlyAssignedChainData() {
  const context = createStore();
  const response = await context.service.getPerformanceReport(reportQuery(), {
    actor: areaManagerActor
  });

  assert.equal(response.summary.totalOrders, 220);
  assert.equal(response.summary.unhealthyOrders, 22);
  assert.equal(response.summary.unhealthyRate, 10);
  assert.equal(response.rows.length, 1);
  assert.equal(response.rows[0].groupKey, "chain-1");
  assert.ok(!response.rows.some((row) => row.groupKey === "chain-2"));
  assert.ok(!response.rows.some((row) => row.groupType === "UNMAPPED_CHAIN"));

  assert.equal(response.comparison.summary.totalOrders.previous, 80);
  assert.equal(response.comparison.summary.totalOrders.delta, 140);
  assert.equal(response.trend.length, 1);
  assert.equal(response.trend[0].metrics.totalOrders, 220);
  assert.equal(response.targetEvaluation.primary.rate, 10);

  assert.equal(response.filterOptions.chains.length, 1);
  assert.equal(response.filterOptions.chains[0].id, "chain-1");
  assert.ok(
    !response.filterOptions.chains.some((option) => option.unmappedOnly)
  );
  assert.ok(
    !response.filterOptions.vendors.some(
      (option) => option.sourceVendorId === "U-9"
    )
  );
  assert.ok(
    !response.filterOptions.vendors.some((option) => option.id === "vendor-c")
  );
  assert.ok(
    !response.filterOptions.pickers.some(
      (option) => option.id === "user-picker-3"
    )
  );
  assert.ok(
    context.store.assignmentQueryCalls.includes(
      "chainAreaManagerAssignment.findMany"
    )
  );
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testAreaManagerVendorAndPickerViewsReconcile() {
  const context = createStore();
  const vendorResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR" }),
    { actor: areaManagerActor }
  );

  assert.equal(vendorResponse.rows.length, 2);
  assert.deepEqual(
    vendorResponse.rows.map((row) => row.groupKey).sort(),
    ["vendor-a", "vendor-b"]
  );
  assert.ok(
    !vendorResponse.rows.some((row) => row.groupType === "UNMAPPED_VENDOR")
  );
  assert.equal(rowTotal(vendorResponse), 220);

  const pickerResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", vendorId: "vendor-a" }),
    { actor: areaManagerActor }
  );

  assert.equal(pickerResponse.rows.length, 3);
  assert.ok(
    pickerResponse.rows.some((row) => row.groupType === "UNKNOWN_PICKER")
  );
  assert.ok(
    pickerResponse.rows.some((row) => row.groupType === "UNMATCHED_SHOPPER")
  );
  assert.equal(rowTotal(pickerResponse), 180);
  assert.equal(pickerResponse.summary.totalOrders, 180);
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testAreaManagerOutOfScopeFiltersAndUnmappedAccess() {
  const context = createStore();
  const outOfScopeResponse = await context.service.getPerformanceReport(
    reportQuery({ chainId: "chain-2" }),
    { actor: areaManagerActor }
  );

  assert.equal(outOfScopeResponse.summary.totalOrders, 0);
  assert.equal(outOfScopeResponse.rows.length, 0);

  const vendorInUnassignedChainResponse =
    await context.service.getPerformanceReport(
      reportQuery({ view: "VENDOR", vendorId: "vendor-c" }),
      { actor: areaManagerActor }
    );

  assert.equal(vendorInUnassignedChainResponse.summary.totalOrders, 0);
  assert.equal(vendorInUnassignedChainResponse.rows.length, 0);

  const unmappedDrilldownResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR", sourceVendorId: "U-9" }),
    { actor: areaManagerActor }
  );

  assert.equal(unmappedDrilldownResponse.summary.totalOrders, 0);
  assert.equal(unmappedDrilldownResponse.rows.length, 0);

  await assert.rejects(
    context.service.getPerformanceReport(reportQuery({ unmappedOnly: "true" }), {
      actor: areaManagerActor
    }),
    ForbiddenException
  );

  const unassignedResponse = await context.service.getPerformanceReport(
    reportQuery(),
    { actor: unassignedAreaManagerActor }
  );

  assert.equal(unassignedResponse.summary.totalOrders, 0);
  assert.equal(unassignedResponse.rows.length, 0);
  assert.deepEqual(unassignedResponse.filterOptions.chains, []);
  assert.deepEqual(unassignedResponse.filterOptions.vendors, []);
  assert.deepEqual(unassignedResponse.filterOptions.pickers, []);
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testChampSeesOnlyAssignedVendorData() {
  const context = createStore();
  const chainResponse = await context.service.getPerformanceReport(
    reportQuery(),
    { actor: champActor }
  );

  assert.equal(chainResponse.summary.totalOrders, 180);
  assert.equal(chainResponse.rows.length, 1);
  assert.equal(chainResponse.rows[0].groupKey, "chain-1");
  assert.equal(chainResponse.rows[0].metrics.totalOrders, 180);
  assert.equal(chainResponse.comparison.summary.totalOrders.previous, 80);

  const vendorResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR" }),
    { actor: champActor }
  );

  assert.equal(vendorResponse.rows.length, 1);
  assert.equal(vendorResponse.rows[0].groupKey, "vendor-a");
  assert.ok(
    !vendorResponse.rows.some((row) => row.groupType === "UNMAPPED_VENDOR")
  );
  assert.equal(vendorResponse.filterOptions.vendors.length, 1);
  assert.equal(vendorResponse.filterOptions.vendors[0].id, "vendor-a");
  assert.ok(
    !vendorResponse.filterOptions.vendors.some(
      (option) => option.sourceVendorId === "U-9"
    )
  );

  const pickerResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", vendorId: "vendor-a" }),
    { actor: champActor }
  );

  assert.equal(pickerResponse.rows.length, 3);
  assert.equal(rowTotal(pickerResponse), 180);
  assert.ok(
    pickerResponse.rows.some((row) => row.groupType === "UNKNOWN_PICKER")
  );

  const outOfScopeResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR", vendorId: "vendor-c" }),
    { actor: champActor }
  );

  assert.equal(outOfScopeResponse.summary.totalOrders, 0);
  assert.equal(outOfScopeResponse.rows.length, 0);

  const unmappedDrilldownResponse = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", sourceVendorId: "U-9" }),
    { actor: champActor }
  );

  assert.equal(unmappedDrilldownResponse.summary.totalOrders, 0);
  assert.equal(unmappedDrilldownResponse.rows.length, 0);

  await assert.rejects(
    context.service.getPerformanceReport(reportQuery({ unmappedOnly: "true" }), {
      actor: champActor
    }),
    ForbiddenException
  );
  assert.ok(
    context.store.assignmentQueryCalls.includes("vendorChampAssignment.findMany")
  );
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testAccessRulesAndAdminOnlySurfaces() {
  const context = createStore();

  await assert.rejects(
    context.service.getPerformanceReport(reportQuery(), { actor: pickerActor }),
    ForbiddenException
  );

  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, OrdersKpisReportsController), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.AREA_MANAGER,
    UserRole.CHAMP
  ]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, OrdersKpisImportsController), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, OrdersKpisTargetSettingsController),
    [UserRole.ADMIN, UserRole.SUPER_ADMIN]
  );
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function main() {
  await testAdminAndSuperAdminSeeAllDataIncludingUnmapped();
  await testAreaManagerSeesOnlyAssignedChainData();
  await testAreaManagerVendorAndPickerViewsReconcile();
  await testAreaManagerOutOfScopeFiltersAndUnmappedAccess();
  await testChampSeesOnlyAssignedVendorData();
  await testAccessRulesAndAdminOnlySurfaces();
  console.log("orders-kpis role-scoped report tests passed");
}

void main();
