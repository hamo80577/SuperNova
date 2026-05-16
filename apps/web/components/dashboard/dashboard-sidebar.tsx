"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardNav, type DashboardNavSection } from "./dashboard-nav";

export function DashboardSidebar({
  collapsed,
  navSections,
  onToggleCollapsed,
  pathname
}: {
  collapsed: boolean;
  navSections: DashboardNavSection[];
  onToggleCollapsed: () => void;
  pathname: string;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[80] hidden shrink-0 bg-white transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-[76px]" : "w-[266px]"
      )}
    >
      <SidebarHeader collapsed={collapsed} />
      <DashboardNav
        collapsed={collapsed}
        navSections={navSections}
        pathname={pathname}
      />
      <Button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-5 bottom-7 z-10 h-10 w-10 rounded-full border-slate-200 bg-white p-0 text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.14)] transition hover:border-primary/30 hover:bg-white hover:text-primary focus-visible:ring-primary/30"
        onClick={onToggleCollapsed}
        type="button"
        variant="outline"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </aside>
  );
}

export function MobileDashboardNavDrawer({
  navSections,
  onClose,
  open,
  pathname
}: {
  navSections: DashboardNavSection[];
  onClose: () => void;
  open: boolean;
  pathname: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Close navigation"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
        type="button"
      />
      <aside className="relative flex h-dvh w-[min(318px,88vw)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <SidebarHeader collapsed={false} compact />
          <Button
            aria-label="Close navigation"
            className="h-11 w-11 rounded-xl text-slate-600"
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <DashboardNav
          collapsed={false}
          navSections={navSections}
          onNavigate={onClose}
          pathname={pathname}
        />
      </aside>
    </div>
  );
}

function SidebarHeader({
  collapsed,
  compact = false
}: {
  collapsed: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact ? "p-0" : "p-4",
        collapsed && !compact && "justify-center px-3"
      )}
    >
      <div className="shadow-brand-soft grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
        SN
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-normal text-slate-950">
            SuperNova
          </p>
          <p className="truncate text-xs font-medium text-slate-500">
            Partner Workforce Operations
          </p>
        </div>
      ) : null}
    </div>
  );
}
