"use client";

import {
  Archive,
  AlertCircle,
  CheckCircle2,
  DatabaseZap,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import {
  attendanceOperationsApi,
  type AttendanceMaintenanceMonth,
  type AttendanceMaintenanceOperation,
  type AttendanceMaintenancePreview,
  type AttendanceMaintenancePreviewInput,
  type AttendanceMaintenanceResult
} from "@/lib/api/attendance-operations";
import { clearApiCache } from "@/lib/api/request";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "idle"; data?: never; error?: never }
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const confirmationTextByOperation: Record<AttendanceMaintenanceOperation, string> = {
  DELETE_RANGE: "DELETE ATTENDANCE DATA",
  DELETE_MONTH: "DELETE ATTENDANCE DATA",
  DELETE_ALL: "DELETE ATTENDANCE DATA",
  RECALCULATE_SUMMARIES: "RECALCULATE ATTENDANCE SUMMARIES",
  COMPRESS_OLD_MONTHS: "COMPRESS ATTENDANCE MONTHS"
};

const operations: Array<{
  description: string;
  icon: typeof Trash2;
  operation: AttendanceMaintenanceOperation;
  tone: "danger" | "neutral";
  title: string;
}> = [
  {
    description: "Remove attendance rows and summaries inside a selected range.",
    icon: Trash2,
    operation: "DELETE_RANGE",
    tone: "danger",
    title: "Delete by date range"
  },
  {
    description: "Remove all attendance data for one month.",
    icon: Trash2,
    operation: "DELETE_MONTH",
    tone: "danger",
    title: "Delete month"
  },
  {
    description: "Remove all Attendance Analytics data.",
    icon: ShieldAlert,
    operation: "DELETE_ALL",
    tone: "danger",
    title: "Delete all attendance data"
  },
  {
    description: "Rebuild monthly summaries from retained daily records.",
    icon: RotateCcw,
    operation: "RECALCULATE_SUMMARIES",
    tone: "neutral",
    title: "Recalculate summaries"
  },
  {
    description: "Compress old detailed months after summaries are verified.",
    icon: Archive,
    operation: "COMPRESS_OLD_MONTHS",
    tone: "neutral",
    title: "Compress old months"
  }
];

export function AttendanceOperationsMaintenancePage() {
  const [monthsState, setMonthsState] =
    useState<AsyncState<AttendanceMaintenanceMonth[]>>({ status: "loading" });
  const [selectedOperation, setSelectedOperation] =
    useState<AttendanceMaintenanceOperation>("DELETE_MONTH");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [monthKey, setMonthKey] = useState("");
  const [recalculateMonthKey, setRecalculateMonthKey] = useState("");
  const [beforeMonthKey, setBeforeMonthKey] = useState("");
  const [previewState, setPreviewState] =
    useState<AsyncState<AttendanceMaintenancePreview>>({ status: "idle" });
  const [resultState, setResultState] =
    useState<AsyncState<AttendanceMaintenanceResult>>({ status: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = useMemo(
    () => operations.find((item) => item.operation === selectedOperation) ?? operations[0],
    [selectedOperation]
  );
  const busy = previewState.status === "loading" || resultState.status === "loading";

  async function loadMonths() {
    setMonthsState({ status: "loading" });
    try {
      clearApiCache("/attendance-operations/maintenance/months");
      const response = await attendanceOperationsApi.listAttendanceMaintenanceMonths();
      setMonthsState({ status: "ready", data: response.items });
    } catch (error) {
      setMonthsState({
        status: "error",
        error: getErrorMessage(error, "Unable to load attendance month status.")
      });
    }
  }

  useEffect(() => {
    void loadMonths();
  }, []);

  async function previewOperation() {
    setPreviewState({ status: "loading" });
    setResultState({ status: "idle" });
    try {
      const preview = await attendanceOperationsApi.previewAttendanceMaintenance(
        buildPreviewInput()
      );
      setPreviewState({ status: "ready", data: preview });
    } catch (error) {
      setPreviewState({
        status: "error",
        error: getErrorMessage(error, "Unable to preview maintenance impact.")
      });
    }
  }

  async function confirmOperation() {
    setConfirmOpen(false);
    setResultState({ status: "loading" });
    try {
      const confirmationText = confirmationTextByOperation[selectedOperation];
      const result = await runConfirmedOperation(confirmationText);
      setResultState({ status: "ready", data: result });
      clearApiCache("/attendance-operations/imports");
      await loadMonths();
    } catch (error) {
      setResultState({
        status: "error",
        error: getErrorMessage(error, "Maintenance operation failed.")
      });
    }
  }

  function buildPreviewInput(): AttendanceMaintenancePreviewInput {
    if (selectedOperation === "DELETE_RANGE") {
      return {
        operation: selectedOperation,
        periodFrom: rangeFrom,
        periodTo: rangeTo
      };
    }

    if (selectedOperation === "DELETE_MONTH") {
      return {
        operation: selectedOperation,
        monthKey
      };
    }

    if (selectedOperation === "RECALCULATE_SUMMARIES") {
      return {
        operation: selectedOperation,
        monthKey: recalculateMonthKey
      };
    }

    if (selectedOperation === "COMPRESS_OLD_MONTHS") {
      return {
        operation: selectedOperation,
        beforeMonthKey: beforeMonthKey || undefined
      };
    }

    return { operation: selectedOperation };
  }

  function runConfirmedOperation(confirmationText: string) {
    if (selectedOperation === "DELETE_RANGE") {
      return attendanceOperationsApi.deleteAttendanceRange({
        periodFrom: rangeFrom,
        periodTo: rangeTo,
        confirmationText
      });
    }

    if (selectedOperation === "DELETE_MONTH") {
      return attendanceOperationsApi.deleteAttendanceMonth({
        monthKey,
        confirmationText
      });
    }

    if (selectedOperation === "DELETE_ALL") {
      return attendanceOperationsApi.deleteAllAttendanceData({ confirmationText });
    }

    if (selectedOperation === "RECALCULATE_SUMMARIES") {
      return attendanceOperationsApi.recalculateAttendanceSummaries({
        monthKey: recalculateMonthKey,
        confirmationText
      });
    }

    return attendanceOperationsApi.compressOldAttendanceMonths({
      beforeMonthKey: beforeMonthKey || undefined,
      confirmationText
    });
  }

  const canConfirm =
    previewState.status === "ready" && previewState.data.canProceed && !busy;

  return (
    <div className="grid gap-5">
      <header>
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Data Maintenance</h2>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Preview, recalculate, delete, and compress attendance data safely.
        </p>
      </header>

      <MonthRetentionStatus
        monthsState={monthsState}
        onRefresh={() => void loadMonths()}
      />

      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Danger Zone</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Every action requires impact preview and typed confirmation.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <OperationSelector
            disabled={busy}
            onSelect={(operation) => {
              setSelectedOperation(operation);
              setPreviewState({ status: "idle" });
              setResultState({ status: "idle" });
            }}
            selectedOperation={selectedOperation}
          />

          <div className="grid gap-4">
            <section className="rounded-lg border bg-muted/15 p-4">
              <div className="flex items-start gap-3">
                <selected.icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    selected.tone === "danger" ? "text-red-600" : "text-primary"
                  )}
                />
                <div className="min-w-0">
                  <h4 className="font-semibold">{selected.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selected.description}
                  </p>
                </div>
              </div>

              <MaintenanceOperationFields
                beforeMonthKey={beforeMonthKey}
                disabled={busy}
                monthKey={monthKey}
                operation={selectedOperation}
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                recalculateMonthKey={recalculateMonthKey}
                setBeforeMonthKey={setBeforeMonthKey}
                setMonthKey={setMonthKey}
                setRangeFrom={setRangeFrom}
                setRangeTo={setRangeTo}
                setRecalculateMonthKey={setRecalculateMonthKey}
              />

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="min-h-11 gap-2"
                  disabled={busy}
                  onClick={() => void previewOperation()}
                  type="button"
                  variant="outline"
                >
                  {previewState.status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <DatabaseZap className="h-4 w-4" />
                  )}
                  Preview Impact
                </Button>
                <Button
                  className={cn(
                    "min-h-11 gap-2",
                    selected.tone === "danger" &&
                      "bg-red-600 text-white hover:bg-red-700"
                  )}
                  disabled={!canConfirm}
                  onClick={() => setConfirmOpen(true)}
                  type="button"
                >
                  {resultState.status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selected.tone === "danger" ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm Operation
                </Button>
              </div>
            </section>

            {previewState.status === "error" ? (
              <InlineAlert message={previewState.error} tone="danger" />
            ) : null}
            {previewState.status === "ready" ? (
              <MaintenancePreviewPanel preview={previewState.data} />
            ) : null}
            {resultState.status === "error" ? (
              <InlineAlert message={resultState.error} tone="danger" />
            ) : null}
            {resultState.status === "ready" ? (
              <MaintenanceResultPanel result={resultState.data} />
            ) : null}
          </div>
        </div>
      </section>

      {confirmOpen && previewState.status === "ready" ? (
        <MaintenanceConfirmDialog
          disabled={busy}
          operation={selectedOperation}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void confirmOperation()}
          preview={previewState.data}
        />
      ) : null}
    </div>
  );
}

function MonthRetentionStatus({
  monthsState,
  onRefresh
}: {
  monthsState: AsyncState<AttendanceMaintenanceMonth[]>;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <DatabaseZap className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Month Retention Status</h3>
        </div>
        <Button className="min-h-10 gap-2" onClick={onRefresh} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mt-5">
        {monthsState.status === "loading" ? (
          <DetailPanelSkeleton label="Loading attendance month status" />
        ) : null}
        {monthsState.status === "error" ? (
          <InlineAlert message={monthsState.error} tone="danger" />
        ) : null}
        {monthsState.status === "ready" ? (
          monthsState.data.length ? (
            <MonthStatusList months={monthsState.data} />
          ) : (
            <EmptyState
              message="No attendance data has been imported yet."
              title="No attendance months"
            />
          )
        ) : null}
      </div>
    </section>
  );
}

function MonthStatusList({ months }: { months: AttendanceMaintenanceMonth[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-3 pr-4">Month</th>
              <th className="py-3 pr-4">Daily records</th>
              <th className="py-3 pr-4">User summaries</th>
              <th className="py-3 pr-4">Branch summaries</th>
              <th className="py-3 pr-4">Chain summaries</th>
              <th className="py-3 pr-4">Archive status</th>
              <th className="py-3">Last import</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr className="border-b last:border-0" key={month.monthKey}>
                <td className="py-3 pr-4 font-medium">{month.monthKey}</td>
                <td className="py-3 pr-4">{month.dailyRecordsCount}</td>
                <td className="py-3 pr-4">{month.userSummariesCount}</td>
                <td className="py-3 pr-4">{month.branchSummariesCount}</td>
                <td className="py-3 pr-4">{month.chainSummariesCount}</td>
                <td className="py-3 pr-4">
                  <ArchiveStatusBadge status={month.archiveStatus} />
                </td>
                <td className="py-3">
                  {month.lastImportAt ? formatDateTime(month.lastImportAt) : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {months.map((month) => (
          <article className="rounded-lg border p-3" key={month.monthKey}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{month.monthKey}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last import:{" "}
                  {month.lastImportAt ? formatDateTime(month.lastImportAt) : "N/A"}
                </p>
              </div>
              <ArchiveStatusBadge status={month.archiveStatus} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Definition label="Daily" value={month.dailyRecordsCount} />
              <Definition label="Users" value={month.userSummariesCount} />
              <Definition label="Branches" value={month.branchSummariesCount} />
              <Definition label="Chains" value={month.chainSummariesCount} />
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function OperationSelector({
  disabled,
  onSelect,
  selectedOperation
}: {
  disabled: boolean;
  onSelect: (operation: AttendanceMaintenanceOperation) => void;
  selectedOperation: AttendanceMaintenanceOperation;
}) {
  return (
    <nav aria-label="Attendance maintenance operations" className="grid gap-2">
      {operations.map((item) => (
        <button
          className={cn(
            "min-h-11 rounded-lg border px-3 py-3 text-left transition hover:border-primary/40",
            selectedOperation === item.operation
              ? "border-primary bg-brand-soft"
              : "bg-card",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          )}
          disabled={disabled}
          key={item.operation}
          onClick={() => onSelect(item.operation)}
          type="button"
        >
          <span className="flex items-start gap-2">
            <item.icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                item.tone === "danger" ? "text-red-600" : "text-primary"
              )}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {item.description}
              </span>
            </span>
          </span>
        </button>
      ))}
    </nav>
  );
}

function MaintenanceOperationFields({
  beforeMonthKey,
  disabled,
  monthKey,
  operation,
  rangeFrom,
  rangeTo,
  recalculateMonthKey,
  setBeforeMonthKey,
  setMonthKey,
  setRangeFrom,
  setRangeTo,
  setRecalculateMonthKey
}: {
  beforeMonthKey: string;
  disabled: boolean;
  monthKey: string;
  operation: AttendanceMaintenanceOperation;
  rangeFrom: string;
  rangeTo: string;
  recalculateMonthKey: string;
  setBeforeMonthKey: (value: string) => void;
  setMonthKey: (value: string) => void;
  setRangeFrom: (value: string) => void;
  setRangeTo: (value: string) => void;
  setRecalculateMonthKey: (value: string) => void;
}) {
  if (operation === "DELETE_RANGE") {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <Input
            disabled={disabled}
            onChange={(event) => setRangeFrom(event.target.value)}
            type="date"
            value={rangeFrom}
          />
        </Field>
        <Field label="To">
          <Input
            disabled={disabled}
            onChange={(event) => setRangeTo(event.target.value)}
            type="date"
            value={rangeTo}
          />
        </Field>
      </div>
    );
  }

  if (operation === "DELETE_MONTH") {
    return (
      <Field className="mt-4 max-w-sm" label="Month">
        <Input
          disabled={disabled}
          onChange={(event) => setMonthKey(event.target.value)}
          type="month"
          value={monthKey}
        />
      </Field>
    );
  }

  if (operation === "RECALCULATE_SUMMARIES") {
    return (
      <Field className="mt-4 max-w-sm" label="Month">
        <Input
          disabled={disabled}
          onChange={(event) => setRecalculateMonthKey(event.target.value)}
          type="month"
          value={recalculateMonthKey}
        />
      </Field>
    );
  }

  if (operation === "COMPRESS_OLD_MONTHS") {
    return (
      <Field className="mt-4 max-w-sm" label="Before month optional">
        <Input
          disabled={disabled}
          onChange={(event) => setBeforeMonthKey(event.target.value)}
          type="month"
          value={beforeMonthKey}
        />
      </Field>
    );
  }

  return (
    <InlineAlert
      message="This preview covers all attendance module data."
      tone="warning"
    />
  );
}

function MaintenancePreviewPanel({
  preview
}: {
  preview: AttendanceMaintenancePreview;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <DatabaseZap className="h-4 w-4 text-primary" />
          <h4 className="font-semibold">Impact Preview</h4>
        </div>
        <Badge variant={preview.canProceed ? "outline" : "default"}>
          {preview.canProceed ? "Can proceed" : "Blocked"}
        </Badge>
      </div>

      <ImpactMetrics preview={preview} />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <NoticeList
          emptyText="No blockers."
          items={preview.blockers}
          title="Blockers"
          tone="danger"
        />
        <NoticeList
          emptyText="No warnings."
          items={preview.warnings}
          title="Warnings"
          tone="warning"
        />
      </div>

      <section className="mt-4 rounded-lg bg-muted/25 p-3">
        <h5 className="text-sm font-semibold">Safety boundary</h5>
        <ul className="mt-2 grid gap-1 text-sm leading-6 text-muted-foreground">
          {preview.safetyNotice.map((item) => (
            <li className="flex gap-2" key={item}>
              <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function MaintenanceResultPanel({
  result
}: {
  result: AttendanceMaintenanceResult;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <h4 className="font-semibold">Final Result</h4>
      </div>
      <ImpactMetrics preview={result} />
      {result.batchId ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Maintenance batch: {result.batchId}
        </p>
      ) : null}
    </section>
  );
}

function ImpactMetrics({
  preview
}: {
  preview: AttendanceMaintenancePreview | AttendanceMaintenanceResult;
}) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Daily records" value={preview.attendanceDailyRecordsAffected} />
      <MetricCard label="User summaries" value={preview.monthlyUserSummariesAffected} />
      <MetricCard
        label="Branch summaries"
        value={preview.monthlyBranchSummariesAffected}
      />
      <MetricCard
        label="Chain summaries"
        value={preview.monthlyChainSummariesAffected}
      />
      <MetricCard label="Import batches" value={preview.importBatchesAffected} />
      <MetricCard label="Issues" value={preview.importIssuesAffected} />
      <MetricCard
        label="Months"
        value={
          preview.monthKeysAffected.length
            ? preview.monthKeysAffected.join(", ")
            : "None"
        }
      />
      <MetricCard
        label="Date range"
        value={
          preview.dateRangeAffected.periodFrom && preview.dateRangeAffected.periodTo
            ? `${formatDate(preview.dateRangeAffected.periodFrom)} to ${formatDate(
                preview.dateRangeAffected.periodTo
              )}`
            : "All attendance data"
        }
      />
    </dl>
  );
}

function NoticeList({
  emptyText,
  items,
  title,
  tone
}: {
  emptyText: string;
  items: string[];
  title: string;
  tone: "danger" | "warning";
}) {
  return (
    <section className="rounded-lg border p-3">
      <h5 className="text-sm font-semibold">{title}</h5>
      {items.length ? (
        <ul className="mt-2 grid gap-2 text-sm leading-6">
          {items.map((item) => (
            <li className="flex gap-2" key={item}>
              <AlertCircle
                className={cn(
                  "mt-1 h-3.5 w-3.5 shrink-0",
                  tone === "danger" ? "text-red-600" : "text-amber-600"
                )}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}

function MaintenanceConfirmDialog({
  disabled,
  onClose,
  onConfirm,
  operation,
  preview
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  operation: AttendanceMaintenanceOperation;
  preview: AttendanceMaintenancePreview;
}) {
  const [typedText, setTypedText] = useState("");
  const requiredText = confirmationTextByOperation[operation];
  const canConfirm = typedText === requiredText && !disabled;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/45 p-0 sm:place-items-center sm:p-4">
        <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border bg-card p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Badge variant="outline">Typed confirmation required</Badge>
              <h3 className="mt-3 text-lg font-semibold">
                Confirm Attendance Maintenance
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This operation affects attendance tables only. It does not touch
                users, assignments, requests, approvals, notifications, or audit
                logs.
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
            <Definition label="Operation" value={formatEnum(operation)} />
            <Definition label="Daily records" value={preview.attendanceDailyRecordsAffected} />
            <Definition label="Required text" value={requiredText} />
          </dl>

          <Field className="mt-4" label="Type confirmation">
            <Input
              autoComplete="off"
              onChange={(event) => setTypedText(event.target.value)}
              placeholder={requiredText}
              value={typedText}
            />
          </Field>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className={cn(
                operation.startsWith("DELETE") &&
                  "bg-red-600 text-white hover:bg-red-700"
              )}
              disabled={!canConfirm}
              onClick={onConfirm}
              type="button"
            >
              Confirm Operation
            </Button>
          </div>
        </section>
      </div>
    </ModalPortal>
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
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 break-words text-base font-semibold">{value}</dd>
    </div>
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

function EmptyState({ message, title }: { message: string; title: string }) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-5 text-center shadow-sm">
      <DatabaseZap className="mx-auto h-7 w-7 text-muted-foreground" />
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{message}</p>
    </section>
  );
}

function InlineAlert({
  message,
  tone
}: {
  message: string;
  tone: "danger" | "success" | "warning";
}) {
  const toneClass = {
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900"
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3", toneClass)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm leading-6">{message}</p>
    </div>
  );
}

function ArchiveStatusBadge({
  status
}: {
  status: AttendanceMaintenanceMonth["archiveStatus"];
}) {
  const variant = status === "EMPTY" ? "muted" : status === "ACTIVE_MTD" ? "default" : "outline";
  return <Badge variant={variant}>{formatEnum(status)}</Badge>;
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
