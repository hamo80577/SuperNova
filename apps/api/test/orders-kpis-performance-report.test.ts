import assert from "node:assert/strict";

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  UserRole
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { OrdersKpisReportService } from "../src/orders-kpis/orders-kpis-report.service";
import { OrdersKpisReportsController } from "../src/orders-kpis/orders-kpis-reports.controller";
import type {
  OrdersKpiImportActor,
  OrdersKpiPerformanceReportResponse,
  OrdersKpiTargetSettingsValues
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

const pickerActor: OrdersKpiImportActor = {
  id: "picker-user-1",
  role: UserRole.PICKER
};

const defaultTargets: OrdersKpiTargetSettingsValues = {
  uhoRateTarget: 8,
  notOnTimeRateTarget: 10,
  qcFailedRateTarget: 5,
  partialRefundRateTarget: 3,
  oosRateTarget: 3,
  priceModifiedRateTarget: 3
};

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
    totalOrders: 100,
    successfulOrders: 90,
    qcFailedOrders: 3,
    vendorFailedOrders: 7,
    unhealthyOrders: 25,
    orderNotOnTime: 10,
    partialRefund: 2,
    vendorDelay: 6,
    preparationTime: 10,
    outOfStock: 4,
    firNotOnTime: 1,
    priceModified: 5,
    issuesCount: 0,
    ...overrides
  };
}

function createReportRecords() {
  return [
    createDailyRecord("vendor-a-matched-picker", "2026-06-03"),
    createDailyRecord("vendor-a-unmatched-shopper", "2026-06-03", {
      sourceShopperId: "777",
      sourcePickerKey: "777",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID,
      totalOrders: 20,
      successfulOrders: 18,
      qcFailedOrders: 1,
      vendorFailedOrders: 1,
      unhealthyOrders: 5,
      orderNotOnTime: 2,
      partialRefund: 1,
      vendorDelay: 1,
      preparationTime: null,
      outOfStock: 1,
      firNotOnTime: 0,
      priceModified: 0
    }),
    createDailyRecord("vendor-a-unknown-picker", "2026-06-03", {
      sourceShopperId: null,
      sourcePickerKey: "__UNKNOWN__",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNKNOWN_PICKER,
      totalOrders: 30,
      successfulOrders: 29,
      qcFailedOrders: 0,
      vendorFailedOrders: 1,
      unhealthyOrders: 0,
      orderNotOnTime: 0,
      partialRefund: 0,
      vendorDelay: 0,
      preparationTime: 20,
      outOfStock: 0,
      firNotOnTime: 0,
      priceModified: 1
    }),
    createDailyRecord("vendor-a-non-picker-user", "2026-06-03", {
      sourceShopperId: "888",
      sourcePickerKey: "888",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_USER_NOT_PICKER,
      totalOrders: 10,
      successfulOrders: 9,
      qcFailedOrders: 1,
      vendorFailedOrders: 0,
      unhealthyOrders: 5,
      orderNotOnTime: 1,
      partialRefund: 0,
      vendorDelay: 0,
      preparationTime: 30,
      outOfStock: 0,
      firNotOnTime: 0,
      priceModified: 0
    }),
    createDailyRecord("vendor-b", "2026-06-03", {
      sourceVendorId: "V-B",
      matchedVendorId: "vendor-b",
      vendorNameSnapshot: "Vendor B",
      sourceShopperId: "S-2",
      sourcePickerKey: "S-2",
      userId: "user-picker-2",
      pickerNameSnapshot: "Picker Two",
      totalOrders: 50,
      successfulOrders: 41,
      qcFailedOrders: 4,
      vendorFailedOrders: 5,
      unhealthyOrders: 20,
      orderNotOnTime: 8,
      partialRefund: 1,
      vendorDelay: 2,
      preparationTime: 15,
      outOfStock: 3,
      firNotOnTime: 2,
      priceModified: 1
    }),
    createDailyRecord("vendor-c", "2026-06-04", {
      sourceVendorId: "V-C",
      matchedVendorId: "vendor-c",
      matchedChainId: "chain-2",
      vendorNameSnapshot: "Vendor C",
      chainNameSnapshot: "Chain Two",
      sourceShopperId: "S-3",
      sourcePickerKey: "S-3",
      userId: "user-picker-3",
      pickerNameSnapshot: "Picker Three",
      totalOrders: 70,
      successfulOrders: 65,
      qcFailedOrders: 2,
      vendorFailedOrders: 3,
      unhealthyOrders: 7,
      orderNotOnTime: 5,
      partialRefund: 0,
      vendorDelay: 1,
      preparationTime: 12,
      outOfStock: 2,
      firNotOnTime: 0,
      priceModified: 0
    }),
    createDailyRecord("unmapped-source-9", "2026-06-03", {
      sourceVendorId: "U-9",
      matchedVendorId: null,
      matchedChainId: null,
      vendorNameSnapshot: null,
      chainNameSnapshot: null,
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      sourceShopperId: null,
      sourcePickerKey: "__UNKNOWN__",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNKNOWN_PICKER,
      totalOrders: 40,
      successfulOrders: 35,
      qcFailedOrders: 2,
      vendorFailedOrders: 3,
      unhealthyOrders: 10,
      orderNotOnTime: 4,
      partialRefund: 1,
      vendorDelay: 2,
      preparationTime: 11,
      outOfStock: 1,
      firNotOnTime: 0,
      priceModified: 2
    }),
    createDailyRecord("unmapped-source-10", "2026-06-04", {
      sourceVendorId: "U-10",
      matchedVendorId: null,
      matchedChainId: null,
      vendorNameSnapshot: null,
      chainNameSnapshot: null,
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      sourceShopperId: null,
      sourcePickerKey: "__UNKNOWN__",
      userId: null,
      pickerNameSnapshot: null,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNKNOWN_PICKER,
      totalOrders: 60,
      successfulOrders: 52,
      qcFailedOrders: 3,
      vendorFailedOrders: 5,
      unhealthyOrders: 30,
      orderNotOnTime: 7,
      partialRefund: 2,
      vendorDelay: 3,
      preparationTime: 13,
      outOfStock: 4,
      firNotOnTime: 1,
      priceModified: 3
    }),
    createDailyRecord("previous-vendor-a", "2026-06-01", {
      totalOrders: 80,
      successfulOrders: 72,
      qcFailedOrders: 2,
      vendorFailedOrders: 6,
      unhealthyOrders: 8,
      orderNotOnTime: 4,
      partialRefund: 1,
      vendorDelay: 2,
      preparationTime: 10,
      outOfStock: 1,
      firNotOnTime: 0,
      priceModified: 1
    }),
    createDailyRecord("previous-vendor-b", "2026-06-02", {
      sourceVendorId: "V-B",
      matchedVendorId: "vendor-b",
      vendorNameSnapshot: "Vendor B",
      sourceShopperId: "S-2",
      sourcePickerKey: "S-2",
      userId: "user-picker-2",
      pickerNameSnapshot: "Picker Two",
      totalOrders: 40,
      successfulOrders: 35,
      qcFailedOrders: 1,
      vendorFailedOrders: 4,
      unhealthyOrders: 10,
      orderNotOnTime: 5,
      partialRefund: 0,
      vendorDelay: 1,
      preparationTime: 14,
      outOfStock: 2,
      firNotOnTime: 1,
      priceModified: 0
    }),
    createDailyRecord("before-range", "2026-06-02", {
      sourceVendorId: "IGNORED-BEFORE",
      matchedVendorId: "ignored-before",
      matchedChainId: "ignored-chain",
      vendorNameSnapshot: "Ignored Before",
      chainNameSnapshot: "Ignored Chain",
      totalOrders: 999,
      unhealthyOrders: 999
    }),
    createDailyRecord("after-range", "2026-06-05", {
      totalOrders: 999,
      unhealthyOrders: 999
    })
  ];
}

function createStore(targets: OrdersKpiTargetSettingsValues = defaultTargets) {
  const store = {
    dailyRecords: createReportRecords(),
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
    ordersKpiImportStagingRow: {
      findMany: forbiddenMutation("ordersKpiImportStagingRow.findMany"),
      createMany: forbiddenMutation("ordersKpiImportStagingRow.createMany")
    },
    ordersKpiImportIssue: {
      findMany: forbiddenMutation("ordersKpiImportIssue.findMany"),
      createMany: forbiddenMutation("ordersKpiImportIssue.createMany")
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
    },
    pickerBranchAssignment: {
      findMany: forbiddenMutation("pickerBranchAssignment.findMany"),
      create: forbiddenMutation("pickerBranchAssignment.create"),
      update: forbiddenMutation("pickerBranchAssignment.update")
    },
    vendorChampAssignment: {
      findMany: forbiddenMutation("vendorChampAssignment.findMany"),
      create: forbiddenMutation("vendorChampAssignment.create"),
      update: forbiddenMutation("vendorChampAssignment.update")
    },
    chainAreaManagerAssignment: {
      findMany: forbiddenMutation("chainAreaManagerAssignment.findMany"),
      create: forbiddenMutation("chainAreaManagerAssignment.create"),
      update: forbiddenMutation("chainAreaManagerAssignment.update")
    },
    request: {
      findMany: forbiddenMutation("request.findMany"),
      create: forbiddenMutation("request.create"),
      update: forbiddenMutation("request.update")
    },
    attendanceDailyRecord: {
      findMany: forbiddenMutation("attendanceDailyRecord.findMany"),
      create: forbiddenMutation("attendanceDailyRecord.create"),
      update: forbiddenMutation("attendanceDailyRecord.update")
    }
  };

  return {
    prisma,
    service: new OrdersKpisReportService(prisma as never, {
      getTargetSettingsForReport: async () => ({
        id: "global",
        source: "SAVED",
        targets,
        updatedByUserId: "admin-user-1",
        createdAt: "2026-06-10T10:00:00.000Z",
        updatedAt: "2026-06-10T10:00:00.000Z"
      })
    } as never),
    store
  };
}

function matchesRecordWhere(
  record: StoredDailyRecord,
  where: Record<string, unknown>
) {
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

  return actual === filter;
}

function reportQuery(overrides: Partial<ReportQuery> = {}): ReportQuery {
  return {
    dateFrom: "2026-06-03",
    dateTo: "2026-06-04",
    view: "CHAIN",
    ...overrides
  };
}

function totalRows(response: OrdersKpiPerformanceReportResponse) {
  return response.rows.reduce((sum, row) => sum + row.metrics.totalOrders, 0);
}

async function testChainViewSummaryAndPagination() {
  const context = createStore();
  const response = await context.service.getPerformanceReport(
    reportQuery({ pageSize: "1" }),
    { actor: adminActor }
  );

  assert.equal(response.summary.totalOrders, 380);
  assert.equal(response.summary.unhealthyOrders, 102);
  assert.equal(response.summary.unhealthyRate, (102 / 380) * 100);
  assert.equal(response.summary.orderNotOnTime, 37);
  assert.equal(response.summary.qcFailedOrders, 16);
  assert.equal(response.summary.partialRefund, 7);
  assert.equal(response.summary.outOfStock, 15);
  assert.equal(response.summary.priceModified, 12);
  assert.equal(response.targets.targets.uhoRateTarget, 8);
  assert.equal(response.targetEvaluation.status, "OUT_OF_TARGET");
  assert.equal(response.targetEvaluation.primary.rate, 26.8421);
  assert.equal(response.rows.length, 1);
  assert.equal(response.pagination.totalRows, 3);
  assert.equal(response.pagination.totalPages, 3);

  const chainOne = response.rows[0];
  assert.equal(chainOne.groupType, "MATCHED_CHAIN");
  assert.equal(chainOne.groupKey, "chain-1");
  assert.equal(chainOne.label, "Chain One");
  assert.equal(chainOne.metrics.totalOrders, 210);
  assert.equal(chainOne.targetEvaluation.status, "OUT_OF_TARGET");
  assert.ok(
    chainOne.targetEvaluation.secondaryWarnings.some(
      (warning) => warning.metricKey === "outOfStock"
    )
  );
  assert.deepEqual(chainOne.drilldownParams, { chainId: "chain-1" });
  assert.equal(chainOne.hasDrilldown, true);
  assert.equal(chainOne.nextView, "VENDOR");

  const allRows = await context.service.getPerformanceReport(reportQuery(), {
    actor: adminActor
  });
  assert.deepEqual(
    allRows.rows.map((row) => row.groupType),
    ["MATCHED_CHAIN", "UNMAPPED_CHAIN", "MATCHED_CHAIN"]
  );
  assert.equal(allRows.rows[1].groupKey, "UNMAPPED_CHAIN");
  assert.equal(allRows.rows[1].label, "Unmapped Chain");
  assert.deepEqual(allRows.rows[1].drilldownParams, { unmappedOnly: true });
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testVendorViewsGroupMatchedAndUnmappedRows() {
  const context = createStore();
  const chainVendors = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR", chainId: "chain-1" }),
    { actor: adminActor }
  );

  assert.equal(chainVendors.summary.totalOrders, 210);
  assert.deepEqual(
    chainVendors.rows.map((row) => row.label),
    ["Vendor A", "Vendor B"]
  );
  assert.equal(chainVendors.rows[0].groupType, "MATCHED_VENDOR");
  assert.equal(chainVendors.rows[0].metrics.totalOrders, 160);
  assert.ok(Math.abs((chainVendors.rows[0].metrics.preparationTime ?? 0) - 13.5714) < 0.0001);
  assert.deepEqual(chainVendors.rows[0].drilldownParams, { vendorId: "vendor-a" });

  const unmappedVendors = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR", unmappedOnly: "true" }),
    { actor: adminActor }
  );

  assert.equal(unmappedVendors.summary.totalOrders, 100);
  assert.deepEqual(
    unmappedVendors.rows.map((row) => row.label),
    ["Unmapped Vendor U-10", "Unmapped Vendor U-9"]
  );
  assert.equal(unmappedVendors.rows[0].groupType, "UNMAPPED_VENDOR");
  assert.deepEqual(unmappedVendors.rows[0].drilldownParams, {
    sourceVendorId: "U-10"
  });

  const allVendors = await context.service.getPerformanceReport(
    reportQuery({ view: "VENDOR" }),
    { actor: adminActor }
  );

  assert.equal(allVendors.summary.totalOrders, 380);
  assert.equal(allVendors.pagination.totalRows, 5);
  assert.ok(allVendors.rows.some((row) => row.groupType === "MATCHED_VENDOR"));
  assert.ok(allVendors.rows.some((row) => row.groupType === "UNMAPPED_VENDOR"));
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testPickerViewBucketsAndSearch() {
  const context = createStore();
  const pickerRows = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", vendorId: "vendor-a" }),
    { actor: adminActor }
  );

  assert.equal(pickerRows.summary.totalOrders, 160);
  assert.equal(totalRows(pickerRows), pickerRows.summary.totalOrders);
  assert.deepEqual(
    pickerRows.rows.map((row) => row.groupType),
    [
      "MATCHED_PICKER",
      "UNKNOWN_PICKER",
      "UNMATCHED_SHOPPER",
      "MATCHED_USER_NOT_PICKER"
    ]
  );
  assert.equal(pickerRows.rows[0].groupKey, "user-picker-1");
  assert.equal(pickerRows.rows[1].label, "Unknown Picker");
  assert.equal(pickerRows.rows[2].label, "Unmatched shopperId: 777");
  assert.equal(pickerRows.rows[3].label, "Non-Picker shopperId: 888");
  assert.equal(pickerRows.rows.every((row) => !row.hasDrilldown), true);

  const searchedRows = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", vendorId: "vendor-a", pickerSearch: "777" }),
    { actor: adminActor }
  );

  assert.equal(searchedRows.summary.totalOrders, 20);
  assert.equal(searchedRows.rows.length, 1);
  assert.equal(searchedRows.rows[0].groupType, "UNMATCHED_SHOPPER");

  const unmappedPickerRows = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", sourceVendorId: "U-10" }),
    { actor: adminActor }
  );

  assert.equal(unmappedPickerRows.summary.totalOrders, 60);
  assert.equal(unmappedPickerRows.rows[0].groupType, "UNKNOWN_PICKER");

  const chainPickerRows = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER", chainId: "chain-1" }),
    { actor: adminActor }
  );

  assert.equal(chainPickerRows.summary.totalOrders, 210);
  assert.ok(chainPickerRows.rows.some((row) => row.label === "Picker Two"));

  const allPickerRows = await context.service.getPerformanceReport(
    reportQuery({ view: "PICKER" }),
    { actor: adminActor }
  );

  assert.equal(allPickerRows.summary.totalOrders, 380);
  assert.ok(allPickerRows.rows.some((row) => row.groupType === "UNKNOWN_PICKER"));
  await assert.rejects(
    context.service.getPerformanceReport(
      reportQuery({ view: "PICKER", vendorId: "vendor-a", sourceVendorId: "U-10" }),
      { actor: adminActor }
    ),
    BadRequestException
  );
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testComparisonTrendSearchAndFilterOptions() {
  const context = createStore();
  const response = await context.service.getPerformanceReport(
    reportQuery({ search: "Vendor A", view: "VENDOR" }),
    { actor: adminActor }
  );

  assert.equal(response.filters.search, "Vendor A");
  assert.equal(response.summary.totalOrders, 160);
  assert.equal(response.rows.length, 1);
  assert.equal(response.rows[0].label, "Vendor A");
  assert.deepEqual(response.comparison.previousPeriod, {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-02"
  });
  assert.equal(response.comparison.summary.totalOrders.previous, 80);
  assert.equal(response.comparison.summary.totalOrders.delta, 80);
  assert.equal(response.comparison.summary.totalOrders.deltaPercent, 100);
  assert.equal(response.rows[0].comparison.totalOrders.previous, 80);
  assert.equal(response.rows[0].comparison.totalOrders.delta, 80);
  assert.equal(response.trend.length, 2);
  assert.deepEqual(
    response.trend.map((point) => [point.date, point.metrics.totalOrders]),
    [
      ["2026-06-03", 160],
      ["2026-06-04", 0]
    ]
  );
  assert.deepEqual(
    response.filterOptions.chains.map((option) => option.label),
    ["Chain One"]
  );
  assert.deepEqual(
    response.filterOptions.vendors.map((option) => option.label),
    ["Vendor A"]
  );
  assert.ok(
    response.filterOptions.pickers.some((option) => option.label === "Picker One")
  );
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function testTargetEvaluationKeepsSecondaryWarningsSeparate() {
  const context = createStore({
    ...defaultTargets,
    notOnTimeRateTarget: 1,
    uhoRateTarget: 100
  });
  const response = await context.service.getPerformanceReport(
    reportQuery({ search: "Vendor A", view: "VENDOR" }),
    { actor: adminActor }
  );

  assert.equal(response.rows[0].targetEvaluation.status, "IN_TARGET");
  assert.equal(response.rows[0].targetEvaluation.primary.status, "IN_TARGET");
  assert.ok(
    response.rows[0].targetEvaluation.secondaryWarnings.some(
      (warning) => warning.metricKey === "orderNotOnTime"
    )
  );
}

async function testSortingAccessAndControllerRoles() {
  const context = createStore();
  const totalOrdersAsc = await context.service.getPerformanceReport(
    reportQuery({ sortBy: "totalOrders", sortDirection: "asc" }),
    { actor: adminActor }
  );
  const unhealthyRateDesc = await context.service.getPerformanceReport(
    reportQuery({ sortBy: "unhealthyRate", sortDirection: "desc" }),
    { actor: adminActor }
  );

  assert.equal(totalOrdersAsc.rows[0].groupKey, "chain-2");
  assert.equal(unhealthyRateDesc.rows[0].groupKey, "UNMAPPED_CHAIN");
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, OrdersKpisReportsController), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.AREA_MANAGER,
    UserRole.CHAMP
  ]);
  await assert.rejects(
    context.service.getPerformanceReport(reportQuery(), { actor: pickerActor }),
    ForbiddenException
  );
  await assert.rejects(
    context.service.getPerformanceReport(
      reportQuery({ dateFrom: "2026-06-05", dateTo: "2026-06-04" }),
      { actor: adminActor }
    ),
    BadRequestException
  );
  await assert.rejects(
    context.service.getPerformanceReport(
      reportQuery({ dateFrom: "2026-02-30" }),
      { actor: adminActor }
    ),
    BadRequestException
  );
  assert.equal(context.store.forbiddenMutationCalls.length, 0);
}

async function main() {
  await testChainViewSummaryAndPagination();
  await testVendorViewsGroupMatchedAndUnmappedRows();
  await testPickerViewBucketsAndSearch();
  await testComparisonTrendSearchAndFilterOptions();
  await testTargetEvaluationKeepsSecondaryWarningsSeparate();
  await testSortingAccessAndControllerRoles();
}

void main();
