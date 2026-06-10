import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  OrdersKpiIssueCode,
  OrdersKpiIssueSeverity,
  OrdersKpiPickerMatchStatus,
  OrdersKpiVendorMatchStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  ORDERS_KPI_INTEGER_METRIC_KEYS,
  ORDERS_KPI_UNKNOWN_PICKER_KEY,
  type OrdersKpiImportIssueDraft,
  type OrdersKpiIntegerMetricKey,
  type OrdersKpiParsedRow,
  type OrdersKpiParsedWorkbook,
  type OrdersKpiPreviewRow,
  type OrdersKpiStagingRowDraft,
  type OrdersKpiValidationResult,
  type OrdersKpiValidationSummary
} from "./orders-kpis.types";

type VendorLookupRow = {
  id: string;
  vendorCode: string;
  vendorExternalId: string | null;
  vendorName: string;
  chainId: string;
  chain: {
    id: string;
    chainName: string;
  };
};

type UserLookupRow = {
  id: string;
  shopperId: string | null;
  role: UserRole;
  nameEn: string;
};

interface RowContext {
  row: OrdersKpiParsedRow;
  issues: OrdersKpiImportIssueDraft[];
  vendorMatchStatus: OrdersKpiVendorMatchStatus | null;
  matchedVendor: VendorLookupRow | null;
  pickerMatchStatus: OrdersKpiPickerMatchStatus | null;
  matchedPicker: UserLookupRow | null;
  pickerNameSnapshot: string | null;
  sourcePickerKey: string;
}

const SUSPICIOUS_METRIC_THRESHOLD = 100_000;

@Injectable()
export class OrdersKpisValidatorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async validateParsedWorkbook(
    parsedWorkbook: OrdersKpiParsedWorkbook
  ): Promise<OrdersKpiValidationResult> {
    const coveredDates = getCoveredDates(parsedWorkbook.rows);
    const coveredDateFromString = coveredDates[0] ?? null;
    const coveredDateToString = coveredDates[coveredDates.length - 1] ?? null;
    const coveredDateFrom = coveredDateFromString
      ? dateStringToUtcDate(coveredDateFromString)
      : null;
    const coveredDateTo = coveredDateToString
      ? dateStringToUtcDate(coveredDateToString)
      : null;

    if (parsedWorkbook.missingRequiredColumns.length > 0) {
      const issue = createIssue({
        rowNumber: null,
        sourceVendorId: null,
        sourceShopperId: null,
        severity: OrdersKpiIssueSeverity.ERROR,
        issueCode: OrdersKpiIssueCode.MISSING_REQUIRED_COLUMNS,
        fieldName: null,
        message: `Missing required Orders KPI columns: ${parsedWorkbook.missingRequiredColumns.join(", ")}.`
      });

      return {
        rowCount: parsedWorkbook.rows.length,
        skippedRows: parsedWorkbook.skippedBlankRows,
        errorRows: 1,
        warningRows: 0,
        coveredDates,
        coveredDateFrom,
        coveredDateTo,
        coveredDateFromString,
        coveredDateToString,
        previewRows: [],
        stagingRows: [],
        issues: [issue],
        summary: emptySummary()
      };
    }

    const [vendorLookup, userLookup] = await Promise.all([
      this.loadVendorLookup(parsedWorkbook.rows),
      this.loadUserLookup(parsedWorkbook.rows)
    ]);
    const contexts = parsedWorkbook.rows.map((row) =>
      this.validateRow(row, vendorLookup, userLookup)
    );

    addUnsafeDuplicateConflicts(contexts);

    const previewRows = contexts.map(contextToPreviewRow);
    const issues = contexts.flatMap((context) => context.issues);
    const errorRowNumbers = new Set(
      issues
        .filter((issue) => issue.severity === OrdersKpiIssueSeverity.ERROR)
        .map((issue) => issue.rowNumber)
        .filter((rowNumber): rowNumber is number => rowNumber !== null)
    );
    const warningRowNumbers = new Set(
      issues
        .filter((issue) => issue.severity === OrdersKpiIssueSeverity.WARNING)
        .map((issue) => issue.rowNumber)
        .filter((rowNumber): rowNumber is number => rowNumber !== null)
    );
    const confirmableContexts = contexts.filter(isContextConfirmable);

    return {
      rowCount: parsedWorkbook.rows.length,
      skippedRows:
        parsedWorkbook.skippedBlankRows +
        contexts.filter((context) => !isContextConfirmable(context)).length,
      errorRows: errorRowNumbers.size,
      warningRows: warningRowNumbers.size,
      coveredDates,
      coveredDateFrom,
      coveredDateTo,
      coveredDateFromString,
      coveredDateToString,
      previewRows,
      stagingRows: aggregateStagingRows(confirmableContexts),
      issues,
      summary: buildSummary(confirmableContexts)
    };
  }

  private async loadVendorLookup(rows: OrdersKpiParsedRow[]) {
    const sourceVendorIds = Array.from(
      new Set(
        rows
          .map((row) => row.sourceVendorId)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (sourceVendorIds.length === 0) {
      return new Map<string, VendorLookupRow[]>();
    }

    const upperSourceVendorIds = sourceVendorIds.map((value) =>
      normalizeLookupKey(value)
    );
    const vendorWhere: Prisma.VendorWhereInput = {
      OR: [
        { vendorCode: { in: upperSourceVendorIds } },
        { vendorExternalId: { in: sourceVendorIds } },
        ...sourceVendorIds.map((sourceVendorId) => ({
          vendorExternalId: {
            equals: sourceVendorId,
            mode: Prisma.QueryMode.insensitive
          }
        }))
      ]
    };
    const vendors = await this.prisma.vendor.findMany({
      where: vendorWhere,
      select: {
        id: true,
        vendorCode: true,
        vendorExternalId: true,
        vendorName: true,
        chainId: true,
        chain: {
          select: {
            id: true,
            chainName: true
          }
        }
      }
    });

    const lookup = new Map<string, VendorLookupRow[]>();
    for (const vendor of vendors) {
      addVendorLookupValue(lookup, vendor.vendorCode, vendor);
      addVendorLookupValue(lookup, vendor.vendorExternalId, vendor);
    }

    return lookup;
  }

  private async loadUserLookup(rows: OrdersKpiParsedRow[]) {
    const sourceShopperIds = Array.from(
      new Set(
        rows
          .map((row) => row.sourceShopperId)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (sourceShopperIds.length === 0) {
      return new Map<string, UserLookupRow>();
    }

    const users = await this.prisma.user.findMany({
      where: {
        shopperId: {
          in: sourceShopperIds
        }
      },
      select: {
        id: true,
        shopperId: true,
        role: true,
        nameEn: true
      }
    });

    return new Map(
      users
        .filter((user) => user.shopperId)
        .map((user) => [user.shopperId as string, user])
    );
  }

  private validateRow(
    row: OrdersKpiParsedRow,
    vendorLookup: Map<string, VendorLookupRow[]>,
    userLookup: Map<string, UserLookupRow>
  ): RowContext {
    const issues: OrdersKpiImportIssueDraft[] = [];
    const vendorState = validateVendor(row, vendorLookup, issues);
    const pickerState = validatePicker(row, userLookup, issues);

    validateDate(row, issues);
    validateMetrics(row, issues);

    return {
      row,
      issues,
      vendorMatchStatus: vendorState.vendorMatchStatus,
      matchedVendor: vendorState.matchedVendor,
      pickerMatchStatus: pickerState.pickerMatchStatus,
      matchedPicker: pickerState.matchedPicker,
      pickerNameSnapshot: pickerState.pickerNameSnapshot,
      sourcePickerKey: pickerState.sourcePickerKey
    };
  }
}

function validateVendor(
  row: OrdersKpiParsedRow,
  vendorLookup: Map<string, VendorLookupRow[]>,
  issues: OrdersKpiImportIssueDraft[]
) {
  if (!row.sourceVendorId) {
    issues.push(
      rowIssue(row, OrdersKpiIssueSeverity.ERROR, OrdersKpiIssueCode.MISSING_VENDOR_ID, {
        fieldName: "vendor id",
        message: "Vendor ID is required."
      })
    );

    return {
      vendorMatchStatus: null,
      matchedVendor: null
    };
  }

  const vendors = vendorLookup.get(normalizeLookupKey(row.sourceVendorId)) ?? [];
  const uniqueVendors = uniqueVendorsById(vendors);

  if (uniqueVendors.length > 1) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.ERROR,
        OrdersKpiIssueCode.AMBIGUOUS_VENDOR_ID,
        {
          fieldName: "vendor id",
          message: "Vendor ID matches more than one SuperNova vendor."
        }
      )
    );

    return {
      vendorMatchStatus: null,
      matchedVendor: null
    };
  }

  if (uniqueVendors.length === 0) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.WARNING,
        OrdersKpiIssueCode.UNMAPPED_VENDOR_ID,
        {
          fieldName: "vendor id",
          message: "Vendor ID is not mapped to a SuperNova vendor."
        }
      )
    );

    return {
      vendorMatchStatus: OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID,
      matchedVendor: null
    };
  }

  return {
    vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED_VENDOR,
    matchedVendor: uniqueVendors[0]
  };
}

function validatePicker(
  row: OrdersKpiParsedRow,
  userLookup: Map<string, UserLookupRow>,
  issues: OrdersKpiImportIssueDraft[]
) {
  if (row.shopperIdWasNoData) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.WARNING,
        OrdersKpiIssueCode.NO_DATA_SHOPPER_ID,
        {
          fieldName: "shopperId",
          message: "Shopper ID is No data and will be stored as unknown."
        }
      )
    );

    return unknownPickerState();
  }

  if (!row.sourceShopperId) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.WARNING,
        OrdersKpiIssueCode.MISSING_SHOPPER_ID,
        {
          fieldName: "shopperId",
          message: "Shopper ID is missing and will be stored as unknown."
        }
      )
    );

    return unknownPickerState();
  }

  const matchedUser = userLookup.get(row.sourceShopperId);

  if (!matchedUser) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.WARNING,
        OrdersKpiIssueCode.UNMATCHED_SHOPPER_ID,
        {
          fieldName: "shopperId",
          message: "Shopper ID does not match a SuperNova user."
        }
      )
    );

    return {
      sourcePickerKey: row.sourceShopperId,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID,
      matchedPicker: null,
      pickerNameSnapshot: null
    };
  }

  if (matchedUser.role !== UserRole.PICKER) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.WARNING,
        OrdersKpiIssueCode.MATCHED_USER_NOT_PICKER,
        {
          fieldName: "shopperId",
          message: "Shopper ID matches a SuperNova user that is not a picker."
        }
      )
    );

    return {
      sourcePickerKey: row.sourceShopperId,
      pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_USER_NOT_PICKER,
      matchedPicker: null,
      pickerNameSnapshot: null
    };
  }

  return {
    sourcePickerKey: row.sourceShopperId,
    pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_PICKER,
    matchedPicker: matchedUser,
    pickerNameSnapshot: matchedUser.nameEn
  };
}

function validateDate(row: OrdersKpiParsedRow, issues: OrdersKpiImportIssueDraft[]) {
  if (row.kpiDate.isMissing) {
    issues.push(
      rowIssue(row, OrdersKpiIssueSeverity.ERROR, OrdersKpiIssueCode.MISSING_DATE, {
        fieldName: "date",
        message: "KPI date is required."
      })
    );
    return;
  }

  if (!row.kpiDate.isValid) {
    issues.push(
      rowIssue(row, OrdersKpiIssueSeverity.ERROR, OrdersKpiIssueCode.INVALID_DATE, {
        fieldName: "date",
        message: "KPI date is invalid."
      })
    );
  }
}

function validateMetrics(
  row: OrdersKpiParsedRow,
  issues: OrdersKpiImportIssueDraft[]
) {
  for (const metricKey of ORDERS_KPI_INTEGER_METRIC_KEYS) {
    const metric = row.integerMetrics[metricKey];

    if (metric.isNegative) {
      issues.push(
        rowIssue(
          row,
          OrdersKpiIssueSeverity.ERROR,
          OrdersKpiIssueCode.NEGATIVE_METRIC,
          {
            fieldName: metricKey,
            message: `${metricKey} must be zero or greater.`
          }
        )
      );
      continue;
    }

    if (!metric.isValid || metric.value === null) {
      issues.push(
        rowIssue(
          row,
          OrdersKpiIssueSeverity.ERROR,
          OrdersKpiIssueCode.INVALID_NUMERIC_METRIC,
          {
            fieldName: metricKey,
            message: `${metricKey} must be a non-negative integer.`
          }
        )
      );
      continue;
    }

    if (metric.value >= SUSPICIOUS_METRIC_THRESHOLD) {
      issues.push(
        rowIssue(
          row,
          OrdersKpiIssueSeverity.WARNING,
          OrdersKpiIssueCode.SUSPICIOUS_METRIC_VALUE,
          {
            fieldName: metricKey,
            message: `${metricKey} is unusually high.`
          }
        )
      );
    }
  }

  const preparationTime = row.preparationTime;

  if (preparationTime.isMissing || preparationTime.isNoData) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.WARNING,
        OrdersKpiIssueCode.PREPARATION_TIME_MISSING,
        {
          fieldName: "Preparation time",
          message: "Preparation time is missing or No data and will be stored as null."
        }
      )
    );
    return;
  }

  if (preparationTime.isNegative) {
    issues.push(
      rowIssue(row, OrdersKpiIssueSeverity.ERROR, OrdersKpiIssueCode.NEGATIVE_METRIC, {
        fieldName: "Preparation time",
        message: "Preparation time must be zero or greater."
      })
    );
    return;
  }

  if (!preparationTime.isValid) {
    issues.push(
      rowIssue(
        row,
        OrdersKpiIssueSeverity.ERROR,
        OrdersKpiIssueCode.INVALID_NUMERIC_METRIC,
        {
          fieldName: "Preparation time",
          message: "Preparation time must be a decimal number."
        }
      )
    );
  }
}

function addUnsafeDuplicateConflicts(contexts: RowContext[]) {
  const groups = new Map<string, RowContext[]>();

  for (const context of contexts.filter(isContextConfirmable)) {
    const key = stagingGrainKey(context);
    const group = groups.get(key) ?? [];
    group.push(context);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (!hasUnsafePreparationTimeConflict(group)) {
      continue;
    }

    for (const context of group) {
      context.issues.push(
        rowIssue(
          context.row,
          OrdersKpiIssueSeverity.ERROR,
          OrdersKpiIssueCode.UNSAFE_DUPLICATE_CONFLICT,
          {
            fieldName: null,
            message:
              "Duplicate rows for the same date, vendor, and picker cannot be safely aggregated."
          }
        )
      );
    }
  }
}

function hasUnsafePreparationTimeConflict(group: RowContext[]) {
  if (group.length <= 1) {
    return false;
  }

  const preparationValues = group
    .map((context) => context.row.preparationTime.value)
    .filter((value): value is number => value !== null);

  if (preparationValues.length <= 1) {
    return false;
  }

  const totalWeight = group.reduce(
    (sum, context) => sum + (context.row.integerMetrics.totalOrders.value ?? 0),
    0
  );

  if (totalWeight > 0) {
    return false;
  }

  return new Set(preparationValues).size > 1;
}

function aggregateStagingRows(contexts: RowContext[]): OrdersKpiStagingRowDraft[] {
  const groups = new Map<string, RowContext[]>();

  for (const context of contexts) {
    const key = stagingGrainKey(context);
    const group = groups.get(key) ?? [];
    group.push(context);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map(aggregateStagingRowGroup);
}

function aggregateStagingRowGroup(group: RowContext[]): OrdersKpiStagingRowDraft {
  const [first] = group;
  const issueCount = group.reduce((sum, context) => sum + context.issues.length, 0);
  const integerMetrics = {} as Record<OrdersKpiIntegerMetricKey, number>;

  for (const metricKey of ORDERS_KPI_INTEGER_METRIC_KEYS) {
    integerMetrics[metricKey] = group.reduce(
      (sum, context) => sum + (context.row.integerMetrics[metricKey].value ?? 0),
      0
    );
  }

  return {
    rawRowNumber: first.row.rawRowNumber,
    rowHash: hashAggregatedRows(group),
    kpiDate: first.row.kpiDate.date as Date,
    kpiDateString: first.row.kpiDate.dateString as string,
    sourceVendorId: normalizeSourceVendorId(first.row.sourceVendorId as string),
    matchedVendorId: first.matchedVendor?.id ?? null,
    matchedChainId: first.matchedVendor?.chainId ?? null,
    vendorNameSnapshot: first.matchedVendor?.vendorName ?? null,
    chainNameSnapshot: first.matchedVendor?.chain.chainName ?? null,
    vendorMatchStatus: first.vendorMatchStatus as OrdersKpiVendorMatchStatus,
    sourceShopperId: first.row.sourceShopperId,
    sourcePickerKey: first.sourcePickerKey,
    userId: first.matchedPicker?.id ?? null,
    pickerNameSnapshot: first.pickerNameSnapshot,
    pickerMatchStatus: first.pickerMatchStatus as OrdersKpiPickerMatchStatus,
    ...integerMetrics,
    preparationTime: aggregatePreparationTime(group),
    issuesCount: issueCount
  };
}

function aggregatePreparationTime(group: RowContext[]) {
  if (group.length === 1) {
    return group[0].row.preparationTime.value;
  }

  let weightedTotal = 0;
  let totalOrders = 0;

  for (const context of group) {
    const preparationTime = context.row.preparationTime.value;
    const rowTotalOrders = context.row.integerMetrics.totalOrders.value ?? 0;

    if (preparationTime === null || rowTotalOrders <= 0) {
      continue;
    }

    weightedTotal += preparationTime * rowTotalOrders;
    totalOrders += rowTotalOrders;
  }

  return totalOrders > 0 ? roundFourDecimals(weightedTotal / totalOrders) : null;
}

function contextToPreviewRow(context: RowContext): OrdersKpiPreviewRow {
  return {
    rawRowNumber: context.row.rawRowNumber,
    kpiDate: context.row.kpiDate.dateString,
    sourceVendorId: context.row.sourceVendorId
      ? normalizeSourceVendorId(context.row.sourceVendorId)
      : null,
    vendorLabel: vendorLabel(context),
    vendorMatchStatus: context.vendorMatchStatus,
    sourceShopperId: context.row.sourceShopperId,
    pickerLabel: pickerLabel(context),
    pickerMatchStatus: context.pickerMatchStatus,
    totalOrders: context.row.integerMetrics.totalOrders.value,
    issuesCount: context.issues.length,
    confirmable: isContextConfirmable(context)
  };
}

function vendorLabel(context: RowContext) {
  if (context.matchedVendor) {
    return context.matchedVendor.vendorName;
  }

  if (context.vendorMatchStatus === OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID) {
    return "Unmapped Vendor";
  }

  return "Unmapped Vendor";
}

function pickerLabel(context: RowContext) {
  if (context.pickerNameSnapshot) {
    return context.pickerNameSnapshot;
  }

  if (context.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID) {
    return "Unmatched Shopper";
  }

  if (context.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_USER_NOT_PICKER) {
    return "Matched User Not Picker";
  }

  return "Unknown Picker";
}

function buildSummary(contexts: RowContext[]): OrdersKpiValidationSummary {
  return contexts.reduce(
    (summary, context) => {
      if (context.vendorMatchStatus === OrdersKpiVendorMatchStatus.MATCHED_VENDOR) {
        summary.matchedVendorRows += 1;
      } else if (
        context.vendorMatchStatus === OrdersKpiVendorMatchStatus.UNMAPPED_VENDOR_ID
      ) {
        summary.unmappedVendorRows += 1;
      }

      if (context.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_PICKER) {
        summary.matchedPickerRows += 1;
      } else if (
        context.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNMATCHED_SHOPPER_ID
      ) {
        summary.unmatchedShopperRows += 1;
      } else if (
        context.pickerMatchStatus === OrdersKpiPickerMatchStatus.UNKNOWN_PICKER
      ) {
        summary.unknownPickerRows += 1;
      } else if (
        context.pickerMatchStatus === OrdersKpiPickerMatchStatus.MATCHED_USER_NOT_PICKER
      ) {
        summary.matchedUserNotPickerRows += 1;
      }

      return summary;
    },
    emptySummary()
  );
}

function emptySummary(): OrdersKpiValidationSummary {
  return {
    matchedVendorRows: 0,
    unmappedVendorRows: 0,
    matchedPickerRows: 0,
    unmatchedShopperRows: 0,
    unknownPickerRows: 0,
    matchedUserNotPickerRows: 0
  };
}

function unknownPickerState() {
  return {
    sourcePickerKey: ORDERS_KPI_UNKNOWN_PICKER_KEY,
    pickerMatchStatus: OrdersKpiPickerMatchStatus.UNKNOWN_PICKER,
    matchedPicker: null,
    pickerNameSnapshot: null
  };
}

function rowIssue(
  row: OrdersKpiParsedRow,
  severity: OrdersKpiIssueSeverity,
  issueCode: OrdersKpiIssueCode,
  params: {
    fieldName: string | null;
    message: string;
  }
) {
  return createIssue({
    rowNumber: row.rawRowNumber,
    sourceVendorId: row.sourceVendorId
      ? normalizeSourceVendorId(row.sourceVendorId)
      : null,
    sourceShopperId: row.sourceShopperId,
    severity,
    issueCode,
    fieldName: params.fieldName,
    message: params.message
  });
}

function createIssue(issue: OrdersKpiImportIssueDraft) {
  return issue;
}

function isContextConfirmable(context: RowContext) {
  return context.issues.every((issue) => issue.severity !== OrdersKpiIssueSeverity.ERROR);
}

function stagingGrainKey(context: RowContext) {
  return [
    context.row.kpiDate.dateString,
    normalizeSourceVendorId(context.row.sourceVendorId as string),
    context.sourcePickerKey
  ].join("|");
}

function addVendorLookupValue(
  lookup: Map<string, VendorLookupRow[]>,
  value: string | null,
  vendor: VendorLookupRow
) {
  if (!value) {
    return;
  }

  const key = normalizeLookupKey(value);
  const vendors = lookup.get(key) ?? [];

  if (!vendors.some((existingVendor) => existingVendor.id === vendor.id)) {
    vendors.push(vendor);
  }

  lookup.set(key, vendors);
}

function uniqueVendorsById(vendors: VendorLookupRow[]) {
  const byId = new Map<string, VendorLookupRow>();

  for (const vendor of vendors) {
    byId.set(vendor.id, vendor);
  }

  return Array.from(byId.values());
}

function getCoveredDates(rows: OrdersKpiParsedRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.kpiDate.dateString)
        .filter((dateString): dateString is string => Boolean(dateString))
    )
  ).sort();
}

function dateStringToUtcDate(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function normalizeSourceVendorId(value: string) {
  return value.trim().toUpperCase();
}

function normalizeLookupKey(value: string) {
  return value.trim().toUpperCase();
}

function hashAggregatedRows(group: RowContext[]) {
  if (group.length === 1) {
    return group[0].row.rowHash;
  }

  const hash = createHash("sha256");
  for (const context of group) {
    hash.update(context.row.rowHash);
    hash.update("|");
  }

  return hash.digest("hex");
}

function roundFourDecimals(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
