import assert from "node:assert/strict";

import {
  AttendanceArchiveStatus,
  AttendanceMatchedRole
} from "@prisma/client";

import { ReportsService } from "../src/reports/reports.service";

async function main() {
  await testOverviewSeparatesPickerAndChampSummaries();
  await testChainAndBranchReportsReadPickerOnlySummaryTables();
  await testUsersEndpointFiltersByRoleAndSearch();
  await testDailyDetailsReturnsSummaryOnlyMessageWhenRecordsMissing();
  await testReportQueriesDoNotUseWriteMethods();
}

async function testOverviewSeparatesPickerAndChampSummaries() {
  const context = createContext();

  const overview = await context.service.getAttendanceOverview({
    monthKey: "2026-05"
  });

  assert.equal(overview.monthKey, "2026-05");
  assert.equal(overview.totalPickers, 1);
  assert.equal(overview.totalChamps, 1);
  assert.equal(overview.totalCreatedShifts, 41);
  assert.equal(overview.totalShiftsNeeded, 50);
  assert.equal(overview.totalMissingShifts, 9);
  assert.equal(overview.branchCount, 1);
  assert.equal(overview.chainCount, 1);
  assert.equal(overview.summaryOnly, false);
  assert.equal(overview.dailyRecordsAvailable, true);
}

async function testChainAndBranchReportsReadPickerOnlySummaryTables() {
  const context = createContext();

  const chains = await context.service.getAttendanceChainSummaries({
    monthKey: "2026-05"
  });
  const branches = await context.service.getAttendanceBranchSummaries({
    chainId: "chain-1",
    monthKey: "2026-05"
  });

  assert.deepEqual(chains.items, [
    {
      absentCount: 2,
      branchCount: 1,
      chainId: "chain-1",
      chainName: "Chain One",
      lateLevel1Over15Count: 3,
      missingShifts: 4,
      over15HoursCount: 1,
      pickerCount: 2,
      totalCreatedShifts: 20,
      totalShiftsNeeded: 24,
      under8HoursCount: 2
    }
  ]);
  assert.deepEqual(branches.items[0], {
    absentCount: 2,
    chainId: "chain-1",
    chainName: "Chain One",
    lateLevel1Over15Count: 3,
    missingShifts: 4,
    over15HoursCount: 1,
    pickerCount: 2,
    totalCreatedShifts: 20,
    totalShiftsNeeded: 24,
    under8HoursCount: 2,
    vendorExternalId: "740921",
    vendorId: "vendor-1",
    vendorName: "Branch One"
  });
  assert.equal(context.calls.attendanceMonthlyChainSummary.findMany.length, 1);
  assert.equal(context.calls.attendanceMonthlyBranchSummary.findMany.length, 1);
}

async function testUsersEndpointFiltersByRoleAndSearch() {
  const context = createContext();

  const users = await context.service.getAttendanceUserSummaries({
    monthKey: "2026-05",
    role: AttendanceMatchedRole.CHAMP,
    search: "champ",
    page: 1,
    pageSize: 20
  });

  assert.equal(users.items.length, 1);
  assert.equal(users.items[0].role, AttendanceMatchedRole.CHAMP);
  assert.equal(users.items[0].displayName, "Champ One");
  assert.equal(context.calls.attendanceMonthlyUserSummary.findMany[0].where.role, "CHAMP");
  assert.deepEqual(
    context.calls.attendanceMonthlyUserSummary.findMany[0].where.OR,
    [
      { identifier: { contains: "champ", mode: "insensitive" } },
      { user: { nameEn: { contains: "champ", mode: "insensitive" } } }
    ]
  );
}

async function testDailyDetailsReturnsSummaryOnlyMessageWhenRecordsMissing() {
  const context = createContext({
    dailyRecords: []
  });

  const details = await context.service.getAttendanceUserDailyDetails("user-1", {
    monthKey: "2026-01"
  });

  assert.equal(details.dailyRecordsAvailable, false);
  assert.equal(
    details.message,
    "Daily detail is no longer stored for this month. Monthly summary is available."
  );
  assert.deepEqual(details.records, []);
}

async function testReportQueriesDoNotUseWriteMethods() {
  const context = createContext();

  await context.service.getAttendanceMonths();
  await context.service.getAttendanceOverview({ monthKey: "2026-05" });
  await context.service.getAttendanceChainSummaries({ monthKey: "2026-05" });
  await context.service.getAttendanceBranchSummaries({ monthKey: "2026-05" });
  await context.service.getAttendanceUserSummaries({ monthKey: "2026-05" });
  await context.service.getAttendanceUserDailyDetails("user-1", {
    monthKey: "2026-05"
  });

  assert.deepEqual(context.writeCalls, []);
}

function createContext(
  options: {
    dailyRecords?: Array<Record<string, unknown>>;
  } = {}
) {
  const writeCalls: string[] = [];
  const calls = {
    attendanceDailyRecord: {
      count: [] as Array<Record<string, unknown>>,
      findMany: [] as Array<Record<string, unknown>>,
      groupBy: [] as Array<Record<string, unknown>>
    },
    attendanceMonthlyBranchSummary: {
      findMany: [] as Array<Record<string, unknown>>,
      groupBy: [] as Array<Record<string, unknown>>
    },
    attendanceMonthlyChainSummary: {
      findMany: [] as Array<Record<string, unknown>>,
      groupBy: [] as Array<Record<string, unknown>>
    },
    attendanceMonthlyUserSummary: {
      count: [] as Array<Record<string, unknown>>,
      findMany: [] as Array<Record<string, unknown>>,
      groupBy: [] as Array<Record<string, unknown>>
    }
  };
  const pickerSummary = {
    id: "summary-picker",
    monthKey: "2026-05",
    periodFrom: new Date("2026-05-01T00:00:00.000Z"),
    periodTo: new Date("2026-05-31T00:00:00.000Z"),
    userId: "picker-1",
    identifier: "SHOP-1",
    role: AttendanceMatchedRole.PICKER,
    matchKeyType: "SHOPPER_ID",
    assignmentVendorId: "vendor-1",
    assignmentChainId: "chain-1",
    totalShiftsNeeded: 31,
    totalCreatedShifts: 26,
    missingShifts: 5,
    workedShiftCount: 22,
    totalWorkedHours: 180,
    lateMinutesTotal: 70,
    lateLevel1Over15Count: 4,
    lateLevel2From31To45Count: 2,
    lateLevel3Over45Count: 1,
    absentCount: 2,
    onLeaveCount: 1,
    annualLeaveCount: 1,
    medicalLeaveCount: 0,
    offDayCount: 2,
    under8HoursCount: 3,
    over15HoursCount: 1,
    sourceDailyRecordsAvailable: true,
    archiveStatus: AttendanceArchiveStatus.DETAILED,
    user: { id: "picker-1", nameEn: "Picker One" },
    assignmentVendor: {
      id: "vendor-1",
      vendorName: "Branch One",
      vendorExternalId: "740921",
      chain: { id: "chain-1", chainName: "Chain One" }
    },
    assignmentChain: { id: "chain-1", chainName: "Chain One" }
  };
  const champSummary = {
    ...pickerSummary,
    id: "summary-champ",
    userId: "champ-1",
    identifier: "IBS-1",
    role: AttendanceMatchedRole.CHAMP,
    matchKeyType: "IBS_ID",
    assignmentVendorId: null,
    assignmentChainId: null,
    totalShiftsNeeded: 19,
    totalCreatedShifts: 15,
    missingShifts: 4,
    workedShiftCount: 13,
    totalWorkedHours: 120,
    lateMinutesTotal: 10,
    lateLevel1Over15Count: 1,
    lateLevel2From31To45Count: 0,
    lateLevel3Over45Count: 0,
    absentCount: 1,
    onLeaveCount: 0,
    annualLeaveCount: 0,
    medicalLeaveCount: 0,
    offDayCount: 1,
    under8HoursCount: 1,
    over15HoursCount: 0,
    user: { id: "champ-1", nameEn: "Champ One" },
    assignmentVendor: null,
    assignmentChain: null
  };
  const branchSummary = {
    id: "branch-summary-1",
    monthKey: "2026-05",
    vendorId: "vendor-1",
    chainId: "chain-1",
    pickerCount: 2,
    totalCreatedShifts: 20,
    totalShiftsNeeded: 24,
    missingShifts: 4,
    absentCount: 2,
    lateLevel1Over15Count: 3,
    under8HoursCount: 2,
    over15HoursCount: 1,
    vendor: {
      id: "vendor-1",
      vendorName: "Branch One",
      vendorExternalId: "740921",
      chain: { id: "chain-1", chainName: "Chain One" }
    },
    chain: { id: "chain-1", chainName: "Chain One" }
  };
  const chainSummary = {
    id: "chain-summary-1",
    monthKey: "2026-05",
    chainId: "chain-1",
    branchCount: 1,
    pickerCount: 2,
    totalCreatedShifts: 20,
    totalShiftsNeeded: 24,
    missingShifts: 4,
    absentCount: 2,
    lateLevel1Over15Count: 3,
    under8HoursCount: 2,
    over15HoursCount: 1,
    chain: { id: "chain-1", chainName: "Chain One" }
  };
  const dailyRecords =
    options.dailyRecords ??
    [
      {
        id: "daily-1",
        attendanceDate: new Date("2026-05-01T00:00:00.000Z"),
        status: "LATE",
        shiftName: "Morning",
        scheduledStartAt: new Date("2026-05-01T08:00:00.000Z"),
        actualCheckInAt: new Date("2026-05-01T08:21:00.000Z"),
        actualCheckOutAt: new Date("2026-05-01T16:00:00.000Z"),
        actualWorkDurationHours: 7.65,
        lateMinutes: 21,
        lateLevel1Over15: true,
        lateLevel2From31To45: false,
        lateLevel3Over45: false,
        isAbsent: false,
        isOnLeave: false,
        isAnnualLeave: false,
        isMedicalLeave: false,
        isOffDay: false,
        isUnder8Hours: true,
        isOver15Hours: false,
        assignmentVendor: {
          id: "vendor-1",
          vendorName: "Branch One",
          vendorExternalId: "740921"
        },
        assignmentChain: { id: "chain-1", chainName: "Chain One" }
      }
    ];
  const writeGuard = (model: string, method: string) => async () => {
    writeCalls.push(`${model}.${method}`);
    throw new Error(`Unexpected write: ${model}.${method}`);
  };
  const prisma = {
    attendanceDailyRecord: {
      count: async (input: Record<string, unknown>) => {
        calls.attendanceDailyRecord.count.push(input);
        return dailyRecords.length;
      },
      findMany: async (input: Record<string, unknown>) => {
        calls.attendanceDailyRecord.findMany.push(input);
        return dailyRecords;
      },
      groupBy: async (input: Record<string, unknown>) => {
        calls.attendanceDailyRecord.groupBy.push(input);
        return [{ monthKey: "2026-05", _count: { _all: dailyRecords.length } }];
      },
      create: writeGuard("attendanceDailyRecord", "create"),
      createMany: writeGuard("attendanceDailyRecord", "createMany"),
      deleteMany: writeGuard("attendanceDailyRecord", "deleteMany"),
      update: writeGuard("attendanceDailyRecord", "update"),
      updateMany: writeGuard("attendanceDailyRecord", "updateMany")
    },
    attendanceMonthlyUserSummary: {
      count: async (input: Record<string, unknown>) => {
        calls.attendanceMonthlyUserSummary.count.push(input);
        return 1;
      },
      findMany: async (input: { where?: { role?: AttendanceMatchedRole } }) => {
        calls.attendanceMonthlyUserSummary.findMany.push(input);
        if (input.where?.role === AttendanceMatchedRole.CHAMP) return [champSummary];
        if (input.where?.role === AttendanceMatchedRole.PICKER) return [pickerSummary];
        return [pickerSummary, champSummary];
      },
      groupBy: async (input: Record<string, unknown>) => {
        calls.attendanceMonthlyUserSummary.groupBy.push(input);
        return [{ monthKey: "2026-05", _count: { _all: 2 } }];
      },
      create: writeGuard("attendanceMonthlyUserSummary", "create"),
      createMany: writeGuard("attendanceMonthlyUserSummary", "createMany"),
      deleteMany: writeGuard("attendanceMonthlyUserSummary", "deleteMany"),
      update: writeGuard("attendanceMonthlyUserSummary", "update"),
      updateMany: writeGuard("attendanceMonthlyUserSummary", "updateMany")
    },
    attendanceMonthlyBranchSummary: {
      findMany: async (input: Record<string, unknown>) => {
        calls.attendanceMonthlyBranchSummary.findMany.push(input);
        return [branchSummary];
      },
      groupBy: async (input: Record<string, unknown>) => {
        calls.attendanceMonthlyBranchSummary.groupBy.push(input);
        return [{ monthKey: "2026-05", _count: { _all: 1 } }];
      },
      create: writeGuard("attendanceMonthlyBranchSummary", "create"),
      deleteMany: writeGuard("attendanceMonthlyBranchSummary", "deleteMany"),
      update: writeGuard("attendanceMonthlyBranchSummary", "update")
    },
    attendanceMonthlyChainSummary: {
      findMany: async (input: Record<string, unknown>) => {
        calls.attendanceMonthlyChainSummary.findMany.push(input);
        return [chainSummary];
      },
      groupBy: async (input: Record<string, unknown>) => {
        calls.attendanceMonthlyChainSummary.groupBy.push(input);
        return [{ monthKey: "2026-05", _count: { _all: 1 } }];
      },
      create: writeGuard("attendanceMonthlyChainSummary", "create"),
      deleteMany: writeGuard("attendanceMonthlyChainSummary", "deleteMany"),
      update: writeGuard("attendanceMonthlyChainSummary", "update")
    }
  };

  return {
    calls,
    service: new ReportsService(prisma as never),
    writeCalls
  };
}

void main();
