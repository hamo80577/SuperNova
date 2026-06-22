import assert from "node:assert/strict";

import {
  adminDashboardRangeOptions,
  getAdminDashboardDateRange,
  getFilteredBranchOptions,
  getNextBranchIdForChain,
  getScopeLabel,
  statusLabels
} from "./admin-dashboard-utils";

const branches = [
  {
    chainId: "chain-a",
    chainName: "Chain A",
    vendorId: "vendor-a1",
    vendorName: "Branch A1"
  },
  {
    chainId: "chain-a",
    chainName: "Chain A",
    vendorId: "vendor-a2",
    vendorName: "Branch A2"
  },
  {
    chainId: "chain-b",
    chainName: "Chain B",
    vendorId: "vendor-b1",
    vendorName: "Branch B1"
  }
];

function testThisMonthRange() {
  const range = getAdminDashboardDateRange(
    "THIS_MONTH",
    new Date("2026-06-22T15:30:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-22"
  });
}

function testYesterdayRange() {
  const range = getAdminDashboardDateRange(
    "YESTERDAY",
    new Date("2026-06-01T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-05-31",
    dateTo: "2026-05-31"
  });
}

function testLastWeekRange() {
  const range = getAdminDashboardDateRange(
    "LAST_WEEK",
    new Date("2026-06-22T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-06-15",
    dateTo: "2026-06-21"
  });
}

function testLastQuarterRange() {
  const range = getAdminDashboardDateRange(
    "LAST_QUARTER",
    new Date("2026-06-22T08:00:00")
  );

  assert.deepEqual(range, {
    dateFrom: "2026-01-01",
    dateTo: "2026-03-31"
  });
}

function testBranchOptionsFilterByChain() {
  assert.deepEqual(
    getFilteredBranchOptions(branches, "chain-a").map((branch) => branch.vendorId),
    ["vendor-a1", "vendor-a2"]
  );
  assert.deepEqual(
    getFilteredBranchOptions(branches, undefined).map((branch) => branch.vendorId),
    ["vendor-a1", "vendor-a2", "vendor-b1"]
  );
}

function testIncompatibleBranchResetsWhenChainChanges() {
  assert.equal(
    getNextBranchIdForChain({
      branches,
      currentVendorId: "vendor-b1",
      nextChainId: "chain-a"
    }),
    undefined
  );
  assert.equal(
    getNextBranchIdForChain({
      branches,
      currentVendorId: "vendor-a2",
      nextChainId: "chain-a"
    }),
    "vendor-a2"
  );
}

function testScopeLabel() {
  assert.equal(getScopeLabel(), "Global");
  assert.equal(getScopeLabel("chain-a"), "Selected Chain");
  assert.equal(getScopeLabel(undefined, "vendor-a1"), "Selected Branch");
  assert.equal(getScopeLabel("chain-a", "vendor-a1"), "Selected Branch");
}

function testStatusLabelsAndRangeOptions() {
  assert.equal(statusLabels.IN_TARGET, "In Target");
  assert.equal(statusLabels.NEEDS_ACTION, "Needs Action");
  assert.deepEqual(
    adminDashboardRangeOptions.map((option) => option.key),
    ["YESTERDAY", "LAST_WEEK", "THIS_MONTH", "LAST_QUARTER"]
  );
}

testThisMonthRange();
testYesterdayRange();
testLastWeekRange();
testLastQuarterRange();
testBranchOptionsFilterByChain();
testIncompatibleBranchResetsWhenChainChanges();
testScopeLabel();
testStatusLabelsAndRangeOptions();

console.log("admin dashboard utils tests passed");
