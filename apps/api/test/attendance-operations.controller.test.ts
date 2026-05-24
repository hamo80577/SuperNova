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
    previewHistoricalAssignments: async () => {
      calls.push("preview");
      return { proposalsCount: 0 };
    },
    confirmHistoricalAssignments: async () => {
      calls.push("confirm");
      return { createdCount: 0 };
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
  assert.deepEqual(calls, ["upload", "list", "detail", "issues", "preview", "confirm"]);
}

void main();
