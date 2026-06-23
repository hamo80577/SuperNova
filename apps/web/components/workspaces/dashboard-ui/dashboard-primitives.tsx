"use client";

import { AlertTriangle, Inbox, Medal } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  dashboardRankTone,
  dashboardRankToneClass,
  dashboardStatusBadgeClass,
  dashboardStatusLabel,
  type DashboardPerformanceStatus
} from "./dashboard-style-utils";

export function DashboardCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[16px] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function DashboardSectionHeader({
  action,
  eyebrow,
  title
}: {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[color:var(--sn-border)] px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
          {title}
        </h2>
        {eyebrow ? (
          <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">
            {eyebrow}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function DashboardSectionFooter({
  action,
  children
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[color:var(--sn-border)] px-4 py-2.5 text-xs text-[color:var(--sn-muted)] sm:flex-row sm:items-center sm:justify-between">
      <span>{children}</span>
      {action}
    </div>
  );
}

export function DashboardUnavailableState({ message }: { message: string }) {
  return (
    <div className="grid min-h-[112px] place-items-center rounded-xl border border-dashed border-[color:var(--sn-border)] bg-[#fbf9f5] p-4 text-center">
      <div className="grid justify-items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-[color:var(--sn-muted)]" />
        <p className="max-w-sm text-sm leading-6 text-[color:var(--sn-muted)]">
          {message}
        </p>
      </div>
    </div>
  );
}

export function DashboardEmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-[112px] place-items-center p-4 text-center">
      <div className="grid justify-items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]">
          <Inbox className="h-4 w-4" />
        </span>
        <p className="max-w-sm text-sm leading-6 text-[color:var(--sn-muted)]">
          {message}
        </p>
      </div>
    </div>
  );
}

export function DashboardPerformanceStatusBadge({
  status
}: {
  status: DashboardPerformanceStatus;
}) {
  return (
    <span
      className={dashboardStatusBadgeClass(status)}
    >
      {dashboardStatusLabel(status)}
    </span>
  );
}

export function DashboardRankMark({
  className,
  compact = false,
  rank
}: {
  className?: string;
  compact?: boolean;
  rank: number | null | undefined;
}) {
  const tone = dashboardRankTone(rank);
  const ranked = Boolean(rank);
  const topThree = ranked && rank! <= 3;

  return (
    <span
      aria-label={ranked ? `Rank ${rank}` : "Not ranked"}
      className={cn(
        "sn-mono inline-grid shrink-0 place-items-center rounded-full border font-semibold",
        compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm",
        dashboardRankToneClass(rank),
        className
      )}
    >
      {topThree ? (
        <span className="flex items-center gap-0.5">
          <Medal
            className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
            fill={tone === "gold" ? "currentColor" : "none"}
            strokeWidth={1.8}
          />
          <span>{rank}</span>
        </span>
      ) : (
        (rank ?? "-")
      )}
    </span>
  );
}

export function DashboardMetricGrid({
  children,
  columns = 3,
  className
}: {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  const columnClassName =
    columns === 4
      ? "grid-cols-4"
      : columns === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div
      className={cn(
        "grid divide-x divide-[color:var(--sn-border)] border-t border-[color:var(--sn-border)] pt-2",
        columnClassName,
        className
      )}
    >
      {children}
    </div>
  );
}

export function DashboardMetricItem({
  icon,
  label,
  value
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0">
      <p className="flex min-w-0 items-center gap-1 truncate text-[10px] font-medium text-[color:var(--sn-muted)]">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="sn-mono mt-0.5 truncate text-sm font-semibold text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}
