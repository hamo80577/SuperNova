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
  pathname,
  unreadCount = 0
}: {
  collapsed: boolean;
  navSections: DashboardNavSection[];
  onNavigate?: () => void;
  pathname: string;
  unreadCount?: number;
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
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--sn-muted)]">
                {section}
              </p>
            ) : null}
            {items.map((item) => (
              <DashboardNavItem
                collapsed={collapsed}
                count={item.label === "Notifications" ? unreadCount : 0}
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
  count = 0,
  item,
  onNavigate,
  pathname
}: {
  collapsed: boolean;
  count?: number;
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = item.href ? isActiveHref(pathname, item.href) : false;
  const hasCount = count > 0;
  const countLabel = count > 9 ? "9+" : String(count);
  const countChip =
    !collapsed && hasCount ? (
      <span
        className="ml-auto grid min-h-5 min-w-5 place-items-center rounded-full bg-[color:var(--tlb-orange)] px-1 text-[10px] font-bold font-[family-name:var(--font-data)] leading-none text-white"
      >
        {countLabel}
      </span>
    ) : null;
  const collapsedDot =
    collapsed && hasCount ? (
      <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-[color:var(--tlb-orange)]" />
    ) : null;
  const itemClassName = cn(
    "flex min-h-11 items-center rounded-[10px] border text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/25",
    collapsed ? "justify-center px-0" : "gap-3 px-3",
    isActive
      ? "border-[#FFE1CF] bg-[#FFF3EB] font-semibold text-[color:var(--tlb-orange)] shadow-[0_8px_18px_rgba(255,89,0,0.08)]"
      : "border-transparent font-medium text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)] hover:text-[color:var(--sn-ink)]",
    item.disabled &&
      "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-[color:var(--sn-body)]",
    collapsedDot && "relative"
  );
  const iconClassName = cn(
    "h-[18px] w-[18px] shrink-0",
    isActive ? "text-[color:var(--tlb-orange)]" : "text-[color:var(--sn-ink)]"
  );

  if (!item.href || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={itemClassName}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={iconClassName} />
        {collapsedDot}
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
        {countChip}
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
      <Icon className={iconClassName} />
      {collapsedDot}
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {countChip}
    </Link>
  );
}
