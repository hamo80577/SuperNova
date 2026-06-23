"use client";

import { ShieldCheck } from "lucide-react";
import { useState, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardEmptyState,
  DashboardPerformanceStatusBadge,
  DashboardSectionHeader,
  DashboardUnavailableState
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import {
  formatNumber,
  formatPercent,
  formatShortDate,
  targetBadgeMeta
} from "./area-manager-dashboard-utils";

export function AreaManagerCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <DashboardCard className={className}>{children}</DashboardCard>;
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
    <DashboardSectionHeader action={action} eyebrow={eyebrow} title={title} />
  );
}

export function SectionUnavailable({ message }: { message: string }) {
  return <DashboardUnavailableState message={message} />;
}

export function SectionEmptyState({ message }: { message: string }) {
  return <DashboardEmptyState message={message} />;
}

export function PerformanceStatusBadge({
  status
}: {
  status: Parameters<typeof DashboardPerformanceStatusBadge>[0]["status"];
}) {
  return <DashboardPerformanceStatusBadge status={status} />;
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
        "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold leading-none",
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
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <div className="flex min-w-0 items-center gap-2 text-[color:var(--sn-muted)]">
        {icon}
        <span className="min-w-0 text-[11px] leading-tight sm:text-xs">
          {label}
        </span>
      </div>
      <p className="sn-num mt-2 text-xl text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}

export function TrendLine({
  ariaLabel,
  color,
  points,
  target
}: {
  ariaLabel: string;
  color: string;
  points: Array<{ date: string; value: number | null | undefined }>;
  target?: number | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartWidth = 320;
  const chartHeight = 132;
  const paddingX = 14;
  const paddingY = 16;
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  const yMax = Math.max(
    5,
    Math.ceil((Math.max(...values, target ?? 0, 10) * 1.2) / 5) * 5
  );
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const plottedPoints = points
    .map((point, index) => {
      if (typeof point.value !== "number") return null;

      const x =
        paddingX +
        (points.length <= 1
          ? plotWidth
          : (index / (points.length - 1)) * plotWidth);
      const y =
        paddingY +
        plotHeight -
        (Math.min(point.value, yMax) / yMax) * plotHeight;

      return { ...point, index, value: point.value, x, y };
    })
    .filter(
      (
        point
      ): point is {
        date: string;
        index: number;
        value: number;
        x: number;
        y: number;
      } => Boolean(point)
    );
  const activePoint =
    activeIndex === null
      ? null
      : plottedPoints.find((point) => point.index === activeIndex) ?? null;
  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const targetY =
    target === null || target === undefined
      ? null
      : paddingY + plotHeight - (Math.min(target, yMax) / yMax) * plotHeight;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!plottedPoints.length) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chartWidth;
    const nearestPoint = plottedPoints.reduce((closest, point) =>
      Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest
    );

    setActiveIndex(nearestPoint.index);
  }

  return (
    <div className="relative min-h-[132px] rounded-xl bg-[#fffaf6] px-2 py-1">
      <div
        className={cn(
          "pointer-events-none absolute right-3 top-2 z-10 rounded-lg border border-[color:var(--sn-border)] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[color:var(--sn-ink)] shadow-[0_6px_18px_rgba(65,21,23,0.08)] transition-all duration-150",
          activePoint ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        )}
      >
        {activePoint ? (
          <>
            <span className="text-[color:var(--sn-muted)]">
              {formatShortDate(activePoint.date)}
            </span>{" "}
            {formatPercent(activePoint.value)}
          </>
        ) : null}
      </div>
      <svg
        aria-label={ariaLabel}
        className="h-[120px] w-full touch-pan-y"
        onBlur={() => setActiveIndex(null)}
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={handlePointerMove}
        role="img"
        tabIndex={0}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <line
          stroke="var(--sn-border)"
          strokeWidth="1"
          x1={paddingX}
          x2={chartWidth - paddingX}
          y1={chartHeight - paddingY}
          y2={chartHeight - paddingY}
        />
        {targetY !== null ? (
          <line
            stroke={color}
            strokeDasharray="4 5"
            strokeOpacity="0.5"
            strokeWidth="1.4"
            x1={paddingX}
            x2={chartWidth - paddingX}
            y1={targetY}
            y2={targetY}
          />
        ) : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        ) : null}
        {activePoint ? (
          <line
            stroke={color}
            strokeOpacity="0.25"
            strokeWidth="1"
            x1={activePoint.x}
            x2={activePoint.x}
            y1={paddingY}
            y2={chartHeight - paddingY}
          />
        ) : null}
        {plottedPoints.map((point) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill="white"
            key={`${point.date}-${point.index}`}
            r={activePoint?.index === point.index ? 4.8 : 3.3}
            stroke={color}
            strokeWidth={activePoint?.index === point.index ? 2.6 : 2}
          />
        ))}
      </svg>
    </div>
  );
}

export function AttendanceDonut({ value }: { value: number | null | undefined }) {
  const percent = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div
      aria-label={`Attendance health ${formatPercent(value)}`}
      className="relative grid h-[104px] w-[104px] place-items-center rounded-full"
      role="img"
      style={{
        background: `conic-gradient(var(--sn-success) ${percent * 3.6}deg, #f1ece4 0deg)`
      }}
    >
      <div className="grid h-[66px] w-[66px] place-items-center rounded-full bg-white text-[color:var(--sn-success)] shadow-inner">
        <ShieldCheck className="h-6 w-6" />
      </div>
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
