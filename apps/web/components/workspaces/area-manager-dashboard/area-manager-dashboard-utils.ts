import type { AreaManagerPerformanceStatus } from "@/lib/api/area-manager-performance";

export const areaManagerRangeOptions = [
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "LAST_WEEK", label: "Last Week" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "LAST_QUARTER", label: "Last Quarter" }
] as const;

export type AreaManagerRangeKey = (typeof areaManagerRangeOptions)[number]["key"];

export const statusLabels: Record<AreaManagerPerformanceStatus, string> = {
  IN_TARGET: "In Target",
  WATCH: "Watch",
  NEEDS_ACTION: "Needs Action",
  LOW_VOLUME: "Low Volume",
  NO_KPI: "No KPI"
};

export function getAreaManagerDateRange(range: AreaManagerRangeKey) {
  const today = startOfLocalDay(new Date());

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

export function formatEnum(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatIssueShiftCount(value: number | null | undefined) {
  const safeValue = value ?? 0;
  return `${formatNumber(safeValue)} ${
    safeValue === 1 ? "issue shift" : "issue shifts"
  }`;
}

export function statusToneClass(status: AreaManagerPerformanceStatus) {
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
