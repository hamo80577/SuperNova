import assert from "node:assert/strict";

import { DashboardCacheProcessor } from "../src/dashboard-cache/dashboard-cache.processor";

async function main() {
  let targetedCalls = 0;
  let bulkCalls = 0;
  const warmer = {
    warmTargeted: async () => {
      targetedCalls += 1;
      return { warmed: 1 };
    },
    warmBulk: async () => {
      bulkCalls += 1;
      return { warmed: 10 };
    }
  };
  const processor = new DashboardCacheProcessor(warmer as never);

  await processor.process({
    name: "dashboard-cache.targeted",
    data: {
      kind: "TARGETED",
      eventId: "request-1",
      userId: "picker-1",
      month: "2026-06",
      source: "DEDUCTION"
    }
  } as never);

  assert.equal(targetedCalls, 1);
  assert.equal(bulkCalls, 0);

  await processor.process({
    name: "dashboard-cache.bulk",
    data: {
      kind: "BULK",
      eventId: "batch-1",
      months: ["2026-06"],
      source: "KPI_IMPORT"
    }
  } as never);

  assert.equal(targetedCalls, 1);
  assert.equal(bulkCalls, 1);

  console.log("Dashboard cache processor tests passed.");
}

void main();
