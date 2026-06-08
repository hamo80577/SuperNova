import type {
  OrdersKpiImportBatchStatus,
  UserRole
} from "@prisma/client";

export interface OrdersKpiImportActor {
  id: string;
  role: UserRole;
}

export interface OrdersKpiImportRequestContext {
  actor: OrdersKpiImportActor;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface OrdersKpiImportPreviewOptions
  extends OrdersKpiImportRequestContext {
  fileName: string;
  now?: Date | string;
}

export interface OrdersKpiImportConfirmOptions
  extends OrdersKpiImportRequestContext {
  now?: Date | string;
}

export interface OrdersKpiImportPreviewResult {
  batchId: string;
  status: OrdersKpiImportBatchStatus;
  canConfirm: boolean;
  preview: OrdersKpiValidationPreview;
  stagingRowCount: number;
  issueCount: number;
}

export interface OrdersKpiImportConfirmResult {
  batchId: string;
  status: OrdersKpiImportBatchStatus;
  confirmedAt: string;
  insertedCount: number;
  updatedCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  rowCount: number;
  errorRows: number;
  warningRows: number;
}

export interface OrdersKpiParsedWorkbook {
  headers: string[];
  rows: OrdersKpiParsedRow[];
}

export interface OrdersKpiParsedRow {
  rawRowNumber: number;
  shopperId: unknown;
  sourceVendorId: unknown;
  date: unknown;
  totalOrders: unknown;
  successfulOrders: unknown;
  qcFailedOrders: unknown;
  vendorFailedOrders: unknown;
  unhealthyOrders: unknown;
  orderNotOnTime: unknown;
  partialRefund: unknown;
  vendorDelay: unknown;
  preparationTime: unknown;
  outOfStock: unknown;
  firNotOnTime: unknown;
  priceModified: unknown;
}

export interface OrdersKpiMatchedUser {
  id: string;
  shopperId: string;
  role: UserRole;
  nameEn: string;
}

export interface OrdersKpiMatchedVendor {
  id: string;
  vendorCode: string;
  vendorExternalId: string | null;
  chainId: string;
}

export type OrdersKpiIssueSeverity = "ERROR" | "WARNING";

export type OrdersKpiIssueCode =
  | "MISSING_REQUIRED_COLUMN"
  | "MISSING_DATE"
  | "INVALID_DATE"
  | "MISSING_SHOPPER_ID"
  | "MISSING_VENDOR_ID"
  | "INVALID_NUMERIC_VALUE"
  | "NEGATIVE_NUMERIC_VALUE"
  | "SUCCESSFUL_ORDERS_EXCEED_TOTAL"
  | "DUPLICATE_KPI_ROW"
  | "MATCHED_USER_NOT_PICKER"
  | "UNMATCHED_SHOPPER_ID"
  | "PREPARATION_TIME_MISSING"
  | "UNMAPPED_VENDOR_ID"
  | "UNHEALTHY_ORDERS_EXCEED_TOTAL"
  | "ORDER_NOT_ON_TIME_EXCEED_TOTAL"
  | "NO_ACTIVE_BRANCH_ASSIGNMENT";

export interface OrdersKpiPreviewIssue {
  rowNumber: number | null;
  shopperId: string | null;
  severity: OrdersKpiIssueSeverity;
  issueCode: OrdersKpiIssueCode;
  fieldName: string | null;
  message: string;
}

export interface OrdersKpiRowsPreviewItem {
  rawRowNumber: number;
  kpiDate: string | null;
  shopperId: string | null;
  sourceVendorId: string | null;
  matchStatus:
    | "MATCHED_PICKER"
    | "UNMATCHED_SHOPPER_ID"
    | "MATCHED_USER_NOT_PICKER"
    | "NOT_EVALUATED";
  issuesCount: number;
}

export interface OrdersKpiValidatedStagingRow {
  kpiDate: string;
  shopperId: string;
  userId: string;
  pickerNameSnapshot: string;
  sourceVendorId: string;
  matchedVendorId: string | null;
  matchedChainId: string | null;
  totalOrders: number;
  successfulOrders: number;
  qcFailedOrders: number;
  vendorFailedOrders: number;
  unhealthyOrders: number;
  orderNotOnTime: number;
  partialRefund: number;
  vendorDelay: number;
  preparationTime: number | null;
  outOfStock: number;
  firNotOnTime: number;
  priceModified: number;
  successRate: number | null;
  unhealthyRate: number | null;
  notOnTimeRate: number | null;
  rawRowNumber: number;
  rowHash: string;
  issuesCount: number;
}

export interface OrdersKpiValidationContext {
  activeAssignmentsByPickerId: Map<string, string>;
  usersByShopperId: Map<string, OrdersKpiMatchedUser>;
  vendorsBySourceVendorId: Map<string, OrdersKpiMatchedVendor>;
}

export interface OrdersKpiValidationPreview {
  rowCount: number;
  matchedRows: number;
  unmatchedRows: number;
  errorRows: number;
  warningRows: number;
  dateFrom: string | null;
  dateTo: string | null;
  canConfirm: boolean;
  issues: OrdersKpiPreviewIssue[];
  rowsPreview: OrdersKpiRowsPreviewItem[];
  stagingRows: OrdersKpiValidatedStagingRow[];
}
