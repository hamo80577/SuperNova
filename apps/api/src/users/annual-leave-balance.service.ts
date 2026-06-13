import { Inject, Injectable } from "@nestjs/common";
import { AttendanceImportBatchStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

// Annual Leave Balance V1 — computed (never stored). Picker/Champ only.
export const ANNUAL_LEAVE_RATE_PER_MONTH = 1.75;
export const ANNUAL_LEAVE_CARRYOVER_CAP_DAYS = 7;
export const ANNUAL_LEAVE_ELIGIBILITY_MONTHS = 3;

const NOT_ELIGIBLE_MESSAGE =
  "Not eligible for annual leave yet. Eligible after completing 3 months.";

export type AnnualLeaveEligibilityStatus =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NOT_APPLICABLE"
  | "MISSING_JOINING_DATE";

export interface AnnualLeaveBalance {
  year: number;
  asOfDate: string;
  joiningDate: string | null;
  role: UserRole;
  eligibilityStatus: AnnualLeaveEligibilityStatus;
  eligibleFrom: string | null;
  carriedBalanceDays: number;
  currentYearAccruedDays: number;
  accruedPreviewDays: number;
  annualTakenThisYear: number;
  remainingDays: number | null;
  attendanceCoverageFrom: string | null;
  attendanceCoverageTo: string | null;
  message: string;
}

export interface AnnualLeaveUser {
  id: string;
  role: UserRole;
  joiningDate: Date | null;
}

export interface AnnualLeaveComputeInput {
  role: UserRole;
  joiningDate: Date;
  asOf: Date;
  annualTakenThisYear: number;
  attendanceCoverageFrom: Date | null;
  attendanceCoverageTo: Date | null;
}

@Injectable()
export class AnnualLeaveBalanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getForUser(
    user: AnnualLeaveUser,
    asOf: Date = new Date()
  ): Promise<AnnualLeaveBalance> {
    if (user.role !== UserRole.PICKER && user.role !== UserRole.CHAMP) {
      return emptyBalance(
        user.role,
        asOf,
        null,
        "NOT_APPLICABLE",
        "Annual leave is calculated for Pickers and Champs only."
      );
    }

    if (!user.joiningDate) {
      return emptyBalance(
        user.role,
        asOf,
        null,
        "MISSING_JOINING_DATE",
        "Joining date is not set, so annual leave cannot be calculated."
      );
    }

    const year = asOf.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const asOfEnd = new Date(
      Date.UTC(
        asOf.getUTCFullYear(),
        asOf.getUTCMonth(),
        asOf.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    const [annualTakenThisYear, coverage] = await Promise.all([
      this.countAnnualLeaveDays(user.id, yearStart, asOfEnd),
      this.getActiveCoverage(user.id)
    ]);

    return computeAnnualLeaveBalance({
      role: user.role,
      joiningDate: user.joiningDate,
      asOf,
      annualTakenThisYear,
      attendanceCoverageFrom: coverage.from,
      attendanceCoverageTo: coverage.to
    });
  }

  // Distinct annual-leave shift days in [from, to] from ACTIVE batches only.
  private async countAnnualLeaveDays(userId: string, from: Date, to: Date) {
    const records = await this.prisma.attendanceDailyRecord.findMany({
      where: {
        userId,
        isAnnualLeave: true,
        shiftDate: { gte: from, lte: to },
        importBatch: { is: { status: AttendanceImportBatchStatus.ACTIVE } }
      },
      select: { shiftDate: true }
    });

    const distinctDays = new Set(
      records.map((record) => record.shiftDate.toISOString().slice(0, 10))
    );
    return distinctDays.size;
  }

  private async getActiveCoverage(userId: string) {
    const coverage = await this.prisma.attendanceDailyRecord.aggregate({
      where: {
        userId,
        importBatch: { is: { status: AttendanceImportBatchStatus.ACTIVE } }
      },
      _min: { shiftDate: true },
      _max: { shiftDate: true }
    });

    return {
      from: coverage._min.shiftDate ?? null,
      to: coverage._max.shiftDate ?? null
    };
  }
}

// Pure calculation — all time inputs are interpreted in UTC so results are
// deterministic regardless of server timezone.
export function computeAnnualLeaveBalance(
  input: AnnualLeaveComputeInput
): AnnualLeaveBalance {
  const { role, joiningDate, asOf, annualTakenThisYear } = input;
  const year = asOf.getUTCFullYear();
  const joinIdx = monthIndex(joiningDate);
  const asOfIdx = monthIndex(asOf);
  const janIdx = year * 12;

  // Joining month counts as month 0; eligible after completing 3 months (month 4+).
  const monthsElapsed = asOfIdx - joinIdx;
  const eligible = monthsElapsed >= ANNUAL_LEAVE_ELIGIBILITY_MONTHS;
  const eligibleFrom = formatMonthStart(
    joinIdx + ANNUAL_LEAVE_ELIGIBILITY_MONTHS
  );

  // Current-year accrual back-credits from the joining month (or Jan of the
  // selected year), through the current/asOf month.
  const accrualStartIdx = Math.max(joinIdx, janIdx);
  const currentYearMonths = Math.max(0, asOfIdx - accrualStartIdx + 1);
  const currentYearAccruedDays = round2(
    currentYearMonths * ANNUAL_LEAVE_RATE_PER_MONTH
  );

  let carriedBalanceDays = 0;
  if (joiningDate.getUTCFullYear() < year) {
    const prevYear = year - 1;
    const prevJanIdx = prevYear * 12;
    const prevDecIdx = prevYear * 12 + 11;
    const prevStartIdx = Math.max(joinIdx, prevJanIdx);
    const previousYearMonths = Math.max(0, prevDecIdx - prevStartIdx + 1);
    carriedBalanceDays = round2(
      Math.min(
        previousYearMonths * ANNUAL_LEAVE_RATE_PER_MONTH,
        ANNUAL_LEAVE_CARRYOVER_CAP_DAYS
      )
    );
  }

  const accruedPreviewDays = currentYearAccruedDays;
  const remainingDays = eligible
    ? round2(carriedBalanceDays + currentYearAccruedDays - annualTakenThisYear)
    : null;

  return {
    year,
    asOfDate: formatDateOnly(asOf),
    joiningDate: formatDateOnly(joiningDate),
    role,
    eligibilityStatus: eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
    eligibleFrom,
    carriedBalanceDays,
    currentYearAccruedDays,
    accruedPreviewDays,
    annualTakenThisYear,
    remainingDays,
    attendanceCoverageFrom: input.attendanceCoverageFrom
      ? formatDateOnly(input.attendanceCoverageFrom)
      : null,
    attendanceCoverageTo: input.attendanceCoverageTo
      ? formatDateOnly(input.attendanceCoverageTo)
      : null,
    message: eligible
      ? `Accrued at ${ANNUAL_LEAVE_RATE_PER_MONTH} days per month from the joining month, calculated through ${formatMonthLabel(asOf)}.`
      : NOT_ELIGIBLE_MESSAGE
  };
}

function emptyBalance(
  role: UserRole,
  asOf: Date,
  joiningDate: string | null,
  eligibilityStatus: AnnualLeaveEligibilityStatus,
  message: string
): AnnualLeaveBalance {
  return {
    year: asOf.getUTCFullYear(),
    asOfDate: formatDateOnly(asOf),
    joiningDate,
    role,
    eligibilityStatus,
    eligibleFrom: null,
    carriedBalanceDays: 0,
    currentYearAccruedDays: 0,
    accruedPreviewDays: 0,
    annualTakenThisYear: 0,
    remainingDays: null,
    attendanceCoverageFrom: null,
    attendanceCoverageTo: null,
    message
  };
}

function monthIndex(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function formatMonthStart(idx: number) {
  const year = Math.floor(idx / 12);
  const month = idx % 12;
  return formatDateOnly(new Date(Date.UTC(year, month, 1)));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
