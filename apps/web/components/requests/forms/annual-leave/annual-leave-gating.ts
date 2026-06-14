import { type AnnualLeavePreview } from "@/lib/api/requests";

/**
 * Preconditions for requesting a balance preview (and therefore for enabling
 * submit). The form must be complete, the champ branch context must be resolved
 * (not loading/failed), and a multi-branch champ must have picked a branch
 * before we have a valid `contextVendorId` to send.
 *
 * Kept pure so the branch-selection rule is unit-tested without a React render.
 */
export function canPreviewAnnualLeave({
  branchContextReady,
  contextVendorId,
  endDate,
  needsBranchSelection,
  reason,
  startDate
}: {
  branchContextReady: boolean;
  contextVendorId: string;
  endDate: string;
  needsBranchSelection: boolean;
  reason: string;
  startDate: string;
}): boolean {
  if (!startDate || !endDate || !reason.trim()) {
    return false;
  }

  if (!branchContextReady) {
    return false;
  }

  if (needsBranchSelection && !contextVendorId) {
    return false;
  }

  return true;
}

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
