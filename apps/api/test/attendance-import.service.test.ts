import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";
import {
  AttendanceImportMode,
  AttendanceImportStatus,
  AttendanceIssueSeverity,
  AttendanceIssueType
} from "@prisma/client";

import { AttendanceImportService } from "../src/attendance/attendance-import.service";

async function main() {
  const batchUpdates: Array<{ data: Record<string, unknown> }> = [];
  const issuesCreated: unknown[] = [];
  let transactionCalled = false;

  const prisma = {
    attendanceImportBatch: {
      create: async () => ({ id: "batch-1" }),
      update: async (input: { data: Record<string, unknown> }) => {
        batchUpdates.push(input);
        return { id: "batch-1", ...input.data };
      }
    },
    attendanceImportIssue: {
      createMany: async ({ data }: { data: unknown[] }) => {
        issuesCreated.push(...data);
        return { count: data.length };
      }
    },
    $transaction: async () => {
      transactionCalled = true;
    }
  };
  const parser = {
    parseAttendanceBuffer: async () => ({
      rows: [],
      issues: [
        {
          severity: AttendanceIssueSeverity.ERROR,
          type: AttendanceIssueType.MISSING_REQUIRED_COLUMN,
          message: "Missing required attendance column: Identifier.",
          metadata: { column: "Identifier" }
        }
      ]
    })
  };
  const service = new AttendanceImportService(
    prisma as never,
    parser as never,
    { matchIdentifiers: async () => new Map() } as never,
    { calculateDailyMetrics: () => ({}) } as never,
    { resolvePickerSnapshot: async () => ({}) } as never,
    {
      buildMonthlySummaries: () => ({
        userSummaries: [],
        branchSummaries: [],
        chainSummaries: []
      }),
      monthKeysBetween: () => []
    } as never,
    { build: (issue: unknown) => issue } as never
  );

  await assert.rejects(
    () =>
      service.importAttendanceFromBuffer({
        buffer: Buffer.from("not-a-real-workbook"),
        fileName: "attendance.xlsx",
        periodFrom: new Date("2026-05-01T00:00:00.000Z"),
        periodTo: new Date("2026-05-31T00:00:00.000Z"),
        mode: AttendanceImportMode.HISTORICAL_BACKFILL,
        createdById: "admin-1"
      }),
    BadRequestException
  );

  assert.equal(transactionCalled, false);
  assert.equal(issuesCreated.length, 1);
  assert.equal(
    batchUpdates.some(
      (update) => update.data.status === AttendanceImportStatus.FAILED
    ),
    true
  );
}

void main();
