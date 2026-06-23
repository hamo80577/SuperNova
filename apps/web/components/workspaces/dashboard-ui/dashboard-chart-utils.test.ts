import assert from "node:assert/strict";

import { getNearestDashboardPointIndex } from "./dashboard-chart-utils";

function testNearestPointUsesScaledPointerPosition() {
  const points = [
    { index: 0, x: 14 },
    { index: 1, x: 160 },
    { index: 2, x: 306 }
  ];

  assert.equal(
    getNearestDashboardPointIndex({
      chartWidth: 320,
      pointerClientX: 260,
      svgLeft: 100,
      svgWidth: 320,
      points
    }),
    1
  );
}

function testNearestPointHandlesResponsiveSvgScaling() {
  const points = [
    { index: 0, x: 14 },
    { index: 1, x: 160 },
    { index: 2, x: 306 }
  ];

  assert.equal(
    getNearestDashboardPointIndex({
      chartWidth: 320,
      pointerClientX: 400,
      svgLeft: 80,
      svgWidth: 640,
      points
    }),
    1
  );
}

function testNearestPointReturnsNullForEmptyPoints() {
  assert.equal(
    getNearestDashboardPointIndex({
      chartWidth: 320,
      pointerClientX: 200,
      svgLeft: 100,
      svgWidth: 320,
      points: []
    }),
    null
  );
}

testNearestPointUsesScaledPointerPosition();
testNearestPointHandlesResponsiveSvgScaling();
testNearestPointReturnsNullForEmptyPoints();

console.log("dashboard chart utils tests passed");
