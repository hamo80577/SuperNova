import assert from "node:assert/strict";

import {
  AssignmentStatus,
  AttendanceArchiveStatus,
  AttendanceMatchedRole
} from "@prisma/client";

import { ReportsService } from "../src/reports/reports.service";

async function main() {
  await testAreaManagerScopeLimitsChainsBranchesAndUsers();
  await testAreaManagerRejectsOutOfScopeFiltersAndDailyDetails();
  await testChampScopeLimitsBranchesAndUsers();
  await testChampRejectsOutOfScopeVendorAndDailyDetails();
  await testScopedDailyDetailsReturnsCompressedMonthMessage();
  await testScopedReportQueriesDoNotUseWriteMethods();
}

async function testAreaManagerScopeLimitsChainsBranchesAndUsers() {
  const context = createContext();

  const chains = await context.service.getAreaManagerAttendanceChainSummaries(
    "area-manager-1",
    { monthKey: "2026-05" }
  );
  const branches = await context.service.getAreaManagerAttendanceBranchSummaries(
    "area-manager-1",
    { monthKey: "2026-05" }
  );
  const users = await context.service.getAreaManagerAttendanceUserSummaries(
    "area-manager-1",
    { monthKey: "2026-05" }
  );

  assert.deepEqual(chains.items.map((item) => item.chainId), ["chain-a"]);
  assert.deepEqual(branches.items.map((item) => item.vendorId), ["vendor-a"]);
  assert.deepEqual(users.items.map((item) => item.userId).sort(), [
    "champ-a",
    "picker-a"
  ]);
  assert.equal(
    context.calls.attendanceMonthlyChainSummary.findMany.at(-1)?.where.chainId
      .in[0],
    "chain-a"
  );
}

async function testAreaManagerRejectsOutOfScopeFiltersAndDailyDetails() {
  const context = createContext();

  await assert.rejects(
    () =>
      context.service.getAreaManagerAttendanceBranchSummaries(
        "area-manager-1",
        {
          monthKey: "2026-05",
          vendorId: "vendor-b"
        }
      ),
    /outside assigned Area Manager scope/
  );
  await assert.rejects(
    () =>
      context.service.getAreaManagerAttendanceUserDailyDetails(
        "area-manager-1",
        "picker-b",
        { monthKey: "2026-05" }
      ),
    /outside assigned Area Manager scope/
  );
}

async function testChampScopeLimitsBranchesAndUsers() {
  const context = createContext();

  const branches = await context.service.getChampAttendanceBranchSummaries(
    "champ-a",
    { monthKey: "2026-05" }
  );
  const users = await context.service.getChampAttendanceUserSummaries("champ-a", {
    monthKey: "2026-05"
  });

  assert.deepEqual(branches.items.map((item) => item.vendorId), ["vendor-a"]);
  assert.deepEqual(users.items.map((item) => item.userId), ["picker-a"]);
  assert.equal(
    context.calls.attendanceMonthlyUserSummary.findMany.at(-1)?.where.role,
    AttendanceMatchedRole.PICKER
  );
}

async function testChampRejectsOutOfScopeVendorAndDailyDetails() {
  const context = createContext();

  await assert.rejects(
    () =>
      context.service.getChampAttendanceOverview("champ-a", {
        monthKey: "2026-05",
        vendorId: "vendor-b"
      }),
    /outside assigned Champ scope/
  );
  await assert.rejects(
    () =>
      context.service.getChampAttendanceUserDailyDetails("champ-a", "picker-b", {
        monthKey: "2026-05"
      }),
    /outside assigned Champ scope/
  );
  await assert.rejects(
    () =>
      context.service.getChampAttendanceUserDailyDetails("champ-a", "champ-b", {
        monthKey: "2026-05"
      }),
    /outside assigned Champ scope/
  );
}

async function testScopedDailyDetailsReturnsCompressedMonthMessage() {
  const context = createContext({ dailyRecords: [] });

  const details =
    await context.service.getAreaManagerAttendanceUserDailyDetails(
      "area-manager-1",
      "picker-a",
      { monthKey: "2026-05" }
    );

  assert.equal(details.dailyRecordsAvailable, false);
  assert.equal(
    details.message,
    "Daily detail is no longer stored for this month. Monthly summary is available."
  );
  assert.deepEqual(details.records, []);
}

async function testScopedReportQueriesDoNotUseWriteMethods() {
  const context = createContext();

  await context.service.getAreaManagerAttendanceMonths("area-manager-1");
  await context.service.getAreaManagerAttendanceOverview("area-manager-1", {
    monthKey: "2026-05"
  });
  await context.service.getAreaManagerAttendanceUserSummaries("area-manager-1", {
    monthKey: "2026-05"
  });
  await context.service.getChampAttendanceMonths("champ-a");
  await context.service.getChampAttendanceOverview("champ-a", {
    monthKey: "2026-05"
  });
  await context.service.getChampAttendanceUserSummaries("champ-a", {
    monthKey: "2026-05"
  });

  assert.deepEqual(context.writeCalls, []);
}

function createContext(options: { dailyRecords?: unknown[] } = {}) {
  const writeCalls: string[] = [];
  const calls = {
    attendanceMonthlyChainSummary: { findMany: [] as Array<any> },
    attendanceMonthlyUserSummary: { findMany: [] as Array<any> }
  };
  const chains = {
    "chain-a": { id: "chain-a", chainName: "Chain A" },
    "chain-b": { id: "chain-b", chainName: "Chain B" }
  };
  const vendors = {
    "vendor-a": {
      id: "vendor-a",
      vendorName: "Vendor A",
      vendorExternalId: "740921",
      chainId: "chain-a",
      chain: chains["chain-a"]
    },
    "vendor-b": {
      id: "vendor-b",
      vendorName: "Vendor B",
      vendorExternalId: "612846",
      chainId: "chain-b",
      chain: chains["chain-b"]
    }
  };
  const userSummaries = [
    attendanceUserSummary({
      assignmentChain: chains["chain-a"],
      assignmentChainId: "chain-a",
      assignmentVendor: vendors["vendor-a"],
      assignmentVendorId: "vendor-a",
      identifier: "SHOP-A",
      role: AttendanceMatchedRole.PICKER,
      userId: "picker-a",
      userName: "Picker A"
    }),
    attendanceUserSummary({
      assignmentChain: chains["chain-b"],
      assignmentChainId: "chain-b",
      assignmentVendor: vendors["vendor-b"],
      assignmentVendorId: "vendor-b",
      identifier: "SHOP-B",
      role: AttendanceMatchedRole.PICKER,
      userId: "picker-b",
      userName: "Picker B"
    }),
    attendanceUserSummary({
      assignmentChain: null,
      assignmentChainId: null,
      assignmentVendor: null,
      assignmentVendorId: null,
      identifier: "IBS-A",
      role: AttendanceMatchedRole.CHAMP,
      userId: "champ-a",
      userName: "Champ A"
    }),
    attendanceUserSummary({
      assignmentChain: null,
      assignmentChainId: null,
      assignmentVendor: null,
      assignmentVendorId: null,
      identifier: "IBS-B",
      role: AttendanceMatchedRole.CHAMP,
      userId: "champ-b",
      userName: "Champ B"
    })
  ];
  const branchSummaries = [
    branchSummary(vendors["vendor-a"], chains["chain-a"]),
    branchSummary(vendors["vendor-b"], chains["chain-b"])
  ];
  const chainSummaries = [
    chainSummary(chains["chain-a"]),
    chainSummary(chains["chain-b"])
  ];
  const dailyRecords =
    options.dailyRecords ??
    [
      {
        attendanceDate: new Date("2026-05-03T00:00:00.000Z"),
        status: "ON_TIME",
        shiftName: "Morning",
        scheduledStartAt: new Date("2026-05-03T08:00:00.000Z"),
        scheduledEndAt: new Date("2026-05-03T16:00:00.000Z"),
        actualCheckInAt: new Date("2026-05-03T08:00:00.000Z"),
        actualCheckOutAt: new Date("2026-05-03T16:00:00.000Z"),
        actualWorkDurationHours: 8,
        lateMinutes: 0,
        lateLevel1Over15: false,
        lateLevel2From31To45: false,
        lateLevel3Over45: false,
        isAbsent: false,
        isOnLeave: false,
        isAnnualLeave: false,
        isMedicalLeave: false,
        isOffDay: false,
        isUnder8Hours: false,
        isOver15Hours: false,
        assignmentVendor: vendors["vendor-a"],
        assignmentChain: chains["chain-a"],
        matchedUserId: "picker-a",
        monthKey: "2026-05"
      }
    ];
  const writeGuard = (model: string, method: string) => async () => {
    writeCalls.push(`${model}.${method}`);
    throw new Error(`Unexpected write: ${model}.${method}`);
  };
  const prisma = {
    chainAreaManagerAssignment: {
      findMany: async ({ where }: any) =>
        where.areaManagerId === "area-manager-1"
          ? [
              {
                chainId: "chain-a",
                status: AssignmentStatus.ACTIVE,
                chain: {
                  ...chains["chain-a"],
                  vendors: [
                    {
                      ...vendors["vendor-a"],
                      champAssignments: [
                        {
                          champId: "champ-a",
                          status: AssignmentStatus.ACTIVE
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          : []
    },
    vendorChampAssignment: {
      findMany: async ({ where }: any) =>
        where.champId === "champ-a"
          ? [
              {
                vendorId: "vendor-a",
                status: AssignmentStatus.ACTIVE,
                vendor: vendors["vendor-a"]
              }
            ]
          : []
    },
    attendanceMonthlyUserSummary: {
      count: async ({ where }: any) => filterRows(userSummaries, where).length,
      findMany: async (input: any) => {
        calls.attendanceMonthlyUserSummary.findMany.push(input);
        return filterRows(userSummaries, input.where);
      },
      groupBy: async ({ where }: any) =>
        groupByMonth(filterRows(userSummaries, where)),
      create: writeGuard("attendanceMonthlyUserSummary", "create"),
      deleteMany: writeGuard("attendanceMonthlyUserSummary", "deleteMany"),
      update: writeGuard("attendanceMonthlyUserSummary", "update")
    },
    attendanceMonthlyBranchSummary: {
      findMany: async ({ where }: any) => filterRows(branchSummaries, where),
      groupBy: async ({ where }: any) =>
        groupByMonth(filterRows(branchSummaries, where)),
      create: writeGuard("attendanceMonthlyBranchSummary", "create"),
      deleteMany: writeGuard("attendanceMonthlyBranchSummary", "deleteMany"),
      update: writeGuard("attendanceMonthlyBranchSummary", "update")
    },
    attendanceMonthlyChainSummary: {
      findMany: async (input: any) => {
        calls.attendanceMonthlyChainSummary.findMany.push(input);
        return filterRows(chainSummaries, input.where);
      },
      groupBy: async ({ where }: any) =>
        groupByMonth(filterRows(chainSummaries, where)),
      create: writeGuard("attendanceMonthlyChainSummary", "create"),
      deleteMany: writeGuard("attendanceMonthlyChainSummary", "deleteMany"),
      update: writeGuard("attendanceMonthlyChainSummary", "update")
    },
    attendanceDailyRecord: {
      count: async ({ where }: any) => filterRows(dailyRecords, where).length,
      findMany: async ({ where }: any) => filterRows(dailyRecords, where),
      groupBy: async ({ where }: any) =>
        groupByMonth(filterRows(dailyRecords, where)),
      create: writeGuard("attendanceDailyRecord", "create"),
      deleteMany: writeGuard("attendanceDailyRecord", "deleteMany"),
      update: writeGuard("attendanceDailyRecord", "update")
    }
  };

  return {
    calls,
    service: new ReportsService(prisma as never),
    writeCalls
  };
}

function attendanceUserSummary(input: {
  assignmentChain: unknown;
  assignmentChainId: string | null;
  assignmentVendor: unknown;
  assignmentVendorId: string | null;
  identifier: string;
  role: AttendanceMatchedRole;
  userId: string;
  userName: string;
}) {
  return {
    id: `summary-${input.userId}`,
    monthKey: "2026-05",
    periodFrom: new Date("2026-05-01T00:00:00.000Z"),
    periodTo: new Date("2026-05-31T00:00:00.000Z"),
    userId: input.userId,
    identifier: input.identifier,
    role: input.role,
    matchKeyType:
      input.role === AttendanceMatchedRole.PICKER ? "SHOPPER_ID" : "IBS_ID",
    assignmentVendorId: input.assignmentVendorId,
    assignmentChainId: input.assignmentChainId,
    totalShiftsNeeded: 31,
    totalCreatedShifts: 25,
    missingShifts: 6,
    workedShiftCount: 22,
    totalWorkedHours: 170,
    lateMinutesTotal: 20,
    lateLevel1Over15Count: 2,
    lateLevel2From31To45Count: 1,
    lateLevel3Over45Count: 0,
    absentCount: 1,
    onLeaveCount: 1,
    annualLeaveCount: 0,
    medicalLeaveCount: 0,
    offDayCount: 2,
    under8HoursCount: 2,
    over15HoursCount: 0,
    sourceDailyRecordsAvailable: true,
    archiveStatus: AttendanceArchiveStatus.DETAILED,
    user: { id: input.userId, nameEn: input.userName, nameAr: null },
    assignmentVendor: input.assignmentVendor,
    assignmentChain: input.assignmentChain
  };
}

function branchSummary(vendor: any, chain: any) {
  return {
    id: `branch-summary-${vendor.id}`,
    monthKey: "2026-05",
    vendorId: vendor.id,
    chainId: chain.id,
    pickerCount: 3,
    totalCreatedShifts: 25,
    totalShiftsNeeded: 31,
    missingShifts: 6,
    workedShiftCount: 22,
    totalWorkedHours: 170,
    lateMinutesTotal: 20,
    lateLevel1Over15Count: 2,
    lateLevel2From31To45Count: 1,
    lateLevel3Over45Count: 0,
    absentCount: 1,
    onLeaveCount: 1,
    annualLeaveCount: 0,
    medicalLeaveCount: 0,
    offDayCount: 2,
    under8HoursCount: 2,
    over15HoursCount: 0,
    vendor,
    chain
  };
}

function chainSummary(chain: any) {
  return {
    id: `chain-summary-${chain.id}`,
    monthKey: "2026-05",
    chainId: chain.id,
    branchCount: 1,
    pickerCount: 3,
    totalCreatedShifts: 25,
    totalShiftsNeeded: 31,
    missingShifts: 6,
    workedShiftCount: 22,
    totalWorkedHours: 170,
    lateMinutesTotal: 20,
    lateLevel1Over15Count: 2,
    lateLevel2From31To45Count: 1,
    lateLevel3Over45Count: 0,
    absentCount: 1,
    onLeaveCount: 1,
    annualLeaveCount: 0,
    medicalLeaveCount: 0,
    offDayCount: 2,
    under8HoursCount: 2,
    over15HoursCount: 0,
    chain
  };
}

function filterRows(rows: unknown[], where: any): any[] {
  if (!where) {
    return rows as any[];
  }

  return (rows as any[]).filter((row) => matchesWhere(row, where));
}

function matchesWhere(row: any, where: any): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "AND") {
      return (expected as any[]).every((item) => matchesWhere(row, item));
    }

    if (key === "OR") {
      return (expected as any[]).some((item) => matchesWhere(row, item));
    }

    if (
      expected &&
      typeof expected === "object" &&
      "in" in (expected as Record<string, unknown>)
    ) {
      return (expected as { in: unknown[] }).in.includes(row[key]);
    }

    if (
      expected &&
      typeof expected === "object" &&
      "contains" in (expected as Record<string, unknown>)
    ) {
      return String(row[key] ?? "")
        .toLowerCase()
        .includes(String((expected as { contains: string }).contains).toLowerCase());
    }

    if (key === "user" && expected && typeof expected === "object") {
      const nameFilter = (expected as any).nameEn?.contains;
      return nameFilter
        ? String(row.user?.nameEn ?? "")
            .toLowerCase()
            .includes(String(nameFilter).toLowerCase())
        : true;
    }

    if (key === "matchedUserId") {
      return row.matchedUserId === expected;
    }

    return row[key] === expected;
  });
}

function groupByMonth(rows: any[]) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    counts.set(row.monthKey, (counts.get(row.monthKey) ?? 0) + 1);
  });

  return Array.from(counts.entries()).map(([monthKey, count]) => ({
    monthKey,
    _count: { _all: count }
  }));
}

void main();
