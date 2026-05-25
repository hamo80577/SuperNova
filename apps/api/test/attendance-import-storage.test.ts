import assert from "node:assert/strict";

import {
  AttendanceImportBatchStatus,
  AttendanceIssueCode,
  AttendanceIssueSeverity,
  UserRole
} from "@prisma/client";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import ExcelJS from "exceljs";

import { AttendanceCalculationService } from "../src/attendance/attendance-calculation.service";
import { AttendanceImportService } from "../src/attendance/attendance-import.service";
import { AttendanceParserService } from "../src/attendance/attendance-parser.service";
import { AttendanceUserLookupService } from "../src/attendance/attendance-user-lookup.service";
import { AttendanceValidatorService } from "../src/attendance/attendance-validator.service";
import type { AttendanceImportActor } from "../src/attendance/attendance-import.types";

const requiredHeaders = [
  "Identifier",
  "Division",
  "Shift Date",
  "Shift Name",
  "Shift Scheduled Start Time",
  "Shift Scheduled End Time",
  "Shift Break Duration (mins)",
  "Total Hours In Shift (hrs)",
  "Actual Checkin Time",
  "Actual Checkout Time",
  "Actual Work Duration (hrs)",
  "Status",
  "Name",
  "Designation",
  "Sub Division",
  "Location"
];

type WorkbookRow = Record<string, unknown>;

interface StoredBatch {
  id: string;
  periodMonth: string;
  fileName: string;
  fileHash: string;
  uploadedByUserId: string;
  uploadedAt: Date;
  status: AttendanceImportBatchStatus;
  rowCount: number;
  egyptRows: number;
  matchedPickerRows: number;
  unmatchedRows: number;
  excludedNonPickerRows: number;
  excludedNonEgyptRows: number;
  errorRows: number;
  warningRows: number;
  coverageStartDate: Date | null;
  coverageEndDate: Date | null;
  expectedCoverageEndDate: Date | null;
  replaceOfBatchId: string | null;
  confirmedByUserId: string | null;
  confirmedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminActor: AttendanceImportActor = {
  id: "admin-user-1",
  role: UserRole.ADMIN
};

const superAdminActor: AttendanceImportActor = {
  id: "super-admin-user-1",
  role: UserRole.SUPER_ADMIN
};

const pickerActor: AttendanceImportActor = {
  id: "picker-user-1",
  role: UserRole.PICKER
};

function baseRow(overrides: WorkbookRow = {}): WorkbookRow {
  return {
    Identifier: "SHOPPER-1",
    Division: "Egypt",
    "Shift Date": "2026-05-01",
    "Shift Name": "Morning Shift",
    "Shift Scheduled Start Time": "09:00",
    "Shift Scheduled End Time": "17:00",
    "Shift Break Duration (mins)": 60,
    "Total Hours In Shift (hrs)": 8,
    "Actual Checkin Time": "09:05",
    "Actual Checkout Time": "17:05",
    "Actual Work Duration (hrs)": 8,
    Status: "Present",
    Name: "Picker One",
    Designation: "Picker",
    "Sub Division": "Cairo",
    Location: "Branch A",
    ...overrides
  };
}

async function workbookBuffer(rows: WorkbookRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Attendance");

  worksheet.addRow(requiredHeaders);
  rows.forEach((row) => {
    worksheet.addRow(requiredHeaders.map((header) => row[header] ?? ""));
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function createStore() {
  const now = new Date("2026-05-09T10:00:00.000Z");
  const store = {
    now,
    nextBatchNumber: 1,
    failBatchUpdateForId: null as string | null,
    forbiddenMutationCalls: [] as string[],
    users: [
      {
        id: "user-picker-1",
        shopperId: "SHOPPER-1",
        role: UserRole.PICKER,
        nameEn: "Picker One"
      },
      {
        id: "user-picker-2",
        shopperId: "SHOPPER-2",
        role: UserRole.PICKER,
        nameEn: "Picker Two"
      },
      {
        id: "user-champ-1",
        shopperId: "CHAMP-1",
        role: UserRole.CHAMP,
        nameEn: "Champ One"
      }
    ],
    batches: [] as StoredBatch[],
    issues: [] as Record<string, unknown>[],
    dailyRecords: [] as Record<string, unknown>[],
    monthlySummaries: [] as Record<string, unknown>[],
    auditRows: [] as Record<string, unknown>[]
  };

  const prisma = {
    user: {
      findMany: async ({ where }: { where: { shopperId: { in: string[] } } }) =>
        store.users.filter((user) => where.shopperId.in.includes(user.shopperId)),
      create: async () => {
        store.forbiddenMutationCalls.push("user.create");
        throw new Error("User creation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("user.update");
        throw new Error("User update is out of scope.");
      }
    },
    pickerBranchAssignment: {
      create: async () => {
        store.forbiddenMutationCalls.push("pickerBranchAssignment.create");
        throw new Error("Assignment mutation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("pickerBranchAssignment.update");
        throw new Error("Assignment mutation is out of scope.");
      }
    },
    attendanceImportBatch: {
      create: async ({ data }: { data: Omit<StoredBatch, "id" | "createdAt" | "updatedAt"> }) => {
        const batch: StoredBatch = {
          id: `batch-${store.nextBatchNumber++}`,
          createdAt: store.now,
          updatedAt: store.now,
          ...data
        };
        store.batches.push(batch);
        return batch;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.batches.find((batch) => batch.id === where.id) ?? null,
      findFirst: async ({
        where
      }: {
        where: {
          periodMonth: string;
          status: AttendanceImportBatchStatus;
          id?: { not: string };
        };
      }) =>
        store.batches.find(
          (batch) =>
            batch.periodMonth === where.periodMonth &&
            batch.status === where.status &&
            batch.id !== where.id?.not
        ) ?? null,
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<StoredBatch>;
      }) => {
        if (store.failBatchUpdateForId === where.id) {
          throw new Error("Simulated batch update failure.");
        }

        const batch = store.batches.find((item) => item.id === where.id);
        assert.ok(batch, `Missing batch ${where.id}`);
        Object.assign(batch, data, { updatedAt: store.now });
        return batch;
      }
    },
    attendanceImportIssue: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        store.issues.push(...data);
        return { count: data.length };
      }
    },
    attendanceDailyRecord: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        store.dailyRecords.push(...data);
        return { count: data.length };
      }
    },
    attendancePickerMonthlySummary: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        store.monthlySummaries.push(...data);
        return { count: data.length };
      }
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        store.auditRows.push(data);
        return { id: `audit-${store.auditRows.length}`, ...data };
      }
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => {
      const snapshot = {
        batches: store.batches.map((batch) => ({ ...batch })),
        issues: store.issues.map((issue) => ({ ...issue })),
        dailyRecords: store.dailyRecords.map((record) => ({ ...record })),
        monthlySummaries: store.monthlySummaries.map((summary) => ({ ...summary })),
        auditRows: store.auditRows.map((row) => ({ ...row }))
      };

      try {
        return await callback(prisma);
      } catch (error) {
        store.batches = snapshot.batches;
        store.issues = snapshot.issues;
        store.dailyRecords = snapshot.dailyRecords;
        store.monthlySummaries = snapshot.monthlySummaries;
        store.auditRows = snapshot.auditRows;
        throw error;
      }
    }
  };

  return { prisma, store };
}

function createService(prisma: unknown) {
  const parser = new AttendanceParserService();
  return new AttendanceImportService(
    prisma as never,
    parser,
    new AttendanceValidatorService(parser),
    new AttendanceCalculationService(),
    new AttendanceUserLookupService(prisma as never)
  );
}

async function previewRows(
  rows: WorkbookRow[],
  options: {
    actor?: AttendanceImportActor;
    fileName?: string;
    prisma?: unknown;
  } = {}
) {
  const service = createService(options.prisma ?? createStore().prisma);
  const buffer = await workbookBuffer(rows);

  return service.previewImport(buffer, {
    actor: options.actor ?? adminActor,
    fileName: options.fileName ?? "attendance.xlsx",
    uploadDate: "2026-05-02",
    now: "2026-05-09T10:00:00.000Z"
  });
}

async function main() {
  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const buffer = await workbookBuffer([
      baseRow(),
      baseRow({
        Identifier: "SHOPPER-2",
        Division: "KSA"
      })
    ]);

    const result = await service.previewImport(buffer, {
      actor: adminActor,
      fileName: "daily.xlsx",
      uploadDate: "2026-05-02",
      now: store.now
    });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.canConfirm, true);
    assert.equal(store.batches[0]?.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(store.batches[0]?.rowCount, 2);
    assert.equal(store.batches[0]?.egyptRows, 1);
    assert.equal(store.batches[0]?.excludedNonEgyptRows, 1);
    assert.equal(store.issues.length, 1);
    assert.equal(store.issues[0]?.["issueCode"], AttendanceIssueCode.NON_EGYPT_ROW);
    assert.equal(store.auditRows[0]?.["action"], "ATTENDANCE_IMPORT_PREVIEW_CREATED");
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([baseRow()], { prisma });

    assert.equal(result.dailyRecordCount, 1);
    assert.equal(result.monthlySummaryCount, 1);
    assert.equal(store.dailyRecords.length, 1);
    assert.equal(store.monthlySummaries.length, 1);
    assert.equal(store.dailyRecords[0]?.["importBatchId"], result.batchId);
    assert.equal(store.monthlySummaries[0]?.["sourceBatchId"], result.batchId);
    assert.ok(store.dailyRecords[0]?.["shiftDate"] instanceof Date);
    assert.ok(store.dailyRecords[0]?.["actualCheckinTime"] instanceof Date);
    assert.equal(store.monthlySummaries[0]?.["totalWorkingDays"], 1);
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({
        "Actual Checkin Time": "-"
      })
    ], { prisma });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(result.canConfirm, false);
    assert.equal(store.batches[0]?.errorRows, 1);
    assert.equal(store.dailyRecords.length, 0);
    assert.equal(store.monthlySummaries.length, 0);
    assert.equal(store.auditRows[0]?.["action"], "ATTENDANCE_IMPORT_FAILED_VALIDATION");
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([baseRow()], { prisma });

    const confirmed = await service.confirmImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.equal(confirmed.status, AttendanceImportBatchStatus.ACTIVE);
    assert.equal(store.batches[0]?.status, AttendanceImportBatchStatus.ACTIVE);
    assert.equal(store.batches[0]?.confirmedByUserId, adminActor.id);
    assert.equal(store.auditRows.at(-1)?.["action"], "ATTENDANCE_IMPORT_CONFIRMED");
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    store.batches.push({
      id: "previous-active",
      periodMonth: "2026-05",
      fileName: "previous.xlsx",
      fileHash: "previous-hash",
      uploadedByUserId: adminActor.id,
      uploadedAt: store.now,
      status: AttendanceImportBatchStatus.ACTIVE,
      rowCount: 1,
      egyptRows: 1,
      matchedPickerRows: 1,
      unmatchedRows: 0,
      excludedNonPickerRows: 0,
      excludedNonEgyptRows: 0,
      errorRows: 0,
      warningRows: 0,
      coverageStartDate: store.now,
      coverageEndDate: store.now,
      expectedCoverageEndDate: store.now,
      replaceOfBatchId: null,
      confirmedByUserId: adminActor.id,
      confirmedAt: store.now,
      notes: null,
      createdAt: store.now,
      updatedAt: store.now
    });
    const preview = await previewRows([baseRow()], { prisma });

    const confirmed = await service.confirmImport(preview.batchId, {
      actor: superAdminActor,
      now: store.now
    });

    assert.equal(confirmed.previousActiveBatchId, "previous-active");
    assert.equal(
      store.batches.find((batch) => batch.id === "previous-active")?.status,
      AttendanceImportBatchStatus.REPLACED
    );
    assert.equal(
      store.batches.find((batch) => batch.id === preview.batchId)?.replaceOfBatchId,
      "previous-active"
    );
    assert.ok(
      store.auditRows.some(
        (row) => row["action"] === "ATTENDANCE_IMPORT_REPLACED_ACTIVE_BATCH"
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    store.batches.push({
      id: "previous-active",
      periodMonth: "2026-05",
      fileName: "previous.xlsx",
      fileHash: "previous-hash",
      uploadedByUserId: adminActor.id,
      uploadedAt: store.now,
      status: AttendanceImportBatchStatus.ACTIVE,
      rowCount: 1,
      egyptRows: 1,
      matchedPickerRows: 1,
      unmatchedRows: 0,
      excludedNonPickerRows: 0,
      excludedNonEgyptRows: 0,
      errorRows: 0,
      warningRows: 0,
      coverageStartDate: store.now,
      coverageEndDate: store.now,
      expectedCoverageEndDate: store.now,
      replaceOfBatchId: null,
      confirmedByUserId: adminActor.id,
      confirmedAt: store.now,
      notes: null,
      createdAt: store.now,
      updatedAt: store.now
    });
    const preview = await previewRows([baseRow()], { prisma });
    store.failBatchUpdateForId = preview.batchId;

    await assert.rejects(
      service.confirmImport(preview.batchId, {
        actor: adminActor,
        now: store.now
      }),
      /Simulated batch update failure/
    );

    assert.equal(
      store.batches.find((batch) => batch.id === "previous-active")?.status,
      AttendanceImportBatchStatus.ACTIVE
    );
    assert.equal(
      store.batches.find((batch) => batch.id === preview.batchId)?.status,
      AttendanceImportBatchStatus.VALIDATED
    );
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const failedPreview = await previewRows([
      baseRow({ "Actual Checkin Time": "-" })
    ], { prisma });

    await assert.rejects(
      service.confirmImport(failedPreview.batchId, {
        actor: adminActor,
        now: store.now
      }),
      BadRequestException
    );

    store.batches.push({
      ...store.batches[0]!,
      id: "validated-with-errors",
      status: AttendanceImportBatchStatus.VALIDATED,
      errorRows: 1
    });

    await assert.rejects(
      service.confirmImport("validated-with-errors", {
        actor: adminActor,
        now: store.now
      }),
      BadRequestException
    );
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    await assert.doesNotReject(() =>
      previewRows([baseRow()], { actor: superAdminActor, prisma })
    );

    for (const role of [UserRole.PICKER, UserRole.CHAMP, UserRole.AREA_MANAGER]) {
      await assert.rejects(
        service.previewImport(Buffer.from("not-used"), {
          actor: { id: `${role}-user`, role },
          fileName: "attendance.xlsx",
          uploadDate: "2026-05-02",
          now: store.now
        }),
        ForbiddenException
      );
      await assert.rejects(
        service.confirmImport("missing-batch", {
          actor: { id: `${role}-user`, role },
          now: store.now
        }),
        ForbiddenException
      );
    }
  }

  {
    const { prisma, store } = createStore();
    const service = createService(prisma);
    const preview = await previewRows([baseRow()], { prisma });
    await service.confirmImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.deepEqual(store.forbiddenMutationCalls, []);
  }

  assert.ok(AttendanceIssueSeverity.ERROR);
}

void main();
