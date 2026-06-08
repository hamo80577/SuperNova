"use client";

import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Inbox,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShoppingCart,
  UploadCloud,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DetailPanelSkeleton,
  StatsCardSkeleton,
  TableRowsSkeleton
} from "@/components/ui/skeleton";
import {
  ordersKpisApi,
  type OrdersKpiDailyReportResponse,
  type OrdersKpiDailyReportRow,
  type OrdersKpiDailyReportSortBy,
  type OrdersKpiDailyReportSortDirection,
  type OrdersKpiImportBatchStatus,
  type OrdersKpiImportConfirmResponse,
  type OrdersKpiImportPreviewResponse,
  type OrdersKpiIssueSeverity,
  type OrdersKpiPreviewIssue
} from "@/lib/api/orders-kpis";
import { cn } from "@/lib/utils";

type AsyncReportState =
  | { status: "loading"; data?: OrdersKpiDailyReportResponse; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: OrdersKpiDailyReportResponse; error?: never };

type AsyncActionState =
  | { status: "idle"; error?: never }
  | { status: "loading"; error?: never }
  | { status: "error"; error: string };

type ConfirmState =
  | { status: "idle"; data?: never; error?: never }
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "confirmed"; data: OrdersKpiImportConfirmResponse; error?: never };

interface OrdersKpiFilters {
  chainId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  pickerSearch: string;
  shopperId: string;
  sortBy: OrdersKpiDailyReportSortBy;
  sortDirection: OrdersKpiDailyReportSortDirection;
  vendorId: string;
}

const pageSizes = [25, 50, 100];
const issuePreviewLimit = 50;
const sortOptions: Array<{ label: string; value: OrdersKpiDailyReportSortBy }> = [
  { label: "Date", value: "date" },
  { label: "Picker name", value: "pickerName" },
  { label: "Shopper ID", value: "shopperId" },
  { label: "Total orders", value: "totalOrders" },
  { label: "Successful orders", value: "successfulOrders" },
  { label: "Success rate", value: "successRate" },
  { label: "Preparation time", value: "preparationTime" }
];

export function OrdersKpisPage() {
  const initialFilters = useMemo(createInitialFilters, []);
  const [filters, setFilters] = useState<OrdersKpiFilters>(initialFilters);
  const [draftFilters, setDraftFilters] =
    useState<OrdersKpiFilters>(initialFilters);
  const [reportState, setReportState] = useState<AsyncReportState>({
    status: "loading"
  });
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] =
    useState<OrdersKpiImportPreviewResponse | null>(null);
  const [previewState, setPreviewState] = useState<AsyncActionState>({
    status: "idle"
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    status: "idle"
  });

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      setReportState((current) =>
        current.status === "ready" || current.status === "loading"
          ? { status: "loading", data: current.data }
          : { status: "loading" }
      );

      try {
        const data = await ordersKpisApi.dailyReport(filters);
        if (mounted) {
          setReportState({ status: "ready", data });
        }
      } catch (error) {
        if (mounted) {
          setReportState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to load Orders KPIs report."
          });
        }
      }
    }

    void loadReport();
    return () => {
      mounted = false;
    };
  }, [filters, reportRefreshKey]);

  const selectedFileLabel = file
    ? `${file.name} (${formatFileSize(file.size)})`
    : "No file selected";
  const canConfirm =
    Boolean(preview?.batchId && preview.canConfirm) &&
    confirmState.status !== "confirmed";
  const report =
    reportState.status === "ready"
      ? reportState.data
      : reportState.status === "loading"
        ? reportState.data ?? null
        : null;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
  }

  async function handlePreview() {
    if (!file) {
      setPreviewState({
        status: "error",
        error: "Choose a CSV or XLSX Orders KPI sheet before previewing."
      });
      return;
    }

    setPreviewState({ status: "loading" });
    setConfirmState({ status: "idle" });

    try {
      const nextPreview = await ordersKpisApi.previewImport(file);
      setPreview(nextPreview);
      setPreviewState({ status: "idle" });
    } catch (error) {
      setPreview(null);
      setPreviewState({
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

    setConfirmState({ status: "loading" });

    try {
      const result = await ordersKpisApi.confirmImport(preview.batchId);
      setConfirmState({ status: "confirmed", data: result });
      if (result.dateFrom && result.dateTo) {
        const nextFilters = {
          ...filters,
          dateFrom: result.dateFrom,
          dateTo: result.dateTo,
          page: 1
        };
        setFilters(nextFilters);
        setDraftFilters(nextFilters);
      } else {
        setReportRefreshKey((current) => current + 1);
      }
      setFile(null);
      setFileInputKey((current) => current + 1);
    } catch (error) {
      setConfirmState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm Orders KPI import."
      });
    }
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({
      ...draftFilters,
      dateFrom: normalizeDateInput(draftFilters.dateFrom),
      dateTo: normalizeDateInput(draftFilters.dateTo),
      page: 1
    });
  }

  function handleClearFilters() {
    const nextFilters = createInitialFilters();
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
  }

  function handleRefreshReport() {
    ordersKpisApi.clearDailyReportCache();
    setReportRefreshKey((current) => current + 1);
  }

  function handlePageChange(page: number) {
    setFilters((current) => ({
      ...current,
      page
    }));
    setDraftFilters((current) => ({
      ...current,
      page
    }));
  }

  function clearUploadState() {
    setFile(null);
    setPreview(null);
    setPreviewState({ status: "idle" });
    setConfirmState({ status: "idle" });
    setFileInputKey((current) => current + 1);
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-slate-50/80 p-3 sm:p-4">
      <div className="grid min-w-0 gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              Orders KPIs
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Upload daily, weekly, or monthly picker order KPI sheets and
              review confirmed performance data by row date.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              className="h-11 rounded-xl"
              onClick={handleRefreshReport}
              type="button"
              variant="outline"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh report
            </Button>
            <Button
              className="h-11 rounded-xl"
              onClick={clearUploadState}
              type="button"
              variant="outline"
            >
              <X className="mr-2 h-4 w-4" />
              Clear upload
            </Button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <UploadSection
            canConfirm={canConfirm}
            confirmState={confirmState}
            fileInputKey={fileInputKey}
            fileLabel={selectedFileLabel}
            onConfirm={handleConfirm}
            onFileChange={handleFileChange}
            onPreview={handlePreview}
            preview={preview}
            previewState={previewState}
          />
          <PreviewSection
            confirmState={confirmState}
            preview={preview}
            previewState={previewState}
          />
        </section>

        <ReportSection
          draftFilters={draftFilters}
          filters={filters}
          onClearFilters={handleClearFilters}
          onDraftFiltersChange={setDraftFilters}
          onFilterSubmit={handleFilterSubmit}
          onPageChange={handlePageChange}
          report={report}
          reportState={reportState}
        />
      </div>
    </div>
  );
}

function UploadSection({
  canConfirm,
  confirmState,
  fileInputKey,
  fileLabel,
  onConfirm,
  onFileChange,
  onPreview,
  preview,
  previewState
}: {
  canConfirm: boolean;
  confirmState: ConfirmState;
  fileInputKey: number;
  fileLabel: string;
  onConfirm: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
  preview: OrdersKpiImportPreviewResponse | null;
  previewState: AsyncActionState;
}) {
  const confirmDisabled =
    !canConfirm || confirmState.status === "loading" || previewState.status === "loading";

  return (
    <section className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeading
        description="Preview backend validation before any confirmed row is written."
        icon={<UploadCloud className="h-5 w-5" />}
        title="Upload Orders KPI Sheet"
      />

      <label className="grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5">
        <input
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          key={fileInputKey}
          onChange={onFileChange}
          type="file"
        />
        <span className="grid gap-2">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" />
          <span className="break-words text-sm font-semibold text-slate-950">
            {fileLabel}
          </span>
          <span className="text-xs leading-5 text-slate-500">
            CSV or XLSX. Preview is validation only; it does not import rows.
          </span>
        </span>
      </label>

      {previewState.status === "error" ? (
        <InlineError message={previewState.error} />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="h-11 rounded-xl"
          disabled={previewState.status === "loading"}
          onClick={onPreview}
          type="button"
        >
          {previewState.status === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {previewState.status === "loading" ? "Previewing" : "Preview file"}
        </Button>
        <Button
          className="h-11 rounded-xl"
          disabled={confirmDisabled}
          onClick={onConfirm}
          type="button"
          variant="outline"
        >
          {confirmState.status === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {confirmState.status === "loading" ? "Confirming" : "Confirm import"}
        </Button>
      </div>

      {preview && !preview.canConfirm ? (
        <InlineWarning message="Fix blocking errors in the sheet before confirming." />
      ) : null}

      {confirmState.status === "error" ? (
        <InlineError message={confirmState.error} />
      ) : null}

      {confirmState.status === "confirmed" ? (
        <ConfirmedImportResult result={confirmState.data} />
      ) : null}
    </section>
  );
}

function PreviewSection({
  confirmState,
  preview,
  previewState
}: {
  confirmState: ConfirmState;
  preview: OrdersKpiImportPreviewResponse | null;
  previewState: AsyncActionState;
}) {
  if (!preview && previewState.status === "loading") {
    return <DetailPanelSkeleton label="Loading Orders KPI preview" />;
  }

  if (!preview) {
    return (
      <section className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div>
          <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-950">
            No preview loaded
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            Choose an Orders KPI sheet to inspect matched rows, blocking errors,
            warnings, and date coverage before confirmation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeading
        description="Validation result from the staging preview batch."
        icon={<ClipboardList className="h-5 w-5" />}
        title="Preview validation result"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Definition label="Rows" value={preview.preview.rowCount} />
        <Definition label="Matched" value={preview.preview.matchedRows} />
        <Definition label="Unmatched" value={preview.preview.unmatchedRows} />
        <Definition label="Errors" value={preview.preview.errorRows} />
        <Definition label="Warnings" value={preview.preview.warningRows} />
        <Definition label="Date From" value={formatDate(preview.preview.dateFrom)} />
        <Definition label="Date To" value={formatDate(preview.preview.dateTo)} />
        <Definition
          label="Can Confirm"
          value={
            <StatusBadge
              label={preview.canConfirm ? "Yes" : "No"}
              tone={preview.canConfirm ? "success" : "danger"}
            />
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={formatEnum(preview.status)} tone={statusTone(preview.status)} />
        <Badge variant="outline">
          <span className="tabular-nums">{preview.stagingRowCount}</span>
          <span className="ml-1">staging rows</span>
        </Badge>
        <Badge variant={preview.issueCount > 0 ? "outline" : "muted"}>
          <span className="tabular-nums">{preview.issueCount}</span>
          <span className="ml-1">issues</span>
        </Badge>
        {confirmState.status === "confirmed" ? (
          <StatusBadge label="Confirmed" tone="success" />
        ) : null}
      </div>

      <IssuesPreviewTable issues={preview.preview.issues} />
    </section>
  );
}

function IssuesPreviewTable({ issues }: { issues: OrdersKpiPreviewIssue[] }) {
  const visibleIssues = issues.slice(0, issuePreviewLimit);

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Issues preview
          </h3>
          <p className="text-xs leading-5 text-slate-500">
            Showing first {Math.min(issues.length, issuePreviewLimit)} of{" "}
            {issues.length} validation issues.
          </p>
        </div>
      </div>

      {issues.length === 0 ? (
        <EmptyState message="No validation issues returned by the backend." />
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[29%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <TableHeader>Row</TableHeader>
                  <TableHeader>Shopper ID</TableHeader>
                  <TableHeader>Severity</TableHeader>
                  <TableHeader>Code</TableHeader>
                  <TableHeader>Field</TableHeader>
                  <TableHeader>Message</TableHeader>
                </tr>
              </thead>
              <tbody>
                {visibleIssues.map((issue, index) => (
                  <tr
                    className="border-b border-slate-100 last:border-0"
                    key={`${issue.issueCode}-${issue.rowNumber ?? "batch"}-${index}`}
                  >
                    <TableCell>{formatNullable(issue.rowNumber)}</TableCell>
                    <TableCell>
                      <TruncatedText value={issue.shopperId} />
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={issue.severity} />
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
          </div>
        </div>
      )}
    </div>
  );
}

function ReportSection({
  draftFilters,
  filters,
  onClearFilters,
  onDraftFiltersChange,
  onFilterSubmit,
  onPageChange,
  report,
  reportState
}: {
  draftFilters: OrdersKpiFilters;
  filters: OrdersKpiFilters;
  onClearFilters: () => void;
  onDraftFiltersChange: (filters: OrdersKpiFilters) => void;
  onFilterSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPageChange: (page: number) => void;
  report: OrdersKpiDailyReportResponse | null;
  reportState: AsyncReportState;
}) {
  return (
    <section className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <SectionHeading
          description="Confirmed rows only. Preview staging rows never appear here until confirmed."
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Orders KPIs Report"
        />
        {report ? (
          <p className="text-xs leading-5 text-slate-500">
            Showing {report.rows.length} of{" "}
            {report.pagination.totalRows.toLocaleString()} rows for{" "}
            {formatRangeLabel(report.dateFrom, report.dateTo)}.
          </p>
        ) : null}
      </div>

      <ReportFilters
        draftFilters={draftFilters}
        onClearFilters={onClearFilters}
        onDraftFiltersChange={onDraftFiltersChange}
        onSubmit={onFilterSubmit}
      />

      {reportState.status === "loading" && !report ? (
        <>
          <div
            aria-busy="true"
            aria-label="Loading Orders KPI summary"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            role="status"
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <StatsCardSkeleton key={index} />
            ))}
          </div>
          <TableRowsSkeleton label="Loading Orders KPI rows" rows={6} />
        </>
      ) : null}

      {reportState.status === "error" ? (
        <InlineError
          message={`Unable to load Orders KPIs report. ${reportState.error}`}
        />
      ) : null}

      {report ? (
        <>
          <SummaryCards summary={report.summary} />
          <OrdersKpiRowsTable rows={report.rows} />
          <PaginationBar
            onPageChange={onPageChange}
            page={filters.page}
            pagination={report.pagination}
          />
        </>
      ) : null}
    </section>
  );
}

function ReportFilters({
  draftFilters,
  onClearFilters,
  onDraftFiltersChange,
  onSubmit
}: {
  draftFilters: OrdersKpiFilters;
  onClearFilters: () => void;
  onDraftFiltersChange: (filters: OrdersKpiFilters) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function updateFilter<K extends keyof OrdersKpiFilters>(
    key: K,
    value: OrdersKpiFilters[K]
  ) {
    onDraftFiltersChange({
      ...draftFilters,
      [key]: value
    });
  }

  return (
    <form
      className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Date From">
          <Input
            className="rounded-xl bg-white"
            onChange={(event) => updateFilter("dateFrom", event.target.value)}
            type="date"
            value={draftFilters.dateFrom}
          />
        </Field>
        <Field label="Date To">
          <Input
            className="rounded-xl bg-white"
            onChange={(event) => updateFilter("dateTo", event.target.value)}
            type="date"
            value={draftFilters.dateTo}
          />
        </Field>
        <Field label="Picker search">
          <Input
            className="rounded-xl bg-white"
            onChange={(event) => updateFilter("pickerSearch", event.target.value)}
            placeholder="Picker name"
            value={draftFilters.pickerSearch}
          />
        </Field>
        <Field label="Shopper ID">
          <Input
            className="rounded-xl bg-white"
            onChange={(event) => updateFilter("shopperId", event.target.value)}
            placeholder="Shopper ID"
            value={draftFilters.shopperId}
          />
        </Field>
        <Field label="Vendor ID">
          <Input
            className="rounded-xl bg-white"
            onChange={(event) => updateFilter("vendorId", event.target.value)}
            placeholder="Vendor source ID"
            value={draftFilters.vendorId}
          />
        </Field>
        <Field label="Chain ID">
          <Input
            className="rounded-xl bg-white"
            onChange={(event) => updateFilter("chainId", event.target.value)}
            placeholder="Chain ID"
            value={draftFilters.chainId}
          />
        </Field>
        <Field label="Sort">
          <Select
            aria-label="Orders KPI sort field"
            className="rounded-xl bg-white"
            leadingIcon={<ArrowUpDown className="h-4 w-4" />}
            onChange={(event) =>
              updateFilter(
                "sortBy",
                event.target.value as OrdersKpiDailyReportSortBy
              )
            }
            value={draftFilters.sortBy}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Page size">
          <Select
            aria-label="Orders KPI page size"
            className="rounded-xl bg-white"
            onChange={(event) =>
              updateFilter("pageSize", Number(event.target.value))
            }
            value={draftFilters.pageSize}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Field label="Direction" compact>
          <Select
            aria-label="Orders KPI sort direction"
            className="rounded-xl bg-white"
            onChange={(event) =>
              updateFilter(
                "sortDirection",
                event.target.value as OrdersKpiDailyReportSortDirection
              )
            }
            value={draftFilters.sortDirection}
            wrapperClassName="w-full sm:w-44"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Button className="h-11 rounded-xl" type="submit">
            <Search className="mr-2 h-4 w-4" />
            Apply filters
          </Button>
          <Button
            className="h-11 rounded-xl"
            onClick={onClearFilters}
            type="button"
            variant="outline"
          >
            Clear filters
          </Button>
        </div>
      </div>
    </form>
  );
}

function SummaryCards({
  summary
}: {
  summary: OrdersKpiDailyReportResponse["summary"];
}) {
  const cards: Array<{ label: string; value: ReactNode }> = [
    { label: "Total Orders", value: formatNumber(summary.totalOrders) },
    { label: "Successful Orders", value: formatNumber(summary.successfulOrders) },
    { label: "Success Rate", value: formatPercent(summary.successRate) },
    { label: "Unhealthy Orders", value: formatNumber(summary.unhealthyOrders) },
    { label: "Not On Time", value: formatNumber(summary.orderNotOnTime) },
    {
      label: "Avg Preparation Time",
      value: formatPreparationTime(summary.averagePreparationTime)
    },
    { label: "Out of Stock", value: formatNumber(summary.outOfStock) },
    { label: "Vendor Delay", value: formatNumber(summary.vendorDelay) }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <section
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          key={card.label}
        >
          <p className="text-2xl font-semibold tabular-nums text-slate-950">
            {card.value}
          </p>
          <p className="mt-1 text-sm text-slate-500">{card.label}</p>
        </section>
      ))}
    </div>
  );
}

function OrdersKpiRowsTable({ rows }: { rows: OrdersKpiDailyReportRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState message="No confirmed Orders KPI records found for this filter." />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1260px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <TableHeader>Date</TableHeader>
              <TableHeader>Picker</TableHeader>
              <TableHeader>Shopper ID</TableHeader>
              <TableHeader>Vendor ID</TableHeader>
              <TableHeader>Total Orders</TableHeader>
              <TableHeader>Successful</TableHeader>
              <TableHeader>Success %</TableHeader>
              <TableHeader>Unhealthy</TableHeader>
              <TableHeader>Not on time</TableHeader>
              <TableHeader>Prep time</TableHeader>
              <TableHeader>Out of stock</TableHeader>
              <TableHeader>Vendor delay</TableHeader>
              <TableHeader>FIR not on time</TableHeader>
              <TableHeader>Price modified</TableHeader>
              <TableHeader>Issues</TableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-slate-100 last:border-0" key={row.id}>
                <TableCell>{formatDate(row.kpiDate)}</TableCell>
                <TableCell>
                  <TruncatedText value={row.pickerName} />
                </TableCell>
                <TableCell>
                  <TruncatedText value={row.shopperId} />
                </TableCell>
                <TableCell>
                  <TruncatedText value={row.sourceVendorId} />
                </TableCell>
                <NumberCell value={row.totalOrders} />
                <NumberCell value={row.successfulOrders} />
                <TableCell>{formatPercent(row.successRate)}</TableCell>
                <NumberCell value={row.unhealthyOrders} />
                <NumberCell value={row.orderNotOnTime} />
                <TableCell>{formatPreparationTime(row.preparationTime)}</TableCell>
                <NumberCell value={row.outOfStock} />
                <NumberCell value={row.vendorDelay} />
                <NumberCell value={row.firNotOnTime} />
                <NumberCell value={row.priceModified} />
                <NumberCell value={row.issuesCount} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaginationBar({
  onPageChange,
  page,
  pagination
}: {
  onPageChange: (page: number) => void;
  page: number;
  pagination: OrdersKpiDailyReportResponse["pagination"];
}) {
  const totalPages = Math.max(pagination.totalPages, 1);

  return (
    <div className="flex flex-col gap-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
      <p>
        Page{" "}
        <span className="font-semibold tabular-nums text-slate-950">{page}</span>{" "}
        of{" "}
        <span className="font-semibold tabular-nums text-slate-950">
          {totalPages}
        </span>{" "}
        ·{" "}
        <span className="font-semibold tabular-nums text-slate-950">
          {pagination.totalRows.toLocaleString()}
        </span>{" "}
        total rows
      </p>
      <div className="flex gap-2">
        <Button
          className="h-10 rounded-xl"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          type="button"
          variant="outline"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button
          className="h-10 rounded-xl"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          type="button"
          variant="outline"
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ConfirmedImportResult({
  result
}: {
  result: OrdersKpiImportConfirmResponse;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
      <Definition label="Status" value={<StatusBadge label={formatEnum(result.status)} tone="success" />} />
      <Definition label="Inserted" value={result.insertedCount} />
      <Definition label="Updated" value={result.updatedCount} />
      <Definition label="Rows" value={result.rowCount} />
      <Definition label="Date From" value={formatDate(result.dateFrom)} />
      <Definition label="Date To" value={formatDate(result.dateTo)} />
      <Definition label="Errors" value={result.errorRows} />
      <Definition label="Warnings" value={result.warningRows} />
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
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({
  children,
  compact = false,
  label
}: {
  children: ReactNode;
  compact?: boolean;
  label: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-slate-700", compact && "sm:max-w-44")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Definition({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 min-w-0 break-words text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function NumberCell({ value }: { value: number }) {
  return (
    <TableCell>
      <span className="tabular-nums">{formatNumber(value)}</span>
    </TableCell>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return (
    <td className="min-w-0 px-4 py-3 align-middle text-slate-700">
      {children}
    </td>
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

function SeverityBadge({ severity }: { severity: OrdersKpiIssueSeverity }) {
  return (
    <StatusBadge
      label={formatEnum(severity)}
      tone={severity === "ERROR" ? "danger" : "warning"}
    />
  );
}

function StatusBadge({
  label,
  tone
}: {
  label: string;
  tone: "danger" | "neutral" | "success" | "warning";
}) {
  const tones = {
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
    neutral: "border-slate-200 bg-slate-100 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-300 bg-amber-50 text-amber-800"
  };

  return (
    <Badge className={tones[tone]} variant="outline">
      {label}
    </Badge>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function InlineWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-3 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function statusTone(status: OrdersKpiImportBatchStatus) {
  const tones: Record<
    OrdersKpiImportBatchStatus,
    "danger" | "neutral" | "success" | "warning"
  > = {
    CONFIRMED: "success",
    FAILED: "danger",
    VALIDATED: "success"
  };

  return tones[status];
}

function createInitialFilters(): OrdersKpiFilters {
  const now = new Date();
  const dateFrom = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`;
  const dateTo = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(
    now.getUTCDate()
  )}`;

  return {
    chainId: "",
    dateFrom,
    dateTo,
    page: 1,
    pageSize: 50,
    pickerSearch: "",
    shopperId: "",
    sortBy: "date",
    sortDirection: "desc",
    vendorId: ""
  };
}

function normalizeDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function formatRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return formatDate(dateFrom);
  }

  return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatText(value?: string | null) {
  return value ? value : "-";
}

function formatNullable(value: number | string | null) {
  return value === null ? "-" : value;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  })}%`;
}

function formatPreparationTime(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  })}m`;
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
