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
          "border-[oklch(0.85_0.08_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
        status === "PENDING_APPROVAL" &&
          "border-[oklch(0.85_0.08_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]",
        status === "REJECTED" &&
          "border-[oklch(0.85_0.1_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]",
        status === "CANCELLED" &&
          "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
      )}
      variant="outline"
    >
      {deductionCaseStatusLabels[status]}
    </Badge>
  );
}
