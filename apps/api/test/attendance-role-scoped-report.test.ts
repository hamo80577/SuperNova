import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  AttendanceCalculatedStatus,
  AttendanceImportBatchStatus,
  AttendanceLateBucket,
  AttendanceLocationMappingStatus,
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
    id: "reported-chain-a",
    userId: "picker-outsider",
    shopperId: "RCA-001",
    pickerNameSnapshot: "Reported Chain A Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    reportedVendorId: "vendor-a",
    reportedChainId: "chain-a",
    reportedLocationCode: "100001",
    reportedLocationName: "Reported Branch A",
    reportedLocationRaw: "100001 - Reported Branch A",
    sourceLocation: "Source Branch Different",
    sourceSubDivision: "Source Chain Different"
  }),
  dailyRow({
    id: "current-assignment-only",
    userId: "picker-am-1",
    shopperId: "CUR-001",
    pickerNameSnapshot: "Current Assignment Only",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    reportedVendorId: "vendor-c",
    reportedChainId: "chain-c",
    reportedLocationCode: "300001",
    reportedLocationName: "Reported Branch C",
    reportedLocationRaw: "300001 - Reported Branch C",
    sourceLocation: "Imported Branch A",
    sourceSubDivision: "Imported Chain A"
  }),
  dailyRow({
    id: "unmapped-current-area",
    userId: "picker-am-2",
    shopperId: "UNMAP-001",
    pickerNameSnapshot: "Unmapped Current Area Picker",
    calculatedStatus: AttendanceCalculatedStatus.ABSENT,
    isAbsent: true,
    actualCheckinTime: null,
    actualCheckoutTime: null,
    actualWorkDurationHours: null,
    reportedVendorId: null,
    reportedChainId: null,
    reportedLocationCode: "999999",
    reportedLocationName: "Unmapped Historical Branch",
    reportedLocationRaw: "999999 - Unmapped Historical Branch",
    locationMappingStatus: AttendanceLocationMappingStatus.UNMAPPED,
    sourceLocation: "Imported Branch A",
    sourceSubDivision: "Imported Chain A"
  }),
  dailyRow({
    id: "reported-vendor-b",
    userId: "picker-outsider",
    shopperId: "RVB-001",
    pickerNameSnapshot: "Reported Vendor B Picker",
    calculatedStatus: AttendanceCalculatedStatus.LATE,
    rawLateMins: 25,
    chargeableLateMins: 10,
    lateBucket: AttendanceLateBucket.LATE_1,
    reportedVendorId: "vendor-b",
    reportedChainId: "chain-b",
    reportedLocationCode: "200001",
    reportedLocationName: "Reported Branch B",
    reportedLocationRaw: "200001 - Reported Branch B",
    sourceLocation: "Source Branch Other",
    sourceSubDivision: "Source Chain Other"
  }),
  dailyRow({
    id: "current-vendor-only",
    userId: "picker-champ-1",
    shopperId: "CUR-CHAMP-001",
    pickerNameSnapshot: "Current Vendor Only",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    reportedVendorId: "vendor-c",
    reportedChainId: "chain-c",
    reportedLocationCode: "300002",
    reportedLocationName: "Reported Branch C",
    reportedLocationRaw: "300002 - Reported Branch C",
    sourceLocation: "Imported Branch C",
    sourceSubDivision: "Imported Chain B"
  }),
  dailyRow({
    id: "picker-own-chain-a",
    userId: "picker-self",
    shopperId: "SELF-001",
    pickerNameSnapshot: "Self Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    reportedVendorId: "vendor-a",
    reportedChainId: "chain-a",
    reportedLocationCode: "100002",
    reportedLocationName: "Self Reported Branch A",
    reportedLocationRaw: "100002 - Self Reported Branch A",
    sourceLocation: "Imported Branch Self",
    sourceSubDivision: "Imported Chain Self"
  }),
  dailyRow({
    id: "picker-own-unmapped",
    userId: "picker-self",
    shopperId: "SELF-002",
    pickerNameSnapshot: "Self Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    reportedVendorId: null,
    reportedChainId: null,
    reportedLocationCode: "888888",
    reportedLocationName: "Self Unmapped Branch",
    reportedLocationRaw: "888888 - Self Unmapped Branch",
    locationMappingStatus: AttendanceLocationMappingStatus.UNMAPPED,
    sourceLocation: "Imported Unmapped Self",
    sourceSubDivision: "Imported Chain Self"
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
        "reported-chain-a",
        "current-assignment-only",
        "unmapped-current-area",
        "reported-vendor-b",
        "current-vendor-only",
        "picker-own-chain-a",
        "picker-own-unmapped"
      ]
    );
    assert.equal(result.pagination.totalRows, 7);
    assert.equal(result.analytics.attendanceRate.totalShifts, 7);
    assert.equal(
      result.rows.some(
        (row) =>
          (row as { locationMappingStatus?: string }).locationMappingStatus ===
          "UNMAPPED"
      ),
      true
    );
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
      ["reported-chain-a", "picker-own-chain-a"]
    );
    assert.equal(result.pagination.totalRows, 2);
    assert.deepEqual(result.summary, {
      totalRows: 2,
      onTimeCount: 2,
      lateCount: 0,
      absentCount: 0,
      leaveCount: 0,
      offDayCount: 0,
      under8HoursCount: 0,
      over15HoursCount: 0,
      totalRawLateMins: 10,
      totalChargeableLateMins: 0
    });
    assert.deepEqual(result.analytics.attendanceMix, {
      absent: { count: 0, percentage: 0 },
      attend: { count: 2, percentage: 100 },
      onLeave: { count: 0, percentage: 0 }
    });
    assert.deepEqual(result.filterOptions, {
      branches: ["Reported Branch A", "Self Reported Branch A"],
      chains: ["chain-a"],
      statuses: [
        AttendanceCalculatedStatus.ON_TIME
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
      ["reported-vendor-b"]
    );
    assert.equal(result.pagination.totalRows, 1);
    assert.deepEqual(result.analytics.lateBuckets, {
      late1: { count: 1, percentage: 100 },
      late2: { count: 0, percentage: 0 },
      late3: { count: 0, percentage: 0 },
      totalLateCount: 1
    });
    assert.deepEqual(result.filterOptions.branches, ["Reported Branch B"]);
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
      ["picker-own-chain-a", "picker-own-unmapped"]
    );
    assert.equal(result.pagination.totalRows, 2);
    assert.equal(result.analytics.pickerCount, 1);
    assert.equal(
      result.rows.some(
        (row) =>
          (row as { locationMappingStatus?: string }).locationMappingStatus ===
          "UNMAPPED"
      ),
      true
    );
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport(
      {
        periodMonth: "2026-05",
        branch: "Reported Branch C",
        chain: "chain-c",
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
      {
        periodMonth: "2026-05",
        branch: "100001"
      },
      actor("admin-1", UserRole.ADMIN)
    );

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["reported-chain-a"]
    );
    assert.equal(result.summary.totalRows, 1);
    assert.equal(result.analytics.attendanceRate.totalShifts, 1);
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
    reportedVendorId: "vendor-a",
    reportedChainId: "chain-a",
    reportedLocationCode: "100001",
    reportedLocationName: "Reported Branch A",
    reportedLocationRaw: "100001 - Reported Branch A",
    locationMappingStatus: AttendanceLocationMappingStatus.MAPPED_VENDOR_CODE,
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
      key === "reportedLocationCode" ||
      key === "reportedLocationName" ||
      key === "reportedLocationRaw" ||
      key === "reportedChainId" ||
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
  reportedVendorId: string | null;
  reportedChainId: string | null;
  reportedLocationCode: string | null;
  reportedLocationName: string | null;
  reportedLocationRaw: string | null;
  locationMappingStatus: AttendanceLocationMappingStatus;
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
