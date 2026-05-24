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
  await testImportSampleUsers();
  await testPreviewDoesNotConfirmAssignments();
  await testConfirmRerunsPreviewAndAudits();
  await testConfirmRejectsConflictPreviewBeforeCreate();
  await testMaintenancePreviewDeleteMonthReturnsCountsWithoutDelete();
  await testDeleteMonthRequiresExactConfirmation();
  await testDeleteMonthDeletesAttendanceTablesOnly();
  await testDeleteAllRequiresExactConfirmation();
  await testDeleteAllDeletesAttendanceTablesOnly();
  await testRecalculateBlocksOldSummaryOnlyMonth();
  await testCompressOldMonthsSkipsCurrentPreviousAndBlocksMissingSummaries();
  await testCompressOldMonthsDeletesOldDailyAfterSummariesExist();
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

async function testImportSampleUsers() {
  const context = createServiceContext();

  const sample = await context.service.getImportSampleUsers("batch-1");

  assert.equal(sample.items.length, 1);
  assert.deepEqual(sample.items[0], {
    id: "summary-1",
    identifier: "SHOP-1",
    role: "PICKER",
    userDisplayName: "Picker One",
    totalCreatedShifts: 23,
    totalShiftsNeeded: 24,
    missingShifts: 1,
    lateLevel1Over15Count: 3,
    absentCount: 1,
    under8HoursCount: 2,
    over15HoursCount: 0
  });
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

async function testMaintenancePreviewDeleteMonthReturnsCountsWithoutDelete() {
  const context = createMaintenanceServiceContext();

  const preview = await (context.service as never as {
    previewMaintenance: (input: Record<string, unknown>) => Promise<{
      operation: string;
      canProceed: boolean;
      attendanceDailyRecordsAffected: number;
      monthlyUserSummariesAffected: number;
      monthlyBranchSummariesAffected: number;
      monthlyChainSummariesAffected: number;
      importBatchesAffected: number;
      importIssuesAffected: number;
      monthKeysAffected: string[];
      safetyNotice: string[];
    }>;
  }).previewMaintenance({
    operation: "DELETE_MONTH",
    monthKey: "2026-01",
    actorUserId: "super-admin-1"
  });

  assert.equal(preview.operation, "DELETE_MONTH");
  assert.equal(preview.canProceed, true);
  assert.equal(preview.attendanceDailyRecordsAffected, 12);
  assert.equal(preview.monthlyUserSummariesAffected, 3);
  assert.equal(preview.monthlyBranchSummariesAffected, 2);
  assert.equal(preview.monthlyChainSummariesAffected, 1);
  assert.equal(preview.importBatchesAffected, 1);
  assert.equal(preview.importIssuesAffected, 4);
  assert.deepEqual(preview.monthKeysAffected, ["2026-01"]);
  assert.equal(
    preview.safetyNotice.includes("This affects attendance data only."),
    true
  );
  assert.deepEqual(context.deleteCalls, []);
}

async function testDeleteMonthRequiresExactConfirmation() {
  const context = createMaintenanceServiceContext();

  await assert.rejects(
    () =>
      (context.service as never as {
        deleteAttendanceMonth: (input: Record<string, unknown>) => Promise<unknown>;
      }).deleteAttendanceMonth({
        monthKey: "2026-01",
        actorUserId: "super-admin-1",
        confirmationText: "DELETE"
      }),
    BadRequestException
  );
  assert.deepEqual(context.deleteCalls, []);
}

async function testDeleteMonthDeletesAttendanceTablesOnly() {
  const context = createMaintenanceServiceContext();

  const result = await (context.service as never as {
    deleteAttendanceMonth: (input: Record<string, unknown>) => Promise<{
      operation: string;
      status: string;
      attendanceDailyRecordsAffected: number;
      monthlyUserSummariesAffected: number;
    }>;
  }).deleteAttendanceMonth({
    monthKey: "2026-01",
    actorUserId: "super-admin-1",
    confirmationText: "DELETE ATTENDANCE DATA"
  });

  assert.equal(result.operation, "DELETE_MONTH");
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.attendanceDailyRecordsAffected, 12);
  assert.equal(result.monthlyUserSummariesAffected, 3);
  assert.deepEqual(context.deleteCalls.sort(), [
    "attendanceDailyRecord.deleteMany",
    "attendanceImportIssue.deleteMany",
    "attendanceMonthlyBranchSummary.deleteMany",
    "attendanceMonthlyChainSummary.deleteMany",
    "attendanceMonthlyUserSummary.deleteMany"
  ]);
  assert.equal(
    context.auditLogs.some(
      (log) => log.action === "ATTENDANCE_MAINTENANCE_DELETE_MONTH_PERFORMED"
    ),
    true
  );
}

async function testDeleteAllRequiresExactConfirmation() {
  const context = createMaintenanceServiceContext();

  await assert.rejects(
    () =>
      (context.service as never as {
        deleteAllAttendanceData: (input: Record<string, unknown>) => Promise<unknown>;
      }).deleteAllAttendanceData({
        actorUserId: "super-admin-1",
        confirmationText: "DELETE"
      }),
    BadRequestException
  );

  assert.deepEqual(context.deleteCalls, []);
}

async function testDeleteAllDeletesAttendanceTablesOnly() {
  const context = createMaintenanceServiceContext();

  const result = await (context.service as never as {
    deleteAllAttendanceData: (input: Record<string, unknown>) => Promise<{
      operation: string;
      status: string;
    }>;
  }).deleteAllAttendanceData({
    actorUserId: "super-admin-1",
    confirmationText: "DELETE ATTENDANCE DATA"
  });

  assert.equal(result.operation, "DELETE_ALL");
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(context.deleteCalls.sort(), [
    "attendanceDailyRecord.deleteMany",
    "attendanceImportBatch.deleteMany",
    "attendanceImportIssue.deleteMany",
    "attendanceMonthlyBranchSummary.deleteMany",
    "attendanceMonthlyChainSummary.deleteMany",
    "attendanceMonthlyUserSummary.deleteMany"
  ]);
  assert.equal(
    context.auditLogs.some(
      (log) => log.action === "ATTENDANCE_MAINTENANCE_DELETE_ALL_PERFORMED"
    ),
    true
  );
}

async function testRecalculateBlocksOldSummaryOnlyMonth() {
  const context = createMaintenanceServiceContext({
    dailyCountsByMonth: { "2026-01": 0 },
    userSummaryCountsByMonth: { "2026-01": 3 }
  });

  await assert.rejects(
    () =>
      (context.service as never as {
        recalculateAttendanceSummaries: (
          input: Record<string, unknown>
        ) => Promise<unknown>;
      }).recalculateAttendanceSummaries({
        monthKey: "2026-01",
        actorUserId: "super-admin-1",
        confirmationText: "RECALCULATE ATTENDANCE SUMMARIES"
      }),
    BadRequestException
  );
  assert.equal(context.recalculateCalls.length, 0);
}

async function testCompressOldMonthsSkipsCurrentPreviousAndBlocksMissingSummaries() {
  const context = createMaintenanceServiceContext({
    referenceDate: new Date("2026-05-24T00:00:00.000Z"),
    dailyCountsByMonth: {
      "2026-03": 5,
      "2026-04": 8,
      "2026-05": 10
    },
    userSummaryCountsByMonth: {
      "2026-03": 0,
      "2026-04": 4,
      "2026-05": 5
    }
  });

  const preview = await (context.service as never as {
    previewMaintenance: (input: Record<string, unknown>) => Promise<{
      canProceed: boolean;
      blockers: string[];
      monthKeysAffected: string[];
    }>;
  }).previewMaintenance({
    operation: "COMPRESS_OLD_MONTHS",
    actorUserId: "super-admin-1"
  });

  assert.equal(preview.canProceed, false);
  assert.deepEqual(preview.monthKeysAffected, ["2026-03"]);
  assert.equal(preview.blockers.some((item) => item.includes("2026-03")), true);
}

async function testCompressOldMonthsDeletesOldDailyAfterSummariesExist() {
  const context = createMaintenanceServiceContext({
    referenceDate: new Date("2026-05-24T00:00:00.000Z"),
    dailyCountsByMonth: {
      "2026-02": 7,
      "2026-04": 8,
      "2026-05": 10
    },
    userSummaryCountsByMonth: {
      "2026-02": 3,
      "2026-04": 4,
      "2026-05": 5
    }
  });

  const result = await (context.service as never as {
    compressOldAttendanceMonths: (input: Record<string, unknown>) => Promise<{
      operation: string;
      status: string;
      attendanceDailyRecordsAffected: number;
      monthKeysAffected: string[];
    }>;
  }).compressOldAttendanceMonths({
    actorUserId: "super-admin-1",
    confirmationText: "COMPRESS ATTENDANCE MONTHS"
  });

  assert.equal(result.operation, "COMPRESS_OLD_MONTHS");
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.attendanceDailyRecordsAffected, 7);
  assert.deepEqual(result.monthKeysAffected, ["2026-02"]);
  assert.deepEqual(context.deleteCalls, ["attendanceDailyRecord.deleteMany"]);
  assert.deepEqual(context.updateCalls, ["attendanceMonthlyUserSummary.updateMany"]);
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
    },
    attendanceMonthlyUserSummary: {
      findMany: async () => [
        {
          id: "summary-1",
          identifier: "SHOP-1",
          role: "PICKER",
          totalCreatedShifts: 23,
          totalShiftsNeeded: 24,
          missingShifts: 1,
          lateLevel1Over15Count: 3,
          absentCount: 1,
          under8HoursCount: 2,
          over15HoursCount: 0,
          user: {
            nameEn: "Picker One"
          }
        }
      ]
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

function createMaintenanceServiceContext(
  options: {
    referenceDate?: Date;
    dailyCountsByMonth?: Record<string, number>;
    userSummaryCountsByMonth?: Record<string, number>;
    branchSummaryCountsByMonth?: Record<string, number>;
    chainSummaryCountsByMonth?: Record<string, number>;
    batchCountsByMonth?: Record<string, number>;
    issueCountsByMonth?: Record<string, number>;
  } = {}
) {
  const deleteCalls: string[] = [];
  const updateCalls: string[] = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  const recalculateCalls: Array<Record<string, unknown>> = [];
  const dailyCountsByMonth = options.dailyCountsByMonth ?? { "2026-01": 12 };
  const userSummaryCountsByMonth =
    options.userSummaryCountsByMonth ?? { "2026-01": 3 };
  const branchSummaryCountsByMonth =
    options.branchSummaryCountsByMonth ?? { "2026-01": 2 };
  const chainSummaryCountsByMonth =
    options.chainSummaryCountsByMonth ?? { "2026-01": 1 };
  const batchCountsByMonth = options.batchCountsByMonth ?? { "2026-01": 1 };
  const issueCountsByMonth = options.issueCountsByMonth ?? { "2026-01": 4 };

  function countByWhere(
    counts: Record<string, number>,
    where?: { monthKey?: string | { in?: string[] }; attendanceDate?: { gte?: Date; lte?: Date }; periodFrom?: { gte?: Date; lte?: Date } }
  ) {
    const keys = keysFromWhere(where);
    return keys.reduce((total, key) => total + (counts[key] ?? 0), 0);
  }

  const prisma = {
    attendanceDailyRecord: {
      count: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) =>
        countByWhere(dailyCountsByMonth, where),
      groupBy: async () =>
        Object.entries(dailyCountsByMonth).map(([monthKey, count]) => ({
          monthKey,
          _count: count
        })),
      findMany: async () => [],
      deleteMany: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) => {
        deleteCalls.push("attendanceDailyRecord.deleteMany");
        return { count: countByWhere(dailyCountsByMonth, where) };
      }
    },
    attendanceMonthlyUserSummary: {
      count: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) =>
        countByWhere(userSummaryCountsByMonth, where),
      groupBy: async () =>
        Object.entries(userSummaryCountsByMonth).map(([monthKey, count]) => ({
          monthKey,
          _count: count
        })),
      findMany: async () =>
        Object.entries(userSummaryCountsByMonth).map(([monthKey]) => ({
          monthKey,
          archiveStatus: "DETAILED"
        })),
      deleteMany: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) => {
        deleteCalls.push("attendanceMonthlyUserSummary.deleteMany");
        return { count: countByWhere(userSummaryCountsByMonth, where) };
      },
      updateMany: async () => {
        updateCalls.push("attendanceMonthlyUserSummary.updateMany");
        return { count: Object.values(userSummaryCountsByMonth).reduce((a, b) => a + b, 0) };
      }
    },
    attendanceMonthlyBranchSummary: {
      count: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) =>
        countByWhere(branchSummaryCountsByMonth, where),
      groupBy: async () =>
        Object.entries(branchSummaryCountsByMonth).map(([monthKey, count]) => ({
          monthKey,
          _count: count
        })),
      deleteMany: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) => {
        deleteCalls.push("attendanceMonthlyBranchSummary.deleteMany");
        return { count: countByWhere(branchSummaryCountsByMonth, where) };
      }
    },
    attendanceMonthlyChainSummary: {
      count: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) =>
        countByWhere(chainSummaryCountsByMonth, where),
      groupBy: async () =>
        Object.entries(chainSummaryCountsByMonth).map(([monthKey, count]) => ({
          monthKey,
          _count: count
        })),
      deleteMany: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) => {
        deleteCalls.push("attendanceMonthlyChainSummary.deleteMany");
        return { count: countByWhere(chainSummaryCountsByMonth, where) };
      }
    },
    attendanceImportBatch: {
      count: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) =>
        countByWhere(batchCountsByMonth, where),
      groupBy: async () => [],
      findMany: async () =>
        Object.entries(batchCountsByMonth).map(([monthKey, count]) => ({
          id: `batch-${monthKey}`,
          periodFrom: new Date(`${monthKey}-01T00:00:00.000Z`),
          periodTo: new Date(`${monthKey}-01T00:00:00.000Z`),
          createdAt: new Date(`${monthKey}-02T00:00:00.000Z`),
          completedAt: new Date(`${monthKey}-02T00:00:00.000Z`),
          status: AttendanceImportStatus.COMPLETED,
          _count: count
        })),
      create: async (input: Record<string, unknown>) => ({
        id: "maintenance-batch-1",
        ...(input as object)
      }),
      deleteMany: async () => {
        deleteCalls.push("attendanceImportBatch.deleteMany");
        return { count: Object.values(batchCountsByMonth).reduce((a, b) => a + b, 0) };
      }
    },
    attendanceImportIssue: {
      count: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) =>
        countByWhere(issueCountsByMonth, where),
      groupBy: async () => [],
      deleteMany: async ({ where }: { where?: Parameters<typeof countByWhere>[1] } = {}) => {
        deleteCalls.push("attendanceImportIssue.deleteMany");
        return { count: countByWhere(issueCountsByMonth, where) };
      }
    },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(prisma)
  };

  const service = new AttendanceOperationsService(
    prisma as never,
    {
      recalculateSummariesForPeriod: async (input: Record<string, unknown>) => {
        recalculateCalls.push(input);
        return {
          batchId: "recalculate-batch-1",
          userSummariesStored: 1,
          branchSummariesRebuilt: 1,
          chainSummariesRebuilt: 1
        };
      }
    } as never,
    {} as never,
    {
      log: async (input: Record<string, unknown>) => {
        auditLogs.push(input);
        return input;
      }
    } as never
  );

  if (options.referenceDate) {
    (service as never as { maintenanceReferenceDate: Date }).maintenanceReferenceDate =
      options.referenceDate;
  }

  return {
    auditLogs,
    deleteCalls,
    recalculateCalls,
    service,
    updateCalls
  };
}

function keysFromWhere(where?: {
  monthKey?: string | { in?: string[] };
  attendanceDate?: { gte?: Date; lte?: Date };
  periodFrom?: { gte?: Date; lte?: Date };
}) {
  if (!where) {
    return ["2026-01"];
  }

  if (typeof where.monthKey === "string") {
    return [where.monthKey];
  }

  if (where.monthKey?.in) {
    return where.monthKey.in;
  }

  const range = where.attendanceDate ?? where.periodFrom;
  if (range?.gte && range?.lte) {
    return monthKeysBetween(range.gte, range.lte);
  }

  return ["2026-01"];
}

function monthKeysBetween(from: Date, to: Date) {
  const keys: string[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  while (cursor <= end) {
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    keys.push(`${cursor.getUTCFullYear()}-${month}`);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return keys;
}

void main();
