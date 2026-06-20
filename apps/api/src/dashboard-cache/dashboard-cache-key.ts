import type { UserRole } from "@prisma/client";

import type { DashboardPerformanceQuery } from "./dashboard-cache.types";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dashboardPerformanceCacheKey(
  role: UserRole,
  userId: string,
  month: string
) {
  if (!parseMonth(month)) {
    throw new Error("Dashboard cache month must use YYYY-MM format.");
  }

  return `perf_summary:${role.toLowerCase()}:${userId}:${month}`;
}

export function canonicalPerformanceMonth(
  query: DashboardPerformanceQuery,
  now: Date = new Date()
) {
  if (
    hasNormalizedOptionalText(query.vendorId) ||
    hasNormalizedOptionalText(query.chainId) ||
    (query.period !== undefined && query.period !== "THIS_MONTH")
  ) {
    return null;
  }

  const from = parseDate(query.dateFrom);
  const to = parseDate(query.dateTo);
  if (!from || !to || query.dateFrom.slice(0, 7) !== query.dateTo.slice(0, 7)) {
    return null;
  }

  const month = query.dateFrom.slice(0, 7);
  const canonicalRange = canonicalMonthRange(month, now);
  if (!canonicalRange) {
    return null;
  }

  return canonicalRange.dateFrom === query.dateFrom &&
    canonicalRange.dateTo === query.dateTo
    ? month
    : null;
}

export function canonicalMonthRange(month: string, now: Date = new Date()) {
  const parsedMonth = parseMonth(month);
  if (!parsedMonth || Number.isNaN(now.getTime())) {
    return null;
  }

  const currentDate = now.toISOString().slice(0, 10);
  const currentMonth = currentDate.slice(0, 7);
  if (month > currentMonth) {
    return null;
  }

  return {
    dateFrom: `${month}-01`,
    dateTo:
      month === currentMonth
        ? currentDate
        : formatDateOnly(
            new Date(Date.UTC(parsedMonth.year, parsedMonth.month, 0))
          )
  };
}

function parseMonth(monthText: string) {
  const match = MONTH_PATTERN.exec(monthText);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function parseDate(dateText: string) {
  if (!DATE_PATTERN.test(dateText)) {
    return null;
  }

  const date = new Date(`${dateText}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || formatDateOnly(date) !== dateText
    ? null
    : date;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hasNormalizedOptionalText(optionalText: string | undefined) {
  return typeof optionalText === "string" && optionalText.trim().length > 0;
}
