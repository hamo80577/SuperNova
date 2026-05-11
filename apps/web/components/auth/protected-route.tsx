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
  return <AppLoadingOverlay fixed={false} label={label} />;
}
