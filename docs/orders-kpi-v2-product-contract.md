# Orders KPI V2 Product Contract

## Phase 0 Scope

This document is a planning contract only. It does not add Prisma models,
routes, UI, migrations, or runtime behavior.

Orders KPI V2 is a daily operational KPI module for uploaded order-performance
files. The V1 implementation was removed because it treated Picker identity as
the primary fact anchor. V2 must be Vendor/Branch-first and preserve
vendor-level truth even when Picker identity is missing or unmatched.

## Current Repo Baseline

The active Orders KPI feature has been removed from app code and Prisma schema.
The current SuperNova source of truth remains:

- `User.shopperId` is nullable and unique.
- `Vendor.vendorCode` is unique.
- `Vendor.vendorExternalId` is nullable and unique.
- `Vendor.chainId` points to the operational Chain.
- `PickerBranchAssignment`, `VendorChampAssignment`, and
  `ChainAreaManagerAssignment` are the assignment source of truth.
- New Hire finalization creates or reactivates users through the request
  workflow and writes audit logs.
- Audit logs are stored in `AuditLog` through service calls or transaction
  writes.

Orders KPI V2 must not store hierarchy source-of-truth fields on `User`, must
not create assignments, and must not bypass lifecycle workflows.

## Product Problem

Uploaded order KPI files can contain valid vendor performance rows even when
the shopper ID is missing, says `No data`, points to no SuperNova user, or points
to a non-Picker user. If those rows are skipped, Vendor and Chain totals become
wrong. The operational fact must therefore be anchored on file date and source
Vendor ID, with Picker matching as optional enrichment.

Core reportable row rule:

```text
A row is reportable when it has:
- valid KPI date
- source vendor id
- valid storable metrics

Picker match is optional.
```

## Non-Goals

V2 does not add payroll, deductions, POS, inventory, accounting, GPS, live order
integration, external Talabat APIs, or microservices.

V2 must not mutate Attendance, lifecycle workflows, requests, user mutation
logic, or assignment mutation logic except for a later scoped reconciliation
hook after an approved workflow event.

## Source File Contract

The uploaded file must preserve these fields:

```text
date
shopperId
vendor id
Total orders
Successful orders
QC Failed orders
Vendor Failed orders
Unhealthy orders
Order not on time
Partial refund
Vendor delay
Preparation time
Out of Stock
Fir Not On Time
Price modified
```

The parser should normalize column names but keep a strict required-column
contract. Missing required columns are batch-blocking because row-level parsing
cannot be trusted.

## Identity Rules

### Vendor Identity

`sourceVendorId` from the file is the primary operational anchor.

Matched Vendor:

```text
sourceVendorId = "1234"
matchedVendorId = Vendor.id
matchedChainId = Vendor.chainId
vendorMatchStatus = MATCHED_VENDOR
```

Unmapped Vendor:

```text
sourceVendorId = "9999"
matchedVendorId = null
matchedChainId = null
vendorMatchStatus = UNMAPPED_VENDOR_ID
```

Unmapped Vendor rows are reportable. They appear as `Unmapped Chain` and
`Unmapped Vendor 9999`, and all metrics remain in reports.

Missing Vendor ID is a blocking row error. Without a source Vendor ID, the row
cannot be attributed to a branch/vendor and must not enter final facts.

Vendor matching should check normalized `Vendor.vendorCode` and
`Vendor.vendorExternalId`. If both could match different Vendors, the row is a
blocking conflict because SuperNova cannot safely choose the branch.

### Picker Identity

Picker identity enriches a Vendor fact. It must not decide whether the Vendor
fact is reportable.

Matched Picker:

```text
sourceShopperId = "777"
sourcePickerKey = "777"
userId = User.id
pickerMatchStatus = MATCHED_PICKER
pickerNameSnapshot = User.nameEn
```

Unmatched Shopper ID:

```text
sourceShopperId = "777"
sourcePickerKey = "777"
userId = null
pickerMatchStatus = UNMATCHED_SHOPPER_ID
pickerNameSnapshot = null
displayLabel = "Unmatched shopperId: 777"
```

Missing or `No data` Shopper ID:

```text
sourceShopperId = null
sourcePickerKey = "__UNKNOWN__"
userId = null
pickerMatchStatus = UNKNOWN_PICKER
pickerNameSnapshot = null
displayLabel = "Unknown Picker"
```

Matched User Not Picker:

```text
sourceShopperId = "777"
sourcePickerKey = "777"
userId = null
pickerMatchStatus = MATCHED_USER_NOT_PICKER
pickerNameSnapshot = null
displayLabel = "Non-Picker shopperId: 777"
```

This is a warning, not a blocking error. The row still counts under Vendor
totals. The system must not attach `userId` unless the matched user role is
`PICKER`.

## Daily Fact Grain

Final facts use file source identity, not SuperNova user existence.

Recommended unique key:

```text
kpiDate + sourceVendorId + sourcePickerKey
```

`sourcePickerKey` rules:

- normalized source shopper ID when a usable shopper ID exists
- `__UNKNOWN__` when shopper ID is missing, blank, or `No data`

If multiple file rows share the same `kpiDate + sourceVendorId +
sourcePickerKey`, aggregate them before final insertion. Count metrics are
summed. `Preparation time` should be stored as a weighted average by
`totalOrders` when possible; if weighting cannot be computed safely, store
`null` and create a warning.

The final Vendor total must equal:

```text
matched picker buckets
+ unmatched shopperId buckets
+ unknown picker bucket
+ matched-user-not-picker buckets
```

## Snapshot Replacement Contract

Confirm action label:

```text
Confirm & Replace selected dates
```

Each confirmed upload replaces final Orders KPI records for the exact dates
covered by the uploaded file.

Rules:

- Covered dates are exact normalized date-only values from parsed file rows.
- Do not replace a blind date range.
- If the file has June 3 and June 5 only, do not delete June 4.
- Confirm must run in one database transaction.
- The transaction must delete final records for covered dates, insert new
  aggregated final records, mark the batch confirmed, and write audit logs.
- If any step fails, all steps roll back.

For `NEEDS_REVIEW` batches with row-level blocking errors, the admin must choose
to approve valid rows only and acknowledge that skipped error rows will not
enter facts. Covered dates still come from the uploaded file, so approving valid
rows only can replace an existing date with partial valid data. The audit log
must include skipped row counts and issue counts.

If a batch has no confirmable rows, it must not be confirmable.

## Batch Status Contract

Proposed `OrdersKpiImportBatchStatus`:

```text
VALIDATED
NEEDS_REVIEW
CONFIRMED
REJECTED
FAILED
```

Status meaning:

- `VALIDATED`: preview created and all parsed rows are confirmable. Warnings may
  exist.
- `NEEDS_REVIEW`: preview created, at least one row has a blocking error, and at
  least one row is confirmable.
- `CONFIRMED`: final facts were replaced for covered dates.
- `REJECTED`: admin rejected the preview/review batch. No final facts were
  written.
- `FAILED`: parser, system, or structural failure prevented a usable preview, or
  no confirmable rows exist.

## Validation Matrix

| Condition | Severity | Row confirmable | Notes |
| --- | --- | --- | --- |
| Missing required columns | Error | No | Batch should be `FAILED` because row parsing is unreliable. |
| Missing date | Error | No | Row cannot be assigned to a KPI date. |
| Invalid date | Error | No | Row cannot be assigned to a KPI date. |
| Missing vendor id | Error | No | Row cannot be assigned to Vendor/Branch truth. |
| Vendor code matches multiple branches | Error | No | Ambiguous branch identity. |
| Invalid numeric metric | Error | No | Metric cannot be stored safely. |
| Negative metric | Error | No | Counts cannot be negative. |
| Duplicate conflict cannot be aggregated | Error | No | Only use when aggregation rules cannot preserve truth. |
| Unmapped vendor id | Warning | Yes | Store under `Unmapped Chain` and `Unmapped Vendor <id>`. |
| Missing shopperId | Warning | Yes | Store under `Unknown Picker`. |
| shopperId = No data | Warning | Yes | Store under `Unknown Picker`. |
| Unmatched shopperId | Warning | Yes | Store under `Unmatched shopperId: <id>`. |
| Matched user not PICKER | Warning | Yes | Do not attach `userId`; keep Vendor totals. |
| Preparation time missing / No data | Warning | Yes | Store `preparationTime = null`. |
| Suspicious but storable metric | Warning | Yes | Example: extreme preparation time or high failure ratio. |

## Metrics Contract

Persist all parsed count metrics for current and future reporting:

- `totalOrders`
- `successfulOrders`
- `qcFailedOrders`
- `vendorFailedOrders`
- `unhealthyOrders`
- `orderNotOnTime`
- `partialRefund`
- `vendorDelay`
- `preparationTime`
- `outOfStock`
- `firNotOnTime`
- `priceModified`

Primary report cards:

- Total Orders = sum `totalOrders`
- UHO = sum `unhealthyOrders`
- UHO % = `unhealthyOrders / totalOrders * 100`, or `0` when total is `0`
- Not on time = sum `orderNotOnTime`
- QC Failed Orders = sum `qcFailedOrders`
- Partial Refund = sum `partialRefund`
- OOS = sum `outOfStock`
- Price Modified = sum `priceModified`

## Report Rules

All report filters must apply to both summary cards and table rows. Summaries
must be calculated from the full filtered dataset before grouping pagination is
applied.

### Chain View

Includes matched Chain groups and an admin-visible `Unmapped Chain` group.

Example:

```text
Crispy             20000 orders
Koshary X           8000 orders
Unmapped Chain       600 orders
```

### Vendor View

Includes matched Vendors and unmapped source Vendor IDs when role scope allows
unmapped data.

Example:

```text
Crispy Maadi            500 orders
Crispy Nasr City        420 orders
Unmapped Vendor 9999    160 orders
```

### Picker View

Picker View must be scoped to one selected Vendor identity:

- `vendorId` for matched Vendors
- `sourceVendorId` for unmapped Vendor drilldown

Rows include matched Pickers, unmatched shopper IDs, non-Picker shopper IDs, and
Unknown Picker. Picker View row totals must equal the selected Vendor total.

Example:

```text
Vendor 1234 total = 500

Ahmed Ali                  120
Mohamed Sameh               90
Unmatched shopperId: 777    60
Unknown Picker             230
```

## Access and Scope Rules

Admin and Super Admin:

- Can upload, preview, confirm-replace, reject, and read all reports.
- Can see matched and unmapped data.

Area Manager:

- Can read matched records for Chains assigned through active
  `ChainAreaManagerAssignment`.
- Should not see unrelated matched Chains.
- Should not see `Unmapped Chain` data in the first report API phase because
  unmapped rows have no assignment context.

Champ:

- Can read matched records for Vendors assigned through active
  `VendorChampAssignment`.
- Should not see unrelated matched Vendors.
- Should not see unmapped Vendor rows in the first report API phase because
  unmapped rows have no Champ assignment context.

Picker:

- Can read own matched Picker facts through `userId = actor.id`.
- May also read rows where `sourceShopperId = actor.shopperId` and `userId` is
  still null, but the preferred state is to relink those rows to `userId`.
- Must not see other Pickers or unknown/unmatched rows for the Vendor.

Unmapped data is operational cleanup data. Initial exposure should be Admin and
Super Admin only until product ownership approves a scoped unmapped-data inbox
for Area Managers or Champs.

## Proposed Prisma Enums

```prisma
enum OrdersKpiImportBatchStatus {
  VALIDATED
  NEEDS_REVIEW
  CONFIRMED
  REJECTED
  FAILED
}

enum OrdersKpiVendorMatchStatus {
  MATCHED_VENDOR
  UNMAPPED_VENDOR_ID
}

enum OrdersKpiPickerMatchStatus {
  MATCHED_PICKER
  UNMATCHED_SHOPPER_ID
  UNKNOWN_PICKER
  MATCHED_USER_NOT_PICKER
}

enum OrdersKpiIssueSeverity {
  WARNING
  ERROR
}

enum OrdersKpiIssueCode {
  MISSING_REQUIRED_COLUMNS
  MISSING_DATE
  INVALID_DATE
  MISSING_VENDOR_ID
  AMBIGUOUS_VENDOR_ID
  INVALID_NUMERIC_METRIC
  NEGATIVE_METRIC
  UNSAFE_DUPLICATE_CONFLICT
  UNMAPPED_VENDOR_ID
  MISSING_SHOPPER_ID
  NO_DATA_SHOPPER_ID
  UNMATCHED_SHOPPER_ID
  MATCHED_USER_NOT_PICKER
  PREPARATION_TIME_MISSING
  SUSPICIOUS_METRIC_VALUE
}
```

## Proposed Prisma Models

These models are proposals only. They must not be added until Phase 1 is
approved.

```prisma
model OrdersKpiImportBatch {
  id                  String                     @id @default(uuid())
  fileName            String
  fileHash            String
  uploadedByUserId    String
  uploadedAt          DateTime                   @default(now())
  status              OrdersKpiImportBatchStatus
  rowCount            Int                        @default(0)
  confirmableRows     Int                        @default(0)
  skippedRows         Int                        @default(0)
  errorRows           Int                        @default(0)
  warningRows         Int                        @default(0)
  coveredDates        Json
  coveredDateFrom     DateTime?
  coveredDateTo       DateTime?
  confirmedByUserId   String?
  confirmedAt         DateTime?
  rejectedByUserId    String?
  rejectedAt          DateTime?
  rejectionReason     String?
  createdAt           DateTime                   @default(now())
  updatedAt           DateTime                   @updatedAt

  uploadedBy          User                       @relation("OrdersKpiImportUploadedBy", fields: [uploadedByUserId], references: [id], onDelete: Restrict)
  confirmedBy         User?                      @relation("OrdersKpiImportConfirmedBy", fields: [confirmedByUserId], references: [id], onDelete: SetNull)
  rejectedBy          User?                      @relation("OrdersKpiImportRejectedBy", fields: [rejectedByUserId], references: [id], onDelete: SetNull)
  stagingRows         OrdersKpiImportStagingRow[]
  records             OrdersKpiDailyRecord[]
  issues              OrdersKpiImportIssue[]

  @@index([status])
  @@index([uploadedAt])
  @@index([coveredDateFrom, coveredDateTo])
  @@index([uploadedByUserId])
  @@index([confirmedByUserId])
  @@index([fileHash])
}
```

`coveredDates` should be an array of date-only strings in `YYYY-MM-DD` format.
It exists so confirm can replace exact dates without relying on a blind range.

```prisma
model OrdersKpiImportStagingRow {
  id                  String                    @id @default(uuid())
  sourceBatchId       String
  rawRowNumber        Int
  rowHash             String
  kpiDate             DateTime
  sourceVendorId      String
  matchedVendorId     String?
  matchedChainId      String?
  vendorNameSnapshot  String?
  chainNameSnapshot   String?
  vendorMatchStatus   OrdersKpiVendorMatchStatus
  sourceShopperId     String?
  sourcePickerKey     String
  userId              String?
  pickerNameSnapshot  String?
  pickerMatchStatus   OrdersKpiPickerMatchStatus
  totalOrders         Int
  successfulOrders    Int
  qcFailedOrders      Int
  vendorFailedOrders  Int
  unhealthyOrders     Int
  orderNotOnTime      Int
  partialRefund       Int
  vendorDelay         Int
  preparationTime     Decimal?                  @db.Decimal(10, 4)
  outOfStock          Int
  firNotOnTime        Int
  priceModified       Int
  issuesCount         Int                       @default(0)
  createdAt           DateTime                  @default(now())
  updatedAt           DateTime                  @updatedAt

  sourceBatch         OrdersKpiImportBatch      @relation(fields: [sourceBatchId], references: [id], onDelete: Restrict)
  matchedVendor       Vendor?                   @relation("OrdersKpiStagingMatchedVendor", fields: [matchedVendorId], references: [id], onDelete: SetNull)
  matchedChain        Chain?                    @relation("OrdersKpiStagingMatchedChain", fields: [matchedChainId], references: [id], onDelete: SetNull)
  user                User?                     @relation("OrdersKpiStagingMatchedUser", fields: [userId], references: [id], onDelete: SetNull)

  @@unique([sourceBatchId, rawRowNumber])
  @@index([sourceBatchId])
  @@index([kpiDate])
  @@index([sourceVendorId])
  @@index([matchedVendorId])
  @@index([matchedChainId])
  @@index([sourceShopperId])
  @@index([sourcePickerKey])
  @@index([userId])
  @@index([kpiDate, sourceVendorId])
  @@index([kpiDate, matchedVendorId])
  @@index([kpiDate, matchedChainId])
}
```

Staging rows should represent confirmable rows only. Blocking rows should be
represented by `OrdersKpiImportIssue` records and skipped from final facts.

```prisma
model OrdersKpiDailyRecord {
  id                  String                    @id @default(uuid())
  sourceBatchId       String
  kpiDate             DateTime
  sourceVendorId      String
  matchedVendorId     String?
  matchedChainId      String?
  vendorNameSnapshot  String?
  chainNameSnapshot   String?
  vendorMatchStatus   OrdersKpiVendorMatchStatus
  sourceShopperId     String?
  sourcePickerKey     String
  userId              String?
  pickerNameSnapshot  String?
  pickerMatchStatus   OrdersKpiPickerMatchStatus
  totalOrders         Int
  successfulOrders    Int
  qcFailedOrders      Int
  vendorFailedOrders  Int
  unhealthyOrders     Int
  orderNotOnTime      Int
  partialRefund       Int
  vendorDelay         Int
  preparationTime     Decimal?                  @db.Decimal(10, 4)
  outOfStock          Int
  firNotOnTime        Int
  priceModified       Int
  issuesCount         Int                       @default(0)
  createdAt           DateTime                  @default(now())
  updatedAt           DateTime                  @updatedAt

  sourceBatch         OrdersKpiImportBatch      @relation(fields: [sourceBatchId], references: [id], onDelete: Restrict)
  matchedVendor       Vendor?                   @relation("OrdersKpiDailyMatchedVendor", fields: [matchedVendorId], references: [id], onDelete: SetNull)
  matchedChain        Chain?                    @relation("OrdersKpiDailyMatchedChain", fields: [matchedChainId], references: [id], onDelete: SetNull)
  user                User?                     @relation("OrdersKpiDailyMatchedUser", fields: [userId], references: [id], onDelete: SetNull)

  @@unique([kpiDate, sourceVendorId, sourcePickerKey])
  @@index([sourceBatchId])
  @@index([kpiDate])
  @@index([sourceVendorId])
  @@index([matchedVendorId])
  @@index([matchedChainId])
  @@index([sourceShopperId])
  @@index([sourcePickerKey])
  @@index([userId])
  @@index([kpiDate, sourceVendorId])
  @@index([kpiDate, matchedVendorId])
  @@index([kpiDate, matchedChainId])
  @@index([sourceVendorId, matchedVendorId])
  @@index([sourceShopperId, userId])
  @@index([userId, kpiDate])
  @@index([vendorMatchStatus])
  @@index([pickerMatchStatus])
}
```

`userId` must be nullable because unmatched shopper IDs, missing shopper IDs,
and matched non-Picker users are still valid Vendor facts. `matchedVendorId` and
`matchedChainId` must be nullable because unmapped Vendor IDs are still
reportable and later relinkable.

```prisma
model OrdersKpiImportIssue {
  id              String                 @id @default(uuid())
  batchId         String
  rowNumber       Int?
  sourceVendorId  String?
  sourceShopperId String?
  severity        OrdersKpiIssueSeverity
  issueCode       OrdersKpiIssueCode
  fieldName       String?
  message         String
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  batch           OrdersKpiImportBatch    @relation(fields: [batchId], references: [id], onDelete: Restrict)

  @@index([batchId])
  @@index([severity])
  @@index([issueCode])
  @@index([sourceVendorId])
  @@index([sourceShopperId])
}
```

## Relink Contract

Relink updates historical Orders KPI facts only. It must not create or change
assignments.

### Vendor Relink

When a Vendor is created or its source identifiers are updated:

```text
Find OrdersKpiDailyRecord
where matchedVendorId is null
and sourceVendorId matches Vendor.vendorCode or Vendor.vendorExternalId

Update:
matchedVendorId = Vendor.id
matchedChainId = Vendor.chainId
vendorMatchStatus = MATCHED_VENDOR
vendorNameSnapshot = Vendor.vendorName
chainNameSnapshot = Vendor.chain.chainName
```

This moves historical rows from `Unmapped Chain` into the real Chain/Vendor in
future reports.

### Picker Relink

After workflow-based New Hire finalization creates or reactivates a Picker with
`shopperId`:

```text
Find OrdersKpiDailyRecord
where sourceShopperId = User.shopperId
and userId is null
and pickerMatchStatus = UNMATCHED_SHOPPER_ID

Update:
userId = User.id
pickerNameSnapshot = User.nameEn
pickerMatchStatus = MATCHED_PICKER
```

This should run after the approved New Hire finalization path. It must not
create assignments and must not change the request workflow state. If relink is
implemented as a post-finalization hook, a relink failure should be audited and
retried without rolling back the completed New Hire.

### Unknown Picker

Rows with:

```text
sourcePickerKey = "__UNKNOWN__"
sourceShopperId = null
```

cannot be automatically relinked later.

## Proposed API Contract

All endpoints are proposed only.

### POST `/orders-kpis/imports/preview`

Roles:

```text
ADMIN, SUPER_ADMIN
```

Request:

```text
multipart/form-data
file: xlsx/csv upload
```

Response shape:

```ts
type OrdersKpiPreviewResponse = {
  batch: {
    id: string;
    fileName: string;
    status: "VALIDATED" | "NEEDS_REVIEW" | "FAILED";
    rowCount: number;
    confirmableRows: number;
    skippedRows: number;
    errorRows: number;
    warningRows: number;
    coveredDates: string[];
    canConfirm: boolean;
    requiresReviewDecision: boolean;
  };
  summary: {
    matchedVendorRows: number;
    unmappedVendorRows: number;
    matchedPickerRows: number;
    unmatchedShopperRows: number;
    unknownPickerRows: number;
    matchedUserNotPickerRows: number;
  };
  previewRows: OrdersKpiPreviewRow[];
  issues: OrdersKpiPreviewIssue[];
};
```

### POST `/orders-kpis/imports/:batchId/confirm-replace`

Roles:

```text
ADMIN, SUPER_ADMIN
```

Request body:

```ts
type ConfirmReplaceRequest = {
  acknowledgeReplaceDates: true;
  approveValidRowsOnly?: boolean;
  acknowledgeSkippedErrorRows?: true;
};
```

Rules:

- `VALIDATED` batches require `acknowledgeReplaceDates: true`.
- `NEEDS_REVIEW` batches require `approveValidRowsOnly: true` and
  `acknowledgeSkippedErrorRows: true`.
- `FAILED`, `REJECTED`, and `CONFIRMED` batches are not confirmable.

Response shape:

```ts
type ConfirmReplaceResponse = {
  batchId: string;
  status: "CONFIRMED";
  coveredDates: string[];
  deletedRecords: number;
  insertedRecords: number;
  skippedRows: number;
  confirmedAt: string;
};
```

### POST `/orders-kpis/imports/:batchId/reject`

Roles:

```text
ADMIN, SUPER_ADMIN
```

Request body:

```ts
type RejectOrdersKpiImportRequest = {
  reason?: string;
};
```

Reject writes no final daily records.

### GET `/orders-kpis/imports`

Roles:

```text
ADMIN, SUPER_ADMIN
```

Query:

```text
status
dateFrom
dateTo
page
pageSize
```

Returns paginated import batches with counts, status, covered dates, uploader,
confirmed/rejected metadata, and issue counts.

### GET `/orders-kpis/imports/:batchId`

Roles:

```text
ADMIN, SUPER_ADMIN
```

Returns batch metadata, preview/staging rows, and issues grouped by severity and
issue code.

### GET `/orders-kpis/reports/performance`

Roles:

```text
ADMIN, SUPER_ADMIN, AREA_MANAGER, CHAMP, PICKER
```

Query:

```text
dateFrom: YYYY-MM-DD
dateTo: YYYY-MM-DD
view: CHAIN | VENDOR | PICKER
chainId?: string
vendorId?: string
sourceVendorId?: string
pickerSearch?: string
page?: number
pageSize?: number
sortBy?: totalOrders | unhealthyOrders | unhealthyRate | orderNotOnTime | qcFailedOrders | partialRefund | outOfStock | priceModified
sortDirection?: asc | desc
```

Rules:

- `view=CHAIN` groups by matched Chain plus `Unmapped Chain` when role scope
  allows unmapped rows.
- `view=VENDOR` groups by matched Vendor and unmapped source Vendor IDs when
  role scope allows.
- `view=PICKER` requires either `vendorId` or `sourceVendorId`.
- `sourceVendorId` supports unmapped Vendor drilldown.
- Summary cards and table rows use the same filters and actor scope.
- Summary cards are computed before pagination.

Response shape:

```ts
type OrdersKpiPerformanceReportResponse = {
  filters: {
    dateFrom: string;
    dateTo: string;
    view: "CHAIN" | "VENDOR" | "PICKER";
    chainId: string | null;
    vendorId: string | null;
    sourceVendorId: string | null;
    pickerSearch: string | null;
  };
  summary: {
    totalOrders: number;
    unhealthyOrders: number;
    unhealthyRate: number;
    orderNotOnTime: number;
    qcFailedOrders: number;
    partialRefund: number;
    outOfStock: number;
    priceModified: number;
  };
  rows: OrdersKpiPerformanceRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
};
```

Rows should include a stable `groupKey`, display label, matched IDs when present,
source IDs when needed, match statuses, and the same metric fields as the
summary.

## Audit Contract

Required audit actions:

- `ORDERS_KPI_IMPORT_PREVIEWED`
- `ORDERS_KPI_IMPORT_CONFIRMED_REPLACE`
- `ORDERS_KPI_IMPORT_REJECTED`
- `ORDERS_KPI_VENDOR_RELINKED`
- `ORDERS_KPI_PICKER_RELINKED`

Confirm audit metadata must include:

- batch ID
- covered dates
- deleted final record count
- inserted final record count
- skipped error row count
- warning row count
- actor, IP, and user agent

## Implementation Phases

### V2 Phase 0 - Product Contract + Data Model Plan

Scope:

- Create this planning document only.

Out of scope:

- Code, Prisma schema changes, migrations, routes, UI, and tests.

Files likely touched:

- `docs/orders-kpi-v2-product-contract.md`

Checks:

- `git diff --check`
- stale Orders KPI active-code reference scan

Manual verification:

- Confirm the document reflects current User, Vendor, Chain, assignment,
  request, and audit constraints.

Risks:

- Product owner must approve unresolved access behavior for unmapped data before
  report API implementation.

### V2 Phase 1 - Prisma Schema Foundation Only

Scope:

- Add proposed enums, models, relations, indexes, and migration.
- Add nullable Orders KPI relations to `User`, `Vendor`, and `Chain` only as
  required by Prisma relations.

Out of scope:

- Parser, preview, confirm, report API, reconciliation hooks, and UI.

Files likely touched:

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_orders_kpi_v2_foundation/migration.sql`

Tests/checks:

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run typecheck`

Manual verification:

- Inspect generated migration for only Orders KPI tables/enums/indexes.

Risks:

- Relation naming must avoid conflicts with Attendance and existing User
  relations.

### V2 Phase 2 - Parser + Validator + Preview Only

Scope:

- Add Orders KPI module, parser, validator, preview DTOs/types, preview
  endpoint, staging persistence, issue persistence, and preview audit.
- Persist confirmable staging rows even when batch is `NEEDS_REVIEW`.
- Persist issues for blocking and warning rows.

Out of scope:

- Confirm-replace, final daily records, report API, reconciliation, and UI.

Files likely touched:

- `apps/api/src/orders-kpis/orders-kpis.module.ts`
- `apps/api/src/orders-kpis/orders-kpis-imports.controller.ts`
- `apps/api/src/orders-kpis/orders-kpis-parser.service.ts`
- `apps/api/src/orders-kpis/orders-kpis-validator.service.ts`
- `apps/api/src/orders-kpis/orders-kpis-import.service.ts`
- `apps/api/src/orders-kpis/orders-kpis.types.ts`
- `apps/api/src/app.module.ts`
- targeted API tests

Tests/checks:

- Parser tests for required columns and normalized fields.
- Validator tests for blocking-vs-warning matrix.
- Preview service tests for `VALIDATED`, `NEEDS_REVIEW`, and `FAILED`.
- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- targeted backend tests

Manual verification:

- Upload a file with matched Vendor, unmapped Vendor, missing Vendor, matched
  Picker, unmatched shopper ID, and unknown Picker rows.

Risks:

- Ambiguous Vendor matching must be handled as blocking, not guessed.

### V2 Phase 3 - Confirm & Replace Daily Facts Only

Scope:

- Implement `confirm-replace` and `reject`.
- Aggregate staging rows by `kpiDate + sourceVendorId + sourcePickerKey`.
- Transactionally delete final records for covered dates, insert aggregated
  daily records, update batch status, and write audit logs.

Out of scope:

- Performance report API, reconciliation hooks, and UI.

Files likely touched:

- Orders KPI import controller/service/types
- targeted backend tests

Tests/checks:

- Confirm replaces exact covered dates only.
- Confirm does not delete missing dates inside a range.
- Duplicate grains aggregate safely.
- `NEEDS_REVIEW` requires explicit skipped-row acknowledgement.
- Reject writes no final records.
- Transaction rollback test for failed insert/update path.
- Required npm checks and targeted backend tests.

Manual verification:

- Seed existing final records for June 3, 4, 5, then confirm a file covering
  June 3 and June 5 and verify June 4 remains.

Risks:

- Approving valid rows only can intentionally replace a date with partial data
  when some rows had blocking errors. The UI and audit must make this explicit.

### V2 Phase 4 - Performance Report API Only

Scope:

- Implement `GET /orders-kpis/reports/performance`.
- Add role-scoped filtering.
- Add Chain, Vendor, and Picker grouping.
- Add summary cards calculated from full filtered data before pagination.
- Add unmapped labels and fallbacks.

Out of scope:

- Import UI, report UI, reconciliation hooks, and charts.

Files likely touched:

- `apps/api/src/orders-kpis/orders-kpis-reports.controller.ts`
- `apps/api/src/orders-kpis/orders-kpis-report.service.ts`
- report DTOs/types
- targeted backend tests

Tests/checks:

- Summary and table share filters.
- Chain/Vendor/Picker row totals reconcile.
- Admin sees unmapped rows.
- Area Manager/Champ scopes exclude unrelated matched rows and exclude unmapped
  rows in initial scoped behavior.
- Picker sees only own matched/source-shopper rows.
- Required npm checks and targeted backend tests.

Manual verification:

- Query each view across matched and unmapped data and compare totals.

Risks:

- Unmapped data access for non-admin roles needs product approval before broader
  exposure.

### V2 Phase 5 - Reconciliation Hooks/Services Only

Scope:

- Add an Orders KPI reconciliation service.
- Relink unmapped Vendor facts after Vendor create/update.
- Relink unmatched Picker facts after New Hire finalization creates/reactivates
  a Picker with shopper ID.
- Write audit logs for relink counts.

Out of scope:

- Creating Vendors or Pickers directly.
- Changing assignments.
- Changing request workflow states.
- UI.

Files likely touched:

- Orders KPI reconciliation service
- `apps/api/src/vendors/vendors.service.ts`
- `apps/api/src/requests/workflows/new-hire-finalization.service.ts`
- targeted backend tests

Tests/checks:

- Vendor relink updates only matching `sourceVendorId` rows with null
  `matchedVendorId`.
- Picker relink updates only matching `sourceShopperId` rows with null `userId`
  and `UNMATCHED_SHOPPER_ID`.
- Unknown Picker rows are not relinked.
- Reconciliation does not mutate assignments.
- Required npm checks and targeted backend tests.

Manual verification:

- Create a Vendor whose code matches historical unmapped rows and verify report
  movement from Unmapped Chain to the real Chain.

Risks:

- Hook failures must not silently disappear. They should be audited or surfaced
  for retry without destabilizing lifecycle workflows.

### V2 Phase 6 - Frontend Import/Report UI Only

Scope:

- Add Admin/Super Admin import UI.
- Add Preview, Confirm & Replace selected dates, Approve valid rows only, Reject
  review, and Confirmed Report UI.
- Add report page with Chain, Vendor, and Picker tabs.
- Use the shared Date Range component for report filters.
- Show backend errors clearly.
- Design mobile-first for 360px-430px.

Out of scope:

- Area Manager, Champ, and Picker UI unless explicitly approved.
- Charts, fake dashboard clutter, payroll, penalties, external APIs, or order
  integration.

Files likely touched:

- `apps/web/lib/api/orders-kpis.ts`
- `apps/web/app/admin/orders-kpis/imports/page.tsx`
- `apps/web/app/admin/orders-kpis/report/page.tsx`
- Orders KPI report/import components
- `apps/web/components/dashboard/role-nav.ts`

Tests/checks:

- Frontend API helper tests if test infrastructure exists.
- Component state tests if test infrastructure exists.
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Manual verification:

- Upload, preview, reject, confirm-replace, and read reports on mobile and
  desktop widths.

Risks:

- UI must not hide skipped rows or replacement impact. Confirm action copy must
  make date replacement explicit.

## Open Product Decisions Before Phase 1

1. Confirm whether `coveredDates` should include dates from all parsed rows or
   only rows with confirmable Vendor facts. This contract recommends all parsed
   valid dates, with explicit partial-data acknowledgement for `NEEDS_REVIEW`.
2. Confirm that initial non-admin reports should hide unmapped data because it
   has no assignment scope.
3. Confirm whether Picker self-report should include unmatched rows by
   `sourceShopperId = actor.shopperId` before reconciliation, or only rows with
   `userId = actor.id`.
4. Confirm whether relink failures should be retried by a manual admin action,
   a scheduled maintenance task, or both.
