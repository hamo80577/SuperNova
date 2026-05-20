"use client";

import { AlertTriangle, Loader2, Save, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { usersApi, type UpdateAdminProfileInput } from "@/lib/api/users";
import type { SafeUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import {
  validateAdminProfileEditForm,
  type AdminProfileEditField,
  type AdminProfileEditFieldErrors
} from "./admin-profile-edit-validation";

type FieldElement = HTMLInputElement | HTMLSelectElement;

export function AdminProfileEditDialog({
  onClose,
  onSaved,
  user
}: {
  onClose: () => void;
  onSaved: () => void;
  user: SafeUser;
}) {
  const [form, setForm] = useState<UpdateAdminProfileInput>(() =>
    toEditForm(user)
  );
  const [fieldErrors, setFieldErrors] =
    useState<AdminProfileEditFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fieldRefs = useRef<Partial<Record<AdminProfileEditField, FieldElement | null>>>(
    {}
  );

  useEffect(() => {
    setForm(toEditForm(user));
    setFieldErrors({});
    setFormError(null);
  }, [user]);

  function setFieldRef(field: AdminProfileEditField) {
    return (element: FieldElement | null) => {
      fieldRefs.current[field] = element;
    };
  }

  function updateField<Key extends keyof UpdateAdminProfileInput>(
    key: Key,
    value: UpdateAdminProfileInput[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = validateAdminProfileEditForm({
      form,
      role: user.role
    });

    if (result.firstInvalidField) {
      setFieldErrors(result.errors);
      fieldRefs.current[result.firstInvalidField]?.focus();
      return;
    }

    setFieldErrors({});
    setIsSaving(true);

    try {
      await usersApi.updateAdminProfile(user.id, normalizeEditForm(form));
      setIsSaving(false);
      onSaved();
      onClose();
    } catch (caughtError) {
      setIsSaving(false);
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save profile."
      );
    }
  }

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[240] grid place-items-center bg-slate-950/55 p-2 sn-dialog-overlay-in sm:p-4"
        role="dialog"
      >
        <form
          className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl sn-dialog-panel-in"
          onSubmit={onSubmit}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                Admin edit
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-normal text-slate-950 sm:text-xl">
                Edit profile
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update safe identity and profile fields for {user.nameEn}.
              </p>
            </div>
            <Button
              aria-label="Close edit profile"
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-5">
            {formError ? (
              <div
                className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <EditTextField
                error={fieldErrors.nameEn}
                field="nameEn"
                label="English name"
                onChange={(value) => updateField("nameEn", value)}
                refSetter={setFieldRef("nameEn")}
                required
                value={form.nameEn ?? ""}
              />
              <EditTextField
                error={fieldErrors.nameAr}
                field="nameAr"
                label="Arabic name"
                onChange={(value) => updateField("nameAr", value)}
                refSetter={setFieldRef("nameAr")}
                value={form.nameAr ?? ""}
              />
              <EditTextField
                autoComplete="tel"
                error={fieldErrors.phoneNumber}
                field="phoneNumber"
                label="Phone"
                onChange={(value) => updateField("phoneNumber", value)}
                refSetter={setFieldRef("phoneNumber")}
                required
                type="tel"
                value={form.phoneNumber ?? ""}
              />
              <EditTextField
                error={fieldErrors.nationalId}
                field="nationalId"
                label="National ID"
                onChange={(value) => updateField("nationalId", value)}
                refSetter={setFieldRef("nationalId")}
                required={user.role === "PICKER"}
                value={form.nationalId ?? ""}
              />
              <EditTextField
                error={fieldErrors.dateOfBirth}
                field="dateOfBirth"
                label="Date of birth"
                onChange={(value) => updateField("dateOfBirth", value)}
                refSetter={setFieldRef("dateOfBirth")}
                required={user.role === "PICKER"}
                type="date"
                value={form.dateOfBirth ?? ""}
              />
              <EditTextField
                error={fieldErrors.joiningDate}
                field="joiningDate"
                label="Joining date"
                onChange={(value) => updateField("joiningDate", value)}
                refSetter={setFieldRef("joiningDate")}
                required={user.role === "PICKER"}
                type="date"
                value={form.joiningDate ?? ""}
              />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                <span>Gender</span>
                <Select
                  aria-label="Gender"
                  className="h-11 rounded-xl bg-white"
                  onChange={(event) =>
                    updateField("gender", event.target.value as SafeUser["gender"])
                  }
                  ref={setFieldRef("gender")}
                  value={form.gender ?? "UNSPECIFIED"}
                >
                  <option value="UNSPECIFIED">Unspecified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </label>
              <EditTextField
                error={fieldErrors.shopperId}
                field="shopperId"
                label="Shopper ID"
                onChange={(value) => updateField("shopperId", value)}
                refSetter={setFieldRef("shopperId")}
                value={form.shopperId ?? ""}
              />
              <EditTextField
                error={fieldErrors.ibsId}
                field="ibsId"
                label="IBS ID"
                onChange={(value) => updateField("ibsId", value)}
                refSetter={setFieldRef("ibsId")}
                value={form.ibsId ?? ""}
              />
              <EditTextField
                className="sm:col-span-2"
                error={fieldErrors.address}
                field="address"
                label="Address"
                onChange={(value) => updateField("address", value)}
                refSetter={setFieldRef("address")}
                required={user.role === "PICKER"}
                value={form.address ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
            <Button
              className="h-11 rounded-xl"
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl bg-orange-600 px-5 text-white hover:bg-orange-700"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save profile
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

function EditTextField({
  autoComplete,
  className,
  error,
  field,
  label,
  onChange,
  refSetter,
  required = false,
  type = "text",
  value
}: {
  autoComplete?: string;
  className?: string;
  error?: string;
  field: AdminProfileEditField;
  label: string;
  onChange: (value: string) => void;
  refSetter: (element: HTMLInputElement | null) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  const errorId = `${field}-error`;

  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      <span>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={cn(
          "h-11 rounded-xl bg-white",
          error &&
            "border-red-300 text-red-900 focus-visible:ring-red-200"
        )}
        onChange={(event) => onChange(event.target.value)}
        ref={refSetter}
        type={type}
        value={value}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600" id={errorId}>
          {error}
        </p>
      ) : null}
    </label>
  );
}

function normalizeEditForm(
  form: UpdateAdminProfileInput
): UpdateAdminProfileInput {
  return {
    nameEn: form.nameEn?.trim() ?? "",
    nameAr: form.nameAr?.trim() ?? "",
    phoneNumber: form.phoneNumber?.trim() ?? "",
    nationalId: form.nationalId?.trim() ?? "",
    address: form.address?.trim() ?? "",
    dateOfBirth: form.dateOfBirth ?? "",
    gender: form.gender ?? "UNSPECIFIED",
    joiningDate: form.joiningDate ?? "",
    shopperId: form.shopperId?.trim() ?? "",
    ibsId: form.ibsId?.trim() ?? ""
  };
}

function toEditForm(user: SafeUser): UpdateAdminProfileInput {
  return {
    nameEn: user.nameEn,
    nameAr: user.nameAr ?? "",
    phoneNumber: user.phoneNumber,
    nationalId: user.nationalId ?? "",
    address: user.address ?? "",
    dateOfBirth: toDateInput(user.dateOfBirth),
    gender: user.gender,
    joiningDate: toDateInput(user.joiningDate),
    shopperId: user.shopperId ?? "",
    ibsId: user.ibsId ?? ""
  };
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}
