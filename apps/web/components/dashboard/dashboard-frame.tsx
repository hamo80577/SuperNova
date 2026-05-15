"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth/types";
import { DashboardLayout } from "./dashboard-layout";
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
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">
              {copy.emptyTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
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
  title
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardLayout description={description} title={title}>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4" key={item.label}>
            <Icon className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-slate-950">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.href ? "Available" : "Planned control surface"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
