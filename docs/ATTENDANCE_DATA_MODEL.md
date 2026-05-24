# Attendance Data Model

## Status

This document is a future implementation guide only.

Phase 0 does not change `prisma/schema.prisma`, create migrations, or create API modules.

## Proposed Concepts

Future attendance schema design should evaluate these concepts:

```text
AttendanceImportBatch
AttendanceDailyRecord
AttendanceMonthlyUserSummary
AttendanceMonthlyBranchSummary
AttendanceMonthlyChainSummary
AttendanceImportIssue
```

## AttendanceImportBatch

Purpose:

```text
tracks one upload, preflight, recalculation, or maintenance operation
```

Likely responsibilities:

```text
fileName
fileHash
upload mode
periodFrom
periodTo
status
step/progress metadata
row counts
matched counts
ignored non-Egypt counts
issue counts
createdBy
createdAt
finishedAt
```

Do not store the permanent original XLSX file.

## AttendanceDailyRecord

Purpose:

```text
stores calculated per-user daily detail for current and previous month only
```

Likely responsibilities:

```text
batchId
userId
roleAtImport
identifier
shiftDate
status
shiftName
scheduledStart
scheduledEnd
actualCheckin
actualCheckout
actualWorkDurationHours
lateMinutes
metric flags
assignment context needed for rollups
```

Daily records older than the retention window should be compressed into monthly summaries and removed.

## AttendanceMonthlyUserSummary

Purpose:

```text
stores compressed per-user month metrics
```

It should retain enough calculated metrics to report history without raw daily rows.

## AttendanceMonthlyBranchSummary

Purpose:

```text
stores Picker-only Branch monthly rollups
```

Champ attendance must not be included.

## AttendanceMonthlyChainSummary

Purpose:

```text
stores Picker-only Chain monthly rollups
```

Champ attendance must not be included.

## AttendanceImportIssue

Purpose:

```text
stores warnings and errors from import, matching, validation, duplicate detection, recalculation, and maintenance
```

Examples:

```text
UNMATCHED_IDENTIFIER
AMBIGUOUS_IDENTIFIER_MATCH
UNSUPPORTED_ROLE
DUPLICATE_IDENTIFIER_SHIFT_DATE
ROW_PARSE_ERROR
MISSING_REQUIRED_COLUMN
```

## Retention

Do not permanently store uploaded files.

Retention policy:

```text
Current month: daily detail + monthly summary
Previous month: daily detail + monthly summary
Older months: monthly summaries only
```

Old months should be compressed.

Example:

```text
If January has 16,000 rows for 550 people, old storage should keep about 550 monthly user summary rows, not all 16,000 raw rows.
```

## Open Design Risk

The implementation must decide how to snapshot assignment context for historical rollups.

Using only current assignments may make historical Branch/Chain reports inaccurate after transfers.
