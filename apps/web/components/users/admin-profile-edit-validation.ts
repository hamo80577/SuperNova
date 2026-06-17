import type { UpdateAdminProfileInput } from "@/lib/api/users";
import type { UserRole } from "@/lib/auth/types";

export type AdminProfileEditField = keyof UpdateAdminProfileInput;
export type AdminProfileEditFieldErrors = Partial<
  Record<AdminProfileEditField, string>
>;

const FIELD_ORDER: AdminProfileEditField[] = [
  "nameEn",
  "nameAr",
  "phoneNumber",
  "nationalId",
  "dateOfBirth",
  "gender",
  "joiningDate",
  "shopperId",
  "ibsId",
  "address"
];

export function validateAdminProfileEditForm({
  form,
  role
}: {
  form: UpdateAdminProfileInput;
  role: UserRole;
}) {
  const errors: AdminProfileEditFieldErrors = {};
  const nationalId = form.nationalId?.trim() ?? "";

  if (isBlank(form.nameEn)) {
    errors.nameEn = "English name is required.";
  }

  if (isBlank(form.phoneNumber)) {
    errors.phoneNumber = "Phone is required.";
  }

  if (!nationalId) {
    errors.nationalId = "National ID is required.";
  } else if (!/^\d{14}$/.test(nationalId)) {
    errors.nationalId = "National ID must be exactly 14 digits.";
  }

  if (role === "PICKER") {
    if (isBlank(form.dateOfBirth)) {
      errors.dateOfBirth = "Date of birth is required for Pickers.";
    }

    if (isBlank(form.joiningDate)) {
      errors.joiningDate = "Joining date is required for Pickers.";
    }

    if (isBlank(form.address)) {
      errors.address = "Address is required for Pickers.";
    }
  }

  return {
    errors,
    firstInvalidField:
      FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null
  };
}

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0;
}
