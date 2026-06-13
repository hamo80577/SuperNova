"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { isActiveHref } from "./dashboard-shell-utils";
import type { DashboardNavSection } from "./dashboard-nav";
import type { NavItem } from "./role-nav";

/**
 * Calm Talabat mobile bottom tab-bar (design: MobilePage bottom nav) — four
 * primary destinations split around a centered orange "new request" FAB.
 * Mobile only; the full role nav stays available via the header drawer.
 */
export function DashboardBottomNav({
  navSections,
  pathname
}: {
  navSections: DashboardNavSection[];
  pathname: string;
}) {
  const tabs = navSections
    .flatMap(([, items]) => items)
    .filter((item): item is NavItem & { href: string } =>
      Boolean(item.href) && !item.disabled
    )
    .slice(0, 4);

  if (tabs.length === 0) {
    return null;
  }

  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2, 4);

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-[color:var(--sn-border)] bg-white lg:hidden"
    >
      <div className="relative flex items-stretch justify-around px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {leftTabs.map((item) => (
          <BottomTab item={item} key={item.label} pathname={pathname} />
        ))}
        <div className="w-14 shrink-0" aria-hidden />
        {rightTabs.map((item) => (
          <BottomTab item={item} key={item.label} pathname={pathname} />
        ))}
        <Link
          aria-label="New request"
          className="absolute -top-5 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-2xl bg-[color:var(--tlb-orange)] text-white shadow-[0_6px_16px_rgba(255,89,0,0.4)] transition active:scale-95"
          href="/tickets"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </div>
    </nav>
  );
}

function BottomTab({
  item,
  pathname
}: {
  item: NavItem & { href: string };
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = isActiveHref(pathname, item.href);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl py-1 text-[10px] font-semibold",
        isActive
          ? "text-[color:var(--tlb-orange)]"
          : "text-[color:var(--sn-faint)]"
      )}
      href={item.href}
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-[64px] truncate">{item.label}</span>
    </Link>
  );
}
