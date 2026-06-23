import type { AdminPerformanceStatus } from "@/lib/api/admin-performance";

export const adminDashboardRangeOptions = [
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "LAST_WEEK", label: "Last Week" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "LAST_QUARTER", label: "Last Quarter" }
] as const;

export type AdminDashboardRangeKey =
  (typeof adminDashboardRangeOptions)[number]["key"];

export type AdminDashboardBranchOption = {
  chainId: string;
  chainName: string;
  vendorId: string;
  vendorName: string;
};

export const statusLabels: Record<AdminPerformanceStatus, string> = {
  IN_TARGET: "In Target",
  WATCH: "Watch",
  NEEDS_ACTION: "Needs Action",
  LOW_VOLUME: "Low Volume",
  NO_KPI: "No KPI"
};

export function getAdminDashboardDateRange(
  range: AdminDashboardRangeKey,
  now = new Date()
) {
  const today = startOfLocalDay(now);

  if (range === "YESTERDAY") {
    const yesterday = addLocalDays(today, -1);
    return {
      dateFrom: toDateOnly(yesterday),
      dateTo: toDateOnly(yesterday)
    };
  }

  if (range === "LAST_WEEK") {
    const dateTo = addLocalDays(today, -1);
    return {
      dateFrom: toDateOnly(addLocalDays(dateTo, -6)),
      dateTo: toDateOnly(dateTo)
    };
  }

  if (range === "LAST_QUARTER") {
    const currentQuarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const dateFrom = new Date(today.getFullYear(), currentQuarterStartMonth - 3, 1);
    const dateTo = new Date(today.getFullYear(), currentQuarterStartMonth, 0);

    return {
      dateFrom: toDateOnly(dateFrom),
      dateTo: toDateOnly(dateTo)
    };
  }

  return {
    dateFrom: toDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
    dateTo: toDateOnly(today)
  };
}

export function getFilteredBranchOptions(
  branches: AdminDashboardBranchOption[],
  chainId: string | undefined
) {
  if (!chainId) {
    return branches;
  }

  return branches.filter((branch) => branch.chainId === chainId);
}

export function getNextBranchIdForChain({
  branches,
  currentVendorId,
  nextChainId
}: {
  branches: AdminDashboardBranchOption[];
  currentVendorId: string | undefined;
  nextChainId: string | undefined;
}) {
  if (!currentVendorId || !nextChainId) {
    return currentVendorId;
  }

  const currentBranch = branches.find(
    (branch) => branch.vendorId === currentVendorId
  );

  return currentBranch?.chainId === nextChainId ? currentVendorId : undefined;
}

export function getScopeLabel(chainId?: string, vendorId?: string) {
  if (vendorId) {
    return "Selected Branch";
  }

  if (chainId) {
    return "Selected Chain";
  }

  return "Global";
}

export function getVisibleRankingRows<T>(rows: T[], limit: number) {
  return rows.slice(0, limit);
}

export function formatDateRangeLabel(dateFrom: string, dateTo: string) {
  return `${formatShortDate(dateFrom)} - ${formatShortDate(dateTo)}`;
}

export function formatShortDate(value: string | undefined) {
  if (!value) return "";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function statusToneClass(status: AdminPerformanceStatus) {
  if (status === "IN_TARGET") {
    return "border-[color:var(--sn-success-bg)] bg-[color:var(--sn-success-bg)] text-[color:var(--sn-success)]";
  }

  if (status === "WATCH" || status === "LOW_VOLUME") {
    return "border-[color:var(--sn-warn-bg)] bg-[color:var(--sn-warn-bg)] text-[color:var(--sn-warn)]";
  }

  if (status === "NEEDS_ACTION") {
    return "border-[color:var(--sn-danger-bg)] bg-[color:var(--sn-danger-bg)] text-[color:var(--sn-danger)]";
  }

  return "border-[color:var(--sn-sunken)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]";
}

export function targetBadgeMeta(
  status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET" | undefined
) {
  if (status === "IN_TARGET") {
    return {
      label: "In Target",
      className:
        "border-[color:var(--sn-success-bg)] bg-[color:var(--sn-success-bg)] text-[color:var(--sn-success)]"
    };
  }

  if (status === "OUT_OF_TARGET") {
    return {
      label: "Out of Target",
      className:
        "border-[color:var(--sn-danger-bg)] bg-[color:var(--sn-danger-bg)] text-[color:var(--sn-danger)]"
    };
  }

  return {
    label: "No Target",
    className:
      "border-[color:var(--sn-sunken)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
  };
}

export function uhoToneClass(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "sn-mono font-semibold text-[color:var(--sn-muted)]";
  }

  if (value <= 8) {
    return "sn-mono font-semibold text-[color:var(--sn-success)]";
  }

  if (value <= 12) {
    return "sn-mono font-semibold text-[color:var(--sn-warn)]";
  }

  return "sn-mono font-semibold text-[color:var(--sn-danger)]";
}

export function healthToneClass(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "sn-mono font-semibold text-[color:var(--sn-muted)]";
  }

  if (value >= 85) {
    return "sn-mono font-semibold text-[color:var(--sn-success)]";
  }

  if (value >= 70) {
    return "sn-mono font-semibold text-[color:var(--sn-warn)]";
  }

  return "sn-mono font-semibold text-[color:var(--sn-danger)]";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
