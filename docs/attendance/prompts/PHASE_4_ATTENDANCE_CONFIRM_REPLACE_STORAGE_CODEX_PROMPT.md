# Codex Prompt — Phase 4 Attendance Confirm Replace + Storage

You are working in the SuperNova repository.

## Context

SuperNova is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Current branch:

```text
feature/attendance-analytics-clean-v2
```

Completed phases:

```text
Phase 0 — Attendance Engine specification
Phase 1 — Prisma data model foundation
Phase 2 — Backend Excel parser + validator preview
Phase 3 — Backend in-memory calculation engine
```

Approved spec:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Implementation plan:

```text
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
```

Phase 2 and Phase 3 code is under:

```text
apps/api/src/attendance
```

## Goal

Implement Phase 4 only: backend persistence and safe monthly replace workflow for attendance imports.

This phase should connect the existing parser, validator, and calculation engine to PostgreSQL storage using Prisma.

The expected workflow is:

```text
Upload/preview MTD file
→ parse + validate + match users by User.shopperId
→ calculate daily records + picker monthly summaries
→ persist a non-active import batch with issues and calculated records/summaries
→ confirm the batch
→ transactionally mark previous ACTIVE batch for the same month as REPLACED
→ mark the confirmed batch as ACTIVE
→ write audit log
```

Reports must not be added in this phase.

UI must not be added in this phase.

## Product Rules To Preserve

```text
Identifier = User.shopperId
Division = Egypt / EGYPT only
Role comes from SuperNova, not Excel Designation
Only SuperNova role PICKER is calculated in v1
MTD upload covers month start through yesterday only, not today/upload day
Grace period = 15 minutes
Late bucket rule = Option B
```

Working-day definition:

```text
isWorkingDay = true only for ON_TIME or LATE
totalWorkingDays = ON_TIME + LATE only
ABSENT does not count as a working day
absentCount is separate
totalScheduledRows remains scheduled/source row count
```

## Hard Guardrails

Do not implement:

```text
No Admin daily report API
No Picker attendance API
No UI
No frontend code
No Branch/Chain analytics
No payroll
No salary deductions
No annual leave balance mutation
No GPS/live punching
No biometric integration
No order integration
No user creation from attendance
No assignment changes from attendance
No direct lifecycle mutation
No new Prisma schema changes unless absolutely required and explained before edits
```

Attendance data must not mutate SuperNova operational source-of-truth data.

Do not add `chainId`, `vendorId`, or `managerId` to `User`.

## Required Repo Inspection Before Editing

Inspect these files first:

```text
AGENTS.md
README.md
docs/PLANNING_RESET.md
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
prisma/schema.prisma
apps/api/src/attendance/attendance-parser.service.ts
apps/api/src/attendance/attendance-validator.service.ts
apps/api/src/attendance/attendance-calculation.service.ts
apps/api/src/attendance/attendance-preview.types.ts
apps/api/src/attendance/attendance-calculation.types.ts
apps/api/test/attendance-parser-validator.test.ts
apps/api/test/attendance-calculation-engine.test.ts
apps/api/src/app.module.ts
```

Also inspect existing backend conventions for:

```text
PrismaService injection
Auth guards/current-user decorators
Role/access checks
AuditLog creation
Controller patterns
Multipart file upload patterns, if any
Error handling style
Existing tests for services/controllers
```

Before edits, provide a short plan.

## Scope Allowed

Allowed:

```text
Add attendance import persistence service
Add DB-backed User.shopperId lookup for validator/calculation input
Add confirm/replace service method
Add minimal Admin/Super Admin backend import endpoints if consistent with repo patterns
Add focused backend tests for persistence/replace behavior using mocked Prisma or existing test style
Add audit log writes for upload/validation/confirm/replace outcomes
```

Endpoint scope, if added:

```text
POST /attendance/imports/preview  -> upload file, validate, calculate, persist non-active batch, return preview/batch id
POST /attendance/imports/:batchId/confirm -> confirm validated batch and activate it
```

Route names may follow existing repo conventions, but behavior must stay within this scope.

Not allowed:

```text
No report/list/read APIs beyond minimal preview/confirm response
No UI
No frontend API client
No report table endpoint
No Picker self-view endpoint
No branch/chain summary endpoint
No seed data
No broad refactor
No unrelated cleanup
No new package dependency unless absolutely necessary and justified
```

## Persistence Decision For Phase 4

Use this approach unless a strong repo constraint prevents it:

### Preview/upload persists a non-active batch

On preview upload:

```text
Create AttendanceImportBatch with status VALIDATED if validation can be evaluated
Create AttendanceImportIssue records
If there are no blocking errors, create AttendanceDailyRecord rows and AttendancePickerMonthlySummary rows linked to the batch
Do not make the batch ACTIVE yet
Do not replace previous ACTIVE batch yet
Reports must ignore non-ACTIVE batches in later phases
```

If validation has blocking errors:

```text
Create AttendanceImportBatch with status FAILED or VALIDATED with error counts, depending on existing style
Create AttendanceImportIssue records
Do not create daily records or monthly summaries
Do not allow confirm
```

### Confirm activates the batch transactionally

On confirm:

```text
Validate requester is ADMIN or SUPER_ADMIN
Load batch
Reject if batch has blocking errors
Reject if batch is FAILED, REPLACED, LOCKED, or already ACTIVE
Find existing ACTIVE batch for same periodMonth
Within one transaction:
  mark existing ACTIVE batch as REPLACED, if present
  set new batch replaceOfBatchId to previous active id, if present
  set new batch status ACTIVE
  set confirmedByUserId and confirmedAt
  create AuditLog entry
```

A failed confirm must leave the previous active batch unchanged.

## Matching / Lookup Requirement

Implement a DB-backed lookup compatible with the Phase 2 `AttendanceUserLookup` abstraction:

```text
find users where shopperId in uploaded identifiers
select id, shopperId, role, nameEn
```

Do not match by name, phone, designation, location, national id, branch, or source Role column.

## Mapping Calculation Output To Prisma

Map Phase 3 daily calculation records to `AttendanceDailyRecord`.

Important conversion points:

```text
periodMonth remains YYYY-MM string
shiftDate should be stored consistently with Phase 1 DateTime field, normally date-only at start of day
scheduledStartAt/scheduledEndAt should map from ISO string output to DateTime where present
actualCheckinTime/actualCheckoutTime currently may be time-only strings from Phase 3; convert to DateTime using shiftDate, or adjust calculation output mapping carefully
Decimal fields may require Prisma Decimal-compatible values depending on existing Prisma client behavior
```

Do not silently store invalid dates.

If a mapping decision is uncertain, keep it isolated and cover it in tests.

## Import Batch Counts

Store these counts from validation preview:

```text
rowCount
egyptRows
matchedPickerRows
unmatchedRows
excludedNonPickerRows
excludedNonEgyptRows / nonEgyptRows
errorRows
warningRows
coverageStartDate
coverageEndDate
expectedCoverageEndDate
```

## Import Issues

Persist issues from both validation and calculation where applicable.

Fields:

```text
batchId
rowNumber
shopperId
severity
issueCode
fieldName
message
resolutionStatus
```

## Access Control

Backend must enforce access control.

Frontend hiding is not security.

Preview/upload and confirm are allowed only for:

```text
ADMIN
SUPER_ADMIN
```

Use existing project auth/access patterns.

If this phase is service-level only, expose methods that clearly require an actor user and validate allowed roles before persistence/confirm.

## Audit Requirements

Create AuditLog entries for at least:

```text
Attendance import preview created
Attendance import confirm activated batch
Attendance import replaced previous active batch, when applicable
Attendance import rejected/failed validation, if persisted as failed batch
```

Audit should include safe metadata only:

```text
periodMonth
batchId
coverageStartDate
coverageEndDate
expectedCoverageEndDate
rowCount
errorRows
warningRows
previousActiveBatchId when replaced
```

Do not log raw file contents, passwords, secrets, or environment values.

## Tests Required

Add focused backend tests for storage/replace behavior.

Use existing repo test style. Mock Prisma if that is the current lightweight pattern.

Tests should cover at least:

```text
Preview creates non-active batch and issues
Preview with valid rows creates daily records and monthly summaries linked to batch
Preview with blocking errors does not create daily records or monthly summaries
Confirm activates a valid batch
Confirm replaces previous ACTIVE batch for same periodMonth
Confirm failure leaves previous ACTIVE unchanged
Cannot confirm failed batch
Cannot confirm batch with errorRows > 0
ADMIN/SUPER_ADMIN allowed
PICKER/CHAMP/AREA_MANAGER rejected
No User creation/update/assignment mutation happens
```

Keep existing tests passing:

```powershell
npx tsx apps/api/test/attendance-parser-validator.test.ts
npx tsx apps/api/test/attendance-calculation-engine.test.ts
```

## Checks Required

Run:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
```

Run the focused Phase 4 test file and existing attendance tests.

Do not claim checks passed unless they actually ran.

If a check fails because of existing unrelated repo issues, state that clearly with evidence.

## Final Response Format

Respond with:

```text
Summary
Files Changed
Behavior Changes
Tests/Checks Run
Manual Verification
Known Risks
Completion Status
Next Recommendation
```

Completion Status should be one of:

```text
Complete
Complete with known risks
Blocked
Partially complete
Rejected / needs correction
```
