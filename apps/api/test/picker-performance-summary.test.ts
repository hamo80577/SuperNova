import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  BlockStatus,
  EmploymentStatus,
  Gender,
  OrdersKpiImportBatchStatus,
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  ProfileStatus,
  UiTheme,
  UserRole,
  DeductionCaseStatus
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { WorkspacesController } from "../src/workspaces/workspaces.controller";
import { WorkspacesService } from "../src/workspaces/workspaces.service";

const dateFrom = "2026-06-01";
const dateTo = "2026-06-30";

function d(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function user(id: string, role = UserRole.PICKER) {
  return {
    id,
    ibsId: null,
    shopperId: role === UserRole.PICKER ? `SPK-${id}` : null,
    role,
    nameEn: id
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    nameAr: null,
    phoneNumber: `010-${id}`,
    nationalId: null,
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    uiTheme: UiTheme.ORANGE,
    joiningDate: d("2025-01-01"),
    employmentStatus: EmploymentStatus.ACTIVE,
    resignationDate: null,
    accountStatus: AccountStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null,
    passwordHash: "hash",
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

const users = [
  user("picker-1"),
  user("picker-2"),
  user("picker-low"),
  user("picker-chain"),
  user("picker-team"),
  user("picker-import-issue"),
  user("champ-1", UserRole.CHAMP),
  user("area-manager-1", UserRole.AREA_MANAGER)
];

const chains = [
  { id: "chain-1", chainName: "SuperMart", chainCode: "SM", status: "ACTIVE" },
  { id: "chain-2", chainName: "FreshCo", chainCode: "FC", status: "ACTIVE" }
];

const vendors = [
  {
    id: "vendor-a",
    vendorName: "Northpoint DC",
    vendorCode: "NDC",
    vendorExternalId: null,
    status: "ACTIVE",
    chainId: "chain-1",
    area: "North",
    city: "Cairo"
  },
  {
    id: "vendor-b",
    vendorName: "Eastpoint DC",
    vendorCode: "EDC",
    vendorExternalId: null,
    status: "ACTIVE",
    chainId: "chain-1",
    area: "East",
    city: "Cairo"
  },
  {
    id: "vendor-c",
    vendorName: "Fresh Hub",
    vendorCode: "FHB",
    vendorExternalId: null,
    status: "ACTIVE",
    chainId: "chain-2",
    area: "West",
    city: "Giza"
  }
];

const assignments = [
  { id: "pa-1", pickerId: "picker-1", vendorId: "vendor-a" },
  { id: "pa-2", pickerId: "picker-2", vendorId: "vendor-a" },
  { id: "pa-low", pickerId: "picker-low", vendorId: "vendor-a" },
  { id: "pa-chain", pickerId: "picker-chain", vendorId: "vendor-b" },
  { id: "pa-team", pickerId: "picker-team", vendorId: "vendor-c" },
  { id: "pa-import-issue", pickerId: "picker-import-issue", vendorId: "vendor-a" }
].map((assignment) => ({
  ...assignment,
  status: AssignmentStatus.ACTIVE,
  startDate: d("2025-01-01"),
  endDate: null,
  createdAt: d("2025-01-01"),
  updatedAt: d("2026-06-01")
}));

const kpiRecords = [
  kpi("picker-1", "vendor-a", 100, 2),
  kpi("picker-1", "vendor-a", 500, 0, OrdersKpiImportBatchStatus.VALIDATED),
  // Worse raw UHO than picker-1 but within 0.5pp and higher volume, so it ranks higher.
  kpi("picker-2", "vendor-a", 220, 5),
  kpi("picker-low", "vendor-a", 10, 0),
  kpi("picker-chain", "vendor-b", 80, 1),
  kpi("picker-team", "vendor-c", 180, 8)
];

const attendanceRecords = [
  attendance("picker-1", "2026-06-01", { isOnTime: true }),
  attendance("picker-1", "2026-06-02", { isOnTime: true }),
  attendance("picker-1", "2026-06-03", { isOnTime: true }),
  attendance("picker-1", "2026-06-04", { isOnTime: true }),
  attendance("picker-1", "2026-06-05", { isOnTime: true }),
  attendance("picker-1", "2026-06-06", { isOnTime: true }),
  attendance("picker-1", "2026-06-07", {
    isLate: true,
    isUnder8Hours: true,
    lateBucket: "LATE_1"
  }),
  attendance("picker-1", "2026-06-08", {
    isAbsent: true,
    isOver15Hours: true
  }),
  attendance("picker-2", "2026-06-01", { isOnTime: true }),
  attendance("picker-2", "2026-06-02", { isOnTime: true }),
  attendance("picker-chain", "2026-06-01", { isLate: true, lateBucket: "LATE_1" }),
  attendance("picker-team", "2026-06-01", { isOnTime: true }),
  attendance("picker-import-issue", "2026-06-01", {
    isOnTime: true,
    issuesCount: 4
  })
];

const deductionCases = [
  {
    id: "effective-1",
    targetUserId: "picker-1",
    status: DeductionCaseStatus.EFFECTIVE,
    deductionDays: 1.5,
    incidentDate: d("2026-06-10")
  },
  {
    id: "pending-1",
    targetUserId: "picker-1",
    status: DeductionCaseStatus.PENDING_APPROVAL,
    deductionDays: 2,
    incidentDate: d("2026-06-12")
  }
];

function kpi(
  pickerId: string,
  vendorId: string,
  totalOrders: number,
  unhealthyOrders: number,
  batchStatus = OrdersKpiImportBatchStatus.CONFIRMED
) {
  const vendor = vendors.find((item) => item.id === vendorId)!;
  return {
    id: `${pickerId}-${vendorId}`,
    sourceBatchId: "batch-1",
    sourceBatch: { status: batchStatus },
    kpiDate: d("2026-06-15"),
    sourceVendorId: vendorId,
    matchedVendorId: vendorId,
    matchedChainId: vendor.chainId,
    vendorNameSnapshot: vendor.vendorName,
    chainNameSnapshot: chains.find((item) => item.id === vendor.chainId)!.chainName,
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    sourceShopperId: `SPK-${pickerId}`,
    sourcePickerKey: `SPK-${pickerId}`,
    userId: pickerId,
    pickerNameSnapshot: user(pickerId).nameEn,
    pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_PICKER,
    totalOrders,
    successfulOrders: totalOrders - unhealthyOrders,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders,
    orderNotOnTime: unhealthyOrders + 3,
    partialRefund: 0,
    vendorDelay: 0,
    preparationTime: null,
    outOfStock: 0,
    firNotOnTime: 0,
    priceModified: 0,
    issuesCount: 0
  };
}

function attendance(
  userId: string,
  shiftDate: string,
  flags: {
    isOnTime?: boolean;
    isLate?: boolean;
    isAbsent?: boolean;
    isUnder8Hours?: boolean;
    isOver15Hours?: boolean;
    issuesCount?: number;
    lateBucket?: "LATE_1" | "LATE_2" | "LATE_3";
  }
) {
  return {
    userId,
    shiftDate: d(shiftDate),
    isOnTime: flags.isOnTime ?? false,
    isLate: flags.isLate ?? false,
    isAbsent: flags.isAbsent ?? false,
    isUnder8Hours: flags.isUnder8Hours ?? false,
    isOver15Hours: flags.isOver15Hours ?? false,
    issuesCount: flags.issuesCount ?? 0,
    lateBucket: flags.lateBucket ?? null,
    calculatedStatus: flags.isAbsent ? "ABSENT" : flags.isLate ? "LATE" : "ON_TIME"
  };
}

function createPrisma() {
  const prisma = {
    $transaction: async (queries: Array<Promise<unknown>>) => Promise.all(queries),
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((item) => item.id === where.id) ?? null
    },
    pickerBranchAssignment: {
      findFirst: async ({ where }: { where: { pickerId: string } }) => {
        const assignment = assignments.find(
          (item) => item.pickerId === where.pickerId
        );
        return assignment ? hydrateAssignment(assignment) : null;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        assignments
          .filter((assignment) => matchesAssignmentWhere(assignment, where))
          .map(hydrateAssignment)
    },
    vendorChampAssignment: {
      findFirst: async ({ where }: { where: { vendorId: string } }) =>
        where.vendorId === "vendor-a"
          ? { id: "vca-1", champId: "champ-1", champ: users.find((item) => item.id === "champ-1") }
          : null
    },
    chainAreaManagerAssignment: {
      findFirst: async ({ where }: { where: { chainId: string } }) =>
        where.chainId === "chain-1"
          ? {
              id: "cama-1",
              areaManagerId: "area-manager-1",
              areaManager: users.find((item) => item.id === "area-manager-1")
            }
          : null
    },
    attendanceDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        attendanceRecords.filter((record) => matchesDateAndUser(record, where))
    },
    ordersKpiDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        kpiRecords.filter((record) => matchesDateAndUser(record, where))
    },
    deductionCase: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        deductionCases.filter((item) => matchesDeductionWhere(item, where))
    }
  };

  return prisma;
}

function hydrateAssignment(assignment: (typeof assignments)[number]) {
  const vendor = vendors.find((item) => item.id === assignment.vendorId)!;
  const chain = chains.find((item) => item.id === vendor.chainId)!;
  return {
    ...assignment,
    picker: users.find((item) => item.id === assignment.pickerId),
    vendor: { ...vendor, chain }
  };
}

function matchesAssignmentWhere(
  assignment: (typeof assignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  if (where.status && assignment.status !== where.status) return false;
  if (where.pickerId && assignment.pickerId !== where.pickerId) return false;
  if (where.vendorId && assignment.vendorId !== where.vendorId) return false;
  const vendorWhere = where.vendor as { chainId?: string } | undefined;
  if (vendorWhere?.chainId) {
    const vendor = vendors.find((item) => item.id === assignment.vendorId);
    if (vendor?.chainId !== vendorWhere.chainId) return false;
  }
  return true;
}

function matchesDateAndUser(
  record: {
    userId: string | null;
    kpiDate?: Date;
    shiftDate?: Date;
    sourceBatch?: { status: OrdersKpiImportBatchStatus };
  },
  where: Record<string, unknown>
) {
  const sourceBatchWhere = where.sourceBatch as
    | { is?: { status?: OrdersKpiImportBatchStatus } }
    | undefined;
  if (
    sourceBatchWhere?.is?.status &&
    record.sourceBatch?.status !== sourceBatchWhere.is.status
  ) {
    return false;
  }

  const userIdFilter = where.userId as string | { in?: string[] } | undefined;
  if (typeof userIdFilter === "string" && record.userId !== userIdFilter) {
    return false;
  }
  if (
    typeof userIdFilter === "object" &&
    userIdFilter.in &&
    !userIdFilter.in.includes(record.userId ?? "")
  ) {
    return false;
  }
  const date = record.kpiDate ?? record.shiftDate;
  const dateFilter = (where.kpiDate ?? where.shiftDate) as
    | { gte?: Date; lte?: Date; lt?: Date }
    | undefined;
  if (!date || !dateFilter) return true;
  return (
    (!dateFilter.gte || date >= dateFilter.gte) &&
    (!dateFilter.lte || date <= dateFilter.lte) &&
    (!dateFilter.lt || date < dateFilter.lt)
  );
}

function matchesDeductionWhere(
  item: (typeof deductionCases)[number],
  where: Record<string, unknown>
) {
  if (where.targetUserId && item.targetUserId !== where.targetUserId) {
    return false;
  }
  if (where.status && item.status !== where.status) {
    return false;
  }
  const incidentDate = where.incidentDate as { gte?: Date; lte?: Date } | undefined;
  return (
    !incidentDate ||
    ((!incidentDate.gte || item.incidentDate >= incidentDate.gte) &&
      (!incidentDate.lte || item.incidentDate <= incidentDate.lte))
  );
}

function createService() {
  const targetSettingsService = {
    getTargetSettingsForReport: async () => ({
      id: "global",
      source: "SAVED",
      targets: {
        uhoRateTarget: 3,
        notOnTimeRateTarget: 10,
        qcFailedRateTarget: 5,
        partialRefundRateTarget: 3,
        oosRateTarget: 3,
        priceModifiedRateTarget: 3
      },
      updatedByUserId: "admin-1",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    })
  };
  const annualLeaveBalanceService = {
    getForUser: async () => ({
      eligibilityStatus: "ELIGIBLE",
      carriedBalanceDays: 7,
      currentYearAccruedDays: 10.5,
      annualTakenThisYear: 2,
      remainingDays: 15.5
    })
  };

  return new (WorkspacesService as any)(
    createPrisma(),
    targetSettingsService,
    annualLeaveBalanceService,
    {
      getOrCalculate: ({ calculate }: { calculate: () => Promise<unknown> }) =>
        calculate()
    }
  );
}

async function testControllerIsPickerOnly() {
  const handler = (WorkspacesController as any).prototype
    .getPickerPerformanceSummary;
  assert.equal(typeof handler, "function");
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, handler),
    [UserRole.PICKER]
  );
}

async function testSummaryUsesAssignmentContextAndOwnMetrics() {
  const service = createService();
  const summary = await service.getPickerPerformanceSummary("picker-1", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.identity.branchName, "Northpoint DC");
  assert.equal(summary.identity.chainName, "SuperMart");
  assert.equal(summary.identity.areaManagerName, "Area Manager 1");
  assert.equal(summary.identity.champName, "Champ 1");
  assert.equal(summary.ordersKpi.totalOrders, 100);
  assert.equal(summary.ordersKpi.unhealthyOrders, 2);
  assert.equal(summary.ordersKpi.target.status, "IN_TARGET");
  assert.deepEqual(summary.ordersKpi.series, [
    {
      date: "2026-06-15",
      totalOrders: 100,
      unhealthyOrders: 2,
      unhealthyRate: 2
    }
  ]);
  assert.equal(summary.attendance.totalShiftErrors, 4);
  assert.equal(summary.attendance.lateCount, 1);
  assert.equal(summary.attendance.absentCount, 1);
  assert.equal(summary.attendance.under8HoursCount, 1);
  assert.equal(summary.attendance.over15HoursCount, 1);
}

async function testAttendanceHealthUsesCleanShiftRateAndCountsMultiIssueShiftOnce() {
  const service = createService();
  const summary = await service.getPickerPerformanceSummary("picker-1", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.attendance.available, true);
  assert.equal(summary.attendance.totalShifts, 8);
  assert.equal(summary.attendance.cleanShifts, 6);
  assert.equal(summary.attendance.issueShifts, 2);
  assert.equal(summary.attendance.attendanceHealthRate, 75);
  assert.equal(summary.attendance.attendanceRate, 75);
  assert.equal(summary.attendance.presenceRate, 87.5);
  assert.equal(summary.attendance.totalShiftErrors, 4);
  assert.equal(summary.attendance.lateCount, 1);
  assert.equal(summary.attendance.absentCount, 1);
  assert.equal(summary.attendance.under8Count, 1);
  assert.equal(summary.attendance.over15Count, 1);
  assert.equal(summary.attendance.under8HoursCount, 1);
  assert.equal(summary.attendance.over15HoursCount, 1);
  assert.equal(summary.attendance.series.length, 8);
  assert.deepEqual(summary.attendance.series[0], {
    date: "2026-06-01",
    totalShifts: 1,
    cleanShifts: 1,
    issueShifts: 0,
    attendanceHealthRate: 100,
    totalShiftErrors: 0
  });
  assert.deepEqual(summary.attendance.series[6], {
    date: "2026-06-07",
    totalShifts: 1,
    cleanShifts: 0,
    issueShifts: 1,
    attendanceHealthRate: 0,
    totalShiftErrors: 2
  });
  assert.deepEqual(summary.attendance.series[7], {
    date: "2026-06-08",
    totalShifts: 1,
    cleanShifts: 0,
    issueShifts: 1,
    attendanceHealthRate: 0,
    totalShiftErrors: 2
  });
}

async function testAttendanceImportIssuesDoNotCountAsShiftHealthErrors() {
  const service = createService();
  const summary = await service.getPickerPerformanceSummary("picker-import-issue", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.attendance.available, true);
  assert.equal(summary.attendance.totalShifts, 1);
  assert.equal(summary.attendance.cleanShifts, 1);
  assert.equal(summary.attendance.issueShifts, 0);
  assert.equal(summary.attendance.attendanceHealthRate, 100);
  assert.equal(summary.attendance.totalShiftErrors, 0);
  assert.equal(summary.attendance.lateCount, 0);
  assert.equal(summary.attendance.absentCount, 0);
  assert.equal(summary.attendance.under8Count, 0);
  assert.equal(summary.attendance.over15Count, 0);
}

async function testRankingIsVolumeAwareAndServerScoped() {
  const service = createService();
  const summary = await service.getPickerPerformanceSummary("picker-1", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.ranking.basis, "UHO_VOLUME_AWARE");
  assert.equal(summary.ranking.branch.rank, 2);
  assert.equal(summary.ranking.branch.previousRank, null);
  assert.equal(summary.ranking.branch.rankChange, null);
  assert.equal(summary.ranking.branch.totalEligible, 2);
  assert.equal(summary.ranking.branch.totalOrders, 100);
  assert.equal(summary.ranking.branch.unhealthyRate, 2);
  assert.equal(summary.ranking.branch.displayLabel, "#2 / 2");
  assert.equal(summary.ranking.chain.totalEligible, 3);
  assert.equal(summary.ranking.allTeam.totalEligible, 4);
}

async function testLowVolumePickerIsNotRanked() {
  const service = createService();
  const summary = await service.getPickerPerformanceSummary("picker-low", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.ranking.branch.ranked, false);
  assert.equal(summary.ranking.branch.reason, "LOW_ORDER_VOLUME");
  assert.equal(summary.ranking.branch.displayLabel, "Not ranked - low order volume");
}

async function testPendingDeductionsRemainHiddenFromPickerSummary() {
  const service = createService();
  const summary = await service.getPickerPerformanceSummary("picker-1", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.deductions.totalEffectiveDays, 1.5);
  assert.equal(summary.deductions.effectiveCasesCount, 1);
  assert.equal(summary.deductions.pendingHiddenByPolicy, true);
}

async function main() {
  await testControllerIsPickerOnly();
  await testSummaryUsesAssignmentContextAndOwnMetrics();
  await testAttendanceHealthUsesCleanShiftRateAndCountsMultiIssueShiftOnce();
  await testAttendanceImportIssuesDoNotCountAsShiftHealthErrors();
  await testRankingIsVolumeAwareAndServerScoped();
  await testLowVolumePickerIsNotRanked();
  await testPendingDeductionsRemainHiddenFromPickerSummary();
  console.log("picker performance summary tests passed");
}

void main();
