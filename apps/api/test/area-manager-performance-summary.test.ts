import "reflect-metadata";

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  AttendanceImportBatchStatus,
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
    nationalId: `2990101${id.replace(/\D/g, "").padStart(7, "0").slice(0, 7)}`,
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
  user("am-current", UserRole.AREA_MANAGER),
  user("am-r1", UserRole.AREA_MANAGER),
  user("am-r2", UserRole.AREA_MANAGER),
  user("am-r3", UserRole.AREA_MANAGER),
  user("am-r4", UserRole.AREA_MANAGER),
  user("am-r5", UserRole.AREA_MANAGER),
  user("am-no-kpi", UserRole.AREA_MANAGER),
  user("am-out", UserRole.AREA_MANAGER),
  user("admin-1", UserRole.ADMIN),
  user("champ-a", UserRole.CHAMP),
  user("champ-b", UserRole.CHAMP),
  user("champ-out", UserRole.CHAMP),
  user("picker-a1"),
  user("picker-a2"),
  user("picker-b1"),
  user("picker-out")
];

const chains = [
  chain("chain-a", "Carrefour"),
  chain("chain-b", "Metro"),
  chain("chain-out", "Outside Chain"),
  chain("chain-r1", "Ranking One"),
  chain("chain-r2", "Ranking Two"),
  chain("chain-r3", "Ranking Three"),
  chain("chain-r4", "Ranking Four"),
  chain("chain-r5", "Ranking Five"),
  chain("chain-no", "No KPI Chain")
];

const vendors = [
  vendor("vendor-a", "Carrefour HCC", "chain-a"),
  vendor("vendor-b", "Metro Heliopolis", "chain-b"),
  vendor("vendor-out", "Outside Branch", "chain-out"),
  vendor("vendor-r1", "Ranking Branch One", "chain-r1"),
  vendor("vendor-r2", "Ranking Branch Two", "chain-r2"),
  vendor("vendor-r3", "Ranking Branch Three", "chain-r3"),
  vendor("vendor-r4", "Ranking Branch Four", "chain-r4"),
  vendor("vendor-r5", "Ranking Branch Five", "chain-r5"),
  vendor("vendor-no", "No KPI Branch", "chain-no")
];

const chainAreaManagerAssignments = [
  cama("cama-current-a", "am-current", "chain-a"),
  cama("cama-current-b", "am-current", "chain-b"),
  cama("cama-r1", "am-r1", "chain-r1"),
  cama("cama-r2", "am-r2", "chain-r2"),
  cama("cama-r3", "am-r3", "chain-r3"),
  cama("cama-r4", "am-r4", "chain-r4"),
  cama("cama-r5", "am-r5", "chain-r5"),
  cama("cama-no", "am-no-kpi", "chain-no"),
  cama("cama-out", "am-out", "chain-out")
];

const champAssignments = [
  champAssignment("vca-a", "champ-a", "vendor-a"),
  champAssignment("vca-b", "champ-b", "vendor-b"),
  champAssignment("vca-out", "champ-out", "vendor-out")
];

const pickerAssignments = [
  pickerAssignment("pa-a1", "picker-a1", "vendor-a"),
  pickerAssignment("pa-a2", "picker-a2", "vendor-a"),
  pickerAssignment("pa-b1", "picker-b1", "vendor-b"),
  pickerAssignment("pa-out", "picker-out", "vendor-out")
];

const kpiRecords = [
  kpi("vendor-a", 1000, 100, 80),
  kpi("vendor-a", 999, 999, 999, OrdersKpiImportBatchStatus.VALIDATED),
  kpi("vendor-b", 1000, 100, 60),
  kpi("vendor-out", 500, 250, 250),
  kpi("vendor-r1", 1000, 50, 50),
  kpi("vendor-r2", 1000, 70, 70),
  kpi("vendor-r3", 1000, 80, 80),
  kpi("vendor-r4", 1000, 90, 90),
  kpi("vendor-r5", 1000, 95, 95)
];

const attendanceRecords = [
  attendance("picker-a1", "2026-06-01", { isOnTime: true }),
  attendance("picker-a2", "2026-06-01", {
    isLate: true,
    isUnder8Hours: true
  }),
  attendance("champ-a", "2026-06-01", { isOnTime: true }),
  attendance("champ-b", "2026-06-01", {
    isAbsent: true,
    isOver15Hours: true
  }),
  attendance("picker-out", "2026-06-01", { isAbsent: true })
];

const requests = [
  request("req-hidden-deduction", RequestType.DEDUCTION, "champ-a", "picker-a1", {
    sourceVendorId: "vendor-a",
    createdAt: "2026-06-08"
  }),
  request("req-out", RequestType.NEW_HIRE, "champ-out", "picker-out", {
    sourceVendorId: "vendor-out",
    createdAt: "2026-06-07"
  }),
  request("req-newest", RequestType.NEW_HIRE, "champ-b", "picker-b1", {
    sourceVendorId: "vendor-b",
    createdAt: "2026-06-06"
  }),
  request("req-older", RequestType.TRANSFER, "champ-a", "picker-a2", {
    sourceVendorId: "vendor-a",
    destinationVendorId: "vendor-b",
    createdAt: "2026-06-05"
  })
];

function chain(id: string, chainName: string) {
  return {
    id,
    chainName,
    chainCode: id.toUpperCase(),
    status: "ACTIVE",
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

function vendor(id: string, vendorName: string, chainId: string) {
  return {
    id,
    vendorName,
    vendorCode: id.toUpperCase(),
    vendorExternalId: null,
    status: "ACTIVE",
    chainId,
    address: null,
    area: null,
    city: "Cairo",
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

function cama(id: string, areaManagerId: string, chainId: string) {
  return {
    id,
    areaManagerId,
    chainId,
    status: AssignmentStatus.ACTIVE,
    startDate: d("2025-01-01"),
    endDate: null,
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

function champAssignment(id: string, champId: string, vendorId: string) {
  return {
    id,
    champId,
    vendorId,
    status: AssignmentStatus.ACTIVE,
    startDate: d("2025-01-01"),
    endDate: null,
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

function pickerAssignment(id: string, pickerId: string, vendorId: string) {
  return {
    id,
    pickerId,
    vendorId,
    status: AssignmentStatus.ACTIVE,
    startDate: d("2025-01-01"),
    endDate: null,
    createdByRequestId: null,
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

function kpi(
  vendorId: string,
  totalOrders: number,
  unhealthyOrders: number,
  orderNotOnTime: number,
  batchStatus = OrdersKpiImportBatchStatus.CONFIRMED
) {
  const matchedVendor = vendors.find((item) => item.id === vendorId)!;
  const matchedChain = chains.find((item) => item.id === matchedVendor.chainId)!;

  return {
    id: `${vendorId}-${batchStatus}`,
    sourceBatchId: `batch-${batchStatus}`,
    sourceBatch: { status: batchStatus },
    kpiDate: d("2026-06-03"),
    sourceVendorId: vendorId,
    matchedVendorId: vendorId,
    matchedChainId: matchedVendor.chainId,
    vendorNameSnapshot: matchedVendor.vendorName,
    chainNameSnapshot: matchedChain.chainName,
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    sourceShopperId: null,
    sourcePickerKey: `${vendorId}-branch`,
    userId: null,
    pickerNameSnapshot: null,
    pickerMatchStatus: OrdersKpiPickerMatchStatus.UNMATCHED_PICKER,
    totalOrders,
    successfulOrders: totalOrders - unhealthyOrders,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders,
    orderNotOnTime,
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
    importBatch: { status: AttendanceImportBatchStatus.ACTIVE }
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
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((item) => item.id === where.id) ?? null
    },
    chainAreaManagerAssignment: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        chainAreaManagerAssignments
          .filter((assignment) =>
            matchesChainAreaManagerAssignmentWhere(assignment, where)
          )
          .map(hydrateChainAreaManagerAssignment)
    },
    attendanceDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        attendanceRecords.filter((record) => matchesAttendanceWhere(record, where))
    },
    ordersKpiDailyRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        kpiRecords.filter((record) => matchesKpiWhere(record, where))
    },
    request: {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        requests.filter((item) => matchesRequestWhere(item, where)).length,
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

function hydrateChainAreaManagerAssignment(
  assignment: (typeof chainAreaManagerAssignments)[number]
) {
  const chainRow = chains.find((item) => item.id === assignment.chainId)!;

  return {
    ...assignment,
    areaManager: users.find((item) => item.id === assignment.areaManagerId)!,
    chain: {
      ...chainRow,
      vendors: vendors
        .filter((item) => item.chainId === assignment.chainId)
        .map(hydrateVendor)
    }
  };
}

function hydrateVendor(vendorRow: (typeof vendors)[number]) {
  return {
    ...vendorRow,
    chain: chains.find((item) => item.id === vendorRow.chainId)!,
    pickerAssignments: pickerAssignments
      .filter(
        (assignment) =>
          assignment.vendorId === vendorRow.id &&
          assignment.status === AssignmentStatus.ACTIVE
      )
      .map(hydratePickerAssignment),
    champAssignments: champAssignments
      .filter(
        (assignment) =>
          assignment.vendorId === vendorRow.id &&
          assignment.status === AssignmentStatus.ACTIVE
      )
      .map(hydrateChampAssignment)
  };
}

function hydratePickerAssignment(assignment: (typeof pickerAssignments)[number]) {
  return {
    ...assignment,
    picker: users.find((item) => item.id === assignment.pickerId)!
  };
}

function hydrateChampAssignment(assignment: (typeof champAssignments)[number]) {
  return {
    ...assignment,
    champ: users.find((item) => item.id === assignment.champId)!
  };
}

function matchesChainAreaManagerAssignmentWhere(
  assignment: (typeof chainAreaManagerAssignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  if (where.status && assignment.status !== where.status) return false;
  if (
    where.areaManagerId &&
    typeof where.areaManagerId === "string" &&
    assignment.areaManagerId !== where.areaManagerId
  ) {
    return false;
  }

  const chainIdFilter = where.chainId as string | { in?: string[] } | undefined;
  if (typeof chainIdFilter === "string" && assignment.chainId !== chainIdFilter) {
    return false;
  }
  if (
    typeof chainIdFilter === "object" &&
    chainIdFilter.in &&
    !chainIdFilter.in.includes(assignment.chainId)
  ) {
    return false;
  }

  return true;
}

function matchesAttendanceWhere(
  record: (typeof attendanceRecords)[number],
  where: Record<string, unknown>
) {
  const userIdFilter = where.userId as string | { in?: string[] } | undefined;
  if (typeof userIdFilter === "string" && record.userId !== userIdFilter) {
    return false;
  }
  if (
    typeof userIdFilter === "object" &&
    userIdFilter.in &&
    !userIdFilter.in.includes(record.userId)
  ) {
    return false;
  }

  const sourceBatchWhere = where.importBatch as
    | { is?: { status?: AttendanceImportBatchStatus } }
    | undefined;
  if (
    sourceBatchWhere?.is?.status &&
    record.importBatch.status !== sourceBatchWhere.is.status
  ) {
    return false;
  }

  const dateFilter = where.shiftDate as { gte?: Date; lte?: Date } | undefined;
  return (
    !dateFilter ||
    ((!dateFilter.gte || record.shiftDate >= dateFilter.gte) &&
      (!dateFilter.lte || record.shiftDate <= dateFilter.lte))
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

  if (
    where.vendorMatchStatus &&
    record.vendorMatchStatus !== where.vendorMatchStatus
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

  const chainIdFilter = where.matchedChainId as
    | string
    | { in?: string[] }
    | undefined;
  if (
    typeof chainIdFilter === "string" &&
    record.matchedChainId !== chainIdFilter
  ) {
    return false;
  }
  if (
    typeof chainIdFilter === "object" &&
    chainIdFilter.in &&
    !chainIdFilter.in.includes(record.matchedChainId ?? "")
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

  const typeFilter = where.type as { not?: RequestType } | undefined;
  if (typeFilter?.not && item.type === typeFilter.not) {
    return false;
  }

  const statusFilter = where.status as { notIn?: RequestStatus[] } | undefined;
  if (statusFilter?.notIn?.includes(item.status)) {
    return false;
  }

  if (
    !matchesNullableIdFilter(item.sourceChainId, where.sourceChainId) ||
    !matchesNullableIdFilter(item.destinationChainId, where.destinationChainId) ||
    !matchesNullableIdFilter(item.sourceVendorId, where.sourceVendorId) ||
    !matchesNullableIdFilter(item.destinationVendorId, where.destinationVendorId)
  ) {
    return false;
  }

  return true;
}

function matchesNullableIdFilter(value: string | null, filter: unknown) {
  if (!filter) return true;
  if (typeof filter === "string") return value === filter;
  if (typeof filter === "object" && filter !== null && "in" in filter) {
    return (filter as { in?: string[] }).in?.includes(value ?? "") ?? true;
  }
  return true;
}

async function createService() {
  const { AreaManagerPerformanceSummaryService } = await import(
    "../src/workspaces/area-manager-performance-summary.service"
  );
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

  return new (AreaManagerPerformanceSummaryService as any)(
    createPrisma(),
    targetSettingsService,
    {
      getOrCalculate: ({ calculate }: { calculate: () => Promise<unknown> }) =>
        calculate()
    }
  );
}

async function testControllerIsAreaManagerOnly() {
  const handler = (WorkspacesController as any).prototype
    .getAreaManagerPerformanceSummary;
  assert.equal(typeof handler, "function");
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, handler), [
    UserRole.AREA_MANAGER
  ]);
}

async function testAreaManagerCanAccessOwnAssignedScope() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.scope.areaManagerId, "am-current");
  assert.equal(summary.scope.areaManagerName, "Am Current");
  assert.equal(summary.scope.selectedChainId, null);
  assert.deepEqual(
    summary.scope.chains.map((chainRow: { chainId: string }) => chainRow.chainId),
    ["chain-a", "chain-b"]
  );
  assert.deepEqual(summary.scope.totals, {
    chainsCount: 2,
    branchesCount: 2,
    champsCount: 2,
    pickersCount: 3
  });
}

async function testOptionalAssignedChainIdWorks() {
  const service = await createService();
  const summary = await service.getSummary("am-current", {
    dateFrom,
    dateTo,
    chainId: "chain-a"
  });

  assert.equal(summary.scope.selectedChainId, "chain-a");
  assert.deepEqual(summary.scope.totals, {
    chainsCount: 1,
    branchesCount: 1,
    champsCount: 1,
    pickersCount: 2
  });
  assert.equal(summary.ordersKpi.totalOrders, 1000);
  assert.deepEqual(
    summary.branchesPerformance.rows.map((row: { vendorId: string }) => row.vendorId),
    ["vendor-a"]
  );
}

async function testUnassignedChainIdIsForbidden() {
  const service = await createService();

  await assert.rejects(
    () =>
      service.getSummary("am-current", {
        dateFrom,
        dateTo,
        chainId: "chain-out"
      }),
    (error) => error instanceof ForbiddenException
  );
}

async function testInvalidDateRangeIsRejected() {
  const service = await createService();

  await assert.rejects(
    () =>
      service.getSummary("am-current", {
        dateFrom: "2026-06-08",
        dateTo: "2026-06-01"
      }),
    (error) => error instanceof BadRequestException
  );
}

async function testOrdersKpiUsesConfirmedSourceBatchesOnly() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.ordersKpi.available, true);
  assert.equal(summary.ordersKpi.totalOrders, 2000);
  assert.equal(summary.ordersKpi.unhealthyOrders, 200);
  assert.equal(summary.ordersKpi.unhealthyRate, 10);
  assert.equal(summary.ordersKpi.orderNotOnTime, 140);
  assert.equal(summary.ordersKpi.orderNotOnTimeRate, 7);
  assert.equal(summary.ordersKpi.target.status, "OUT_OF_TARGET");
}

async function testAttendanceIncludesPickersAndChampsUsingCleanShiftRate() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.attendance.available, true);
  assert.deepEqual(summary.attendance.includedRoles, ["PICKER", "CHAMP"]);
  assert.equal(summary.attendance.totalShifts, 4);
  assert.equal(summary.attendance.cleanShifts, 2);
  assert.equal(summary.attendance.issueShifts, 2);
  assert.equal(summary.attendance.attendanceHealthRate, 50);
  assert.equal(summary.attendance.totalShiftErrors, 4);
  assert.equal(summary.attendance.lateCount, 1);
  assert.equal(summary.attendance.absentCount, 1);
  assert.equal(summary.attendance.under8Count, 1);
  assert.equal(summary.attendance.over15Count, 1);
}

async function testLatestRequestsAreScopedAndSortedNewestFirst() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.latestRequests.available, true);
  assert.equal(summary.latestRequests.totalOpenInScope, 2);
  assert.deepEqual(
    summary.latestRequests.rows.map((row: { id: string }) => row.id),
    ["req-newest", "req-older"]
  );
}

async function testBranchPerformanceExcludesOutOfScopeBranches() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.branchesPerformance.available, true);
  assert.equal(summary.branchesPerformance.totalRows, 2);
  assert.equal(
    summary.branchesPerformance.rows.some(
      (row: { vendorId: string }) => row.vendorId === "vendor-out"
    ),
    false
  );
}

async function testChampPerformanceExcludesOutOfScopeChamps() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.champsPerformance.available, true);
  assert.equal(summary.champsPerformance.totalRows, 2);
  assert.equal(
    summary.champsPerformance.rows.some(
      (row: { champId: string }) => row.champId === "champ-out"
    ),
    false
  );
}

async function testAreaManagerRankingUsesUhoOnlyAndIncludesCurrentOutsideTop() {
  const service = await createService();
  const summary = await service.getSummary("am-current", { dateFrom, dateTo });

  assert.equal(summary.areaManagersRanking.available, true);
  assert.equal(summary.areaManagersRanking.basis, "UHO_ONLY");
  assert.equal(summary.areaManagersRanking.rows[0].areaManagerId, "am-r1");
  assert.equal(summary.areaManagersRanking.rows[0].unhealthyRate, 5);
  assert.equal(summary.areaManagersRanking.currentAreaManager.areaManagerId, "am-current");
  assert.equal(summary.areaManagersRanking.currentAreaManager.rank, 6);
  assert.equal(summary.areaManagersRanking.currentAreaManager.unhealthyRate, 10);
  assert.equal(
    summary.areaManagersRanking.rows.some(
      (row: { areaManagerId: string; isCurrentUser: boolean }) =>
        row.areaManagerId === "am-current" && row.isCurrentUser
    ),
    true
  );
}

async function main() {
  await testControllerIsAreaManagerOnly();
  await testAreaManagerCanAccessOwnAssignedScope();
  await testOptionalAssignedChainIdWorks();
  await testUnassignedChainIdIsForbidden();
  await testInvalidDateRangeIsRejected();
  await testOrdersKpiUsesConfirmedSourceBatchesOnly();
  await testAttendanceIncludesPickersAndChampsUsingCleanShiftRate();
  await testLatestRequestsAreScopedAndSortedNewestFirst();
  await testBranchPerformanceExcludesOutOfScopeBranches();
  await testChampPerformanceExcludesOutOfScopeChamps();
  await testAreaManagerRankingUsesUhoOnlyAndIncludesCurrentOutsideTop();
  console.log("area manager performance summary tests passed");
}

void main();
