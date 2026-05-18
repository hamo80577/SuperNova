import assert from "node:assert/strict";

import { BlockStatus, RequestType, UserRole } from "@prisma/client";

import {
  blockStatusToDecision,
  parseOffboardingPayload
} from "../src/requests/workflows/offboarding-payload";

const pickerPayload = parseOffboardingPayload({
  offboarding: {
    type: RequestType.RESIGNATION,
    reason: "Voluntary quit",
    reasonCode: "VOLUNTARY_QUIT",
    resignationDate: "2026-05-18"
  },
  source: {
    vendorId: "vendor-1",
    chainId: "chain-1"
  },
  target: {
    pickerId: "picker-1",
    pickerAssignmentId: "assignment-1"
  },
  areaManagerDecision: {
    decidedAt: "2026-05-18T08:00:00.000Z",
    decidedById: "area-manager-1",
    blockStatus: BlockStatus.TEMPORARY_BLOCK,
    blockReason: "policy"
  }
});

assert.equal(pickerPayload.target.userId, "picker-1");
assert.equal(pickerPayload.target.targetRole, UserRole.PICKER);
assert.equal(pickerPayload.target.assignmentId, "assignment-1");
assert.equal(pickerPayload.target.assignmentType, "PickerBranchAssignment");
assert.equal(pickerPayload.areaManagerDecision?.blockDecision, "THREE_MONTHS");

const champPayload = parseOffboardingPayload({
  offboarding: {
    type: RequestType.RESIGNATION,
    reason: "Bad performance",
    reasonCode: "BAD_PERFORMANCE",
    resignationDate: "2026-05-18"
  },
  source: {
    vendorId: "vendor-1",
    chainId: "chain-1"
  },
  target: {
    userId: "champ-1",
    targetRole: UserRole.CHAMP,
    assignmentId: "assignment-2",
    assignmentType: "VendorChampAssignment"
  }
});

assert.equal(champPayload.target.targetRole, UserRole.CHAMP);

const areaManagerPayload = parseOffboardingPayload({
  offboarding: {
    type: RequestType.RESIGNATION,
    reason: "Policy violation",
    reasonCode: "POLICY_VIOLATION",
    resignationDate: "2026-05-18"
  },
  source: {
    chainId: "chain-1"
  },
  target: {
    userId: "area-manager-1",
    targetRole: UserRole.AREA_MANAGER,
    assignmentId: "assignment-3",
    assignmentType: "ChainAreaManagerAssignment"
  }
});

assert.equal(areaManagerPayload.target.targetRole, UserRole.AREA_MANAGER);

assert.equal(blockStatusToDecision(BlockStatus.NO_BLOCK), "NO_BLOCK");
assert.equal(blockStatusToDecision(BlockStatus.PERMANENT_BLOCK), "PERMANENT");
assert.equal(blockStatusToDecision(BlockStatus.TEMPORARY_BLOCK), "THREE_MONTHS");
assert.equal(blockStatusToDecision("UNKNOWN"), null);

assert.throws(
  () =>
    parseOffboardingPayload({
      offboarding: {
        type: RequestType.RESIGNATION,
        reason: "Bad performance",
        reasonCode: "BAD_PERFORMANCE",
        resignationDate: "2026-05-18"
      },
      source: {
        chainId: "chain-1"
      },
      target: {
        userId: "champ-1",
        targetRole: UserRole.CHAMP,
        assignmentId: "assignment-2",
        assignmentType: "VendorChampAssignment"
      }
    }),
  /invalid assignment context/
);
