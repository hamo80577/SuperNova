# Codex Prompt — Phase 5 Attendance Admin Daily Report API

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
Phase 4 — Backend import storage + confirm/replace workflow
```

Approved spec:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Implementation plan:

```text
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
```

Phase 4 added preview/confirm endpoints and persisted attendance data.

## Goal

Implement Phase 5 only: Admin/Super Admin read-only Attendance Daily Report API.

The API must read stored attendance data from PostgreSQL via Prisma.

It must read only active confirmed monthly batches:

```text
AttendanceImportBatch.status = ACTIVE
```

This phase must not add UI or frontend code.

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
No UI
No frontend API client
No Picker self-view page/API
No Champ/Area Manager scoped attendance reports yet
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
No Prisma schema changes unless absolutely required and explained before edits
No new package dependency
```

Attendance report API must be read-only.

Do not create/update/delete attendance records in this phase.

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
apps/api/src/attendance/attendance-import.service.ts
apps/api/src/attendance/attendance-imports.controller.ts
apps/api/src/attendance/attendance-calculation.service.ts
apps/api/src/attendance/attendance.module.ts
apps/api/src/reports
apps/api/src/auth
apps/api/test/attendance-import-storage.test.ts
```

Also inspect existing report controller/service patterns, pagination/filter patterns, access guards, and test style.

Before edits, provide a short plan.

## Scope Allowed

Allowed:

```text
Add read-only attendance report service methods
Add Admin/Super Admin daily report endpoint
Add query DTO/types for filters and pagination
Add focused backend tests for report filtering/access/active-batch behavior
Export service from AttendanceModule if needed
```

Not allowed:

```text
No UI
No frontend code
No import/confirm behavior changes unless fixing a Phase 4 bug required for report correctness
No database writes
No migrations
No seed data
No broad refactor
No unrelated cleanup
```

## API Behavior

Add a read-only endpoint following repo conventions. Candidate endpoint:

```text
GET /attendance/reports/daily
```

Alternative route is acceptable if it better fits existing route conventions, but keep it clearly attendance-report focused.

Allowed roles:

```text
ADMIN
SUPER_ADMIN
```

Backend must enforce access control with existing guards/decorators.

## Required Filters

Support these query filters:

```text
periodMonth        required or default to latest ACTIVE month if existing patterns prefer defaults
dateFrom           optional YYYY-MM-DD
dateTo             optional YYYY-MM-DD
shopperId          optional exact/partial, choose and document behavior
pickerSearch       optional name/shopper search
status             optional calculatedStatus enum
lateOnly           optional boolean
absentOnly         optional boolean
onLeaveOnly        optional boolean
page               optional, default 1
pageSize           optional, default reasonable value, max capped
```

Keep filter behavior simple and explicit.

Do not add Branch/Chain filters in Phase 5.

## Active Batch Rule

The report must only read daily records linked to ACTIVE batches.

Implementation should enforce:

```text
AttendanceDailyRecord.importBatch.status = ACTIVE
```

If `periodMonth` is provided:

```text
Read the ACTIVE batch for that periodMonth only.
Return empty result if no ACTIVE batch exists.
```

If `periodMonth` is omitted:

```text
Either reject with a clear BadRequestException OR use the latest ACTIVE batch.
Choose based on existing API style and document the decision in final response.
```

Recommendation:

```text
Require periodMonth in Phase 5 to avoid ambiguous reports.
```

## Response Shape

Return a practical report response:

```text
periodMonth
activeBatchId
coverageStartDate
coverageEndDate
expectedCoverageEndDate
pagination
summary
rows
```

Suggested `summary`:

```text
totalRows
onTimeCount
lateCount
absentCount
leaveCount
offDayCount
under8HoursCount
over15HoursCount
totalRawLateMins
totalChargeableLateMins
```

Suggested row fields:

```text
id
pickerName
shopperId
userId
shiftDate
shiftName
scheduledStartTime
scheduledEndTime
actualCheckinTime
actualCheckoutTime
actualWorkDurationHours
calculatedStatus
rawLateMins
chargeableLateMins
lateBucket
leaveType
isWorkingDay
isUnder8Hours
isOver15Hours
sourceLocation
sourceDesignation
issuesCount
```

Do not expose raw full file contents.

Do not expose passwords/secrets/private env values.

## Sorting

Default sort:

```text
shiftDate ASC, pickerNameSnapshot ASC, shopperId ASC
```

Keep sorting simple. Do not add complex arbitrary sort params in Phase 5 unless existing report APIs already have a safe pattern.

## Tests Required

Add focused backend tests.

Use existing repo style. Mock Prisma if that is current lightweight test pattern.

Tests should cover at least:

```text
ADMIN/SUPER_ADMIN allowed
PICKER/CHAMP/AREA_MANAGER rejected
Reads only ACTIVE batch records
Does not read VALIDATED/FAILED/REPLACED batches
periodMonth required or latest-active behavior is tested, depending on chosen design
dateFrom/dateTo filters
status filter
lateOnly filter
absentOnly filter
onLeaveOnly filter
pickerSearch/shopperId filter
pagination cap/default
summary counts match filtered rows
No database writes occur
```

Keep existing attendance tests passing:

```powershell
npx tsx apps/api/test/attendance-parser-validator.test.ts
npx tsx apps/api/test/attendance-calculation-engine.test.ts
npx tsx apps/api/test/attendance-import-storage.test.ts
```

## Checks Required

Run:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
```

Run the new focused Phase 5 report test and existing attendance tests.

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
