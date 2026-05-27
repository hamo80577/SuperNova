import assert from "node:assert/strict";

import {
  AttendanceCalculatedStatus,
  AttendanceLateBucket,
  AttendanceLeaveType
} from "@prisma/client";

import { AttendanceCalculationService } from "../src/attendance/attendance-calculation.service";
import type { AttendanceCalculationInputRow } from "../src/attendance/attendance-calculation.types";

const calculatedAt = "2026-05-09T10:00:00.000Z";

function baseRow(
  overrides: Partial<AttendanceCalculationInputRow> = {}
): AttendanceCalculationInputRow {
  return {
    periodMonth: "2026-05",
    shiftDate: "2026-05-01",
    shopperId: "SHOPPER-1",
    userId: "user-picker-1",
    pickerNameSnapshot: "Picker One",
    sourceName: "Picker One",
    sourceDesignation: "Picker",
    division: "Egypt",
    sourceSubDivision: "Cairo",
    sourceLocation: "Branch A",
    sourceLocationCode: "BR-A",
    shiftName: "Morning Shift",
    scheduledStartTime: "09:00",
    scheduledEndTime: "17:00",
    scheduledShiftHours: 8,
    breakDurationMins: 60,
    actualCheckinTime: "09:00",
    actualCheckoutTime: "17:00",
    actualWorkDurationHours: 8,
    sourceStatus: "Present",
    rawRowNumber: 2,
    issuesCount: 0,
    ...overrides
  };
}

function calculateRows(rows: AttendanceCalculationInputRow[]) {
  const service = new AttendanceCalculationService();

  return service.calculate({
    periodMonth: "2026-05",
    calculatedAt,
    rows
  });
}

function calculateOne(overrides: Partial<AttendanceCalculationInputRow> = {}) {
  const result = calculateRows([baseRow(overrides)]);
  const record = result.dailyRecords[0];

  assert.ok(record, "Expected one calculated daily record.");

  return record;
}

async function main() {
  {
    const record = calculateOne({ actualCheckinTime: "08:55" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.ON_TIME);
    assert.equal(record.rawLateMins, 0);
    assert.equal(record.chargeableLateMins, 0);
    assert.equal(record.lateBucket, AttendanceLateBucket.NONE);
    assert.equal(record.isWorkingDay, true);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:00" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.ON_TIME);
    assert.equal(record.rawLateMins, 0);
    assert.equal(record.chargeableLateMins, 0);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:15" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.ON_TIME);
    assert.equal(record.rawLateMins, 15);
    assert.equal(record.chargeableLateMins, 0);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:16" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.LATE);
    assert.equal(record.rawLateMins, 16);
    assert.equal(record.chargeableLateMins, 1);
    assert.equal(record.lateBucket, AttendanceLateBucket.LATE_1);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:30" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.LATE);
    assert.equal(record.lateBucket, AttendanceLateBucket.LATE_1);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:31" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.LATE);
    assert.equal(record.lateBucket, AttendanceLateBucket.LATE_2);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:45" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.LATE);
    assert.equal(record.lateBucket, AttendanceLateBucket.LATE_2);
  }

  {
    const record = calculateOne({ actualCheckinTime: "09:46" });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.LATE);
    assert.equal(record.rawLateMins, 46);
    assert.equal(record.chargeableLateMins, 31);
    assert.equal(record.lateBucket, AttendanceLateBucket.LATE_3);
  }

  {
    const record = calculateOne({
      actualCheckinTime: "09:10",
      sourceStatus: "Late"
    });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.ON_TIME);
    assert.equal(record.isOnTime, true);
    assert.equal(record.isLate, false);
  }

  {
    const record = calculateOne({
      sourceStatus: "Absent",
      actualCheckinTime: null,
      actualCheckoutTime: null,
      actualWorkDurationHours: null
    });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.ABSENT);
    assert.equal(record.isAbsent, true);
    assert.equal(record.isWorkingDay, false);
    assert.equal(record.isUnder8Hours, false);
    assert.equal(record.isOver15Hours, false);
    assert.equal(record.rawLateMins, null);
    assert.equal(record.chargeableLateMins, null);
    assert.equal(record.lateBucket, null);
  }

  {
    const record = calculateOne({
      shiftName: "Weekend Off Day",
      sourceStatus: "Absent",
      actualCheckinTime: null
    });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.OFF_DAY);
    assert.equal(record.isOffDay, true);
    assert.equal(record.isAbsent, false);
    assert.equal(record.isWorkingDay, false);
  }

  {
    const record = calculateOne({
      shiftName: "Annual Leave",
      sourceStatus: "Absent",
      actualCheckinTime: null
    });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.ANNUAL_LEAVE);
    assert.equal(record.leaveType, AttendanceLeaveType.ANNUAL_LEAVE);
    assert.equal(record.isAnnualLeave, true);
    assert.equal(record.isOnLeave, true);
    assert.equal(record.isWorkingDay, false);
  }

  {
    const record = calculateOne({
      shiftName: "Medical Leave",
      sourceStatus: "Absent",
      actualCheckinTime: null
    });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.MEDICAL_LEAVE);
    assert.equal(record.leaveType, AttendanceLeaveType.MEDICAL_LEAVE);
    assert.equal(record.isMedicalLeave, true);
    assert.equal(record.isOnLeave, true);
    assert.equal(record.isWorkingDay, false);
  }

  {
    const record = calculateOne({
      sourceStatus: "On Leave",
      actualCheckinTime: null
    });

    assert.equal(record.calculatedStatus, AttendanceCalculatedStatus.OTHER_LEAVE);
    assert.equal(record.leaveType, AttendanceLeaveType.OTHER_LEAVE);
    assert.equal(record.isOnLeave, true);
    assert.equal(record.isWorkingDay, false);
  }

  {
    const under8 = calculateOne({ actualWorkDurationHours: 7.99 });
    const absent = calculateOne({
      sourceStatus: "Absent",
      actualCheckinTime: null,
      actualWorkDurationHours: 7
    });
    const over15 = calculateOne({ actualWorkDurationHours: 15.01 });
    const absentOver15 = calculateOne({
      sourceStatus: "Absent",
      actualCheckinTime: null,
      actualWorkDurationHours: 16
    });

    assert.equal(under8.isUnder8Hours, true);
    assert.equal(absent.isUnder8Hours, false);
    assert.equal(over15.isOver15Hours, true);
    assert.equal(absentOver15.isOver15Hours, false);
  }

  {
    const result = calculateRows([
      baseRow({
        rawRowNumber: 2,
        shiftDate: "2026-05-01",
        actualCheckinTime: "09:00"
      }),
      baseRow({
        rawRowNumber: 3,
        shiftDate: "2026-05-02",
        actualCheckinTime: "09:20"
      }),
      baseRow({
        rawRowNumber: 4,
        shiftDate: "2026-05-03",
        sourceStatus: "Absent",
        actualCheckinTime: null,
        actualCheckoutTime: null,
        actualWorkDurationHours: null
      }),
      baseRow({
        rawRowNumber: 5,
        shiftDate: "2026-05-01",
        shopperId: "SHOPPER-2",
        userId: "user-picker-2",
        pickerNameSnapshot: "Picker Two",
        sourceName: "Picker Two",
        actualCheckinTime: "09:46"
      })
    ]);

    const pickerOne = result.monthlySummaries.find(
      (summary) => summary.userId === "user-picker-1"
    );
    const pickerTwo = result.monthlySummaries.find(
      (summary) => summary.userId === "user-picker-2"
    );

    assert.ok(pickerOne, "Expected first Picker summary.");
    assert.ok(pickerTwo, "Expected second Picker summary.");
    assert.equal(pickerOne.totalScheduledRows, 3);
    assert.equal(pickerOne.totalWorkingDays, 2);
    assert.equal(pickerOne.onTimeDays, 1);
    assert.equal(pickerOne.lateDays, 1);
    assert.equal(pickerOne.absentCount, 1);
    assert.equal(pickerOne.totalRawLateMins, 20);
    assert.equal(pickerOne.totalChargeableLateMins, 5);
    assert.equal(pickerOne.firstShiftDate, "2026-05-01");
    assert.equal(pickerOne.lastShiftDate, "2026-05-03");
    assert.equal(pickerOne.lastCalculatedAt, calculatedAt);
    assert.equal(pickerTwo.totalScheduledRows, 1);
    assert.equal(pickerTwo.totalWorkingDays, 1);
    assert.equal(pickerTwo.lateDays, 1);
    assert.equal(pickerTwo.absentCount, 0);
  }

  {
    const first = calculateOne();
    const second = calculateOne();

    assert.equal(first.rowHash, second.rowHash);
  }
}

void main();
