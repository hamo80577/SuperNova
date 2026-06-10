import { createHash } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  OrdersKpiImportBatchStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersKpisParserService } from "./orders-kpis-parser.service";
import type {
  OrdersKpiPreviewImportOptions,
  OrdersKpiPreviewResponse,
  OrdersKpiStagingRowDraft,
  OrdersKpiValidationResult
} from "./orders-kpis.types";
import {
  ORDERS_KPI_PREVIEW_ACTION,
  ORDERS_KPI_UPLOAD_MODE
} from "./orders-kpis.types";
import { OrdersKpisValidatorService } from "./orders-kpis-validator.service";

const ORDERS_KPI_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS = 60_000;

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

    const batch = await this.prisma.$transaction(
      async (tx) => {
        const createdBatch = await tx.ordersKpiImportBatch.create({
          data: {
            fileName: options.fileName,
            fileHash,
            uploadedByUserId: options.actor.id,
            status,
            rowCount: validation.rowCount,
            confirmableRows,
            skippedRows: validation.skippedRows,
            errorRows: validation.errorRows,
            warningRows: validation.warningRows,
            coveredDates: validation.coveredDates,
            coveredDateFrom: validation.coveredDateFrom,
            coveredDateTo: validation.coveredDateTo,
            confirmedByUserId: null,
            confirmedAt: null,
            rejectedByUserId: null,
            rejectedAt: null,
            rejectionReason: null
          }
        });

        const stagingRows =
          status === OrdersKpiImportBatchStatus.FAILED ? [] : validation.stagingRows;

        if (stagingRows.length > 0) {
          await tx.ordersKpiImportStagingRow.createMany({
            data: stagingRows.map((row) =>
              mapStagingRowForCreate(createdBatch.id, row)
            )
          });
        }

        if (validation.issues.length > 0) {
          await tx.ordersKpiImportIssue.createMany({
            data: validation.issues.map((issue) => ({
              batchId: createdBatch.id,
              rowNumber: issue.rowNumber,
              sourceVendorId: issue.sourceVendorId,
              sourceShopperId: issue.sourceShopperId,
              severity: issue.severity,
              issueCode: issue.issueCode,
              fieldName: issue.fieldName,
              message: issue.message
            }))
          });
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

    return {
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        status,
        rowCount: validation.rowCount,
        confirmableRows,
        skippedRows: validation.skippedRows,
        errorRows: validation.errorRows,
        warningRows: validation.warningRows,
        coveredDates: validation.coveredDates,
        coveredDateFrom: validation.coveredDateFromString,
        coveredDateTo: validation.coveredDateToString,
        canConfirm: status === OrdersKpiImportBatchStatus.VALIDATED,
        requiresReviewDecision: status === OrdersKpiImportBatchStatus.NEEDS_REVIEW
      },
      summary: validation.summary,
      previewRows: validation.previewRows,
      issues: validation.issues
    };
  }
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

function createFileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function toAuditJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}
