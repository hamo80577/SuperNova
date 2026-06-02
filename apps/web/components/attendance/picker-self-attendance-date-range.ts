export interface PickerAttendanceDateRange {
  dateFrom: string;
  dateTo: string;
  maxDate: string;
}

export function normalizePickerAttendanceDateRange({
  dateFrom,
  dateTo,
  maxDate
}: PickerAttendanceDateRange) {
  const safeDateFrom = minIsoDate(dateFrom, maxDate);
  const dateToMax = getPickerAttendanceDateToMax(safeDateFrom, maxDate);
  let safeDateTo = dateTo;

  if (!isSameIsoMonth(safeDateFrom, safeDateTo) || safeDateTo > dateToMax) {
    safeDateTo = dateToMax;
  }

  if (safeDateTo < safeDateFrom) {
    safeDateTo = safeDateFrom;
  }

  return {
    dateFrom: safeDateFrom,
    dateTo: safeDateTo
  };
}

export function getPickerAttendanceDateToMax(dateFrom: string, maxDate: string) {
  return minIsoDate(getIsoMonthEnd(dateFrom), maxDate);
}

function isSameIsoMonth(first: string, second: string) {
  return first.slice(0, 7) === second.slice(0, 7);
}

function getIsoMonthEnd(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month, 0);
  return formatIsoDate(date);
}

function minIsoDate(first: string, second: string) {
  return first <= second ? first : second;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
