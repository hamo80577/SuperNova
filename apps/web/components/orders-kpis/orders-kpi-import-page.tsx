"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  XCircle
} from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ordersKpisApi,
  type OrdersKpiConfirmReplaceResponse,
  type OrdersKpiImportBatchStatus,
  type OrdersKpiPreviewIssue,
  type OrdersKpiPreviewResponse,
  type OrdersKpiPreviewRow,
  type OrdersKpiRejectImportResponse
} from "@/lib/api/orders-kpis";

type AsyncStatus = "idle" | "loading" | "success" | "error";
type PreviewFilter =
  | "ALL"
  | "BLOCKED"
  | "WARNINGS"
  | "UNMAPPED_VENDOR"
  | "UNMATCHED_PICKER"
  | "UNKNOWN_PICKER";
type DialogMode = "confirm" | "reject" | null;

const previewFilters: Array<{ label: string; value: PreviewFilter }> = [
  { label: "All preview rows", value: "ALL" },
  { label: "Blocked rows", value: "BLOCKED" },
  { label: "Warning rows", value: "WARNINGS" },
  { label: "Unmapped vendors", value: "UNMAPPED_VENDOR" },
  { label: "Unmatched pickers", value: "UNMATCHED_PICKER" },
  { label: "Unknown pickers", value: "UNKNOWN_PICKER" }
];

const numberFormatter = new Intl.NumberFormat("en-US");

export function OrdersKpiImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OrdersKpiPreviewResponse | null>(null);
  const [previewStatus, setPreviewStatus] = useState<AsyncStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("ALL");
  const [confirmStatus, setConfirmStatus] = useState<AsyncStatus>("idle");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] =
    useState<OrdersKpiConfirmReplaceResponse | null>(null);
  const [rejectStatus, setRejectStatus] = useState<AsyncStatus>("idle");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectResult, setRejectResult] =
    useState<OrdersKpiRejectImportResponse | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [acknowledgeReplaceDates, setAcknowledgeReplaceDates] = useState(false);
  const [acknowledgeSkippedRows, setAcknowledgeSkippedRows] = useState(false);

  const filteredPreviewRows = useMemo(() => {
    if (!preview) {
      return [];
    }

    return preview.previewRows.filter((row) => matchesPreviewFilter(row, previewFilter));
  }, [preview, previewFilter]);

  const batch = preview?.batch ?? null;
  const needsReview = batch?.status === "NEEDS_REVIEW";
  const canConfirmBatch =
    Boolean(batch) &&
    !confirmResult &&
    !rejectResult &&
    (batch?.status === "VALIDATED" || batch?.status === "NEEDS_REVIEW") &&
    (batch?.confirmableRows ?? 0) > 0;
  const confirmDialogReady =
    acknowledgeReplaceDates && (!needsReview || acknowledgeSkippedRows);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreview(null);
    setPreviewError(null);
    setConfirmResult(null);
    setRejectResult(null);
    setConfirmError(null);
    setRejectError(null);
  }

  async function handlePreview() {
    if (!file) {
      setPreviewError("Choose an Orders KPI file before preview.");
      setPreviewStatus("error");
      return;
    }

    setPreviewStatus("loading");
    setPreviewError(null);
    setConfirmResult(null);
    setRejectResult(null);
    setConfirmError(null);
    setRejectError(null);

    try {
      const response = await ordersKpisApi.previewImport(file);
      setPreview(response);
      setPreviewFilter("ALL");
      setPreviewStatus("success");
    } catch (error) {
      setPreviewError(getErrorMessage(error));
      setPreviewStatus("error");
    }
  }

  async function handleConfirm() {
    if (!batch || !canConfirmBatch || !confirmDialogReady) {
      return;
    }

    setConfirmStatus("loading");
    setConfirmError(null);

    try {
      const response = await ordersKpisApi.confirmReplaceImport(batch.id, {
        acknowledgeReplaceDates: true,
        acknowledgeSkippedErrorRows: needsReview ? true : undefined,
        approveValidRowsOnly: needsReview ? true : undefined
      });
      setConfirmResult(response);
      setConfirmStatus("success");
      closeDialog();
    } catch (error) {
      setConfirmError(getErrorMessage(error));
      setConfirmStatus("error");
    }
  }

  async function handleReject() {
    if (!batch || confirmResult || rejectResult) {
      return;
    }

    setRejectStatus("loading");
    setRejectError(null);

    try {
      const response = await ordersKpisApi.rejectImport(batch.id, {
        reason: rejectReason.trim() || null
      });
      setRejectResult(response);
      setRejectStatus("success");
      closeDialog();
    } catch (error) {
      setRejectError(getErrorMessage(error));
      setRejectStatus("error");
    }
  }

  function openConfirmDialog() {
    setAcknowledgeReplaceDates(false);
    setAcknowledgeSkippedRows(false);
    setDialogMode("confirm");
  }

  function openRejectDialog() {
    setRejectReason("");
    setDialogMode("reject");
  }

  function closeDialog() {
    setDialogMode(null);
    setAcknowledgeReplaceDates(false);
    setAcknowledgeSkippedRows(false);
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-slate-50/80 p-3 sm:p-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">FULL_DAILY_SNAPSHOT</Badge>
              <Badge variant="outline">Preview before confirm</Badge>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-normal text-slate-950">
              Orders KPI Import
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Upload the daily Orders KPI file, review matched rows and validation issues, then confirm replacement for the covered dates.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            href="/admin/reports/orders-kpi"
          >
            Open report
          </Link>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Confirm replaces existing confirmed Orders KPI records only for the dates in this file. Rows with blocking errors are skipped when a review batch is approved.
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-h-28 cursor-pointer flex-col justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 transition hover:border-primary/40 hover:bg-white">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <UploadCloud className="h-5 w-5 text-primary" />
              Upload Orders KPI file
            </span>
            <span className="mt-2 text-sm text-slate-500">
              {file ? file.name : "Choose .xlsx or .csv file"}
            </span>
            <input
              accept=".xlsx,.csv"
              className="sr-only"
              onChange={handleFileChange}
              type="file"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              className="h-12 gap-2 rounded-xl"
              disabled={previewStatus === "loading" || !file}
              onClick={handlePreview}
              type="button"
            >
              {previewStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Preview file
            </Button>
            <Button
              className="h-12 gap-2 rounded-xl"
              disabled={!file && !preview}
              onClick={() => {
                setFile(null);
                setPreview(null);
                setPreviewStatus("idle");
                setPreviewError(null);
                setConfirmResult(null);
                setRejectResult(null);
              }}
              type="button"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {previewError ? <InlineError message={previewError} title="Preview failed" /> : null}
      </section>

      {preview ? (
        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
          <PreviewHeader preview={preview} />
          <PreviewSummary preview={preview} />

          {confirmResult ? <ConfirmSuccess result={confirmResult} /> : null}
          {rejectResult ? <RejectSuccess result={rejectResult} /> : null}
          {confirmError ? <InlineError message={confirmError} title="Confirm failed" /> : null}
          {rejectError ? <InlineError message={rejectError} title="Reject failed" /> : null}

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Preview rows</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Showing {filteredPreviewRows.length} of {preview.previewRows.length} rows.
                  </p>
                </div>
                <Select
                  className="rounded-xl"
                  onChange={(event) => setPreviewFilter(event.target.value as PreviewFilter)}
                  value={previewFilter}
                  wrapperClassName="w-full sm:w-64"
                >
                  {previewFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </Select>
              </div>

              <PreviewRows rows={filteredPreviewRows} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-950">Review decision</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {getDecisionCopy(batch?.status)}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {batch?.status === "FAILED" ? (
                  <Badge className="justify-center border-red-200 bg-red-50 text-red-700" variant="outline">
                    Upload a corrected file
                  </Badge>
                ) : null}
                <Button
                  className="h-11 gap-2 rounded-xl"
                  disabled={!canConfirmBatch || confirmStatus === "loading"}
                  onClick={openConfirmDialog}
                  type="button"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {needsReview
                    ? "Approve valid rows only"
                    : "Confirm & replace dates"}
                </Button>
                <Button
                  className="h-11 gap-2 rounded-xl"
                  disabled={!batch || Boolean(confirmResult || rejectResult) || rejectStatus === "loading"}
                  onClick={openRejectDialog}
                  type="button"
                  variant="outline"
                >
                  <XCircle className="h-4 w-4" />
                  Reject review
                </Button>
              </div>
            </div>
          </div>

          <IssueDetails issues={preview.issues} />
        </section>
      ) : null}

      {dialogMode === "confirm" && batch ? (
        <ConfirmDialog
          acknowledgeReplaceDates={acknowledgeReplaceDates}
          acknowledgeSkippedRows={acknowledgeSkippedRows}
          confirmStatus={confirmStatus}
          disabled={!confirmDialogReady || confirmStatus === "loading"}
          error={confirmError}
          needsReview={needsReview}
          onAcknowledgeReplaceDatesChange={setAcknowledgeReplaceDates}
          onAcknowledgeSkippedRowsChange={setAcknowledgeSkippedRows}
          onClose={closeDialog}
          onConfirm={handleConfirm}
          preview={preview}
        />
      ) : null}

      {dialogMode === "reject" && batch ? (
        <RejectDialog
          error={rejectError}
          onClose={closeDialog}
          onReasonChange={setRejectReason}
          onReject={handleReject}
          reason={rejectReason}
          rejectStatus={rejectStatus}
        />
      ) : null}
    </div>
  );
}

function PreviewHeader({ preview }: { preview: OrdersKpiPreviewResponse }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={preview.batch.status} />
          {preview.batch.requiresReviewDecision ? (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
              Review decision required
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-950">
          {preview.batch.fileName}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Dates: {formatDateRange(preview.batch.coveredDateFrom, preview.batch.coveredDateTo)}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-950">Batch ID</p>
        <p className="mt-1 break-all text-xs text-slate-500">{preview.batch.id}</p>
      </div>
    </div>
  );
}

function PreviewSummary({ preview }: { preview: OrdersKpiPreviewResponse }) {
  const cards = [
    { label: "Rows", value: preview.batch.rowCount },
    { label: "Confirmable", value: preview.batch.confirmableRows },
    { label: "Blocking errors", value: preview.batch.errorRows },
    { label: "Warnings", value: preview.batch.warningRows },
    { label: "Unmapped vendors", value: preview.summary.unmappedVendorRows },
    { label: "Unmatched shoppers", value: preview.summary.unmatchedShopperRows }
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
          key={card.label}
        >
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatNumber(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function PreviewRows({ rows }: { rows: OrdersKpiPreviewRow[] }) {
  if (!rows.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No preview rows match this filter.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <div className="max-h-[520px] overflow-auto">
        <table className="hidden min-w-full divide-y divide-slate-200 text-sm lg:table">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-3 py-3">Row</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Vendor</th>
              <th className="px-3 py-3">Shopper</th>
              <th className="px-3 py-3">Orders</th>
              <th className="px-3 py-3">Issues</th>
              <th className="px-3 py-3">Confirmable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={`${row.rawRowNumber}-${row.sourceShopperId ?? "unknown"}`}>
                <td className="px-3 py-3 font-medium text-slate-950">{row.rawRowNumber}</td>
                <td className="px-3 py-3 text-slate-600">{row.kpiDate ?? "N/A"}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">{row.vendorLabel}</p>
                  <p className="text-xs text-slate-500">{row.sourceVendorId ?? "N/A"}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">{row.pickerLabel}</p>
                  <p className="text-xs text-slate-500">{row.sourceShopperId ?? "N/A"}</p>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatNumber(row.totalOrders ?? 0)}</td>
                <td className="px-3 py-3 text-slate-600">{formatNumber(row.issuesCount)}</td>
                <td className="px-3 py-3">
                  <ConfirmableBadge confirmable={row.confirmable} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-slate-100 bg-white lg:hidden">
          {rows.map((row) => (
            <div className="p-4" key={`${row.rawRowNumber}-${row.sourceShopperId ?? "unknown"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Row {row.rawRowNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.kpiDate ?? "N/A"}</p>
                </div>
                <ConfirmableBadge confirmable={row.confirmable} />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">Vendor:</span>{" "}
                  {row.vendorLabel}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Shopper:</span>{" "}
                  {row.pickerLabel}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Orders:</span>{" "}
                  {formatNumber(row.totalOrders ?? 0)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Issues:</span>{" "}
                  {formatNumber(row.issuesCount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IssueDetails({ issues }: { issues: OrdersKpiPreviewIssue[] }) {
  if (!issues.length) {
    return null;
  }

  const visibleIssues = issues.slice(0, 30);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">Issue details</p>
          <p className="mt-1 text-xs text-slate-500">
            Showing first {visibleIssues.length} of {issues.length} issues.
          </p>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="max-h-80 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
              <tr>
                <th className="px-3 py-3">Row</th>
                <th className="px-3 py-3">Severity</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleIssues.map((issue, index) => (
                <tr key={`${issue.issueCode}-${issue.rowNumber ?? "file"}-${index}`}>
                  <td className="px-3 py-3 text-slate-600">{issue.rowNumber ?? "File"}</td>
                  <td className="px-3 py-3">
                    <Badge
                      className={cn(
                        issue.severity === "ERROR"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      )}
                      variant="outline"
                    >
                      {issue.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{formatIssueCode(issue.issueCode)}</td>
                  <td className="px-3 py-3 text-slate-600">{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  acknowledgeReplaceDates,
  acknowledgeSkippedRows,
  confirmStatus,
  disabled,
  error,
  needsReview,
  onAcknowledgeReplaceDatesChange,
  onAcknowledgeSkippedRowsChange,
  onClose,
  onConfirm,
  preview
}: {
  acknowledgeReplaceDates: boolean;
  acknowledgeSkippedRows: boolean;
  confirmStatus: AsyncStatus;
  disabled: boolean;
  error: string | null;
  needsReview: boolean;
  onAcknowledgeReplaceDatesChange: (value: boolean) => void;
  onAcknowledgeSkippedRowsChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  preview: OrdersKpiPreviewResponse | null;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
        <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-950">
                {needsReview ? "Approve valid rows only" : "Confirm replacement"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This writes confirmed Orders KPI records and replaces existing records for the covered dates.
              </p>
            </div>
            <button
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
            >
              <XCircle className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-950">Dates:</span>{" "}
              {formatDateList(preview?.batch.coveredDates ?? [])}
            </p>
            <p className="mt-2">
              <span className="font-semibold text-slate-950">Rows to confirm:</span>{" "}
              {formatNumber(preview?.batch.confirmableRows ?? 0)}
            </p>
            {needsReview ? (
              <p className="mt-2">
                <span className="font-semibold text-slate-950">Rows skipped:</span>{" "}
                {formatNumber(preview?.batch.errorRows ?? 0)}
              </p>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
              <input
                checked={acknowledgeReplaceDates}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary"
                onChange={(event) => onAcknowledgeReplaceDatesChange(event.target.checked)}
                type="checkbox"
              />
              I understand confirmed records for the covered dates will be replaced.
            </label>
            {needsReview ? (
              <label className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                <input
                  checked={acknowledgeSkippedRows}
                  className="mt-1 h-4 w-4 rounded border-amber-300 text-primary"
                  onChange={(event) => onAcknowledgeSkippedRowsChange(event.target.checked)}
                  type="checkbox"
                />
                I understand rows with blocking errors will be skipped and only valid rows will be imported.
              </label>
            ) : null}
          </div>

          {error ? <InlineError message={error} title="Confirm failed" /> : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="rounded-xl" onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="gap-2 rounded-xl"
              disabled={disabled}
              onClick={onConfirm}
              type="button"
            >
              {confirmStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm import
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function RejectDialog({
  error,
  onClose,
  onReasonChange,
  onReject,
  reason,
  rejectStatus
}: {
  error: string | null;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onReject: () => void;
  reason: string;
  rejectStatus: AsyncStatus;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
        <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-950">Reject review</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Rejection writes no confirmed Orders KPI daily records for this batch.
              </p>
            </div>
            <button
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
            >
              <XCircle className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="orders-kpi-reject-reason">
            Reason
          </label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary/35 focus:ring-2 focus:ring-primary/15"
            id="orders-kpi-reject-reason"
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Optional"
            value={reason}
          />

          {error ? <InlineError message={error} title="Reject failed" /> : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="rounded-xl" onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="gap-2 rounded-xl"
              disabled={rejectStatus === "loading"}
              onClick={onReject}
              type="button"
            >
              {rejectStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject batch
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function ConfirmSuccess({ result }: { result: OrdersKpiConfirmReplaceResponse }) {
  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Import confirmed</p>
          <p className="mt-1">
            Inserted {formatNumber(result.insertedRecords)} rows and replaced {formatNumber(result.deletedRecords)} existing rows. Skipped {formatNumber(result.skippedRows)} invalid rows.
          </p>
          <Link className="mt-2 inline-flex font-semibold underline" href="/admin/reports/orders-kpi">
            Open Orders KPI Report
          </Link>
        </div>
      </div>
    </div>
  );
}

function RejectSuccess({ result }: { result: OrdersKpiRejectImportResponse }) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <p className="font-semibold text-slate-950">Batch rejected</p>
      <p className="mt-1">
        No confirmed Orders KPI daily records were written for batch {result.batchId}.
      </p>
    </div>
  );
}

function InlineError({ message, title }: { message: string; title: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrdersKpiImportBatchStatus }) {
  return (
    <Badge className={getStatusClassName(status)} variant="outline">
      {getStatusLabel(status)}
    </Badge>
  );
}

function ConfirmableBadge({ confirmable }: { confirmable: boolean }) {
  return (
    <Badge
      className={
        confirmable
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }
      variant="outline"
    >
      {confirmable ? "Yes" : "No"}
    </Badge>
  );
}

function matchesPreviewFilter(row: OrdersKpiPreviewRow, filter: PreviewFilter) {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "BLOCKED") {
    return !row.confirmable;
  }

  if (filter === "WARNINGS") {
    return row.confirmable && row.issuesCount > 0;
  }

  if (filter === "UNMAPPED_VENDOR") {
    return row.vendorMatchStatus === "UNMAPPED_VENDOR_ID";
  }

  if (filter === "UNMATCHED_PICKER") {
    return (
      row.pickerMatchStatus === "UNMATCHED_SHOPPER_ID" ||
      row.pickerMatchStatus === "MATCHED_USER_NOT_PICKER"
    );
  }

  return row.pickerMatchStatus === "UNKNOWN_PICKER";
}

function getDecisionCopy(status: OrdersKpiImportBatchStatus | undefined) {
  if (status === "VALIDATED") {
    return "All rows are ready for confirm-replace.";
  }

  if (status === "NEEDS_REVIEW") {
    return "Valid rows can be approved only after acknowledging skipped error rows.";
  }

  if (status === "FAILED") {
    return "The preview could not be created because the file failed parsing or system validation.";
  }

  if (status === "CONFIRMED") {
    return "This batch has already been confirmed.";
  }

  if (status === "REJECTED") {
    return "This batch has already been rejected.";
  }

  return "Preview a file before selecting a review decision.";
}

function getStatusLabel(status: OrdersKpiImportBatchStatus) {
  const labels: Record<OrdersKpiImportBatchStatus, string> = {
    CONFIRMED: "Confirmed",
    FAILED: "Failed",
    NEEDS_REVIEW: "Needs Review",
    REJECTED: "Rejected",
    VALIDATED: "Ready to Confirm"
  };

  return labels[status];
}

function getStatusClassName(status: OrdersKpiImportBatchStatus) {
  if (status === "VALIDATED" || status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "NEEDS_REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "FAILED") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDateRange(dateFrom: string | null, dateTo: string | null) {
  if (!dateFrom && !dateTo) {
    return "No covered dates";
  }

  if (dateFrom && dateTo && dateFrom !== dateTo) {
    return `${dateFrom} to ${dateTo}`;
  }

  return dateFrom ?? dateTo ?? "No covered dates";
}

function formatDateList(dates: string[]) {
  if (!dates.length) {
    return "No covered dates";
  }

  if (dates.length <= 4) {
    return dates.join(", ");
  }

  return `${dates.slice(0, 4).join(", ")} and ${dates.length - 4} more`;
}

function formatIssueCode(code: string) {
  return code
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Orders KPI import error.";
}
