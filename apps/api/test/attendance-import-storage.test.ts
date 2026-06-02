import assert from "node:assert/strict";

import {
  AssignmentStatus,
  AttendanceAssignmentMismatchStatus,
  AttendanceImportBatchStatus,
  AttendanceImportMode,
  AttendanceIssueCode,
  AttendanceIssueSeverity,
  AttendanceLocationMappingStatus,
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
  "Location",
  "Shift Location"
];

type WorkbookRow = Record<string, unknown>;

interface StoredBatch {
  id: string;
  periodMonth: string;
  fileName: string;
  fileHash: string;
  importMode: AttendanceImportMode;
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
    Location: "100001 - Branch A",
    "Shift Location": "100001 - Branch A",
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
    activeAssignmentFindManyCalls: 0,
    failBatchUpdateForId: null as string | null,
    forbiddenMutationCalls: [] as string[],
    users: [
      {
        id: "user-picker-1",
        shopperId: "SHOPPER-1",
        role: UserRole.PICKER,
        nameEn: "Picker One",
        pickerBranchAssignments: [
          {
            vendor: {
              vendorName: "Branch A"
            }
          }
        ]
      },
      {
        id: "user-picker-2",
        shopperId: "SHOPPER-2",
        role: UserRole.PICKER,
        nameEn: "Picker Two",
        pickerBranchAssignments: [
          {
            vendor: {
              vendorName: "Branch B"
            }
          }
        ]
      },
      {
        id: "user-champ-1",
        shopperId: "CHAMP-1",
        role: UserRole.CHAMP,
        nameEn: "Champ One",
        pickerBranchAssignments: []
      }
    ],
    vendors: [
      {
        id: "vendor-a",
        vendorCode: "100001",
        vendorExternalId: null,
        vendorName: "Branch A",
        chainId: "chain-a",
        chain: { id: "chain-a", chainName: "Chain A" }
      },
      {
        id: "vendor-b",
        vendorCode: "100002",
        vendorExternalId: null,
        vendorName: "Branch B",
        chainId: "chain-b",
        chain: { id: "chain-b", chainName: "Chain B" }
      },
      {
        id: "vendor-external",
        vendorCode: "EXT-1",
        vendorExternalId: "200002",
        vendorName: "External Branch",
        chainId: "chain-external",
        chain: { id: "chain-external", chainName: "External Chain" }
      }
    ],
    pickerBranchAssignments: [
      {
        pickerId: "user-picker-1",
        vendorId: "vendor-a",
        status: AssignmentStatus.ACTIVE,
        startDate: now
      },
      {
        pickerId: "user-picker-2",
        vendorId: "vendor-b",
        status: AssignmentStatus.ACTIVE,
        startDate: now
      }
    ],
    batches: [] as StoredBatch[],
    issues: [] as Record<string, unknown>[],
    dailyRecords: [] as Record<string, unknown>[],
    monthlySummaries: [] as Record<string, unknown>[],
    auditRows: [] as Record<string, unknown>[],
    transactionOptions: [] as Array<Record<string, unknown> | undefined>
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
    vendor: {
      findMany: async ({
        where
      }: {
        where: {
          OR?: Array<{
            vendorCode?: { in: string[] };
            vendorExternalId?: { in: string[] };
          }>;
        };
      }) => {
        const codes = new Set<string>();
        for (const condition of where.OR ?? []) {
          for (const code of condition.vendorCode?.in ?? []) {
            codes.add(code);
          }
          for (const code of condition.vendorExternalId?.in ?? []) {
            codes.add(code);
          }
        }

        return store.vendors.filter(
          (vendor) =>
            codes.has(vendor.vendorCode) ||
            (vendor.vendorExternalId ? codes.has(vendor.vendorExternalId) : false)
        );
      },
      create: async () => {
        store.forbiddenMutationCalls.push("vendor.create");
        throw new Error("Vendor creation is out of scope.");
      },
      update: async () => {
        store.forbiddenMutationCalls.push("vendor.update");
        throw new Error("Vendor update is out of scope.");
      }
    },
    pickerBranchAssignment: {
      findMany: async ({
        where
      }: {
        where: {
          pickerId?: { in: string[] };
          status?: AssignmentStatus;
        };
      }) =>
        {
          store.activeAssignmentFindManyCalls += 1;
          return store.pickerBranchAssignments.filter(
            (assignment) =>
              (!where.pickerId?.in || where.pickerId.in.includes(assignment.pickerId)) &&
              (!where.status || assignment.status === where.status)
          );
        },
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
    $transaction: async <T>(
      callback: (tx: typeof prisma) => Promise<T>,
      options?: Record<string, unknown>
    ) => {
      store.transactionOptions.push(options);
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
    duplicateResolutionRowNumbers?: number[];
    fileName?: string;
    importMode?: AttendanceImportMode;
    periodMonth?: string;
    prisma?: unknown;
    uploadDate?: string;
  } = {}
) {
  const service = createService(options.prisma ?? createStore().prisma);
  const buffer = await workbookBuffer(rows);

  return service.previewImport(buffer, {
    actor: options.actor ?? adminActor,
    fileName: options.fileName ?? "attendance.xlsx",
    importMode: options.importMode,
    periodMonth: options.periodMonth,
    uploadDate: options.uploadDate ?? "2026-05-02",
    duplicateResolutionRowNumbers: options.duplicateResolutionRowNumbers,
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
    assert.equal(result.preview.mappedLocationRows, 1);
    assert.equal(result.preview.unmappedLocationRows, 0);
    assert.equal(result.preview.missingLocationCodeRows, 0);
    assert.equal(result.preview.activeAssignmentMismatchRows, 0);
    assert.equal(result.preview.locationShiftLocationDifferenceRows, 0);
    assert.equal(store.dailyRecords.length, 1);
    assert.equal(store.monthlySummaries.length, 1);
    assert.equal(store.dailyRecords[0]?.["importBatchId"], result.batchId);
    assert.equal(store.dailyRecords[0]?.["reportedVendorId"], "vendor-a");
    assert.equal(store.dailyRecords[0]?.["reportedChainId"], "chain-a");
    assert.equal(store.dailyRecords[0]?.["reportedLocationCode"], "100001");
    assert.equal(store.dailyRecords[0]?.["reportedLocationName"], "Branch A");
    assert.equal(store.dailyRecords[0]?.["reportedLocationRaw"], "100001 - Branch A");
    assert.equal(store.dailyRecords[0]?.["shiftLocationCode"], "100001");
    assert.equal(store.dailyRecords[0]?.["shiftLocationName"], "Branch A");
    assert.equal(store.dailyRecords[0]?.["shiftLocationRaw"], "100001 - Branch A");
    assert.equal(
      store.dailyRecords[0]?.["locationMappingStatus"],
      AttendanceLocationMappingStatus.MAPPED_VENDOR_CODE
    );
    assert.equal(
      store.dailyRecords[0]?.["assignmentMismatchStatus"],
      AttendanceAssignmentMismatchStatus.MATCHES_ACTIVE_ASSIGNMENT
    );
    assert.equal(store.monthlySummaries[0]?.["sourceBatchId"], result.batchId);
    assert.ok(store.dailyRecords[0]?.["shiftDate"] instanceof Date);
    assert.ok(store.dailyRecords[0]?.["actualCheckinTime"] instanceof Date);
    assert.equal(store.monthlySummaries[0]?.["totalWorkingDays"], 1);
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "All Vendors" })
    ], { prisma });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(result.canConfirm, false);
    assert.equal(result.preview.mappedLocationRows, 0);
    assert.equal(result.preview.missingLocationCodeRows, 1);
    assert.equal(result.preview.unmappedLocationRows, 0);
    assert.equal(store.dailyRecords.length, 0);
    assert.ok(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.MISSING_ATTENDANCE_LOCATION_CODE
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "999999 - Unknown Branch" })
    ], { prisma });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(result.canConfirm, false);
    assert.equal(result.preview.mappedLocationRows, 0);
    assert.equal(result.preview.unmappedLocationRows, 1);
    assert.equal(result.preview.missingLocationCodeRows, 0);
    assert.equal(store.dailyRecords.length, 0);
    assert.ok(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.UNMAPPED_ATTENDANCE_LOCATION
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "100002 - Branch B" })
    ], { prisma });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.canConfirm, true);
    assert.equal(result.preview.mappedLocationRows, 1);
    assert.equal(result.preview.activeAssignmentMismatchRows, 1);
    assert.equal(store.dailyRecords.length, 1);
    assert.equal(store.dailyRecords[0]?.["reportedVendorId"], "vendor-b");
    assert.equal(
      store.dailyRecords[0]?.["assignmentMismatchStatus"],
      AttendanceAssignmentMismatchStatus.DIFFERS_FROM_ACTIVE_ASSIGNMENT
    );
    assert.ok(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.ACTIVE_ASSIGNMENT_MISMATCH
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({
        Location: "100001 - Branch A",
        "Shift Location": "100002 - Branch B"
      })
    ], { prisma });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.canConfirm, true);
    assert.equal(result.preview.locationShiftLocationDifferenceRows, 1);
    assert.equal(store.dailyRecords[0]?.["reportedVendorId"], "vendor-a");
    assert.equal(store.dailyRecords[0]?.["shiftLocationCode"], "100002");
    assert.equal(store.dailyRecords[0]?.["shiftLocationName"], "Branch B");
    assert.equal(store.dailyRecords[0]?.["shiftLocationRaw"], "100002 - Branch B");
    assert.ok(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.LOCATION_SHIFT_LOCATION_DIFFERENCE
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "200002 - External Branch" })
    ], { prisma });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.canConfirm, true);
    assert.equal(result.preview.mappedLocationRows, 1);
    assert.equal(store.dailyRecords[0]?.["reportedVendorId"], "vendor-external");
    assert.equal(store.dailyRecords[0]?.["reportedChainId"], "chain-external");
    assert.equal(
      store.dailyRecords[0]?.["locationMappingStatus"],
      AttendanceLocationMappingStatus.MAPPED_VENDOR_EXTERNAL_ID
    );
  }

  {
    const { prisma } = createStore();
    const result = await previewRows([baseRow()], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(result.canConfirm, false);
    assert.ok(
      result.preview.issues.some(
        (issue) =>
          issue.issueCode === AttendanceIssueCode.HISTORICAL_PERIOD_MONTH_REQUIRED
      )
    );
  }

  {
    const { prisma } = createStore();
    const result = await previewRows([baseRow()], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026/05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.ok(
      result.preview.issues.some(
        (issue) =>
          issue.issueCode === AttendanceIssueCode.INVALID_HISTORICAL_PERIOD_MONTH
      )
    );
  }

  {
    const { prisma } = createStore();
    const currentMonthResult = await previewRows([baseRow()], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-06",
      prisma,
      uploadDate: "2026-06-02"
    });
    const futureMonthResult = await previewRows([baseRow()], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-07",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(currentMonthResult.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(futureMonthResult.status, AttendanceImportBatchStatus.FAILED);
    assert.ok(
      currentMonthResult.preview.issues.some(
        (issue) =>
          issue.issueCode ===
          AttendanceIssueCode.HISTORICAL_PERIOD_MONTH_NOT_CLOSED
      )
    );
    assert.ok(
      futureMonthResult.preview.issues.some(
        (issue) =>
          issue.issueCode ===
          AttendanceIssueCode.HISTORICAL_PERIOD_MONTH_NOT_CLOSED
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ "Shift Date": "2026-05-01" }),
      baseRow({
        "Shift Date": "2026-05-31",
        "Shift Name": "Month End Shift",
        "Actual Checkin Time": "09:10"
      })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.canConfirm, true);
    assert.equal(result.preview.importMode, AttendanceImportMode.HISTORICAL_MONTH);
    assert.equal(result.preview.periodMonth, "2026-05");
    assert.equal(result.preview.coverageStartDate, "2026-05-01");
    assert.equal(result.preview.coverageEndDate, "2026-05-31");
    assert.equal(result.preview.expectedCoverageEndDate, "2026-05-31");
    assert.equal(result.dailyRecordCount, 2);
    assert.equal(store.batches[0]?.importMode, AttendanceImportMode.HISTORICAL_MONTH);
    assert.equal(store.activeAssignmentFindManyCalls, 0);
    assert.equal(store.dailyRecords[0]?.["reportedVendorId"], "vendor-a");
    assert.equal(store.dailyRecords[0]?.["reportedChainId"], "chain-a");
    assert.equal(store.dailyRecords[0]?.["reportedLocationCode"], "100001");
    assert.equal(store.dailyRecords[0]?.["reportedLocationName"], "Branch A");
    assert.equal(store.dailyRecords[0]?.["shiftLocationCode"], "100001");
    assert.equal(
      store.dailyRecords[0]?.["assignmentMismatchStatus"],
      AttendanceAssignmentMismatchStatus.NOT_CHECKED
    );
    assert.equal(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.MTD_COVERAGE_END_NOT_YESTERDAY
      ),
      false
    );
    assert.equal(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.MTD_INCLUDES_UPLOAD_DAY
      ),
      false
    );
    assert.equal(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.MTD_INCLUDES_FUTURE_DATE
      ),
      false
    );
  }

  {
    const { prisma } = createStore();
    const result = await previewRows([
      baseRow({ "Shift Date": "2026-06-01" })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.ok(
      result.preview.issues.some(
        (issue) =>
          issue.issueCode ===
          AttendanceIssueCode.SHIFT_DATE_OUTSIDE_SELECTED_PERIOD_MONTH
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "All Vendors" })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(store.dailyRecords.length, 0);
    assert.ok(
      result.preview.issues.some(
        (issue) =>
          issue.issueCode === AttendanceIssueCode.MISSING_ATTENDANCE_LOCATION_CODE
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "999999 - Unknown Branch" })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(store.dailyRecords.length, 0);
    assert.ok(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.UNMAPPED_ATTENDANCE_LOCATION
      )
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({ Location: "100002 - Branch B" })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.preview.activeAssignmentMismatchRows, 0);
    assert.equal(store.activeAssignmentFindManyCalls, 0);
    assert.equal(store.dailyRecords[0]?.["reportedVendorId"], "vendor-b");
    assert.equal(
      store.dailyRecords[0]?.["assignmentMismatchStatus"],
      AttendanceAssignmentMismatchStatus.NOT_CHECKED
    );
    assert.equal(
      result.preview.issues.some(
        (issue) => issue.issueCode === AttendanceIssueCode.ACTIVE_ASSIGNMENT_MISMATCH
      ),
      false
    );
  }

  {
    const { prisma, store } = createStore();
    const result = await previewRows([
      baseRow({
        Location: "100001 - Branch A",
        "Shift Location": "100002 - Branch B"
      })
    ], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    assert.equal(result.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(result.preview.locationShiftLocationDifferenceRows, 1);
    assert.equal(store.dailyRecords[0]?.["shiftLocationCode"], "100002");
    assert.ok(
      result.preview.issues.some(
        (issue) =>
          issue.issueCode === AttendanceIssueCode.LOCATION_SHIFT_LOCATION_DIFFERENCE
      )
    );
  }

  {
    const { prisma, store } = createStore();
    await previewRows([baseRow()], { prisma });

    assert.equal(store.transactionOptions.length, 1);
    assert.equal(store.transactionOptions[0]?.["timeout"], 60_000);
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
    const failedPreview = await previewRows([
      baseRow({
        "Shift Name": "Morning Shift",
        "Actual Checkin Time": "09:05"
      }),
      baseRow({
        "Shift Name": "Late Coverage",
        "Actual Checkin Time": "10:31",
        Status: "Late"
      }),
      baseRow({
        Identifier: "SHOPPER-2",
        "Shift Date": "2026-05-08"
      })
    ], { prisma, uploadDate: "2026-05-09" });

    assert.equal(failedPreview.status, AttendanceImportBatchStatus.FAILED);
    assert.equal(failedPreview.preview.duplicateGroups.length, 1);
    assert.equal(failedPreview.preview.duplicateGroups[0]?.pickerName, "Picker One");
    assert.equal(failedPreview.preview.duplicateGroups[0]?.branchName, "Branch A");

    const resolvedPreview = await previewRows([
      baseRow({
        "Shift Name": "Morning Shift",
        "Actual Checkin Time": "09:05"
      }),
      baseRow({
        "Shift Name": "Late Coverage",
        "Actual Checkin Time": "10:31",
        Status: "Late"
      }),
      baseRow({
        Identifier: "SHOPPER-2",
        "Shift Date": "2026-05-08"
      })
    ], {
      duplicateResolutionRowNumbers: [3],
      prisma,
      uploadDate: "2026-05-09"
    });

    assert.equal(resolvedPreview.status, AttendanceImportBatchStatus.VALIDATED);
    assert.equal(resolvedPreview.canConfirm, true);
    assert.equal(resolvedPreview.dailyRecordCount, 2);
    assert.equal(
      store.dailyRecords.some(
        (record) =>
          record["shopperId"] === "SHOPPER-1" &&
          record["rawRowNumber"] === 3 &&
          record["shiftName"] === "Late Coverage"
      ),
      true
    );
    assert.equal(
      store.dailyRecords.some(
        (record) =>
          record["shopperId"] === "SHOPPER-1" &&
          record["rawRowNumber"] === 2
      ),
      false
    );
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
      importMode: AttendanceImportMode.MTD,
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
      id: "previous-historical-active",
      periodMonth: "2026-05",
      fileName: "previous-historical.xlsx",
      fileHash: "previous-historical-hash",
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
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
    const preview = await previewRows([baseRow()], {
      importMode: AttendanceImportMode.HISTORICAL_MONTH,
      periodMonth: "2026-05",
      prisma,
      uploadDate: "2026-06-02"
    });

    const confirmed = await service.confirmImport(preview.batchId, {
      actor: adminActor,
      now: store.now
    });

    assert.equal(confirmed.previousActiveBatchId, "previous-historical-active");
    assert.equal(
      store.batches.find((batch) => batch.id === "previous-historical-active")
        ?.status,
      AttendanceImportBatchStatus.REPLACED
    );
    assert.equal(
      store.batches.find((batch) => batch.id === preview.batchId)
        ?.replaceOfBatchId,
      "previous-historical-active"
    );
    assert.equal(
      store.batches.find((batch) => batch.id === preview.batchId)?.importMode,
      AttendanceImportMode.HISTORICAL_MONTH
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
      importMode: AttendanceImportMode.MTD,
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
