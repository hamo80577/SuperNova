# Codex Prompt — Phase 3 Attendance Calculation Engine

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
```

Approved spec:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Implementation plan:

```text
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
```

Phase 2 parser/validator files are under:

```text
apps/api/src/attendance
```

## Goal

Implement Phase 3 only: backend Attendance Calculation Engine.

The calculation engine should take validated eligible parsed rows for matched SuperNova Pickers and produce in-memory calculated outputs shaped for later storage:

```text
Daily calculated records
Picker monthly summaries
Calculation issues where needed
```

This phase must not persist final attendance data.

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

Late buckets use raw late minutes:

```text
NONE   = rawLateMins <= 15
LATE_1 = rawLateMins 16 - 30
LATE_2 = rawLateMins 31 - 45
LATE_3 = rawLateMins >= 46
```

Store/calculate both concepts:

```text
rawLateMins = actualCheckin - scheduledStart
chargeableLateMins = max(0, rawLateMins - 15)
```

## Hard Guardrails

Do not implement Phase 4 storage/replace yet.

Do not implement:

```text
No confirm replace endpoint
No Prisma create/update/delete/transaction for attendance results
No Admin report API
No UI
No frontend code
No Picker attendance page
No Branch/Chain analytics
No payroll
No salary deductions
No annual leave balance mutation
No GPS/live punching
No biometric integration
No order integration
No user creation from attendance
No assignment changes from attendance
```

Attendance files/calculations must not mutate SuperNova operational source-of-truth data.

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
apps/api/src/attendance/attendance-preview.types.ts
apps/api/test/attendance-parser-validator.test.ts
apps/api/src/app.module.ts
apps/api/package.json
```

Before edits, provide a short plan.

## Scope Allowed

Allowed:

```text
Add attendance calculation service
Add calculation output types/DTOs
Add focused backend tests for calculation rules
Small refactor of Phase 2 parser/validator types only if necessary to avoid duplicating parsing/validation logic
Export the new calculation service from AttendanceModule
```

Not allowed:

```text
No API controller
No route
No database writes
No migration
No UI
No frontend client
No seed data
No broad refactor
No unrelated cleanup
No new dependency unless absolutely necessary and justified
```

## Expected Design

Prefer a small structure like:

```text
apps/api/src/attendance/
  attendance-calculation.service.ts
  attendance-calculation.types.ts
```

or a repo-consistent equivalent.

Keep calculation deterministic and easy to test.

Do not create a large god-file.

The upload date/timezone decision from Phase 2 remains isolated. Do not expand timezone complexity unless required for calculation tests.

## Input Expectations

The calculation engine may accept a purpose-built internal input DTO instead of raw Excel rows if that keeps the service clean.

It should be compatible with Phase 2 parsed/validated rows and matched Picker users.

Because Phase 2 preview intentionally does not persist or expose all source row details, a small internal result type may be introduced if needed, for example:

```text
Parsed row + matched user + row issue count + eligibility state
```

If you refactor Phase 2 to expose reusable internals, keep the change minimal and do not break existing tests.

## Daily Calculation Output

Produce daily record DTOs aligned with Phase 1 schema/spec fields:

```text
periodMonth
shiftDate
shopperId
userId
pickerNameSnapshot
sourceName
sourceDesignation
division
sourceSubDivision
sourceLocation
sourceLocationCode
shiftName
scheduledStartTime
scheduledEndTime
scheduledStartAt
scheduledEndAt
scheduledShiftHours
breakDurationMins
actualCheckinTime
actualCheckoutTime
actualWorkDurationHours
sourceStatus
calculatedStatus
rawLateMins
graceMins
chargeableLateMins
lateBucket
isLate
isOnTime
isAbsent
isOffDay
isOnLeave
leaveType
isAnnualLeave
isMedicalLeave
isWorkingDay
isUnder8Hours
isOver15Hours
matchStatus
rawRowNumber
rowHash
issuesCount
```

No `importBatchId` is required in Phase 3 output unless you model it as optional placeholder for Phase 4.

## Monthly Summary Output

Produce monthly Picker summary DTOs aligned with Phase 1 schema/spec fields:

```text
periodMonth
shopperId
userId
pickerNameSnapshot
totalScheduledRows
totalWorkingDays
onTimeDays
lateDays
totalRawLateMins
totalChargeableLateMins
late1Count
late2Count
late3Count
absentCount
leaveCount
annualLeaveCount
medicalLeaveCount
otherLeaveCount
offDayCount
under8HoursCount
over15HoursCount
firstShiftDate
lastShiftDate
lastCalculatedAt
```

Important:

```text
totalWorkingDays = ON_TIME + LATE only
ABSENT does not count as totalWorkingDays
```

## Calculated Status Priority

Use this exact priority for eligible matched Picker rows:

```text
1. Shift Name contains Off Day
   -> OFF_DAY

2. Shift Name contains Annual Leave
   -> ANNUAL_LEAVE

3. Shift Name contains Medical Leave
   -> MEDICAL_LEAVE

4. Source Status = On Leave
   -> OTHER_LEAVE

5. Source Status = Absent
   -> ABSENT

6. Actual Checkin exists and Scheduled Start exists
   -> calculate rawLateMins
   -> rawLateMins <= 15 => ON_TIME
   -> rawLateMins > 15  => LATE

7. Otherwise
   -> INVALID_OR_MISSING_ATTENDANCE_DATA
```

Non-Egypt, unmatched, and non-Picker rows should not produce final daily calculated records in v1. They remain preview/issues concerns from Phase 2.

## Late Calculation Details

Rules:

```text
scheduledStartAt = shiftDate + scheduledStartTime
scheduledEndAt = shiftDate + scheduledEndTime, unless overnight support is explicitly implemented
actualCheckinAt = shiftDate + actualCheckinTime
actualCheckoutAt = shiftDate + actualCheckoutTime when present
rawLateMins = max(0, actualCheckinAt - scheduledStartAt in minutes)
graceMins = 15
chargeableLateMins = max(0, rawLateMins - 15)
```

If check-in is before scheduled start:

```text
rawLateMins = 0
chargeableLateMins = 0
lateBucket = NONE
calculatedStatus = ON_TIME
```

Late buckets:

```text
rawLateMins <= 15 => NONE
16 - 30 => LATE_1
31 - 45 => LATE_2
46+ => LATE_3
```

Do not use source `Status = Late` as final truth when actual check-in is within the 15-minute grace period.

Reports/calculations must use calculated status.

## Leave / Off Day Rules

Rules:

```text
Shift Name containing Off Day has priority over status.
Shift Name containing Annual Leave has priority over generic On Leave.
Shift Name containing Medical Leave has priority over generic On Leave.
Status On Leave becomes OTHER_LEAVE only if annual/medical leave was not identified.
Leave/off-day rows are not working days.
Leave/off-day rows do not calculate late minutes.
Leave/off-day rows must not mutate leave balances.
```

## Duration Rules

Rules:

```text
isUnder8Hours = true only when isWorkingDay = true and actualWorkDurationHours < 8
isOver15Hours = true only when isWorkingDay = true and actualWorkDurationHours > 15
ABSENT rows are not working days and must not trigger under/over duration flags
```

## Row Hash

Generate a deterministic row hash from normalized row content that is stable across repeated imports of the same row.

Do not include random values or current timestamps in rowHash.

## Tests Required

Add focused backend tests for calculation.

Use generated in-memory rows/DTOs only.

Do not use real personal data.

Do not rely on the temporary Excel sample file.

Tests should cover at least:

```text
On time when check-in is before scheduled start
On time when check-in is exactly scheduled start
On time when rawLateMins = 15
LATE_1 when rawLateMins = 16
LATE_1 upper bound rawLateMins = 30
LATE_2 lower bound rawLateMins = 31
LATE_2 upper bound rawLateMins = 45
LATE_3 when rawLateMins = 46
chargeableLateMins = rawLateMins - 15
source Status Late but check-in within grace becomes ON_TIME
Absent does not count as working day
Off Day priority
Annual Leave priority
Medical Leave priority
Generic On Leave -> OTHER_LEAVE
Under 8 hours only for worked rows
Over 15 hours only for worked rows
Monthly summary counts ON_TIME + LATE only for totalWorkingDays
Monthly summary absentCount separate
Multiple Pickers produce separate monthly summaries
```

Keep existing Phase 2 parser/validator tests passing.

## Checks Required

Run:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
```

Run existing and new focused backend tests, including:

```powershell
npx tsx apps/api/test/attendance-parser-validator.test.ts
```

and the new calculation test file.

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
