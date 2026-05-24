import assert from "node:assert/strict";

import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AttendanceImportMode, UserRole } from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { AttendanceOperationsController } from "../src/attendance/attendance-operations.controller";
import type { AttendanceOperationsService } from "../src/attendance/attendance-operations.service";

const controllerGuards = Reflect.getMetadata(
  GUARDS_METADATA,
  AttendanceOperationsController
);
assert.deepEqual(controllerGuards, [JwtAuthGuard, RolesGuard]);
assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AttendanceOperationsController), [
  UserRole.SUPER_ADMIN
]);

async function main() {
  const calls: string[] = [];
  const service = {
    uploadAttendanceImport: async () => {
      calls.push("upload");
      return { batchId: "batch-1", status: "COMPLETED" };
    },
    listImports: async () => {
      calls.push("list");
      return { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
    },
    getImport: async () => {
      calls.push("detail");
      return { id: "batch-1" };
    },
    listImportIssues: async () => {
      calls.push("issues");
      return { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
    },
    getImportSampleUsers: async () => {
      calls.push("sample-users");
      return { items: [] };
    },
    previewHistoricalAssignments: async () => {
      calls.push("preview");
      return { proposalsCount: 0 };
    },
    confirmHistoricalAssignments: async () => {
      calls.push("confirm");
      return { createdCount: 0 };
    },
    listMaintenanceMonths: async () => {
      calls.push("maintenance-months");
      return { items: [] };
    },
    previewMaintenance: async () => {
      calls.push("maintenance-preview");
      return { canProceed: true };
    },
    deleteAttendanceRange: async () => {
      calls.push("maintenance-delete-range");
      return { status: "COMPLETED" };
    },
    deleteAttendanceMonth: async () => {
      calls.push("maintenance-delete-month");
      return { status: "COMPLETED" };
    },
    deleteAllAttendanceData: async () => {
      calls.push("maintenance-delete-all");
      return { status: "COMPLETED" };
    },
    recalculateAttendanceSummaries: async () => {
      calls.push("maintenance-recalculate");
      return { status: "COMPLETED" };
    },
    compressOldAttendanceMonths: async () => {
      calls.push("maintenance-compress");
      return { status: "COMPLETED" };
    }
  } as unknown as AttendanceOperationsService;
  const controller = new AttendanceOperationsController(service);
  const user = { id: "super-admin-1", role: UserRole.SUPER_ADMIN };
  const request = { ip: "127.0.0.1", headers: { "user-agent": "test" } };
  const file = {
    originalname: "attendance.xlsx",
    buffer: Buffer.from("xlsx"),
    size: 4
  };

  assert.deepEqual(
    await controller.uploadAttendanceImport(
      file,
      {
        periodFrom: "2026-05-01",
        periodTo: "2026-05-31",
        uploadMode: AttendanceImportMode.DAILY_MTD_OVERRIDE
      },
      user as never,
      request as never
    ),
    { batchId: "batch-1", status: "COMPLETED" }
  );
  assert.deepEqual(await controller.listImports({}, user as never), {
    items: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 }
  });
  assert.deepEqual(await controller.getImport("batch-1", user as never), {
    id: "batch-1"
  });
  assert.deepEqual(await controller.listImportIssues("batch-1", {}, user as never), {
    items: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 }
  });
  assert.deepEqual(await controller.getImportSampleUsers("batch-1"), {
    items: []
  });
  assert.deepEqual(
    await controller.previewHistoricalAssignments(
      file,
      {
        periodFrom: "2026-01-01",
        periodTo: "2026-01-31"
      },
      user as never,
      request as never
    ),
    { proposalsCount: 0 }
  );
  assert.deepEqual(
    await controller.confirmHistoricalAssignments(
      file,
      {
        periodFrom: "2026-01-01",
        periodTo: "2026-01-31",
        confirmationText: "CREATE HISTORICAL ASSIGNMENTS"
      },
      user as never,
      request as never
    ),
    { createdCount: 0 }
  );
  assert.deepEqual(await controller.listMaintenanceMonths(), { items: [] });
  assert.deepEqual(
    await controller.previewMaintenance(
      { operation: "DELETE_MONTH", monthKey: "2026-01" } as never,
      user as never,
      request as never
    ),
    { canProceed: true }
  );
  assert.deepEqual(
    await controller.deleteAttendanceRange(
      {
        periodFrom: "2026-01-01",
        periodTo: "2026-01-31",
        confirmationText: "DELETE ATTENDANCE DATA"
      },
      user as never,
      request as never
    ),
    { status: "COMPLETED" }
  );
  assert.deepEqual(
    await controller.deleteAttendanceMonth(
      {
        monthKey: "2026-01",
        confirmationText: "DELETE ATTENDANCE DATA"
      },
      user as never,
      request as never
    ),
    { status: "COMPLETED" }
  );
  assert.deepEqual(
    await controller.deleteAllAttendanceData(
      { confirmationText: "DELETE ATTENDANCE DATA" },
      user as never,
      request as never
    ),
    { status: "COMPLETED" }
  );
  assert.deepEqual(
    await controller.recalculateAttendanceSummaries(
      {
        monthKey: "2026-01",
        confirmationText: "RECALCULATE ATTENDANCE SUMMARIES"
      },
      user as never,
      request as never
    ),
    { status: "COMPLETED" }
  );
  assert.deepEqual(
    await controller.compressOldAttendanceMonths(
      { confirmationText: "COMPRESS ATTENDANCE MONTHS" },
      user as never,
      request as never
    ),
    { status: "COMPLETED" }
  );
  assert.deepEqual(calls, [
    "upload",
    "list",
    "detail",
    "issues",
    "sample-users",
    "preview",
    "confirm",
    "maintenance-months",
    "maintenance-preview",
    "maintenance-delete-range",
    "maintenance-delete-month",
    "maintenance-delete-all",
    "maintenance-recalculate",
    "maintenance-compress"
  ]);
}

void main();
