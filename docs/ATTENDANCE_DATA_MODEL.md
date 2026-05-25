# Attendance Data Model

## Status

Attendance Analytics data model foundation is implemented in `prisma/schema.prisma`.

The model is scoped to import metadata, calculated daily records for retained months, compressed monthly summaries, and import or maintenance issues. It does not store uploaded XLSX files permanently and it does not add operational hierarchy fields to `User`.

## Implemented Tables

```text
AttendanceImportBatch
AttendanceDailyRecord
AttendanceMonthlyUserSummary
AttendanceMonthlyBranchSummary
AttendanceMonthlyChainSummary
AttendanceImportIssue
```

## AttendanceImportBatch

Tracks one attendance import, recalculation, delete, or compression operation.

Stores:

```text
mode
status
periodFrom / periodTo
createdById
fileName
fileHash
row and match counts
summary rebuild counts
startedAt / completedAt
errorMessage
```

Does not store the original XLSX workbook.

## AttendanceDailyRecord

Stores per-user daily calculated detail only for retained detailed months.

Daily records include:

```text
matchedUserId
identifier
matchedUserRole
matchKeyType
attendanceDate
monthKey
raw source display fields
calculated status
scheduled and actual times
late and duration flags
assignmentVendorId / assignmentChainId reporting snapshots
archiveStatus
rowFingerprint
```

`assignmentVendorId` and `assignmentChainId` are reporting snapshots only. They are not operational assignment source-of-truth fields.

Duplicate `Identifier + Shift Date` rows are detected by import logic and stored as issues. The table intentionally does not hard-block duplicates at database level.

## AttendanceMonthlyUserSummary

Stores long-term compressed monthly user metrics.

Contains both Picker and Champ user-level summaries. Champ summaries remain user-level only and must not feed Branch or Chain totals.

Uniqueness:

```text
monthKey + userId
```

## AttendanceMonthlyBranchSummary

Stores Picker-only Branch monthly rollups.

Rules:

```text
PICKER rows only
exclude CHAMP rows
exclude Picker rows missing assignmentVendorId
```

Uniqueness:

```text
monthKey + vendorId
```

## AttendanceMonthlyChainSummary

Stores Picker-only Chain monthly rollups.

Rules:

```text
PICKER rows only
exclude CHAMP rows
exclude Picker rows missing assignmentChainId
```

Uniqueness:

```text
monthKey + chainId
```

## AttendanceImportIssue

Stores warnings and errors from import, parsing, matching, assignment snapshotting, duplicate detection, and maintenance operations.

Examples:

```text
UNMATCHED_IDENTIFIER
AMBIGUOUS_IDENTIFIER_MATCH
UNSUPPORTED_ROLE
DUPLICATE_IDENTIFIER_SHIFT_DATE
ROW_PARSE_ERROR
MISSING_REQUIRED_COLUMN
MISSING_ASSIGNMENT
MAINTENANCE_OPERATION_WARNING
```

Issue metadata must avoid storing full source rows or raw workbook content.

## Retention

Policy:

```text
Current month: daily detail + monthly summary
Previous month: daily detail + monthly summary
Older months: monthly summaries only
```

Old months are compressed by deleting daily records only after summaries are available.

`AttendanceMonthlyUserSummary.sourceDailyRecordsAvailable` and `archiveStatus` record whether daily detail remains available for a month.

## Maintenance Reset Boundary

Attendance-only reset operations may affect only:

```text
AttendanceDailyRecord
AttendanceMonthlyUserSummary
AttendanceMonthlyBranchSummary
AttendanceMonthlyChainSummary
AttendanceImportIssue
AttendanceImportBatch
```

They must never delete or mutate:

```text
User
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
Request
RequestApproval
Notification
AuditLog
Access-control data
Vendor
Chain
```

## Index Review

The schema includes indexes for batch, period, month, user, role, Branch, Chain, archive status, issue type, and issue date access patterns. Current report queries are covered by the existing single-field indexes plus summary table unique indexes.

Composite indexes can be considered later if production query plans show pressure on:

```text
AttendanceDailyRecord matchedUserId + monthKey
AttendanceDailyRecord assignmentVendorId + monthKey
AttendanceDailyRecord assignmentChainId + monthKey
AttendanceMonthlyUserSummary monthKey + role
AttendanceMonthlyUserSummary monthKey + assignmentVendorId
AttendanceMonthlyUserSummary monthKey + assignmentChainId
```

Do not add indexes speculatively without checking for duplicates and creating a Prisma migration.
