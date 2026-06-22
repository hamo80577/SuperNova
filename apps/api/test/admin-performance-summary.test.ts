import "reflect-metadata";

import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";

import {
  AccountStatus,
  ApprovalStep,
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
import { AdminPerformanceSummaryService } from "../src/workspaces/admin-performance-summary.service";

const dateFrom = "2026-06-01";
const dateTo = "2026-06-07";

function d(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function user(
  id: string,
  role: UserRole,
  overrides: Partial<{
    accountStatus: AccountStatus;
    employmentStatus: EmploymentStatus;
    nameEn: string;
  }> = {}
) {
  return {
    id,
    ibsId: null,
    shopperId: role === UserRole.PICKER ? `SPK-${id}` : null,
    role,
    nameEn:
      overrides.nameEn ??
      id
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
    employmentStatus: overrides.employmentStatus ?? EmploymentStatus.ACTIVE,
    resignationDate: null,
    accountStatus: overrides.accountStatus ?? AccountStatus.ACTIVE,
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

function chainAreaManagerAssignment(
  id: string,
  areaManagerId: string,
  chainId: string
) {
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

function vendorChampAssignment(id: string, champId: string, vendorId: string) {
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

function pickerBranchAssignment(
  id: string,
  pickerId: string,
  vendorId: string,
  status = AssignmentStatus.ACTIVE
) {
  return {
    id,
    pickerId,
    vendorId,
    status,
    startDate: d("2025-01-01"),
    endDate: null,
    createdByRequestId: null,
    createdAt: d("2025-01-01"),
    updatedAt: d("2026-06-01")
  };
}

function ordersKpiRecord(options: {
  id: string;
  kpiDate?: string;
  sourceVendorId: string;
  userId?: string | null;
  totalOrders: number;
  unhealthyOrders: number;
  batchStatus?: OrdersKpiImportBatchStatus;
}) {
  const vendorRow = vendors.find((item) => item.id === options.sourceVendorId)!;
  const userRow = options.userId
    ? users.find((item) => item.id === options.userId) ?? null
    : null;

  return {
    id: options.id,
    sourceBatchId: `batch-${options.id}`,
    sourceBatch: {
      status: options.batchStatus ?? OrdersKpiImportBatchStatus.CONFIRMED
    },
    kpiDate: d(options.kpiDate ?? "2026-06-03"),
    sourceVendorId: options.sourceVendorId,
    matchedVendorId: options.sourceVendorId,
    matchedChainId: vendorRow.chainId,
    vendorNameSnapshot: vendorRow.vendorName,
    chainNameSnapshot: chains.find((item) => item.id === vendorRow.chainId)!.chainName,
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    sourceShopperId: userRow?.shopperId ?? null,
    sourcePickerKey: userRow?.shopperId ?? `${options.sourceVendorId}-branch`,
    userId: options.userId ?? null,
    pickerNameSnapshot: userRow?.nameEn ?? null,
    pickerMatchStatus: options.userId
      ? OrdersKpiPickerMatchStatus.MATCHED_PICKER
      : OrdersKpiPickerMatchStatus.UNMATCHED_PICKER,
    totalOrders: options.totalOrders,
    successfulOrders: options.totalOrders - options.unhealthyOrders,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders: options.unhealthyOrders,
    orderNotOnTime: options.unhealthyOrders,
    partialRefund: 0,
    vendorDelay: 0,
    preparationTime: null,
    outOfStock: 0,
    firNotOnTime: 0,
    priceModified: 0,
    issuesCount: 0
  };
}

function attendanceRecord(
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
    issuesCount:
      Number(flags.isLate ?? false) +
      Number(flags.isAbsent ?? false) +
      Number(flags.isUnder8Hours ?? false) +
      Number(flags.isOver15Hours ?? false),
    importBatch: { status: AttendanceImportBatchStatus.ACTIVE }
  };
}

function requestRow(options: {
  id: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: string;
  completedAt?: string | null;
  updatedAt?: string;
  sourceVendorId?: string | null;
  destinationVendorId?: string | null;
  currentStep?: ApprovalStep | null;
}) {
  const sourceVendor = options.sourceVendorId
    ? vendors.find((item) => item.id === options.sourceVendorId) ?? null
    : null;
  const destinationVendor = options.destinationVendorId
    ? vendors.find((item) => item.id === options.destinationVendorId) ?? null
    : null;

  return {
    id: options.id,
    type: options.type,
    status: options.status,
    currentStep: options.currentStep ?? null,
    payload: {},
    completedAt: options.completedAt ? d(options.completedAt) : null,
    createdAt: d(options.createdAt),
    updatedAt: d(options.updatedAt ?? options.createdAt),
    createdById: "admin-1",
    targetUserId: null,
    sourceChainId: sourceVendor?.chainId ?? null,
    sourceVendorId: options.sourceVendorId ?? null,
    destinationChainId: destinationVendor?.chainId ?? null,
    destinationVendorId: options.destinationVendorId ?? null
  };
}

const users = [
  user("admin-1", UserRole.ADMIN, { nameEn: "Admin One" }),
  user("super-admin-1", UserRole.SUPER_ADMIN, { nameEn: "Super Admin One" }),
  user("area-manager-alan", UserRole.AREA_MANAGER, { nameEn: "Alan Area" }),
  user("area-manager-bella", UserRole.AREA_MANAGER, { nameEn: "Bella Area" }),
  user("area-manager-carla", UserRole.AREA_MANAGER, { nameEn: "Carla Area" }),
  user("area-manager-no-kpi", UserRole.AREA_MANAGER, { nameEn: "Nora No KPI" }),
  user("champ-alpha", UserRole.CHAMP, { nameEn: "Alpha Champ" }),
  user("champ-bella", UserRole.CHAMP, { nameEn: "Bella Champ" }),
  user("champ-carla", UserRole.CHAMP, { nameEn: "Carla Champ" }),
  user("champ-no-kpi", UserRole.CHAMP, { nameEn: "Nora Champ" }),
  user("picker-amy", UserRole.PICKER, { nameEn: "Amy Picker" }),
  user("picker-bob", UserRole.PICKER, { nameEn: "Bob Picker" }),
  user("picker-cam", UserRole.PICKER, { nameEn: "Cam Picker" }),
  user("picker-low", UserRole.PICKER, { nameEn: "Low Picker" }),
  user("picker-dan", UserRole.PICKER, { nameEn: "Dan Picker" }),
  user("picker-eli", UserRole.PICKER, { nameEn: "Eli Picker" }),
  user("picker-fay", UserRole.PICKER, { nameEn: "Fay Picker" }),
  user("picker-inactive", UserRole.PICKER, {
    nameEn: "Inactive Picker",
    employmentStatus: EmploymentStatus.RESIGNED
  })
];

const chains = [
  chain("chain-a", "Alpha Chain"),
  chain("chain-b", "Bravo Chain"),
  chain("chain-c", "Charlie Chain"),
  chain("chain-d", "Delta Chain"),
  chain("chain-empty", "Empty Chain")
];

const vendors = [
  vendor("vendor-a1", "Alpha Branch", "chain-a"),
  vendor("vendor-a2", "Beta Branch", "chain-a"),
  vendor("vendor-b1", "Gamma Branch", "chain-b"),
  vendor("vendor-b2", "Delta Branch", "chain-b"),
  vendor("vendor-c1", "Echo Branch", "chain-c"),
  vendor("vendor-d1", "No KPI Branch", "chain-d")
];

const chainAreaManagerAssignments = [
  chainAreaManagerAssignment("cama-a", "area-manager-alan", "chain-a"),
  chainAreaManagerAssignment("cama-b", "area-manager-bella", "chain-b"),
  chainAreaManagerAssignment("cama-c", "area-manager-carla", "chain-c"),
  chainAreaManagerAssignment("cama-d", "area-manager-no-kpi", "chain-d")
];

const vendorChampAssignments = [
  vendorChampAssignment("vca-a1", "champ-alpha", "vendor-a1"),
  vendorChampAssignment("vca-a2", "champ-alpha", "vendor-a2"),
  vendorChampAssignment("vca-b1", "champ-bella", "vendor-b1"),
  vendorChampAssignment("vca-b2", "champ-bella", "vendor-b2"),
  vendorChampAssignment("vca-c1", "champ-carla", "vendor-c1"),
  vendorChampAssignment("vca-d1", "champ-no-kpi", "vendor-d1")
];

const pickerBranchAssignments = [
  pickerBranchAssignment("pba-a1-amy", "picker-amy", "vendor-a1"),
  pickerBranchAssignment("pba-a1-bob", "picker-bob", "vendor-a1"),
  pickerBranchAssignment("pba-a2-cam", "picker-cam", "vendor-a2"),
  pickerBranchAssignment("pba-a2-low", "picker-low", "vendor-a2"),
  pickerBranchAssignment("pba-b1-dan", "picker-dan", "vendor-b1"),
  pickerBranchAssignment("pba-b2-eli", "picker-eli", "vendor-b2"),
  pickerBranchAssignment("pba-c1-fay", "picker-fay", "vendor-c1"),
  pickerBranchAssignment("pba-c1-inactive", "picker-inactive", "vendor-c1")
];

const ordersKpiDailyRecords = [
  ordersKpiRecord({
    id: "kpi-amy",
    sourceVendorId: "vendor-a1",
    userId: "picker-amy",
    totalOrders: 30,
    unhealthyOrders: 1
  }),
  ordersKpiRecord({
    id: "kpi-bob",
    sourceVendorId: "vendor-a1",
    userId: "picker-bob",
    totalOrders: 20,
    unhealthyOrders: 1
  }),
  ordersKpiRecord({
    id: "kpi-cam",
    sourceVendorId: "vendor-a2",
    userId: "picker-cam",
    totalOrders: 31,
    unhealthyOrders: 1
  }),
  ordersKpiRecord({
    id: "kpi-low",
    sourceVendorId: "vendor-a2",
    userId: "picker-low",
    totalOrders: 19,
    unhealthyOrders: 1
  }),
  ordersKpiRecord({
    id: "kpi-dan",
    sourceVendorId: "vendor-b1",
    userId: "picker-dan",
    totalOrders: 40,
    unhealthyOrders: 2
  }),
  ordersKpiRecord({
    id: "kpi-eli",
    sourceVendorId: "vendor-b2",
    userId: "picker-eli",
    totalOrders: 60,
    unhealthyOrders: 2
  }),
  ordersKpiRecord({
    id: "kpi-fay",
    sourceVendorId: "vendor-c1",
    userId: "picker-fay",
    totalOrders: 90,
    unhealthyOrders: 9
  }),
  ordersKpiRecord({
    id: "kpi-unconfirmed-huge",
    sourceVendorId: "vendor-a1",
    userId: "picker-amy",
    totalOrders: 999999,
    unhealthyOrders: 999999,
    batchStatus: OrdersKpiImportBatchStatus.VALIDATED
  })
];

const attendanceDailyRecords = [
  attendanceRecord("picker-amy", "2026-06-01", { isOnTime: true }),
  attendanceRecord("picker-amy", "2026-06-02", { isOnTime: true }),
  attendanceRecord("picker-bob", "2026-06-01", {
    isLate: true,
    isUnder8Hours: true
  }),
  attendanceRecord("picker-cam", "2026-06-01", { isOnTime: true }),
  attendanceRecord("picker-low", "2026-06-01", { isOnTime: true }),
  attendanceRecord("champ-alpha", "2026-06-01", { isOnTime: true }),
  attendanceRecord("champ-alpha", "2026-06-02", { isOnTime: true }),
  attendanceRecord("champ-bella", "2026-06-01", {
    isAbsent: true,
    isOver15Hours: true
  }),
  attendanceRecord("picker-inactive", "2026-06-01", { isOnTime: true }),
  attendanceRecord("area-manager-alan", "2026-06-01", { isOnTime: true })
];

const requests = [
  requestRow({
    id: "req-open-pending-admin-in-period",
    type: RequestType.NEW_HIRE,
    status: RequestStatus.PENDING_ADMIN,
    createdAt: "2026-06-02",
    updatedAt: "2026-06-06",
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    sourceVendorId: "vendor-a1"
  }),
  requestRow({
    id: "req-approved-created-before-period",
    type: RequestType.TRANSFER,
    status: RequestStatus.APPROVED,
    createdAt: "2026-05-30",
    completedAt: "2026-06-03",
    sourceVendorId: "vendor-b1"
  }),
  requestRow({
    id: "req-completed-created-in-period",
    type: RequestType.RESIGNATION,
    status: RequestStatus.COMPLETED,
    createdAt: "2026-06-01",
    completedAt: "2026-06-04",
    sourceVendorId: "vendor-a2"
  }),
  requestRow({
    id: "req-rejected-in-period",
    type: RequestType.ANNUAL_LEAVE,
    status: RequestStatus.REJECTED,
    createdAt: "2026-06-05",
    updatedAt: "2026-06-06",
    sourceVendorId: "vendor-b2"
  }),
  requestRow({
    id: "req-cancelled-in-period",
    type: RequestType.TRANSFER,
    status: RequestStatus.CANCELLED,
    createdAt: "2026-06-06",
    updatedAt: "2026-06-07",
    sourceVendorId: "vendor-c1"
  }),
  requestRow({
    id: "req-old-open-area-manager",
    type: RequestType.NEW_HIRE,
    status: RequestStatus.PENDING_AREA_MANAGER,
    createdAt: "2026-05-20",
    sourceVendorId: "vendor-d1"
  }),
  requestRow({
    id: "req-old-open-admin",
    type: RequestType.DEDUCTION,
    status: RequestStatus.PENDING_ADMIN,
    createdAt: "2026-05-15",
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    sourceVendorId: "vendor-b2"
  }),
  requestRow({
    id: "req-updated-in-period-not-closed",
    type: RequestType.TRANSFER,
    status: RequestStatus.PENDING_ADMIN,
    createdAt: "2026-05-28",
    updatedAt: "2026-06-07",
    currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
    sourceVendorId: "vendor-a1"
  })
];

function findUser(userId: string) {
  return users.find((item) => item.id === userId)!;
}

function hydrateChain(chainRow: (typeof chains)[number]) {
  return {
    ...chainRow,
    vendors: vendors
      .filter((item) => item.chainId === chainRow.id)
      .map(hydrateVendor)
  };
}

function hydrateVendor(vendorRow: (typeof vendors)[number]) {
  return {
    ...vendorRow,
    chain: chains.find((item) => item.id === vendorRow.chainId)!,
    pickerAssignments: pickerBranchAssignments
      .filter((item) => item.vendorId === vendorRow.id)
      .map(hydratePickerAssignment),
    champAssignments: vendorChampAssignments
      .filter((item) => item.vendorId === vendorRow.id)
      .map(hydrateVendorChampAssignment)
  };
}

function hydrateChainAreaManagerAssignment(
  assignment: (typeof chainAreaManagerAssignments)[number]
) {
  return {
    ...assignment,
    areaManager: findUser(assignment.areaManagerId),
    chain: hydrateChain(chains.find((item) => item.id === assignment.chainId)!)
  };
}

function hydrateVendorChampAssignment(
  assignment: (typeof vendorChampAssignments)[number]
) {
  return {
    ...assignment,
    champ: findUser(assignment.champId)
  };
}

function hydratePickerAssignment(
  assignment: (typeof pickerBranchAssignments)[number]
) {
  return {
    ...assignment,
    picker: findUser(assignment.pickerId)
  };
}

function matchesDateRange(
  value: Date,
  filter?: { gte?: Date; lte?: Date; lt?: Date }
) {
  if (!filter) return true;
  if (filter.gte && value < filter.gte) return false;
  if (filter.lte && value > filter.lte) return false;
  if (filter.lt && value >= filter.lt) return false;
  return true;
}

function matchesStringFilter(
  value: string | null | undefined,
  filter: unknown
): boolean {
  if (filter == null) return true;
  if (typeof filter === "string") return value === filter;
  if (typeof filter === "object" && filter !== null && "in" in filter) {
    return (filter as { in?: string[] }).in?.includes(value ?? "") ?? true;
  }
  return true;
}

function matchesChainWhere(
  row: (typeof chains)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  return matchesStringFilter(row.id, where.id);
}

function matchesVendorWhere(
  row: (typeof vendors)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  return (
    matchesStringFilter(row.id, where.id) &&
    matchesStringFilter(row.chainId, where.chainId) &&
    (where.status ? row.status === where.status : true)
  );
}

function matchesChainAreaManagerAssignmentWhere(
  row: (typeof chainAreaManagerAssignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  return (
    matchesStringFilter(row.chainId, where.chainId) &&
    matchesStringFilter(row.areaManagerId, where.areaManagerId) &&
    (where.status ? row.status === where.status : true)
  );
}

function matchesVendorChampAssignmentWhere(
  row: (typeof vendorChampAssignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;
  return (
    matchesStringFilter(row.vendorId, where.vendorId) &&
    matchesStringFilter(row.champId, where.champId) &&
    (where.status ? row.status === where.status : true)
  );
}

function matchesPickerAssignmentWhere(
  row: (typeof pickerBranchAssignments)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;

  const pickerRow = findUser(row.pickerId);
  const pickerFilter = where.picker as
    | {
        employmentStatus?: EmploymentStatus;
        accountStatus?: AccountStatus;
      }
    | undefined;

  return (
    matchesStringFilter(row.vendorId, where.vendorId) &&
    matchesStringFilter(row.pickerId, where.pickerId) &&
    (where.status ? row.status === where.status : true) &&
    (!pickerFilter?.employmentStatus ||
      pickerRow.employmentStatus === pickerFilter.employmentStatus) &&
    (!pickerFilter?.accountStatus ||
      pickerRow.accountStatus === pickerFilter.accountStatus)
  );
}

function matchesKpiWhere(
  row: (typeof ordersKpiDailyRecords)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;

  const sourceBatchWhere = where.sourceBatch as
    | { is?: { status?: OrdersKpiImportBatchStatus } }
    | undefined;

  return (
    (!sourceBatchWhere?.is?.status ||
      row.sourceBatch.status === sourceBatchWhere.is.status) &&
    matchesStringFilter(row.matchedChainId, where.matchedChainId) &&
    matchesStringFilter(row.matchedVendorId, where.matchedVendorId) &&
    matchesStringFilter(row.userId, where.userId) &&
    matchesDateRange(
      row.kpiDate,
      where.kpiDate as { gte?: Date; lte?: Date; lt?: Date } | undefined
    )
  );
}

function matchesAttendanceWhere(
  row: (typeof attendanceDailyRecords)[number],
  where?: Record<string, unknown>
) {
  if (!where) return true;

  const importBatchWhere = where.importBatch as
    | { is?: { status?: AttendanceImportBatchStatus } }
    | undefined;

  return (
    matchesStringFilter(row.userId, where.userId) &&
    (!importBatchWhere?.is?.status ||
      row.importBatch.status === importBatchWhere.is.status) &&
    matchesDateRange(
      row.shiftDate,
      where.shiftDate as { gte?: Date; lte?: Date } | undefined
    )
  );
}

function matchesRequestWhere(
  row: (typeof requests)[number],
  where?: Record<string, unknown>
): boolean {
  if (!where) return true;

  const and = where.AND as Array<Record<string, unknown>> | undefined;
  if (and && !and.every((entry) => matchesRequestWhere(row, entry))) {
    return false;
  }

  const or = where.OR as Array<Record<string, unknown>> | undefined;
  if (or && !or.some((entry) => matchesRequestWhere(row, entry))) {
    return false;
  }

  const not = where.NOT as Record<string, unknown> | undefined;
  if (not && matchesRequestWhere(row, not)) {
    return false;
  }

  const statusFilter = where.status as
    | RequestStatus
    | { in?: RequestStatus[]; notIn?: RequestStatus[] }
    | undefined;
  if (typeof statusFilter === "string" && row.status !== statusFilter) {
    return false;
  }

  if (
    where.currentStep &&
    row.currentStep !== (where.currentStep as ApprovalStep)
  ) {
    return false;
  }
  if (typeof statusFilter === "object" && statusFilter !== null) {
    if (statusFilter.in && !statusFilter.in.includes(row.status)) return false;
    if (statusFilter.notIn && statusFilter.notIn.includes(row.status)) return false;
  }

  const createdAt = where.createdAt as
    | { gte?: Date; lte?: Date; lt?: Date }
    | undefined;
  if (!matchesDateRange(row.createdAt, createdAt)) {
    return false;
  }

  if (where.completedAt) {
    if (row.completedAt === null) return false;
    if (
      !matchesDateRange(
        row.completedAt,
        where.completedAt as { gte?: Date; lte?: Date; lt?: Date }
      )
    ) {
      return false;
    }
  }

  if (!matchesStringFilter(row.sourceChainId, where.sourceChainId)) return false;
  if (!matchesStringFilter(row.destinationChainId, where.destinationChainId)) {
    return false;
  }
  if (!matchesStringFilter(row.sourceVendorId, where.sourceVendorId)) return false;
  if (
    !matchesStringFilter(row.destinationVendorId, where.destinationVendorId)
  ) {
    return false;
  }

  const typeFilter = where.type as
    | RequestType
    | { in?: RequestType[]; not?: RequestType }
    | undefined;
  if (typeof typeFilter === "string" && row.type !== typeFilter) {
    return false;
  }
  if (typeof typeFilter === "object" && typeFilter !== null) {
    if (typeFilter.in && !typeFilter.in.includes(row.type)) return false;
    if (typeFilter.not && row.type === typeFilter.not) return false;
  }

  return true;
}

function createPrismaStub() {
  return {
    chain: {
      findMany: async ({
        where,
        orderBy
      }: {
        where?: Record<string, unknown>;
        orderBy?: { chainName?: "asc" | "desc" };
      } = {}) => {
        const rows = chains.filter((row) => matchesChainWhere(row, where));
        if (orderBy?.chainName) {
          rows.sort((left, right) =>
            orderBy.chainName === "asc"
              ? left.chainName.localeCompare(right.chainName)
              : right.chainName.localeCompare(left.chainName)
          );
        }
        return rows.map(hydrateChain);
      },
      findUnique: async ({
        where
      }: {
        where: { id: string };
      }) => {
        const row = chains.find((item) => item.id === where.id) ?? null;
        return row ? hydrateChain(row) : null;
      }
    },
    vendor: {
      findMany: async ({
        where,
        orderBy
      }: {
        where?: Record<string, unknown>;
        orderBy?: { vendorName?: "asc" | "desc" };
      } = {}) => {
        const rows = vendors.filter((row) => matchesVendorWhere(row, where));
        if (orderBy?.vendorName) {
          rows.sort((left, right) =>
            orderBy.vendorName === "asc"
              ? left.vendorName.localeCompare(right.vendorName)
              : right.vendorName.localeCompare(left.vendorName)
          );
        }
        return rows.map(hydrateVendor);
      },
      findUnique: async ({
        where
      }: {
        where: { id: string };
      }) => {
        const row = vendors.find((item) => item.id === where.id) ?? null;
        return row ? hydrateVendor(row) : null;
      }
    },
    chainAreaManagerAssignment: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        chainAreaManagerAssignments
          .filter((row) => matchesChainAreaManagerAssignmentWhere(row, where))
          .map(hydrateChainAreaManagerAssignment)
    },
    vendorChampAssignment: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        vendorChampAssignments
          .filter((row) => matchesVendorChampAssignmentWhere(row, where))
          .map(hydrateVendorChampAssignment)
    },
    pickerBranchAssignment: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        pickerBranchAssignments
          .filter((row) => matchesPickerAssignmentWhere(row, where))
          .map(hydratePickerAssignment)
    },
    ordersKpiDailyRecord: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        ordersKpiDailyRecords.filter((row) => matchesKpiWhere(row, where))
    },
    attendanceDailyRecord: {
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        attendanceDailyRecords.filter((row) => matchesAttendanceWhere(row, where))
    },
    request: {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        requests.filter((row) => matchesRequestWhere(row, where)).length
    }
  };
}

function createTargetSettingsStub() {
  return {
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
}

function createService() {
  return new (AdminPerformanceSummaryService as any)(
    createPrismaStub(),
    createTargetSettingsStub()
  );
}

function expectIds<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  expected: Array<string | number | null>
) {
  assert.deepEqual(rows.map((row) => row[key]), expected);
}

function expectRoleMetadata(handlerName: string, expectedRoles: UserRole[]) {
  const handler = (WorkspacesController as any).prototype[handlerName];
  assert.equal(typeof handler, "function");
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, handler), expectedRoles);
}

async function testControllerUsesAdminAndSuperAdminRolesOnly() {
  expectRoleMetadata("getAdminPerformanceSummary", [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
}

async function testControllerDelegatesAdminPerformanceQuery() {
  const received: Array<Record<string, unknown>> = [];
  const expected = { ok: true };
  const controller = new (WorkspacesController as any)(
    {},
    {},
    {
      getSummary: async (query: Record<string, unknown>) => {
        received.push(query);
        return expected;
      }
    }
  );

  const result = await controller.getAdminPerformanceSummary({
    dateFrom,
    dateTo,
    chainId: "chain-a",
    vendorId: "vendor-a1"
  });

  assert.equal(result, expected);
  assert.deepEqual(received, [
    {
      dateFrom,
      dateTo,
      chainId: "chain-a",
      vendorId: "vendor-a1"
    }
  ]);
}

async function testGlobalSummaryReturnsExpectedContract() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.deepEqual(summary.period, { dateFrom, dateTo });
  assert.equal(summary.filters.selectedChainId, null);
  assert.equal(summary.filters.selectedVendorId, null);
  assert.deepEqual(summary.scopeTotals, {
    chainsCount: 5,
    branchesCount: 6,
    areaManagersCount: 4,
    champsCount: 4,
    pickersCount: 7
  });
  assert.equal(summary.filters.chains.length, 5);
  assert.deepEqual(summary.ordersKpi.target, {
    configured: true,
    unhealthyRateTarget: 8,
    status: "IN_TARGET"
  });
}

async function testChainFilterNarrowsScope() {
  const service = createService();
  const summary = await service.getSummary({
    dateFrom,
    dateTo,
    chainId: "chain-b"
  });

  assert.equal(summary.filters.selectedChainId, "chain-b");
  assert.equal(summary.filters.selectedVendorId, null);
  assert.deepEqual(summary.scopeTotals, {
    chainsCount: 1,
    branchesCount: 2,
    areaManagersCount: 1,
    champsCount: 1,
    pickersCount: 2
  });
  expectIds(summary.filters.branches, "vendorId", ["vendor-b2", "vendor-b1"]);
}

async function testVendorFilterNarrowsScope() {
  const service = createService();
  const summary = await service.getSummary({
    dateFrom,
    dateTo,
    vendorId: "vendor-a2"
  });

  assert.equal(summary.filters.selectedChainId, "chain-a");
  assert.equal(summary.filters.selectedVendorId, "vendor-a2");
  assert.deepEqual(summary.scopeTotals, {
    chainsCount: 1,
    branchesCount: 1,
    areaManagersCount: 1,
    champsCount: 1,
    pickersCount: 2
  });
  expectIds(summary.filters.branches, "vendorId", ["vendor-a1", "vendor-a2"]);
}

async function testMismatchedChainAndVendorIsRejected() {
  const service = createService();

  await assert.rejects(
    () =>
      service.getSummary({
        dateFrom,
        dateTo,
        chainId: "chain-a",
        vendorId: "vendor-b1"
      }),
    (error) => error instanceof BadRequestException
  );
}

async function testConfirmedOrdersKpiOnly() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.ordersKpi.available, true);
  assert.equal(summary.ordersKpi.totalOrders, 290);
  assert.equal(summary.ordersKpi.unhealthyOrders, 17);
  assert.equal(summary.ordersKpi.unhealthyRate, 5.86);
  assert.equal(summary.ordersKpi.target.unhealthyRateTarget, 8);
}

async function testAttendanceUsesActivePickersAndChampsOnly() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.attendance.available, true);
  assert.deepEqual(summary.attendance.includedRoles, ["PICKER", "CHAMP"]);
  assert.equal(summary.attendance.totalShifts, 8);
  assert.equal(summary.attendance.totalShiftErrors, 4);
}

async function testAttendanceUsesCleanShiftRate() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.attendance.cleanShifts, 6);
  assert.equal(summary.attendance.issueShifts, 2);
  assert.equal(summary.attendance.attendanceHealthRate, 75);
  assert.equal(summary.attendance.lateCount, 1);
  assert.equal(summary.attendance.absentCount, 1);
  assert.equal(summary.attendance.under8Count, 1);
  assert.equal(summary.attendance.over15Count, 1);
}

async function testTicketsUseApprovedSemanticsExactly() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.deepEqual(summary.ticketsSummary, {
    available: true,
    totalTickets: 4,
    openedInPeriod: 4,
    closedInPeriod: 2,
    openNow: 4,
    waitingMyAction: 3,
    rejectedOrCancelled: 2
  });
}

async function testAreaManagerRankingUsesUhoOnlyWithNameTieAndNoKpiLast() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.areaManagersRanking.available, true);
  assert.equal(summary.areaManagersRanking.basis, "UHO_ONLY");
  expectIds(summary.areaManagersRanking.rows, "areaManagerId", [
    "area-manager-alan",
    "area-manager-bella",
    "area-manager-carla",
    "area-manager-no-kpi"
  ]);
  assert.equal(summary.areaManagersRanking.rows[0].unhealthyRate, 4);
  assert.equal(summary.areaManagersRanking.rows[1].unhealthyRate, 4);
  assert.equal(summary.areaManagersRanking.rows[3].status, "NO_KPI");
}

async function testChampRankingUsesUhoOnlyWithNameTieAndNoKpiLast() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.champsRanking.available, true);
  assert.equal(summary.champsRanking.basis, "UHO_ONLY");
  expectIds(summary.champsRanking.rows, "champId", [
    "champ-alpha",
    "champ-bella",
    "champ-carla",
    "champ-no-kpi"
  ]);
  assert.equal(summary.champsRanking.rows[0].unhealthyRate, 4);
  assert.equal(summary.champsRanking.rows[1].unhealthyRate, 4);
  assert.equal(summary.champsRanking.rows[3].status, "NO_KPI");
}

async function testBranchRankingUsesUhoOnlyWithNameTieAndNoKpiLast() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.branchesRanking.available, true);
  assert.equal(summary.branchesRanking.basis, "UHO_ONLY");
  expectIds(summary.branchesRanking.rows, "vendorId", [
    "vendor-b2",
    "vendor-a1",
    "vendor-a2",
    "vendor-b1",
    "vendor-c1",
    "vendor-d1"
  ]);
  assert.equal(summary.branchesRanking.rows[1].unhealthyRate, 4);
  assert.equal(summary.branchesRanking.rows[2].unhealthyRate, 4);
  assert.equal(summary.branchesRanking.rows[5].status, "NO_KPI");
}

async function testTopPickersUseSevenDayThresholdTwentyAndExcludeLowVolume() {
  const service = createService();
  const summary = await service.getSummary({ dateFrom, dateTo });

  assert.equal(summary.topPickers.available, true);
  assert.equal(summary.topPickers.minOrdersRequired, 20);
  expectIds(summary.topPickers.rows, "pickerId", [
    "picker-cam",
    "picker-amy",
    "picker-eli",
    "picker-bob",
    "picker-dan",
    "picker-fay"
  ]);
  assert.equal(
    summary.topPickers.rows.some(
      (row: { pickerId: string }) => row.pickerId === "picker-low"
    ),
    false
  );
}

async function testFiltersAlterRankingsAndTopPickers() {
  const service = createService();

  const chainSummary = await service.getSummary({
    dateFrom,
    dateTo,
    chainId: "chain-a"
  });
  expectIds(chainSummary.champsRanking.rows, "champId", ["champ-alpha"]);
  expectIds(chainSummary.topPickers.rows, "pickerId", [
    "picker-cam",
    "picker-amy",
    "picker-bob"
  ]);

  const vendorSummary = await service.getSummary({
    dateFrom,
    dateTo,
    vendorId: "vendor-a2"
  });
  expectIds(vendorSummary.branchesRanking.rows, "vendorId", ["vendor-a2"]);
  expectIds(vendorSummary.topPickers.rows, "pickerId", ["picker-cam"]);
}

async function main() {
  await testControllerUsesAdminAndSuperAdminRolesOnly();
  await testControllerDelegatesAdminPerformanceQuery();
  await testGlobalSummaryReturnsExpectedContract();
  await testChainFilterNarrowsScope();
  await testVendorFilterNarrowsScope();
  await testMismatchedChainAndVendorIsRejected();
  await testConfirmedOrdersKpiOnly();
  await testAttendanceUsesActivePickersAndChampsOnly();
  await testAttendanceUsesCleanShiftRate();
  await testTicketsUseApprovedSemanticsExactly();
  await testAreaManagerRankingUsesUhoOnlyWithNameTieAndNoKpiLast();
  await testChampRankingUsesUhoOnlyWithNameTieAndNoKpiLast();
  await testBranchRankingUsesUhoOnlyWithNameTieAndNoKpiLast();
  await testTopPickersUseSevenDayThresholdTwentyAndExcludeLowVolume();
  await testFiltersAlterRankingsAndTopPickers();
  console.log("admin performance summary tests passed");
}

void main();
