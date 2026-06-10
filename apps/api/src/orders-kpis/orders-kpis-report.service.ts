import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  ORDERS_KPI_INTEGER_METRIC_KEYS,
  ORDERS_KPI_PERFORMANCE_REPORT_SORT_KEYS,
  ORDERS_KPI_PERFORMANCE_REPORT_VIEWS,
  ORDERS_KPI_UNKNOWN_PICKER_KEY,
  type OrdersKpiImportActor,
  type OrdersKpiIntegerMetrics,
  type OrdersKpiMetricComparisons,
  type OrdersKpiMetricSummary,
  type OrdersKpiPerformanceFilterOption,
  type OrdersKpiPerformanceFilterOptions,
  type OrdersKpiPerformanceReportQuery,
  type OrdersKpiPerformanceReportResponse,
  type OrdersKpiPerformanceReportSortDirection,
  type OrdersKpiPerformanceReportSortKey,
  type OrdersKpiPerformanceReportView,
  type OrdersKpiPerformanceRow,
  type OrdersKpiPerformanceSummary,
  type OrdersKpiPerformanceTrendPoint,
  type OrdersKpiTargetEvaluation,
  type OrdersKpiTargetSettingsValues
} from "./orders-kpis.types";
import {
  DEFAULT_ORDERS_KPI_TARGET_SETTINGS,
  OrdersKpisTargetSettingsService
} from "./orders-kpis-target-settings.service";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DAY_IN_MS = 86_400_000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const reportRecordSelect = {
  id: true,
  kpiDate: true,
  sourceVendorId: true,
  matchedVendorId: true,
  matchedChainId: true,
  vendorNameSnapshot: true,
  chainNameSnapshot: true,
  vendorMatchStatus: true,
  sourceShopperId: true,
  sourcePickerKey: true,
  userId: true,
  pickerNameSnapshot: true,
  pickerMatchStatus: true,
  totalOrders: true,
  successfulOrders: true,
  qcFailedOrders: true,
  vendorFailedOrders: true,
  unhealthyOrders: true,
  orderNotOnTime: true,
  partialRefund: true,
  vendorDelay: true,
  preparationTime: true,
  outOfStock: true,
  firNotOnTime: true,
  priceModified: true
} satisfies Prisma.OrdersKpiDailyRecordSelect;

type OrdersKpiReportRecord = Prisma.OrdersKpiDailyRecordGetPayload<{
  select: typeof reportRecordSelect;
}>;

interface OrdersKpiPerformanceReportOptions {
  actor: OrdersKpiImportActor;
}

interface ParsedPerformanceReportQuery {
  dateFrom: string;
  dateTo: string;
  dateFromValue: Date;
  dateToExclusiveValue: Date;
  view: OrdersKpiPerformanceReportView;
  chainId: string | null;
  unmappedOnly: boolean;
  vendorId: string | null;
  sourceVendorId: string | null;
  pickerId: string | null;
  sourceShopperId: string | null;
  sourcePickerKey: string | null;
  search: string | null;
  pickerSearch: string | null;
  page: number;
  pageSize: number;
  sortBy: OrdersKpiPerformanceReportSortKey;
  sortDirection: OrdersKpiPerformanceReportSortDirection;
}

interface MetricAccumulator extends OrdersKpiIntegerMetrics {
  preparationWeightedTotal: number;
  preparationWeight: number;
}

interface RowAccumulator
  extends Omit<
    OrdersKpiPerformanceRow,
    "comparison" | "metrics" | "targetEvaluation"
  > {
  metrics: MetricAccumulator;
}

@Injectable()
export class OrdersKpisReportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OrdersKpisTargetSettingsService)
    private readonly targetSettingsService: OrdersKpisTargetSettingsService
  ) {}

  async getPerformanceReport(
    query: OrdersKpiPerformanceReportQuery,
    options: OrdersKpiPerformanceReportOptions
  ): Promise<OrdersKpiPerformanceReportResponse> {
    assertOrdersKpiReportActor(options.actor);

    const filters = parsePerformanceReportQuery(query);
    const previousPeriod = previousEquivalentPeriod(filters);
    const previousFilters = {
      ...filters,
      dateFrom: previousPeriod.dateFrom,
      dateTo: previousPeriod.dateTo,
      dateFromValue: previousPeriod.dateFromValue,
      dateToExclusiveValue: previousPeriod.dateToExclusiveValue
    };
    const [records, previousRecords, targetSettings] = await Promise.all([
      this.prisma.ordersKpiDailyRecord.findMany({
        where: buildReportWhere(filters),
        select: reportRecordSelect
      }),
      this.prisma.ordersKpiDailyRecord.findMany({
        where: buildReportWhere(previousFilters),
        select: reportRecordSelect
      }),
      this.targetSettingsService.getTargetSettings(options)
    ]);
    const filteredRecords = applyReportSearch(records, filters);
    const filteredPreviousRecords = applyReportSearch(previousRecords, filters);
    const currentSummary = summaryCards(summarizeRecords(filteredRecords));
    const previousSummary = summaryCards(summarizeRecords(filteredPreviousRecords));
    const rows = sortRows(
      attachRowComparisons(
        groupRows(filteredRecords, filters.view),
        groupRows(filteredPreviousRecords, filters.view)
      ).map((row) => attachTargetEvaluation(row, targetSettings.targets)),
      filters
    );
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));

    return {
      filters: responseFilters(filters),
      summary: currentSummary,
      targets: targetSettings,
      targetEvaluation: buildTargetEvaluation(
        currentSummary,
        targetSettings.targets
      ),
      comparison: {
        previousPeriod: {
          dateFrom: previousPeriod.dateFrom,
          dateTo: previousPeriod.dateTo
        },
        summary: compareMetricSummaries(currentSummary, previousSummary)
      },
      trend: buildTrendPoints(filteredRecords, filters),
      filterOptions: buildFilterOptions(filteredRecords),
      rows: paginateRows(rows, filters),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages
      }
    };
  }
}

function assertOrdersKpiReportActor(actor: OrdersKpiImportActor) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException("Only admins can read Orders KPI reports.");
  }
}

function parsePerformanceReportQuery(
  query: OrdersKpiPerformanceReportQuery
): ParsedPerformanceReportQuery {
  const dateFrom = parseRequiredDate("dateFrom", query.dateFrom);
  const dateTo = parseRequiredDate("dateTo", query.dateTo);
  const view = parseReportView(query.view);
  const filters = {
    dateFrom: dateFrom.dateString,
    dateTo: dateTo.dateString,
    dateFromValue: dateFrom.dateValue,
    dateToExclusiveValue: addDays(dateTo.dateValue, 1),
    view,
    chainId: normalizeOptionalText(query.chainId),
    unmappedOnly: parseBoolean(query.unmappedOnly),
    vendorId: normalizeOptionalText(query.vendorId),
    sourceVendorId: normalizeOptionalText(query.sourceVendorId),
    pickerId: normalizeOptionalText(query.pickerId),
    sourceShopperId: normalizeOptionalText(query.sourceShopperId),
    sourcePickerKey: normalizeOptionalText(query.sourcePickerKey),
    search: normalizeOptionalText(query.search),
    pickerSearch: normalizeOptionalText(query.pickerSearch),
    page: parsePositiveInteger(query.page, DEFAULT_PAGE, "page"),
    pageSize: Math.min(
      parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, "pageSize"),
      MAX_PAGE_SIZE
    ),
    sortBy: parseSortKey(query.sortBy),
    sortDirection: parseSortDirection(query.sortDirection)
  };

  assertReportFilters(filters);
  return filters;
}

function parseRequiredDate(fieldName: string, value: unknown) {
  if (typeof value !== "string") {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) {
    throw new BadRequestException(`${fieldName} must be YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dateValue = new Date(Date.UTC(year, month - 1, day));

  if (!isSameUtcDate(dateValue, year, month, day)) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return {
    dateString: value,
    dateValue
  };
}

function parseReportView(value: unknown): OrdersKpiPerformanceReportView {
  const normalizedView = typeof value === "string" ? value.toUpperCase() : "";

  if (isReportView(normalizedView)) {
    return normalizedView;
  }

  throw new BadRequestException("view must be CHAIN, VENDOR, or PICKER.");
}

function parseSortKey(value: unknown): OrdersKpiPerformanceReportSortKey {
  if (value === undefined || value === null || value === "") {
    return "totalOrders";
  }

  if (typeof value === "string" && isSortKey(value)) {
    return value;
  }

  throw new BadRequestException("sortBy is not supported for Orders KPI reports.");
}

function parseSortDirection(
  value: unknown
): OrdersKpiPerformanceReportSortDirection {
  if (value === undefined || value === null || value === "") {
    return "desc";
  }

  if (value === "asc" || value === "desc") {
    return value;
  }

  throw new BadRequestException("sortDirection must be asc or desc.");
}

function parseBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (value === true || value === "true" || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === "0") {
    return false;
  }

  throw new BadRequestException("unmappedOnly must be true or false.");
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
  fieldName: string
) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new BadRequestException(`${fieldName} must be a positive integer.`);
  }

  return numericValue;
}

function assertReportFilters(filters: ParsedPerformanceReportQuery) {
  if (filters.dateFromValue.getTime() >= filters.dateToExclusiveValue.getTime()) {
    throw new BadRequestException("dateFrom must be on or before dateTo.");
  }

  if (filters.unmappedOnly && filters.chainId) {
    throw new BadRequestException("chainId cannot be combined with unmappedOnly.");
  }

  if (filters.unmappedOnly && filters.vendorId) {
    throw new BadRequestException("vendorId cannot be combined with unmappedOnly.");
  }

  if (filters.vendorId && filters.sourceVendorId) {
    throw new BadRequestException(
      "vendorId cannot be combined with sourceVendorId."
    );
  }

  const pickerIdentityCount =
    Number(Boolean(filters.pickerId)) +
    Number(Boolean(filters.sourceShopperId)) +
    Number(Boolean(filters.sourcePickerKey));

  if (pickerIdentityCount > 1) {
    throw new BadRequestException(
      "Only one picker identity filter can be used at a time."
    );
  }

  if (filters.view !== "PICKER" && filters.pickerSearch) {
    throw new BadRequestException("pickerSearch is only supported in Picker View.");
  }
}

function buildReportWhere(
  filters: ParsedPerformanceReportQuery
): Prisma.OrdersKpiDailyRecordWhereInput {
  return {
    kpiDate: {
      gte: filters.dateFromValue,
      lt: filters.dateToExclusiveValue
    },
    ...(filters.chainId ? { matchedChainId: filters.chainId } : {}),
    ...(filters.unmappedOnly
      ? { vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID }
      : {}),
    ...(filters.vendorId ? { matchedVendorId: filters.vendorId } : {}),
    ...(filters.sourceVendorId ? { sourceVendorId: filters.sourceVendorId } : {}),
    ...(filters.pickerId ? { userId: filters.pickerId } : {}),
    ...(filters.sourceShopperId
      ? { sourceShopperId: filters.sourceShopperId }
      : {}),
    ...(filters.sourcePickerKey
      ? { sourcePickerKey: filters.sourcePickerKey }
      : {})
  };
}

function applyReportSearch(
  records: OrdersKpiReportRecord[],
  filters: ParsedPerformanceReportQuery
) {
  let filteredRecords = records;

  if (filters.search) {
    const searchText = normalizeSearchText(filters.search);
    filteredRecords = filteredRecords.filter((record) =>
      normalizeSearchText(reportSearchText(record)).includes(searchText)
    );
  }

  if (filters.view === "PICKER" && filters.pickerSearch) {
    const searchText = normalizeSearchText(filters.pickerSearch);
    filteredRecords = filteredRecords.filter((record) =>
      normalizeSearchText(pickerDisplayText(record)).includes(searchText)
    );
  }

  return filteredRecords;
}

function groupRows(
  records: OrdersKpiReportRecord[],
  view: OrdersKpiPerformanceReportView
) {
  const groups = new Map<string, RowAccumulator>();

  for (const record of records) {
    const group =
      view === "CHAIN"
        ? chainGroup(groups, record)
        : view === "VENDOR"
          ? vendorGroup(groups, record)
          : pickerGroup(groups, record);
    addRecordMetrics(group.metrics, record);
  }

  return Array.from(groups.values()).map(finalizeRow);
}

function chainGroup(
  groups: Map<string, RowAccumulator>,
  record: OrdersKpiReportRecord
) {
  if (record.vendorMatchStatus === OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID) {
    return getOrCreateGroup(groups, "UNMAPPED_CHAIN", () => ({
      ...baseGroup("UNMAPPED_CHAIN", "UNMAPPED_CHAIN", "Unmapped Chain"),
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      hasDrilldown: true,
      nextView: "VENDOR",
      drilldownParams: { unmappedOnly: true }
    }));
  }

  const groupKey = record.matchedChainId ?? "UNMAPPED_CHAIN";
  return getOrCreateGroup(groups, groupKey, () => ({
    ...baseGroup(groupKey, "MATCHED_CHAIN", chainLabel(record)),
    matchedChainId: record.matchedChainId,
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    hasDrilldown: Boolean(record.matchedChainId),
    nextView: record.matchedChainId ? "VENDOR" : null,
    drilldownParams: record.matchedChainId
      ? { chainId: record.matchedChainId }
      : null
  }));
}

function vendorGroup(
  groups: Map<string, RowAccumulator>,
  record: OrdersKpiReportRecord
) {
  if (record.vendorMatchStatus === OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID) {
    return getOrCreateGroup(groups, record.sourceVendorId, () => ({
      ...baseGroup(
        record.sourceVendorId,
        "UNMAPPED_VENDOR",
        `Unmapped Vendor ${record.sourceVendorId}`
      ),
      sourceVendorId: record.sourceVendorId,
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      hasDrilldown: true,
      nextView: "PICKER",
      drilldownParams: { sourceVendorId: record.sourceVendorId }
    }));
  }

  const groupKey = record.matchedVendorId ?? record.sourceVendorId;
  return getOrCreateGroup(groups, groupKey, () => ({
    ...baseGroup(groupKey, "MATCHED_VENDOR", vendorLabel(record)),
    matchedChainId: record.matchedChainId,
    matchedVendorId: record.matchedVendorId,
    sourceVendorId: record.sourceVendorId,
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    hasDrilldown: Boolean(record.matchedVendorId),
    nextView: record.matchedVendorId ? "PICKER" : null,
    drilldownParams: record.matchedVendorId
      ? { vendorId: record.matchedVendorId }
      : null
  }));
}

function pickerGroup(
  groups: Map<string, RowAccumulator>,
  record: OrdersKpiReportRecord
) {
  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_PICKER) {
    const groupKey = record.userId ?? `MATCHED_PICKER:${record.sourcePickerKey}`;
    return getOrCreateGroup(groups, groupKey, () =>
      pickerBaseGroup(record, groupKey, "MATCHED_PICKER", matchedPickerLabel(record))
    );
  }

  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID) {
    const shopperId = record.sourceShopperId ?? record.sourcePickerKey;
    return getOrCreateGroup(groups, `UNMATCHED_SHOPPER:${shopperId}`, () =>
      pickerBaseGroup(
        record,
        `UNMATCHED_SHOPPER:${shopperId}`,
        "UNMATCHED_SHOPPER",
        `Unmatched shopperId: ${shopperId}`
      )
    );
  }

  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_USER_NOT_PICKER) {
    const shopperId = record.sourceShopperId ?? record.sourcePickerKey;
    return getOrCreateGroup(groups, `MATCHED_USER_NOT_PICKER:${shopperId}`, () =>
      pickerBaseGroup(
        record,
        `MATCHED_USER_NOT_PICKER:${shopperId}`,
        "MATCHED_USER_NOT_PICKER",
        `Non-Picker shopperId: ${shopperId}`
      )
    );
  }

  return getOrCreateGroup(groups, "UNKNOWN_PICKER", () =>
    pickerBaseGroup(record, "UNKNOWN_PICKER", "UNKNOWN_PICKER", "Unknown Picker")
  );
}

function pickerBaseGroup(
  record: OrdersKpiReportRecord,
  groupKey: string,
  groupType: OrdersKpiPerformanceRow["groupType"],
  label: string
): RowAccumulator {
  return {
    ...baseGroup(groupKey, groupType, label),
    matchedChainId: record.matchedChainId,
    matchedVendorId: record.matchedVendorId,
    userId:
      record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_PICKER
        ? record.userId
        : null,
    sourceVendorId: record.sourceVendorId,
    sourceShopperId:
      record.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNKNOWN_PICKER
        ? null
        : record.sourceShopperId,
    sourcePickerKey:
      record.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNKNOWN_PICKER
        ? ORDERS_KPI_UNKNOWN_PICKER_KEY
        : record.sourcePickerKey,
    vendorMatchStatus: record.vendorMatchStatus,
    pickerMatchStatus: record.pickerMatchStatus
  };
}

function baseGroup(
  groupKey: string,
  groupType: OrdersKpiPerformanceRow["groupType"],
  label: string
): RowAccumulator {
  return {
    groupKey,
    groupType,
    label,
    matchedChainId: null,
    matchedVendorId: null,
    userId: null,
    sourceVendorId: null,
    sourceShopperId: null,
    sourcePickerKey: null,
    vendorMatchStatus: null,
    pickerMatchStatus: null,
    hasDrilldown: false,
    nextView: null,
    drilldownParams: null,
    metrics: createMetricAccumulator()
  };
}

function getOrCreateGroup(
  groups: Map<string, RowAccumulator>,
  groupKey: string,
  createGroup: () => RowAccumulator
) {
  const existingGroup = groups.get(groupKey);
  if (existingGroup) {
    return existingGroup;
  }

  const group = createGroup();
  groups.set(groupKey, group);
  return group;
}

function summarizeRecords(records: OrdersKpiReportRecord[]) {
  const metrics = createMetricAccumulator();

  for (const record of records) {
    addRecordMetrics(metrics, record);
  }

  return finalizeMetrics(metrics);
}

function createMetricAccumulator(): MetricAccumulator {
  return {
    totalOrders: 0,
    successfulOrders: 0,
    qcFailedOrders: 0,
    vendorFailedOrders: 0,
    unhealthyOrders: 0,
    orderNotOnTime: 0,
    partialRefund: 0,
    vendorDelay: 0,
    outOfStock: 0,
    firNotOnTime: 0,
    priceModified: 0,
    preparationWeightedTotal: 0,
    preparationWeight: 0
  };
}

function addRecordMetrics(
  metrics: MetricAccumulator,
  record: OrdersKpiReportRecord
) {
  for (const metricKey of ORDERS_KPI_INTEGER_METRIC_KEYS) {
    metrics[metricKey] += record[metricKey];
  }

  const preparationTime = decimalToNumber(record.preparationTime);
  if (preparationTime !== null && record.totalOrders > 0) {
    metrics.preparationWeightedTotal += preparationTime * record.totalOrders;
    metrics.preparationWeight += record.totalOrders;
  }
}

function finalizeMetrics(metrics: MetricAccumulator): OrdersKpiMetricSummary {
  return {
    totalOrders: metrics.totalOrders,
    successfulOrders: metrics.successfulOrders,
    qcFailedOrders: metrics.qcFailedOrders,
    vendorFailedOrders: metrics.vendorFailedOrders,
    unhealthyOrders: metrics.unhealthyOrders,
    unhealthyRate:
      metrics.totalOrders > 0
        ? (metrics.unhealthyOrders / metrics.totalOrders) * 100
        : 0,
    orderNotOnTime: metrics.orderNotOnTime,
    partialRefund: metrics.partialRefund,
    vendorDelay: metrics.vendorDelay,
    preparationTime:
      metrics.preparationWeight > 0
        ? roundFourDecimals(metrics.preparationWeightedTotal / metrics.preparationWeight)
        : null,
    outOfStock: metrics.outOfStock,
    firNotOnTime: metrics.firNotOnTime,
    priceModified: metrics.priceModified
  };
}

function summaryCards(
  metrics: OrdersKpiMetricSummary
): OrdersKpiPerformanceSummary {
  return {
    totalOrders: metrics.totalOrders,
    unhealthyOrders: metrics.unhealthyOrders,
    unhealthyRate: metrics.unhealthyRate,
    orderNotOnTime: metrics.orderNotOnTime,
    qcFailedOrders: metrics.qcFailedOrders,
    partialRefund: metrics.partialRefund,
    outOfStock: metrics.outOfStock,
    priceModified: metrics.priceModified
  };
}

function emptyMetricSummary(): OrdersKpiMetricSummary {
  return finalizeMetrics(createMetricAccumulator());
}

function compareMetricSummaries(
  currentMetrics: OrdersKpiMetricSummary | OrdersKpiPerformanceSummary,
  previousMetrics: OrdersKpiMetricSummary | OrdersKpiPerformanceSummary
): OrdersKpiMetricComparisons {
  return ORDERS_KPI_PERFORMANCE_REPORT_SORT_KEYS.reduce(
    (comparisons, metricKey) => ({
      ...comparisons,
      [metricKey]: compareMetric(metricKey, currentMetrics, previousMetrics)
    }),
    {} as OrdersKpiMetricComparisons
  );
}

function compareMetric(
  metricKey: OrdersKpiPerformanceReportSortKey,
  currentMetrics: OrdersKpiMetricSummary | OrdersKpiPerformanceSummary,
  previousMetrics: OrdersKpiMetricSummary | OrdersKpiPerformanceSummary
) {
  const current = currentMetrics[metricKey];
  const previous = previousMetrics[metricKey];
  const delta = roundFourDecimals(current - previous);

  return {
    current,
    previous,
    delta,
    deltaPercent:
      metricKey === "unhealthyRate" || previous === 0
        ? null
        : roundFourDecimals((delta / previous) * 100)
  };
}

function buildTargetEvaluation(
  metrics: OrdersKpiMetricSummary | OrdersKpiPerformanceSummary,
  targets: OrdersKpiTargetSettingsValues
): OrdersKpiTargetEvaluation {
  const primary = metricTargetEvaluation(
    "unhealthyRate",
    metrics.unhealthyRate,
    targets.uhoRateTarget
  );
  const secondaryMetrics = [
    metricTargetEvaluation(
      "orderNotOnTime",
      rate(metrics.orderNotOnTime, metrics.totalOrders),
      targets.notOnTimeRateTarget
    ),
    metricTargetEvaluation(
      "qcFailedOrders",
      rate(metrics.qcFailedOrders, metrics.totalOrders),
      targets.qcFailedRateTarget
    ),
    metricTargetEvaluation(
      "partialRefund",
      rate(metrics.partialRefund, metrics.totalOrders),
      targets.partialRefundRateTarget
    ),
    metricTargetEvaluation(
      "outOfStock",
      rate(metrics.outOfStock, metrics.totalOrders),
      targets.oosRateTarget
    ),
    metricTargetEvaluation(
      "priceModified",
      rate(metrics.priceModified, metrics.totalOrders),
      targets.priceModifiedRateTarget
    )
  ];

  return {
    status: primary.status,
    primary,
    secondaryWarnings: secondaryMetrics.filter(
      (metric) => metric.status === "OUT_OF_TARGET"
    ),
    metrics: {
      unhealthyRate: primary,
      orderNotOnTime: secondaryMetrics[0],
      qcFailedOrders: secondaryMetrics[1],
      partialRefund: secondaryMetrics[2],
      outOfStock: secondaryMetrics[3],
      priceModified: secondaryMetrics[4]
    }
  };
}

function metricTargetEvaluation(
  metricKey: OrdersKpiTargetEvaluation["primary"]["metricKey"],
  metricRate: number,
  target: number
) {
  const rateValue = roundFourDecimals(metricRate);

  return {
    metricKey,
    rate: rateValue,
    target,
    status: rateValue > target ? "OUT_OF_TARGET" : "IN_TARGET"
  } satisfies OrdersKpiTargetEvaluation["primary"];
}

function rate(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function previousEquivalentPeriod(filters: ParsedPerformanceReportQuery) {
  const periodDays = Math.max(
    1,
    Math.round(
      (filters.dateToExclusiveValue.getTime() - filters.dateFromValue.getTime()) /
        DAY_IN_MS
    )
  );
  const dateToExclusiveValue = filters.dateFromValue;
  const dateFromValue = addDays(filters.dateFromValue, -periodDays);
  const dateToValue = addDays(dateToExclusiveValue, -1);

  return {
    dateFrom: formatUtcDate(dateFromValue),
    dateTo: formatUtcDate(dateToValue),
    dateFromValue,
    dateToExclusiveValue
  };
}

function buildTrendPoints(
  records: OrdersKpiReportRecord[],
  filters: ParsedPerformanceReportQuery
): OrdersKpiPerformanceTrendPoint[] {
  const metricsByDate = new Map<string, MetricAccumulator>();

  for (
    let cursor = filters.dateFromValue;
    cursor.getTime() < filters.dateToExclusiveValue.getTime();
    cursor = addDays(cursor, 1)
  ) {
    metricsByDate.set(formatUtcDate(cursor), createMetricAccumulator());
  }

  for (const record of records) {
    const dateKey = formatUtcDate(record.kpiDate);
    const metrics = metricsByDate.get(dateKey);

    if (metrics) {
      addRecordMetrics(metrics, record);
    }
  }

  return Array.from(metricsByDate.entries()).map(([date, metrics]) => ({
    date,
    metrics: summaryCards(finalizeMetrics(metrics))
  }));
}

function buildFilterOptions(
  records: OrdersKpiReportRecord[]
): OrdersKpiPerformanceFilterOptions {
  const chainOptions = new Map<string, OrdersKpiPerformanceFilterOption>();
  const vendorOptions = new Map<string, OrdersKpiPerformanceFilterOption>();
  const pickerOptions = new Map<string, OrdersKpiPerformanceFilterOption>();

  for (const record of records) {
    addChainFilterOption(chainOptions, record);
    addVendorFilterOption(vendorOptions, record);
    addPickerFilterOption(pickerOptions, record);
  }

  return {
    chains: sortFilterOptions(chainOptions),
    vendors: sortFilterOptions(vendorOptions),
    pickers: sortFilterOptions(pickerOptions)
  };
}

function addChainFilterOption(
  options: Map<string, OrdersKpiPerformanceFilterOption>,
  record: OrdersKpiReportRecord
) {
  if (record.vendorMatchStatus === OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID) {
    options.set("UNMAPPED_CHAIN", {
      id: null,
      label: "Unmapped Chain",
      unmappedOnly: true
    });
    return;
  }

  const key = record.matchedChainId ?? "UNMAPPED_CHAIN";
  if (!options.has(key)) {
    options.set(key, {
      id: record.matchedChainId,
      label: chainLabel(record),
      unmappedOnly: false
    });
  }
}

function addVendorFilterOption(
  options: Map<string, OrdersKpiPerformanceFilterOption>,
  record: OrdersKpiReportRecord
) {
  if (record.vendorMatchStatus === OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID) {
    const key = `SOURCE_VENDOR:${record.sourceVendorId}`;
    if (!options.has(key)) {
      options.set(key, {
        id: null,
        label: `Unmapped Vendor ${record.sourceVendorId}`,
        sourceVendorId: record.sourceVendorId
      });
    }
    return;
  }

  const key = record.matchedVendorId ?? `SOURCE_VENDOR:${record.sourceVendorId}`;
  if (!options.has(key)) {
    options.set(key, {
      id: record.matchedVendorId,
      label: vendorLabel(record),
      sourceVendorId: record.sourceVendorId
    });
  }
}

function addPickerFilterOption(
  options: Map<string, OrdersKpiPerformanceFilterOption>,
  record: OrdersKpiReportRecord
) {
  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_PICKER) {
    const key = record.userId ?? `PICKER_KEY:${record.sourcePickerKey}`;
    if (!options.has(key)) {
      options.set(key, {
        id: record.userId,
        label: matchedPickerLabel(record),
        sourceShopperId: record.sourceShopperId,
        sourcePickerKey: record.sourcePickerKey
      });
    }
    return;
  }

  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNKNOWN_PICKER) {
    options.set("UNKNOWN_PICKER", {
      id: null,
      label: "Unknown Picker",
      sourcePickerKey: ORDERS_KPI_UNKNOWN_PICKER_KEY
    });
    return;
  }

  const shopperId = record.sourceShopperId ?? record.sourcePickerKey;
  const key = `${record.pickerMatchStatus}:${shopperId}`;
  if (!options.has(key)) {
    options.set(key, {
      id: null,
      label: pickerDisplayText(record),
      sourceShopperId: record.sourceShopperId,
      sourcePickerKey: record.sourcePickerKey
    });
  }
}

function sortFilterOptions(
  options: Map<string, OrdersKpiPerformanceFilterOption>
) {
  return Array.from(options.values()).sort(
    (leftOption, rightOption) =>
      leftOption.label.localeCompare(rightOption.label) ||
      String(leftOption.id ?? "").localeCompare(String(rightOption.id ?? ""))
  );
}

function finalizeRow(group: RowAccumulator): OrdersKpiPerformanceRow {
  const metrics = finalizeMetrics(group.metrics);

  return {
    ...group,
    metrics,
    comparison: compareMetricSummaries(metrics, emptyMetricSummary()),
    targetEvaluation: buildTargetEvaluation(
      metrics,
      DEFAULT_ORDERS_KPI_TARGET_SETTINGS
    )
  };
}

function attachRowComparisons(
  currentRows: OrdersKpiPerformanceRow[],
  previousRows: OrdersKpiPerformanceRow[]
) {
  const previousRowsByKey = new Map(
    previousRows.map((row) => [row.groupKey, row])
  );

  return currentRows.map((row) => {
    const previousRow = previousRowsByKey.get(row.groupKey);
    return {
      ...row,
      comparison: compareMetricSummaries(
        row.metrics,
        previousRow?.metrics ?? emptyMetricSummary()
      )
    };
  });
}

function attachTargetEvaluation(
  row: OrdersKpiPerformanceRow,
  targets: OrdersKpiTargetSettingsValues
): OrdersKpiPerformanceRow {
  return {
    ...row,
    targetEvaluation: buildTargetEvaluation(row.metrics, targets)
  };
}

function sortRows(
  rows: OrdersKpiPerformanceRow[],
  filters: ParsedPerformanceReportQuery
) {
  const directionMultiplier = filters.sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((leftRow, rightRow) => {
    const metricDifference =
      leftRow.metrics[filters.sortBy] - rightRow.metrics[filters.sortBy];

    if (metricDifference !== 0) {
      return metricDifference * directionMultiplier;
    }

    return (
      leftRow.label.localeCompare(rightRow.label) ||
      leftRow.groupKey.localeCompare(rightRow.groupKey)
    );
  });
}

function paginateRows(
  rows: OrdersKpiPerformanceRow[],
  filters: ParsedPerformanceReportQuery
) {
  const startIndex = (filters.page - 1) * filters.pageSize;
  return rows.slice(startIndex, startIndex + filters.pageSize);
}

function responseFilters(filters: ParsedPerformanceReportQuery) {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    view: filters.view,
    chainId: filters.chainId,
    unmappedOnly: filters.unmappedOnly,
    vendorId: filters.vendorId,
    sourceVendorId: filters.sourceVendorId,
    pickerId: filters.pickerId,
    sourceShopperId: filters.sourceShopperId,
    sourcePickerKey: filters.sourcePickerKey,
    search: filters.search,
    pickerSearch: filters.pickerSearch,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection
  };
}

function chainLabel(record: OrdersKpiReportRecord) {
  return (
    normalizeOptionalText(record.chainNameSnapshot) ??
    (record.matchedChainId ? `Chain ${record.matchedChainId}` : "Unmapped Chain")
  );
}

function vendorLabel(record: OrdersKpiReportRecord) {
  return (
    normalizeOptionalText(record.vendorNameSnapshot) ??
    (record.matchedVendorId ? `Vendor ${record.matchedVendorId}` : "Unmapped Vendor")
  );
}

function matchedPickerLabel(record: OrdersKpiReportRecord) {
  return (
    normalizeOptionalText(record.pickerNameSnapshot) ??
    (record.userId ? `Picker ${record.userId}` : `Picker ${record.sourcePickerKey}`)
  );
}

function pickerDisplayText(record: OrdersKpiReportRecord) {
  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_PICKER) {
    return `${matchedPickerLabel(record)} ${record.sourceShopperId ?? ""}`;
  }

  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID) {
    return `Unmatched shopperId: ${record.sourceShopperId ?? record.sourcePickerKey}`;
  }

  if (record.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_USER_NOT_PICKER) {
    return `Non-Picker shopperId: ${record.sourceShopperId ?? record.sourcePickerKey}`;
  }

  return "Unknown Picker";
}

function reportSearchText(record: OrdersKpiReportRecord) {
  return [
    chainLabel(record),
    record.matchedChainId,
    vendorLabel(record),
    record.matchedVendorId,
    record.sourceVendorId,
    pickerDisplayText(record),
    record.userId,
    record.sourceShopperId,
    record.sourcePickerKey
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    const numericValue = value.toNumber();
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isReportView(value: string): value is OrdersKpiPerformanceReportView {
  return ORDERS_KPI_PERFORMANCE_REPORT_VIEWS.includes(
    value as OrdersKpiPerformanceReportView
  );
}

function isSortKey(value: string): value is OrdersKpiPerformanceReportSortKey {
  return ORDERS_KPI_PERFORMANCE_REPORT_SORT_KEYS.includes(
    value as OrdersKpiPerformanceReportSortKey
  );
}

function isSameUtcDate(dateValue: Date, year: number, month: number, day: number) {
  return (
    dateValue.getUTCFullYear() === year &&
    dateValue.getUTCMonth() === month - 1 &&
    dateValue.getUTCDate() === day
  );
}

function addDays(dateValue: Date, days: number) {
  const nextDate = new Date(dateValue);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatUtcDate(dateValue: Date) {
  return dateValue.toISOString().slice(0, 10);
}

function roundFourDecimals(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
