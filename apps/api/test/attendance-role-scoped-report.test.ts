import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  AttendanceCalculatedStatus,
  AttendanceImportBatchStatus,
  AttendanceLateBucket,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { AttendanceReportService } from "../src/attendance/attendance-report.service";

const activeBatch = {
  id: "active-may",
  periodMonth: "2026-05",
  status: AttendanceImportBatchStatus.ACTIVE,
  coverageStartDate: date("2026-05-01"),
  coverageEndDate: date("2026-05-03"),
  expectedCoverageEndDate: date("2026-05-03"),
  confirmedAt: dateTime("2026-05-04T10:00:00.000Z"),
  createdAt: dateTime("2026-05-04T09:00:00.000Z")
};

const batches = [
  activeBatch,
  {
    ...activeBatch,
    id: "validated-may",
    status: AttendanceImportBatchStatus.VALIDATED
  }
];

const vendors = [
  { id: "vendor-a", chainId: "chain-a" },
  { id: "vendor-b", chainId: "chain-b" },
  { id: "vendor-c", chainId: "chain-c" }
];

const chainAreaManagerAssignments = [
  {
    areaManagerId: "area-manager-1",
    chainId: "chain-a",
    status: AssignmentStatus.ACTIVE
  },
  {
    areaManagerId: "area-manager-1",
    chainId: "chain-b",
    status: AssignmentStatus.CLOSED
  }
];

const vendorChampAssignments = [
  {
    champId: "champ-1",
    vendorId: "vendor-b",
    status: AssignmentStatus.ACTIVE
  },
  {
    champId: "champ-1",
    vendorId: "vendor-a",
    status: AssignmentStatus.CLOSED
  }
];

const pickerBranchAssignments = [
  {
    pickerId: "picker-am-1",
    vendorId: "vendor-a",
    status: AssignmentStatus.ACTIVE
  },
  {
    pickerId: "picker-am-2",
    vendorId: "vendor-a",
    status: AssignmentStatus.ACTIVE
  },
  {
    pickerId: "picker-closed",
    vendorId: "vendor-a",
    status: AssignmentStatus.CLOSED
  },
  {
    pickerId: "picker-champ-1",
    vendorId: "vendor-b",
    status: AssignmentStatus.ACTIVE
  },
  {
    pickerId: "picker-outsider",
    vendorId: "vendor-c",
    status: AssignmentStatus.ACTIVE
  }
];

const activeRows = [
  dailyRow({
    id: "am-on-time",
    userId: "picker-am-1",
    shopperId: "AM-001",
    pickerNameSnapshot: "Area Picker One",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    sourceLocation: "Imported Branch A",
    sourceSubDivision: "Imported Chain Outside"
  }),
  dailyRow({
    id: "am-absent",
    userId: "picker-am-2",
    shopperId: "AM-002",
    pickerNameSnapshot: "Area Picker Two",
    calculatedStatus: AttendanceCalculatedStatus.ABSENT,
    isAbsent: true,
    actualCheckinTime: null,
    actualCheckoutTime: null,
    actualWorkDurationHours: null,
    sourceLocation: "Imported Branch B",
    sourceSubDivision: "Imported Chain A"
  }),
  dailyRow({
    id: "closed-assignment-row",
    userId: "picker-closed",
    shopperId: "CLOSED-001",
    pickerNameSnapshot: "Closed Assignment Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    sourceLocation: "Imported Branch A",
    sourceSubDivision: "Imported Chain A"
  }),
  dailyRow({
    id: "champ-late",
    userId: "picker-champ-1",
    shopperId: "CHAMP-001",
    pickerNameSnapshot: "Champ Picker",
    calculatedStatus: AttendanceCalculatedStatus.LATE,
    rawLateMins: 25,
    chargeableLateMins: 10,
    lateBucket: AttendanceLateBucket.LATE_1,
    sourceLocation: "Imported Branch C",
    sourceSubDivision: "Imported Chain B"
  }),
  dailyRow({
    id: "picker-own",
    userId: "picker-self",
    shopperId: "SELF-001",
    pickerNameSnapshot: "Self Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    sourceLocation: "Imported Branch Self",
    sourceSubDivision: "Imported Chain Self"
  }),
  dailyRow({
    id: "outsider",
    userId: "picker-outsider",
    shopperId: "OUT-001",
    pickerNameSnapshot: "Outside Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    sourceLocation: "Outsider Branch",
    sourceSubDivision: "Outsider Chain"
  })
];

const inactiveRows = [
  dailyRow({
    id: "validated-row",
    importBatchId: "validated-may",
    userId: "picker-am-1",
    shopperId: "VALIDATED-001",
    pickerNameSnapshot: "Validated Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME
  })
];

function actor(id: string, role: UserRole): AuthenticatedUser {
  return {
    id,
    role,
    nameEn: id,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function createPrismaMock() {
  const rows = [...activeRows, ...inactiveRows];
  const calls = {
    recordCount: [] as unknown[],
    recordFindMany: [] as unknown[]
  };

  const prisma = {
    attendanceImportBatch: {
      findFirst: async (query: { where: Record<string, unknown> }) =>
        batches.find(
          (batch) =>
            batch.periodMonth === query.where["periodMonth"] &&
            batch.status === query.where["status"]
        ) ?? null
    },
    attendanceDailyRecord: {
      count: async (query: { where: Record<string, unknown> }) => {
        calls.recordCount.push(query);
        return filterRows(rows, query.where).length;
      },
      findMany: async (query: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        calls.recordFindMany.push(query);
        const filtered = filterRows(rows, query.where);
        const start = query.skip ?? 0;
        const end = query.take === undefined ? undefined : start + query.take;

        return filtered.slice(start, end);
      }
    },
    chainAreaManagerAssignment: {
      findMany: async (query: { where: Record<string, unknown> }) =>
        chainAreaManagerAssignments.filter((assignment) =>
          matchesWhere(assignment, query.where)
        )
    },
    vendor: {
      findMany: async (query: { where: Record<string, unknown> }) =>
        vendors.filter((vendor) => matchesWhere(vendor, query.where))
    },
    vendorChampAssignment: {
      findMany: async (query: { where: Record<string, unknown> }) =>
        vendorChampAssignments.filter((assignment) =>
          matchesWhere(assignment, query.where)
        )
    },
    pickerBranchAssignment: {
      findMany: async (query: { where: Record<string, unknown> }) =>
        pickerBranchAssignments.filter((assignment) =>
          matchesWhere(assignment, query.where)
        )
    }
  };

  return { calls, prisma };
}

async function run() {
  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      { periodMonth: "2026-05" },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      [
        "am-on-time",
        "am-absent",
        "closed-assignment-row",
        "champ-late",
        "picker-own",
        "outsider"
      ]
    );
    assert.equal(result.pagination.totalRows, 6);
    assert.equal(result.analytics.attendanceRate.totalShifts, 6);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      { periodMonth: "2026-05" },
      actor("area-manager-1", UserRole.AREA_MANAGER)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["am-on-time", "am-absent"]
    );
    assert.equal(result.pagination.totalRows, 2);
    assert.deepEqual(result.summary, {
      totalRows: 2,
      onTimeCount: 1,
      lateCount: 0,
      absentCount: 1,
      leaveCount: 0,
      offDayCount: 0,
      under8HoursCount: 0,
      over15HoursCount: 0,
      totalRawLateMins: 5,
      totalChargeableLateMins: 0
    });
    assert.deepEqual(result.analytics.attendanceMix, {
      absent: { count: 1, percentage: 50 },
      attend: { count: 1, percentage: 50 },
      onLeave: { count: 0, percentage: 0 }
    });
    assert.deepEqual(result.filterOptions, {
      branches: ["Imported Branch A", "Imported Branch B"],
      chains: ["Imported Chain A", "Imported Chain Outside"],
      statuses: [
        AttendanceCalculatedStatus.ON_TIME,
        AttendanceCalculatedStatus.ABSENT
      ]
    });
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      { periodMonth: "2026-05" },
      actor("champ-1", UserRole.CHAMP)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["champ-late"]
    );
    assert.equal(result.pagination.totalRows, 1);
    assert.deepEqual(result.analytics.lateBuckets, {
      late1: { count: 1, percentage: 100 },
      late2: { count: 0, percentage: 0 },
      late3: { count: 0, percentage: 0 },
      totalLateCount: 1
    });
    assert.deepEqual(result.filterOptions.branches, ["Imported Branch C"]);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      { periodMonth: "2026-05" },
      actor("picker-self", UserRole.PICKER)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["picker-own"]
    );
    assert.equal(result.pagination.totalRows, 1);
    assert.equal(result.analytics.pickerCount, 1);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      {
        periodMonth: "2026-05",
        branch: "Outsider Branch",
        chain: "Outsider Chain",
        pageSize: 10
      },
      actor("area-manager-1", UserRole.AREA_MANAGER)
    );

    assert.deepEqual(result.rows, []);
    assert.equal(result.pagination.totalRows, 0);
    assert.equal(result.analytics.attendanceRate.totalShifts, 0);
    assert.deepEqual(result.filterOptions.branches, []);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      { periodMonth: "2026-05" },
      actor("unassigned-area-manager", UserRole.AREA_MANAGER)
    );

    assert.deepEqual(result.rows, []);
    assert.equal(result.pagination.totalRows, 0);
    assert.equal(result.analytics.attendanceRate.totalShifts, 0);
    assert.deepEqual(result.filterOptions, {
      branches: [],
      chains: [],
      statuses: []
    });
  }
}

function dailyRow(
  overrides: Partial<Omit<DailyRow, "shiftDate">> & {
    shiftDate?: string | Date;
  }
) {
  const shiftDate =
    typeof overrides.shiftDate === "string" ? overrides.shiftDate : "2026-05-01";
  const calculatedStatus =
    overrides.calculatedStatus ?? AttendanceCalculatedStatus.ON_TIME;
  const isLate = calculatedStatus === AttendanceCalculatedStatus.LATE;
  const isOnTime = calculatedStatus === AttendanceCalculatedStatus.ON_TIME;
  const isWorkingDay = isLate || isOnTime;

  return {
    id: "daily-record",
    importBatchId: "active-may",
    periodMonth: "2026-05",
    shiftDate: date(shiftDate),
    shopperId: "SHOPPER-001",
    userId: "picker-1",
    pickerNameSnapshot: "Picker One",
    sourceDesignation: "Picker",
    sourceSubDivision: "Imported Chain A",
    sourceLocation: "Imported Branch A",
    shiftName: "Morning Shift",
    scheduledStartTime: "09:00",
    scheduledEndTime: "17:00",
    actualCheckinTime: dateTime(`${shiftDate}T09:05:00.000Z`),
    actualCheckoutTime: dateTime(`${shiftDate}T17:05:00.000Z`),
    actualWorkDurationHours: 8,
    calculatedStatus,
    rawLateMins: isWorkingDay ? 5 : null,
    chargeableLateMins: isWorkingDay ? 0 : null,
    lateBucket: isWorkingDay ? AttendanceLateBucket.NONE : null,
    leaveType: null,
    isLate,
    isOnTime,
    isAbsent: false,
    isOffDay: false,
    isOnLeave: false,
    isAnnualLeave: false,
    isMedicalLeave: false,
    isWorkingDay,
    isUnder8Hours: false,
    isOver15Hours: false,
    issuesCount: 0,
    ...overrides,
    shiftDate:
      typeof overrides.shiftDate === "string"
        ? date(overrides.shiftDate)
        : overrides.shiftDate ?? date(shiftDate)
  } satisfies DailyRow;
}

function filterRows(rows: DailyRow[], where: Record<string, unknown>) {
  return rows.filter((row) => matchesWhere(row, where));
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>) {
  const and = where["AND"];
  if (Array.isArray(and) && !and.every((item) => matchesWhere(row, item))) {
    return false;
  }

  const or = where["OR"];
  if (Array.isArray(or) && !or.some((item) => matchesWhere(row, item))) {
    return false;
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR") {
      continue;
    }

    if (key === "importBatch") {
      const batch = batches.find((item) => item.id === row["importBatchId"]);
      const relation = value as { is?: { status?: AttendanceImportBatchStatus } };
      if (relation.is?.status && batch?.status !== relation.is.status) {
        return false;
      }
      continue;
    }

    if (key === "shiftDate") {
      const range = value as { gte?: Date; lte?: Date };
      const actual = row[key];
      if (!(actual instanceof Date)) {
        return false;
      }
      if (range.gte && actual < range.gte) {
        return false;
      }
      if (range.lte && actual > range.lte) {
        return false;
      }
      continue;
    }

    if (typeof value === "object" && value !== null && "in" in value) {
      const values = (value as { in: unknown[] }).in;
      if (!values.includes(row[key])) {
        return false;
      }
      continue;
    }

    if (
      key === "shopperId" ||
      key === "pickerNameSnapshot" ||
      key === "sourceLocation" ||
      key === "sourceSubDivision" ||
      key === "sourceName"
    ) {
      const actual = String(row[key] ?? "");
      if (typeof value === "object" && value !== null && "contains" in value) {
        const contains = String(
          (value as { contains: string }).contains
        ).toLowerCase();
        if (!actual.toLowerCase().includes(contains)) {
          return false;
        }
      } else if (actual !== value) {
        return false;
      }
      continue;
    }

    if (row[key] !== value) {
      return false;
    }
  }

  return true;
}

function date(value: string) {
  return dateTime(`${value}T00:00:00.000Z`);
}

function dateTime(value: string) {
  return new Date(value);
}

type DailyRow = {
  id: string;
  importBatchId: string;
  periodMonth: string;
  shiftDate: Date;
  shopperId: string;
  userId: string;
  pickerNameSnapshot: string;
  sourceDesignation: string | null;
  sourceSubDivision: string | null;
  sourceLocation: string | null;
  shiftName: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualCheckinTime: Date | null;
  actualCheckoutTime: Date | null;
  actualWorkDurationHours: number | null;
  calculatedStatus: AttendanceCalculatedStatus;
  rawLateMins: number | null;
  chargeableLateMins: number | null;
  lateBucket: AttendanceLateBucket | null;
  leaveType: null;
  isLate: boolean;
  isOnTime: boolean;
  isAbsent: boolean;
  isOffDay: boolean;
  isOnLeave: boolean;
  isAnnualLeave: boolean;
  isMedicalLeave: boolean;
  isWorkingDay: boolean;
  isUnder8Hours: boolean;
  isOver15Hours: boolean;
  issuesCount: number;
};

void run();
