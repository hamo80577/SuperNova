import type {
  OrdersKpiImportBatchStatus,
  OrdersKpiIssueCode,
  OrdersKpiIssueSeverity,
  OrdersKpiPreviewIssue
} from "../../lib/api/orders-kpis";

export interface OrdersKpiIssueGroup {
  count: number;
  description: string;
  fieldNames: string[];
  issueCode: OrdersKpiIssueCode;
  label: string;
  rowNumbers: number[];
  severity: OrdersKpiIssueSeverity;
}

interface ApproveReviewState {
  acknowledged: boolean;
  actionPending?: boolean;
  preview:
    | {
        batchId: string;
        canApproveValidRows: boolean;
        stagingRowCount: number;
        status: OrdersKpiImportBatchStatus;
      }
    | null;
}

const issueCopy: Partial<
  Record<OrdersKpiIssueCode, { description: string; label: string }>
> = {
  DUPLICATE_KPI_ROW: {
    description:
      "Duplicate date + shopperId + vendor id rows are not allowed in one file.",
    label: "Duplicate KPI row"
  },
  INVALID_DATE: {
    description: "date must be a valid KPI date.",
    label: "Invalid date"
  },
  INVALID_NUMERIC_VALUE: {
    description: "Metric values must be valid non-negative numbers.",
    label: "Invalid numeric value"
  },
  MISSING_DATE: {
    description: "date is required for Orders KPI rows.",
    label: "Missing date"
  },
  MISSING_SHOPPER_ID: {
    description: "shopperId is required and cannot be No data.",
    label: "Missing shopper ID"
  },
  PREPARATION_TIME_MISSING: {
    description: "Preparation time is missing or No data and will be stored as null.",
    label: "Preparation time missing"
  },
  SUCCESSFUL_ORDERS_EXCEED_TOTAL: {
    description: "Successful orders cannot exceed Total orders.",
    label: "Successful orders exceed total"
  },
  UNMAPPED_VENDOR_ID: {
    description: "vendor id is not mapped to a SuperNova Vendor.",
    label: "Unmapped vendor ID"
  },
  UNMATCHED_SHOPPER_ID: {
    description: "shopperId does not match a SuperNova User.shopperId.",
    label: "Unmatched shopper ID"
  }
};

export function groupOrdersKpiImportIssues(
  issues: OrdersKpiPreviewIssue[]
) {
  const groups = new Map<string, OrdersKpiIssueGroup>();

  for (const issue of issues) {
    const key = `${issue.severity}:${issue.issueCode}`;
    const copy = issueCopy[issue.issueCode] ?? {
      description: issue.message,
      label: formatIssueCode(issue.issueCode)
    };
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      addUniqueNumber(existing.rowNumbers, issue.rowNumber);
      addUniqueText(existing.fieldNames, issue.fieldName);
      continue;
    }

    groups.set(key, {
      count: 1,
      description: copy.description,
      fieldNames: issue.fieldName ? [issue.fieldName] : [],
      issueCode: issue.issueCode,
      label: copy.label,
      rowNumbers: issue.rowNumber ? [issue.rowNumber] : [],
      severity: issue.severity
    });
  }

  const sorted = [...groups.values()].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "ERROR" ? -1 : 1;
    }

    return right.count - left.count || left.label.localeCompare(right.label);
  });

  return {
    blocking: sorted.filter((group) => group.severity === "ERROR"),
    warnings: sorted.filter((group) => group.severity === "WARNING")
  };
}

export function canApproveOrdersKpiReview({
  acknowledged,
  actionPending = false,
  preview
}: ApproveReviewState) {
  return Boolean(
    preview?.batchId &&
      preview.status === "NEEDS_REVIEW" &&
      preview.canApproveValidRows &&
      preview.stagingRowCount > 0 &&
      acknowledged &&
      !actionPending
  );
}

function addUniqueNumber(values: number[], value: number | null) {
  if (value !== null && !values.includes(value)) {
    values.push(value);
  }
}

function addUniqueText(values: string[], value: string | null) {
  if (value && !values.includes(value)) {
    values.push(value);
  }
}

function formatIssueCode(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
