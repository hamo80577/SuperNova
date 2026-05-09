"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { redirectForUser, useAuth } from "@/components/auth/auth-provider";
import type { UserRole } from "@/lib/auth/types";
import { replaceRoute } from "@/lib/navigation";

export function ProtectedRoute({
  children,
  allowedRoles
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      replaceRoute(router, "/login");
      return;
    }

    if (user.mustChangePassword && pathname !== "/change-password") {
      replaceRoute(router, "/change-password");
      return;
    }

    if (
      user.role === "PICKER" &&
      user.profileStatus === "INCOMPLETE" &&
      pathname !== "/change-password" &&
      pathname !== "/picker/profile-completion"
    ) {
      replaceRoute(router, "/picker/profile-completion");
      return;
    }

    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      replaceRoute(router, redirectForUser(user));
    }
  }, [allowedRoles, loading, pathname, router, user]);

  if (loading) {
    return <FullPageStatus label="Checking session" />;
  }

  if (!user) {
    return <FullPageStatus label="Redirecting" />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <FullPageStatus label="Redirecting" />;
  }

  if (
    user.role === "PICKER" &&
    user.profileStatus === "INCOMPLETE" &&
    pathname !== "/change-password" &&
    pathname !== "/picker/profile-completion"
  ) {
    return <FullPageStatus label="Opening profile completion" />;
  }

  return <>{children}</>;
}

export function FullPageStatus({ label }: { label: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
      <div className="rounded-lg border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
        {label}
      </div>
    </main>
  );
}
