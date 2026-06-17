import {
  validateAdminProfileEditForm,
  type AdminProfileEditFieldErrors
} from "./admin-profile-edit-validation";

import type { UpdateAdminProfileInput } from "@/lib/api/users";
import type { UserRole } from "@/lib/auth/types";

const assert = {
  deepEqual(actual: unknown, expected: unknown) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);

    if (actualJson !== expectedJson) {
      throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    }
  },
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

function validate(role: UserRole, form: UpdateAdminProfileInput) {
  return validateAdminProfileEditForm({ form, role });
}

{
  const result = validate("AREA_MANAGER", {
    nameEn: " ",
    phoneNumber: ""
  });

  assert.deepEqual(result.errors, {
    nameEn: "English name is required.",
    phoneNumber: "Phone is required.",
    nationalId: "National ID is required."
  } satisfies AdminProfileEditFieldErrors);
  assert.equal(result.firstInvalidField, "nameEn");
}

{
  const result = validate("AREA_MANAGER", {
    nameEn: "Area Manager",
    phoneNumber: "01000000000",
    nationalId: ""
  });

  assert.deepEqual(result.errors, {
    nationalId: "National ID is required."
  } satisfies AdminProfileEditFieldErrors);
  assert.equal(result.firstInvalidField, "nationalId");
}

{
  const result = validate("PICKER", {
    nameEn: "Picker User",
    phoneNumber: "01000000000",
    nationalId: "",
    address: " ",
    dateOfBirth: "",
    joiningDate: ""
  });

  assert.deepEqual(result.errors, {
    nationalId: "National ID is required.",
    dateOfBirth: "Date of birth is required for Pickers.",
    joiningDate: "Joining date is required for Pickers.",
    address: "Address is required for Pickers."
  } satisfies AdminProfileEditFieldErrors);
  assert.equal(result.firstInvalidField, "nationalId");
}

{
  const result = validate("PICKER", {
    nameEn: "Picker User",
    phoneNumber: "01000000000",
    nationalId: "12345678901234",
    address: "Cairo",
    dateOfBirth: "1996-05-01",
    joiningDate: "2026-05-01"
  });

  assert.deepEqual(result.errors, {});
  assert.equal(result.firstInvalidField, null);
}
