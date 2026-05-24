"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileSpreadsheet,
  History,
  Info,
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
  type AttendanceImportStatus,
  type AttendanceImportSummary,
  type HistoricalAssignmentBackfillConfirmResult,
  type HistoricalAssignmentBackfillNotice,
  type HistoricalAssignmentBackfillPreview,
  type HistoricalAssignmentBackfillProposal
} from "@/lib/api/attendance-operations";
import { clearApiCache } from "@/lib/api/request";
import { cn } from "@/lib/utils";

type TabKey = "upload" | "history" | "rules";
type AsyncState<T> =
  | { status: "idle"; data?: never; error?: never }
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const tabs: Array<{ key: TabKey; label: string; icon: typeof Upload }> = [
  { key: "upload", label: "Upload Attendance", icon: Upload },
  { key: "history", label: "Import History", icon: History },
  { key: "rules", label: "Calculation Rules", icon: ClipboardCheck }
];

const processingSteps = [
  "Uploading file",
  "Reading rows",
  "Filtering Egypt rows",
  "Matching users",
  "Calculating metrics",
  "Rebuilding user summaries",
  "Rebuilding branch summaries",
  "Rebuilding chain summaries",
  "Saving import issues",
  "Finalizing"
];

const confirmationText = "CREATE HISTORICAL ASSIGNMENTS";

export function AttendanceOperationsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("upload");
  const history = useImportHistory();
  const lastImport = history.state.status === "ready" ? history.state.data[0] : null;

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <Badge variant="outline">Super Admin operations</Badge>
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              Attendance Data Operations
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Upload, validate, process, and review attendance data without
              changing active assignments or lifecycle workflows.
            </p>
          </div>
          <LastImportBadge importBatch={lastImport} loading={history.state.status === "loading"} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-2 shadow-sm sm:grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.key;

          return (
            <button
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "upload" ? (
        <UploadAttendanceTab onImportComplete={history.reload} />
      ) : null}
      {activeTab === "history" ? (
        <ImportHistoryTab history={history} />
      ) : null}
      {activeTab === "rules" ? <CalculationRulesTab /> : null}
    </div>
  );
}

function UploadAttendanceTab({
  onImportComplete
}: {
  onImportComplete: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [uploadMode, setUploadMode] =
    useState<"DAILY_MTD_OVERRIDE" | "HISTORICAL_BACKFILL">("DAILY_MTD_OVERRIDE");
  const [importState, setImportState] =
    useState<AsyncState<AttendanceImportSummary>>({ status: "idle" });
  const [previewState, setPreviewState] =
    useState<AsyncState<HistoricalAssignmentBackfillPreview>>({ status: "idle" });
  const [confirmState, setConfirmState] =
    useState<AsyncState<HistoricalAssignmentBackfillConfirmResult>>({ status: "idle" });
  const [detailsState, setDetailsState] =
    useState<AsyncState<AttendanceImportDetail>>({ status: "idle" });
  const [issuesState, setIssuesState] =
    useState<AsyncState<AttendanceImportIssue[]>>({ status: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPeriod = useMemo(
    () => formatPeriod(periodFrom, periodTo),
    [periodFrom, periodTo]
  );
  const isImporting = importState.status === "loading";
  const isPreviewing = previewState.status === "loading";
  const isConfirming = confirmState.status === "loading";

  async function handleImportSubmit() {
    const validationError = validateUploadInputs(file, periodFrom, periodTo);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setImportState({ status: "loading" });
    setDetailsState({ status: "idle" });
    setIssuesState({ status: "idle" });

    try {
      const summary = await attendanceOperationsApi.uploadAttendanceImport({
        file: file as File,
        periodFrom,
        periodTo,
        uploadMode
      });
      setImportState({ status: "ready", data: summary });
      clearApiCache("/attendance-operations/imports");
      await onImportComplete();
    } catch (error) {
      setImportState({
        status: "error",
        error: getErrorMessage(error, "Attendance import failed.")
      });
    }
  }

  async function handlePreviewSubmit() {
    const validationError = validateUploadInputs(file, periodFrom, periodTo);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setPreviewState({ status: "loading" });
    setConfirmState({ status: "idle" });

    try {
      const preview =
        await attendanceOperationsApi.previewHistoricalAssignmentBackfill({
          file: file as File,
          periodFrom,
          periodTo
        });
      setPreviewState({ status: "ready", data: preview });
    } catch (error) {
      setPreviewState({
        status: "error",
        error: getErrorMessage(error, "Unable to preview historical assignments.")
      });
    }
  }

  async function handleConfirmSubmit() {
    const validationError = validateUploadInputs(file, periodFrom, periodTo);
    if (validationError) {
      setFormError(validationError);
      setConfirmOpen(false);
      return;
    }

    setConfirmState({ status: "loading" });
    setConfirmOpen(false);

    try {
      const result =
        await attendanceOperationsApi.confirmHistoricalAssignmentBackfill({
          file: file as File,
          periodFrom,
          periodTo,
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

  async function loadImportDetails(batchId: string, withIssues = false) {
    setDetailsState({ status: "loading" });
    try {
      const details = await attendanceOperationsApi.getAttendanceImport(batchId);
      setDetailsState({ status: "ready", data: details });
      if (withIssues) {
        await loadImportIssues(batchId);
      }
    } catch (error) {
      setDetailsState({
        status: "error",
        error: getErrorMessage(error, "Unable to load import details.")
      });
    }
  }

  async function loadImportIssues(batchId: string) {
    setIssuesState({ status: "loading" });
    try {
      const response = await attendanceOperationsApi.getAttendanceImportIssues(
        batchId,
        { pageSize: 50 }
      );
      setIssuesState({ status: "ready", data: response.items });
    } catch (error) {
      setIssuesState({
        status: "error",
        error: getErrorMessage(error, "Unable to load import issues.")
      });
    }
  }

  function resetUploadResult() {
    setImportState({ status: "idle" });
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
    setDetailsState({ status: "idle" });
    setIssuesState({ status: "idle" });
    setFormError(null);
    setFile(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <SectionTitle
          description="Upload an XLSX workbook for controlled attendance import. The workbook is processed without permanent file storage."
          icon={FileSpreadsheet}
          title="Upload Attendance"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="File">
            <Input
              accept=".xlsx"
              disabled={isImporting || isPreviewing || isConfirming}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setImportState({ status: "idle" });
                setPreviewState({ status: "idle" });
                setConfirmState({ status: "idle" });
              }}
              type="file"
            />
          </Field>
          <Field label="Upload Mode">
            <Select
              disabled={isImporting || isPreviewing || isConfirming}
              onChange={(event) => {
                const mode = event.target.value as typeof uploadMode;
                setUploadMode(mode);
                setPreviewState({ status: "idle" });
                setConfirmState({ status: "idle" });
              }}
              value={uploadMode}
            >
              <option value="DAILY_MTD_OVERRIDE">Daily MTD Override</option>
              <option value="HISTORICAL_BACKFILL">Historical Backfill</option>
            </Select>
          </Field>
          <Field label="Period From">
            <Input
              disabled={isImporting || isPreviewing || isConfirming}
              onChange={(event) => setPeriodFrom(event.target.value)}
              type="date"
              value={periodFrom}
            />
          </Field>
          <Field label="Period To">
            <Input
              disabled={isImporting || isPreviewing || isConfirming}
              onChange={(event) => setPeriodTo(event.target.value)}
              type="date"
              value={periodTo}
            />
          </Field>
        </div>

        {formError ? <InlineAlert tone="danger" message={formError} /> : null}

        <PreflightSummary
          fileName={file?.name ?? null}
          period={selectedPeriod}
          uploadMode={uploadMode}
        />

        {uploadMode === "HISTORICAL_BACKFILL" ? (
          <HistoricalBackfillInfo />
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            className="min-h-11 gap-2"
            disabled={isImporting || isPreviewing || isConfirming}
            onClick={() => void handleImportSubmit()}
            type="button"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Start Attendance Import
          </Button>
          <Button
            className="min-h-11 gap-2"
            disabled={
              uploadMode !== "HISTORICAL_BACKFILL" ||
              isImporting ||
              isPreviewing ||
              isConfirming
            }
            onClick={() => void handlePreviewSubmit()}
            type="button"
            variant="outline"
          >
            {isPreviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Preview Historical Assignment Backfill
          </Button>
        </div>

        {isImporting ? <ProcessingStepper /> : null}
        {importState.status === "error" ? (
          <InlineAlert tone="danger" message={importState.error} />
        ) : null}
        {importState.status === "ready" ? (
          <ImportFinalSummary
            onUploadAnother={resetUploadResult}
            onViewDetails={() => void loadImportDetails(importState.data.batchId)}
            onViewIssues={() =>
              void loadImportDetails(importState.data.batchId, true)
            }
            summary={importState.data}
          />
        ) : null}
      </section>

      <aside className="grid gap-4 self-start">
        <RetentionCard periodFrom={periodFrom} periodTo={periodTo} />
        <OperationBoundaryCard />
      </aside>

      <div className="xl:col-span-2">
        <HistoricalBackfillPreviewPanel
          confirmState={confirmState}
          onConfirm={() => setConfirmOpen(true)}
          previewState={previewState}
        />
      </div>

      <div className="grid gap-4 xl:col-span-2 xl:grid-cols-2">
        <ImportDetailPanel detailsState={detailsState} />
        <IssuesPanel issuesState={issuesState} />
      </div>

      {confirmOpen && previewState.status === "ready" ? (
        <ConfirmHistoricalAssignmentsDialog
          disabled={isConfirming}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void handleConfirmSubmit()}
          preview={previewState.data}
        />
      ) : null}
    </div>
  );
}

function ImportHistoryTab({
  history
}: {
  history: ReturnType<typeof useImportHistory>;
}) {
  const [detailsState, setDetailsState] =
    useState<AsyncState<AttendanceImportDetail>>({ status: "idle" });
  const [issuesState, setIssuesState] =
    useState<AsyncState<AttendanceImportIssue[]>>({ status: "idle" });

  async function loadDetails(id: string, withIssues = false) {
    setDetailsState({ status: "loading" });
    try {
      const details = await attendanceOperationsApi.getAttendanceImport(id);
      setDetailsState({ status: "ready", data: details });
      if (withIssues) {
        await loadIssues(id);
      }
    } catch (error) {
      setDetailsState({
        status: "error",
        error: getErrorMessage(error, "Unable to load import details.")
      });
    }
  }

  async function loadIssues(id: string) {
    setIssuesState({ status: "loading" });
    try {
      const response = await attendanceOperationsApi.getAttendanceImportIssues(id, {
        pageSize: 50
      });
      setIssuesState({ status: "ready", data: response.items });
    } catch (error) {
      setIssuesState({
        status: "error",
        error: getErrorMessage(error, "Unable to load import issues.")
      });
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            description="Recent attendance import batches, counts, warnings, and completion state."
            icon={History}
            title="Import History"
          />
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

        {history.state.status === "loading" ? (
          <div className="mt-5">
            <DetailPanelSkeleton label="Loading attendance imports" />
          </div>
        ) : null}
        {history.state.status === "error" ? (
          <div className="mt-5">
            <InlineAlert tone="danger" message={history.state.error} />
          </div>
        ) : null}
        {history.state.status === "ready" ? (
          <div className="mt-5">
            {history.state.data.length ? (
              <ImportHistoryList
                imports={history.state.data}
                onViewIssues={(id) => void loadDetails(id, true)}
                onViewSummary={(id) => void loadDetails(id)}
              />
            ) : (
              <EmptyState
                icon={DatabaseZap}
                message="No attendance imports have been processed yet."
                title="No import history"
              />
            )}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ImportDetailPanel detailsState={detailsState} />
        <IssuesPanel issuesState={issuesState} />
      </div>
    </div>
  );
}

function CalculationRulesTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <RuleCard
        items={[
          "Only rows where Division = Egypt are calculated.",
          "Rows outside Egypt are ignored and counted in the import summary.",
          "Calculated roles are Picker and Champ only.",
          "Role source is SuperNova User.role, not file Role or Designation."
        ]}
        title="Eligibility"
      />
      <RuleCard
        items={[
          "Picker match: Identifier = User.shopperId.",
          "Champ match: Identifier = User.ibsId.",
          "Cross-field collisions become ambiguous matches.",
          "Unmatched or unsupported identifiers create import issues."
        ]}
        title="Matching"
      />
      <RuleCard
        items={[
          "Worked shift: Status is On Time or Late.",
          "Late minutes = max(0, Actual Checkin Time - Shift Scheduled Start Time).",
          "Absent, On Leave, and Off Day rows store late minutes as 0.",
          "Late Level 1 is over 15 minutes and intentionally overlaps higher levels."
        ]}
        title="Late Metrics"
      />
      <RuleCard
        items={[
          "Late Level 2: over 30 and up to 45 minutes.",
          "Late Level 3: over 45 minutes.",
          "Under 8 Hours applies only to worked shifts below 8 hours.",
          "Over 15 Hours applies only to worked shifts above 15 hours."
        ]}
        title="Duration Metrics"
      />
      <RuleCard
        items={[
          "Absent: Status = Absent.",
          "On Leave: Status = On Leave.",
          "Annual Leave: Shift Name contains Annual Leave.",
          "Medical Leave: Shift Name contains Medical Leave.",
          "Off Day: Shift Name contains Off Day."
        ]}
        title="Leave And Absence"
      />
      <RuleCard
        items={[
          "Total Created Shifts counts matched rows inside the selected period.",
          "Total Shifts Needed is inclusive calendar days adjusted by User.joiningDate.",
          "Missing Shifts = max(0, needed - created).",
          "Duplicate Identifier + Shift Date rows create warnings."
        ]}
        title="Shift Counts"
      />
      <RuleCard
        items={[
          "Picker rows roll up to Branch and Chain summaries.",
          "Champ rows remain user-level only.",
          "Champ rows are never mixed into Branch, Chain, or Area Manager Picker totals.",
          "Picker rows without historical assignment stay user-level and create warnings."
        ]}
        title="Aggregation"
      />
      <RuleCard
        items={[
          "Current and previous months keep daily detail plus monthly summaries.",
          "Older months keep monthly summaries only.",
          "Uploaded XLSX files are not permanently stored.",
          "Historical assignment backfill is explicit preview plus typed confirmation only."
        ]}
        title="Retention And Backfill"
      />
    </div>
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
        pageSize: 20
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

function PreflightSummary({
  fileName,
  period,
  uploadMode
}: {
  fileName: string | null;
  period: string;
  uploadMode: "DAILY_MTD_OVERRIDE" | "HISTORICAL_BACKFILL";
}) {
  const rules = [
    ["Selected file", fileName ?? "No file selected"],
    ["Selected period", period],
    ["Upload mode", formatImportMode(uploadMode)],
    ["Division filter", "Egypt only"],
    ["Calculated roles", "Picker + Champ only"],
    ["Picker match", "Identifier = shopperId"],
    ["Champ match", "Identifier = ibsId"],
    ["Branch/chain totals", "Picker only"],
    ["Original file storage", "Disabled"]
  ];

  return (
    <section className="rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Info className="h-4 w-4 text-primary" />
        Preflight Summary
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rules.map(([label, value]) => (
          <div className="min-w-0" key={label}>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Retention behavior is based on selected month: current and previous
        months can store daily detail; older months are summary-only.
      </p>
    </section>
  );
}

function HistoricalBackfillInfo() {
  return (
    <section className="rounded-lg border border-primary/25 bg-brand-soft p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Historical Assignment Backfill
          </h3>
          <ul className="mt-2 grid gap-2 text-sm leading-6 text-muted-foreground">
            <li>Uses Location column only.</li>
            <li>Extracts branch code before the first &quot; - &quot;.</li>
            <li>Matches Location code to Vendor.vendorExternalId.</li>
            <li>Creates no assignments unless preview is reviewed and confirmed.</li>
            <li>Creates CLOSED historical Picker assignments only.</li>
            <li>Does not change current active assignments.</li>
            <li>Champs are ignored for assignment backfill.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProcessingStepper() {
  return (
    <section
      aria-busy="true"
      className="rounded-lg border bg-muted/25 p-4"
      role="status"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Processing import
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {processingSteps.map((step, index) => (
          <li className="flex items-center gap-2 text-sm" key={step}>
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                index === 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ImportFinalSummary({
  onUploadAnother,
  onViewDetails,
  onViewIssues,
  summary
}: {
  onUploadAnother: () => void;
  onViewDetails: () => void;
  onViewIssues: () => void;
  summary: AttendanceImportSummary;
}) {
  const metrics = [
    ["Total rows", summary.totalRows],
    ["Egypt rows", summary.egyptRows],
    ["Ignored rows", summary.ignoredRows],
    ["Matched Pickers", summary.matchedPickers],
    ["Matched Champs", summary.matchedChamps],
    ["Unmatched identifiers", summary.unmatchedIdentifiers],
    ["Duplicate rows", summary.duplicateRows],
    ["Warnings", summary.warningsCount],
    ["Errors", summary.errorsCount],
    ["Daily records stored", summary.dailyRecordsStored],
    ["User summaries stored", summary.userSummariesStored],
    ["Branch summaries rebuilt", summary.branchSummariesRebuilt],
    ["Chain summaries rebuilt", summary.chainSummariesRebuilt]
  ];

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Final Summary
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Batch {summary.batchId} completed with status{" "}
            {formatImportStatus(summary.status)}.
          </p>
        </div>
        <StatusBadge status={summary.status} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <MetricCard key={label} label={String(label)} value={value} />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={onViewDetails} type="button" variant="outline">
          View Import Details
        </Button>
        <Button onClick={onViewIssues} type="button" variant="outline">
          View Warnings
        </Button>
        <Button onClick={onUploadAnother} type="button" variant="ghost">
          Upload Another File
        </Button>
      </div>
    </section>
  );
}

function HistoricalBackfillPreviewPanel({
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
    return <InlineAlert tone="danger" message={previewState.error} />;
  }

  const preview = previewState.data;
  const confirmDisabled = preview.conflictCount > 0 || preview.proposalsCount === 0;

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle
          description="Preview only. No assignment records are created until typed confirmation is submitted."
          icon={ShieldCheck}
          title="Historical Assignment Backfill Preview"
        />
        <Button
          className="min-h-10"
          disabled={confirmDisabled || confirmState.status === "loading"}
          onClick={onConfirm}
          type="button"
        >
          Confirm Historical Assignments
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Proposals" value={preview.proposalsCount} />
        <MetricCard label="Unmapped locations" value={preview.unmappedLocationCount} />
        <MetricCard label="Conflicts" value={preview.conflictCount} />
        <MetricCard label="Matched Pickers" value={preview.matchedPickers} />
        <MetricCard label="Ignored Champs" value={preview.ignoredChampRows} />
      </div>

      {confirmDisabled ? (
        <InlineAlert
          message={
            preview.conflictCount > 0
              ? "Confirmation is disabled while conflicts are present."
              : "There are no safe proposals to confirm."
          }
          tone="warning"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ProposalList proposals={preview.proposals} />
        <NoticeList
          conflicts={preview.conflicts}
          warnings={preview.warnings}
        />
      </div>

      {confirmState.status === "loading" ? (
        <InlineAlert
          message="Confirming historical assignments. Current active assignments are not changed."
          tone="info"
        />
      ) : null}
      {confirmState.status === "error" ? (
        <InlineAlert tone="danger" message={confirmState.error} />
      ) : null}
      {confirmState.status === "ready" ? (
        <InlineAlert
          message={`Created ${confirmState.data.createdCount} closed historical assignments. Skipped ${confirmState.data.skippedCount}; conflicts ${confirmState.data.conflictCount}.`}
          tone="success"
        />
      ) : null}
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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
        <section className="sn-dialog-panel-in w-full max-w-lg rounded-lg border bg-card p-4 shadow-panel sm:p-5">
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
            <button
              aria-label="Close confirmation dialog"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 rounded-lg border bg-muted/25 p-3 text-sm">
            <Definition label="Safe proposals" value={preview.proposalsCount} />
            <Definition label="Conflicts" value={preview.conflictCount} />
            <Definition label="Required text" value={confirmationText} />
          </div>
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

function ImportHistoryList({
  imports,
  onViewIssues,
  onViewSummary
}: {
  imports: AttendanceImportListItem[];
  onViewIssues: (id: string) => void;
  onViewSummary: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] text-left text-sm">
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
              <th className="py-3 pr-4">Duration</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => (
              <tr className="border-b last:border-0" key={item.id}>
                <td className="py-3 pr-4">{formatDateTime(item.createdAt)}</td>
                <td className="py-3 pr-4">{item.createdBy.nameEn}</td>
                <td className="py-3 pr-4">{formatImportMode(item.mode)}</td>
                <td className="py-3 pr-4">{formatPeriod(item.periodFrom, item.periodTo)}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="py-3 pr-4">{item.totalRows}</td>
                <td className="py-3 pr-4">
                  {item.matchedPickers + item.matchedChamps}
                </td>
                <td className="py-3 pr-4">{item.warningsCount}</td>
                <td className="py-3 pr-4">{formatDuration(item.durationMs)}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => onViewSummary(item.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      View Summary
                    </Button>
                    <Button
                      onClick={() => onViewIssues(item.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      View Warnings
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {imports.map((item) => (
          <article className="rounded-lg border bg-card p-4 shadow-sm" key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{formatDateTime(item.createdAt)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.createdBy.nameEn}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <Definition label="Mode" value={formatImportMode(item.mode)} />
              <Definition label="Period" value={formatPeriod(item.periodFrom, item.periodTo)} />
              <Definition label="Rows" value={item.totalRows} />
              <Definition
                label="Matched"
                value={item.matchedPickers + item.matchedChamps}
              />
              <Definition label="Warnings" value={item.warningsCount} />
              <Definition label="Duration" value={formatDuration(item.durationMs)} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Button onClick={() => onViewSummary(item.id)} type="button" variant="outline">
                View Summary
              </Button>
              <Button onClick={() => onViewIssues(item.id)} type="button" variant="ghost">
                View Warnings
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ImportDetailPanel({
  detailsState
}: {
  detailsState: AsyncState<AttendanceImportDetail>;
}) {
  if (detailsState.status === "idle") {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        message="Select an import to review counts, retention, and issue totals."
        title="Import summary"
      />
    );
  }

  if (detailsState.status === "loading") {
    return <DetailPanelSkeleton label="Loading import details" />;
  }

  if (detailsState.status === "error") {
    return <InlineAlert tone="danger" message={detailsState.error} />;
  }

  const details = detailsState.data;
  const rows = [
    ["Batch", details.id],
    ["File", details.fileName ?? "No file recorded"],
    ["Period", formatPeriod(details.periodFrom, details.periodTo)],
    ["Mode", formatImportMode(details.mode)],
    ["Processed rows", details.processedRows],
    ["Duplicate rows", details.duplicateRows],
    ["Unmatched identifiers", details.unmatchedIdentifiers],
    ["Daily records stored", details.retention.dailyRecordsStored],
    ["User summaries stored", details.retention.userSummariesStored],
    ["Branch summaries rebuilt", details.retention.branchSummariesRebuilt],
    ["Chain summaries rebuilt", details.retention.chainSummariesRebuilt]
  ];

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle
          description="Batch summary and retention results."
          icon={FileSpreadsheet}
          title="Import Summary"
        />
        <StatusBadge status={details.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        {rows.map(([label, value]) => (
          <Definition key={String(label)} label={String(label)} value={value} />
        ))}
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Info" value={details.issueCounts.INFO} />
        <MetricCard label="Warnings" value={details.issueCounts.WARNING} />
        <MetricCard label="Errors" value={details.issueCounts.ERROR} />
      </div>
      {details.errorMessage ? (
        <div className="mt-4">
          <InlineAlert tone="danger" message={details.errorMessage} />
        </div>
      ) : null}
    </section>
  );
}

function IssuesPanel({
  issuesState
}: {
  issuesState: AsyncState<AttendanceImportIssue[]>;
}) {
  if (issuesState.status === "idle") {
    return (
      <EmptyState
        icon={TriangleAlert}
        message="Select View Warnings to inspect saved import issues."
        title="Warnings and issues"
      />
    );
  }

  if (issuesState.status === "loading") {
    return <DetailPanelSkeleton label="Loading import issues" />;
  }

  if (issuesState.status === "error") {
    return <InlineAlert tone="danger" message={issuesState.error} />;
  }

  if (!issuesState.data.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        message="No warnings or errors were returned for this import."
        title="No issues"
      />
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <SectionTitle
        description="Saved warnings and errors from import processing."
        icon={TriangleAlert}
        title="Warnings And Issues"
      />
      <div className="mt-4 grid gap-3">
        {issuesState.data.map((issue) => (
          <article className="rounded-lg border bg-muted/20 p-3" key={issue.id}>
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
                value={issue.attendanceDate ? formatDate(issue.attendanceDate) : "N/A"}
              />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProposalList({
  proposals
}: {
  proposals: HistoricalAssignmentBackfillProposal[];
}) {
  return (
    <section className="rounded-lg border bg-muted/15 p-4">
      <h3 className="text-sm font-semibold">Safe proposals</h3>
      {proposals.length ? (
        <div className="mt-3 grid gap-3">
          {proposals.map((proposal, index) => (
            <article
              className="rounded-lg border bg-card p-3"
              key={`${proposal.pickerId}-${proposal.vendorId}-${proposal.proposedStartDate}-${index}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">ATTENDANCE_BACKFILL</Badge>
                <Badge variant="muted">{proposal.evidenceCount} rows</Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Definition label="Picker identifier" value={proposal.identifier} />
                <Definition
                  label="Vendor / Branch"
                  value={proposal.vendorName ?? proposal.vendorId}
                />
                <Definition label="Vendor external ID" value={proposal.vendorExternalId} />
                <Definition label="Chain" value={proposal.chainId} />
                <Definition
                  label="Start date"
                  value={formatDate(proposal.proposedStartDate)}
                />
                <Definition
                  label="End date"
                  value={formatDate(proposal.proposedEndDate)}
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
    <section className="rounded-lg border bg-muted/15 p-4">
      <h3 className="text-sm font-semibold">Warnings and conflicts</h3>
      {notices.length ? (
        <div className="mt-3 grid gap-3">
          {notices.slice(0, 30).map((notice, index) => (
            <article className="rounded-lg border bg-card p-3" key={index}>
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

function RetentionCard({
  periodFrom,
  periodTo
}: {
  periodFrom: string;
  periodTo: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="h-4 w-4 text-primary" />
        Retention Behavior
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Selected period: {formatPeriod(periodFrom, periodTo)}.
      </p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        <li>Current month: daily detail and monthly summary.</li>
        <li>Previous month: daily detail and monthly summary.</li>
        <li>Older months: monthly summaries only.</li>
      </ul>
    </section>
  );
}

function OperationBoundaryCard() {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Scope Boundary
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        <li>No user creation or transfer.</li>
        <li>No active assignment edits.</li>
        <li>No role, identifier, employment, or account status changes.</li>
        <li>No payroll, salary deductions, GPS, or live punch-in/out.</li>
      </ul>
    </section>
  );
}

function RuleCard({ items, title }: { items: string[]; title: string }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LastImportBadge({
  importBatch,
  loading
}: {
  importBatch: AttendanceImportListItem | null;
  loading: boolean;
}) {
  if (loading) {
    return <Badge variant="muted">Loading last import</Badge>;
  }

  if (!importBatch) {
    return <Badge variant="outline">No imports yet</Badge>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Last import</span>
      <StatusBadge status={importBatch.status} />
    </div>
  );
}

function SectionTitle({
  description,
  icon: Icon,
  title
}: {
  description: string;
  icon: typeof Upload;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {description}
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
        : Info;

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3", toneClass)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm leading-6">{message}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
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
    <Badge variant={severity === "ERROR" ? "default" : severity === "WARNING" ? "muted" : "outline"}>
      {formatEnum(severity)}
    </Badge>
  );
}

function validateUploadInputs(
  file: File | null,
  periodFrom: string,
  periodTo: string
) {
  if (!file) {
    return "Attendance XLSX file is required.";
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return "Attendance file must be an .xlsx workbook.";
  }

  if (!periodFrom || !periodTo) {
    return "Period From and Period To are required.";
  }

  if (new Date(periodFrom) > new Date(periodTo)) {
    return "Period From must be before or equal to Period To.";
  }

  return null;
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

function formatPeriod(periodFrom: string, periodTo: string) {
  if (!periodFrom && !periodTo) {
    return "No period selected";
  }
  if (!periodFrom || !periodTo) {
    return "Incomplete period";
  }
  return `${formatDate(periodFrom)} to ${formatDate(periodTo)}`;
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
