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

function createPrismaMock() {
  const calls = {
    writes: [] as string[]
  };
  const prisma = {
    ordersKpiDailyRecord: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        filterRows(rows, where).length,
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
        const filtered = sortRows(filterRows(rows, where), orderBy);
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
