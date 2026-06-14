"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  requestsApi,
  type AnnualLeavePreview,
  type RequestSummary
} from "@/lib/api/requests";
import { isAnnualLeaveSubmitBlocked } from "./annual-leave-gating";

export function AnnualLeaveRequestForm({
  onCancel,
  onCreated,
  onDirtyChange
}: {
  onCancel: () => void;
  onCreated: (request: RequestSummary) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<AnnualLeavePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedReason = reason.trim();
  const dirty = Boolean(startDate || endDate || trimmedReason);
  const canPreview = Boolean(startDate && endDate && trimmedReason);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Debounced preview whenever the date range or reason changes.
  useEffect(() => {
    if (!canPreview) {
      setPreview(null);
      setPreviewError(null);
      setPreviewing(false);
      return;
    }

    let cancelled = false;
    setPreviewing(true);
    setPreviewError(null);
    const handle = setTimeout(() => {
      requestsApi
        .previewAnnualLeave({ startDate, endDate, reason: trimmedReason })
        .then((result) => {
          if (!cancelled) {
            setPreview(result);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setPreview(null);
            setPreviewError(
              error instanceof Error ? error.message : "Unable to preview balance."
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPreviewing(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [startDate, endDate, trimmedReason, canPreview]);

  const blocked = isAnnualLeaveSubmitBlocked({ canPreview, preview, previewing });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await requestsApi.createAnnualLeave({
        startDate,
        endDate,
        reason: trimmedReason
      });
      onCreated(created);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to submit the request."
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium text-[color:var(--sn-body)]">
          Start date
          <DatePicker
            onChange={setStartDate}
            placeholder="Select start date"
            value={startDate}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[color:var(--sn-body)]">
          End date
          <DatePicker
            minDate={startDate || undefined}
            onChange={setEndDate}
            placeholder="Select end date"
            value={endDate}
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-xs font-medium text-[color:var(--sn-body)]">
        Reason
        <textarea
          className="min-h-20 rounded-xl border border-input bg-white p-3 text-sm text-[color:var(--sn-ink)] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why are you requesting annual leave?"
          value={reason}
        />
      </label>

      <AnnualLeaveBalancePreview
        canPreview={canPreview}
        error={previewError}
        preview={preview}
        previewing={previewing}
      />

      {submitError ? (
        <p className="rounded-xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.96_0.03_27)] p-3 text-sm text-[oklch(0.5_0.17_27)]">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          className="h-11 rounded-xl"
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          className="h-11 rounded-xl"
          disabled={blocked || submitting}
          type="submit"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}

function AnnualLeaveBalancePreview({
  canPreview,
  error,
  preview,
  previewing
}: {
  canPreview: boolean;
  error: string | null;
  preview: AnnualLeavePreview | null;
  previewing: boolean;
}) {
  if (!canPreview) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-muted)]">
        Pick a start and end date and enter a reason to preview your balance.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.96_0.03_27)] p-4 text-sm text-[oklch(0.5_0.17_27)]">
        {error}
      </div>
    );
  }

  if (previewing && !preview) {
    return (
      <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-muted)]">
        Checking your balance…
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[color:var(--sn-border)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">
          Balance preview
        </h3>
        <AnnualLeaveEligibilityBadge status={preview.eligibilityStatus} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <PreviewStat label="Requested" value={preview.requestedDays} />
        <PreviewStat label="Remaining" value={preview.officialRemainingDays} />
        <PreviewStat label="Held" value={preview.heldDays} />
        <PreviewStat label="Available" value={preview.availableToRequestDays} />
        <PreviewStat
          emphasis
          label="After request"
          value={preview.availableAfterRequestDays}
        />
      </div>

      {preview.eligibilityStatus === "NOT_ELIGIBLE" && preview.eligibleFrom ? (
        <p className="mt-3 text-xs text-[color:var(--sn-muted)]">
          Not eligible yet — eligible from {preview.eligibleFrom}.
        </p>
      ) : null}

      {preview.blockingReasons.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 rounded-xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.97_0.02_27)] p-3">
          {preview.blockingReasons.map((blockingReason) => (
            <li
              className="text-xs font-medium text-[oklch(0.5_0.17_27)]"
              key={blockingReason}
            >
              • {blockingReason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PreviewStat({
  emphasis = false,
  label,
  value
}: {
  emphasis?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded-xl border border-[oklch(0.88_0.06_150)] bg-[oklch(0.97_0.02_150)] px-3 py-2"
          : "rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 py-2"
      }
    >
      <p className="text-[11px] font-semibold uppercase text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--sn-ink)]">
        {value} d
      </p>
    </div>
  );
}

function AnnualLeaveEligibilityBadge({
  status
}: {
  status: AnnualLeavePreview["eligibilityStatus"];
}) {
  const tone =
    status === "ELIGIBLE"
      ? "border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.45_0.1_150)]"
      : "border-[oklch(0.85_0.07_70)] bg-[oklch(0.96_0.04_70)] text-[oklch(0.5_0.12_70)]";
  const label =
    status === "ELIGIBLE"
      ? "Eligible"
      : status === "NOT_ELIGIBLE"
        ? "Not eligible yet"
        : status === "MISSING_JOINING_DATE"
          ? "No joining date"
          : "Not applicable";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}
