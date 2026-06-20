import assert from "node:assert/strict";

import { AccountStatus, EmploymentStatus, UserRole } from "@prisma/client";

import { DashboardCacheWarmerService } from "../src/dashboard-cache/dashboard-cache-warmer.service";

const now = new Date("2026-06-20T12:00:00.000Z");

async function runTargetedTest() {
  let findUniqueCalls = 0;
  let findManyCalls = 0;
  let pickerCalculationCalls = 0;
  const writes: unknown[][] = [];
  const prisma = {
    user: {
      findUnique: async () => {
        findUniqueCalls += 1;
        return {
          id: "picker-1",
          role: UserRole.PICKER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        };
      },
      findMany: async () => {
        findManyCalls += 1;
        return [];
      }
    }
  };
  const store = {
    writeMany: async (entries: unknown[]) => {
      writes.push(entries);
      return true;
    }
  };
  const workspaces = {
    calculatePickerPerformanceSummary: async () => {
      pickerCalculationCalls += 1;
      return { summary: "picker" };
    },
    calculateChampPerformanceSummary: async () => ({ summary: "champ" })
  };
  const areaManager = {
    calculateSummary: async () => ({ summary: "area-manager" })
  };
  const config = { get: () => undefined };
  const service = new DashboardCacheWarmerService(
    prisma as never,
    store as never,
    workspaces as never,
    areaManager as never,
    config as never
  );

  const result = await service.warmTargeted(
    {
      kind: "TARGETED",
      eventId: "request-1",
      userId: "picker-1",
      month: "2026-06",
      source: "DEDUCTION"
    },
    now
  );

  assert.equal(findUniqueCalls, 1);
  assert.equal(findManyCalls, 0);
  assert.equal(pickerCalculationCalls, 1);
  assert.deepEqual(writes, [
    [
      {
        role: UserRole.PICKER,
        userId: "picker-1",
        month: "2026-06",
        summary: { summary: "picker" }
      }
    ]
  ]);
  assert.deepEqual(result, { warmed: 1, failed: 0, skipped: 0 });
}

async function runBulkTest() {
  const users = Array.from({ length: 205 }, (_, index) => ({
    id: `picker-${String(index + 1).padStart(3, "0")}`,
    role: UserRole.PICKER,
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE
  }));
  const pages: number[] = [];
  let findUniqueCalls = 0;
  let activeCalculations = 0;
  let maxActiveCalculations = 0;
  const writes: unknown[][] = [];
  const prisma = {
    user: {
      findUnique: async () => {
        findUniqueCalls += 1;
        return null;
      },
      findMany: async (args: {
        take: number;
        cursor?: { id: string };
      }) => {
        const start = args.cursor
          ? users.findIndex((user) => user.id === args.cursor?.id) + 1
          : 0;
        const page = users.slice(start, start + args.take);
        pages.push(page.length);
        return page;
      }
    }
  };
  const store = {
    writeMany: async (entries: unknown[]) => {
      writes.push(entries);
      return true;
    }
  };
  const workspaces = {
    calculatePickerPerformanceSummary: async (userId: string) => {
      activeCalculations += 1;
      maxActiveCalculations = Math.max(
        maxActiveCalculations,
        activeCalculations
      );
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeCalculations -= 1;
      return { userId };
    },
    calculateChampPerformanceSummary: async () => ({})
  };
  const areaManager = { calculateSummary: async () => ({}) };
  const config = {
    get: (key: string) => {
      if (key === "dashboardCache.bulkChunkSize") return 100;
      if (key === "dashboardCache.calculationConcurrency") return 5;
      return undefined;
    }
  };
  const service = new DashboardCacheWarmerService(
    prisma as never,
    store as never,
    workspaces as never,
    areaManager as never,
    config as never
  );

  const result = await service.warmBulk(
    {
      kind: "BULK",
      eventId: "batch-1",
      months: ["2026-06"],
      source: "ATTENDANCE_IMPORT"
    },
    now
  );

  assert.equal(findUniqueCalls, 0);
  assert.deepEqual(pages, [100, 100, 5]);
  assert.equal(maxActiveCalculations <= 5, true);
  assert.deepEqual(
    writes.map((entries) => entries.length),
    [100, 100, 5]
  );
  assert.deepEqual(result, { warmed: 205, failed: 0, skipped: 0 });
}

async function runTargetedWriteFailureTest() {
  const service = new DashboardCacheWarmerService(
    {
      user: {
        findUnique: async () => ({
          id: "picker-1",
          role: UserRole.PICKER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        })
      }
    } as never,
    { writeMany: async () => false } as never,
    {
      calculatePickerPerformanceSummary: async () => ({ summary: "picker" })
    } as never,
    {} as never,
    { get: () => undefined } as never
  );

  await assert.rejects(
    service.warmTargeted(
      {
        kind: "TARGETED",
        eventId: "request-1",
        userId: "picker-1",
        month: "2026-06",
        source: "DEDUCTION"
      },
      now
    ),
    /write failed/i
  );
}

async function main() {
  await runTargetedTest();
  await runBulkTest();
  await runTargetedWriteFailureTest();
  console.log("Dashboard cache warmer tests passed.");
}

void main();
