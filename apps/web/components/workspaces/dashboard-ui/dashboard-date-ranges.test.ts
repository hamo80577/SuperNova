import assert from "node:assert/strict";

import { getClosedDailyDashboardDateRange } from "./dashboard-date-ranges";

function testThisMonthEndsYesterday() {
  const range = getClosedDailyDashboardDateRange(
    "THIS_MONTH",
    new Date("2026-06-23T15:30:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-22"
  });
}

function testLastWeekEndsYesterday() {
  const range = getClosedDailyDashboardDateRange(
    "LAST_WEEK",
    new Date("2026-06-23T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-06-16",
    dateTo: "2026-06-22"
  });
}

function testThisQuarterEndsYesterday() {
  const range = getClosedDailyDashboardDateRange(
    "THIS_QUARTER",
    new Date("2026-06-23T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-04-01",
    dateTo: "2026-06-22"
  });
}

function testYesterdayUsesClosedPreviousDay() {
  const range = getClosedDailyDashboardDateRange(
    "YESTERDAY",
    new Date("2026-06-01T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-05-31",
    dateTo: "2026-05-31"
  });
}

function testLastQuarterUsesCompletedQuarter() {
  const range = getClosedDailyDashboardDateRange(
    "LAST_QUARTER",
    new Date("2026-06-23T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-01-01",
    dateTo: "2026-03-31"
  });
}

testThisMonthEndsYesterday();
testLastWeekEndsYesterday();
testThisQuarterEndsYesterday();
testYesterdayUsesClosedPreviousDay();
testLastQuarterUsesCompletedQuarter();

console.log("dashboard date range tests passed");
