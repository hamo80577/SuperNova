import assert from "node:assert/strict";

import {
  canRenderNewRequestSheet,
  isClosedRequestForOperations,
  isCompletedRequestForOperations,
  requestTypeFilters
} from "./request-operations-center-rules";

const roles = ["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"] as const;

for (const role of roles) {
  const actual = canRenderNewRequestSheet({
    draftType: "ANNUAL_LEAVE",
    userRole: role
  });
  assert.equal(
    actual,
    role === "PICKER" || role === "CHAMP",
    `${role} annual leave sheet access`
  );
}

assert.equal(
  canRenderNewRequestSheet({
    draftType: "TRANSFER",
    userRole: "PICKER"
  }),
  false
);
assert.equal(
  canRenderNewRequestSheet({
    draftType: "TRANSFER",
    userRole: "CHAMP"
  }),
  true
);

assert.ok(requestTypeFilters.includes("ANNUAL_LEAVE"));

assert.equal(
  isClosedRequestForOperations({
    status: "APPROVED",
    type: "ANNUAL_LEAVE"
  }),
  true
);
assert.equal(
  isCompletedRequestForOperations({
    status: "APPROVED",
    type: "ANNUAL_LEAVE"
  }),
  true
);
assert.equal(
  isClosedRequestForOperations({
    status: "APPROVED",
    type: "TRANSFER"
  }),
  false
);
assert.equal(
  isCompletedRequestForOperations({
    status: "COMPLETED",
    type: "TRANSFER"
  }),
  true
);

console.log("request operations center rules: cases passed.");
