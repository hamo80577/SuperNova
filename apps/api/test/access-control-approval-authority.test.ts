import assert from "node:assert/strict";

import { ApprovalStep } from "@prisma/client";

import {
  APPROVAL_AUTHORITY_BY_STEP,
  ApprovalAuthorities,
  assertValidApprovalAuthorityMapping,
  getApprovalAuthorityForStep,
  isChainAuthorityStep,
  isFinalLifecycleAuthorityStep,
  type ApprovalAuthority as ApprovalAuthorityType
} from "../src/access-control";

const approvalSteps = Object.values(ApprovalStep);
const mappedSteps = Object.keys(APPROVAL_AUTHORITY_BY_STEP);
const knownAuthorities = new Set<string>(Object.values(ApprovalAuthorities));

assert.deepEqual(mappedSteps.sort(), approvalSteps.sort());
assert.equal(mappedSteps.length, new Set(mappedSteps).size);

for (const authority of Object.values(APPROVAL_AUTHORITY_BY_STEP)) {
  assert.ok(
    knownAuthorities.has(authority),
    `${authority} should be a known approval authority`
  );
}

assert.equal(
  getApprovalAuthorityForStep(ApprovalStep.AREA_MANAGER_APPROVAL),
  ApprovalAuthorities.CHAIN_AUTHORITY_APPROVAL
);
assert.equal(
  getApprovalAuthorityForStep(ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL),
  ApprovalAuthorities.SOURCE_CHAIN_AUTHORITY_APPROVAL
);
assert.equal(
  getApprovalAuthorityForStep(ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL),
  ApprovalAuthorities.DESTINATION_CHAIN_AUTHORITY_APPROVAL
);
assert.equal(
  getApprovalAuthorityForStep(ApprovalStep.ADMIN_FINAL_APPROVAL),
  ApprovalAuthorities.FINAL_LIFECYCLE_AUTHORITY
);

for (const step of [
  ApprovalStep.AREA_MANAGER_APPROVAL,
  ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
  ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL
]) {
  assert.equal(isChainAuthorityStep(step), true, `${step} should be chain authority`);
}

assert.equal(isChainAuthorityStep(ApprovalStep.ADMIN_FINAL_APPROVAL), false);

assert.equal(
  isFinalLifecycleAuthorityStep(ApprovalStep.ADMIN_FINAL_APPROVAL),
  true
);

for (const step of [
  ApprovalStep.AREA_MANAGER_APPROVAL,
  ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
  ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL
]) {
  assert.equal(
    isFinalLifecycleAuthorityStep(step),
    false,
    `${step} should not be final lifecycle authority`
  );
}

assert.deepEqual(Object.values(ApprovalStep).sort(), [
  "ADMIN_FINAL_APPROVAL",
  "AREA_MANAGER_APPROVAL",
  "DESTINATION_AREA_MANAGER_APPROVAL",
  "SOURCE_AREA_MANAGER_APPROVAL"
]);

for (const approvalStepValue of Object.values(ApprovalStep)) {
  assert.equal(
    Object.values(ApprovalAuthorities).includes(
      approvalStepValue as ApprovalAuthorityType
    ),
    false,
    `${approvalStepValue} should remain an ApprovalStep, not an authority value`
  );
}

assert.doesNotThrow(() => assertValidApprovalAuthorityMapping());
