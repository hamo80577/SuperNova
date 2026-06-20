import assert from "node:assert/strict";

import {
  AttendanceImportBatchStatus,
  OrdersKpiImportBatchStatus,
  UserRole
} from "@prisma/client";

import { AttendanceImportQueueService } from "../src/attendance/attendance-import-queue.service";
import { ATTENDANCE_IMPORT_JOB, ORDERS_KPI_IMPORT_JOB } from "../src/import-jobs/import-jobs.constants";
import { OrdersKpisImportQueueService } from "../src/orders-kpis/orders-kpis-import-queue.service";

async function runAttendanceUploadPersistsPendingBatchBeforeDispatch() {
  const batches: Array<Record<string, unknown>> = [];
  const jobs: Array<{ name: string; data: Record<string, unknown> }> = [];
  const prisma = {
    attendanceImportBatch: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        batches.push(data);
        return data;
      }
    }
  };
  const queue = {
    add: async (name: string, data: Record<string, unknown>) => {
      assert.equal(
        batches[0]?.status,
        AttendanceImportBatchStatus.PENDING,
        "The durable PENDING record must exist before queue dispatch."
      );
      jobs.push({ name, data });
      return { id: data.batchId };
    }
  };
  const service = new AttendanceImportQueueService(
    prisma as never,
    queue as never,
    { remove: async () => undefined } as never
  );

  const response = await service.enqueue(
    {
      originalname: "attendance.xlsx",
      path: "C:\\imports\\attendance.xlsx",
      size: 1024
    },
    {
      actor: { id: "admin-1", role: UserRole.ADMIN },
      fileName: "attendance.xlsx",
      uploadDate: "2026-06-19"
    }
  );

  assert.equal(response.status, "PENDING");
  assert.equal(response.batchId, response.jobId);
  assert.equal(batches[0]?.jobId, response.jobId);
  assert.equal(jobs[0]?.name, ATTENDANCE_IMPORT_JOB);
  assert.equal(jobs[0]?.data.batchId, response.batchId);
}

async function runOrdersKpiUploadPersistsPendingBatchBeforeDispatch() {
  const batches: Array<Record<string, unknown>> = [];
  const jobs: Array<{ name: string; data: Record<string, unknown> }> = [];
  const prisma = {
    ordersKpiImportBatch: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        batches.push(data);
        return data;
      }
    }
  };
  const queue = {
    add: async (name: string, data: Record<string, unknown>) => {
      assert.equal(
        batches[0]?.status,
        OrdersKpiImportBatchStatus.PENDING,
        "The durable PENDING record must exist before queue dispatch."
      );
      jobs.push({ name, data });
      return { id: data.batchId };
    }
  };
  const service = new OrdersKpisImportQueueService(
    prisma as never,
    queue as never,
    { remove: async () => undefined } as never
  );

  const response = await service.enqueue(
    {
      originalname: "orders-kpi.xlsx",
      path: "C:\\imports\\orders-kpi.xlsx",
      size: 2048
    },
    {
      actor: { id: "admin-1", role: UserRole.ADMIN },
      fileName: "orders-kpi.xlsx"
    }
  );

  assert.equal(response.status, "PENDING");
  assert.equal(response.batchId, response.jobId);
  assert.equal(batches[0]?.jobId, response.jobId);
  assert.deepEqual(batches[0]?.coveredDates, []);
  assert.equal(jobs[0]?.name, ORDERS_KPI_IMPORT_JOB);
  assert.equal(jobs[0]?.data.batchId, response.batchId);
}

async function main() {
  await runAttendanceUploadPersistsPendingBatchBeforeDispatch();
  await runOrdersKpiUploadPersistsPendingBatchBeforeDispatch();
}

void main();
