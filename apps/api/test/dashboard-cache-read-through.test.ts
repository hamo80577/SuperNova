import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import { DashboardCacheReadThroughService } from "../src/dashboard-cache/dashboard-cache-read-through.service";
import { DashboardCacheStoreService } from "../src/dashboard-cache/dashboard-cache-store.service";

const now = new Date("2026-06-20T12:00:00.000Z");
const canonicalQuery = {
  dateFrom: "2026-06-01",
  dateTo: "2026-06-20",
  period: "THIS_MONTH"
};

async function runCacheHitTest() {
  let calculateCalls = 0;
  let writeCalls = 0;
  const store = {
    get: async () => ({ source: "cache" }),
    writeMany: async () => {
      writeCalls += 1;
      return true;
    }
  };
  const service = new DashboardCacheReadThroughService(store as never);

  const result = await service.getOrCalculate({
    role: UserRole.PICKER,
    userId: "picker-1",
    query: canonicalQuery,
    now,
    calculate: async () => {
      calculateCalls += 1;
      return { source: "database" };
    }
  });

  assert.deepEqual(result, { source: "cache" });
  assert.equal(calculateCalls, 0);
  assert.equal(writeCalls, 0);
}

async function runCacheMissTest() {
  let calculateCalls = 0;
  const writes: unknown[] = [];
  const store = {
    get: async () => null,
    writeMany: async (entries: unknown[]) => {
      writes.push(...entries);
      return true;
    }
  };
  const service = new DashboardCacheReadThroughService(store as never);

  const result = await service.getOrCalculate({
    role: UserRole.PICKER,
    userId: "picker-1",
    query: canonicalQuery,
    now,
    calculate: async () => {
      calculateCalls += 1;
      return { source: "database" };
    }
  });

  assert.deepEqual(result, { source: "database" });
  assert.equal(calculateCalls, 1);
  assert.deepEqual(writes, [
    {
      role: UserRole.PICKER,
      userId: "picker-1",
      month: "2026-06",
      summary: { source: "database" }
    }
  ]);
}

async function runNonCanonicalBypassTest() {
  let getCalls = 0;
  let writeCalls = 0;
  const store = {
    get: async () => {
      getCalls += 1;
      return null;
    },
    writeMany: async () => {
      writeCalls += 1;
      return true;
    }
  };
  const service = new DashboardCacheReadThroughService(store as never);

  const result = await service.getOrCalculate({
    role: UserRole.CHAMP,
    userId: "champ-1",
    query: { ...canonicalQuery, vendorId: "vendor-1" },
    now,
    calculate: async () => ({ source: "database" })
  });

  assert.deepEqual(result, { source: "database" });
  assert.equal(getCalls, 0);
  assert.equal(writeCalls, 0);
}

async function runRedisFailureFallbackTest() {
  const store = {
    get: async () => {
      throw new Error("redis unavailable");
    },
    writeMany: async () => {
      throw new Error("redis unavailable");
    }
  };
  const service = new DashboardCacheReadThroughService(store as never);

  const result = await service.getOrCalculate({
    role: UserRole.AREA_MANAGER,
    userId: "area-manager-1",
    query: canonicalQuery,
    now,
    calculate: async () => ({ source: "database" })
  });

  assert.deepEqual(result, { source: "database" });
}

async function runMalformedJsonTest() {
  const pipelineCalls: Array<{ command: string; args: unknown[] }> = [];
  const pipeline = {
    del: (...args: unknown[]) => {
      pipelineCalls.push({ command: "del", args });
      return pipeline;
    },
    set: (...args: unknown[]) => {
      pipelineCalls.push({ command: "set", args });
      return pipeline;
    },
    exec: async () => []
  };
  const redis = {
    get: async () => "{not-json",
    pipeline: () => pipeline,
    disconnect: () => undefined
  };
  const config = {
    get: (key: string) => (key === "dashboardCache.ttlSeconds" ? 900 : undefined)
  };
  const store = new DashboardCacheStoreService(redis as never, config as never);

  const result = await store.get(UserRole.PICKER, "picker-1", "2026-06");

  assert.equal(result, null);
  assert.deepEqual(pipelineCalls, [
    {
      command: "del",
      args: ["perf_summary:picker:picker-1:2026-06"]
    }
  ]);
}

async function runPipelineCommandFailureTest() {
  const pipeline = {
    set: () => pipeline,
    exec: async () => [[new Error("write failed"), null]]
  };
  const redis = {
    pipeline: () => pipeline,
    disconnect: () => undefined
  };
  const config = { get: () => 900 };
  const store = new DashboardCacheStoreService(redis as never, config as never);

  const written = await store.writeMany([
    {
      role: UserRole.PICKER,
      userId: "picker-1",
      month: "2026-06",
      summary: { source: "database" }
    }
  ]);

  assert.equal(written, false);
}

async function main() {
  await runCacheHitTest();
  await runCacheMissTest();
  await runNonCanonicalBypassTest();
  await runRedisFailureFallbackTest();
  await runMalformedJsonTest();
  await runPipelineCommandFailureTest();

  console.log("Dashboard cache read-through tests passed.");
}

void main();
