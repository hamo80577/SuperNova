"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { isActiveHref } from "./dashboard-shell-utils";
import type { NavItem } from "./role-nav";

export type DashboardNavSection = [string, NavItem[]];

export function DashboardNav({
  collapsed,
  navSections,
  onNavigate,
  pathname
}: {
  collapsed: boolean;
  navSections: DashboardNavSection[];
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
    >
      <div className="grid gap-5">
        {navSections.map(([section, items]) => (
          <div className="grid gap-1" key={section}>
            {!collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {section}
              </p>
            ) : null}
            {items.map((item) => (
              <DashboardNavItem
                collapsed={collapsed}
                item={item}
                key={`${section}-${item.label}`}
                onNavigate={onNavigate}
                pathname={pathname}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function DashboardNavItem({
  collapsed,
  item,
  onNavigate,
  pathname
}: {
  collapsed: boolean;
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = item.href ? isActiveHref(pathname, item.href) : false;
  const itemClassName = cn(
    "flex min-h-11 items-center rounded-xl border text-sm font-medium transition-colors",
    collapsed ? "justify-center px-0" : "gap-3 px-3",
    isActive
      ? "border-orange-200 bg-orange-50 text-orange-700 shadow-[inset_3px_0_0_hsl(var(--primary))]"
      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
    item.disabled && "cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent hover:text-slate-600"
  );

  if (!item.href || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={itemClassName}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </span>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={itemClassName}
      href={item.href}
      onClick={onNavigate}
      prefetch
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
