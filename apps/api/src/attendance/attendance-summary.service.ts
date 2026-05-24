import { Injectable } from "@nestjs/common";
import {
  AttendanceArchiveStatus,
  AttendanceMatchedRole
} from "@prisma/client";

import { AttendanceCalculationService } from "./attendance-calculation.service";
import type {
  AttendanceMonthlyBranchSummaryDraft,
  AttendanceMonthlyChainSummaryDraft,
  AttendanceMonthlySummaryBuildResult,
  AttendanceMonthlyUserSummaryDraft,
  AttendanceSummaryRecord
} from "./attendance.types";

@Injectable()
export class AttendanceSummaryService {
  private readonly calculation = new AttendanceCalculationService();

  buildMonthlySummaries(input: {
    records: AttendanceSummaryRecord[];
    periodFrom: Date;
    periodTo: Date;
    referenceDate?: Date;
  }): AttendanceMonthlySummaryBuildResult {
    const referenceDate = input.referenceDate ?? new Date();
    const userSummaries = this.buildUserSummaries(input, referenceDate);
    const branchSummaries = this.buildBranchSummaries(input);
    const chainSummaries = this.buildChainSummaries(input);

    return { userSummaries, branchSummaries, chainSummaries };
  }

  shouldStoreDailyRecords(monthKey: string, referenceDate = new Date()) {
    const currentMonthKey = toMonthKey(referenceDate);
    const previousMonthKey = toMonthKey(
      new Date(
        Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1)
      )
    );

    return monthKey === currentMonthKey || monthKey === previousMonthKey;
  }

  archiveStatusForMonth(monthKey: string, referenceDate = new Date()) {
    return this.shouldStoreDailyRecords(monthKey, referenceDate)
      ? AttendanceArchiveStatus.DETAILED
      : AttendanceArchiveStatus.SUMMARY_ONLY;
  }

  monthKeysBetween(periodFrom: Date, periodTo: Date) {
    const keys: string[] = [];
    let cursor = new Date(
      Date.UTC(periodFrom.getUTCFullYear(), periodFrom.getUTCMonth(), 1)
    );
    const end = new Date(
      Date.UTC(periodTo.getUTCFullYear(), periodTo.getUTCMonth(), 1)
    );

    while (cursor.getTime() <= end.getTime()) {
      keys.push(toMonthKey(cursor));
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
      );
    }

    return keys;
  }

  private buildUserSummaries(
    input: {
      records: AttendanceSummaryRecord[];
      periodFrom: Date;
      periodTo: Date;
    },
    referenceDate: Date
  ): AttendanceMonthlyUserSummaryDraft[] {
    const groups = groupBy(input.records, (record) => `${record.monthKey}:${record.userId}`);

    return Array.from(groups.values()).map((records) => {
      const first = records[0];
      const period = periodForMonth(first.monthKey, input.periodFrom, input.periodTo);
      const totalShiftsNeeded = this.calculation.calculateTotalShiftsNeeded({
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        joiningDate: first.userJoiningDate
      });
      const metricTotals = sumMetrics(records);

      return {
        monthKey: first.monthKey,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        userId: first.userId,
        identifier: first.identifier,
        role: first.role,
        matchKeyType: first.matchKeyType,
        assignmentVendorId:
          first.role === AttendanceMatchedRole.PICKER
            ? first.assignmentVendorId
            : null,
        assignmentChainId:
          first.role === AttendanceMatchedRole.PICKER
            ? first.assignmentChainId
            : null,
        ...metricTotals,
        totalShiftsNeeded,
        totalCreatedShifts: records.length,
        missingShifts: Math.max(0, totalShiftsNeeded - records.length),
        sourceDailyRecordsAvailable: this.shouldStoreDailyRecords(
          first.monthKey,
          referenceDate
        ),
        archiveStatus: this.archiveStatusForMonth(first.monthKey, referenceDate)
      };
    });
  }

  private buildBranchSummaries(input: {
    records: AttendanceSummaryRecord[];
    periodFrom: Date;
    periodTo: Date;
  }): AttendanceMonthlyBranchSummaryDraft[] {
    const records = input.records.filter(
      (record) =>
        record.role === AttendanceMatchedRole.PICKER &&
        record.assignmentVendorId &&
        record.assignmentChainId
    );
    const groups = groupBy(
      records,
      (record) => `${record.monthKey}:${record.assignmentVendorId}`
    );

    return Array.from(groups.values()).map((groupRecords) => {
      const first = groupRecords[0];
      const period = periodForMonth(first.monthKey, input.periodFrom, input.periodTo);
      const shiftCounts = aggregateShiftCounts(groupRecords, period);

      return {
        monthKey: first.monthKey,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        vendorId: first.assignmentVendorId!,
        chainId: first.assignmentChainId!,
        pickerCount: uniqueCount(groupRecords.map((record) => record.userId)),
        ...shiftCounts,
        ...sumMetrics(groupRecords)
      };
    });
  }

  private buildChainSummaries(input: {
    records: AttendanceSummaryRecord[];
    periodFrom: Date;
    periodTo: Date;
  }): AttendanceMonthlyChainSummaryDraft[] {
    const records = input.records.filter(
      (record) =>
        record.role === AttendanceMatchedRole.PICKER && record.assignmentChainId
    );
    const groups = groupBy(
      records,
      (record) => `${record.monthKey}:${record.assignmentChainId}`
    );

    return Array.from(groups.values()).map((groupRecords) => {
      const first = groupRecords[0];
      const period = periodForMonth(first.monthKey, input.periodFrom, input.periodTo);
      const shiftCounts = aggregateShiftCounts(groupRecords, period);

      return {
        monthKey: first.monthKey,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        chainId: first.assignmentChainId!,
        branchCount: uniqueCount(
          groupRecords
            .map((record) => record.assignmentVendorId)
            .filter((value): value is string => value !== null)
        ),
        pickerCount: uniqueCount(groupRecords.map((record) => record.userId)),
        ...shiftCounts,
        ...sumMetrics(groupRecords)
      };
    });
  }
}

export function toMonthKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return groups;
}

function uniqueCount(items: string[]) {
  return new Set(items).size;
}

function periodForMonth(monthKey: string, periodFrom: Date, periodTo: Date) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  return {
    periodFrom: monthStart > periodFrom ? monthStart : startOfUtcDay(periodFrom),
    periodTo: monthEnd < periodTo ? monthEnd : startOfUtcDay(periodTo)
  };
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function sumMetrics(records: AttendanceSummaryRecord[]) {
  return {
    workedShiftCount: records.filter((record) => record.isWorkedShift).length,
    totalWorkedHours: records.reduce(
      (total, record) => total + (record.actualWorkDurationHours ?? 0),
      0
    ),
    lateMinutesTotal: records.reduce(
      (total, record) => total + record.lateMinutes,
      0
    ),
    lateLevel1Over15Count: records.filter((record) => record.lateLevel1Over15)
      .length,
    lateLevel2From31To45Count: records.filter(
      (record) => record.lateLevel2From31To45
    ).length,
    lateLevel3Over45Count: records.filter((record) => record.lateLevel3Over45)
      .length,
    absentCount: records.filter((record) => record.isAbsent).length,
    onLeaveCount: records.filter((record) => record.isOnLeave).length,
    annualLeaveCount: records.filter((record) => record.isAnnualLeave).length,
    medicalLeaveCount: records.filter((record) => record.isMedicalLeave).length,
    offDayCount: records.filter((record) => record.isOffDay).length,
    under8HoursCount: records.filter((record) => record.isUnder8Hours).length,
    over15HoursCount: records.filter((record) => record.isOver15Hours).length
  };
}

function aggregateShiftCounts(
  records: AttendanceSummaryRecord[],
  period: { periodFrom: Date; periodTo: Date }
) {
  const calculation = new AttendanceCalculationService();
  const recordsByUser = groupBy(records, (record) => record.userId);
  let totalShiftsNeeded = 0;
  let missingShifts = 0;

  recordsByUser.forEach((userRecords) => {
    const needed = calculation.calculateTotalShiftsNeeded({
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
      joiningDate: userRecords[0].userJoiningDate
    });
    totalShiftsNeeded += needed;
    missingShifts += Math.max(0, needed - userRecords.length);
  });

  return {
    totalShiftsNeeded,
    totalCreatedShifts: records.length,
    missingShifts
  };
}
