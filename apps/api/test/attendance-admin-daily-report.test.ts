import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  AttendanceCalculatedStatus,
  AttendanceImportBatchStatus,
  AttendanceLateBucket,
  AttendanceLeaveType,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { AttendanceReportsController } from "../src/attendance/attendance-reports.controller";
import { AttendanceReportService } from "../src/attendance/attendance-report.service";
import type { AttendanceDailyReportQuery } from "../src/attendance/attendance-report.types";

const activeBatch = {
  id: "active-may",
  periodMonth: "2026-05",
  status: AttendanceImportBatchStatus.ACTIVE,
  coverageStartDate: date("2026-05-01"),
  coverageEndDate: date("2026-05-06"),
  expectedCoverageEndDate: date("2026-05-06"),
  confirmedAt: dateTime("2026-05-07T10:00:00.000Z"),
  createdAt: dateTime("2026-05-07T09:00:00.000Z")
};

const batches = [
  activeBatch,
  {
    ...activeBatch,
    id: "validated-may",
    status: AttendanceImportBatchStatus.VALIDATED
  },
  {
    ...activeBatch,
    id: "failed-may",
    status: AttendanceImportBatchStatus.FAILED
  },
  {
    ...activeBatch,
    id: "replaced-may",
    status: AttendanceImportBatchStatus.REPLACED
  },
  {
    ...activeBatch,
    id: "active-april",
    periodMonth: "2026-04"
  }
];

const activeRows = [
  dailyRow({
    id: "r-1",
    importBatchId: "active-may",
    shiftDate: "2026-05-01",
    shopperId: "SHOPPER-001",
    pickerNameSnapshot: "Aya Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME,
    rawLateMins: 5,
    chargeableLateMins: 0,
    lateBucket: AttendanceLateBucket.NONE,
    actualWorkDurationHours: 8
  }),
  dailyRow({
    id: "r-2",
    importBatchId: "active-may",
    shiftDate: "2026-05-02",
    shopperId: "SHOPPER-002",
    pickerNameSnapshot: "Bassem Picker",
    calculatedStatus: AttendanceCalculatedStatus.LATE,
    rawLateMins: 35,
    chargeableLateMins: 20,
    lateBucket: AttendanceLateBucket.LATE_2,
    actualWorkDurationHours: 7.5,
    isUnder8Hours: true
  }),
  dailyRow({
    id: "r-3",
    importBatchId: "active-may",
    shiftDate: "2026-05-03",
    shopperId: "SHOPPER-003",
    pickerNameSnapshot: "Carla Picker",
    calculatedStatus: AttendanceCalculatedStatus.LATE,
    rawLateMins: 50,
    chargeableLateMins: 35,
    lateBucket: AttendanceLateBucket.LATE_3,
    actualWorkDurationHours: 16,
    isOver15Hours: true
  }),
  dailyRow({
    id: "r-4",
    importBatchId: "active-may",
    shiftDate: "2026-05-04",
    shopperId: "SHOPPER-004",
    pickerNameSnapshot: "Dina Picker",
    calculatedStatus: AttendanceCalculatedStatus.ABSENT,
    isAbsent: true,
    actualCheckinTime: null,
    actualCheckoutTime: null,
    actualWorkDurationHours: null
  }),
  dailyRow({
    id: "r-5",
    importBatchId: "active-may",
    shiftDate: "2026-05-05",
    shopperId: "SHOPPER-005",
    pickerNameSnapshot: "Eman Picker",
    calculatedStatus: AttendanceCalculatedStatus.ANNUAL_LEAVE,
    isOnLeave: true,
    isAnnualLeave: true,
    leaveType: AttendanceLeaveType.ANNUAL_LEAVE,
    actualCheckinTime: null,
    actualCheckoutTime: null,
    actualWorkDurationHours: null
  }),
  dailyRow({
    id: "r-6",
    importBatchId: "active-may",
    shiftDate: "2026-05-06",
    shopperId: "SHOPPER-006",
    pickerNameSnapshot: "Fady Picker",
    calculatedStatus: AttendanceCalculatedStatus.OFF_DAY,
    isOffDay: true,
    actualCheckinTime: null,
    actualCheckoutTime: null,
    actualWorkDurationHours: null
  })
];

const inactiveRows = [
  dailyRow({
    id: "validated-row",
    importBatchId: "validated-may",
    shiftDate: "2026-05-01",
    shopperId: "VALIDATED-001",
    pickerNameSnapshot: "Validated Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME
  }),
  dailyRow({
    id: "failed-row",
    importBatchId: "failed-may",
    shiftDate: "2026-05-01",
    shopperId: "FAILED-001",
    pickerNameSnapshot: "Failed Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME
  }),
  dailyRow({
    id: "replaced-row",
    importBatchId: "replaced-may",
    shiftDate: "2026-05-01",
    shopperId: "REPLACED-001",
    pickerNameSnapshot: "Replaced Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME
  }),
  dailyRow({
    id: "april-row",
    importBatchId: "active-april",
    periodMonth: "2026-04",
    shiftDate: "2026-04-30",
    shopperId: "APRIL-001",
    pickerNameSnapshot: "April Picker",
    calculatedStatus: AttendanceCalculatedStatus.ON_TIME
  })
];

function actor(role: UserRole): AuthenticatedUser {
  return {
    id: `actor-${role.toLowerCase()}`,
    role,
    nameEn: role,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function rolesFor(methodName: keyof AttendanceReportsController) {
  return Reflect.getMetadata(
    ROLES_KEY,
    AttendanceReportsController.prototype[methodName]
  );
}

function createPrismaMock() {
  const calls: {
    batchFindFirst: unknown[];
    recordCount: unknown[];
    recordFindMany: unknown[];
    writes: string[];
  } = {
    batchFindFirst: [],
    recordCount: [],
    recordFindMany: [],
    writes: []
  };
  const rows = [...activeRows, ...inactiveRows];

  const prisma = {
    attendanceImportBatch: {
      findFirst: async (query: { where: Record<string, unknown> }) => {
        calls.batchFindFirst.push(query);
        return (
          batches.find(
            (batch) =>
              batch.periodMonth === query.where["periodMonth"] &&
              batch.status === query.where["status"]
          ) ?? null
        );
      },
      create: forbiddenWrite("attendanceImportBatch.create", calls.writes),
      update: forbiddenWrite("attendanceImportBatch.update", calls.writes),
      delete: forbiddenWrite("attendanceImportBatch.delete", calls.writes)
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
      },
      create: forbiddenWrite("attendanceDailyRecord.create", calls.writes),
      createMany: forbiddenWrite("attendanceDailyRecord.createMany", calls.writes),
      update: forbiddenWrite("attendanceDailyRecord.update", calls.writes),
      delete: forbiddenWrite("attendanceDailyRecord.delete", calls.writes)
    },
    attendancePickerMonthlySummary: {
      create: forbiddenWrite(
        "attendancePickerMonthlySummary.create",
        calls.writes
      ),
      createMany: forbiddenWrite(
        "attendancePickerMonthlySummary.createMany",
        calls.writes
      ),
      update: forbiddenWrite(
        "attendancePickerMonthlySummary.update",
        calls.writes
      ),
      delete: forbiddenWrite(
        "attendancePickerMonthlySummary.delete",
        calls.writes
      )
    },
    attendanceImportIssue: {
      create: forbiddenWrite("attendanceImportIssue.create", calls.writes),
      createMany: forbiddenWrite("attendanceImportIssue.createMany", calls.writes),
      update: forbiddenWrite("attendanceImportIssue.update", calls.writes),
      delete: forbiddenWrite("attendanceImportIssue.delete", calls.writes)
    },
    auditLog: {
      create: forbiddenWrite("auditLog.create", calls.writes)
    }
  };

  return { prisma, calls };
}

async function run() {
  {
    const { prisma, calls } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport({ periodMonth: "2026-05" });

    assert.equal(result.periodMonth, "2026-05");
    assert.equal(result.activeBatchId, "active-may");
    assert.equal(result.coverageStartDate, "2026-05-01");
    assert.equal(result.coverageEndDate, "2026-05-06");
    assert.equal(result.expectedCoverageEndDate, "2026-05-06");
    assert.deepEqual(result.pagination, {
      page: 1,
      pageSize: 50,
      totalRows: 6,
      totalPages: 1
    });
    assert.deepEqual(result.summary, {
      totalRows: 6,
      onTimeCount: 1,
      lateCount: 2,
      absentCount: 1,
      leaveCount: 1,
      offDayCount: 1,
      under8HoursCount: 1,
      over15HoursCount: 1,
      totalRawLateMins: 90,
      totalChargeableLateMins: 55
    });
    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["r-1", "r-2", "r-3", "r-4", "r-5", "r-6"]
    );
    assert.equal(result.rows[0]?.pickerName, "Aya Picker");
    assert.equal(result.rows[0]?.shiftDate, "2026-05-01");
    assert.equal(result.rows[0]?.actualCheckinTime, "09:05");
    assert.equal(result.rows[0]?.actualWorkDurationHours, 8);
    assert.deepEqual(calls.writes, []);
    assertRecordReadsRequireActiveBatch(calls.recordFindMany);
  }

  {
    const service = new AttendanceReportService(createPrismaMock().prisma as never);

    await assert.rejects(
      () => service.getDailyReport({}),
      (error) =>
        error instanceof BadRequestException &&
        String(error.message).includes("periodMonth is required")
    );

    await assert.rejects(
      () => service.getDailyReport({ periodMonth: "2026/05" }),
      (error) =>
        error instanceof BadRequestException &&
        String(error.message).includes("periodMonth must use YYYY-MM format")
    );
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport({ periodMonth: "2026-06" });

    assert.equal(result.periodMonth, "2026-06");
    assert.equal(result.activeBatchId, null);
    assert.deepEqual(result.rows, []);
    assert.equal(result.summary.totalRows, 0);
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);

    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          dateFrom: "2026-05-02",
          dateTo: "2026-05-05"
        })
      ).rows.map((row) => row.id),
      ["r-2", "r-3", "r-4", "r-5"]
    );
    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          status: AttendanceCalculatedStatus.ABSENT
        })
      ).rows.map((row) => row.id),
      ["r-4"]
    );
    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          lateOnly: true
        })
      ).rows.map((row) => row.id),
      ["r-2", "r-3"]
    );
    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          absentOnly: true
        })
      ).rows.map((row) => row.id),
      ["r-4"]
    );
    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          onLeaveOnly: true
        })
      ).rows.map((row) => row.id),
      ["r-5"]
    );
    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          shopperId: "002"
        })
      ).rows.map((row) => row.id),
      ["r-2"]
    );
    assert.deepEqual(
      (
        await service.getDailyReport({
          periodMonth: "2026-05",
          pickerSearch: "carla"
        })
      ).rows.map((row) => row.id),
      ["r-3"]
    );
  }

  {
    const { prisma } = createPrismaMock();
    const service = new AttendanceReportService(prisma as never);
    const result = await service.getDailyReport({
      periodMonth: "2026-05",
      page: 2,
      pageSize: 2
    });

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["r-3", "r-4"]
    );
    assert.deepEqual(result.pagination, {
      page: 2,
      pageSize: 2,
      totalRows: 6,
      totalPages: 3
    });

    const capped = await service.getDailyReport({
      periodMonth: "2026-05",
      pageSize: 999
    });
    assert.equal(capped.pagination.pageSize, 100);
  }

  {
    const { prisma } = createPrismaMock();
    const reportService = new AttendanceReportService(prisma as never);
    const serviceCalls: AttendanceDailyReportQuery[] = [];
    const service = {
      getDailyReport: async (query: AttendanceDailyReportQuery) => {
        serviceCalls.push(query);
        return reportService.getDailyReport(query);
      }
    } as AttendanceReportService;
    const controller = new AttendanceReportsController(service);
    const admin = actor(UserRole.ADMIN);
    const superAdmin = actor(UserRole.SUPER_ADMIN);

    assert.deepEqual(rolesFor("getDailyReport"), [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN
    ]);
    assert.equal(rolesFor("getDailyReport").includes(UserRole.PICKER), false);
    assert.equal(rolesFor("getDailyReport").includes(UserRole.CHAMP), false);
    assert.equal(
      rolesFor("getDailyReport").includes(UserRole.AREA_MANAGER),
      false
    );

    await controller.getDailyReport(admin, { periodMonth: "2026-05" });
    await controller.getDailyReport(superAdmin, { periodMonth: "2026-05" });

    assert.deepEqual(serviceCalls, [
      { periodMonth: "2026-05" },
      { periodMonth: "2026-05" }
    ]);

    for (const role of [
      UserRole.PICKER,
      UserRole.CHAMP,
      UserRole.AREA_MANAGER
    ]) {
      assert.throws(
        () =>
          controller.getDailyReport(actor(role), {
            periodMonth: "2026-05"
          }),
        ForbiddenException
      );
    }
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
    userId: `user-${overrides.shopperId ?? "SHOPPER-001"}`,
    pickerNameSnapshot: "Picker One",
    sourceDesignation: "Picker",
    sourceLocation: "Branch A",
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
    shiftDate: typeof overrides.shiftDate === "string"
      ? date(overrides.shiftDate)
      : overrides.shiftDate ?? date(shiftDate)
  } satisfies DailyRow;
}

function filterRows(rows: DailyRow[], where: Record<string, unknown>) {
  return rows
    .filter((row) => matchesWhere(row, where))
    .sort((left, right) => {
      const dateCompare = left.shiftDate.getTime() - right.shiftDate.getTime();
      return (
        dateCompare ||
        left.pickerNameSnapshot.localeCompare(right.pickerNameSnapshot) ||
        left.shopperId.localeCompare(right.shopperId)
      );
    });
}

function matchesWhere(row: DailyRow, where: Record<string, unknown>): boolean {
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
      const batch = batches.find((item) => item.id === row.importBatchId);
      const relation = value as { is?: { status?: AttendanceImportBatchStatus } };
      if (relation.is?.status && batch?.status !== relation.is.status) {
        return false;
      }
      continue;
    }

    if (key === "shiftDate") {
      const range = value as { gte?: Date; lte?: Date };
      if (range.gte && row.shiftDate < range.gte) {
        return false;
      }
      if (range.lte && row.shiftDate > range.lte) {
        return false;
      }
      continue;
    }

    if (key === "shopperId" || key === "pickerNameSnapshot") {
      const actual = String(row[key as keyof DailyRow] ?? "");
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

    if (row[key as keyof DailyRow] !== value) {
      return false;
    }
  }

  return true;
}

function assertRecordReadsRequireActiveBatch(findManyCalls: unknown[]) {
  assert.ok(findManyCalls.length >= 1);

  for (const call of findManyCalls) {
    const where = (call as { where: Record<string, unknown> }).where;
    assert.deepEqual(where["importBatch"], {
      is: { status: AttendanceImportBatchStatus.ACTIVE }
    });
    assert.equal(where["importBatchId"], "active-may");
  }
}

function forbiddenWrite(name: string, writes: string[]) {
  return async () => {
    writes.push(name);
    throw new Error(`${name} is out of scope for attendance daily reports.`);
  };
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
  leaveType: AttendanceLeaveType | null;
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
