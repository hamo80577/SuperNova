import assert from "node:assert/strict";

import { BlockStatus, RequestType } from "@prisma/client";

import {
  calculateBlockedUntil,
  normalizeOffboardingBlockDecision,
  normalizeOffboardingReason,
  OFFBOARDING_BLOCK_DECISIONS,
  OFFBOARDING_REASON_CODES
} from "../src/requests/workflows/offboarding-workflow.policy";

const normalizedReason = normalizeOffboardingReason({
  type: RequestType.RESIGNATION,
  resignationDate: "2026-05-14",
  reasonCode: "BAD_ATTITUDE",
  reasonDetails: "  ignored details  ",
  notes: "  handover done  "
});
assert.equal(normalizedReason.reasonCode, "BAD_ATTITUDE");
assert.equal(normalizedReason.reason, "Bad attitude");
assert.equal(normalizedReason.reasonDetails, "ignored details");
assert.equal(normalizedReason.notes, "handover done");

assert.throws(
  () =>
    normalizeOffboardingReason({
      type: RequestType.RESIGNATION,
      resignationDate: "2026-05-14",
      reasonCode: "OTHER"
    }),
  /reasonDetails is required when reasonCode is OTHER/
);

assert.throws(
  () =>
    normalizeOffboardingReason({
      type: RequestType.RESIGNATION,
      reasonCode: "BAD_PERFORMANCE"
    }),
  /resignationDate is required/
);

const noBlock = normalizeOffboardingBlockDecision({
  blockDecision: "NO_BLOCK",
  blockReason: "ignored"
});
assert.equal(noBlock.blockStatus, BlockStatus.NO_BLOCK);
assert.equal(noBlock.blockReason, null);

const sixMonths = normalizeOffboardingBlockDecision({
  blockDecision: "SIX_MONTHS",
  blockReason: "  repeated attendance issue  "
});
assert.equal(sixMonths.blockStatus, BlockStatus.TEMPORARY_BLOCK);
assert.equal(sixMonths.blockReason, "repeated attendance issue");

const permanent = normalizeOffboardingBlockDecision({
  blockDecision: "PERMANENT",
  blockReason: "policy violation"
});
assert.equal(permanent.blockStatus, BlockStatus.PERMANENT_BLOCK);

assert.throws(
  () => normalizeOffboardingBlockDecision({ blockDecision: "ONE_YEAR" }),
  /blockReason is required/
);

const base = new Date("2026-05-14T10:00:00.000Z");
assert.equal(
  calculateBlockedUntil("THREE_MONTHS", base)?.toISOString(),
  "2026-08-14T10:00:00.000Z"
);
assert.equal(
  calculateBlockedUntil("SIX_MONTHS", base)?.toISOString(),
  "2026-11-14T10:00:00.000Z"
);
assert.equal(
  calculateBlockedUntil("ONE_YEAR", base)?.toISOString(),
  "2027-05-14T10:00:00.000Z"
);
assert.equal(calculateBlockedUntil("NO_BLOCK", base), null);
assert.equal(calculateBlockedUntil("PERMANENT", base), null);

assert.deepEqual(OFFBOARDING_REASON_CODES, [
  "BAD_ATTITUDE",
  "BAD_PERFORMANCE",
  "ATTENDANCE_ISSUES",
  "POLICY_VIOLATION",
  "NO_SHOW",
  "VOLUNTARY_QUIT",
  "OTHER"
]);
assert.deepEqual(OFFBOARDING_BLOCK_DECISIONS, [
  "NO_BLOCK",
  "THREE_MONTHS",
  "SIX_MONTHS",
  "ONE_YEAR",
  "PERMANENT"
]);
