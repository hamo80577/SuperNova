import "reflect-metadata";

import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import {
  AnnualLeaveBalanceService,
  computeAnnualLeaveBalance
} from "../src/users/annual-leave-balance.service";

function d(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function compute(overrides: {
  role?: UserRole;
  joiningDate: Date;
  asOf: Date;
  annualTakenThisYear?: number;
}) {
  return computeAnnualLeaveBalance({
    role: overrides.role ?? UserRole.PICKER,
    joiningDate: overrides.joiningDate,
    asOf: overrides.asOf,
    annualTakenThisYear: overrides.annualTakenThisYear ?? 0,
    attendanceCoverageFrom: null,
    attendanceCoverageTo: null
  });
}

// A prisma mock where attendance records carry a batchStatus flag to simulate
// the ACTIVE-batch relation filter.
function prismaWith(
  records: Array<{
    userId: string;
    shiftDate: Date;
    isAnnualLeave: boolean;
    batchStatus: string;
  }>
) {
  return {
    attendanceDailyRecord: {
      findMany: async ({
        where
      }: {
        where: {
          userId: string;
          shiftDate?: { gte?: Date; lte?: Date };
        };
      }) => {
        const gte = where.shiftDate?.gte;
        const lte = where.shiftDate?.lte;
        return records
          .filter(
            (record) =>
              record.userId === where.userId &&
              record.isAnnualLeave === true &&
              record.batchStatus === "ACTIVE" &&
              (!gte || record.shiftDate >= gte) &&
              (!lte || record.shiftDate <= lte)
          )
          .map((record) => ({ shiftDate: record.shiftDate }));
      },
      aggregate: async ({ where }: { where: { userId: string } }) => {
        const active = records.filter(
          (record) =>
            record.userId === where.userId && record.batchStatus === "ACTIVE"
        );
        const times = active.map((record) => record.shiftDate.getTime());
        return {
          _min: { shiftDate: times.length ? new Date(Math.min(...times)) : null },
          _max: { shiftDate: times.length ? new Date(Math.max(...times)) : null }
        };
      }
    }
  };
}

async function run() {
  // Picker, joined current year, eligible: accrual Jan..Jun = 6 * 1.75.
  {
    const balance = compute({
      joiningDate: d("2026-01-10"),
      asOf: d("2026-06-15")
    });
    assert.equal(balance.eligibilityStatus, "ELIGIBLE");
    assert.equal(balance.role, UserRole.PICKER);
    assert.equal(balance.carriedBalanceDays, 0);
    assert.equal(balance.currentYearAccruedDays, 10.5);
    assert.equal(balance.accruedPreviewDays, 10.5);
    assert.equal(balance.remainingDays, 10.5);
    assert.equal(balance.year, 2026);
  }

  // Champ: same math, role carried through.
  {
    const balance = compute({
      role: UserRole.CHAMP,
      joiningDate: d("2026-01-10"),
      asOf: d("2026-06-15"),
      annualTakenThisYear: 2
    });
    assert.equal(balance.eligibilityStatus, "ELIGIBLE");
    assert.equal(balance.role, UserRole.CHAMP);
    assert.equal(balance.remainingDays, 8.5); // 10.5 - 2
  }

  // Less than 3 months => NOT_ELIGIBLE; remaining null; preview still shown.
  {
    const balance = compute({
      joiningDate: d("2026-04-10"),
      asOf: d("2026-06-15")
    });
    assert.equal(balance.eligibilityStatus, "NOT_ELIGIBLE");
    assert.equal(balance.remainingDays, null);
    assert.equal(balance.eligibleFrom, "2026-07-01");
    assert.equal(balance.accruedPreviewDays, 5.25); // Apr,May,Jun = 3 * 1.75
  }

  // After 3 months eligible, accrual starts from the joining month (not month 4):
  // joined Jan, asOf Apr => Jan..Apr = 4 * 1.75 = 7.
  {
    const balance = compute({
      joiningDate: d("2026-01-10"),
      asOf: d("2026-04-15")
    });
    assert.equal(balance.eligibilityStatus, "ELIGIBLE");
    assert.equal(balance.currentYearAccruedDays, 7);
  }

  // Current-year accrual only up to the current month (joined previous year).
  {
    const balance = compute({
      joiningDate: d("2025-06-01"),
      asOf: d("2026-06-15")
    });
    assert.equal(balance.currentYearAccruedDays, 10.5); // Jan..Jun = 6 months
  }

  // Carryover capped at 7 (joined two years earlier).
  {
    const balance = compute({
      joiningDate: d("2024-01-10"),
      asOf: d("2026-06-15")
    });
    assert.equal(balance.carriedBalanceDays, 7); // min(12 * 1.75, 7)
  }

  // Joined November of the previous year => 2 * 1.75 = 3.5 carryover.
  {
    const balance = compute({
      joiningDate: d("2025-11-05"),
      asOf: d("2026-06-15")
    });
    assert.equal(balance.carriedBalanceDays, 3.5);
  }

  // Area Manager / Admin => NOT_APPLICABLE (no card).
  {
    const service = new AnnualLeaveBalanceService(prismaWith([]) as never);
    const balance = await service.getForUser(
      { id: "am-1", role: UserRole.AREA_MANAGER, joiningDate: d("2024-01-01") },
      d("2026-06-15")
    );
    assert.equal(balance.eligibilityStatus, "NOT_APPLICABLE");
    assert.equal(balance.remainingDays, null);
    assert.equal(balance.joiningDate, null);
  }

  // Missing joiningDate => MISSING_JOINING_DATE; balance is not faked.
  {
    const service = new AnnualLeaveBalanceService(prismaWith([]) as never);
    const balance = await service.getForUser(
      { id: "picker-1", role: UserRole.PICKER, joiningDate: null },
      d("2026-06-15")
    );
    assert.equal(balance.eligibilityStatus, "MISSING_JOINING_DATE");
    assert.equal(balance.joiningDate, null);
    assert.equal(balance.remainingDays, null);
  }

  // Annual taken counts DISTINCT shift days from ACTIVE batches only.
  {
    const records = [
      { userId: "u1", shiftDate: d("2026-03-05"), isAnnualLeave: true, batchStatus: "ACTIVE" },
      { userId: "u1", shiftDate: d("2026-03-06"), isAnnualLeave: true, batchStatus: "ACTIVE" },
      // same day, but a REPLACED batch -> must not count
      { userId: "u1", shiftDate: d("2026-03-05"), isAnnualLeave: true, batchStatus: "REPLACED" },
      // ACTIVE but not annual leave -> not counted as taken (still counts for coverage)
      { userId: "u1", shiftDate: d("2026-04-10"), isAnnualLeave: false, batchStatus: "ACTIVE" },
      // annual leave but REPLACED -> not counted
      { userId: "u1", shiftDate: d("2026-05-01"), isAnnualLeave: true, batchStatus: "REPLACED" },
      // different user -> ignored
      { userId: "other", shiftDate: d("2026-03-07"), isAnnualLeave: true, batchStatus: "ACTIVE" }
    ];
    const service = new AnnualLeaveBalanceService(prismaWith(records) as never);
    const balance = await service.getForUser(
      { id: "u1", role: UserRole.PICKER, joiningDate: d("2025-01-01") },
      d("2026-06-15")
    );

    assert.equal(balance.eligibilityStatus, "ELIGIBLE");
    assert.equal(balance.annualTakenThisYear, 2); // Mar 5 + Mar 6, distinct, ACTIVE only
    assert.equal(balance.carriedBalanceDays, 7); // min(12 * 1.75, 7)
    assert.equal(balance.currentYearAccruedDays, 10.5); // Jan..Jun
    assert.equal(balance.remainingDays, 15.5); // 7 + 10.5 - 2
    assert.equal(balance.attendanceCoverageFrom, "2026-03-05");
    assert.equal(balance.attendanceCoverageTo, "2026-04-10");
  }
}

void run();
