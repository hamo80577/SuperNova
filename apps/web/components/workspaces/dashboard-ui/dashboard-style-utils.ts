export type DashboardPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME"
  | "NO_KPI";

export type DashboardRankTone =
  | "bronze"
  | "gold"
  | "neutral"
  | "silver"
  | "unranked";

const dashboardStatusLabels: Record<DashboardPerformanceStatus, string> = {
  IN_TARGET: "In Target",
  LOW_VOLUME: "Low Volume",
  NEEDS_ACTION: "Needs Action",
  NO_KPI: "No KPI",
  WATCH: "Watch"
};

export function dashboardStatusLabel(status: DashboardPerformanceStatus) {
  return dashboardStatusLabels[status] ?? status;
}

export function dashboardStatusToneClass(status: DashboardPerformanceStatus) {
  if (status === "IN_TARGET") {
    return "border-[color:var(--sn-success-bg)] bg-[color:var(--sn-success-bg)] text-[color:var(--sn-success)]";
  }

  if (status === "WATCH") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "NEEDS_ACTION") {
    return "border-[color:var(--sn-danger-bg)] bg-[color:var(--sn-danger-bg)] text-[color:var(--sn-danger)]";
  }

  return "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]";
}

export function dashboardStatusBadgeClass(status: DashboardPerformanceStatus) {
  return [
    "inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
    dashboardStatusToneClass(status)
  ].join(" ");
}

export function dashboardRankTone(
  rank: number | null | undefined
): DashboardRankTone {
  if (!rank) return "unranked";
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "neutral";
}

export function dashboardRankToneClass(rank: number | null | undefined) {
  const tone = dashboardRankTone(rank);

  if (tone === "gold") {
    return "border-[#f3c252] bg-[#fff5cf] text-[#8a6500]";
  }

  if (tone === "silver") {
    return "border-[#c8d0d5] bg-[#f2f5f6] text-[#59666f]";
  }

  if (tone === "bronze") {
    return "border-[#e5b18f] bg-[#fff0e5] text-[#98542a]";
  }

  return "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]";
}
