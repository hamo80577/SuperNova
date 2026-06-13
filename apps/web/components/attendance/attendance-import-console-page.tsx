"use client";

import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSpreadsheet,
  Inbox,
  ListChecks,
  MapPin,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import {
  attendanceApi,
  type AttendanceImportConfirmResponse,
  type AttendanceImportMode,
  type AttendanceImportPreviewResponse,
  type AttendanceImportBatchStatus,
  type AttendanceDuplicateGroup,
  type AttendanceDuplicateOption,
  type AttendancePreviewIssue,
  type AttendanceIssueSeverity,
  type AttendanceReportedLocationSummary
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

const issuePageSizes = [10, 25];

interface AttendanceImportConsolePageProps {
  backHref?: string;
  description?: string;
  importMode?: AttendanceImportMode;
  title?: string;
}

export function AttendanceImportConsolePage({
  backHref,
  description,
  importMode = "MTD",
  title
}: AttendanceImportConsolePageProps = {}) {
  const isHistorical = importMode === "HISTORICAL_MONTH";
  const [file, setFile] = useState<File | null>(null);
  const [uploadDate, setUploadDate] = useState(defaultUploadDate);
  const [periodMonth, setPeriodMonth] = useState("");
  const [preview, setPreview] =
    useState<AttendanceImportPreviewResponse | null>(null);
  const [previewState, setPreviewState] = useState<AsyncActionState>({
    status: "idle"
  });
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    status: "idle"
  });
  const [unmappedLocationAcknowledged, setUnmappedLocationAcknowledged] =
    useState(false);
  const [duplicateResolverOpen, setDuplicateResolverOpen] = useState(false);
  const [duplicateResolverIndex, setDuplicateResolverIndex] = useState(0);
  const [duplicateSelections, setDuplicateSelections] = useState<
    Record<string, number>
  >({});
  const [duplicateSaveState, setDuplicateSaveState] =
    useState<AsyncActionState>({
      status: "idle"
    });
  const [fileInputKey, setFileInputKey] = useState(0);

  const selectedFileLabel = file
    ? `${file.name} (${formatFileSize(file.size)})`
    : "No file selected";
  const unmappedLocations = useMemo(
    () =>
      preview?.preview.rowsByReportedLocationCode.filter(
        (location) => location.mappingStatus === "UNMAPPED"
      ) ?? [],
    [preview]
  );
  const hasUnmappedLocationWarnings =
    (preview?.preview.unmappedLocationRows ?? 0) > 0;
  const canConfirm = Boolean(
    preview?.batchId &&
      preview.canConfirm &&
      confirmChecked &&
      (!hasUnmappedLocationWarnings || unmappedLocationAcknowledged)
  );
  const isPreviewing = previewState.status === "loading";
  const pageTitle =
    title ?? (isHistorical ? "Historical Attendance Import" : "Attendance Imports");
  const pageDescription =
    description ??
    (isHistorical
      ? "Import a closed monthly attendance file without changing assignments."
      : "Upload, preview, resolve, and confirm monthly picker attendance.");

  async function handlePreview() {
    if (!file) {
      setPreviewState({
        status: "error",
        error: `Choose ${isHistorical ? "a historical" : "an MTD"} Excel file before previewing.`
      });
      return;
    }

    if (isHistorical && !periodMonth.trim()) {
      setPreviewState({
        status: "error",
        error: "Choose the historical month before previewing."
      });
      return;
    }

    setPreviewState({ status: "loading" });
    setConfirmState({ status: "idle" });
    setConfirmChecked(false);
    setUnmappedLocationAcknowledged(false);

    try {
      const nextPreview = await attendanceApi.previewImport(
        file,
        buildPreviewOptions()
      );
      setPreview(nextPreview);
      setDuplicateSelections(defaultDuplicateSelections(nextPreview));
      setDuplicateResolverIndex(0);
      setDuplicateResolverOpen(hasUnresolvedDuplicateGroups(nextPreview));
      setDuplicateSaveState({ status: "idle" });
      setPreviewState({ status: "idle" });
      setUnmappedLocationAcknowledged(false);
    } catch (error) {
      setPreview(null);
      setDuplicateResolverOpen(false);
      setPreviewState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview attendance import."
      });
    }
  }

  async function handleSaveDuplicateChoices() {
    if (!file || !preview) {
      return;
    }

    const duplicateGroups = preview.preview.duplicateGroups;
    const selectedRows = duplicateGroups
      .map((group) => duplicateSelections[duplicateGroupKey(group)])
      .filter((rowNumber): rowNumber is number => typeof rowNumber === "number");

    if (selectedRows.length !== duplicateGroups.length) {
      setDuplicateSaveState({
        status: "error",
        error: "Choose one shift for each duplicate Picker."
      });
      return;
    }

    setDuplicateSaveState({ status: "loading" });
    setConfirmState({ status: "idle" });
    setConfirmChecked(false);
    setUnmappedLocationAcknowledged(false);

    try {
      const nextPreview = await attendanceApi.previewImport(
        file,
        buildPreviewOptions({ duplicateResolutionRowNumbers: selectedRows })
      );
      setPreview(nextPreview);
      setDuplicateSelections(defaultDuplicateSelections(nextPreview));
      setDuplicateResolverIndex(0);
      setDuplicateResolverOpen(hasUnresolvedDuplicateGroups(nextPreview));
      setDuplicateSaveState({ status: "idle" });
      setUnmappedLocationAcknowledged(false);
    } catch (error) {
      setDuplicateSaveState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to save duplicate choices."
      });
    }
  }

  async function handleConfirm() {
    if (!preview?.batchId || !preview.canConfirm) {
      return;
    }

    if (hasUnmappedLocationWarnings && !unmappedLocationAcknowledged) {
      setConfirmState({
        status: "error",
        error: "Acknowledge unmapped Location warnings before confirming."
      });
      return;
    }

    setConfirmState({ status: "loading" });

    try {
      const result = await attendanceApi.confirmImport(preview.batchId);
      setConfirmState({ status: "confirmed", data: result });
      setConfirmChecked(false);
      setUnmappedLocationAcknowledged(false);
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
    resetPreviewState();
    setFileInputKey((current) => current + 1);
  }

  function handlePeriodMonthChange(value: string) {
    setPeriodMonth(value);
    resetPreviewState();
  }

  function resetPreviewState() {
    setPreview(null);
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
    setConfirmChecked(false);
    setUnmappedLocationAcknowledged(false);
    setDuplicateResolverOpen(false);
    setDuplicateResolverIndex(0);
    setDuplicateSelections({});
    setDuplicateSaveState({ status: "idle" });
  }

  function resetConsole() {
    setFile(null);
    setUploadDate(defaultUploadDate());
    setPeriodMonth("");
    resetPreviewState();
    setFileInputKey((current) => current + 1);
  }

  function buildPreviewOptions(options: {
    duplicateResolutionRowNumbers?: number[];
  } = {}) {
    if (isHistorical) {
      return {
        duplicateResolutionRowNumbers: options.duplicateResolutionRowNumbers,
        importMode,
        periodMonth
      };
    }

    return {
      duplicateResolutionRowNumbers: options.duplicateResolutionRowNumbers,
      uploadDate
    };
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-[color:var(--sn-sunken)]/80 p-3 sm:p-4">
      <div className="grid min-w-0 gap-4 rounded-[1.4rem] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
        <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-[color:var(--sn-ink)]">
              {pageTitle}
            </h1>
            <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
              {pageDescription}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {backHref ? (
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-11 rounded-xl"
                )}
                href={backHref}
                prefetch
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to MTD
              </Link>
            ) : (
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-11 rounded-xl border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] hover:bg-[#FFD8BD]"
                )}
                href="/admin/attendance/imports/historical"
                prefetch
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Import Historical Month
              </Link>
            )}
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
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <UploadCard
            fileLabel={selectedFileLabel}
            fileInputKey={fileInputKey}
            importMode={importMode}
            isPreviewing={isPreviewing}
            onFileChange={handleFileChange}
            onPeriodMonthChange={handlePeriodMonthChange}
            onPreview={handlePreview}
            onUploadDateChange={setUploadDate}
            periodMonth={periodMonth}
            previewError={previewState.status === "error" ? previewState.error : null}
            uploadDate={uploadDate}
          />
          <PreviewStatusCard importMode={importMode} preview={preview} />
        </section>

        {preview ? (
          <>
            <CoverageCard preview={preview} />
            <CountsSection preview={preview} />
            <ReportedLocationsSection
              locations={preview.preview.rowsByReportedLocationCode}
            />
            {hasUnmappedLocationWarnings ? (
              <UnmappedLocationsWarningSection
                acknowledged={unmappedLocationAcknowledged}
                locations={unmappedLocations}
                onAcknowledgedChange={setUnmappedLocationAcknowledged}
                rowCount={preview.preview.unmappedLocationRows}
              />
            ) : null}
            <IssuesSection issues={preview.preview.issues} />
            <ConfirmSection
              canConfirm={canConfirm}
              checked={confirmChecked}
              confirmState={confirmState}
              onCheckedChange={setConfirmChecked}
              onConfirm={handleConfirm}
              preview={preview}
            />
            {duplicateResolverOpen && preview.preview.duplicateGroups.length > 0 ? (
              <DuplicateResolutionModal
                currentIndex={duplicateResolverIndex}
                groups={preview.preview.duplicateGroups}
                onClose={() => setDuplicateResolverOpen(false)}
                onIndexChange={setDuplicateResolverIndex}
                onSave={handleSaveDuplicateChoices}
                onSelect={(group, rawRowNumber) =>
                  setDuplicateSelections((current) => ({
                    ...current,
                    [duplicateGroupKey(group)]: rawRowNumber
                  }))
                }
                saveState={duplicateSaveState}
                selections={duplicateSelections}
              />
            ) : null}
          </>
        ) : (
          <EmptyConsoleState importMode={importMode} />
        )}
      </div>
    </div>
  );
}

function DuplicateResolutionModal({
  currentIndex,
  groups,
  onClose,
  onIndexChange,
  onSave,
  onSelect,
  saveState,
  selections
}: {
  currentIndex: number;
  groups: AttendanceDuplicateGroup[];
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onSave: () => void;
  onSelect: (group: AttendanceDuplicateGroup, rawRowNumber: number) => void;
  saveState: AsyncActionState;
  selections: Record<string, number>;
}) {
  const group = groups[Math.min(currentIndex, groups.length - 1)] ?? groups[0];

  if (!group) {
    return null;
  }

  const selectedRawRowNumber = selections[duplicateGroupKey(group)];
  const isLast = currentIndex >= groups.length - 1;
  const resolvedCount = groups.filter(
    (item) => selections[duplicateGroupKey(item)]
  ).length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(65,21,23,0.45)] px-3 py-6 backdrop-blur-sm">
        <section className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[color:var(--sn-border)] bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[color:var(--sn-border)] bg-white px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-normal text-[color:var(--sn-ink)]">
                Resolve duplicate shift
              </h2>
              <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
                {currentIndex + 1} of {groups.length} Pickers
              </p>
            </div>
            <button
              aria-label="Close duplicate resolver"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:var(--sn-border)] text-[color:var(--sn-muted)] transition hover:bg-[color:var(--sn-sunken)] hover:text-[color:var(--sn-ink)]"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[calc(92vh-9.5rem)] overflow-y-auto bg-[color:var(--sn-sunken)]/70 p-4 sm:p-5">
            <div className="grid gap-4">
              <DuplicatePickerCard group={group} />

              <div className="grid gap-3">
                {group.options.map((option) => (
                  <DuplicateShiftOptionCard
                    isSelected={selectedRawRowNumber === option.rawRowNumber}
                    key={option.rawRowNumber}
                    onSelect={() => onSelect(group, option.rawRowNumber)}
                    option={option}
                  />
                ))}
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[color:var(--sn-border-strong)]">
                <div
                  className="h-full rounded-full bg-[oklch(0.58_0.13_150)] transition-[width] duration-300"
                  style={{ width: `${Math.max((resolvedCount / groups.length) * 100, 8)}%` }}
                />
              </div>

              {saveState.status === "error" ? (
                <InlineError message={saveState.error} />
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[color:var(--sn-border)] bg-white px-5 py-4 sm:flex-row sm:justify-between">
            <Button
              className="h-11 rounded-xl"
              disabled={currentIndex === 0}
              onClick={() => onIndexChange(Math.max(currentIndex - 1, 0))}
              type="button"
              variant="outline"
            >
              Back
            </Button>
            {isLast ? (
              <Button
                className="h-11 rounded-xl"
                disabled={
                  !selectedRawRowNumber || saveState.status === "loading"
                }
                onClick={onSave}
                type="button"
              >
                {saveState.status === "loading" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Save choices
              </Button>
            ) : (
              <Button
                className="h-11 rounded-xl"
                disabled={!selectedRawRowNumber}
                onClick={() =>
                  onIndexChange(Math.min(currentIndex + 1, groups.length - 1))
                }
                type="button"
              >
                Next Picker
              </Button>
            )}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function DuplicatePickerCard({ group }: { group: AttendanceDuplicateGroup }) {
  const branchName = group.branchName ?? firstOptionText(group, "sourceLocation");
  const vendorName =
    group.vendorName && group.vendorName !== branchName ? group.vendorName : null;
  const initials = initialsFromName(group.pickerName ?? group.shopperId);

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--sn-ink)] text-sm font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold text-[color:var(--sn-ink)]">
            {group.pickerName ?? "Unmatched Picker"}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill icon={<UserRound className="h-3.5 w-3.5" />}>
              {group.shopperId}
            </MetaPill>
            <MetaPill icon={<MapPin className="h-3.5 w-3.5" />}>
              {branchName ?? "No branch"}
            </MetaPill>
            {vendorName ? <MetaPill>{vendorName}</MetaPill> : null}
            <MetaPill icon={<Clock3 className="h-3.5 w-3.5" />}>
              {formatDate(group.shiftDate)}
            </MetaPill>
          </div>
        </div>
      </div>
    </section>
  );
}

function DuplicateShiftOptionCard({
  isSelected,
  onSelect,
  option
}: {
  isSelected: boolean;
  onSelect: () => void;
  option: AttendanceDuplicateOption;
}) {
  return (
    <button
      className={cn(
        "grid gap-3 rounded-2xl border p-4 text-left shadow-sm transition",
        isSelected
          ? "border-[oklch(0.72_0.1_150)] bg-[oklch(0.95_0.045_150)] shadow-[0_0_0_3px_oklch(0.95_0.045_150)]"
          : "border-[color:var(--sn-border)] bg-white hover:border-[color:var(--sn-border-strong)] hover:bg-[color:var(--sn-sunken)]"
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold text-[color:var(--sn-ink)]">
            {option.shiftName ?? "Unnamed shift"}
          </h4>
          <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
            Row {option.rawRowNumber}
          </p>
        </div>
        <Badge className={sourceStatusTone(option.sourceStatus)} variant="outline">
          {formatSourceStatus(option.sourceStatus)}
        </Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <MiniFact
          label="Shift"
          value={`${formatText(option.scheduledStartTime)}-${formatText(
            option.scheduledEndTime
          )}`}
        />
        <MiniFact label="In" value={formatText(option.actualCheckinTime)} />
        <MiniFact label="Out" value={formatText(option.actualCheckoutTime)} />
        <MiniFact label="Work" value={formatHours(option.actualWorkDurationHours)} />
      </div>
    </button>
  );
}

function MetaPill({
  children,
  icon
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[color:var(--sn-border)] bg-white px-2.5 py-1 text-xs font-medium text-[color:var(--sn-body)]">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[color:var(--sn-faint)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[color:var(--sn-ink)]">{value}</p>
    </div>
  );
}

function UploadCard({
  fileLabel,
  fileInputKey,
  importMode,
  isPreviewing,
  onFileChange,
  onPeriodMonthChange,
  onPreview,
  onUploadDateChange,
  periodMonth,
  previewError,
  uploadDate
}: {
  fileLabel: string;
  fileInputKey: number;
  importMode: AttendanceImportMode;
  isPreviewing: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPeriodMonthChange: (value: string) => void;
  onPreview: () => void;
  onUploadDateChange: (value: string) => void;
  periodMonth: string;
  previewError: string | null;
  uploadDate: string;
}) {
  const historical = importMode === "HISTORICAL_MONTH";

  return (
    <section className="rounded-[16px] border-[color:var(--sn-border)] border bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
            {historical ? "Upload historical month file" : "Upload MTD file"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
            {historical
              ? "Preview a closed month before replacing that month batch."
              : "Preview only - this does not activate the batch."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-[color:var(--sn-body)]">
          Excel file
          <Input
            accept=".xlsx,.xls"
            className="h-auto rounded-xl py-3"
            key={fileInputKey}
            onChange={onFileChange}
            type="file"
          />
        </label>
        <p className="break-words rounded-xl bg-[color:var(--sn-sunken)] px-3 py-2 text-sm text-[color:var(--sn-body)]">
          {fileLabel}
        </p>
        {historical ? (
          <label className="grid gap-1 text-xs font-medium text-[color:var(--sn-body)]">
            Period month
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => onPeriodMonthChange(event.target.value)}
              type="month"
              value={periodMonth}
            />
            <span className="text-xs leading-5 text-[color:var(--sn-muted)]">
              Choose a closed month. Current and future months are rejected by
              the backend.
            </span>
          </label>
        ) : (
          <label className="grid gap-1 text-xs font-medium text-[color:var(--sn-body)]">
            Upload date
            <DatePicker
              onChange={(value) => onUploadDateChange(value)}
              value={uploadDate}
            />
          </label>
        )}
      </div>

      <p className="mt-4 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 py-2 text-xs leading-5 text-[color:var(--sn-muted)]">
        {historical
          ? "This imports a closed historical month. It does not update assignments. Attendance Location from the file controls the reported branch used by attendance reporting, and confirm replaces the active attendance batch for the selected month."
          : "Imported Location and Sub Division values are kept as reported branch source labels for attendance reporting filters only. They do not update assignments, hierarchy, or authorization."}
      </p>

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
  importMode,
  preview
}: {
  importMode: AttendanceImportMode;
  preview: AttendanceImportPreviewResponse | null;
}) {
  const status = preview?.status ?? "UPLOADED";
  const ready = Boolean(preview?.canConfirm);
  const historical = importMode === "HISTORICAL_MONTH";

  return (
    <section className="rounded-[16px] border-[color:var(--sn-border)] border bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
            Preview status
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
            {historical
              ? "Confirm will replace the active batch for the selected historical month."
              : "Confirm will replace the current active batch for this month."}
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
        <div className="mt-5 rounded-xl border border-dashed border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-muted)]">
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
    <section className="grid gap-3 rounded-[16px] border-[color:var(--sn-border)] border bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:grid-cols-2 xl:grid-cols-4">
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
      { label: "Matched Champs", value: preview.preview.matchedChampRows },
      { label: "Unmatched", value: preview.preview.unmatchedRows },
      {
        label: "Ambiguous identifier",
        value: preview.preview.ambiguousIdentifierRows
      },
      { label: "Error rows", value: preview.preview.errorRows },
      { label: "Warning rows", value: preview.preview.warningRows },
      {
        label: "Mapped locations",
        value: preview.preview.mappedLocationRows
      },
      {
        label: "Unmapped locations",
        value: preview.preview.unmappedLocationRows
      },
      {
        label: "Missing location codes",
        value: preview.preview.missingLocationCodeRows
      },
      {
        label: "Assignment warnings",
        value: preview.preview.activeAssignmentMismatchRows
      },
      {
        label: "Location / Shift differences",
        value: preview.preview.locationShiftLocationDifferenceRows
      },
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

function ReportedLocationsSection({
  locations
}: {
  locations: AttendanceReportedLocationSummary[];
}) {
  return (
    <section className="rounded-[16px] border-[color:var(--sn-border)] border bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--sn-border)] bg-white text-[color:var(--sn-body)] shadow-sm">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
              Reported Locations
            </h2>
            <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
              Attendance Location from the file controls the reported branch
              used by attendance reporting.
            </p>
          </div>
        </div>
        <Badge variant={locations.length > 0 ? "outline" : "muted"}>
          {locations.length} reported groups
        </Badge>
      </div>

      {locations.length === 0 ? (
        <EmptyState message="No reported attendance locations returned by the backend." />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--sn-border)]">
          <table className="hidden w-full table-fixed text-left text-sm lg:table">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="bg-[color:var(--sn-sunken)] text-xs font-medium text-[color:var(--sn-muted)]">
              <tr>
                <TableHeader>Code</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Branch</TableHeader>
                <TableHeader>Chain</TableHeader>
                <TableHeader>Rows</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr
                  className="border-b last:border-0"
                  key={`${location.code ?? "missing"}:${location.name ?? "none"}:${location.mappingStatus}`}
                >
                  <TableCell>
                    <TruncatedText value={location.code} />
                  </TableCell>
                  <TableCell>
                    <TruncatedText value={location.name} />
                  </TableCell>
                  <TableCell>
                    <TruncatedText value={location.vendorName} />
                  </TableCell>
                  <TableCell>
                    <TruncatedText value={location.chainName} />
                  </TableCell>
                  <TableCell>{location.rowCount}</TableCell>
                  <TableCell>
                    <ReportedLocationStatusBadge status={location.mappingStatus} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-3 p-3 lg:hidden">
            {locations.map((location) => (
              <ReportedLocationCard
                key={`${location.code ?? "missing"}:${location.name ?? "none"}:${location.mappingStatus}`}
                location={location}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function UnmappedLocationsWarningSection({
  acknowledged,
  locations,
  onAcknowledgedChange,
  rowCount
}: {
  acknowledged: boolean;
  locations: AttendanceReportedLocationSummary[];
  onAcknowledgedChange: (checked: boolean) => void;
  rowCount: number;
}) {
  return (
    <section className="rounded-[16px] border border-[oklch(0.82_0.08_80)] bg-[oklch(0.95_0.05_80)]/70 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[oklch(0.62_0.13_70)] shadow-sm">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
              Unmapped Location warnings
            </h2>
            <p className="mt-1 text-sm leading-6 text-[color:var(--sn-body)]">
              These rows can continue with warning. They will be imported
              without a reported branch until mapping can be fixed later.
            </p>
          </div>
        </div>
        <Badge className="border-[oklch(0.75_0.1_70)] bg-white text-[oklch(0.55_0.14_65)]" variant="outline">
          {rowCount} rows
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {locations.map((location) => (
          <article
            className="min-w-0 rounded-xl border border-[oklch(0.82_0.08_80)] bg-white p-3"
            key={`${location.code ?? "missing"}:${location.name ?? "none"}:${location.mappingStatus}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
                  {formatText(location.name)}
                </p>
                <p className="mt-1 truncate text-xs text-[color:var(--sn-muted)]">
                  Code {formatText(location.code)}
                </p>
              </div>
              <ReportedLocationStatusBadge status={location.mappingStatus} />
            </div>
            <div className="mt-3 rounded-lg bg-[oklch(0.95_0.05_80)] px-3 py-2 text-sm font-semibold text-[oklch(0.45_0.12_65)]">
              {location.rowCount} rows
            </div>
          </article>
        ))}
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-[oklch(0.82_0.08_80)] bg-white p-3 text-sm text-[color:var(--sn-body)]">
        <input
          checked={acknowledged}
          className="mt-1 h-4 w-4 shrink-0"
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          I understand these unmapped Location rows will be imported without a
          reported branch until mapping is fixed.
        </span>
      </label>
    </section>
  );
}

function IssuesSection({ issues }: { issues: AttendancePreviewIssue[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(issues.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleIssues = issues.slice(startIndex, startIndex + pageSize);
  const firstVisible = issues.length === 0 ? 0 : startIndex + 1;
  const lastVisible = Math.min(startIndex + visibleIssues.length, issues.length);

  return (
    <section className="rounded-[16px] border-[color:var(--sn-border)] border bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--sn-border)] bg-white text-[color:var(--sn-body)] shadow-sm">
            <ListChecks className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">Import issues</h2>
            <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
              {issues.length} validation and calculation issues
            </p>
          </div>
        </div>
        <Badge variant={issues.length > 0 ? "outline" : "muted"}>
          {issues.length > 0 ? "Review required" : "No issues"}
        </Badge>
      </div>

      {issues.length === 0 ? (
        <EmptyState message="No validation issues returned by the backend." />
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--sn-border)]">
            <table className="hidden w-full table-fixed text-left text-sm lg:table">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[18%]" />
                <col className="w-[13%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead className="bg-[color:var(--sn-sunken)] text-xs font-medium text-[color:var(--sn-muted)]">
                <tr>
                  <TableHeader>Severity</TableHeader>
                  <TableHeader>Row</TableHeader>
                  <TableHeader>Identifier</TableHeader>
                  <TableHeader>Issue code</TableHeader>
                  <TableHeader>Field</TableHeader>
                  <TableHeader>Message</TableHeader>
                </tr>
              </thead>
              <tbody>
                {visibleIssues.map((issue, index) => (
                  <tr className="border-b last:border-0" key={`${issue.issueCode}-${startIndex + index}`}>
                    <TableCell>
                      <SeverityBadge severity={issue.severity} />
                    </TableCell>
                    <TableCell>{formatNullable(issue.rowNumber)}</TableCell>
                    <TableCell>
                      <TruncatedText value={issue.shopperId} />
                    </TableCell>
                    <TableCell>
                      <TruncatedText value={formatEnum(issue.issueCode)} />
                    </TableCell>
                    <TableCell>
                      <TruncatedText value={issue.fieldName} />
                    </TableCell>
                    <TableCell>
                      <TruncatedText value={issue.message} />
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid gap-3 p-3 lg:hidden">
              {visibleIssues.map((issue, index) => (
                <IssueCard issue={issue} key={`${issue.issueCode}-${startIndex + index}`} />
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-medium text-[color:var(--sn-body)]">
              Showing {firstVisible}-{lastVisible} of {issues.length}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                aria-label="Previous issue page"
                className="h-10 w-10 rounded-xl p-0"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="grid h-10 min-w-14 place-items-center rounded-xl border border-[color:var(--sn-border)] px-3 text-sm font-semibold tabular-nums text-[color:var(--sn-body)]">
                {currentPage}/{totalPages}
              </span>
              <Button
                aria-label="Next issue page"
                className="h-10 w-10 rounded-xl p-0"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(value + 1, totalPages))
                }
                type="button"
                variant="ghost"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-[color:var(--sn-body)]">
              Show per Page
              <Select
                aria-label="Issues per page"
                className="h-10 w-20 rounded-xl"
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                value={pageSize}
              >
                {issuePageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </label>
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
    <section className="rounded-[16px] border border-[oklch(0.82_0.08_80)] bg-[oklch(0.95_0.05_80)]/60 p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[oklch(0.62_0.13_70)]">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
            Confirm replacement
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--sn-body)]">
            Confirming activates this batch and replaces the current active
            batch for {formatMonth(preview.preview.periodMonth)}.
          </p>
        </div>
      </div>

      {!preview.canConfirm ? (
        <InlineError message="This preview has blocking issues and cannot be confirmed." />
      ) : null}

      <label className="mt-5 flex items-start gap-3 rounded-xl border border-[oklch(0.82_0.08_80)] bg-white p-3 text-sm text-[color:var(--sn-body)]">
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
    <div className="mt-4 grid gap-3 rounded-xl border border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] p-3 sm:grid-cols-2 xl:grid-cols-4">
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

function EmptyConsoleState({
  importMode
}: {
  importMode: AttendanceImportMode;
}) {
  const historical = importMode === "HISTORICAL_MONTH";

  return (
    <section className="grid place-items-center rounded-[16px] border border-dashed border-[color:var(--sn-border)] bg-white p-8 text-center shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <Inbox className="mb-3 h-8 w-8 text-[color:var(--sn-muted)]" />
      <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">
        No preview loaded
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-[color:var(--sn-muted)]">
        {historical
          ? "Choose a closed historical month and Excel file to inspect backend validation results before confirming replacement."
          : "Upload an MTD Excel file to inspect backend validation results before confirming replacement."}
      </p>
    </section>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-[16px] border-[color:var(--sn-border)] border bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <p className="text-2xl font-semibold tabular-nums text-[color:var(--sn-ink)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[color:var(--sn-muted)]">{label}</p>
    </section>
  );
}

function IssueCard({ issue }: { issue: AttendancePreviewIssue }) {
  return (
    <article className="grid gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)]/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-[color:var(--sn-ink)]">
            {formatEnum(issue.issueCode)}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--sn-muted)]">{issue.message}</p>
        </div>
        <SeverityBadge severity={issue.severity} />
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Definition label="Row" value={formatNullable(issue.rowNumber)} />
        <Definition label="Identifier" value={formatText(issue.shopperId)} />
        <Definition label="Field" value={formatText(issue.fieldName)} />
        <Definition
          label="Resolution"
          value={formatEnum(issue.resolutionStatus)}
        />
      </div>
    </article>
  );
}

function ReportedLocationCard({
  location
}: {
  location: AttendanceReportedLocationSummary;
}) {
  return (
    <article className="grid gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)]/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-[color:var(--sn-ink)]">
            {formatText(location.name)}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
            Code {formatText(location.code)}
          </p>
        </div>
        <ReportedLocationStatusBadge status={location.mappingStatus} />
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Definition label="Branch" value={formatText(location.vendorName)} />
        <Definition label="Chain" value={formatText(location.chainName)} />
        <Definition label="Rows" value={location.rowCount} />
        <Definition label="Mapping" value={formatEnum(location.mappingStatus)} />
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

function ReportedLocationStatusBadge({
  status
}: {
  status: AttendanceReportedLocationSummary["mappingStatus"];
}) {
  return (
    <Badge className={reportedLocationStatusTone(status)} variant="outline">
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
          : "border-[oklch(0.75_0.1_70)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.55_0.14_65)]"
      }
      variant="outline"
    >
      {formatEnum(severity)}
    </Badge>
  );
}

function defaultDuplicateSelections(preview: AttendanceImportPreviewResponse) {
  return Object.fromEntries(
    preview.preview.duplicateGroups
      .filter((group) => group.selectedRawRowNumber)
      .map((group) => [
        duplicateGroupKey(group),
        group.selectedRawRowNumber as number
      ])
  );
}

function hasUnresolvedDuplicateGroups(preview: AttendanceImportPreviewResponse) {
  return preview.preview.duplicateGroups.some(
    (group) => !group.selectedRawRowNumber
  );
}

function duplicateGroupKey(group: AttendanceDuplicateGroup) {
  return `${group.shopperId}:${group.shiftDate}:${group.options
    .map((option) => option.rawRowNumber)
    .join(",")}`;
}

function firstOptionText(
  group: AttendanceDuplicateGroup,
  field: keyof AttendanceDuplicateOption
) {
  const value = group.options.find((option) => option[field])?.[field];
  return typeof value === "string" ? value : null;
}

function initialsFromName(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "P";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function sourceStatusTone(value: string | null) {
  const status = value?.trim().toUpperCase() ?? "";

  if (status.includes("ABSENT")) {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  if (status.includes("LATE")) {
    return "border-[oklch(0.75_0.1_70)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.55_0.14_65)]";
  }

  if (status.includes("PRESENT") || status.includes("ON TIME")) {
    return "border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]";
  }

  return "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]";
}

function reportedLocationStatusTone(
  status: AttendanceReportedLocationSummary["mappingStatus"]
) {
  const tones: Record<
    AttendanceReportedLocationSummary["mappingStatus"],
    string
  > = {
    MAPPED_VENDOR_CODE: "border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    MAPPED_VENDOR_EXTERNAL_ID: "border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    MISSING_CODE: "border-destructive/40 bg-destructive/10 text-destructive",
    NOT_CHECKED: "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]",
    UNMAPPED: "border-[oklch(0.75_0.1_70)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.55_0.14_65)]"
  };

  return tones[status];
}

function formatSourceStatus(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHours(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(1)}h`;
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
    <div className="mt-4 grid place-items-center rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-[color:var(--sn-muted)]" />
      <p className="text-sm text-[color:var(--sn-muted)]">{message}</p>
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
      <p className="text-[11px] font-medium uppercase text-[color:var(--sn-faint)]">{label}</p>
      <div
        className={cn(
          "mt-1 break-words text-sm font-medium text-[color:var(--sn-ink)]",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TruncatedText({
  className,
  value
}: {
  className?: string;
  value?: string | null;
}) {
  const text = formatText(value);
  return (
    <span className={cn("block min-w-0 truncate", className)} title={text}>
      {text}
    </span>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="min-w-0 px-4 py-3 align-middle text-[color:var(--sn-body)]">{children}</td>;
}

function statusTone(status: AttendanceImportBatchStatus) {
  const tones: Record<AttendanceImportBatchStatus, string> = {
    UPLOADED: "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]",
    VALIDATED: "border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    CONFIRMED: "border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    ACTIVE: "border-[oklch(0.82_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    REPLACED: "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]",
    FAILED: "border-destructive/40 bg-destructive/10 text-destructive",
    LOCKED: "border-[oklch(0.75_0.1_70)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.55_0.14_65)]"
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
