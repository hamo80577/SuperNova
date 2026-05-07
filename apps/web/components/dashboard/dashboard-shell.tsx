"use client";

import { LogOut, PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/auth/role-redirects";
import type { UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { roleNavigation } from "./role-nav";

const dashboardCopy: Record<
  UserRole,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  PICKER: {
    title: "Picker Dashboard",
    description: "Profile and branch workspace placeholders.",
    emptyTitle: "Picker workspace is ready for scoped data.",
    emptyBody: "Profile completion and branch visibility are later phases."
  },
  CHAMP: {
    title: "Champ Dashboard",
    description: "Branch, picker, and request workspace placeholders.",
    emptyTitle: "Champ workspace is ready for assigned branches.",
    emptyBody: "Requests remain placeholders until workflow phases begin."
  },
  AREA_MANAGER: {
    title: "Area Manager Dashboard",
    description: "Chain-level operations and approval workspace placeholders.",
    emptyTitle: "Area Manager workspace is ready for scoped operations.",
    emptyBody: "Scope-aware chains, users, and approvals are later phases."
  },
  ADMIN: {
    title: "Admin Dashboard",
    description: "System administration workspace placeholders.",
    emptyTitle: "Admin workspace is ready for controlled management.",
    emptyBody: "Users, requests, audit, and settings remain placeholders."
  },
  SUPER_ADMIN: {
    title: "Admin Dashboard",
    description: "System administration workspace placeholders.",
    emptyTitle: "Admin workspace is ready for controlled management.",
    emptyBody: "Users, requests, audit, and settings remain placeholders."
  }
};

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
          <Badge variant="muted">Phase 1 placeholder</Badge>
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
      <DashboardFrameInner description={description} title={title}>
        {children}
      </DashboardFrameInner>
    </ProtectedRoute>
  );
}

function DashboardFrameInner({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const navItems = roleNavigation[user?.role ?? "ADMIN"];

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh lg:grid-cols-[264px_1fr]">
        <aside className="border-b bg-card lg:border-b-0 lg:border-r">
          <div className="flex h-16 items-center gap-3 border-b px-5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              SN
            </div>
            <div>
              <p className="text-sm font-semibold">SuperNova</p>
              <p className="text-xs text-muted-foreground">Operations</p>
            </div>
          </div>
          <nav className="grid gap-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href !== "#" && pathname.startsWith(item.href);

              return (
                <a
                  aria-disabled={item.href === "#"}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    isActive
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  href={item.href}
                  key={item.label}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3">
            <div className="flex items-center gap-3">
              <PanelLeft className="h-5 w-5 text-muted-foreground lg:hidden" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{user?.nameEn}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.phoneNumber}
                </p>
              </div>
              <Badge variant="outline">
                {user ? getRoleLabel(user.role) : "Admin"}
              </Badge>
              <Button onClick={() => void logout()} size="sm" variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </header>
          <div className="p-5">{children}</div>
        </section>
      </div>
    </main>
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
          <div className="rounded-md border bg-background p-4" key={item.label}>
            <Icon className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.href === "#" ? "Placeholder" : "Available"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
