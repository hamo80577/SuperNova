"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Phone } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redirectForUser, useAuth } from "@/components/auth/auth-provider";
import { replaceRoute } from "@/lib/navigation";

export function LoginForm() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      replaceRoute(router, redirectForUser(user));
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!phoneNumber.trim() || !password) {
      setError("Phone number and password are required.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await login(phoneNumber, password);
      replaceRoute(router, response.redirectTo);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to sign in."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="phone">
          Phone number
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            autoComplete="tel"
            className="pl-9"
            id="phone"
            inputMode="tel"
            onChange={(event) => setPhoneNumber(event.target.value)}
            value={phoneNumber}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            autoComplete="current-password"
            className="pl-9"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button className="w-full" disabled={submitting || loading} type="submit">
        {submitting ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
