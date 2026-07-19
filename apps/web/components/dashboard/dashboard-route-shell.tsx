"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "./dashboard-layout";
import { getDashboardRouteConfig } from "./dashboard-route-config";
import { DashboardRouteShellProvider } from "./dashboard-route-context";

export function DashboardRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeConfig = useMemo(
    () => getDashboardRouteConfig(pathname),
    [pathname]
  );

  if (!routeConfig) {
    return <>{children}</>;
  }

  return (
    <DashboardRouteShellProvider>
      <ProtectedRoute allowedRoles={routeConfig.allowedRoles}>
        <DashboardLayout
          description={routeConfig.description}
          hideHeaderDescription={routeConfig.hideHeaderDescription}
          showPageTitle={routeConfig.showPageTitle}
          title={routeConfig.title}
        >
          {children}
        </DashboardLayout>
      </ProtectedRoute>
    </DashboardRouteShellProvider>
  );
}
