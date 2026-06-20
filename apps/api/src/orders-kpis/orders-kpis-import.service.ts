import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  type OrdersKpiImportBatch,
  OrdersKpiImportBatchStatus,
  type OrdersKpiImportStagingRow,
  Prisma,
  UserRole
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { createManyInChunks } from "../common/database/create-many-in-chunks";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersKpisParserService } from "./orders-kpis-parser.service";
import type {
  OrdersKpiConfirmReplaceOptions,
  OrdersKpiConfirmReplaceResponse,
  OrdersKpiPreviewImportOptions,
  OrdersKpiPreviewResponse,
  OrdersKpiRejectImportOptions,
  OrdersKpiRejectImportResponse,
  OrdersKpiStagingRowDraft,
  OrdersKpiValidationResult
} from "./orders-kpis.types";
import {
  ORDERS_KPI_CONFIRM_REPLACE_ACTION,
  ORDERS_KPI_PREVIEW_ACTION,
  ORDERS_KPI_REJECT_ACTION,
  ORDERS_KPI_UPLOAD_MODE
} from "./orders-kpis.types";
import { OrdersKpisValidatorService } from "./orders-kpis-validator.service";

const ORDERS_KPI_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS = 60_000;

type OrdersKpiImportTransaction = Prisma.TransactionClient;

interface OrdersKpiConfirmReplaceContext {
  batch: OrdersKpiImportBatch;
  coveredDates: string[];
  coveredDateValues: Date[];
  stagingRows: OrdersKpiImportStagingRow[];
}

interface OrdersKpiReplacementCounts {
  deletedRecords: number;
  insertedRecords: number;
}

@Injectable()
export class OrdersKpisImportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(OrdersKpisParserService)
    private readonly parser: OrdersKpisParserService,
    @Inject(OrdersKpisValidatorService)
    private readonly validator: OrdersKpisValidatorService
  ) {}

  async previewImport(
    buffer: Buffer,
    options: OrdersKpiPreviewImportOptions
  ): Promise<OrdersKpiPreviewResponse> {
    return this.processImport(buffer, options);
  }

  async processQueuedImport(
    batchId: string,
    buffer: Buffer,
    options: OrdersKpiPreviewImportOptions
  ): Promise<OrdersKpiPreviewResponse> {
    return this.processImport(buffer, options, batchId);
  }

  private async processImport(
    buffer: Buffer,
    options: OrdersKpiPreviewImportOptions,
    queuedBatchId?: string
  ): Promise<OrdersKpiPreviewResponse> {
    assertOrdersKpiImportActor(options.actor);

    if (buffer.length === 0) {
      throw new BadRequestException("Orders KPI file is required.");
    }

    let validation: OrdersKpiValidationResult;
    const parsedWorkbook = await parseOrdersKpiFile(
      this.parser,
      buffer,
      options.fileName
    );

    validation = await this.validator.validateParsedWorkbook(parsedWorkbook);

    const confirmableRows = validation.previewRows.filter(
      (row) => row.confirmable
    ).length;
    const status = determineBatchStatus(validation, confirmableRows);
    const fileHash = createFileHash(buffer);
    const buildPreviewResult = (batchId: string): OrdersKpiPreviewResponse => ({
      batch: {
        id: batchId,
        fileName: options.fileName,
        status,
        rowCount: validation.rowCount,
        confirmableRows,
        skippedRows: validation.skippedRows,
        errorRows: validation.errorRows,
        warningRows: validation.warningRows,
        coveredDates: validation.coveredDates,
        coveredDateFrom: validation.coveredDateFromString,
        coveredDateTo: validation.coveredDateToString,
        canConfirm:
          status === OrdersKpiImportBatchStatus.VALIDATED ||
          status === OrdersKpiImportBatchStatus.NEEDS_REVIEW,
        requiresReviewDecision:
          status === OrdersKpiImportBatchStatus.NEEDS_REVIEW
      },
      summary: validation.summary,
      previewRows: validation.previewRows,
      issues: validation.issues
    });
    const queuedPreviewResult = queuedBatchId
      ? buildPreviewResult(queuedBatchId)
      : null;

    const batch = await this.prisma.$transaction(
      async (tx) => {
        if (queuedBatchId) {
          await tx.ordersKpiImportStagingRow.deleteMany({
            where: { sourceBatchId: queuedBatchId }
          });
          await tx.ordersKpiImportIssue.deleteMany({
            where: { batchId: queuedBatchId }
          });
        }

        const batchData = {
          fileName: options.fileName,
          fileHash,
          uploadedByUserId: options.actor.id,
          status,
          rowCount: validation.rowCount,
          confirmableRows,
          skippedRows: validation.skippedRows,
          errorRows: validation.errorRows,
          warningRows: validation.warningRows,
          failureReason: null,
          ...(queuedPreviewResult
            ? { previewResult: toPrismaJson(queuedPreviewResult) }
            : {}),
          coveredDates: validation.coveredDates,
          coveredDateFrom: validation.coveredDateFrom,
          coveredDateTo: validation.coveredDateTo,
          confirmedByUserId: null,
          confirmedAt: null,
          rejectedByUserId: null,
          rejectedAt: null,
          rejectionReason: null
        };
        const createdBatch = queuedBatchId
          ? await tx.ordersKpiImportBatch.update({
              where: { id: queuedBatchId },
              data: batchData
            })
          : await tx.ordersKpiImportBatch.create({ data: batchData });

        const stagingRows =
          status === OrdersKpiImportBatchStatus.FAILED ? [] : validation.stagingRows;

        if (stagingRows.length > 0) {
          const stagingRowData = stagingRows.map((row) =>
              mapStagingRowForCreate(createdBatch.id, row)
          );
          await createManyInChunks(stagingRowData, (chunk) =>
            tx.ordersKpiImportStagingRow.createMany({ data: chunk })
          );
        }

        if (validation.issues.length > 0) {
          const issueRows = validation.issues.map((issue) => ({
            batchId: createdBatch.id,
            rowNumber: issue.rowNumber,
            sourceVendorId: issue.sourceVendorId,
            sourceShopperId: issue.sourceShopperId,
            severity: issue.severity,
            issueCode: issue.issueCode,
            fieldName: issue.fieldName,
            message: issue.message
          }));
          await createManyInChunks(issueRows, (chunk) =>
            tx.ordersKpiImportIssue.createMany({ data: chunk })
          );
        }

        return createdBatch;
      },
      {
        timeout: ORDERS_KPI_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS
      }
    );

    await this.auditService.log({
      actorUserId: options.actor.id,
      action: ORDERS_KPI_PREVIEW_ACTION,
      entityType: "OrdersKpiImportBatch",
      entityId: batch.id,
      newValue: toAuditJson({
        batchId: batch.id,
        uploadMode: ORDERS_KPI_UPLOAD_MODE,
        fileName: batch.fileName,
        status,
        rowCount: validation.rowCount,
        confirmableRows,
        skippedRows: validation.skippedRows,
        errorRows: validation.errorRows,
        warningRows: validation.warningRows,
        coveredDates: validation.coveredDates
      }),
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null
    });

    return queuedPreviewResult ?? buildPreviewResult(batch.id);
  }

  async getPreview(batchId: string): Promise<OrdersKpiPreviewResponse> {
    const batch = await this.prisma.ordersKpiImportBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
        previewResult: true,
        failureReason: true
      }
    });

    if (!batch) {
      throw new NotFoundException("Orders KPI import batch was not found.");
    }

    if (
      batch.status === OrdersKpiImportBatchStatus.PENDING ||
      batch.status === OrdersKpiImportBatchStatus.PROCESSING
    ) {
      throw new ConflictException("Orders KPI import is still processing.");
    }

    if (!batch.previewResult) {
      throw new ConflictException(
        batch.failureReason ?? "Orders KPI import preview is unavailable."
      );
    }

    return batch.previewResult as unknown as OrdersKpiPreviewResponse;
  }

  async confirmReplaceImport(
    batchId: string,
    options: OrdersKpiConfirmReplaceOptions
  ): Promise<OrdersKpiConfirmReplaceResponse> {
    assertOrdersKpiImportActor(options.actor);
    const confirmedAt = resolveDateTime(options.now);

    return this.prisma.$transaction(
      async (tx) => {
        const confirmContext = await loadConfirmReplaceContext(
          tx,
          batchId,
          options
        );
        const replacementCounts = await replaceCoveredDailyRecords(
          tx,
          confirmContext
        );
        const confirmedBatch = await markBatchConfirmed(
          tx,
          confirmContext.batch,
          options.actor.id,
          confirmedAt
        );

        await writeConfirmReplaceAudit(tx, {
          confirmContext,
          confirmedBatch,
          options,
          replacementCounts
        });

        return toConfirmReplaceResponse(
          confirmedBatch,
          confirmContext.coveredDates,
          replacementCounts,
          confirmedAt
        );
      },
      {
        timeout: ORDERS_KPI_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS
      }
    );
  }

  async rejectImport(
    batchId: string,
    options: OrdersKpiRejectImportOptions
  ): Promise<OrdersKpiRejectImportResponse> {
    assertOrdersKpiImportActor(options.actor);
    const rejectedAt = resolveDateTime(options.now);
    const reason = normalizeRejectReason(options.reason);

    return this.prisma.$transaction(
      async (tx) => {
        const batch = await findOrdersKpiImportBatch(tx, batchId);
        assertRejectAllowed(batch);

        const rejectedBatch = await tx.ordersKpiImportBatch.update({
          where: { id: batch.id },
          data: {
            status: OrdersKpiImportBatchStatus.REJECTED,
            rejectedByUserId: options.actor.id,
            rejectedAt,
            rejectionReason: reason
          }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: options.actor.id,
            action: ORDERS_KPI_REJECT_ACTION,
            entityType: "OrdersKpiImportBatch",
            entityId: batch.id,
            oldValue: toAuditJson({
              status: batch.status
            }),
            newValue: toAuditJson({
              batchId: batch.id,
              statusBefore: batch.status,
              statusAfter: rejectedBatch.status,
              reason
            }),
            ipAddress: options.ipAddress ?? null,
            userAgent: options.userAgent ?? null
          }
        });

        return {
          batchId: rejectedBatch.id,
          status: "REJECTED",
          rejectedAt:
            rejectedBatch.rejectedAt?.toISOString() ?? rejectedAt.toISOString(),
          reason: rejectedBatch.rejectionReason
        };
      },
      {
        timeout: ORDERS_KPI_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS
      }
    );
  }
}

async function loadConfirmReplaceContext(
  tx: OrdersKpiImportTransaction,
  batchId: string,
  options: OrdersKpiConfirmReplaceOptions
): Promise<OrdersKpiConfirmReplaceContext> {
  const batch = await findOrdersKpiImportBatch(tx, batchId);
  assertConfirmReplaceAllowed(batch, options);

  const coveredDates = parseCoveredDates(batch.coveredDates);
  const stagingRows = await tx.ordersKpiImportStagingRow.findMany({
    where: { sourceBatchId: batch.id },
    orderBy: [{ kpiDate: "asc" }, { rawRowNumber: "asc" }]
  });

  if (stagingRows.length === 0) {
    throw new ConflictException(
      "Orders KPI import batch has no confirmable staging rows."
    );
  }

  return {
    batch,
    coveredDates,
    coveredDateValues: coveredDates.map(dateStringToUtcDate),
    stagingRows
  };
}

async function findOrdersKpiImportBatch(
  tx: OrdersKpiImportTransaction,
  batchId: string
) {
  const batch = await tx.ordersKpiImportBatch.findUnique({
    where: { id: batchId }
  });

  if (!batch) {
    throw new NotFoundException("Orders KPI import batch was not found.");
  }

  return batch;
}

async function replaceCoveredDailyRecords(
  tx: OrdersKpiImportTransaction,
  confirmContext: OrdersKpiConfirmReplaceContext
): Promise<OrdersKpiReplacementCounts> {
  const deletedRecords = await tx.ordersKpiDailyRecord.deleteMany({
    where: {
      kpiDate: {
        in: confirmContext.coveredDateValues
      }
    }
  });
  const insertedRecords = await createManyInChunks(
    confirmContext.stagingRows.map(mapDailyRecordForCreate),
    (chunk) => tx.ordersKpiDailyRecord.createMany({ data: chunk })
  );

  return {
    deletedRecords: deletedRecords.count,
    insertedRecords
  };
}

function markBatchConfirmed(
  tx: OrdersKpiImportTransaction,
  batch: OrdersKpiImportBatch,
  actorUserId: string,
  confirmedAt: Date
) {
  return tx.ordersKpiImportBatch.update({
    where: { id: batch.id },
    data: {
      status: OrdersKpiImportBatchStatus.CONFIRMED,
      confirmedByUserId: actorUserId,
      confirmedAt
    }
  });
}

function writeConfirmReplaceAudit(
  tx: OrdersKpiImportTransaction,
  params: {
    confirmContext: OrdersKpiConfirmReplaceContext;
    confirmedBatch: OrdersKpiImportBatch;
    options: OrdersKpiConfirmReplaceOptions;
    replacementCounts: OrdersKpiReplacementCounts;
  }
) {
  return tx.auditLog.create({
    data: {
      actorUserId: params.options.actor.id,
      action: ORDERS_KPI_CONFIRM_REPLACE_ACTION,
      entityType: "OrdersKpiImportBatch",
      entityId: params.confirmContext.batch.id,
      oldValue: toAuditJson({
        status: params.confirmContext.batch.status
      }),
      newValue: toAuditJson({
        batchId: params.confirmContext.batch.id,
        coveredDates: params.confirmContext.coveredDates,
        deletedRecords: params.replacementCounts.deletedRecords,
        insertedRecords: params.replacementCounts.insertedRecords,
        skippedRows: params.confirmContext.batch.skippedRows,
        errorRows: params.confirmContext.batch.errorRows,
        warningRows: params.confirmContext.batch.warningRows,
        statusBefore: params.confirmContext.batch.status,
        statusAfter: params.confirmedBatch.status,
        approveValidRowsOnly: params.options.approveValidRowsOnly === true,
        acknowledgeSkippedErrorRows:
          params.options.acknowledgeSkippedErrorRows === true
      }),
      ipAddress: params.options.ipAddress ?? null,
      userAgent: params.options.userAgent ?? null
    }
  });
}

function toConfirmReplaceResponse(
  confirmedBatch: OrdersKpiImportBatch,
  coveredDates: string[],
  replacementCounts: OrdersKpiReplacementCounts,
  confirmedAt: Date
): OrdersKpiConfirmReplaceResponse {
  return {
    batchId: confirmedBatch.id,
    status: "CONFIRMED",
    coveredDates,
    deletedRecords: replacementCounts.deletedRecords,
    insertedRecords: replacementCounts.insertedRecords,
    skippedRows: confirmedBatch.skippedRows,
    errorRows: confirmedBatch.errorRows,
    warningRows: confirmedBatch.warningRows,
    confirmedAt:
      confirmedBatch.confirmedAt?.toISOString() ?? confirmedAt.toISOString()
  };
}

function assertOrdersKpiImportActor(actor: OrdersKpiPreviewImportOptions["actor"]) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException("Only admins can preview Orders KPI imports.");
  }
}

async function parseOrdersKpiFile(
  parser: OrdersKpisParserService,
  buffer: Buffer,
  fileName: string
) {
  try {
    return await parser.parseFile(buffer, fileName);
  } catch {
    throw new BadRequestException("Unable to read Orders KPI import file.");
  }
}

function determineBatchStatus(
  validation: OrdersKpiValidationResult,
  confirmableRows: number
) {
  if (confirmableRows === 0) {
    return OrdersKpiImportBatchStatus.FAILED;
  }

  if (validation.errorRows > 0) {
    return OrdersKpiImportBatchStatus.NEEDS_REVIEW;
  }

  return OrdersKpiImportBatchStatus.VALIDATED;
}

function assertConfirmReplaceAllowed(
  batch: OrdersKpiImportBatch,
  options: OrdersKpiConfirmReplaceOptions
) {
  if (batch.status === OrdersKpiImportBatchStatus.VALIDATED) {
    if (options.acknowledgeReplaceDates !== true) {
      throw new BadRequestException(
        "Confirming an Orders KPI import requires acknowledging date replacement."
      );
    }
    return;
  }

  if (batch.status === OrdersKpiImportBatchStatus.NEEDS_REVIEW) {
    if (
      options.acknowledgeReplaceDates !== true ||
      options.approveValidRowsOnly !== true ||
      options.acknowledgeSkippedErrorRows !== true
    ) {
      throw new BadRequestException(
        "Review batches require approving valid rows only and acknowledging skipped error rows and date replacement."
      );
    }
    return;
  }

  throw new ConflictException(
    `Orders KPI import batch with status ${batch.status} cannot be confirmed.`
  );
}

function assertRejectAllowed(batch: OrdersKpiImportBatch) {
  if (
    batch.status === OrdersKpiImportBatchStatus.VALIDATED ||
    batch.status === OrdersKpiImportBatchStatus.NEEDS_REVIEW
  ) {
    return;
  }

  throw new ConflictException(
    `Orders KPI import batch with status ${batch.status} cannot be rejected.`
  );
}

function mapStagingRowForCreate(
  batchId: string,
  row: OrdersKpiStagingRowDraft
): Prisma.OrdersKpiImportStagingRowCreateManyInput {
  return {
    sourceBatchId: batchId,
    rawRowNumber: row.rawRowNumber,
    rowHash: row.rowHash,
    kpiDate: row.kpiDate,
    sourceVendorId: row.sourceVendorId,
    matchedVendorId: row.matchedVendorId,
    matchedChainId: row.matchedChainId,
    vendorNameSnapshot: row.vendorNameSnapshot,
    chainNameSnapshot: row.chainNameSnapshot,
    vendorMatchStatus: row.vendorMatchStatus,
    sourceShopperId: row.sourceShopperId,
    sourcePickerKey: row.sourcePickerKey,
    userId: row.userId,
    pickerNameSnapshot: row.pickerNameSnapshot,
    pickerMatchStatus: row.pickerMatchStatus,
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
    issuesCount: row.issuesCount
  };
}

function mapDailyRecordForCreate(
  row: OrdersKpiImportStagingRow
): Prisma.OrdersKpiDailyRecordCreateManyInput {
  return {
    sourceBatchId: row.sourceBatchId,
    kpiDate: row.kpiDate,
    sourceVendorId: row.sourceVendorId,
    matchedVendorId: row.matchedVendorId,
    matchedChainId: row.matchedChainId,
    vendorNameSnapshot: row.vendorNameSnapshot,
    chainNameSnapshot: row.chainNameSnapshot,
    vendorMatchStatus: row.vendorMatchStatus,
    sourceShopperId: row.sourceShopperId,
    sourcePickerKey: row.sourcePickerKey,
    userId: row.userId,
    pickerNameSnapshot: row.pickerNameSnapshot,
    pickerMatchStatus: row.pickerMatchStatus,
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
    issuesCount: row.issuesCount
  };
}

function parseCoveredDates(coveredDates: Prisma.JsonValue) {
  if (!Array.isArray(coveredDates)) {
    throw new ConflictException("Orders KPI import batch has no covered dates.");
  }

  const dateStrings = Array.from(
    new Set(
      coveredDates.filter(
        (dateString): dateString is string =>
          typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)
      )
    )
  ).sort();

  if (dateStrings.length === 0) {
    throw new ConflictException("Orders KPI import batch has no covered dates.");
  }

  return dateStrings;
}

function dateStringToUtcDate(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function resolveDateTime(value?: Date) {
  return value ? new Date(value) : new Date();
}

function normalizeRejectReason(reason?: string | null) {
  const normalizedReason = reason?.trim();
  return normalizedReason ? normalizedReason : null;
}

function createFileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function toAuditJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

function toPrismaJson(previewResponse: unknown) {
  return JSON.parse(JSON.stringify(previewResponse)) as Prisma.InputJsonValue;
}
