"use client";

import { useRef, useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { replaceRoute } from "@/lib/navigation";
import { hideGlobalLoading, showGlobalLoading } from "@/lib/navigation-loading";

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

export function ChangePasswordForm() {
  return (
    <ProtectedRoute>
      <ChangePasswordFormInner />
    </ProtectedRoute>
  );
}

function ChangePasswordFormInner() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { changePassword, user } = useAuth();
  const router = useRouter();
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (submittingRef.current || submitting) {
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }

    if (!PASSWORD_RULE.test(newPassword)) {
      setError(
        "New password must be at least 10 characters and include uppercase, lowercase, and numeric characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    showGlobalLoading("Changing password");

    try {
      const response = await changePassword(currentPassword, newPassword);
      setSuccess("Password changed.");
      replaceRoute(router, response.redirectTo);
    } catch (caughtError) {
      submittingRef.current = false;
      hideGlobalLoading();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to change password."
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {user?.role === "PICKER" && user.profileStatus === "INCOMPLETE" ? (
        <div className="rounded-md border border-[#FFD8BD] bg-[#FFE8D9] px-3 py-2 text-sm text-[color:var(--tlb-orange-900)]">
          After changing this temporary password, complete your operational
          Picker profile before opening the full workspace.
        </div>
      ) : null}

      <PasswordField
        autoComplete="current-password"
        disabled={submitting}
        id="current-password"
        label="Current password"
        onChange={setCurrentPassword}
        value={currentPassword}
      />
      <PasswordField
        autoComplete="new-password"
        disabled={submitting}
        id="new-password"
        label="New password"
        onChange={setNewPassword}
        value={newPassword}
      />
      <PasswordField
        autoComplete="new-password"
        disabled={submitting}
        id="confirm-password"
        label="Confirm password"
        onChange={setConfirmPassword}
        value={confirmPassword}
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-[oklch(0.85_0.07_150)] bg-[oklch(0.95_0.045_150)] px-3 py-2 text-sm text-[oklch(0.40_0.13_150)]">
          {success}
        </div>
      ) : null}

      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {submitting ? "Changing password" : "Change password"}
      </Button>
    </form>
  );
}

function PasswordField({
  autoComplete,
  disabled,
  id,
  label,
  onChange,
  value
}: {
  autoComplete: string;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          autoComplete={autoComplete}
          className="pl-9"
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          type="password"
          value={value}
        />
      </div>
    </div>
  );
}
