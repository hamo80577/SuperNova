"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppLoadingOverlay } from "@/components/ui/app-loading-overlay";
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

  return <>{children}</>;
}

export function FullPageStatus({ label }: { label: string }) {
  return <AppLoadingOverlay fixed={false} label={label} />;
}
