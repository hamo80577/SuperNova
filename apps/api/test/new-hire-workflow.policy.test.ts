import assert from "node:assert/strict";

import { BlockStatus, UserRole } from "@prisma/client";

import {
  getRehireBlockNormalizationFields,
  getAllowedNewHireTargetRolesForCreator,
  normalizeNewHireTargetRole,
  resolveNewHireFinalizationShopperId,
  toNewHireLookupStatus,
  validateEgyptNationalId,
  validateEgyptPhoneNumber,
  type NewHireLookupStatus
} from "../src/requests/workflows/new-hire-workflow.policy";
import { parseNewHirePayload } from "../src/requests/workflows/new-hire-payload";

assert.equal(normalizeNewHireTargetRole(undefined), UserRole.PICKER);
assert.equal(normalizeNewHireTargetRole(UserRole.CHAMP), UserRole.CHAMP);
assert.equal(
  normalizeNewHireTargetRole(UserRole.AREA_MANAGER),
  UserRole.AREA_MANAGER
);
assert.throws(
  () => normalizeNewHireTargetRole(UserRole.ADMIN),
  /targetRole must be PICKER, CHAMP, or AREA_MANAGER/
);

assert.deepEqual(getAllowedNewHireTargetRolesForCreator(UserRole.CHAMP), [
  UserRole.PICKER
]);
assert.deepEqual(getAllowedNewHireTargetRolesForCreator(UserRole.AREA_MANAGER), [
  UserRole.PICKER,
  UserRole.CHAMP
]);
assert.deepEqual(getAllowedNewHireTargetRolesForCreator(UserRole.ADMIN), [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
]);
assert.deepEqual(getAllowedNewHireTargetRolesForCreator(UserRole.SUPER_ADMIN), [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
]);
assert.deepEqual(getAllowedNewHireTargetRolesForCreator(UserRole.PICKER), []);

assert.equal(validateEgyptPhoneNumber(" 01012345678 "), "01012345678");
assert.equal(validateEgyptPhoneNumber("01112345678"), "01112345678");
assert.throws(
  () => validateEgyptPhoneNumber("01312345678"),
  /phoneNumber must start with 010, 011, 012, or 015/
);
assert.throws(
  () => validateEgyptPhoneNumber("01012345abc"),
  /phoneNumber must contain numbers only/
);
assert.throws(
  () => validateEgyptPhoneNumber("0101234567"),
  /phoneNumber must be exactly 11 digits/
);

assert.equal(validateEgyptNationalId(" 12345678901234 "), "12345678901234");
assert.throws(
  () => validateEgyptNationalId("1234567890123x"),
  /nationalId must contain numbers only/
);
assert.throws(
  () => validateEgyptNationalId("1234567890123"),
  /nationalId must be exactly 14 digits/
);

assert.equal(toNewHireLookupStatus([]), "CLEAR");
assert.equal(
  toNewHireLookupStatus(["REHIRE_AVAILABLE"]),
  "REHIRE_AVAILABLE"
);
assert.equal(
  toNewHireLookupStatus(["ACTIVE_DUPLICATE", "REHIRE_AVAILABLE"]),
  "ACTIVE_DUPLICATE"
);
assert.equal(
  toNewHireLookupStatus(["TEMPORARY_BLOCKED", "REHIRE_AVAILABLE"]),
  "TEMPORARY_BLOCKED"
);
assert.equal(
  toNewHireLookupStatus(["PERMANENT_BLOCKED", "ACTIVE_DUPLICATE"]),
  "PERMANENT_BLOCKED"
);

const exhaustiveStatusCheck: Record<NewHireLookupStatus, true> = {
  CLEAR: true,
  ACTIVE_DUPLICATE: true,
  REHIRE_AVAILABLE: true,
  TEMPORARY_BLOCKED: true,
  PERMANENT_BLOCKED: true
};
assert.equal(Object.keys(exhaustiveStatusCheck).length, 5);

assert.equal(
  resolveNewHireFinalizationShopperId(UserRole.PICKER, undefined, "SHOP-OLD"),
  "SHOP-OLD"
);
assert.equal(
  resolveNewHireFinalizationShopperId(UserRole.PICKER, " SHOP-NEW ", "SHOP-OLD"),
  "SHOP-NEW"
);
assert.throws(
  () => resolveNewHireFinalizationShopperId(UserRole.PICKER, undefined, null),
  /Shopper ID must be captured by the Area Manager before Admin final approval/
);
assert.equal(
  resolveNewHireFinalizationShopperId(UserRole.CHAMP, undefined, null),
  null
);
assert.equal(
  resolveNewHireFinalizationShopperId(UserRole.CHAMP, "IGNORED", "SHOP-OLD"),
  null
);

assert.deepEqual(getRehireBlockNormalizationFields(), {
  blockStatus: BlockStatus.NO_BLOCK,
  blockedUntil: null,
  blockReason: null
});

const legacyPickerPayload = parseNewHirePayload({
  targetRole: UserRole.PICKER,
  mode: "NEW_PICKER",
  candidate: {
    phoneNumber: "01012345678",
    nationalId: "12345678901234"
  },
  source: {
    vendorId: "vendor-1",
    chainId: "chain-1"
  }
});
assert.equal(legacyPickerPayload.candidate.actualJoiningDate, undefined);

const pickerPayload = parseNewHirePayload({
  targetRole: UserRole.PICKER,
  mode: "REHIRE",
  candidate: {
    phoneNumber: "01012345678",
    nationalId: "12345678901234",
    actualJoiningDate: "2026-06-01"
  },
  source: {
    vendorId: "vendor-1",
    chainId: "chain-1"
  },
  rehire: {
    userId: "picker-1",
    matchedBy: ["phoneNumber"],
    previousAccountStatus: "ARCHIVED",
    previousEmploymentStatus: "RESIGNED",
    previousBlockStatus: "NO_BLOCK",
    previousBlockedUntil: null,
    previousProfileStatus: "COMPLETE"
  }
});
assert.equal(pickerPayload.candidate.actualJoiningDate, "2026-06-01");

const champPayload = parseNewHirePayload({
  targetRole: UserRole.CHAMP,
  mode: "NEW_CHAMP",
  candidate: {
    phoneNumber: "01012345678",
    nationalId: "12345678901234"
  },
  source: {
    vendorId: "vendor-1",
    chainId: "chain-1"
  }
});
assert.equal(champPayload.candidate.actualJoiningDate, undefined);
