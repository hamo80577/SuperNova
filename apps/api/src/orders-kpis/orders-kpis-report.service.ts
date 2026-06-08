import {
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  AssignmentStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import type {
  OrdersKpiDailyReportQuery,
  OrdersKpiDailyReportResponse,
  OrdersKpiDailyReportRow,
  OrdersKpiDailyReportSummary,
  OrdersKpiPerformanceReportQuery,
  OrdersKpiPerformanceReportResponse,
  OrdersKpiPerformanceReportRow,
  OrdersKpiPerformanceReportSortBy,
  OrdersKpiPerformanceReportSummary,
  OrdersKpiPerformanceReportView
} from "./orders-kpis-report.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const dailyReportSelect = {
  id: true,
  kpiDate: true,
  pickerNameSnapshot: true,
  shopperId: true,
  userId: true,
  sourceVendorId: true,
  matchedVendorId: true,
  matchedChainId: true,
  totalOrders: true,
  successfulOrders: true,
  successRate: true,
  unhealthyOrders: true,
  unhealthyRate: true,
  orderNotOnTime: true,
  notOnTimeRate: true,
  preparationTime: true,
  outOfStock: true,
  vendorDelay: true,
  firNotOnTime: true,
  priceModified: true,
  issuesCount: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

const summarySelect = {
  userId: true,
  totalOrders: true,
  successfulOrders: true,
  unhealthyOrders: true,
  orderNotOnTime: true,
  preparationTime: true,
  outOfStock: true,
  vendorDelay: true,
  firNotOnTime: true,
  priceModified: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

const performanceReportSelect = {
  userId: true,
  pickerNameSnapshot: true,
  shopperId: true,
  sourceVendorId: true,
  matchedVendorId: true,
  matchedChainId: true,
  totalOrders: true,
  unhealthyOrders: true,
  orderNotOnTime: true,
  qcFailedOrders: true,
  partialRefund: true,
  outOfStock: true,
  priceModified: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

const chainMetadataSelect = {
  id: true,
  chainName: true
} satisfies Prisma.ChainSelect;

const vendorMetadataSelect = {
  id: true,
  vendorName: true,
  vendorCode: true,
  vendorExternalId: true,
  chainId: true,
  chain: {
    select: chainMetadataSelect
  }
} satisfies Prisma.VendorSelect;

type OrdersKpiDailyReportRecord =
  Prisma.OrdersKpiDailyRecordGetPayload<{ select: typeof dailyReportSelect }>;

type OrdersKpiDailySummaryRecord =
  Prisma.OrdersKpiDailyRecordGetPayload<{ select: typeof summarySelect }>;

type OrdersKpiPerformanceRecord =
  Prisma.OrdersKpiDailyRecordGetPayload<{ select: typeof performanceReportSelect }>;

type OrdersKpiChainMetadata =
  Prisma.ChainGetPayload<{ select: typeof chainMetadataSelect }>;

type OrdersKpiVendorMetadata =
  Prisma.VendorGetPayload<{ select: typeof vendorMetadataSelect }>;

type OrdersKpiReportActor = Pick<AuthenticatedUser, "id" | "role">;

type OrdersKpiDailyReportScope =
  | { kind: "ALL" }
  | { kind: "PICKER"; userId: string }
  | { kind: "MATCHED_VENDORS"; vendorIds: string[] }
  | { kind: "MATCHED_CHAINS"; chainIds: string[] };

type OrdersKpiPerformanceMetadata = {
  chainsById: Map<string, OrdersKpiChainMetadata>;
  vendorsById: Map<string, OrdersKpiVendorMetadata>;
};

type OrdersKpiPerformanceAggregate = OrdersKpiPerformanceReportSummary & {
  pickerIds: Set<string>;
  records: OrdersKpiPerformanceRecord[];
  sourceVendorIds: Set<string>;
  vendorKeys: Set<string>;
};

@Injectable()
export class OrdersKpisReportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getDailyReport(
    query: OrdersKpiDailyReportQuery,
    actor: OrdersKpiReportActor
  ): Promise<OrdersKpiDailyReportResponse> {
    const range = normalizeDateRange(query);
    const pagination = normalizePagination(query);
    const scope = await this.resolveDailyReportScope(actor);
    const where = buildDailyReportWhere(range, query, scope);
    const totalRows = await this.prisma.ordersKpiDailyRecord.count({ where });
    const [summaryRecords, rows] = await Promise.all([
      this.prisma.ordersKpiDailyRecord.findMany({
        where,
        select: summarySelect
      }),
      this.prisma.ordersKpiDailyRecord.findMany({
        where,
        select: dailyReportSelect,
        orderBy: buildDailyOrderBy(query),
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      })
    ]);

    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      summary: summarizeDailyRecords(summaryRecords),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / pagination.pageSize)
      },
      rows: rows.map(toDailyReportRow)
    };
  }

  async getPerformanceReport(
    query: OrdersKpiPerformanceReportQuery,
    actor: OrdersKpiReportActor
  ): Promise<OrdersKpiPerformanceReportResponse> {
    const range = normalizeDateRange(query);
    const pagination = normalizePagination(query);
    const view = normalizePerformanceView(query.view);
    const scope = await this.resolveDailyReportScope(actor);
    const where = buildPerformanceReportWhere(range, query, scope);
    const records = await this.prisma.ordersKpiDailyRecord.findMany({
      where,
      select: performanceReportSelect
    });
    const metadata = await this.loadPerformanceMetadata(records, query);
    const rows = sortPerformanceRows(
      aggregatePerformanceRows(view, records, metadata),
      query
    );
    const pageStart = (pagination.page - 1) * pagination.pageSize;

    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      view,
      scope: buildPerformanceScope(query, metadata),
      summary: summarizePerformanceRecords(records),
      rows: rows.slice(pageStart, pageStart + pagination.pageSize),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalRows: rows.length,
        totalPages: Math.ceil(rows.length / pagination.pageSize)
      }
    };
  }

  private async loadPerformanceMetadata(
    records: OrdersKpiPerformanceRecord[],
    query: OrdersKpiPerformanceReportQuery
  ): Promise<OrdersKpiPerformanceMetadata> {
    const vendorIds = uniqueStrings([
      ...records.flatMap((record) => stringOrEmpty(record.matchedVendorId)),
      ...stringOrEmpty(query.vendorId?.trim())
    ]);
    const vendors = vendorIds.length
      ? await this.prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: vendorMetadataSelect
        })
      : [];
    const chainIds = uniqueStrings([
      ...records.flatMap((record) => stringOrEmpty(record.matchedChainId)),
      ...vendors.map((vendor) => vendor.chainId),
      ...stringOrEmpty(query.chainId?.trim())
    ]);
    const chains = chainIds.length
      ? await this.prisma.chain.findMany({
          where: { id: { in: chainIds } },
          select: chainMetadataSelect
        })
      : [];
    const chainsById = new Map(chains.map((chain) => [chain.id, chain]));

    for (const vendor of vendors) {
      if (vendor.chain && !chainsById.has(vendor.chain.id)) {
        chainsById.set(vendor.chain.id, vendor.chain);
      }
    }

    return {
      chainsById,
      vendorsById: new Map(vendors.map((vendor) => [vendor.id, vendor]))
    };
  }

  private async resolveDailyReportScope(
    actor: OrdersKpiReportActor
  ): Promise<OrdersKpiDailyReportScope> {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN) {
      return { kind: "ALL" };
    }

    if (actor.role === UserRole.PICKER) {
      return { kind: "PICKER", userId: actor.id };
    }

    if (actor.role === UserRole.CHAMP) {
      const assignments = await this.prisma.vendorChampAssignment.findMany({
        where: {
          champId: actor.id,
          status: AssignmentStatus.ACTIVE
        },
        select: { vendorId: true }
      });

      return {
        kind: "MATCHED_VENDORS",
        vendorIds: uniqueStrings(assignments.map((assignment) => assignment.vendorId))
      };
    }

    if (actor.role === UserRole.AREA_MANAGER) {
      const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
        where: {
          areaManagerId: actor.id,
          status: AssignmentStatus.ACTIVE
        },
        select: { chainId: true }
      });

      return {
        kind: "MATCHED_CHAINS",
        chainIds: uniqueStrings(assignments.map((assignment) => assignment.chainId))
      };
    }

    throw new ForbiddenException("You do not have permission for this action.");
  }
}

function buildDailyReportWhere(
  range: { dateFrom: string; dateTo: string },
  query: OrdersKpiDailyReportQuery,
  scope: OrdersKpiDailyReportScope
): Prisma.OrdersKpiDailyRecordWhereInput {
  const where: Prisma.OrdersKpiDailyRecordWhereInput = {
    kpiDate: {
      gte: dateOnlyToUtcDate(range.dateFrom, "dateFrom"),
      lte: dateOnlyToUtcDate(range.dateTo, "dateTo")
    }
  };

  applyDailyReportScope(where, scope);

  if (query.shopperId?.trim()) {
    where.shopperId = {
      contains: query.shopperId.trim(),
      mode: "insensitive"
    };
  }

  if (query.pickerSearch?.trim()) {
    const search = query.pickerSearch.trim();
    addDailyAnd(where, {
      OR: [
        {
          pickerNameSnapshot: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          shopperId: {
            contains: search,
            mode: "insensitive"
          }
        }
      ]
    });
  }

  if (query.vendorId?.trim()) {
    where.matchedVendorId = query.vendorId.trim();
  }

  if (query.chainId?.trim()) {
    where.matchedChainId = query.chainId.trim();
  }

  return where;
}

function buildPerformanceReportWhere(
  range: { dateFrom: string; dateTo: string },
  query: OrdersKpiPerformanceReportQuery,
  scope: OrdersKpiDailyReportScope
): Prisma.OrdersKpiDailyRecordWhereInput {
  const where: Prisma.OrdersKpiDailyRecordWhereInput = {
    kpiDate: {
      gte: dateOnlyToUtcDate(range.dateFrom, "dateFrom"),
      lte: dateOnlyToUtcDate(range.dateTo, "dateTo")
    }
  };

  applyDailyReportScope(where, scope);

  if (query.pickerSearch?.trim()) {
    const search = query.pickerSearch.trim();
    addDailyAnd(where, {
      OR: [
        {
          pickerNameSnapshot: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          shopperId: {
            contains: search,
            mode: "insensitive"
          }
        }
      ]
    });
  }

  if (query.vendorId?.trim()) {
    where.matchedVendorId = query.vendorId.trim();
  }

  if (query.chainId?.trim()) {
    where.matchedChainId = query.chainId.trim();
  }

  return where;
}

function applyDailyReportScope(
  where: Prisma.OrdersKpiDailyRecordWhereInput,
  scope: OrdersKpiDailyReportScope
) {
  if (scope.kind === "PICKER") {
    where.userId = scope.userId;
  }

  if (scope.kind === "MATCHED_VENDORS") {
    where.matchedVendorId = { in: scope.vendorIds };
  }

  if (scope.kind === "MATCHED_CHAINS") {
    where.matchedChainId = { in: scope.chainIds };
  }
}

function addDailyAnd(
  where: Prisma.OrdersKpiDailyRecordWhereInput,
  condition: Prisma.OrdersKpiDailyRecordWhereInput
) {
  const existing = where.AND;

  if (Array.isArray(existing)) {
    where.AND = [...existing, condition];
    return;
  }

  if (existing) {
    where.AND = [existing, condition];
    return;
  }

  where.AND = [condition];
}

function buildDailyOrderBy(
  query: OrdersKpiDailyReportQuery
): Prisma.OrdersKpiDailyRecordOrderByWithRelationInput[] {
  const direction = query.sortDirection === "desc" ? "desc" : "asc";
  const fields = {
    date: "kpiDate",
    pickerName: "pickerNameSnapshot",
    preparationTime: "preparationTime",
    shopperId: "shopperId",
    successRate: "successRate",
    successfulOrders: "successfulOrders",
    totalOrders: "totalOrders"
  } satisfies Record<
    NonNullable<OrdersKpiDailyReportQuery["sortBy"]>,
    keyof Prisma.OrdersKpiDailyRecordOrderByWithRelationInput
  >;
  const order: Prisma.OrdersKpiDailyRecordOrderByWithRelationInput[] = [];
  const field = query.sortBy ? fields[query.sortBy] : null;

  if (field) {
    order.push({
      [field]: direction
    } as Prisma.OrdersKpiDailyRecordOrderByWithRelationInput);
  }

  order.push(
    { kpiDate: "asc" },
    { pickerNameSnapshot: "asc" },
    { shopperId: "asc" }
  );

  return order;
}

function summarizeDailyRecords(
  records: OrdersKpiDailySummaryRecord[]
): OrdersKpiDailyReportSummary {
  const summary = records.reduce(
    (state, record) => {
      const preparationTime = decimalToNumberOrNull(record.preparationTime);

      state.pickerIds.add(record.userId);
      state.totalOrders += record.totalOrders;
      state.successfulOrders += record.successfulOrders;
      state.unhealthyOrders += record.unhealthyOrders;
      state.orderNotOnTime += record.orderNotOnTime;
      state.outOfStock += record.outOfStock;
      state.vendorDelay += record.vendorDelay;
      state.firNotOnTime += record.firNotOnTime;
      state.priceModified += record.priceModified;

      if (preparationTime !== null) {
        state.preparationTimeRows += 1;
        state.preparationTimeTotal += preparationTime;
      }

      return state;
    },
    {
      firNotOnTime: 0,
      orderNotOnTime: 0,
      outOfStock: 0,
      pickerIds: new Set<string>(),
      preparationTimeRows: 0,
      preparationTimeTotal: 0,
      priceModified: 0,
      successfulOrders: 0,
      totalOrders: 0,
      unhealthyOrders: 0,
      vendorDelay: 0
    }
  );

  return {
    pickerCount: summary.pickerIds.size,
    totalOrders: summary.totalOrders,
    successfulOrders: summary.successfulOrders,
    successRate: percentage(summary.successfulOrders, summary.totalOrders),
    unhealthyOrders: summary.unhealthyOrders,
    unhealthyRate: percentage(summary.unhealthyOrders, summary.totalOrders),
    orderNotOnTime: summary.orderNotOnTime,
    notOnTimeRate: percentage(summary.orderNotOnTime, summary.totalOrders),
    averagePreparationTime:
      summary.preparationTimeRows > 0
        ? roundMetric(summary.preparationTimeTotal / summary.preparationTimeRows)
        : null,
    outOfStock: summary.outOfStock,
    vendorDelay: summary.vendorDelay,
    firNotOnTime: summary.firNotOnTime,
    priceModified: summary.priceModified
  };
}

function toDailyReportRow(
  record: OrdersKpiDailyReportRecord
): OrdersKpiDailyReportRow {
  return {
    id: record.id,
    kpiDate: formatDateOnly(record.kpiDate),
    pickerName: record.pickerNameSnapshot,
    shopperId: record.shopperId,
    userId: record.userId,
    sourceVendorId: record.sourceVendorId,
    matchedVendorId: record.matchedVendorId,
    matchedChainId: record.matchedChainId,
    totalOrders: record.totalOrders,
    successfulOrders: record.successfulOrders,
    successRate: decimalToNumberOrNull(record.successRate),
    unhealthyOrders: record.unhealthyOrders,
    unhealthyRate: decimalToNumberOrNull(record.unhealthyRate),
    orderNotOnTime: record.orderNotOnTime,
    notOnTimeRate: decimalToNumberOrNull(record.notOnTimeRate),
    preparationTime: decimalToNumberOrNull(record.preparationTime),
    outOfStock: record.outOfStock,
    vendorDelay: record.vendorDelay,
    firNotOnTime: record.firNotOnTime,
    priceModified: record.priceModified,
    issuesCount: record.issuesCount
  };
}

function aggregatePerformanceRows(
  view: OrdersKpiPerformanceReportView,
  records: OrdersKpiPerformanceRecord[],
  metadata: OrdersKpiPerformanceMetadata
): OrdersKpiPerformanceReportRow[] {
  if (view === "VENDOR") {
    return aggregateVendorRows(records, metadata);
  }

  if (view === "PICKER") {
    return aggregatePickerRows(records, metadata);
  }

  return aggregateChainRows(records, metadata);
}

function aggregateChainRows(
  records: OrdersKpiPerformanceRecord[],
  metadata: OrdersKpiPerformanceMetadata
): OrdersKpiPerformanceReportRow[] {
  const groups = new Map<string, {
    aggregate: OrdersKpiPerformanceAggregate;
    chainId: string | null;
    chainName: string;
  }>();

  for (const record of records) {
    const chainId = record.matchedChainId;
    const key = chainId ?? "UNMAPPED_CHAIN";
    const group = getOrCreate(groups, key, () => ({
      aggregate: createPerformanceAggregate(),
      chainId,
      chainName: chainNameFor(chainId, metadata)
    }));

    addPerformanceRecord(group.aggregate, record);
  }

  return [...groups.values()].map((group) => ({
    kind: "CHAIN",
    chainId: group.chainId,
    chainName: group.chainName,
    ...performanceSummaryFromAggregate(group.aggregate),
    vendorCount: group.aggregate.vendorKeys.size,
    pickerCount: group.aggregate.pickerIds.size
  }));
}

function aggregateVendorRows(
  records: OrdersKpiPerformanceRecord[],
  metadata: OrdersKpiPerformanceMetadata
): OrdersKpiPerformanceReportRow[] {
  const groups = new Map<string, {
    aggregate: OrdersKpiPerformanceAggregate;
    sourceVendorId: string | null;
    vendorId: string | null;
  }>();

  for (const record of records) {
    const vendorId = record.matchedVendorId;
    const key = vendorId ?? `SOURCE:${record.sourceVendorId || "UNMAPPED_VENDOR"}`;
    const group = getOrCreate(groups, key, () => ({
      aggregate: createPerformanceAggregate(),
      sourceVendorId: record.sourceVendorId || null,
      vendorId
    }));

    addPerformanceRecord(group.aggregate, record);
  }

  return [...groups.values()].map((group) => {
    const vendor = group.vendorId
      ? metadata.vendorsById.get(group.vendorId) ?? null
      : null;
    const chainId = vendor?.chainId ?? singleValue(
      group.aggregate.records.map((record) => record.matchedChainId)
    );

    return {
      kind: "VENDOR",
      chainId,
      chainName: chainId ? chainNameFor(chainId, metadata) : null,
      vendorId: group.vendorId,
      vendorName: vendor?.vendorName ?? "Unmapped Vendor",
      sourceVendorId: singleValue([...group.aggregate.sourceVendorIds])
        ?? group.sourceVendorId,
      ...performanceSummaryFromAggregate(group.aggregate),
      pickerCount: group.aggregate.pickerIds.size
    };
  });
}

function aggregatePickerRows(
  records: OrdersKpiPerformanceRecord[],
  metadata: OrdersKpiPerformanceMetadata
): OrdersKpiPerformanceReportRow[] {
  const groups = new Map<string, OrdersKpiPerformanceAggregate>();

  for (const record of records) {
    addPerformanceRecord(
      getOrCreate(groups, record.userId, createPerformanceAggregate),
      record
    );
  }

  return [...groups.values()].map((aggregate) => {
    const firstRecord = aggregate.records[0]!;
    const vendorId = singleValue(
      aggregate.records.map((record) => record.matchedVendorId)
    );
    const chainId = singleValue(
      aggregate.records.map((record) => record.matchedChainId)
    );

    return {
      kind: "PICKER",
      chainId,
      chainName: chainId ? chainNameFor(chainId, metadata) : null,
      vendorId,
      vendorName: vendorId
        ? metadata.vendorsById.get(vendorId)?.vendorName ?? "Unmapped Vendor"
        : null,
      sourceVendorId: singleValue([...aggregate.sourceVendorIds]),
      userId: firstRecord.userId,
      pickerName: firstRecord.pickerNameSnapshot,
      shopperId: firstRecord.shopperId,
      ...performanceSummaryFromAggregate(aggregate)
    };
  });
}

function sortPerformanceRows(
  rows: OrdersKpiPerformanceReportRow[],
  query: OrdersKpiPerformanceReportQuery
) {
  const sortBy = query.sortBy ?? "uhoRate";
  const direction = query.sortDirection === "asc" ? "asc" : "desc";

  return [...rows].sort((left, right) => {
    const metricComparison = comparePerformanceMetric(
      left,
      right,
      sortBy,
      direction
    );

    return metricComparison || comparePerformanceTieBreaker(left, right);
  });
}

function summarizePerformanceRecords(
  records: OrdersKpiPerformanceRecord[]
): OrdersKpiPerformanceReportSummary {
  const aggregate = createPerformanceAggregate();

  for (const record of records) {
    addPerformanceRecord(aggregate, record);
  }

  return performanceSummaryFromAggregate(aggregate);
}

function createPerformanceAggregate(): OrdersKpiPerformanceAggregate {
  return {
    notOnTime: 0,
    oos: 0,
    partialRefund: 0,
    pickerIds: new Set<string>(),
    priceModified: 0,
    qcFailedOrders: 0,
    records: [],
    sourceVendorIds: new Set<string>(),
    totalOrders: 0,
    uho: 0,
    uhoRate: null,
    vendorKeys: new Set<string>()
  };
}

function addPerformanceRecord(
  aggregate: OrdersKpiPerformanceAggregate,
  record: OrdersKpiPerformanceRecord
) {
  aggregate.records.push(record);
  aggregate.pickerIds.add(record.userId);
  aggregate.totalOrders += record.totalOrders;
  aggregate.uho += record.unhealthyOrders;
  aggregate.notOnTime += record.orderNotOnTime;
  aggregate.qcFailedOrders += record.qcFailedOrders;
  aggregate.partialRefund += record.partialRefund;
  aggregate.oos += record.outOfStock;
  aggregate.priceModified += record.priceModified;

  if (record.sourceVendorId) {
    aggregate.sourceVendorIds.add(record.sourceVendorId);
  }

  aggregate.vendorKeys.add(
    record.matchedVendorId ?? record.sourceVendorId ?? "UNMAPPED_VENDOR"
  );
}

function performanceSummaryFromAggregate(
  aggregate: OrdersKpiPerformanceAggregate
): OrdersKpiPerformanceReportSummary {
  return {
    totalOrders: aggregate.totalOrders,
    uho: aggregate.uho,
    uhoRate: percentage(aggregate.uho, aggregate.totalOrders),
    notOnTime: aggregate.notOnTime,
    qcFailedOrders: aggregate.qcFailedOrders,
    partialRefund: aggregate.partialRefund,
    oos: aggregate.oos,
    priceModified: aggregate.priceModified
  };
}

function buildPerformanceScope(
  query: OrdersKpiPerformanceReportQuery,
  metadata: OrdersKpiPerformanceMetadata
) {
  const vendorId = query.vendorId?.trim() || null;
  const vendor = vendorId ? metadata.vendorsById.get(vendorId) ?? null : null;
  const chainId = query.chainId?.trim() || vendor?.chainId || null;

  return {
    chainId,
    chainName: chainId ? metadata.chainsById.get(chainId)?.chainName ?? null : null,
    vendorId,
    vendorName: vendor?.vendorName ?? null
  };
}

function normalizePerformanceView(
  view: OrdersKpiPerformanceReportQuery["view"]
): OrdersKpiPerformanceReportView {
  return view === "VENDOR" || view === "PICKER" ? view : "CHAIN";
}

function comparePerformanceMetric(
  left: OrdersKpiPerformanceReportRow,
  right: OrdersKpiPerformanceReportRow,
  sortBy: OrdersKpiPerformanceReportSortBy,
  direction: "asc" | "desc"
) {
  const leftValue = left[sortBy];
  const rightValue = right[sortBy];

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  const comparison = leftValue - rightValue;
  return direction === "desc" ? -comparison : comparison;
}

function comparePerformanceTieBreaker(
  left: OrdersKpiPerformanceReportRow,
  right: OrdersKpiPerformanceReportRow
) {
  if (left.kind === "PICKER" && right.kind === "PICKER") {
    return (
      left.pickerName.localeCompare(right.pickerName) ||
      left.shopperId.localeCompare(right.shopperId)
    );
  }

  if (left.kind === "VENDOR" && right.kind === "VENDOR") {
    return left.vendorName.localeCompare(right.vendorName);
  }

  if (left.kind === "CHAIN" && right.kind === "CHAIN") {
    return left.chainName.localeCompare(right.chainName);
  }

  return left.kind.localeCompare(right.kind);
}

function chainNameFor(
  chainId: string | null,
  metadata: OrdersKpiPerformanceMetadata
) {
  return chainId
    ? metadata.chainsById.get(chainId)?.chainName ?? "Unmapped Chain"
    : "Unmapped Chain";
}

function singleValue(values: Array<string | null>) {
  const uniqueValues = uniqueStrings(
    values.filter((value): value is string => Boolean(value))
  );

  return uniqueValues.length === 1 ? uniqueValues[0]! : null;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, createValue: () => V) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const nextValue = createValue();
  map.set(key, nextValue);
  return nextValue;
}

function normalizeDateRange(query: { dateFrom?: string; dateTo?: string }) {
  const today = new Date();
  const defaultDateFrom = `${today.getUTCFullYear()}-${pad(
    today.getUTCMonth() + 1
  )}-01`;
  const defaultDateTo = formatDateOnly(today);
  const dateFrom = query.dateFrom ?? (query.dateTo ? query.dateTo : defaultDateFrom);
  const dateTo = query.dateTo ?? (query.dateFrom ? query.dateFrom : defaultDateTo);
  const parsedFrom = dateOnlyToUtcDate(dateFrom, "dateFrom");
  const parsedTo = dateOnlyToUtcDate(dateTo, "dateTo");

  if (parsedFrom > parsedTo) {
    return {
      dateFrom: dateTo,
      dateTo: dateFrom
    };
  }

  return { dateFrom, dateTo };
}

function normalizePagination(query: { page?: number | string; pageSize?: number | string }) {
  return {
    page: clampInteger(query.page, DEFAULT_PAGE, 1, 1_000_000),
    pageSize: clampInteger(query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
  };
}

function clampInteger(
  value: number | string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const normalized =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (!Number.isInteger(normalized)) {
    return fallback;
  }

  return Math.min(Math.max(normalized as number, min), max);
}

function dateOnlyToUtcDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return parsed;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function decimalToNumberOrNull(value: Prisma.Decimal | number | null) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function percentage(count: number, total: number) {
  return total > 0 ? roundMetric((count / total) * 100) : null;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function stringOrEmpty(value: string | null | undefined) {
  return value ? [value] : [];
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
