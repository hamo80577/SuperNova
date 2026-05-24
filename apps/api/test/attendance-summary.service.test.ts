import assert from "node:assert/strict";

import {
  AttendanceArchiveStatus,
  AttendanceMatchKeyType,
  AttendanceMatchedRole
} from "@prisma/client";

import { AttendanceSummaryService } from "../src/attendance/attendance-summary.service";
import type { AttendanceSummaryRecord } from "../src/attendance/attendance.types";

const service = new AttendanceSummaryService();

function record(
  overrides: Partial<AttendanceSummaryRecord> = {}
): AttendanceSummaryRecord {
  return {
    userId: "picker-1",
    identifier: "SHOP-1",
    role: AttendanceMatchedRole.PICKER,
    matchKeyType: AttendanceMatchKeyType.SHOPPER_ID,
    monthKey: "2026-05",
    attendanceDate: new Date("2026-05-10T00:00:00.000Z"),
    assignmentVendorId: "vendor-1",
    assignmentChainId: "chain-1",
    actualWorkDurationHours: 8,
    lateMinutes: 20,
    lateLevel1Over15: true,
    lateLevel2From31To45: false,
    lateLevel3Over45: false,
    isAbsent: false,
    isOnLeave: false,
    isAnnualLeave: false,
    isMedicalLeave: false,
    isOffDay: false,
    isUnder8Hours: false,
    isOver15Hours: false,
    isWorkedShift: true,
    userJoiningDate: null,
    ...overrides
  };
}

const summaries = service.buildMonthlySummaries({
  records: [
    record(),
    record({
      monthKey: "2026-06",
      attendanceDate: new Date("2026-06-01T00:00:00.000Z")
    }),
    record({
      userId: "champ-1",
      identifier: "IBS-1",
      role: AttendanceMatchedRole.CHAMP,
      matchKeyType: AttendanceMatchKeyType.IBS_ID,
      assignmentVendorId: null,
      assignmentChainId: null
    }),
    record({
      userId: "picker-missing-assignment",
      identifier: "SHOP-MISSING",
      assignmentVendorId: null,
      assignmentChainId: null
    })
  ],
  periodFrom: new Date("2026-05-01T00:00:00.000Z"),
  periodTo: new Date("2026-06-30T00:00:00.000Z"),
  referenceDate: new Date("2026-06-15T00:00:00.000Z")
});

assert.equal(summaries.userSummaries.length, 4);
assert.equal(
  summaries.userSummaries.filter((summary) => summary.userId === "picker-1").length,
  2
);

const pickerMay = summaries.userSummaries.find(
  (summary) => summary.userId === "picker-1" && summary.monthKey === "2026-05"
);
assert.ok(pickerMay);
assert.equal(pickerMay.totalShiftsNeeded, 31);
assert.equal(pickerMay.totalCreatedShifts, 1);
assert.equal(pickerMay.missingShifts, 30);

assert.deepEqual(
  summaries.branchSummaries.map((summary) => ({
    monthKey: summary.monthKey,
    vendorId: summary.vendorId,
    pickerCount: summary.pickerCount
  })),
  [
    { monthKey: "2026-05", vendorId: "vendor-1", pickerCount: 1 },
    { monthKey: "2026-06", vendorId: "vendor-1", pickerCount: 1 }
  ]
);

assert.deepEqual(
  summaries.chainSummaries.map((summary) => ({
    monthKey: summary.monthKey,
    chainId: summary.chainId,
    pickerCount: summary.pickerCount
  })),
  [
    { monthKey: "2026-05", chainId: "chain-1", pickerCount: 1 },
    { monthKey: "2026-06", chainId: "chain-1", pickerCount: 1 }
  ]
);

const joinedMidMonth = service.buildMonthlySummaries({
  records: [
    record({
      userId: "picker-joined",
      identifier: "SHOP-JOINED",
      userJoiningDate: new Date("2026-05-20T00:00:00.000Z")
    })
  ],
  periodFrom: new Date("2026-05-01T00:00:00.000Z"),
  periodTo: new Date("2026-05-31T00:00:00.000Z"),
  referenceDate: new Date("2026-06-15T00:00:00.000Z")
});
assert.equal(joinedMidMonth.userSummaries[0].totalShiftsNeeded, 12);
assert.equal(joinedMidMonth.userSummaries[0].missingShifts, 11);

assert.equal(
  service.shouldStoreDailyRecords("2026-06", new Date("2026-06-15T00:00:00.000Z")),
  true
);
assert.equal(
  service.shouldStoreDailyRecords("2026-05", new Date("2026-06-15T00:00:00.000Z")),
  true
);
assert.equal(
  service.shouldStoreDailyRecords("2026-04", new Date("2026-06-15T00:00:00.000Z")),
  false
);
assert.equal(
  service.archiveStatusForMonth(
    "2026-04",
    new Date("2026-06-15T00:00:00.000Z")
  ),
  AttendanceArchiveStatus.SUMMARY_ONLY
);

