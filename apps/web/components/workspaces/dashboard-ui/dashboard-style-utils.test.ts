import assert from "node:assert/strict";

import {
  dashboardRankTone,
  dashboardStatusBadgeClass,
  dashboardStatusLabel,
  dashboardStatusToneClass
} from "./dashboard-style-utils";

function testDashboardRankTone() {
  assert.equal(dashboardRankTone(1), "gold");
  assert.equal(dashboardRankTone(2), "silver");
  assert.equal(dashboardRankTone(3), "bronze");
  assert.equal(dashboardRankTone(4), "neutral");
  assert.equal(dashboardRankTone(null), "unranked");
}

function testDashboardStatusLabels() {
  assert.equal(dashboardStatusLabel("IN_TARGET"), "In Target");
  assert.equal(dashboardStatusLabel("WATCH"), "Watch");
  assert.equal(dashboardStatusLabel("NEEDS_ACTION"), "Needs Action");
  assert.equal(dashboardStatusLabel("LOW_VOLUME"), "Low Volume");
  assert.equal(dashboardStatusLabel("NO_KPI"), "No KPI");
}

function testDashboardStatusToneClasses() {
  assert.match(dashboardStatusToneClass("IN_TARGET"), /success/);
  assert.match(dashboardStatusToneClass("WATCH"), /amber/);
  assert.match(dashboardStatusToneClass("NEEDS_ACTION"), /danger/);
  assert.match(dashboardStatusToneClass("LOW_VOLUME"), /sn-border/);
  assert.match(dashboardStatusToneClass("NO_KPI"), /sn-border/);
}

function testDashboardStatusBadgeClassPreventsMobileWrapping() {
  const className = dashboardStatusBadgeClass("IN_TARGET");

  assert.match(className, /whitespace-nowrap/);
  assert.match(className, /shrink-0/);
  assert.match(className, /justify-center/);
  assert.match(className, /success/);
}

testDashboardRankTone();
testDashboardStatusLabels();
testDashboardStatusToneClasses();
testDashboardStatusBadgeClassPreventsMobileWrapping();

console.log("dashboard style utils tests passed");
