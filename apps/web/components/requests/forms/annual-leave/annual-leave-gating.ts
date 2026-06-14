import { type AnnualLeavePreview } from "@/lib/api/requests";

/**
 * Submit gating for the annual-leave request form. Submission is blocked while
 * the form is incomplete, while a preview is in flight, or whenever the backend
 * preview reports a blocking reason or a negative post-request balance.
 *
 * Kept as a pure helper so the rule is unit-tested independently of the React
 * component that renders it.
 */
export function isAnnualLeaveSubmitBlocked({
  canPreview,
  preview,
  previewing
}: {
  canPreview: boolean;
  preview: AnnualLeavePreview | null;
  previewing: boolean;
}): boolean {
  return (
    !canPreview ||
    previewing ||
    !preview ||
    preview.blockingReasons.length > 0 ||
    preview.availableAfterRequestDays < 0
  );
}
