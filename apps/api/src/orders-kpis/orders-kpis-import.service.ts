import { createHash } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AssignmentStatus,
  OrdersKpiImportBatchStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { OrdersKpisParserService } from "./orders-kpis-parser.service";
import type {
  OrdersKpiApproveValidRowsOptions,
  OrdersKpiImportConfirmOptions,
  OrdersKpiImportConfirmResult,
  OrdersKpiImportPreviewOptions,
  OrdersKpiImportPreviewResult,
  OrdersKpiImportRejectOptions,
  OrdersKpiImportRejectResult,
  OrdersKpiMatchedUser,
  OrdersKpiMatchedVendor,
  OrdersKpiParsedRow,
  OrdersKpiValidatedStagingRow
} from "./orders-kpis.types";
import { OrdersKpisValidatorService } from "./orders-kpis-validator.service";

type OrdersKpiPrismaTransaction = Prisma.TransactionClient;

@Injectable()
export class OrdersKpisImportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OrdersKpisParserService)
    private readonly parser: OrdersKpisParserService,
    @Inject(OrdersKpisValidatorService)
    private readonly validator: OrdersKpisValidatorService
  ) {}

  async previewImport(
    buffer: Buffer,
    options: OrdersKpiImportPreviewOptions
  ): Promise<OrdersKpiImportPreviewResult> {
    assertAdminActor(options.actor);

    const now = normalizeDateTime(options.now);
    const workbook = await this.parser.parseFile(buffer, {
      fileName: options.fileName
    });
    const context = await this.loadValidationContext(workbook.rows);
    const preview = this.validator.validateWorkbook(workbook, context);
    const status =
      preview.errorRows === 0
        ? OrdersKpiImportBatchStatus.VALIDATED
        : OrdersKpiImportBatchStatus.NEEDS_REVIEW;
    const stagingRows = preview.stagingRows;
    const canConfirm = status === OrdersKpiImportBatchStatus.VALIDATED;
    const canApproveValidRows =
      status === OrdersKpiImportBatchStatus.NEEDS_REVIEW &&
      stagingRows.length > 0;
    const canReject =
      status === OrdersKpiImportBatchStatus.VALIDATED ||
      status === OrdersKpiImportBatchStatus.NEEDS_REVIEW;
    const skippedErrorRows = preview.errorRows;

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.ordersKpiImportBatch.create({
        data: {
          fileName: normalizeFileName(options.fileName),
          fileHash: hashBuffer(buffer),
          uploadedByUserId: options.actor.id,
          uploadedAt: now,
          status,
          rowCount: preview.rowCount,
          matchedRows: preview.matchedRows,
          unmatchedRows: preview.unmatchedRows,
          errorRows: preview.errorRows,
          warningRows: preview.warningRows,
          dateFrom: dateOnlyToUtcDateOrNull(preview.dateFrom),
          dateTo: dateOnlyToUtcDateOrNull(preview.dateTo),
          confirmedByUserId: null,
          confirmedAt: null
        }
      });

      if (preview.issues.length > 0) {
        await tx.ordersKpiImportIssue.createMany({
          data: preview.issues.map((issue) => ({
            batchId: createdBatch.id,
            rowNumber: issue.rowNumber,
            shopperId: issue.shopperId,
            severity: issue.severity,
            issueCode: issue.issueCode,
            fieldName: issue.fieldName,
            message: issue.message
          }))
        });
      }

      if (stagingRows.length > 0) {
        await tx.ordersKpiImportStagingRow.createMany({
          data: stagingRows.map((row) =>
            mapStagingRowForCreate(createdBatch.id, row)
          )
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: options.actor.id,
          action:
            status === OrdersKpiImportBatchStatus.VALIDATED
              ? "ORDERS_KPI_IMPORT_PREVIEW_CREATED"
              : "ORDERS_KPI_IMPORT_REVIEW_CREATED",
          entityType: "OrdersKpiImportBatch",
          entityId: createdBatch.id,
          oldValue: Prisma.JsonNull,
          newValue: toAuditJson({
            batchId: createdBatch.id,
            rowCount: preview.rowCount,
            matchedRows: preview.matchedRows,
            unmatchedRows: preview.unmatchedRows,
            errorRows: preview.errorRows,
            warningRows: preview.warningRows,
            dateFrom: preview.dateFrom,
            dateTo: preview.dateTo,
            status,
            stagingRowCount: stagingRows.length,
            skippedErrorRows
          }),
          ipAddress: options.ipAddress ?? null,
          userAgent: options.userAgent ?? null
        }
      });

      return createdBatch;
    });

    return {
      batchId: batch.id,
      status,
      canConfirm,
      canApproveValidRows,
      canReject,
      skippedErrorRows,
      preview: {
        ...preview,
        canConfirm,
        canApproveValidRows,
        canReject,
        skippedErrorRows,
        stagingRows
      },
      stagingRowCount: stagingRows.length,
      issueCount: preview.issues.length
    };
  }

  async confirmImport(
    batchId: string,
    options: OrdersKpiImportConfirmOptions
  ): Promise<OrdersKpiImportConfirmResult> {
    assertAdminActor(options.actor);

    const batch = await this.prisma.ordersKpiImportBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new NotFoundException("Orders KPI import batch was not found.");
    }

    if (batch.status !== OrdersKpiImportBatchStatus.VALIDATED) {
      throw new BadRequestException(
        "Only validated Orders KPI import batches can be confirmed."
      );
    }

    const confirmedAt = normalizeDateTime(options.now);

    return this.prisma.$transaction(async (tx) => {
      const stagingRows = await tx.ordersKpiImportStagingRow.findMany({
        where: { sourceBatchId: batch.id }
      });
      const { insertedCount, updatedCount } =
        await upsertDailyRecordsFromStagingRows(tx, stagingRows);

      const confirmedBatch = await tx.ordersKpiImportBatch.update({
        where: { id: batch.id },
        data: {
          status: OrdersKpiImportBatchStatus.CONFIRMED,
          confirmedByUserId: options.actor.id,
          confirmedAt
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: options.actor.id,
          action: "ORDERS_KPI_IMPORT_CONFIRMED",
          entityType: "OrdersKpiImportBatch",
          entityId: confirmedBatch.id,
          oldValue: Prisma.JsonNull,
          newValue: toAuditJson({
            batchId: confirmedBatch.id,
            insertedCount,
            updatedCount,
            dateFrom: formatDateOnlyOrNull(confirmedBatch.dateFrom),
            dateTo: formatDateOnlyOrNull(confirmedBatch.dateTo),
            rowCount: confirmedBatch.rowCount,
            errorRows: confirmedBatch.errorRows,
            warningRows: confirmedBatch.warningRows,
            skippedErrorRows: 0,
            approvedWithErrors: false
          }),
          ipAddress: options.ipAddress ?? null,
          userAgent: options.userAgent ?? null
        }
      });

      return {
        batchId: confirmedBatch.id,
        status: confirmedBatch.status,
        confirmedAt: confirmedBatch.confirmedAt?.toISOString() ?? confirmedAt.toISOString(),
        insertedCount,
        updatedCount,
        dateFrom: formatDateOnlyOrNull(confirmedBatch.dateFrom),
        dateTo: formatDateOnlyOrNull(confirmedBatch.dateTo),
        rowCount: confirmedBatch.rowCount,
        errorRows: confirmedBatch.errorRows,
        warningRows: confirmedBatch.warningRows,
        skippedErrorRows: 0,
        approvedWithErrors: false
      };
    });
  }

  async approveValidRows(
    batchId: string,
    options: OrdersKpiApproveValidRowsOptions
  ): Promise<OrdersKpiImportConfirmResult> {
    assertAdminActor(options.actor);

    const batch = await this.prisma.ordersKpiImportBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new NotFoundException("Orders KPI import batch was not found.");
    }

    if (batch.status !== OrdersKpiImportBatchStatus.NEEDS_REVIEW) {
      throw new BadRequestException(
        "Only Orders KPI import batches that need review can approve valid rows."
      );
    }

    if (options.acknowledgeSkippedErrorRows !== true) {
      throw new BadRequestException(
        "You must acknowledge skipped error rows before approving valid rows."
      );
    }

    const confirmedAt = normalizeDateTime(options.now);

    return this.prisma.$transaction(async (tx) => {
      const stagingRows = await tx.ordersKpiImportStagingRow.findMany({
        where: { sourceBatchId: batch.id }
      });

      if (stagingRows.length === 0) {
        throw new BadRequestException(
          "No valid Orders KPI staging rows are available to approve."
        );
      }

      const { insertedCount, updatedCount } =
        await upsertDailyRecordsFromStagingRows(tx, stagingRows);

      const confirmedBatch = await tx.ordersKpiImportBatch.update({
        where: { id: batch.id },
        data: {
          status: OrdersKpiImportBatchStatus.CONFIRMED,
          confirmedByUserId: options.actor.id,
          confirmedAt
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: options.actor.id,
          action: "ORDERS_KPI_IMPORT_VALID_ROWS_APPROVED",
          entityType: "OrdersKpiImportBatch",
          entityId: confirmedBatch.id,
          oldValue: Prisma.JsonNull,
          newValue: toAuditJson({
            batchId: confirmedBatch.id,
            insertedCount,
            updatedCount,
            dateFrom: formatDateOnlyOrNull(confirmedBatch.dateFrom),
            dateTo: formatDateOnlyOrNull(confirmedBatch.dateTo),
            rowCount: confirmedBatch.rowCount,
            errorRows: confirmedBatch.errorRows,
            warningRows: confirmedBatch.warningRows,
            skippedErrorRows: confirmedBatch.errorRows,
            approvedWithErrors: true
          }),
          ipAddress: options.ipAddress ?? null,
          userAgent: options.userAgent ?? null
        }
      });

      return {
        batchId: confirmedBatch.id,
        status: confirmedBatch.status,
        confirmedAt: confirmedBatch.confirmedAt?.toISOString() ?? confirmedAt.toISOString(),
        insertedCount,
        updatedCount,
        dateFrom: formatDateOnlyOrNull(confirmedBatch.dateFrom),
        dateTo: formatDateOnlyOrNull(confirmedBatch.dateTo),
        rowCount: confirmedBatch.rowCount,
        errorRows: confirmedBatch.errorRows,
        warningRows: confirmedBatch.warningRows,
        skippedErrorRows: confirmedBatch.errorRows,
        approvedWithErrors: true
      };
    });
  }

  async rejectImport(
    batchId: string,
    options: OrdersKpiImportRejectOptions
  ): Promise<OrdersKpiImportRejectResult> {
    assertAdminActor(options.actor);

    const batch = await this.prisma.ordersKpiImportBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new NotFoundException("Orders KPI import batch was not found.");
    }

    if (
      batch.status !== OrdersKpiImportBatchStatus.VALIDATED &&
      batch.status !== OrdersKpiImportBatchStatus.NEEDS_REVIEW
    ) {
      throw new BadRequestException(
        "Only validated or review Orders KPI import batches can be rejected."
      );
    }

    const rejectedAt = normalizeDateTime(options.now);

    return this.prisma.$transaction(async (tx) => {
      const stagingRows = await tx.ordersKpiImportStagingRow.findMany({
        where: { sourceBatchId: batch.id }
      });
      const rejectedBatch = await tx.ordersKpiImportBatch.update({
        where: { id: batch.id },
        data: {
          status: OrdersKpiImportBatchStatus.REJECTED,
          confirmedByUserId: null,
          confirmedAt: null
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: options.actor.id,
          action: "ORDERS_KPI_IMPORT_REJECTED",
          entityType: "OrdersKpiImportBatch",
          entityId: rejectedBatch.id,
          oldValue: Prisma.JsonNull,
          newValue: toAuditJson({
            batchId: rejectedBatch.id,
            dateFrom: formatDateOnlyOrNull(rejectedBatch.dateFrom),
            dateTo: formatDateOnlyOrNull(rejectedBatch.dateTo),
            rowCount: rejectedBatch.rowCount,
            errorRows: rejectedBatch.errorRows,
            warningRows: rejectedBatch.warningRows,
            stagingRowCount: stagingRows.length,
            rejectedAt: rejectedAt.toISOString()
          }),
          ipAddress: options.ipAddress ?? null,
          userAgent: options.userAgent ?? null
        }
      });

      return {
        batchId: rejectedBatch.id,
        status: rejectedBatch.status,
        rejectedAt: rejectedAt.toISOString(),
        dateFrom: formatDateOnlyOrNull(rejectedBatch.dateFrom),
        dateTo: formatDateOnlyOrNull(rejectedBatch.dateTo),
        rowCount: rejectedBatch.rowCount,
        errorRows: rejectedBatch.errorRows,
        warningRows: rejectedBatch.warningRows,
        stagingRowCount: stagingRows.length
      };
    });
  }

  private async loadValidationContext(rows: OrdersKpiParsedRow[]) {
    const shopperIds = uniqueStrings(
      rows
        .map((row) => normalizeText(row.shopperId))
        .filter((value): value is string => value !== null && !isNoData(value))
    );
    const sourceVendorIds = uniqueStrings(
      rows
        .map((row) => normalizeText(row.sourceVendorId))
        .filter((value): value is string => Boolean(value))
    );
    const users = await this.loadUsersByShopperId(shopperIds);
    const activeAssignments = await this.loadActiveAssignmentsByPickerId(
      users.filter((user) => user.role === UserRole.PICKER).map((user) => user.id)
    );
    const vendorsBySourceVendorId = await this.loadVendorsBySourceId(
      sourceVendorIds
    );

    return {
      activeAssignmentsByPickerId: activeAssignments,
      usersByShopperId: new Map(users.map((user) => [user.shopperId, user])),
      vendorsBySourceVendorId
    };
  }

  private async loadUsersByShopperId(shopperIds: string[]) {
    if (shopperIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        shopperId: {
          in: shopperIds
        }
      },
      select: {
        id: true,
        shopperId: true,
        role: true,
        nameEn: true
      }
    });

    return users.flatMap((user): OrdersKpiMatchedUser[] =>
      user.shopperId
        ? [{
            id: user.id,
            shopperId: user.shopperId,
            role: user.role,
            nameEn: user.nameEn
          }]
        : []
    );
  }

  private async loadVendorsBySourceId(sourceVendorIds: string[]) {
    if (sourceVendorIds.length === 0) {
      return new Map<string, OrdersKpiMatchedVendor>();
    }

    const codeCandidates = uniqueStrings([
      ...sourceVendorIds,
      ...sourceVendorIds.map((value) => value.toUpperCase())
    ]);
    const vendors = await this.prisma.vendor.findMany({
      where: {
        OR: [
          { vendorExternalId: { in: sourceVendorIds } },
          { vendorCode: { in: codeCandidates } }
        ]
      },
      select: {
        id: true,
        vendorCode: true,
        vendorExternalId: true,
        chainId: true
      }
    });
    const bySourceId = new Map<string, OrdersKpiMatchedVendor>();

    for (const sourceVendorId of sourceVendorIds) {
      const externalMatch = vendors.find(
        (vendor) => vendor.vendorExternalId === sourceVendorId
      );
      const codeMatch = vendors.find(
        (vendor) =>
          vendor.vendorCode === sourceVendorId ||
          vendor.vendorCode === sourceVendorId.toUpperCase()
      );
      const vendor = externalMatch ?? codeMatch;

      if (vendor) {
        bySourceId.set(sourceVendorId, vendor);
        bySourceId.set(sourceVendorId.toUpperCase(), vendor);
      }
    }

    return bySourceId;
  }

  private async loadActiveAssignmentsByPickerId(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, string>();
    }

    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: {
        pickerId: {
          in: userIds
        },
        status: AssignmentStatus.ACTIVE
      },
      orderBy: [
        { startDate: "desc" },
        { createdAt: "desc" }
      ],
      select: {
        pickerId: true,
        vendorId: true
      }
    });
    const byPickerId = new Map<string, string>();

    for (const assignment of assignments) {
      if (!byPickerId.has(assignment.pickerId)) {
        byPickerId.set(assignment.pickerId, assignment.vendorId);
      }
    }

    return byPickerId;
  }
}

async function loadExistingDailyKeys(
  tx: OrdersKpiPrismaTransaction,
  rows: Array<{
    kpiDate: Date;
    shopperId: string;
    sourceVendorId: string;
  }>
) {
  if (rows.length === 0) {
    return new Set<string>();
  }

  const existing = await tx.ordersKpiDailyRecord.findMany({
    where: {
      OR: rows.map((row) => ({
        kpiDate: row.kpiDate,
        shopperId: row.shopperId,
        sourceVendorId: row.sourceVendorId
      }))
    },
    select: {
      kpiDate: true,
      shopperId: true,
      sourceVendorId: true
    }
  });

  return new Set(existing.map(dailyKey));
}

async function upsertDailyRecordsFromStagingRows(
  tx: OrdersKpiPrismaTransaction,
  stagingRows: Array<
    Prisma.OrdersKpiImportStagingRowGetPayload<Record<string, never>>
  >
) {
  const existingKeys = await loadExistingDailyKeys(tx, stagingRows);
  let insertedCount = 0;
  let updatedCount = 0;

  for (const row of stagingRows) {
    const key = dailyKey(row);
    if (existingKeys.has(key)) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }

    await tx.ordersKpiDailyRecord.upsert({
      where: {
        kpiDate_shopperId_sourceVendorId: {
          kpiDate: row.kpiDate,
          shopperId: row.shopperId,
          sourceVendorId: row.sourceVendorId
        }
      },
      create: mapDailyRecordForCreate(row),
      update: mapDailyRecordForUpdate(row)
    });
  }

  return { insertedCount, updatedCount };
}

function mapStagingRowForCreate(
  sourceBatchId: string,
  row: OrdersKpiValidatedStagingRow
): Prisma.OrdersKpiImportStagingRowCreateManyInput {
  return {
    sourceBatchId,
    kpiDate: dateOnlyToUtcDate(row.kpiDate),
    shopperId: row.shopperId,
    userId: row.userId,
    pickerNameSnapshot: row.pickerNameSnapshot,
    sourceVendorId: row.sourceVendorId,
    matchedVendorId: row.matchedVendorId,
    matchedChainId: row.matchedChainId,
    totalOrders: row.totalOrders,
    successfulOrders: row.successfulOrders,
    qcFailedOrders: row.qcFailedOrders,
    vendorFailedOrders: row.vendorFailedOrders,
    unhealthyOrders: row.unhealthyOrders,
    orderNotOnTime: row.orderNotOnTime,
    partialRefund: row.partialRefund,
    vendorDelay: row.vendorDelay,
    preparationTime: decimalOrNull(row.preparationTime),
    outOfStock: row.outOfStock,
    firNotOnTime: row.firNotOnTime,
    priceModified: row.priceModified,
    successRate: decimalOrNull(row.successRate),
    unhealthyRate: decimalOrNull(row.unhealthyRate),
    notOnTimeRate: decimalOrNull(row.notOnTimeRate),
    rawRowNumber: row.rawRowNumber,
    rowHash: row.rowHash,
    issuesCount: row.issuesCount
  };
}

function mapDailyRecordForCreate(
  row: Prisma.OrdersKpiImportStagingRowGetPayload<Record<string, never>>
): Prisma.OrdersKpiDailyRecordCreateInput {
  return {
    sourceBatch: {
      connect: { id: row.sourceBatchId }
    },
    user: {
      connect: { id: row.userId }
    },
    kpiDate: row.kpiDate,
    shopperId: row.shopperId,
    pickerNameSnapshot: row.pickerNameSnapshot,
    sourceVendorId: row.sourceVendorId,
    matchedVendorId: row.matchedVendorId,
    matchedChainId: row.matchedChainId,
    totalOrders: row.totalOrders,
    successfulOrders: row.successfulOrders,
    qcFailedOrders: row.qcFailedOrders,
    vendorFailedOrders: row.vendorFailedOrders,
    unhealthyOrders: row.unhealthyOrders,
    orderNotOnTime: row.orderNotOnTime,
    partialRefund: row.partialRefund,
    vendorDelay: row.vendorDelay,
    preparationTime: row.preparationTime,
    outOfStock: row.outOfStock,
    firNotOnTime: row.firNotOnTime,
    priceModified: row.priceModified,
    successRate: row.successRate,
    unhealthyRate: row.unhealthyRate,
    notOnTimeRate: row.notOnTimeRate,
    rawRowNumber: row.rawRowNumber,
    rowHash: row.rowHash,
    issuesCount: row.issuesCount
  };
}

function mapDailyRecordForUpdate(
  row: Prisma.OrdersKpiImportStagingRowGetPayload<Record<string, never>>
): Prisma.OrdersKpiDailyRecordUpdateInput {
  return {
    sourceBatch: {
      connect: { id: row.sourceBatchId }
    },
    user: {
      connect: { id: row.userId }
    },
    pickerNameSnapshot: row.pickerNameSnapshot,
    matchedVendorId: row.matchedVendorId,
    matchedChainId: row.matchedChainId,
    totalOrders: row.totalOrders,
    successfulOrders: row.successfulOrders,
    qcFailedOrders: row.qcFailedOrders,
    vendorFailedOrders: row.vendorFailedOrders,
    unhealthyOrders: row.unhealthyOrders,
    orderNotOnTime: row.orderNotOnTime,
    partialRefund: row.partialRefund,
    vendorDelay: row.vendorDelay,
    preparationTime: row.preparationTime,
    outOfStock: row.outOfStock,
    firNotOnTime: row.firNotOnTime,
    priceModified: row.priceModified,
    successRate: row.successRate,
    unhealthyRate: row.unhealthyRate,
    notOnTimeRate: row.notOnTimeRate,
    rawRowNumber: row.rawRowNumber,
    rowHash: row.rowHash,
    issuesCount: row.issuesCount
  };
}

function dailyKey(row: {
  kpiDate: Date;
  shopperId: string;
  sourceVendorId: string;
}) {
  return `${row.kpiDate.toISOString()}|${row.shopperId}|${row.sourceVendorId}`;
}

function assertAdminActor(actor: { role: UserRole }) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException("You do not have permission for this action.");
  }
}

function dateOnlyToUtcDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new BadRequestException("date must use YYYY-MM-DD format.");
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dateOnlyToUtcDateOrNull(value: string | null) {
  return value ? dateOnlyToUtcDate(value) : null;
}

function decimalOrNull(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

function formatDateOnlyOrNull(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function normalizeDateTime(value: Date | string | undefined) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function normalizeFileName(fileName: string) {
  const normalized = fileName.trim();
  return normalized || "orders-kpis.csv";
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function isNoData(value: string) {
  return value.trim().toLowerCase() === "no data";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function toAuditJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}
