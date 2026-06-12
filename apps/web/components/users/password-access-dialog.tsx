"use client";

import { KeyRound, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { usersApi, type OperationalProfileResponse } from "@/lib/api/users";

export function PasswordAccessDialog({
  onClose,
  profile
}: {
  onClose: () => void;
  profile: OperationalProfileResponse;
}) {
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordExpiresAt, setTemporaryPasswordExpiresAt] = useState<
    string | null
  >(profile.password.temporaryPasswordExpiresAt);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const user = profile.user;
  const expiresAt = profile.password.temporaryPasswordExpiresAt
    ? new Date(profile.password.temporaryPasswordExpiresAt).getTime()
    : null;
  const temporaryPasswordExpired =
    expiresAt !== null && expiresAt <= Date.now();
  const canReveal =
    profile.password.mustChangePassword &&
    profile.password.temporaryPasswordAvailable &&
    profile.permissions.canReadTemporaryPassword &&
    !temporaryPasswordExpired;
  const canReset =
    profile.permissions.canResetPassword ||
    profile.permissions.canRegenerateTemporaryPassword;

  useEffect(() => {
    if (!canReveal) {
      setTemporaryPassword("");
    }
    setTemporaryPasswordExpiresAt(
      canReveal ? profile.password.temporaryPasswordExpiresAt : null
    );
  }, [canReveal, profile.password.temporaryPasswordExpiresAt]);

  function revealTemporaryPassword() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await usersApi.revealTemporaryPassword(user.id);
        setTemporaryPassword(response.temporaryPassword);
        setTemporaryPasswordExpiresAt(response.temporaryPasswordExpiresAt);
        setMessage("Temporary password revealed.");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to reveal temporary password."
        );
      }
    });
  }

  function resetTemporaryPassword() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await usersApi.resetTemporaryPassword(user.id);
        setTemporaryPassword(response.temporaryPassword);
        setTemporaryPasswordExpiresAt(response.temporaryPasswordExpiresAt);
        setMessage("Temporary password reset. Share it from this profile only.");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to reset temporary password."
        );
      }
    });
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[180] grid place-items-center bg-[rgba(65,21,23,0.45)] p-3 sn-dialog-overlay-in"
      role="dialog"
    >
      <section className="w-full max-w-lg rounded-[24px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-2xl sn-dialog-panel-in sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] ring-1 ring-[#FFD8BD]">
              <KeyRound className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[color:var(--sn-ink)]">
              Password access
            </h3>
            <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
              Temporary password can be revealed only while the user must change it.
            </p>
            {temporaryPasswordExpiresAt ? (
              <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
                Available until {new Date(temporaryPasswordExpiresAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Close password access"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {temporaryPassword ? (
          <div className="mt-4 grid gap-3">
            <div className="flex gap-2">
              <Input
                className="h-11 min-w-0 rounded-xl font-mono"
                readOnly
                value={temporaryPassword}
              />
              <CopyButton
                aria-label="Copy temporary password"
                className="h-11 w-11 shrink-0 p-0"
                iconOnly
                text={temporaryPassword}
              />
            </div>
            {canReset ? (
              <Button
                className="h-11 rounded-xl"
                disabled={isPending}
                onClick={resetTemporaryPassword}
                type="button"
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset temporary password
              </Button>
            ) : null}
          </div>
        ) : canReveal ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              className="h-11 rounded-xl border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] hover:bg-[#FFD8BD]"
              disabled={isPending}
              onClick={revealTemporaryPassword}
              type="button"
              variant="outline"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Reveal temporary password
            </Button>
            {canReset ? (
              <Button
                className="h-11 rounded-xl"
                disabled={isPending}
                onClick={resetTemporaryPassword}
                type="button"
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset temporary password
              </Button>
            ) : null}
          </div>
        ) : (
          <Button
            className="mt-4 h-11 rounded-xl border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] hover:bg-[#FFD8BD]"
            disabled={isPending || !canReset}
            onClick={resetTemporaryPassword}
            type="button"
            variant="outline"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Reset temporary password
          </Button>
        )}
        {message ? <p className="mt-3 text-sm text-[oklch(0.58_0.13_150)]">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-[oklch(0.55_0.19_27)]">{error}</p> : null}
      </section>
    </div>
  );
}
