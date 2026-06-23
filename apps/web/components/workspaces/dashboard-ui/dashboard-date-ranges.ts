export type ClosedDailyDashboardRange =
  | "LAST_QUARTER"
  | "LAST_WEEK"
  | "THIS_MONTH"
  | "THIS_QUARTER"
  | "YESTERDAY";

export interface DashboardDateRange {
  dateFrom: string;
  dateTo: string;
}

export function getClosedDailyDashboardDateRange(
  range: ClosedDailyDashboardRange,
  now = new Date()
): DashboardDateRange {
  const today = startOfLocalDay(now);
  const lastClosedDay = addLocalDays(today, -1);

  if (range === "YESTERDAY") {
    return sameDayRange(lastClosedDay);
  }

  if (range === "LAST_WEEK") {
    return {
      dateFrom: toDateOnly(addLocalDays(lastClosedDay, -6)),
      dateTo: toDateOnly(lastClosedDay)
    };
  }

  if (range === "LAST_QUARTER") {
    const currentQuarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const dateFrom = new Date(
      today.getFullYear(),
      currentQuarterStartMonth - 3,
      1
    );
    const dateTo = new Date(today.getFullYear(), currentQuarterStartMonth, 0);

    return {
      dateFrom: toDateOnly(dateFrom),
      dateTo: toDateOnly(dateTo)
    };
  }

  if (range === "THIS_QUARTER") {
    const currentClosedQuarterStartMonth =
      Math.floor(lastClosedDay.getMonth() / 3) * 3;

    return {
      dateFrom: toDateOnly(
        new Date(lastClosedDay.getFullYear(), currentClosedQuarterStartMonth, 1)
      ),
      dateTo: toDateOnly(lastClosedDay)
    };
  }

  return {
    dateFrom: toDateOnly(
      new Date(lastClosedDay.getFullYear(), lastClosedDay.getMonth(), 1)
    ),
    dateTo: toDateOnly(lastClosedDay)
  };
}

function sameDayRange(date: Date): DashboardDateRange {
  const dateOnly = toDateOnly(date);

  return {
    dateFrom: dateOnly,
    dateTo: dateOnly
  };
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
