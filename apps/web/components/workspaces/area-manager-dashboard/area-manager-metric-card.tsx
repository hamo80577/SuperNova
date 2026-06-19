"use client";

import { AlertTriangle, Inbox, Info } from "lucide-react";
import type { ReactNode } from "react";

import type { AreaManagerPerformanceStatus } from "@/lib/api/area-manager-performance";
import { cn } from "@/lib/utils";
import {
  formatNumber,
  formatPercent,
  statusLabels,
  statusToneClass,
  targetBadgeMeta
} from "./area-manager-dashboard-utils";

export function AreaManagerCard({
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

export function CardTitle({
  eyebrow,
  title
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
        {title}
      </h2>
      {eyebrow ? (
        <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">{eyebrow}</p>
      ) : null}
    </div>
  );
}

export function SectionHeader({
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
      <CardTitle eyebrow={eyebrow} title={title} />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionUnavailable({ message }: { message: string }) {
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

export function SectionEmptyState({ message }: { message: string }) {
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

export function InfoPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[color:var(--sn-border)] bg-[#fbf9f5] px-2.5 text-xs font-semibold text-[color:var(--sn-muted)]">
      <Info className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function PerformanceStatusBadge({
  status
}: {
  status: AreaManagerPerformanceStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        statusToneClass(status)
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export function TargetBadge({
  status
}: {
  status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET" | undefined;
}) {
  const meta = targetBadgeMeta(status);

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

export function MetricFootnote({
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
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[color:var(--sn-muted)]">
        {icon ? <span className="shrink-0 text-[color:var(--tlb-orange)]">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="sn-mono mt-1 text-base font-semibold text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}

export function TrendLine({
  ariaLabel,
  color = "#ff5900",
  maxValue,
  points,
  target
}: {
  ariaLabel: string;
  color?: string;
  maxValue?: number;
  points: Array<{ date: string; value: number | null | undefined }>;
  target?: number | null;
}) {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  const chartMax = Math.max(maxValue ?? 0, target ?? 0, ...values, 10);
  const width = 260;
  const height = 118;
  const paddingX = 12;
  const paddingY = 16;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const x =
      points.length <= 1
        ? width / 2
        : paddingX + (index / (points.length - 1)) * innerWidth;
    const y =
      paddingY +
      innerHeight -
      ((point.value ?? 0) / chartMax) * innerHeight;

    return { ...point, x, y };
  });
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const targetY =
    typeof target === "number"
      ? paddingY + innerHeight - (target / chartMax) * innerHeight
      : null;

  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-[#fbf9f5] px-2 py-2">
      <svg aria-label={ariaLabel} className="h-[132px] w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line
          stroke="rgba(65,21,23,0.08)"
          strokeWidth="1"
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingY}
          y2={height - paddingY}
        />
        {targetY !== null ? (
          <line
            stroke="rgba(255,89,0,0.35)"
            strokeDasharray="4 4"
            strokeWidth="1.4"
            x1={paddingX}
            x2={width - paddingX}
            y1={targetY}
            y2={targetY}
          />
        ) : null}
        {coordinates.length > 1 ? (
          <polyline
            fill="none"
            points={linePoints}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        ) : null}
        {coordinates.map((point) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill="white"
            key={`${point.date}-${point.x}`}
            r="3.4"
            stroke={color}
            strokeWidth="2"
          >
            <title>
              {point.date}: {formatPercent(point.value)}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function AttendanceDonut({ value }: { value: number | null | undefined }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0));
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const dash = (safeValue / 100) * circumference;

  return (
    <div className="relative grid h-[112px] w-[112px] place-items-center">
      <svg className="h-[112px] w-[112px] -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke="var(--sn-sunken)"
          strokeWidth="12"
        />
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke="var(--sn-success)"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <span className="sn-mono absolute text-sm font-semibold text-[color:var(--sn-ink)]">
        {formatPercent(value)}
      </span>
    </div>
  );
}

export function StatPair({
  label,
  value
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-[#fbf9f5] p-3">
      <p className="truncate text-[11px] font-medium text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="sn-mono mt-1 text-base font-semibold text-[color:var(--sn-ink)]">
        {typeof value === "number" ? formatNumber(value) : value ?? "-"}
      </p>
    </div>
  );
}
