"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth/types";
import { DashboardLayout } from "./dashboard-layout";
import { useDashboardRouteShell } from "./dashboard-route-context";
import { dashboardCopy } from "./dashboard-shell-utils";
import { roleNavigation } from "./role-nav";

export function DashboardShell({ role }: { role: UserRole }) {
  const copy = dashboardCopy[role];

  return (
    <DashboardFrame
      allowedRoles={role === "ADMIN" ? ["ADMIN", "SUPER_ADMIN"] : [role]}
      description={copy.description}
      title={copy.title}
    >
      <div className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-6 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">
              {copy.emptyTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sn-muted)]">
              {copy.emptyBody}
            </p>
          </div>
          <Badge variant="muted">MVP ready</Badge>
        </div>
        <DashboardPlaceholderGrid />
      </div>
    </DashboardFrame>
  );
}

export function DashboardFrame({
  allowedRoles,
  children,
  description,
  hideHeaderDescription,
  showPageTitle,
  title
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
  description: string;
  hideHeaderDescription?: boolean;
  showPageTitle?: boolean;
  title: string;
}) {
  const renderedByRouteShell = useDashboardRouteShell();

  if (renderedByRouteShell) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardLayout
        description={description}
        hideHeaderDescription={hideHeaderDescription}
        showPageTitle={showPageTitle}
        title={title}
      >
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function DashboardPlaceholderGrid() {
  const { user } = useAuth();
  const navItems = roleNavigation[user?.role ?? "ADMIN"];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {navItems.slice(1).map((item) => {
        const Icon = item.icon;
        return (
          <div className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4" key={item.label}>
            <Icon className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-[color:var(--sn-ink)]">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--sn-muted)]">
              {item.href ? "Available" : "Planned control surface"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
