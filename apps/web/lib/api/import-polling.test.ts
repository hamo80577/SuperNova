import assert from "node:assert/strict";

import { loadQueuedImportPreview, pollImportStatus } from "./import-polling";

interface TestStatus {
  status: "PENDING" | "PROCESSING" | "VALIDATED";
}

void run();

async function run() {
  await testPendingImportStopsAtTerminalStatus();
  await testCancelledImportStopsPolling();
  await testValidatedImportLoadsPreview();
  await testFailedImportDoesNotLoadPreview();
}

async function testPendingImportStopsAtTerminalStatus() {
  const responses: TestStatus[] = [
    { status: "PENDING" },
    { status: "PROCESSING" },
    { status: "VALIDATED" }
  ];
  const observedStatuses: string[] = [];

  const result = await pollImportStatus({
    fetchStatus: async () => responses.shift() ?? { status: "VALIDATED" },
    intervalMs: 0,
    onStatus: ({ status }) => observedStatuses.push(status),
    timeoutMs: 1_000
  });

  assert.equal(result.status, "VALIDATED");
  assert.deepEqual(observedStatuses, ["PENDING", "PROCESSING", "VALIDATED"]);
}

async function testCancelledImportStopsPolling() {
  const controller = new AbortController();
  let requestCount = 0;

  await assert.rejects(
    pollImportStatus({
      fetchStatus: async () => {
        requestCount += 1;
        return { status: "PENDING" };
      },
      intervalMs: 100,
      onStatus: () => controller.abort(),
      signal: controller.signal,
      timeoutMs: 1_000
    }),
    { name: "AbortError" }
  );

  assert.equal(requestCount, 1);
}

async function testValidatedImportLoadsPreview() {
  const controller = new AbortController();
  const processingStatuses: string[] = [];

  const preview = await loadQueuedImportPreview({
    enqueue: async () => ({ batchId: "batch-1", status: "PENDING" }),
    fallbackFailureMessage: "Validation failed.",
    fetchPreview: async (batchId) => ({ batchId, rowCount: 12 }),
    fetchStatus: async () => ({
      failureReason: null,
      status: "VALIDATED"
    }),
    importLabel: "Attendance import",
    isSuccessfulStatus: (status) => status === "VALIDATED",
    onProcessingStatus: (_batchId, status) =>
      processingStatuses.push(status),
    signal: controller.signal
  });

  assert.deepEqual(preview, { batchId: "batch-1", rowCount: 12 });
  assert.deepEqual(processingStatuses, ["PENDING"]);
}

async function testFailedImportDoesNotLoadPreview() {
  const controller = new AbortController();
  let previewRequestCount = 0;

  await assert.rejects(
    loadQueuedImportPreview({
      enqueue: async () => ({ batchId: "batch-2", status: "PENDING" }),
      fallbackFailureMessage: "Validation failed.",
      fetchPreview: async () => {
        previewRequestCount += 1;
        return {};
      },
      fetchStatus: async () => ({
        failureReason: "Workbook could not be parsed.",
        status: "FAILED"
      }),
      importLabel: "Orders KPI import",
      isSuccessfulStatus: (status) => status === "VALIDATED",
      onProcessingStatus: () => undefined,
      signal: controller.signal
    }),
    { message: "Workbook could not be parsed." }
  );

  assert.equal(previewRequestCount, 0);
}
