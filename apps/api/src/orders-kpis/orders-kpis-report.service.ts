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
  OrdersKpiDailyReportSummary
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

type OrdersKpiDailyReportRecord =
  Prisma.OrdersKpiDailyRecordGetPayload<{ select: typeof dailyReportSelect }>;

type OrdersKpiDailySummaryRecord =
  Prisma.OrdersKpiDailyRecordGetPayload<{ select: typeof summarySelect }>;

type OrdersKpiReportActor = Pick<AuthenticatedUser, "id" | "role">;

type OrdersKpiDailyReportScope =
  | { kind: "ALL" }
  | { kind: "PICKER"; userId: string }
  | { kind: "MATCHED_VENDORS"; vendorIds: string[] }
  | { kind: "MATCHED_CHAINS"; chainIds: string[] };

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

function normalizeDateRange(query: OrdersKpiDailyReportQuery) {
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

function normalizePagination(query: OrdersKpiDailyReportQuery) {
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

function pad(value: number) {
  return String(value).padStart(2, "0");
}
