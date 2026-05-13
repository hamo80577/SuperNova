import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import {
  normalizeNewHireTargetRole,
  toNewHireLookupStatus,
  validateEgyptNationalId,
  validateEgyptPhoneNumber,
  type NewHireLookupStatus
} from "../src/requests/workflows/new-hire-workflow.policy";

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
