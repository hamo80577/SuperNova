import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";
import {
  AttendanceImportMode,
  AttendanceImportStatus,
  AttendanceIssueSeverity,
  AttendanceIssueType
} from "@prisma/client";

import { AttendanceOperationsService } from "../src/attendance/attendance-operations.service";
import type { HistoricalAssignmentBackfillProposal } from "../src/attendance/attendance.types";

const file = {
  originalname: "attendance.xlsx",
  buffer: Buffer.from("xlsx"),
  size: 4
};

async function main() {
  await testUploadValidatesFileAndDelegates();
  await testListImportsDetailsAndIssues();
  await testPreviewDoesNotConfirmAssignments();
  await testConfirmRerunsPreviewAndAudits();
  await testConfirmRejectsConflictPreviewBeforeCreate();
}

async function testUploadValidatesFileAndDelegates() {
  const context = createServiceContext();

  await assert.rejects(
    () =>
      context.service.uploadAttendanceImport({
        file: null,
        periodFrom: "2026-05-01",
        periodTo: "2026-05-31",
        uploadMode: AttendanceImportMode.DAILY_MTD_OVERRIDE,
        actorUserId: "super-admin-1"
      }),
    BadRequestException
  );

  await assert.rejects(
    () =>
      context.service.uploadAttendanceImport({
        file: { ...file, originalname: "attendance.csv" },
        periodFrom: "2026-05-01",
        periodTo: "2026-05-31",
        uploadMode: AttendanceImportMode.DAILY_MTD_OVERRIDE,
        actorUserId: "super-admin-1"
      }),
    BadRequestException
  );

  await assert.rejects(
    () =>
      context.service.uploadAttendanceImport({
        file,
        periodFrom: "2026-06-01",
        periodTo: "2026-05-31",
        uploadMode: AttendanceImportMode.DAILY_MTD_OVERRIDE,
        actorUserId: "super-admin-1"
      }),
    BadRequestException
  );

  const summary = await context.service.uploadAttendanceImport({
    file,
    periodFrom: "2026-05-01",
    periodTo: "2026-05-31",
    uploadMode: AttendanceImportMode.HISTORICAL_BACKFILL,
    actorUserId: "super-admin-1",
    ipAddress: "127.0.0.1",
    userAgent: "test"
  });

  assert.equal(summary.batchId, "batch-1");
  assert.deepEqual(context.importCalls, [
    {
      buffer: file.buffer,
      fileName: "attendance.xlsx",
      mode: AttendanceImportMode.HISTORICAL_BACKFILL,
      createdById: "super-admin-1",
      periodFrom: "2026-05-01T00:00:00.000Z",
      periodTo: "2026-05-31T00:00:00.000Z"
    }
  ]);
  assert.equal(
    context.auditLogs.some((log) => log.action === "ATTENDANCE_IMPORT_COMPLETED"),
    true
  );
  assert.equal(
    context.auditLogs.some((log) => log.action === "ATTENDANCE_IMPORT_STARTED"),
    true
  );
}

async function testListImportsDetailsAndIssues() {
  const context = createServiceContext();

  const imports = await context.service.listImports({
    page: 1,
    pageSize: 20,
    status: AttendanceImportStatus.COMPLETED,
    mode: AttendanceImportMode.DAILY_MTD_OVERRIDE
  });
  assert.equal(imports.items.length, 1);
  assert.equal(imports.items[0].id, "batch-1");
  assert.equal(imports.items[0].durationMs, 60_000);
  assert.equal(imports.items[0].createdBy.nameEn, "Super Admin");

  const detail = await context.service.getImport("batch-1");
  assert.equal(detail.id, "batch-1");
  assert.equal(detail.issueCounts.WARNING, 1);
  assert.equal(detail.issueCounts.ERROR, 0);

  const issues = await context.service.listImportIssues("batch-1", {
    page: 1,
    pageSize: 20,
    severity: AttendanceIssueSeverity.WARNING
  });
  assert.equal(issues.items.length, 1);
  assert.equal(issues.items[0].type, AttendanceIssueType.UNMATCHED_IDENTIFIER);
}

async function testPreviewDoesNotConfirmAssignments() {
  const context = createServiceContext();

  const preview = await context.service.previewHistoricalAssignments({
    file,
    periodFrom: "2026-01-01",
    periodTo: "2026-01-31",
    actorUserId: "super-admin-1"
  });

  assert.equal(preview.proposalsCount, 1);
  assert.equal(context.previewCalls.length, 1);
  assert.equal(context.confirmCalls.length, 0);
  assert.equal(
    context.auditLogs.some(
      (log) => log.action === "ATTENDANCE_HISTORICAL_ASSIGNMENT_PREVIEW_REQUESTED"
    ),
    true
  );
}

async function testConfirmRerunsPreviewAndAudits() {
  const context = createServiceContext();

  const result = await context.service.confirmHistoricalAssignments({
    file,
    periodFrom: "2026-01-01",
    periodTo: "2026-01-31",
    actorUserId: "super-admin-1",
    confirmationText: "CREATE HISTORICAL ASSIGNMENTS"
  });

  assert.equal(result.createdCount, 1);
  assert.equal(context.previewCalls.length, 1);
  assert.equal(context.confirmCalls.length, 1);
  assert.deepEqual(context.confirmCalls[0].proposals, [proposal]);
  assert.equal(
    context.auditLogs.some(
      (log) =>
        log.action === "ATTENDANCE_HISTORICAL_ASSIGNMENT_CONFIRMATION_PERFORMED"
    ),
    true
  );

  await assert.rejects(
    () =>
      context.service.confirmHistoricalAssignments({
        file,
        periodFrom: "2026-01-01",
        periodTo: "2026-01-31",
        actorUserId: "super-admin-1",
        confirmationText: "CREATE"
      }),
    BadRequestException
  );
}

async function testConfirmRejectsConflictPreviewBeforeCreate() {
  const context = createServiceContext({
    preview: {
      ...preview,
      conflictCount: 1,
      conflicts: [
        {
          reason: "EXISTING_ASSIGNMENT_DIFFERENT_VENDOR",
          message: "Existing assignment conflict."
        }
      ]
    }
  });

  await assert.rejects(
    () =>
      context.service.confirmHistoricalAssignments({
        file,
        periodFrom: "2026-01-01",
        periodTo: "2026-01-31",
        actorUserId: "super-admin-1",
        confirmationText: "CREATE HISTORICAL ASSIGNMENTS"
      }),
    BadRequestException
  );
  assert.equal(context.confirmCalls.length, 0);
}

const proposal: HistoricalAssignmentBackfillProposal = {
  pickerId: "picker-1",
  identifier: "SHOP-1",
  vendorId: "vendor-1",
  vendorExternalId: "740921",
  vendorName: "Branch 740921",
  chainId: "chain-1",
  proposedStartDate: new Date("2026-01-01T00:00:00.000Z"),
  proposedEndDate: new Date("2026-01-31T00:00:00.000Z"),
  source: "ATTENDANCE_BACKFILL",
  evidenceCount: 31
};

const preview = {
  totalRowsAnalyzed: 31,
  matchedPickers: 31,
  ignoredChampRows: 0,
  unmappedLocationCount: 0,
  conflictCount: 0,
  proposalsCount: 1,
  proposals: [proposal],
  warnings: [],
  conflicts: []
};

function createServiceContext(options: { preview?: typeof preview } = {}) {
  const importCalls: Array<Record<string, unknown>> = [];
  const previewCalls: Array<Record<string, unknown>> = [];
  const confirmCalls: Array<Record<string, unknown>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  const batch = {
    id: "batch-1",
    createdAt: new Date("2026-05-24T10:00:00.000Z"),
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
    mode: AttendanceImportMode.DAILY_MTD_OVERRIDE,
    status: AttendanceImportStatus.COMPLETED,
    periodFrom: new Date("2026-05-01T00:00:00.000Z"),
    periodTo: new Date("2026-05-31T00:00:00.000Z"),
    fileName: "attendance.xlsx",
    totalRows: 10,
    egyptRows: 8,
    ignoredRows: 2,
    processedRows: 8,
    matchedPickers: 6,
    matchedChamps: 2,
    unmatchedIdentifiers: 0,
    duplicateRows: 0,
    warningsCount: 1,
    errorsCount: 0,
    dailyRecordsStored: 8,
    userSummariesStored: 8,
    branchSummariesRebuilt: 2,
    chainSummariesRebuilt: 1,
    startedAt: new Date("2026-05-24T10:00:00.000Z"),
    completedAt: new Date("2026-05-24T10:01:00.000Z"),
    errorMessage: null,
    createdBy: {
      id: "super-admin-1",
      nameEn: "Super Admin",
      role: "SUPER_ADMIN"
    }
  };
  const issue = {
    id: "issue-1",
    severity: AttendanceIssueSeverity.WARNING,
    type: AttendanceIssueType.UNMATCHED_IDENTIFIER,
    rowNumber: 10,
    identifier: "SHOP-X",
    attendanceDate: new Date("2026-05-10T00:00:00.000Z"),
    message: "Unmatched identifier.",
    metadata: null,
    createdAt: new Date("2026-05-24T10:01:00.000Z")
  };
  const prisma = {
    attendanceImportBatch: {
      findMany: async () => [batch],
      count: async () => 1,
      findUnique: async () => batch
    },
    attendanceImportIssue: {
      groupBy: async () => [{ severity: AttendanceIssueSeverity.WARNING, _count: 1 }],
      findMany: async () => [issue],
      count: async () => 1
    }
  };
  const service = new AttendanceOperationsService(
    prisma as never,
    {
      importAttendanceFromBuffer: async (input: {
        buffer: Buffer;
        fileName: string;
        mode: AttendanceImportMode;
        createdById: string;
        periodFrom: Date;
        periodTo: Date;
      }) => {
        importCalls.push({
          buffer: input.buffer,
          fileName: input.fileName,
          mode: input.mode,
          createdById: input.createdById,
          periodFrom: input.periodFrom.toISOString(),
          periodTo: input.periodTo.toISOString()
        });
        return {
          batchId: "batch-1",
          status: AttendanceImportStatus.COMPLETED,
          totalRows: 10,
          egyptRows: 8,
          ignoredRows: 2,
          processedRows: 8,
          matchedPickers: 6,
          matchedChamps: 2,
          unmatchedIdentifiers: 0,
          duplicateRows: 0,
          warningsCount: 1,
          errorsCount: 0,
          dailyRecordsStored: 8,
          userSummariesStored: 8,
          branchSummariesRebuilt: 2,
          chainSummariesRebuilt: 1
        };
      }
    } as never,
    {
      previewHistoricalAssignmentBackfill: async (input: Record<string, unknown>) => {
        previewCalls.push(input);
        return options.preview ?? preview;
      },
      confirmHistoricalAssignmentBackfill: async (input: Record<string, unknown>) => {
        confirmCalls.push(input);
        return {
          createdCount: 1,
          skippedCount: 0,
          conflictCount: 0,
          createdAssignmentIds: ["assignment-1"],
          conflicts: []
        };
      }
    } as never,
    {
      log: async (input: Record<string, unknown>) => {
        auditLogs.push(input);
        return input;
      }
    } as never
  );

  return { auditLogs, confirmCalls, importCalls, previewCalls, service };
}

void main();
