export type ImportProcessingStatus = "PENDING" | "PROCESSING";

interface PollImportStatusOptions<TStatus extends { status: string }> {
  fetchStatus: () => Promise<TStatus>;
  onStatus?: (status: TStatus) => void;
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
}

interface LoadQueuedImportPreviewOptions<
  TStatus extends {
    failureReason: string | null;
    hasPreviewResult: boolean;
    status: string;
  },
  TPreview
> {
  enqueue: () => Promise<{ batchId: string; status: "PENDING" }>;
  fetchPreview: (batchId: string) => Promise<TPreview>;
  fetchStatus: (batchId: string) => Promise<TStatus>;
  fallbackFailureMessage: string;
  importLabel: string;
  isPreviewReadyStatus: (status: string) => boolean;
  onProcessingStatus: (
    batchId: string,
    status: ImportProcessingStatus
  ) => void;
  signal: AbortSignal;
}

const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_POLL_TIMEOUT_MS = 10 * 60 * 1_000;

export function isImportProcessingStatus(
  status: string
): status is ImportProcessingStatus {
  return status === "PENDING" || status === "PROCESSING";
}

export async function pollImportStatus<TStatus extends { status: string }>({
  fetchStatus,
  onStatus,
  signal,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS
}: PollImportStatusOptions<TStatus>): Promise<TStatus> {
  const startedAt = Date.now();

  while (true) {
    assertImportPollingActive(signal);

    const status = await fetchStatus();
    assertImportPollingActive(signal);
    onStatus?.(status);

    if (!isImportProcessingStatus(status.status)) {
      return status;
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        "Processing is taking longer than expected. Try checking the import again."
      );
    }

    await wait(intervalMs, signal);
  }
}

export async function loadQueuedImportPreview<
  TStatus extends {
    failureReason: string | null;
    hasPreviewResult: boolean;
    status: string;
  },
  TPreview
>({
  enqueue,
  fetchPreview,
  fetchStatus,
  fallbackFailureMessage,
  importLabel,
  isPreviewReadyStatus,
  onProcessingStatus,
  signal
}: LoadQueuedImportPreviewOptions<TStatus, TPreview>): Promise<TPreview> {
  const queuedImport = await enqueue();
  assertImportPollingActive(signal);
  onProcessingStatus(queuedImport.batchId, queuedImport.status);

  const terminalStatus = await pollImportStatus({
    fetchStatus: () => fetchStatus(queuedImport.batchId),
    onStatus: (status) => {
      if (isImportProcessingStatus(status.status)) {
        onProcessingStatus(queuedImport.batchId, status.status);
      }
    },
    signal
  });
  assertPreviewReadyTerminalStatus(terminalStatus, {
    fallbackFailureMessage,
    importLabel,
    isPreviewReadyStatus
  });

  const preview = await fetchPreview(queuedImport.batchId);
  assertImportPollingActive(signal);
  return preview;
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function assertImportPollingActive(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(createAbortError());
    };
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function createAbortError() {
  const error = new Error("Import polling was cancelled.");
  error.name = "AbortError";
  return error;
}

function assertPreviewReadyTerminalStatus(
  terminalStatus: {
    failureReason: string | null;
    hasPreviewResult: boolean;
    status: string;
  },
  options: {
    fallbackFailureMessage: string;
    importLabel: string;
    isPreviewReadyStatus: (status: string) => boolean;
  }
) {
  if (
    options.isPreviewReadyStatus(terminalStatus.status) ||
    (terminalStatus.status === "FAILED" && terminalStatus.hasPreviewResult)
  ) {
    return;
  }

  if (terminalStatus.status === "FAILED" && !terminalStatus.hasPreviewResult) {
    throw new Error(
      terminalStatus.failureReason ?? options.fallbackFailureMessage
    );
  }

  throw new Error(
    `${options.importLabel} stopped with status ${terminalStatus.status}.`
  );
}
