"use client";

import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  UploadCloud,
  X
} from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ordersKpisApi,
  type OrdersKpiImportConfirmResponse,
  type OrdersKpiImportPreviewResponse,
  type OrdersKpiImportRejectResponse,
  type OrdersKpiPreviewIssue
} from "@/lib/api/orders-kpis";
import { cn } from "@/lib/utils";

import {
  canApproveOrdersKpiReview,
  groupOrdersKpiImportIssues,
  type OrdersKpiIssueGroup
} from "./orders-kpis-import-review";

type ActionState =
  | { status: "idle"; error?: never; action?: never }
  | { status: "loading"; action: "preview" | "confirm" | "approve" | "reject"; error?: never }
  | { status: "error"; error: string; action?: never };

type DecisionState =
  | { status: "idle"; data?: never }
  | { status: "confirmed"; data: OrdersKpiImportConfirmResponse }
  | { status: "rejected"; data: OrdersKpiImportRejectResponse };

const issuePreviewLimit = 20;

export function OrdersKpisImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] =
    useState<OrdersKpiImportPreviewResponse | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle"
  });
  const [decisionState, setDecisionState] = useState<DecisionState>({
    status: "idle"
  });
  const selectedFileLabel = file
    ? `${file.name} (${formatFileSize(file.size)})`
    : "No file selected";
  const isBusy = actionState.status === "loading";
  const canApprove = canApproveOrdersKpiReview({
    acknowledged,
    actionPending: isBusy || decisionState.status !== "idle",
    preview
  });
  const canConfirm =
    Boolean(preview?.batchId && preview.canConfirm) &&
    !isBusy &&
    decisionState.status === "idle";
  const canReject =
    Boolean(preview?.batchId && preview.canReject) &&
    !isBusy &&
    decisionState.status === "idle";
  const groupedIssues = useMemo(
    () => groupOrdersKpiImportIssues(preview?.preview.issues ?? []),
    [preview]
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    resetReviewState();
  }

  async function handlePreview() {
    if (!file) {
      setActionState({
        status: "error",
        error: "Choose a CSV or XLSX Orders KPI sheet before previewing."
      });
      return;
    }

    setActionState({ status: "loading", action: "preview" });
    setDecisionState({ status: "idle" });
    setAcknowledged(false);

    try {
      const result = await ordersKpisApi.previewImport(file);
      setPreview(result);
      setActionState({ status: "idle" });
    } catch (error) {
      setPreview(null);
      setActionState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview Orders KPI import."
      });
    }
  }

  async function handleConfirm() {
    if (!preview?.batchId || !preview.canConfirm) {
      return;
    }

    setActionState({ status: "loading", action: "confirm" });

    try {
      const result = await ordersKpisApi.confirmImport(preview.batchId);
      setDecisionState({ status: "confirmed", data: result });
      setActionState({ status: "idle" });
      clearSelectedFile();
    } catch (error) {
      setActionState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm Orders KPI import."
      });
    }
  }

  async function handleApproveValidRows() {
    if (!preview?.batchId || !canApprove) {
      return;
    }

    setActionState({ status: "loading", action: "approve" });

    try {
      const result = await ordersKpisApi.approveValidRows(preview.batchId, {
        acknowledgeSkippedErrorRows: true
      });
      setDecisionState({ status: "confirmed", data: result });
      setActionState({ status: "idle" });
      clearSelectedFile();
    } catch (error) {
      setActionState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to approve valid Orders KPI rows."
      });
    }
  }

  async function handleReject() {
    if (!preview?.batchId || !preview.canReject) {
      return;
    }

    setActionState({ status: "loading", action: "reject" });

    try {
      const result = await ordersKpisApi.rejectImport(preview.batchId);
      setDecisionState({ status: "rejected", data: result });
      setActionState({ status: "idle" });
      clearSelectedFile();
    } catch (error) {
      setActionState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to reject Orders KPI review."
      });
    }
  }

  function clearAll() {
    setFile(null);
    setFileInputKey((current) => current + 1);
    resetReviewState();
  }

  function clearSelectedFile() {
    setFile(null);
    setFileInputKey((current) => current + 1);
  }

  function resetReviewState() {
    setPreview(null);
    setAcknowledged(false);
    setActionState({ status: "idle" });
    setDecisionState({ status: "idle" });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">
              Orders KPI Imports
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Upload a picker Orders KPI sheet, preview backend validation, then
              confirm clean rows or explicitly approve valid rows from a review batch.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={clearAll}
            type="button"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset import
          </Button>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="grid min-w-0 content-start gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <SectionHeading
              description="Preview writes only staging rows. Confirmed daily report rows are written only after a final decision."
              icon={<UploadCloud className="h-5 w-5" />}
              title="Upload and preview"
            />

            <label className="grid min-h-36 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center transition hover:border-primary/40 hover:bg-primary/5">
              <input
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                key={fileInputKey}
                onChange={handleFileChange}
                type="file"
              />
              <span className="grid gap-2">
                <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" />
                <span className="break-words text-sm font-semibold text-slate-950">
                  {selectedFileLabel}
                </span>
                <span className="text-xs leading-5 text-slate-500">
                  CSV or XLSX. Backend preview errors are shown before any import decision.
                </span>
              </span>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                disabled={isBusy}
                onClick={handlePreview}
                type="button"
              >
                {actionState.status === "loading" &&
                actionState.action === "preview" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Preview file
              </Button>
              <Button
                disabled={isBusy}
                onClick={clearAll}
                type="button"
                variant="outline"
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>

            {actionState.status === "error" ? (
              <InlineAlert message={actionState.error} tone="danger" />
            ) : null}

            {decisionState.status === "confirmed" ? (
              <ImportResult result={decisionState.data} />
            ) : null}

            {decisionState.status === "rejected" ? (
              <InlineAlert
                message="Import review rejected. No confirmed rows were written."
                tone="neutral"
              />
            ) : null}
          </section>

          <PreviewPanel
            acknowledged={acknowledged}
            canApprove={canApprove}
            canConfirm={canConfirm}
            canReject={canReject}
            groupedIssues={groupedIssues}
            isApproving={
              actionState.status === "loading" && actionState.action === "approve"
            }
            isConfirming={
              actionState.status === "loading" && actionState.action === "confirm"
            }
            isRejecting={
              actionState.status === "loading" && actionState.action === "reject"
            }
            onAcknowledgeChange={setAcknowledged}
            onApproveValidRows={handleApproveValidRows}
            onConfirm={handleConfirm}
            onReject={handleReject}
            preview={preview}
          />
        </div>
      </section>
    </div>
  );
}

function PreviewPanel({
  acknowledged,
  canApprove,
  canConfirm,
  canReject,
  groupedIssues,
  isApproving,
  isConfirming,
  isRejecting,
  onAcknowledgeChange,
  onApproveValidRows,
  onConfirm,
  onReject,
  preview
}: {
  acknowledged: boolean;
  canApprove: boolean;
  canConfirm: boolean;
  canReject: boolean;
  groupedIssues: ReturnType<typeof groupOrdersKpiImportIssues>;
  isApproving: boolean;
  isConfirming: boolean;
  isRejecting: boolean;
  onAcknowledgeChange: (value: boolean) => void;
  onApproveValidRows: () => void;
  onConfirm: () => void;
  onReject: () => void;
  preview: OrdersKpiImportPreviewResponse | null;
}) {
  if (!preview) {
    return (
      <section className="grid min-h-80 place-items-center rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
        <div>
          <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-950">
            No preview loaded
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            Preview an Orders KPI sheet to inspect clean rows, skipped error
            rows, warnings, and date coverage before making an import decision.
          </p>
        </div>
      </section>
    );
  }

  const isReview = preview.status === "NEEDS_REVIEW";
  const visibleIssues = preview.preview.issues.slice(0, issuePreviewLimit);

  return (
    <section className="grid min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          description="Confirmed report rows are not written until one of these actions succeeds."
          icon={<ClipboardList className="h-5 w-5" />}
          title="Preview decision"
        />
        <StatusBadge status={preview.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Definition label="Rows" value={preview.preview.rowCount} />
        <Definition label="Valid rows ready" value={preview.stagingRowCount} />
        <Definition label="Skipped error rows" value={preview.skippedErrorRows} />
        <Definition label="Blocking errors" value={preview.preview.errorRows} />
        <Definition label="Warnings" value={preview.preview.warningRows} />
        <Definition label="Matched rows" value={preview.preview.matchedRows} />
        <Definition label="Date from" value={formatDate(preview.preview.dateFrom)} />
        <Definition label="Date to" value={formatDate(preview.preview.dateTo)} />
      </div>

      {isReview ? (
        <InlineAlert
          message="This file has row-level blocking errors. Valid staging rows are available, but error rows will be skipped unless the file is rejected."
          tone="warning"
        />
      ) : null}

      <IssueSummary
        groups={groupedIssues.blocking}
        title="Blocking errors"
        tone="danger"
      />
      <IssueSummary
        groups={groupedIssues.warnings}
        title="Warnings"
        tone="warning"
      />
      <IssuesTable issues={visibleIssues} totalCount={preview.preview.issues.length} />

      {isReview ? (
        <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <input
            checked={acknowledged}
            className="mt-1 h-4 w-4 rounded border-amber-300"
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            I understand that rows with blocking errors will be skipped and only
            valid rows will be imported.
          </span>
        </label>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          disabled={!canConfirm}
          onClick={onConfirm}
          type="button"
        >
          {isConfirming ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Confirm import
        </Button>
        <Button
          disabled={!canApprove}
          onClick={onApproveValidRows}
          type="button"
          variant="outline"
        >
          {isApproving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="mr-2 h-4 w-4" />
          )}
          Approve valid rows only
        </Button>
        <Button
          disabled={!canReject}
          onClick={onReject}
          type="button"
          variant="outline"
        >
          {isRejecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Ban className="mr-2 h-4 w-4" />
          )}
          Reject review
        </Button>
      </div>
    </section>
  );
}

function IssueSummary({
  groups,
  title,
  tone
}: {
  groups: OrdersKpiIssueGroup[];
  title: string;
  tone: "danger" | "warning";
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="grid gap-2">
        {groups.map((group) => (
          <div
            className={cn(
              "rounded-lg border p-3",
              tone === "danger"
                ? "border-red-200 bg-red-50 text-red-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            )}
            key={`${group.severity}-${group.issueCode}`}
          >
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm font-semibold">{group.label}</p>
              <Badge
                className={cn(
                  tone === "danger"
                    ? "border-red-200 bg-white text-red-700"
                    : "border-amber-200 bg-white text-amber-700"
                )}
                variant="outline"
              >
                {group.count} rows
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5">{group.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IssuesTable({
  issues,
  totalCount
}: {
  issues: OrdersKpiPreviewIssue[];
  totalCount: number;
}) {
  if (totalCount === 0) {
    return (
      <InlineAlert
        message="No validation issues returned by the backend."
        tone="success"
      />
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-950">Issue details</h3>
        <p className="text-xs leading-5 text-slate-500">
          Showing first {Math.min(totalCount, issuePreviewLimit)} of {totalCount} issues.
        </p>
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[38%]" />
          </colgroup>
          <thead className="sticky top-0 bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <TableHeader>Row</TableHeader>
              <TableHeader>Shopper ID</TableHeader>
              <TableHeader>Severity</TableHeader>
              <TableHeader>Code</TableHeader>
              <TableHeader>Message</TableHeader>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr
                className="border-b border-slate-100 last:border-0"
                key={`${issue.issueCode}-${issue.rowNumber ?? "batch"}-${index}`}
              >
                <TableCell>{formatNullable(issue.rowNumber)}</TableCell>
                <TableCell>{formatNullable(issue.shopperId)}</TableCell>
                <TableCell>
                  <SeverityBadge severity={issue.severity} />
                </TableCell>
                <TableCell>{formatEnum(issue.issueCode)}</TableCell>
                <TableCell>{issue.message}</TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportResult({ result }: { result: OrdersKpiImportConfirmResponse }) {
  const message = result.approvedWithErrors
    ? "Import approved. Valid rows are now available in Orders KPIs Report. Error rows were skipped."
    : "Import confirmed. Rows are now available in Orders KPIs Report.";

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{message}</p>
          <p className="text-xs">
            Inserted {result.insertedCount}, updated {result.updatedCount}
            {result.skippedErrorRows > 0
              ? `, skipped ${result.skippedErrorRows} error rows`
              : ""}
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function InlineAlert({
  message,
  tone
}: {
  message: string;
  tone: "danger" | "warning" | "success" | "neutral";
}) {
  const icon =
    tone === "danger" ? (
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    ) : tone === "success" ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
    ) : tone === "warning" ? (
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
    ) : (
      <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
    );

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm leading-6",
        tone === "danger" && "border-red-200 bg-red-50 text-red-950",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700"
      )}
    >
      {icon}
      <span>{message}</span>
    </div>
  );
}

function SectionHeading({
  description,
  icon,
  title
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-950">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "VALIDATED" || status === "CONFIRMED"
      ? "success"
      : status === "NEEDS_REVIEW"
        ? "warning"
        : status === "REJECTED"
          ? "neutral"
          : "danger";

  return (
    <Badge
      className={cn(
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700"
      )}
      variant="outline"
    >
      {formatEnum(status)}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      className={cn(
        severity === "ERROR"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      )}
      variant="outline"
    >
      {formatEnum(severity)}
    </Badge>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top text-slate-700">{children}</td>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  return value ?? "No date";
}

function formatNullable(value: number | string | null) {
  return value === null ? "Not provided" : String(value);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
