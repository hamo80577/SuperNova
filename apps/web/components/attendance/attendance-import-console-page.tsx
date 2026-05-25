"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Inbox,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  UploadCloud
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  attendanceApi,
  type AttendanceImportConfirmResponse,
  type AttendanceImportPreviewResponse,
  type AttendanceImportBatchStatus,
  type AttendancePreviewIssue,
  type AttendanceIssueSeverity
} from "@/lib/api/attendance";
import { cn } from "@/lib/utils";

type AsyncActionState =
  | { status: "idle"; error?: never }
  | { status: "loading"; error?: never }
  | { status: "error"; error: string };

type ConfirmState =
  | { status: "idle"; data?: never; error?: never }
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "confirmed"; data: AttendanceImportConfirmResponse; error?: never };

export function AttendanceImportConsolePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadDate, setUploadDate] = useState(defaultUploadDate);
  const [preview, setPreview] =
    useState<AttendanceImportPreviewResponse | null>(null);
  const [previewState, setPreviewState] = useState<AsyncActionState>({
    status: "idle"
  });
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    status: "idle"
  });
  const [fileInputKey, setFileInputKey] = useState(0);

  const selectedFileLabel = file
    ? `${file.name} (${formatFileSize(file.size)})`
    : "No file selected";
  const canConfirm = Boolean(
    preview?.batchId && preview.canConfirm && confirmChecked
  );
  const isPreviewing = previewState.status === "loading";

  async function handlePreview() {
    if (!file) {
      setPreviewState({
        status: "error",
        error: "Choose an MTD Excel file before previewing."
      });
      return;
    }

    setPreviewState({ status: "loading" });
    setConfirmState({ status: "idle" });
    setConfirmChecked(false);

    try {
      const nextPreview = await attendanceApi.previewImport(file, {
        uploadDate
      });
      setPreview(nextPreview);
      setPreviewState({ status: "idle" });
    } catch (error) {
      setPreview(null);
      setPreviewState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview attendance import."
      });
    }
  }

  async function handleConfirm() {
    if (!preview?.batchId || !preview.canConfirm) {
      return;
    }

    setConfirmState({ status: "loading" });

    try {
      const result = await attendanceApi.confirmImport(preview.batchId);
      setConfirmState({ status: "confirmed", data: result });
      setConfirmChecked(false);
    } catch (error) {
      setConfirmState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm attendance import."
      });
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
    setConfirmChecked(false);
    setFileInputKey((current) => current + 1);
  }

  function resetConsole() {
    setFile(null);
    setUploadDate(defaultUploadDate());
    setPreview(null);
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
    setConfirmChecked(false);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Badge
              className="border-orange-200 bg-orange-50 text-orange-700"
              variant="outline"
            >
              Attendance import
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              Attendance Import Console
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Upload MTD Excel from month start through yesterday.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 rounded-xl"
              )}
              href="/admin/reports/attendance"
              prefetch
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Daily report
            </Link>
            <Button
              className="h-11 rounded-xl"
              onClick={resetConsole}
              type="button"
              variant="outline"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <UploadCard
          fileLabel={selectedFileLabel}
          fileInputKey={fileInputKey}
          isPreviewing={isPreviewing}
          onFileChange={handleFileChange}
          onPreview={handlePreview}
          onUploadDateChange={setUploadDate}
          previewError={previewState.status === "error" ? previewState.error : null}
          uploadDate={uploadDate}
        />
        <PreviewStatusCard preview={preview} />
      </section>

      {preview ? (
        <>
          <CoverageCard preview={preview} />
          <CountsSection preview={preview} />
          <IssuesSection issues={preview.preview.issues} />
          <ConfirmSection
            canConfirm={canConfirm}
            checked={confirmChecked}
            confirmState={confirmState}
            onCheckedChange={setConfirmChecked}
            onConfirm={handleConfirm}
            preview={preview}
          />
        </>
      ) : (
        <EmptyConsoleState />
      )}
    </div>
  );
}

function UploadCard({
  fileLabel,
  fileInputKey,
  isPreviewing,
  onFileChange,
  onPreview,
  onUploadDateChange,
  previewError,
  uploadDate
}: {
  fileLabel: string;
  fileInputKey: number;
  isPreviewing: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
  onUploadDateChange: (value: string) => void;
  previewError: string | null;
  uploadDate: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">
            Upload MTD file
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Preview only - this does not activate the batch.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Excel file
          <Input
            accept=".xlsx,.xls"
            className="h-auto rounded-xl py-3"
            key={fileInputKey}
            onChange={onFileChange}
            type="file"
          />
        </label>
        <p className="break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {fileLabel}
        </p>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Upload date
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => onUploadDateChange(event.target.value)}
            type="date"
            value={uploadDate}
          />
        </label>
      </div>

      {previewError ? <InlineError message={previewError} /> : null}

      <Button
        className="mt-4 h-11 w-full rounded-xl sm:w-auto"
        disabled={isPreviewing}
        onClick={onPreview}
        type="button"
      >
        {isPreviewing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        {isPreviewing ? "Previewing" : "Preview file"}
      </Button>
    </section>
  );
}

function PreviewStatusCard({
  preview
}: {
  preview: AttendanceImportPreviewResponse | null;
}) {
  const status = preview?.status ?? "UPLOADED";
  const ready = Boolean(preview?.canConfirm);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-700">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">
            Preview status
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Confirm will replace the current active batch for this month.
          </p>
        </div>
      </div>

      {preview ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Definition label="Batch ID" value={preview.batchId} mono />
          <Definition
            label="Status"
            value={<StatusBadge status={status} />}
          />
          <Definition
            label="Can confirm"
            value={ready ? "Yes" : "No"}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Preview results will appear after the backend validates the file.
        </div>
      )}
    </section>
  );
}

function CoverageCard({
  preview
}: {
  preview: AttendanceImportPreviewResponse;
}) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      <Definition
        label="Period month"
        value={formatMonth(preview.preview.periodMonth)}
      />
      <Definition
        label="Coverage start"
        value={formatDate(preview.preview.coverageStartDate)}
      />
      <Definition
        label="Coverage end"
        value={formatDate(preview.preview.coverageEndDate)}
      />
      <Definition
        label="Expected end"
        value={formatDate(preview.preview.expectedCoverageEndDate)}
      />
    </section>
  );
}

function CountsSection({
  preview
}: {
  preview: AttendanceImportPreviewResponse;
}) {
  const counts = useMemo(
    () => [
      { label: "Rows", value: preview.preview.rowCount },
      { label: "Egypt rows", value: preview.preview.egyptRows },
      {
        label: "Non-Egypt / excluded",
        value: preview.preview.nonEgyptRows
      },
      { label: "Matched Pickers", value: preview.preview.matchedPickerRows },
      { label: "Unmatched", value: preview.preview.unmatchedRows },
      {
        label: "Non-Picker excluded",
        value: preview.preview.excludedNonPickerRows
      },
      { label: "Error rows", value: preview.preview.errorRows },
      { label: "Warning rows", value: preview.preview.warningRows },
      { label: "Daily records", value: preview.dailyRecordCount },
      { label: "Monthly summaries", value: preview.monthlySummaryCount },
      { label: "Issues", value: preview.issueCount }
    ],
    [preview]
  );

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {counts.map((count) => (
        <CountCard key={count.label} label={count.label} value={count.value} />
      ))}
    </section>
  );
}

function IssuesSection({ issues }: { issues: AttendancePreviewIssue[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">Issues</h2>
          <p className="mt-1 text-sm text-slate-500">
            {issues.length} validation and calculation issues
          </p>
        </div>
        <Badge variant={issues.length > 0 ? "outline" : "muted"}>
          {issues.length > 0 ? "Review required" : "No issues"}
        </Badge>
      </div>

      {issues.length === 0 ? (
        <EmptyState message="No validation issues returned by the backend." />
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <TableHeader>Severity</TableHeader>
                  <TableHeader>Issue code</TableHeader>
                  <TableHeader>Row</TableHeader>
                  <TableHeader>Shopper ID</TableHeader>
                  <TableHeader>Field</TableHeader>
                  <TableHeader>Message</TableHeader>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, index) => (
                  <tr className="border-b last:border-0" key={`${issue.issueCode}-${index}`}>
                    <TableCell>
                      <SeverityBadge severity={issue.severity} />
                    </TableCell>
                    <TableCell>{formatEnum(issue.issueCode)}</TableCell>
                    <TableCell>{formatNullable(issue.rowNumber)}</TableCell>
                    <TableCell>{formatText(issue.shopperId)}</TableCell>
                    <TableCell>{formatText(issue.fieldName)}</TableCell>
                    <TableCell>{issue.message}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 xl:hidden">
            {issues.map((issue, index) => (
              <IssueCard issue={issue} key={`${issue.issueCode}-${index}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ConfirmSection({
  canConfirm,
  checked,
  confirmState,
  onCheckedChange,
  onConfirm,
  preview
}: {
  canConfirm: boolean;
  checked: boolean;
  confirmState: ConfirmState;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  preview: AttendanceImportPreviewResponse;
}) {
  const disabled =
    !preview.canConfirm || !preview.batchId || !checked || confirmState.status === "loading";

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">
            Confirm replacement
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Confirming activates this batch and replaces the current active
            batch for {formatMonth(preview.preview.periodMonth)}.
          </p>
        </div>
      </div>

      {!preview.canConfirm ? (
        <InlineError message="This preview has blocking issues and cannot be confirmed." />
      ) : null}

      <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-700">
        <input
          checked={checked}
          className="mt-1 h-4 w-4 shrink-0"
          disabled={!preview.canConfirm}
          onChange={(event) => onCheckedChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          I understand this will replace the current active attendance batch for
          this month.
        </span>
      </label>

      {confirmState.status === "error" ? (
        <InlineError message={confirmState.error} />
      ) : null}

      {confirmState.status === "confirmed" ? (
        <ConfirmedResult result={confirmState.data} />
      ) : null}

      <Button
        className="mt-4 h-11 w-full rounded-xl sm:w-auto"
        disabled={disabled || !canConfirm}
        onClick={onConfirm}
        type="button"
      >
        {confirmState.status === "loading" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        {confirmState.status === "loading" ? "Confirming" : "Confirm batch"}
      </Button>
    </section>
  );
}

function ConfirmedResult({
  result
}: {
  result: AttendanceImportConfirmResponse;
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
      <Definition label="Activated batch" value={result.batchId} mono />
      <Definition label="Status" value={<StatusBadge status={result.status} />} />
      <Definition
        label="Previous active"
        value={formatText(result.previousActiveBatchId)}
        mono
      />
      <Definition label="Confirmed at" value={formatDateTime(result.confirmedAt)} />
    </div>
  );
}

function EmptyConsoleState() {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <h2 className="text-base font-semibold text-slate-950">
        No preview loaded
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        Upload an MTD Excel file to inspect backend validation results before
        confirming replacement.
      </p>
    </section>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-2xl font-semibold tabular-nums text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </section>
  );
}

function IssueCard({ issue }: { issue: AttendancePreviewIssue }) {
  return (
    <article className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-slate-950">
            {formatEnum(issue.issueCode)}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{issue.message}</p>
        </div>
        <SeverityBadge severity={issue.severity} />
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Definition label="Row" value={formatNullable(issue.rowNumber)} />
        <Definition label="Shopper ID" value={formatText(issue.shopperId)} />
        <Definition label="Field" value={formatText(issue.fieldName)} />
        <Definition
          label="Resolution"
          value={formatEnum(issue.resolutionStatus)}
        />
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: AttendanceImportBatchStatus }) {
  return (
    <Badge className={statusTone(status)} variant="outline">
      {formatEnum(status)}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: AttendanceIssueSeverity }) {
  const error = severity === "ERROR";

  return (
    <Badge
      className={
        error
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-800"
      }
      variant="outline"
    >
      {formatEnum(severity)}
    </Badge>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function Definition({
  label,
  mono = false,
  value
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-2">
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <div
        className={cn(
          "mt-1 break-words text-sm font-medium text-slate-800",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="py-3 pr-4">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="py-3 pr-4 align-top text-slate-700">{children}</td>;
}

function statusTone(status: AttendanceImportBatchStatus) {
  const tones: Record<AttendanceImportBatchStatus, string> = {
    UPLOADED: "border-slate-200 bg-slate-100 text-slate-600",
    VALIDATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REPLACED: "border-slate-200 bg-slate-100 text-slate-600",
    FAILED: "border-destructive/40 bg-destructive/10 text-destructive",
    LOCKED: "border-amber-300 bg-amber-50 text-amber-800"
  };

  return tones[status];
}

function defaultUploadDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}

function formatMonth(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const [year, month] = value.split("-");
  if (!year || !month) {
    return value;
  }

  return `${month}/${year}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatText(value?: string | null) {
  return value ? value : "-";
}

function formatNullable(value: number | string | null) {
  return value === null ? "-" : value;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
