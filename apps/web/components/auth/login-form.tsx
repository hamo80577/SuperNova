"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Phone } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redirectForUser, useAuth } from "@/components/auth/auth-provider";
import { replaceRoute } from "@/lib/navigation";
import { hideGlobalLoading, showGlobalLoading } from "@/lib/navigation-loading";

export function LoginForm() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, loading, user } = useAuth();
  const router = useRouter();
  const submittingRef = useRef(false);
  const busy = loading || submitting;

  useEffect(() => {
    if (!loading && user) {
      replaceRoute(router, redirectForUser(user));
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (submittingRef.current || busy) {
      return;
    }

    if (!phoneNumber.trim() || !password) {
      setError("Phone number and password are required.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    showGlobalLoading("Signing in");

    try {
      const response = await login(phoneNumber, password, rememberMe);
      replaceRoute(router, response.redirectTo);
    } catch (caughtError) {
      submittingRef.current = false;
      hideGlobalLoading();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to sign in."
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="phone">
          Phone number
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoComplete="tel"
            className="h-[46px] rounded-xl border-slate-200 bg-white pl-11 text-base shadow-none transition-colors focus-visible:border-[#FF5A00] focus-visible:ring-2 focus-visible:ring-[#FF5A00]/20"
            disabled={busy}
            id="phone"
            inputMode="tel"
            onChange={(event) => setPhoneNumber(event.target.value)}
            value={phoneNumber}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoComplete="current-password"
            className="h-[46px] rounded-xl border-slate-200 bg-white pl-11 pr-12 text-base shadow-none transition-colors focus-visible:border-[#FF5A00] focus-visible:ring-2 focus-visible:ring-[#FF5A00]/20"
            disabled={busy}
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-orange-50 hover:text-[#FF5A00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A00]/30"
            disabled={busy}
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-start sm:justify-between">
        <label
          className="flex min-h-10 cursor-pointer items-center gap-3 text-slate-700"
          htmlFor="remember-me"
        >
          <input
            checked={rememberMe}
            className="h-4 w-4 rounded border-slate-300 accent-[#FF5A00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A00]/30"
            disabled={busy}
            id="remember-me"
            onChange={(event) => setRememberMe(event.target.checked)}
            type="checkbox"
          />
          Keep me signed in
        </label>
        <p className="leading-5 text-slate-500 sm:max-w-[180px] sm:text-right">
          Forgot password? Contact Admin to reset it.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button
        className="h-12 w-full rounded-xl bg-[#FF5A00] text-base font-semibold text-white shadow-none transition-colors hover:bg-[#E65100] focus-visible:ring-2 focus-visible:ring-[#FF5A00]/30"
        disabled={busy}
        type="submit"
      >
        {busy ? "Logging in" : "Log in"}
      </Button>
    </form>
  );
}
