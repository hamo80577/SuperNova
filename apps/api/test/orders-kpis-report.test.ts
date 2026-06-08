import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { OrdersKpisReportsController } from "../src/orders-kpis/orders-kpis-reports.controller";
import { OrdersKpisReportService } from "../src/orders-kpis/orders-kpis-report.service";

const rows = [
  dailyRow({
    id: "admin-chain-a",
    userId: "picker-a",
    shopperId: "SHOPPER-A",
    pickerNameSnapshot: "Picker A",
    matchedVendorId: "vendor-a",
    matchedChainId: "chain-a",
    totalOrders: 10,
    successfulOrders: 8,
    unhealthyOrders: 2,
    orderNotOnTime: 1,
    preparationTime: 10
  }),
  dailyRow({
    id: "champ-vendor-b",
    userId: "picker-b",
    shopperId: "SHOPPER-B",
    pickerNameSnapshot: "Picker B",
    matchedVendorId: "vendor-b",
    matchedChainId: "chain-b",
    totalOrders: 5,
    successfulOrders: 5,
    unhealthyOrders: 0,
    orderNotOnTime: 0,
    preparationTime: 20
  }),
  dailyRow({
    id: "picker-own-unmapped",
    userId: "picker-self",
    shopperId: "SHOPPER-SELF",
    pickerNameSnapshot: "Self Picker",
    matchedVendorId: null,
    matchedChainId: null,
    sourceVendorId: "unknown-vendor",
    totalOrders: 3,
    successfulOrders: 2,
    unhealthyOrders: 1,
    orderNotOnTime: 1,
    preparationTime: null
  }),
  dailyRow({
    id: "old-historical-row",
    userId: "picker-a",
    shopperId: "SHOPPER-A",
    pickerNameSnapshot: "Picker A",
    kpiDate: "2025-01-15",
    matchedVendorId: "vendor-a",
    matchedChainId: "chain-a",
    totalOrders: 7,
    successfulOrders: 7
  })
];

const performanceRows = [
  dailyRow({
    id: "perf-vendor-a-picker-a",
    userId: "picker-a",
    shopperId: "SHOPPER-A",
    pickerNameSnapshot: "Picker A",
    matchedVendorId: "vendor-a",
    matchedChainId: "chain-a",
    sourceVendorId: "100001",
    totalOrders: 10,
    successfulOrders: 8,
    unhealthyOrders: 2,
    orderNotOnTime: 1,
    qcFailedOrders: 1,
    partialRefund: 1,
    outOfStock: 0,
    priceModified: 1
  }),
  dailyRow({
    id: "perf-vendor-c-picker-c",
    userId: "picker-c",
    shopperId: "SHOPPER-C",
    pickerNameSnapshot: "Picker C",
    matchedVendorId: "vendor-c",
    matchedChainId: "chain-a",
    sourceVendorId: "100003",
    totalOrders: 20,
    successfulOrders: 10,
    unhealthyOrders: 10,
    orderNotOnTime: 3,
    qcFailedOrders: 2,
    partialRefund: 0,
    outOfStock: 4,
    priceModified: 0
  }),
  dailyRow({
    id: "perf-vendor-b-picker-b",
    userId: "picker-b",
    shopperId: "SHOPPER-B",
    pickerNameSnapshot: "Picker B",
    matchedVendorId: "vendor-b",
    matchedChainId: "chain-b",
    sourceVendorId: "100002",
    totalOrders: 5,
    successfulOrders: 5,
    unhealthyOrders: 0,
    orderNotOnTime: 0,
    qcFailedOrders: 1,
    partialRefund: 2,
    outOfStock: 1,
    priceModified: 1
  }),
  dailyRow({
    id: "perf-vendor-b-zero-picker",
    userId: "picker-zero",
    shopperId: "ZERO-1",
    pickerNameSnapshot: "Zero Picker",
    matchedVendorId: "vendor-b",
    matchedChainId: "chain-b",
    sourceVendorId: "100002",
    totalOrders: 0,
    successfulOrders: 0,
    unhealthyOrders: 0,
    orderNotOnTime: 0,
    qcFailedOrders: 0,
    partialRefund: 0,
    outOfStock: 0,
    priceModified: 0
  }),
  dailyRow({
    id: "perf-unmapped-self-picker",
    userId: "picker-self",
    shopperId: "SHOPPER-SELF",
    pickerNameSnapshot: "Self Picker",
    matchedVendorId: null,
    matchedChainId: null,
    sourceVendorId: "unknown-vendor",
    totalOrders: 3,
    successfulOrders: 2,
    unhealthyOrders: 1,
    orderNotOnTime: 1,
    qcFailedOrders: 0,
    partialRefund: 0,
    outOfStock: 1,
    priceModified: 0
  }),
  dailyRow({
    id: "perf-old-row",
    userId: "picker-a",
    shopperId: "SHOPPER-A",
    pickerNameSnapshot: "Picker A",
    kpiDate: "2025-01-15",
    matchedVendorId: "vendor-a",
    matchedChainId: "chain-a",
    totalOrders: 100,
    unhealthyOrders: 100
  })
];

const chains = [
  { id: "chain-a", chainName: "Chain A" },
  { id: "chain-b", chainName: "Chain B" }
];

const vendors = [
  {
    id: "vendor-a",
    vendorName: "Vendor A",
    vendorCode: "100001",
    vendorExternalId: null,
    chainId: "chain-a"
  },
  {
    id: "vendor-b",
    vendorName: "Vendor B",
    vendorCode: "100002",
    vendorExternalId: null,
    chainId: "chain-b"
  },
  {
    id: "vendor-c",
    vendorName: "Vendor C",
    vendorCode: "100003",
    vendorExternalId: null,
    chainId: "chain-a"
  }
];

const vendorChampAssignments = [
  {
    champId: "champ-1",
    vendorId: "vendor-b",
    status: AssignmentStatus.ACTIVE
  },
  {
    champId: "champ-1",
    vendorId: "vendor-a",
    status: AssignmentStatus.CLOSED
  }
];

const chainAreaManagerAssignments = [
  {
    areaManagerId: "area-manager-1",
    chainId: "chain-a",
    status: AssignmentStatus.ACTIVE
  },
  {
    areaManagerId: "area-manager-1",
    chainId: "chain-b",
    status: AssignmentStatus.CLOSED
  }
];

function actor(id: string, role: UserRole): AuthenticatedUser {
  return {
    id,
    role,
    nameEn: id,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function createPrismaMock(sourceRows = rows) {
  const calls = {
    writes: [] as string[]
  };
  const prisma = {
    ordersKpiDailyRecord: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        filterRows(sourceRows, where).length,
      findMany: async ({
        orderBy,
        skip,
        take,
        where
      }: {
        orderBy?: Array<Record<string, "asc" | "desc">>;
        skip?: number;
        take?: number;
        where: Record<string, unknown>;
      }) => {
        const filtered = sortRows(filterRows(sourceRows, where), orderBy);
        const start = skip ?? 0;
        const end = take === undefined ? undefined : start + take;
        return filtered.slice(start, end);
      },
      create: forbiddenWrite("ordersKpiDailyRecord.create", calls.writes),
      update: forbiddenWrite("ordersKpiDailyRecord.update", calls.writes),
      upsert: forbiddenWrite("ordersKpiDailyRecord.upsert", calls.writes)
    },
    vendorChampAssignment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        vendorChampAssignments.filter((assignment) =>
          matchesWhere(assignment, where)
        )
    },
    chainAreaManagerAssignment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        chainAreaManagerAssignments.filter((assignment) =>
          matchesWhere(assignment, where)
        )
    },
    chain: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        chains.filter((chain) => matchesWhere(chain, where))
    },
    vendor: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        vendors
          .filter((vendor) => matchesWhere(vendor, where))
          .map((vendor) => ({
            ...vendor,
            chain: chains.find((chain) => chain.id === vendor.chainId) ?? null
          }))
    }
  };

  return { calls, prisma };
}

async function run() {
  {
    const { calls, prisma } = createPrismaMock();
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getDailyReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["admin-chain-a", "champ-vendor-b", "picker-own-unmapped"]
    );
    assert.equal(result.pagination.totalRows, 3);
    assert.equal(result.summary.pickerCount, 3);
    assert.equal(result.summary.totalOrders, 18);
    assert.equal(result.summary.successfulOrders, 15);
    assert.equal(result.summary.successRate, 83.33);
    assert.equal(result.summary.averagePreparationTime, 15);
    assert.deepEqual(calls.writes, []);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getDailyReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      actor("picker-self", UserRole.PICKER)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["picker-own-unmapped"]
    );
    assert.equal(result.rows[0]?.matchedVendorId, null);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getDailyReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      actor("champ-1", UserRole.CHAMP)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["champ-vendor-b"]
    );
  }

  {
    const { prisma } = createPrismaMock();
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getDailyReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      actor("area-manager-1", UserRole.AREA_MANAGER)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["admin-chain-a"]
    );
  }

  {
    const { prisma } = createPrismaMock();
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getDailyReport(
      { dateFrom: "2025-01-01", dateTo: "2025-01-31" },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["old-historical-row"]
    );
    assert.equal(result.rows[0]?.kpiDate, "2025-01-15");
  }

  {
    assert.deepEqual(rolesFor("getDailyReport"), [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.AREA_MANAGER,
      UserRole.CHAMP,
      UserRole.PICKER
    ]);
  }

  {
    const { calls, prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.equal(result.view, "CHAIN");
    assert.equal(result.summary.totalOrders, 38);
    assert.equal(result.summary.uho, 13);
    assert.equal(result.summary.uhoRate, 34.21);
    assert.deepEqual(
      result.rows.map((row) => row.kind),
      ["CHAIN", "CHAIN", "CHAIN"]
    );
    assert.deepEqual(
      result.rows.map((row) => row.kind === "CHAIN" ? row.chainName : ""),
      ["Chain A", "Unmapped Chain", "Chain B"]
    );
    assert.equal(result.rows[0]?.kind, "CHAIN");
    if (result.rows[0]?.kind === "CHAIN") {
      assert.equal(result.rows[0].totalOrders, 30);
      assert.equal(result.rows[0].uho, 12);
      assert.equal(result.rows[0].uhoRate, 40);
      assert.equal(result.rows[0].notOnTime, 4);
      assert.equal(result.rows[0].qcFailedOrders, 3);
      assert.equal(result.rows[0].partialRefund, 1);
      assert.equal(result.rows[0].oos, 4);
      assert.equal(result.rows[0].priceModified, 1);
      assert.equal(result.rows[0].vendorCount, 2);
      assert.equal(result.rows[0].pickerCount, 2);
    }
    assert.deepEqual(calls.writes, []);
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30", view: "VENDOR" },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.deepEqual(
      result.rows.map((row) => row.kind === "VENDOR" ? row.vendorName : ""),
      ["Vendor C", "Unmapped Vendor", "Vendor A", "Vendor B"]
    );
    assert.equal(result.rows[1]?.kind, "VENDOR");
    if (result.rows[1]?.kind === "VENDOR") {
      assert.equal(result.rows[1].vendorId, null);
      assert.equal(result.rows[1].sourceVendorId, "unknown-vendor");
      assert.equal(result.rows[1].uhoRate, 33.33);
    }
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      { dateFrom: "2026-06-01", dateTo: "2026-06-30", view: "PICKER" },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.deepEqual(
      result.rows.map((row) => row.kind === "PICKER" ? row.pickerName : ""),
      ["Picker C", "Self Picker", "Picker A", "Picker B", "Zero Picker"]
    );
    assert.equal(result.rows.at(-1)?.kind, "PICKER");
    if (result.rows.at(-1)?.kind === "PICKER") {
      assert.equal(result.rows.at(-1)?.uhoRate, null);
    }
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      {
        chainId: "chain-a",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        view: "VENDOR"
      },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.equal(result.scope.chainId, "chain-a");
    assert.equal(result.scope.chainName, "Chain A");
    assert.equal(result.summary.totalOrders, 30);
    assert.equal(result.summary.uho, 12);
    assert.deepEqual(
      result.rows.map((row) => row.kind === "VENDOR" ? row.vendorName : ""),
      ["Vendor C", "Vendor A"]
    );
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      {
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        vendorId: "vendor-b",
        view: "PICKER"
      },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.equal(result.scope.vendorId, "vendor-b");
    assert.equal(result.scope.vendorName, "Vendor B");
    assert.equal(result.summary.totalOrders, 5);
    assert.equal(result.summary.uho, 0);
    assert.equal(result.summary.uhoRate, 0);
    assert.deepEqual(
      result.rows.map((row) => row.kind === "PICKER" ? row.pickerName : ""),
      ["Picker B", "Zero Picker"]
    );
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      {
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        pickerSearch: "self",
        view: "PICKER"
      },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.equal(result.summary.totalOrders, 3);
    assert.equal(result.summary.uho, 1);
    assert.equal(result.pagination.totalRows, 1);
    assert.equal(result.rows[0]?.kind, "PICKER");
    if (result.rows[0]?.kind === "PICKER") {
      assert.equal(result.rows[0].pickerName, "Self Picker");
    }
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      {
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        page: 1,
        pageSize: 1,
        view: "VENDOR"
      },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.equal(result.rows.length, 1);
    assert.equal(result.pagination.totalRows, 4);
    assert.equal(result.pagination.totalPages, 4);
    assert.equal(result.summary.totalOrders, 38);
    assert.equal(result.summary.uho, 13);
  }

  {
    const { prisma } = createPrismaMock(performanceRows);
    const service = new OrdersKpisReportService(prisma as never);
    const result = await service.getPerformanceReport(
      {
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        view: "CHAIN"
      },
      actor("champ-1", UserRole.CHAMP)
    );

    assert.equal(result.summary.totalOrders, 5);
    assert.equal(result.summary.uho, 0);
    assert.deepEqual(
      result.rows.map((row) => row.kind === "CHAIN" ? row.chainName : ""),
      ["Chain B"]
    );
  }

  {
    assert.deepEqual(rolesFor("getPerformanceReport"), [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.AREA_MANAGER,
      UserRole.CHAMP,
      UserRole.PICKER
    ]);
  }
}

function rolesFor(methodName: keyof OrdersKpisReportsController) {
  return Reflect.getMetadata(
    ROLES_KEY,
    OrdersKpisReportsController.prototype[methodName]
  );
}

function dailyRow(overrides: Partial<DailyRow>) {
  const totalOrders = overrides.totalOrders ?? 1;
  const successfulOrders = overrides.successfulOrders ?? 1;
  const unhealthyOrders = overrides.unhealthyOrders ?? 0;
  const orderNotOnTime = overrides.orderNotOnTime ?? 0;

  return {
    id: "row",
    sourceBatchId: "batch-1",
    kpiDate: date(overrides.kpiDate ?? "2026-06-07"),
    shopperId: "SHOPPER",
    userId: "picker",
    pickerNameSnapshot: "Picker",
    sourceVendorId: "100001",
    matchedVendorId: "vendor-a",
    matchedChainId: "chain-a",
    totalOrders,
    successfulOrders,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders,
    orderNotOnTime,
    partialRefund: 0,
    vendorDelay: 0,
    preparationTime: 10,
    outOfStock: 0,
    firNotOnTime: 0,
    priceModified: 0,
    successRate: percentage(successfulOrders, totalOrders),
    unhealthyRate: percentage(unhealthyOrders, totalOrders),
    notOnTimeRate: percentage(orderNotOnTime, totalOrders),
    rawRowNumber: 2,
    rowHash: "row-hash",
    issuesCount: 0,
    ...overrides,
    kpiDate: date(overrides.kpiDate ?? "2026-06-07")
  } satisfies DailyRow;
}

function filterRows(input: DailyRow[], where: Record<string, unknown>) {
  return input.filter((row) => matchesWhere(row, where));
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  const and = where["AND"];
  if (Array.isArray(and) && !and.every((item) => matchesWhere(row, item))) {
    return false;
  }

  const or = where["OR"];
  if (Array.isArray(or) && !or.some((item) => matchesWhere(row, item))) {
    return false;
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR") {
      continue;
    }

    if (key === "kpiDate") {
      const range = value as { gte?: Date; lte?: Date };
      const actual = row[key];
      if (!(actual instanceof Date)) {
        return false;
      }
      if (range.gte && actual < range.gte) {
        return false;
      }
      if (range.lte && actual > range.lte) {
        return false;
      }
      continue;
    }

    if (typeof value === "object" && value !== null && "in" in value) {
      const values = (value as { in: unknown[] }).in;
      if (!values.includes(row[key])) {
        return false;
      }
      continue;
    }

    if (typeof value === "object" && value !== null && "contains" in value) {
      const actual = String(row[key] ?? "").toLowerCase();
      const expected = String((value as { contains: string }).contains).toLowerCase();
      if (!actual.includes(expected)) {
        return false;
      }
      continue;
    }

    if (row[key] !== value) {
      return false;
    }
  }

  return true;
}

function sortRows(
  input: DailyRow[],
  orderBy?: Array<Record<string, "asc" | "desc">>
) {
  const rules = orderBy ?? [{ kpiDate: "asc" }, { pickerNameSnapshot: "asc" }];

  return [...input].sort((left, right) => {
    for (const rule of rules) {
      const [[field, direction]] = Object.entries(rule);
      const comparison = compareField(left, right, field);
      if (comparison !== 0) {
        return direction === "desc" ? -comparison : comparison;
      }
    }

    return 0;
  });
}

function compareField(left: DailyRow, right: DailyRow, field: string) {
  const leftValue = left[field as keyof DailyRow];
  const rightValue = right[field as keyof DailyRow];

  if (leftValue instanceof Date && rightValue instanceof Date) {
    return leftValue.getTime() - rightValue.getTime();
  }

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  return String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function percentage(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 10_000) / 100 : null;
}

function forbiddenWrite(name: string, calls: string[]) {
  return async () => {
    calls.push(name);
    throw new Error(`${name} is out of scope for Orders KPI reports.`);
  };
}

type DailyRow = {
  id: string;
  sourceBatchId: string;
  kpiDate: Date;
  shopperId: string;
  userId: string;
  pickerNameSnapshot: string;
  sourceVendorId: string;
  matchedVendorId: string | null;
  matchedChainId: string | null;
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
  successRate: number | null;
  unhealthyRate: number | null;
  notOnTimeRate: number | null;
  rawRowNumber: number;
  rowHash: string;
  issuesCount: number;
};

void run();
