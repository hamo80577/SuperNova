export type AttendanceRangeBoundary = "start" | "end";
export type AttendanceQuickRange = "yesterday" | "lastWeek" | "thisMonth";

export interface AttendanceDateRangeValue {
  dateFrom: string;
  dateTo: string;
}

export interface AttendanceRangeSelectionInput {
  activeBoundary: AttendanceRangeBoundary;
  currentRange: AttendanceDateRangeValue;
  selectedDate: string;
}

export interface AttendanceRangeSelectionResult {
  activeBoundary: AttendanceRangeBoundary;
  apply: boolean;
  range: AttendanceDateRangeValue;
}

export function getAttendanceQuickRange(
  value: AttendanceQuickRange,
  maxDate = yesterdayIsoDate()
): AttendanceDateRangeValue {
  if (value === "lastWeek") {
    return {
      dateFrom: addDaysIso(maxDate, -6),
      dateTo: maxDate
    };
  }

  if (value === "thisMonth") {
    return {
      dateFrom: `${maxDate.slice(0, 7)}-01`,
      dateTo: maxDate
    };
  }

  return {
    dateFrom: maxDate,
    dateTo: maxDate
  };
}

export function getNextAttendanceRangeSelection({
  activeBoundary,
  currentRange,
  selectedDate
}: AttendanceRangeSelectionInput): AttendanceRangeSelectionResult {
  if (activeBoundary === "start") {
    return {
      activeBoundary: "end",
      apply: false,
      range: {
        dateFrom: selectedDate,
        dateTo: selectedDate
      }
    };
  }

  return {
    activeBoundary: "end",
    apply: true,
    range: {
      dateFrom: currentRange.dateFrom,
      dateTo:
        selectedDate < currentRange.dateFrom ? currentRange.dateFrom : selectedDate
    }
  };
}

export function normalizeAttendanceDateRange(
  dateFrom: string,
  dateTo: string,
  fallback = yesterdayIsoDate()
): AttendanceDateRangeValue {
  const start = isIsoDate(dateFrom) ? dateFrom : isIsoDate(dateTo) ? dateTo : fallback;
  const end = isIsoDate(dateTo) ? dateTo : start;

  return { dateFrom: start, dateTo: end };
}

export function validateAttendanceDateRange(
  dateFrom: string,
  dateTo: string,
  maxDate = yesterdayIsoDate()
) {
  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return "Select a valid start and end date.";
  }

  if (dateFrom > dateTo) {
    return "Start date must be before end date.";
  }

  if (dateFrom > maxDate || dateTo > maxDate) {
    return "Today and future dates are not available.";
  }

  return null;
}

export function getAttendanceRangeLength(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function yesterdayIsoDate() {
  return addDaysIso(todayIsoDate(), -1);
}

export function todayIsoDate() {
  return formatIsoDate(new Date());
}

export function addDaysIso(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatRangeInputDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

export function formatDateLong(value: string) {
  const date = parseIsoDate(value);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
