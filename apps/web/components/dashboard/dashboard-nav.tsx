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
      className="sn-sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4"
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
  const activeChild = item.children?.some((child) =>
    child.href ? isActiveHref(pathname, child.href) : false
  );
  const isExpanded = Boolean(!collapsed && item.children?.length && (isActive || activeChild));
  const itemClassName = cn(
    "flex min-h-11 items-center rounded-xl border text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20",
    collapsed ? "justify-center px-0" : "gap-3 px-3",
    isActive || activeChild
      ? "border-slate-200 bg-slate-100 text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
    item.disabled && "cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent hover:text-slate-600"
  );
  const iconClassName = cn(
    "h-5 w-5 shrink-0",
    isActive || activeChild ? "text-primary" : "text-slate-500"
  );

  if (!item.href || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={itemClassName}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={iconClassName} />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </span>
    );
  }

  return (
    <div>
      <Link
        aria-current={isActive && !activeChild ? "page" : undefined}
        className={itemClassName}
        href={item.href}
        onClick={onNavigate}
        prefetch
        title={collapsed ? item.label : undefined}
      >
        <Icon className={iconClassName} />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </Link>
      {isExpanded ? (
        <div className="ml-5 mt-1 grid gap-1 border-l border-slate-200 pl-3">
          {item.children?.map((child) => (
            <DashboardNavChildItem
              child={child}
              key={child.label}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DashboardNavChildItem({
  child,
  onNavigate,
  pathname
}: {
  child: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const isActive = child.href ? isActiveHref(pathname, child.href) : false;

  if (!child.href || child.disabled) {
    return (
      <span className="flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-slate-400">
        {child.label}
      </span>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20",
        isActive
          ? "bg-primary/10 text-slate-950"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
      )}
      href={child.href}
      onClick={onNavigate}
      prefetch
    >
      <span className="truncate">{child.label}</span>
    </Link>
  );
}
