import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import {
  canonicalMonthRange,
  canonicalPerformanceMonth,
  dashboardPerformanceCacheKey
} from "../src/dashboard-cache/dashboard-cache-key";

const now = new Date("2026-06-20T12:00:00.000Z");

assert.equal(
  dashboardPerformanceCacheKey(UserRole.PICKER, "picker-1", "2026-06"),
  "perf_summary:picker:picker-1:2026-06"
);

assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-06-01", dateTo: "2026-06-20" },
    now
  ),
  "2026-06"
);

assert.equal(
  canonicalPerformanceMonth(
    {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-20",
      period: "THIS_MONTH"
    },
    now
  ),
  "2026-06"
);

assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-05-01", dateTo: "2026-05-31" },
    now
  ),
  "2026-05"
);

assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-06-01", dateTo: "2026-06-19" },
    now
  ),
  null
);

assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-05-01", dateTo: "2026-05-30" },
    now
  ),
  null
);

assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-05-25", dateTo: "2026-05-31" },
    now
  ),
  null
);

assert.equal(
  canonicalPerformanceMonth(
    {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      vendorId: "vendor-1"
    },
    now
  ),
  null
);

assert.equal(
  canonicalPerformanceMonth(
    {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      chainId: "chain-1"
    },
    now
  ),
  null
);

assert.equal(
  canonicalPerformanceMonth(
    {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-20",
      period: "CUSTOM"
    },
    now
  ),
  null
);

assert.deepEqual(canonicalMonthRange("2026-06", now), {
  dateFrom: "2026-06-01",
  dateTo: "2026-06-20"
});

assert.deepEqual(canonicalMonthRange("2026-05", now), {
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31"
});

assert.equal(canonicalMonthRange("2026-07", now), null);
assert.equal(canonicalMonthRange("2026-13", now), null);

console.log("Dashboard cache key tests passed.");
