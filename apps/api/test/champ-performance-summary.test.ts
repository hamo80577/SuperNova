import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
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
  RequestStatus,
  RequestType,
  UiTheme,
  UserRole
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { WorkspacesController } from "../src/workspaces/workspaces.controller";
import { WorkspacesService } from "../src/workspaces/workspaces.service";

const dateFrom = "2026-06-01";
const dateTo = "2026-06-07";

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
  user("champ-1", UserRole.CHAMP),
  user("champ-2", UserRole.CHAMP),
  user("area-manager-1", UserRole.AREA_MANAGER),
  user("admin-1", UserRole.ADMIN),
  user("picker-1"),
  user("picker-2"),
  user("picker-low"),
  user("picker-branch-b"),
  user("picker-out")
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
    vendorName: "Alpha Hub",
    vendorCode: "AHB",
    vendorExternalId: null,
    status: "ACTIVE",
    chainId: "chain-1",
    area: "East",
    city: "Cairo"
  },
  {
    id: "vendor-c",
    vendorName: "Unassigned Same Chain",
    vendorCode: "USC",
    vendorExternalId: null,
    status: "ACTIVE",
    chainId: "chain-1",
    area: "South",
    city: "Cairo"
  },
  {
    id: "vendor-low",
    vendorName: "Low Volume Branch",
    vendorCode: "LVB",
    vendorExternalId: null,
    status: "ACTIVE",
    chainId: "chain-1",
    area: "West",
    city: "Giza"
  }
];

const champAssignments = [
  { id: "vca-a", champId: "champ-1", vendorId: "vendor-a" },
  { id: "vca-b", champId: "champ-1", vendorId: "vendor-b" },
  { id: "vca-c", champId: "champ-2", vendorId: "vendor-c" }
].map((assignment) => ({
  ...assignment,
  status: AssignmentStatus.ACTIVE,
  startDate: d("2025-01-01"),
  endDate: null,
  createdAt: d("2025-01-01"),
  updatedAt: d("2026-06-01")
}));

const pickerAssignments = [
  { id: "pa-1", pickerId: "picker-1", vendorId: "vendor-a" },
  { id: "pa-2", pickerId: "picker-2", vendorId: "vendor-a" },
  { id: "pa-low", pickerId: "picker-low", vendorId: "vendor-a" },
  { id: "pa-b", pickerId: "picker-branch-b", vendorId: "vendor-b" },
  { id: "pa-out", pickerId: "picker-out", vendorId: "vendor-c" }
].map((assignment) => ({
  ...assignment,
  status: AssignmentStatus.ACTIVE,
  startDate: d("2025-01-01"),
  endDate: null,
  createdAt: d("2025-01-01"),
  updatedAt: d("2026-06-01")
}));

const kpiRecords = [
  kpi("picker-1", "vendor-a", 180, 18),
  kpi("picker-1", "vendor-a", 500, 0, OrdersKpiImportBatchStatus.VALIDATED),
  kpi("picker-2", "vendor-a", 170, 8),
  kpi("picker-low", "vendor-a", 10, 0),
  kpi("picker-branch-b", "vendor-b", 320, 20),
  kpi("picker-out", "vendor-c", 900, 90),
  kpi(null, "vendor-low", 200, 0)
];

const attendanceRecords = [
  attendance("picker-1", "2026-06-01", { isOnTime: true }),
  attendance("picker-1", "2026-06-02", { isOnTime: true }),
  attendance("picker-1", "2026-06-03", {
    isLate: true,
    isUnder8Hours: true,
    lateBucket: "LATE_1"
  }),
  attendance("picker-1", "2026-06-04", {
    isAbsent: true,
    isOver15Hours: true
  }),
  attendance("picker-2", "2026-06-01", { isOnTime: true }),
  attendance("picker-2", "2026-06-02", { isOnTime: true }),
  attendance("picker-2", "2026-06-03", { isOnTime: true }),
  attendance("picker-2", "2026-06-04", { isOnTime: true }),
  attendance("picker-out", "2026-06-01", { isAbsent: true })
];

const requests = [
  request("req-hidden-deduction", RequestType.DEDUCTION, "champ-1", "picker-1", {
    sourceVendorId: "vendor-a",
    createdAt: "2026-06-08"
  }),
  request("req-new-hire", RequestType.NEW_HIRE, "champ-1", "picker-1", {
    sourceVendorId: "vendor-a",
    createdAt: "2026-06-07"
  }),
  request("req-transfer-to-a", RequestType.TRANSFER, "champ-2", "picker-2", {
    sourceVendorId: "vendor-b",
    destinationVendorId: "vendor-a",
    createdAt: "2026-06-06"
  }),
  request("req-other-branch", RequestType.RESIGNATION, "champ-2", "picker-out", {
    sourceVendorId: "vendor-c",
    createdAt: "2026-06-05"
  })
];

function kpi(
  pickerId: string | null,
  vendorId: string,
  totalOrders: number,
  unhealthyOrders: number,
  batchStatus = OrdersKpiImportBatchStatus.CONFIRMED
) {
  const vendor = vendors.find((item) => item.id === vendorId)!;

  return {
    id: `${pickerId ?? "branch"}-${vendorId}-${batchStatus}`,
    sourceBatchId: `batch-${batchStatus}`,
    sourceBatch: { status: batchStatus },
    kpiDate: d("2026-06-03"),
    sourceVendorId: vendorId,
    matchedVendorId: vendorId,
    matchedChainId: vendor.chainId,
    vendorNameSnapshot: vendor.vendorName,
    chainNameSnapshot: chains.find((item) => item.id === vendor.chainId)!.chainName,
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    sourceShopperId: pickerId ? `SPK-${pickerId}` : null,
    sourcePickerKey: pickerId ? `SPK-${pickerId}` : `${vendorId}-branch`,
    userId: pickerId,
    pickerNameSnapshot: pickerId ? user(pickerId).nameEn : null,
    pickerMatchStatus: pickerId
      ? OrdersKpiPickerMatchStatus.MATCHED_PICKER
      : OrdersKpiPickerMatchStatus.UNMATCHED_PICKER,
    totalOrders,
    successfulOrders: totalOrders - unhealthyOrders,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders,
    orderNotOnTime: unhealthyOrders,
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
    lateBucket?: "LATE_1" | "LATE_2" | "LATE_3";
  }
) {
  return {
    userId,
    shiftDate: d(shiftDate),
    calculatedStatus: flags.isAbsent ? "ABSENT" : flags.isLate ? "LATE" : "ON_TIME",
    isOnTime: flags.isOnTime ?? false,
    isLate: flags.isLate ?? false,
    isAbsent: flags.isAbsent ?? false,
    isUnder8Hours: flags.isUnder8Hours ?? false,
    isOver15Hours: flags.isOver15Hours ?? false,
    issuesCount: 0,
    lateBucket: flags.lateBucket ?? null,
    importBatch: { status: "ACTIVE" }
  };
}

function request(
  id: string,
  type: RequestType,
  createdById: string,
  targetUserId: string | null,
  options: {
    sourceVendorId?: string | null;
    destinationVendorId?: string | null;
    createdAt: string;
  }
) {
  const sourceVendor = options.sourceVendorId
    ? vendors.find((item) => item.id === options.sourceVendorId) ?? null
    : null;
  const destinationVendor = options.destinationVendorId
    ? vendors.find((item) => item.id === options.destinationVendorId) ?? null
    : null;

  return {
    id,
    type,
    status: RequestStatus.PENDING_AREA_MANAGER,
    currentStep: null,
    payload: {},
    completedAt: null,
    createdAt: d(options.createdAt),
    updatedAt: d(options.createdAt),
    createdById,
    targetUserId,
    sourceChainId: sourceVendor?.chainId ?? null,
    sourceVendorId: options.sourceVendorId ?? null,
    destinationChainId: destinationVendor?.chainId ?? null,
    destinationVendorId: options.destinationVendorId ?? null,
    createdBy: users.find((item) => item.id === createdById)!,
    targetUser: targetUserId ? users.find((item) => item.id === targetUserId)! : null,
    sourceChain: sourceVendor
      ? chains.find((item) => item.id === sourceVendor.chainId)!
      : null,
    sourceVendor: sourceVendor ? hydrateVendor(sourceVendor) : null,
    destinationChain: destinationVendor
      ? chains.find((item) => item.id === destinationVendor.chainId)!
      : null,
    destinationVendor: destinationVendor ? hydrateVendor(destinationVendor) : null,
    approvals: [],
    annualLeaveRequest: null
  };
}

function createPrisma() {
  return {
    $transaction: async (queries: Array<Promise<unknown>>) => Promise.all(queries),
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((item) => item.id === where.id) ?? null
    },
    vendorChampAssignment: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        champAssignments
          .filter((assignment) => matchesChampAssignmentWhere(assignment, where))
          .map(hydrateChampAssignment),
      findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        champAssignments
          .filter((assignment) => matchesChampAssignmentWhere(assignment, where))
          .map(hydrateChampAssignment)[0] ?? null
    },
    pickerBranchAssignment: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        pickerAssignments
          .filter((assignment) => matchesPickerAssignmentWhere(assignment, where))
          .map(hydratePickerAssignment)
    },
    chainAreaManagerAssignment: {
      findFirst: async ({ where }: { where: { chainId: string } }) =>
        where.chainId === "chain-1"
          ? {
              id: "cama-1",
              chainId: "chain-1",
              areaManagerId: "area-manager-1",
              status: AssignmentStatus.ACTIVE,
              areaManager: users.find((item) => item.id === "area-manager-1")!
            }
          : null
    },
    attendanceDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        attendanceRecords.filter((record) => matchesDateAndUser(record, where))
    },
    ordersKpiDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        kpiRecords.filter((record) => matchesKpiWhere(record, where))
    },
    request: {
      findMany: async ({
        orderBy,
        take,
        where
      }: {
        orderBy?: { createdAt?: "asc" | "desc" };
        take?: number;
        where?: Record<string, unknown>;
      }) => {
        const filtered = requests.filter((item) => matchesRequestWhere(item, where));
        const sorted = orderBy?.createdAt
          ? [...filtered].sort((left, right) =>
              orderBy.createdAt === "desc"
                ? right.createdAt.getTime() - left.createdAt.getTime()
                : left.createdAt.getTime() - right.createdAt.getTime()
            )
          : filtered;

        return typeof take === "number" ? sorted.slice(0, take) : sorted;
      }
    }
  };
}

function hydrateVendor(vendor: (typeof vendors)[number]) {
  return {
    ...vendor,
    chain: chains.find((item) => item.id === vendor.chainId)!
  };
}

function hydrateChampAssignment(assignment: (typeof champAssignments)[number]) {
  const vendor = vendors.find((item) => item.id === assignment.vendorId)!;
  return {
    ...assignment,
    champ: users.find((item) => item.id === assignment.champId)!,
    vendor: {
      ...hydrateVendor(vendor),
      pickerAssignments: pickerAssignments
        .filter(
          (pickerAssignment) =>
            pickerAssignment.vendorId === assignment.vendorId &&
            pickerAssignment.status === AssignmentStatus.ACTIVE
        )
        .map(hydratePickerAssignment)
    }
  };
}

function hydratePickerAssignment(assignment: (typeof pickerAssignments)[number]) {
  const vendor = vendors.find((item) => item.id === assignment.vendorId)!;
  return {
    ...assignment,
    picker: users.find((item) => item.id === assignment.pickerId)!,
    vendor: hydrateVendor(vendor)
  };
}

function matchesChampAssignmentWhere(
  assignment: (typeof champAssignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  if (where.champId && assignment.champId !== where.champId) return false;
  if (where.vendorId && assignment.vendorId !== where.vendorId) return false;
  if (where.status && assignment.status !== where.status) return false;
  return true;
}

function matchesPickerAssignmentWhere(
  assignment: (typeof pickerAssignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  if (where.status && assignment.status !== where.status) return false;
  if (where.vendorId && assignment.vendorId !== where.vendorId) return false;
  const vendorIdFilter = where.vendorId as { in?: string[] } | string | undefined;
  if (
    typeof vendorIdFilter === "object" &&
    vendorIdFilter.in &&
    !vendorIdFilter.in.includes(assignment.vendorId)
  ) {
    return false;
  }
  return true;
}

function matchesDateAndUser(
  record: { userId: string | null; shiftDate?: Date },
  where: Record<string, unknown>
) {
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
  const date = record.shiftDate;
  const dateFilter = where.shiftDate as { gte?: Date; lte?: Date } | undefined;
  return (
    !date ||
    !dateFilter ||
    ((!dateFilter.gte || date >= dateFilter.gte) &&
      (!dateFilter.lte || date <= dateFilter.lte))
  );
}

function matchesKpiWhere(
  record: (typeof kpiRecords)[number],
  where: Record<string, unknown>
) {
  const sourceBatchWhere = where.sourceBatch as
    | { is?: { status?: OrdersKpiImportBatchStatus } }
    | undefined;
  if (
    sourceBatchWhere?.is?.status &&
    record.sourceBatch.status !== sourceBatchWhere.is.status
  ) {
    return false;
  }

  const vendorIdFilter = where.matchedVendorId as
    | string
    | { in?: string[] }
    | undefined;
  if (
    typeof vendorIdFilter === "string" &&
    record.matchedVendorId !== vendorIdFilter
  ) {
    return false;
  }
  if (
    typeof vendorIdFilter === "object" &&
    vendorIdFilter.in &&
    !vendorIdFilter.in.includes(record.matchedVendorId ?? "")
  ) {
    return false;
  }

  const userIdFilter = where.userId as { in?: string[] } | string | undefined;
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

  const dateFilter = where.kpiDate as { gte?: Date; lt?: Date } | undefined;
  return (
    !dateFilter ||
    ((!dateFilter.gte || record.kpiDate >= dateFilter.gte) &&
      (!dateFilter.lt || record.kpiDate < dateFilter.lt))
  );
}

function matchesRequestWhere(
  item: (typeof requests)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  const or = where.OR as Array<Record<string, unknown>> | undefined;
  if (or && !or.some((condition) => matchesRequestWhere(item, condition))) {
    return false;
  }
  if (where.sourceVendorId && item.sourceVendorId !== where.sourceVendorId) {
    return false;
  }
  if (
    where.destinationVendorId &&
    item.destinationVendorId !== where.destinationVendorId
  ) {
    return false;
  }
  const typeFilter = where.type as { not?: RequestType } | undefined;
  if (typeFilter?.not && item.type === typeFilter.not) {
    return false;
  }
  return true;
}

function createService() {
  const targetSettingsService = {
    getTargetSettingsForReport: async () => ({
      id: "global",
      source: "SAVED",
      targets: {
        uhoRateTarget: 8,
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
      eligibilityStatus: "NOT_APPLICABLE",
      carriedBalanceDays: 0,
      currentYearAccruedDays: 0,
      annualTakenThisYear: 0,
      remainingDays: null,
      message: "Not applicable"
    })
  };

  return new (WorkspacesService as any)(
    createPrisma(),
    targetSettingsService,
    annualLeaveBalanceService
  );
}

async function testControllerIsChampOnly() {
  const handler = (WorkspacesController as any).prototype
    .getChampPerformanceSummary;
  assert.equal(typeof handler, "function");
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, handler), [UserRole.CHAMP]);
}

async function testChampCanAccessAssignedBranchSummary() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo,
    vendorId: "vendor-a"
  });

  assert.equal(summary.scope.champName, "Champ 1");
  assert.equal(summary.scope.selectedVendorId, "vendor-a");
  assert.equal(summary.scope.selectedBranch.vendorName, "Northpoint DC");
  assert.equal(summary.scope.selectedBranch.areaManagerName, "Area Manager 1");
  assert.equal(summary.scope.selectedBranch.activePickersCount, 3);
  assert.deepEqual(
    summary.scope.branches.map((branch: { vendorId: string }) => branch.vendorId),
    ["vendor-b", "vendor-a"]
  );
  assert.equal(summary.quickActions.newHire.enabled, true);
  assert.equal(summary.quickActions.transfer.enabled, true);
  assert.equal(summary.quickActions.deduction.enabled, true);
  assert.equal(summary.quickActions.resignation.enabled, true);
}

async function testChampCannotAccessUnassignedBranch() {
  const service = createService();

  await assert.rejects(
    () =>
      service.getChampPerformanceSummary("champ-1", {
        dateFrom,
        dateTo,
        vendorId: "vendor-c"
      }),
    (error) => error instanceof ForbiddenException
  );
}

async function testMultiBranchChampDefaultsToFirstBranchByName() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo
  });

  assert.equal(summary.scope.selectedVendorId, "vendor-b");
  assert.equal(summary.scope.selectedBranch.vendorName, "Alpha Hub");
  assert.equal(summary.scope.branches.length, 2);
}

async function testAttendanceHealthUsesCleanShiftRate() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo,
    vendorId: "vendor-a"
  });

  assert.equal(summary.attendance.available, true);
  assert.equal(summary.attendance.totalShifts, 8);
  assert.equal(summary.attendance.cleanShifts, 6);
  assert.equal(summary.attendance.issueShifts, 2);
  assert.equal(summary.attendance.attendanceHealthRate, 75);
  assert.equal(summary.attendance.totalShiftErrors, 4);
  assert.equal(summary.attendance.lateCount, 1);
  assert.equal(summary.attendance.absentCount, 1);
  assert.equal(summary.attendance.under8Count, 1);
  assert.equal(summary.attendance.over15Count, 1);
}

async function testOrdersKpiUsesConfirmedSourceBatchesOnly() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo,
    vendorId: "vendor-a"
  });

  assert.equal(summary.ordersKpi.available, true);
  assert.equal(summary.ordersKpi.totalOrders, 360);
  assert.equal(summary.ordersKpi.unhealthyOrders, 26);
  assert.equal(summary.ordersKpi.unhealthyRate, 7.22);
  assert.equal(summary.ordersKpi.orderNotOnTime, 26);
  assert.equal(summary.ordersKpi.orderNotOnTimeRate, 7.22);
  assert.equal(summary.ordersKpi.target.status, "IN_TARGET");
  assert.deepEqual(summary.ordersKpi.trend, [
    {
      date: "2026-06-03",
      unhealthyRate: 7.22,
      totalOrders: 360,
      unhealthyOrders: 26
    }
  ]);
}

async function testBranchRankingExcludesLowVolumeBranches() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo,
    vendorId: "vendor-a"
  });

  assert.equal(summary.branchRanking.available, true);
  assert.equal(summary.branchRanking.basis, "UHO_VOLUME_AWARE");
  assert.equal(summary.branchRanking.minOrdersRequired, 300);
  assert.equal(summary.branchRanking.chain.rank, 2);
  assert.equal(summary.branchRanking.chain.totalEligible, 3);
  assert.equal(summary.branchRanking.chain.displayLabel, "#2 / 3");
  assert.equal(summary.branchRanking.allBranches.rank, 2);
}

async function testPickerPerformanceRowsAreSelectedBranchScopedAndSorted() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo,
    vendorId: "vendor-a"
  });

  assert.equal(summary.pickerPerformance.available, true);
  assert.equal(summary.pickerPerformance.totalRows, 3);
  assert.deepEqual(
    summary.pickerPerformance.rows.map((row: { userId: string }) => row.userId),
    ["picker-1", "picker-low", "picker-2"]
  );
  assert.equal(summary.pickerPerformance.rows[0].status, "NEEDS_ACTION");
  assert.equal(summary.pickerPerformance.rows[0].rank, 2);
  assert.equal(summary.pickerPerformance.rows[1].status, "LOW_VOLUME");
  assert.equal(summary.pickerPerformance.rows[2].status, "IN_TARGET");
  assert.equal(
    summary.pickerPerformance.rows.some(
      (row: { userId: string }) => row.userId === "picker-out"
    ),
    false
  );
}

async function testRecentRequestsAreBranchScoped() {
  const service = createService();
  const summary = await service.getChampPerformanceSummary("champ-1", {
    dateFrom,
    dateTo,
    vendorId: "vendor-a"
  });

  assert.equal(summary.recentRequests.available, true);
  assert.deepEqual(
    summary.recentRequests.rows.map((row: { id: string }) => row.id),
    ["req-new-hire", "req-transfer-to-a"]
  );
}

async function main() {
  await testControllerIsChampOnly();
  await testChampCanAccessAssignedBranchSummary();
  await testChampCannotAccessUnassignedBranch();
  await testMultiBranchChampDefaultsToFirstBranchByName();
  await testAttendanceHealthUsesCleanShiftRate();
  await testOrdersKpiUsesConfirmedSourceBatchesOnly();
  await testBranchRankingExcludesLowVolumeBranches();
  await testPickerPerformanceRowsAreSelectedBranchScopedAndSorted();
  await testRecentRequestsAreBranchScoped();
  console.log("champ performance summary tests passed");
}

void main();
