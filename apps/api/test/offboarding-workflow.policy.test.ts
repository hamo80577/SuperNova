import assert from "node:assert/strict";

import { BlockStatus, RequestType, UserRole } from "@prisma/client";

import {
  getAllowedResignationTargetRolesForCreator,
  normalizeOffboardingBlockDecision,
  normalizeOffboardingReason,
  normalizeOffboardingTargetRole,
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

assert.equal(normalizeOffboardingTargetRole(undefined), UserRole.PICKER);
assert.equal(normalizeOffboardingTargetRole(UserRole.CHAMP), UserRole.CHAMP);
assert.equal(
  normalizeOffboardingTargetRole(UserRole.AREA_MANAGER),
  UserRole.AREA_MANAGER
);
assert.throws(
  () => normalizeOffboardingTargetRole(UserRole.ADMIN),
  /targetRole must be PICKER, CHAMP, or AREA_MANAGER/
);

assert.deepEqual(getAllowedResignationTargetRolesForCreator(UserRole.CHAMP), [
  UserRole.PICKER
]);
assert.deepEqual(getAllowedResignationTargetRolesForCreator(UserRole.AREA_MANAGER), [
  UserRole.PICKER,
  UserRole.CHAMP
]);
assert.deepEqual(getAllowedResignationTargetRolesForCreator(UserRole.ADMIN), [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
]);
assert.deepEqual(getAllowedResignationTargetRolesForCreator(UserRole.SUPER_ADMIN), [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
]);
assert.deepEqual(getAllowedResignationTargetRolesForCreator(UserRole.PICKER), []);

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

const defaultNoBlock = normalizeOffboardingBlockDecision({});
assert.equal(defaultNoBlock.blockDecision, "NO_BLOCK");
assert.equal(defaultNoBlock.blockStatus, BlockStatus.NO_BLOCK);
assert.equal(defaultNoBlock.blockReason, null);

const permanent = normalizeOffboardingBlockDecision({
  blockDecision: "PERMANENT",
  blockReason: "  policy violation  "
});
assert.equal(permanent.blockDecision, "PERMANENT");
assert.equal(permanent.blockStatus, BlockStatus.PERMANENT_BLOCK);
assert.equal(permanent.blockReason, "policy violation");

assert.throws(
  () => normalizeOffboardingBlockDecision({ blockDecision: "PERMANENT" }),
  /blockReason is required for PERMANENT block/
);

for (const legacyDecision of ["THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR"]) {
  assert.throws(
    () =>
      normalizeOffboardingBlockDecision({
        blockDecision: legacyDecision,
        blockReason: "legacy"
      }),
    /Temporary block durations are no longer supported/
  );
}

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
  "PERMANENT"
]);
