"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSelector } from "@/components/ui/file-selector";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import {
  attendanceOperationsApi,
  type AttendanceImportDetail,
  type AttendanceImportIssue,
  type AttendanceImportListItem,
  type AttendanceImportMode,
  type AttendanceImportSampleUser,
  type AttendanceImportStatus,
  type AttendanceImportSummary,
  type HistoricalAssignmentBackfillConfirmResult,
  type HistoricalAssignmentBackfillNotice,
  type HistoricalAssignmentBackfillPreview,
  type HistoricalAssignmentBackfillProposal
} from "@/lib/api/attendance-operations";
import { clearApiCache } from "@/lib/api/request";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "idle"; data?: never; error?: never }
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const confirmationText = "CREATE HISTORICAL ASSIGNMENTS";
const processingSteps = [
  "Uploading file",
  "Reading rows",
  "Filtering Egypt rows",
  "Matching users",
  "Calculating metrics",
  "Rebuilding summaries",
  "Saving issues",
  "Finalizing"
];

export function AttendanceOperationsUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] =
    useState<"DAILY_MTD_OVERRIDE" | "HISTORICAL_BACKFILL">("DAILY_MTD_OVERRIDE");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [importState, setImportState] =
    useState<AsyncState<AttendanceImportSummary>>({ status: "idle" });
  const [sampleState, setSampleState] =
    useState<AsyncState<AttendanceImportSampleUser[]>>({ status: "idle" });
  const [previewState, setPreviewState] =
    useState<AsyncState<HistoricalAssignmentBackfillPreview>>({ status: "idle" });
  const [confirmState, setConfirmState] =
    useState<AsyncState<HistoricalAssignmentBackfillConfirmResult>>({ status: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const period = useMemo(
    () =>
      uploadMode === "DAILY_MTD_OVERRIDE"
        ? getCurrentMtdPeriod()
        : getMonthPeriod(selectedMonth),
    [selectedMonth, uploadMode]
  );
  const busy =
    importState.status === "loading" ||
    previewState.status === "loading" ||
    confirmState.status === "loading";

  async function submitImport() {
    const validation = validateUpload(file, period);
    if (validation) {
      setFormError(validation);
      return;
    }

    setFormError(null);
    setImportState({ status: "loading" });
    setSampleState({ status: "idle" });

    try {
      const summary = await attendanceOperationsApi.uploadAttendanceImport({
        file: file as File,
        periodFrom: period.from,
        periodTo: period.to,
        uploadMode
      });
      setImportState({ status: "ready", data: summary });
      clearApiCache("/attendance-operations/imports");
      await loadSampleUsers(summary.batchId);
    } catch (error) {
      setImportState({
        status: "error",
        error: getErrorMessage(error, "Attendance import failed.")
      });
    }
  }

  async function previewHistoricalBackfill() {
    const validation = validateUpload(file, period);
    if (validation) {
      setFormError(validation);
      return;
    }

    setFormError(null);
    setPreviewState({ status: "loading" });
    setConfirmState({ status: "idle" });

    try {
      const preview =
        await attendanceOperationsApi.previewHistoricalAssignmentBackfill({
          file: file as File,
          periodFrom: period.from,
          periodTo: period.to
        });
      setPreviewState({ status: "ready", data: preview });
    } catch (error) {
      setPreviewState({
        status: "error",
        error: getErrorMessage(error, "Unable to preview historical assignments.")
      });
    }
  }

  async function confirmHistoricalBackfill() {
    const validation = validateUpload(file, period);
    if (validation) {
      setFormError(validation);
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    setConfirmState({ status: "loading" });

    try {
      const result =
        await attendanceOperationsApi.confirmHistoricalAssignmentBackfill({
          file: file as File,
          periodFrom: period.from,
          periodTo: period.to,
          confirmationText
        });
      setConfirmState({ status: "ready", data: result });
    } catch (error) {
      setConfirmState({
        status: "error",
        error: getErrorMessage(
          error,
          "Unable to confirm historical assignments."
        )
      });
    }
  }

  async function loadSampleUsers(batchId: string) {
    setSampleState({ status: "loading" });
    try {
      const response =
        await attendanceOperationsApi.getAttendanceImportSampleUsers(batchId);
      setSampleState({ status: "ready", data: response.items });
    } catch (error) {
      setSampleState({
        status: "error",
        error: getErrorMessage(error, "Unable to load calculated user sample.")
      });
    }
  }

  function resetUpload() {
    setFile(null);
    setFormError(null);
    setImportState({ status: "idle" });
    setSampleState({ status: "idle" });
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Upload Attendance</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Upload Mode">
              <Select
                disabled={busy}
                onChange={(event) => {
                  setUploadMode(event.target.value as typeof uploadMode);
                  setPreviewState({ status: "idle" });
                  setConfirmState({ status: "idle" });
                  setFormError(null);
                }}
                value={uploadMode}
              >
                <option value="DAILY_MTD_OVERRIDE">Daily MTD Override</option>
                <option value="HISTORICAL_BACKFILL">Historical Backfill</option>
              </Select>
            </Field>

            {uploadMode === "HISTORICAL_BACKFILL" ? (
              <Field label="Select month">
                <Input
                  disabled={busy}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  type="month"
                  value={selectedMonth}
                />
              </Field>
            ) : (
              <ReadOnlyPeriodCard label="Current MTD" period={period} />
            )}

            {uploadMode === "HISTORICAL_BACKFILL" ? (
              <ReadOnlyPeriodCard label="Derived period" period={period} />
            ) : null}

            <div className="md:col-span-2">
              <div className="grid gap-2 text-sm font-medium">
                <span>File</span>
                <FileSelector
                  accept=".xlsx"
                  disabled={busy}
                  file={file}
                  maxSizeLabel="Maximum size: 25MB"
                  onFileChange={(selectedFile) => {
                    setFile(selectedFile);
                    setImportState({ status: "idle" });
                    setSampleState({ status: "idle" });
                    setPreviewState({ status: "idle" });
                    setConfirmState({ status: "idle" });
                  }}
                  supportedFormats="XLSX"
                  title="Drag and drop attendance file here"
                />
              </div>
            </div>
          </div>

          {formError ? (
            <div className="mt-4">
              <InlineAlert message={formError} tone="danger" />
            </div>
          ) : null}

          <PreflightChecklist
            fileName={file?.name ?? null}
            mode={uploadMode}
            period={period}
          />

          {uploadMode === "HISTORICAL_BACKFILL" ? (
            <HistoricalBackfillCard />
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-11 gap-2"
              disabled={busy}
              onClick={() => void submitImport()}
              type="button"
            >
              {importState.status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Start Import
            </Button>
            {uploadMode === "HISTORICAL_BACKFILL" ? (
              <Button
                className="min-h-11 gap-2"
                disabled={busy}
                onClick={() => void previewHistoricalBackfill()}
                type="button"
                variant="outline"
              >
                {previewState.status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Preview Backfill
              </Button>
            ) : null}
          </div>

          {importState.status === "loading" ? <ProcessingStrip /> : null}
          {importState.status === "error" ? (
            <div className="mt-4">
              <InlineAlert message={importState.error} tone="danger" />
            </div>
          ) : null}
        </section>

        <aside className="grid gap-4 self-start">
          <CompactRuleCard
            icon={CalendarDays}
            items={[
              "Current and previous months keep daily detail.",
              "Older months keep summaries only.",
              "Uploaded XLSX files are not stored."
            ]}
            title="Retention"
          />
          <CompactRuleCard
            icon={ShieldCheck}
            items={[
              "No user or assignment lifecycle changes.",
              "Branch and Chain totals are Picker-only.",
              "Super Admin access is required."
            ]}
            title="Scope"
          />
        </aside>
      </div>

      {importState.status === "ready" ? (
        <ImportResult
          onReset={resetUpload}
          sampleState={sampleState}
          summary={importState.data}
        />
      ) : null}

      <HistoricalBackfillPreview
        confirmState={confirmState}
        onConfirm={() => setConfirmOpen(true)}
        previewState={previewState}
      />

      {confirmOpen && previewState.status === "ready" ? (
        <ConfirmHistoricalAssignmentsDialog
          disabled={confirmState.status === "loading"}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void confirmHistoricalBackfill()}
          preview={previewState.data}
        />
      ) : null}
    </div>
  );
}

export function AttendanceOperationsHistoryPage() {
  const history = useImportHistory();
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Import History</h2>
          </div>
          <Button
            className="min-h-10 gap-2"
            onClick={() => void history.reload()}
            type="button"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-5">
          {history.state.status === "loading" ? (
            <DetailPanelSkeleton label="Loading attendance imports" />
          ) : null}
          {history.state.status === "error" ? (
            <InlineAlert message={history.state.error} tone="danger" />
          ) : null}
          {history.state.status === "ready" ? (
            history.state.data.length ? (
              <ImportHistoryList
                imports={history.state.data}
                onOpen={setSelectedImportId}
              />
            ) : (
              <EmptyState
                icon={DatabaseZap}
                message="No attendance imports have been processed yet."
                title="No import history"
              />
            )
          ) : null}
        </div>
      </section>

      {selectedImportId ? (
        <ImportDetailsModal
          importId={selectedImportId}
          onClose={() => setSelectedImportId(null)}
        />
      ) : null}
    </div>
  );
}

export function AttendanceOperationsRulesPage() {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Calculation Rules</h2>
      </div>
      <div className="mt-5 divide-y">
        {ruleGroups.map((group) => (
          <section className="py-4 first:pt-0 last:pb-0" key={group.title}>
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              {group.items.map((item) => (
                <li className="flex gap-2" key={item}>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function ImportResult({
  onReset,
  sampleState,
  summary
}: {
  onReset: () => void;
  sampleState: AsyncState<AttendanceImportSampleUser[]>;
  summary: AttendanceImportSummary;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-semibold">Import Result</h2>
        </div>
        <Button onClick={onReset} size="sm" type="button" variant="outline">
          Upload another file
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="Status" value={formatImportStatus(summary.status)} />
        <MetricCard label="Total rows" value={summary.totalRows} />
        <MetricCard label="Matched Pickers" value={summary.matchedPickers} />
        <MetricCard label="Matched Champs" value={summary.matchedChamps} />
        <MetricCard label="Warnings" value={summary.warningsCount} />
        <MetricCard label="Errors" value={summary.errorsCount} />
      </div>

      <SampleUsersList sampleState={sampleState} />
    </section>
  );
}

function SampleUsersList({
  sampleState
}: {
  sampleState: AsyncState<AttendanceImportSampleUser[]>;
}) {
  if (sampleState.status === "loading") {
    return (
      <div className="mt-5">
        <DetailPanelSkeleton label="Loading calculated user sample" />
      </div>
    );
  }

  if (sampleState.status === "error") {
    return (
      <div className="mt-5">
        <InlineAlert message={sampleState.error} tone="warning" />
      </div>
    );
  }

  if (sampleState.status !== "ready") {
    return null;
  }

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold">Sample calculated users</h3>
      {sampleState.data.length ? (
        <>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Identifier</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Created shifts</th>
                  <th className="py-3 pr-4">Needed shifts</th>
                  <th className="py-3 pr-4">Missing shifts</th>
                  <th className="py-3 pr-4">Late &gt;15</th>
                  <th className="py-3 pr-4">Absent</th>
                  <th className="py-3 pr-4">Under 8h</th>
                  <th className="py-3">Over 15h</th>
                </tr>
              </thead>
              <tbody>
                {sampleState.data.map((item) => (
                  <tr className="border-b last:border-0" key={item.id}>
                    <td className="py-3 pr-4 font-medium">
                      {item.identifier}
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        {item.userDisplayName}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{formatEnum(item.role)}</td>
                    <td className="py-3 pr-4">{item.totalCreatedShifts}</td>
                    <td className="py-3 pr-4">{item.totalShiftsNeeded}</td>
                    <td className="py-3 pr-4">{item.missingShifts}</td>
                    <td className="py-3 pr-4">{item.lateLevel1Over15Count}</td>
                    <td className="py-3 pr-4">{item.absentCount}</td>
                    <td className="py-3 pr-4">{item.under8HoursCount}</td>
                    <td className="py-3">{item.over15HoursCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-3 md:hidden">
            {sampleState.data.map((item) => (
              <article className="rounded-lg border p-3" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{item.identifier}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.userDisplayName}
                    </p>
                  </div>
                  <Badge variant="outline">{formatEnum(item.role)}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Definition label="Created" value={item.totalCreatedShifts} />
                  <Definition label="Needed" value={item.totalShiftsNeeded} />
                  <Definition label="Missing" value={item.missingShifts} />
                  <Definition label="Late >15" value={item.lateLevel1Over15Count} />
                  <Definition label="Absent" value={item.absentCount} />
                  <Definition label="Under 8h" value={item.under8HoursCount} />
                  <Definition label="Over 15h" value={item.over15HoursCount} />
                </dl>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No monthly user summaries were returned for this import.
        </p>
      )}
    </section>
  );
}

function HistoricalBackfillPreview({
  confirmState,
  onConfirm,
  previewState
}: {
  confirmState: AsyncState<HistoricalAssignmentBackfillConfirmResult>;
  onConfirm: () => void;
  previewState: AsyncState<HistoricalAssignmentBackfillPreview>;
}) {
  if (previewState.status === "idle") {
    return null;
  }

  if (previewState.status === "loading") {
    return (
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Building historical assignment preview
        </div>
      </section>
    );
  }

  if (previewState.status === "error") {
    return <InlineAlert message={previewState.error} tone="danger" />;
  }

  const preview = previewState.data;
  const confirmDisabled = preview.conflictCount > 0 || preview.proposalsCount === 0;

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Backfill Preview</h2>
        </div>
        <Button
          disabled={confirmDisabled || confirmState.status === "loading"}
          onClick={onConfirm}
          type="button"
        >
          Confirm Historical Assignments
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Proposals" value={preview.proposalsCount} />
        <MetricCard label="Unmapped" value={preview.unmappedLocationCount} />
        <MetricCard label="Conflicts" value={preview.conflictCount} />
        <MetricCard label="Matched Pickers" value={preview.matchedPickers} />
        <MetricCard label="Ignored Champs" value={preview.ignoredChampRows} />
      </div>

      {confirmDisabled ? (
        <div className="mt-4">
          <InlineAlert
            message={
              preview.conflictCount > 0
                ? "Resolve conflicts before confirmation."
                : "There are no safe proposals to confirm."
            }
            tone="warning"
          />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ProposalList proposals={preview.proposals} />
        <NoticeList conflicts={preview.conflicts} warnings={preview.warnings} />
      </div>

      {confirmState.status === "loading" ? (
        <div className="mt-4">
          <InlineAlert
            message="Confirming closed historical Picker assignments."
            tone="info"
          />
        </div>
      ) : null}
      {confirmState.status === "error" ? (
        <div className="mt-4">
          <InlineAlert message={confirmState.error} tone="danger" />
        </div>
      ) : null}
      {confirmState.status === "ready" ? (
        <div className="mt-4">
          <InlineAlert
            message={`Created ${confirmState.data.createdCount} closed historical assignments. Skipped ${confirmState.data.skippedCount}; conflicts ${confirmState.data.conflictCount}.`}
            tone="success"
          />
        </div>
      ) : null}
    </section>
  );
}

function ImportHistoryList({
  imports,
  onOpen
}: {
  imports: AttendanceImportListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Uploaded By</th>
              <th className="py-3 pr-4">Mode</th>
              <th className="py-3 pr-4">Period</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Rows</th>
              <th className="py-3 pr-4">Matched</th>
              <th className="py-3 pr-4">Warnings</th>
              <th className="py-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => (
              <tr
                className="cursor-pointer border-b transition hover:bg-muted/40 focus-within:bg-muted/40 last:border-0"
                key={item.id}
                onClick={() => onOpen(item.id)}
              >
                <td className="py-3 pr-4">{formatDateTime(item.createdAt)}</td>
                <td className="py-3 pr-4">{item.createdBy.nameEn}</td>
                <td className="py-3 pr-4">{formatImportMode(item.mode)}</td>
                <td className="py-3 pr-4">
                  {formatPeriod({ from: item.periodFrom, to: item.periodTo })}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="py-3 pr-4">{item.totalRows}</td>
                <td className="py-3 pr-4">
                  {item.matchedPickers + item.matchedChamps}
                </td>
                <td className="py-3 pr-4">{item.warningsCount}</td>
                <td className="py-3">{formatDuration(item.durationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {imports.map((item) => (
          <button
            className="rounded-lg border bg-card p-4 text-left shadow-sm transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={item.id}
            onClick={() => onOpen(item.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {formatDateTime(item.createdAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.createdBy.nameEn}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Definition label="Mode" value={formatImportMode(item.mode)} />
              <Definition
                label="Period"
                value={formatPeriod({ from: item.periodFrom, to: item.periodTo })}
              />
              <Definition label="Rows" value={item.totalRows} />
              <Definition
                label="Matched"
                value={item.matchedPickers + item.matchedChamps}
              />
              <Definition label="Warnings" value={item.warningsCount} />
              <Definition label="Duration" value={formatDuration(item.durationMs)} />
            </dl>
          </button>
        ))}
      </div>
    </>
  );
}

function ImportDetailsModal({
  importId,
  onClose
}: {
  importId: string;
  onClose: () => void;
}) {
  const [detailState, setDetailState] =
    useState<AsyncState<AttendanceImportDetail>>({ status: "loading" });
  const [issuesState, setIssuesState] =
    useState<AsyncState<AttendanceImportIssue[]>>({ status: "loading" });
  const [sampleState, setSampleState] =
    useState<AsyncState<AttendanceImportSampleUser[]>>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setDetailState({ status: "loading" });
      setIssuesState({ status: "loading" });
      setSampleState({ status: "loading" });
      try {
        const [detail, issues, sample] = await Promise.all([
          attendanceOperationsApi.getAttendanceImport(importId),
          attendanceOperationsApi.getAttendanceImportIssues(importId, {
            pageSize: 50
          }),
          attendanceOperationsApi.getAttendanceImportSampleUsers(importId)
        ]);
        if (!mounted) {
          return;
        }
        setDetailState({ status: "ready", data: detail });
        setIssuesState({ status: "ready", data: issues.items });
        setSampleState({ status: "ready", data: sample.items });
      } catch (error) {
        if (!mounted) {
          return;
        }
        const message = getErrorMessage(error, "Unable to load import details.");
        setDetailState({ status: "error", error: message });
        setIssuesState({ status: "error", error: message });
        setSampleState({ status: "error", error: message });
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [importId]);

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4"
        role="dialog"
      >
        <section className="max-h-[94dvh] w-full overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:max-w-5xl sm:rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b p-4 sm:p-5">
            <div className="min-w-0">
              <Badge variant="outline">Import Details</Badge>
              <h2 className="mt-2 text-lg font-semibold">Attendance Import</h2>
            </div>
            <Button
              aria-label="Close import details"
              className="h-10 w-10 p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[calc(94dvh-84px)] overflow-x-hidden overflow-y-auto p-4 sm:p-5">
            {detailState.status === "loading" ? (
              <DetailPanelSkeleton label="Loading import details" />
            ) : null}
            {detailState.status === "error" ? (
              <InlineAlert message={detailState.error} tone="danger" />
            ) : null}
            {detailState.status === "ready" ? (
              <div className="grid gap-5">
                <ImportDetailSections detail={detailState.data} />
                <SampleUsersList sampleState={sampleState} />
                <IssueList issuesState={issuesState} />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function ImportDetailSections({ detail }: { detail: AttendanceImportDetail }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Status" value={formatImportStatus(detail.status)} />
        <MetricCard label="Total rows" value={detail.totalRows} />
        <MetricCard label="Matched" value={detail.matchedPickers + detail.matchedChamps} />
        <MetricCard label="Warnings" value={detail.warningsCount} />
      </div>

      <section className="grid gap-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">File and period</h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Definition label="File" value={detail.fileName ?? "No file recorded"} />
          <Definition label="Mode" value={formatImportMode(detail.mode)} />
          <Definition
            label="Period"
            value={formatPeriod({ from: detail.periodFrom, to: detail.periodTo })}
          />
          <Definition label="Uploaded by" value={detail.createdBy.nameEn} />
        </dl>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Retention result</h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Definition label="Daily records" value={detail.retention.dailyRecordsStored} />
          <Definition label="User summaries" value={detail.retention.userSummariesStored} />
          <Definition
            label="Branch summaries"
            value={detail.retention.branchSummariesRebuilt}
          />
          <Definition
            label="Chain summaries"
            value={detail.retention.chainSummariesRebuilt}
          />
        </dl>
      </section>
    </div>
  );
}

function IssueList({
  issuesState
}: {
  issuesState: AsyncState<AttendanceImportIssue[]>;
}) {
  if (issuesState.status === "loading") {
    return <DetailPanelSkeleton label="Loading import issues" />;
  }

  if (issuesState.status === "error") {
    return <InlineAlert message={issuesState.error} tone="warning" />;
  }

  if (issuesState.status !== "ready") {
    return null;
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Warnings and errors</h3>
      </div>
      {issuesState.data.length ? (
        <div className="mt-3 grid gap-2">
          {issuesState.data.map((issue) => (
            <article className="rounded-lg bg-muted/30 p-3" key={issue.id}>
              <div className="flex flex-wrap items-center gap-2">
                <IssueSeverityBadge severity={issue.severity} />
                <Badge variant="outline">{formatEnum(issue.type)}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6">{issue.message}</p>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <Definition label="Row" value={issue.rowNumber ?? "N/A"} />
                <Definition label="Identifier" value={issue.identifier ?? "N/A"} />
                <Definition
                  label="Date"
                  value={
                    issue.attendanceDate ? formatDate(issue.attendanceDate) : "N/A"
                  }
                />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No warnings or errors were saved for this import.
        </p>
      )}
    </section>
  );
}

function ProposalList({
  proposals
}: {
  proposals: HistoricalAssignmentBackfillProposal[];
}) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Safe proposals</h3>
      {proposals.length ? (
        <div className="mt-3 grid gap-3">
          {proposals.map((proposal, index) => (
            <article
              className="rounded-lg bg-muted/25 p-3"
              key={`${proposal.pickerId}-${proposal.vendorId}-${proposal.proposedStartDate}-${index}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">ATTENDANCE_BACKFILL</Badge>
                <Badge variant="muted">{proposal.evidenceCount} rows</Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Definition label="Picker" value={proposal.identifier} />
                <Definition
                  label="Branch"
                  value={proposal.vendorName ?? proposal.vendorExternalId}
                />
                <Definition label="Vendor code" value={proposal.vendorExternalId} />
                <Definition
                  label="Range"
                  value={`${formatDate(proposal.proposedStartDate)} to ${formatDate(
                    proposal.proposedEndDate
                  )}`}
                />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No closed historical assignment proposals are available.
        </p>
      )}
    </section>
  );
}

function NoticeList({
  conflicts,
  warnings
}: {
  conflicts: HistoricalAssignmentBackfillNotice[];
  warnings: HistoricalAssignmentBackfillNotice[];
}) {
  const notices = [
    ...conflicts.map((item) => ({ ...item, tone: "danger" as const })),
    ...warnings.map((item) => ({ ...item, tone: "warning" as const }))
  ];

  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Warnings and conflicts</h3>
      {notices.length ? (
        <div className="mt-3 grid gap-3">
          {notices.slice(0, 20).map((notice, index) => (
            <article className="rounded-lg bg-muted/25 p-3" key={index}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={notice.tone === "danger" ? "default" : "muted"}>
                  {notice.tone === "danger" ? "Conflict" : "Warning"}
                </Badge>
                <Badge variant="outline">{notice.reason}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6">{notice.message}</p>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <Definition label="Row" value={notice.rowNumber ?? "N/A"} />
                <Definition label="Identifier" value={notice.identifier ?? "N/A"} />
                <Definition
                  label="Date"
                  value={
                    notice.attendanceDate
                      ? formatDate(notice.attendanceDate)
                      : "N/A"
                  }
                />
                <Definition label="Location" value={notice.location ?? "N/A"} />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No warnings or conflicts were returned by the preview.
        </p>
      )}
    </section>
  );
}

function ConfirmHistoricalAssignmentsDialog({
  disabled,
  onClose,
  onConfirm,
  preview
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: HistoricalAssignmentBackfillPreview;
}) {
  const [typedText, setTypedText] = useState("");
  const canConfirm = typedText === confirmationText && !disabled;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4">
        <section className="w-full max-w-lg rounded-t-2xl border bg-card p-4 shadow-2xl sm:rounded-2xl sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Badge variant="outline">Typed confirmation required</Badge>
              <h3 className="mt-3 text-lg font-semibold">
                Confirm Historical Assignments
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This creates CLOSED historical Picker assignments only. It does
                not change current active assignments.
              </p>
            </div>
            <Button
              aria-label="Close confirmation dialog"
              className="h-10 w-10 p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <dl className="mt-4 grid gap-3 rounded-lg border p-3 text-sm">
            <Definition label="Safe proposals" value={preview.proposalsCount} />
            <Definition label="Conflicts" value={preview.conflictCount} />
            <Definition label="Required text" value={confirmationText} />
          </dl>
          <Field className="mt-4" label="Type confirmation">
            <Input
              autoComplete="off"
              onChange={(event) => setTypedText(event.target.value)}
              placeholder={confirmationText}
              value={typedText}
            />
          </Field>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={!canConfirm} onClick={onConfirm} type="button">
              Confirm Historical Assignments
            </Button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function PreflightChecklist({
  fileName,
  mode,
  period
}: {
  fileName: string | null;
  mode: AttendanceImportMode;
  period: AttendancePeriod;
}) {
  const items = [
    ["File", fileName ?? "No file selected"],
    ["Mode", formatImportMode(mode)],
    ["Period", period.isValid ? formatPeriod(period) : "Select a month"],
    ["Division", "Egypt"],
    ["Match", "Picker shopperId / Champ ibsId"],
    ["Branch/Chain totals", "Pickers only"],
    ["File storage", "disabled"]
  ];

  return (
    <dl className="mt-5 grid gap-3 rounded-lg bg-muted/25 p-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <Definition key={label} label={label} value={value} />
      ))}
    </dl>
  );
}

function HistoricalBackfillCard() {
  return (
    <section className="mt-4 rounded-lg border border-primary/20 bg-brand-soft p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Historical Assignment Backfill
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        <li>Uses Location column.</li>
        <li>Extracts branch code before &quot; - &quot;.</li>
        <li>Creates CLOSED historical Picker assignments only after preview and confirmation.</li>
        <li>Does not change current active assignments.</li>
        <li>Champs ignored.</li>
      </ul>
    </section>
  );
}

function ProcessingStrip() {
  return (
    <section className="mt-4 rounded-lg border bg-muted/25 p-4" role="status">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Processing import
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {processingSteps.map((step) => (
          <Badge key={step} variant="outline">
            {step}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function CompactRuleCard({
  icon: Icon,
  items,
  title
}: {
  icon: typeof CalendarDays;
  items: string[];
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ReadOnlyPeriodCard({
  label,
  period
}: {
  label: string;
  period: AttendancePeriod;
}) {
  return (
    <div className="rounded-lg border bg-muted/25 px-3 py-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">
        {period.isValid ? formatPeriod(period) : "Select a month"}
      </p>
    </div>
  );
}

function Field({
  children,
  className,
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("grid gap-2 text-sm font-medium", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  title
}: {
  icon: typeof DatabaseZap;
  message: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-5 text-center shadow-sm">
      <Icon className="mx-auto h-7 w-7 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{message}</p>
    </section>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}

function InlineAlert({
  message,
  tone
}: {
  message: string;
  tone: "danger" | "info" | "success" | "warning";
}) {
  const toneClass = {
    danger: "border-red-200 bg-red-50 text-red-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900"
  }[tone];
  const Icon =
    tone === "danger" || tone === "warning"
      ? AlertCircle
      : tone === "success"
        ? CheckCircle2
        : DatabaseZap;

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3", toneClass)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm leading-6">{message}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AttendanceImportStatus | string }) {
  const tone =
    status === "FAILED"
      ? "default"
      : status === "COMPLETED" || status === "COMPLETED_WITH_WARNINGS"
        ? "outline"
        : "muted";

  return <Badge variant={tone}>{formatImportStatus(status)}</Badge>;
}

function IssueSeverityBadge({
  severity
}: {
  severity: AttendanceImportIssue["severity"];
}) {
  return (
    <Badge
      variant={
        severity === "ERROR" ? "default" : severity === "WARNING" ? "muted" : "outline"
      }
    >
      {formatEnum(severity)}
    </Badge>
  );
}

function useImportHistory() {
  const [state, setState] = useState<AsyncState<AttendanceImportListItem[]>>({
    status: "loading"
  });

  async function reload() {
    setState({ status: "loading" });
    try {
      clearApiCache("/attendance-operations/imports");
      const response = await attendanceOperationsApi.listAttendanceImports({
        pageSize: 30
      });
      setState({ status: "ready", data: response.items });
    } catch (error) {
      setState({
        status: "error",
        error: getErrorMessage(error, "Unable to load import history.")
      });
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return { reload, state };
}

type AttendancePeriod = {
  from: string;
  isValid: boolean;
  to: string;
};

function getCurrentMtdPeriod(): AttendancePeriod {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  return {
    from: toDateInputValue(from),
    isValid: from <= to,
    to: toDateInputValue(to)
  };
}

function getMonthPeriod(value: string): AttendancePeriod {
  if (!value) {
    return { from: "", isValid: false, to: "" };
  }

  const [yearValue, monthValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!year || !month) {
    return { from: "", isValid: false, to: "" };
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);

  return {
    from: toDateInputValue(from),
    isValid: true,
    to: toDateInputValue(to)
  };
}

function validateUpload(file: File | null, period: AttendancePeriod) {
  if (!file) {
    return "Attendance XLSX file is required.";
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return "Attendance file must be an .xlsx workbook.";
  }

  if (!period.isValid || !period.from || !period.to) {
    return "A valid attendance period is required.";
  }

  return null;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPeriod(period: AttendancePeriod | { from: string; to: string }) {
  if (!period.from || !period.to) {
    return "Select a period";
  }

  return `${formatDate(period.from)} -> ${formatDate(period.to)}`;
}

function formatImportMode(mode: AttendanceImportMode | string) {
  const labels: Record<string, string> = {
    DAILY_MTD_OVERRIDE: "Daily MTD Override",
    HISTORICAL_BACKFILL: "Historical Backfill",
    RECALCULATE_ONLY: "Recalculate Only",
    DELETE_RANGE: "Delete Range",
    DELETE_MONTH: "Delete Month",
    DELETE_ALL: "Delete All",
    COMPRESS_OLD_MONTHS: "Compress Old Months"
  };
  return labels[mode] ?? formatEnum(mode);
}

function formatImportStatus(status: string) {
  return formatEnum(status);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "N/A";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${Math.round(durationMs / 1000)} sec`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const ruleGroups = [
  {
    title: "Eligibility and Matching",
    items: [
      "Calculate Egypt rows only.",
      "Picker uses Identifier = shopperId; Champ uses Identifier = ibsId.",
      "Role comes from SuperNova User.role.",
      "Ambiguous, unmatched, or unsupported rows create issues."
    ]
  },
  {
    title: "Late and Duration",
    items: [
      "Worked shifts are On Time or Late.",
      "Late minutes = max(0, check-in minus scheduled start).",
      "Late >15 overlaps higher late levels by design.",
      "Under 8h and Over 15h apply only to worked shifts."
    ]
  },
  {
    title: "Absence and Leave",
    items: [
      "Absent uses Status = Absent.",
      "On Leave uses Status = On Leave.",
      "Annual, Medical, and Off Day are detected from Shift Name.",
      "Absent, leave, and off day rows store late minutes as 0."
    ]
  },
  {
    title: "Aggregation",
    items: [
      "Picker attendance rolls up to Branch and Chain summaries.",
      "Champ attendance stays user-level only.",
      "Picker rows missing assignment snapshot stay out of Branch/Chain totals.",
      "Duplicate Identifier + Shift Date rows create warnings."
    ]
  },
  {
    title: "Retention and Backfill",
    items: [
      "Current and previous months keep daily detail plus monthly summaries.",
      "Older months keep monthly summaries only.",
      "Uploaded XLSX files are not permanently stored.",
      "Historical assignment creation requires preview and typed confirmation."
    ]
  }
];
