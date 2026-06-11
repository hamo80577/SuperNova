import {
  deductionCaseStatusLabels,
  type DeductionCaseStatus
} from "@/lib/api/deductions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatOrdinal(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

export function formatDeductionDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  // A bare 'YYYY-MM-DD' string parses as UTC midnight, which renders as the
  // previous calendar day in negative-UTC zones. Build a local-time date from
  // the Y/M/D parts so the calendar date is shown as-is.
  const dateOnly = DATE_ONLY_PATTERN.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function DeductionStatusBadge({
  status
}: {
  status: DeductionCaseStatus;
}) {
  return (
    <Badge
      className={cn(
        status === "EFFECTIVE" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "PENDING_APPROVAL" &&
          "border-amber-200 bg-amber-50 text-amber-700",
        status === "REJECTED" && "border-rose-200 bg-rose-50 text-rose-700",
        status === "CANCELLED" && "border-slate-200 bg-slate-50 text-slate-600"
      )}
      variant="outline"
    >
      {deductionCaseStatusLabels[status]}
    </Badge>
  );
}
