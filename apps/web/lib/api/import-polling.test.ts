import assert from "node:assert/strict";

import { loadQueuedImportPreview, pollImportStatus } from "./import-polling";

interface TestStatus {
  status: "PENDING" | "PROCESSING" | "VALIDATED";
}

void run();

async function run() {
  await testPendingImportStopsAtTerminalStatus();
  await testCancelledImportStopsPolling();
  await testPollingTimeoutShowsFailure();
  await testValidatedImportLoadsPreview();
  await testNeedsReviewImportLoadsPreview();
  await testFailedImportWithPreviewLoadsPreview();
  await testFailedImportWithoutPreviewShowsFailure();
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

async function testPollingTimeoutShowsFailure() {
  await assert.rejects(
    pollImportStatus({
      fetchStatus: async () => ({ status: "PENDING" }),
      intervalMs: 0,
      timeoutMs: 0
    }),
    {
      message:
        "Processing is taking longer than expected. Try checking the import again."
    }
  );
}

async function testValidatedImportLoadsPreview() {
  const preview = await loadPreviewForTerminalStatus({
    hasPreviewResult: true,
    status: "VALIDATED"
  });

  assert.deepEqual(preview, { batchId: "batch-1", rowCount: 12 });
}

async function testNeedsReviewImportLoadsPreview() {
  const preview = await loadPreviewForTerminalStatus({
    hasPreviewResult: true,
    status: "NEEDS_REVIEW"
  });

  assert.deepEqual(preview, { batchId: "batch-1", rowCount: 12 });
}

async function testFailedImportWithPreviewLoadsPreview() {
  const preview = await loadPreviewForTerminalStatus({
    failureReason: "Workbook has row-level validation errors.",
    hasPreviewResult: true,
    status: "FAILED"
  });

  assert.deepEqual(preview, { batchId: "batch-1", rowCount: 12 });
}

async function testFailedImportWithoutPreviewShowsFailure() {
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
        hasPreviewResult: false,
        status: "FAILED"
      }),
      importLabel: "Orders KPI import",
      isPreviewReadyStatus: (status) =>
        status === "VALIDATED" || status === "NEEDS_REVIEW",
      onProcessingStatus: () => undefined,
      signal: controller.signal
    }),
    { message: "Workbook could not be parsed." }
  );

  assert.equal(previewRequestCount, 0);
}

async function loadPreviewForTerminalStatus(terminalStatus: {
  failureReason?: string | null;
  hasPreviewResult: boolean;
  status: "FAILED" | "NEEDS_REVIEW" | "VALIDATED";
}) {
  const controller = new AbortController();
  const processingStatuses: string[] = [];

  const preview = await loadQueuedImportPreview({
    enqueue: async () => ({ batchId: "batch-1", status: "PENDING" }),
    fallbackFailureMessage: "Validation failed.",
    fetchPreview: async (batchId) => ({ batchId, rowCount: 12 }),
    fetchStatus: async () => ({
      failureReason: terminalStatus.failureReason ?? null,
      hasPreviewResult: terminalStatus.hasPreviewResult,
      status: terminalStatus.status
    }),
    importLabel: "Orders KPI import",
    isPreviewReadyStatus: (status) =>
      status === "VALIDATED" || status === "NEEDS_REVIEW",
    onProcessingStatus: (_batchId, status) =>
      processingStatuses.push(status),
    signal: controller.signal
  });

  assert.deepEqual(processingStatuses, ["PENDING"]);
  return preview;
}
