# Codex Prompt — Phase 1 Attendance Prisma Data Model

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

Phase 0 is complete and approved.

The approved Attendance Engine spec is:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

The planning file is:

```text
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
```

## Goal

Implement Phase 1 only: Prisma data model foundation for the Attendance Engine.

This phase must add schema/enums/indexes/migration only.

No runtime Attendance behavior should be implemented yet.

## Product Rules To Preserve

Use the approved spec exactly:

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
totalWorkingDays = count of ON_TIME + LATE only
ABSENT does not count as a working day
absentCount is separate
totalScheduledRows remains scheduled/source row count
```

Hard guardrails:

```text
Attendance data must not create users
Attendance data must not transfer users
Attendance data must not archive/deactivate users
Attendance data must not change Picker branch assignments
Attendance data must not change Champ assignments
Attendance data must not change Area Manager assignments
Attendance data must not mutate payroll, salary, or leave balances
```

## Required Repo Inspection Before Editing

Inspect these files before changing anything:

```text
AGENTS.md
README.md
docs/PLANNING_RESET.md
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
prisma/schema.prisma
```

Also inspect existing Prisma conventions around:

```text
User model
AuditLog model if present
Enums naming style
ID style
relations
indexes
createdAt/updatedAt conventions
nullable field style
migration workflow/scripts
```

Before editing, provide a short plan.

## Scope

Allowed:

```text
Update prisma/schema.prisma
Create Prisma migration for attendance models/enums
Run prisma validate/generate
Add docs note only if needed to explain a schema decision
```

Not allowed:

```text
No NestJS module
No API endpoint
No parser
No validator service
No calculation service
No UI
No frontend API client
No tests unless required only to satisfy existing schema checks
No seed data
No package dependency
No broad refactor
No unrelated schema changes
No changes to User source-of-truth hierarchy fields
```

Do not add `chainId`, `vendorId`, or `managerId` to `User`.

## Required Models

Add the minimum approved models for Phase 1:

```text
AttendanceImportBatch
AttendanceDailyRecord
AttendancePickerMonthlySummary
AttendanceImportIssue
```

Optional only if strongly justified by current schema style:

```text
AttendanceMonthLock
```

Do not add Branch/Chain monthly summary models in v1. Branch/Chain analytics are out of current scope.

## Required Enums

Create enums consistent with existing Prisma naming style. Candidate enums:

```text
AttendanceImportBatchStatus
AttendanceCalculatedStatus
AttendanceLateBucket
AttendanceLeaveType
AttendanceMatchStatus
AttendanceIssueSeverity
AttendanceIssueResolutionStatus
AttendanceIssueCode
```

Use the spec values where applicable.

Expected calculated statuses include:

```text
ON_TIME
LATE
ABSENT
OFF_DAY
ANNUAL_LEAVE
MEDICAL_LEAVE
OTHER_LEAVE
EXCLUDED_NON_EGYPT
UNMATCHED_IDENTIFIER
EXCLUDED_NOT_PICKER
INVALID_OR_MISSING_ATTENDANCE_DATA
```

Late buckets:

```text
NONE
LATE_1
LATE_2
LATE_3
```

Batch statuses:

```text
UPLOADED
VALIDATED
CONFIRMED
ACTIVE
REPLACED
FAILED
LOCKED
```

Issue severities:

```text
ERROR
WARNING
```

Issue resolution statuses:

```text
OPEN
IGNORED
RESOLVED
```

Issue codes must include:

```text
MTD_COVERAGE_START_NOT_MONTH_START
MTD_COVERAGE_END_NOT_YESTERDAY
MTD_INCLUDES_UPLOAD_DAY
MTD_INCLUDES_FUTURE_DATE
MISSING_IDENTIFIER
UNMATCHED_IDENTIFIER
MATCHED_USER_NOT_PICKER
NON_EGYPT_ROW
INVALID_SHIFT_DATE
INVALID_TIME
MISSING_CHECKIN
UNKNOWN_STATUS
DUPLICATE_PICKER_DATE
MULTIPLE_MONTHS_IN_FILE
INVALID_REQUIRED_COLUMN
INVALID_WORK_DURATION
INVALID_SHIFT_DURATION
INVALID_BREAK_DURATION
```

## Model Requirements

### AttendanceImportBatch

Purpose: metadata and lifecycle state for one uploaded attendance file/batch.

Required field concepts:

```text
id
periodMonth
fileName
fileHash
uploadedByUserId
uploadedAt
status
rowCount
egyptRows
matchedPickerRows
unmatchedRows
excludedNonPickerRows
excludedNonEgyptRows
errorRows
warningRows
coverageStartDate
coverageEndDate
expectedCoverageEndDate
replaceOfBatchId
confirmedByUserId
confirmedAt
notes
createdAt
updatedAt
```

Relations:

```text
uploadedBy -> User
confirmedBy -> User nullable
replaceOfBatch -> AttendanceImportBatch nullable
replacedByBatches -> AttendanceImportBatch[]
dailyRecords -> AttendanceDailyRecord[]
monthlySummaries -> AttendancePickerMonthlySummary[]
issues -> AttendanceImportIssue[]
```

### AttendanceDailyRecord

Purpose: calculated daily attendance result for one Picker/source row.

Required field concepts:

```text
id
importBatchId
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
createdAt
updatedAt
```

Relations:

```text
importBatch -> AttendanceImportBatch
user -> User nullable only if the design stores excluded/unmatched debug rows; otherwise required for calculated picker rows
```

Schema decision required:

Choose whether `AttendanceDailyRecord` stores only matched Picker calculated rows, or also stores excluded/unmatched debug rows.

Recommendation:

```text
Store daily records for matched Picker calculated rows only.
Store excluded/unmatched details in AttendanceImportIssue and batch counts.
```

If you choose a different approach, explain why in final Known Risks.

### AttendancePickerMonthlySummary

Purpose: fast monthly summary per Picker per active batch.

Required field concepts:

```text
id
periodMonth
sourceBatchId
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
createdAt
updatedAt
```

Important:

```text
totalWorkingDays = ON_TIME + LATE only
ABSENT does not count as totalWorkingDays
```

Relations:

```text
sourceBatch -> AttendanceImportBatch
user -> User
```

### AttendanceImportIssue

Purpose: validation/calculation issue audit for import preview and review.

Required field concepts:

```text
id
batchId
rowNumber
shopperId
severity
issueCode
fieldName
message
resolutionStatus
createdAt
updatedAt
```

Relation:

```text
batch -> AttendanceImportBatch
```

## Indexes / Constraints

Add practical indexes for future reads and replace operations.

Expected useful indexes:

```text
AttendanceImportBatch(periodMonth, status)
AttendanceImportBatch(uploadedAt)
AttendanceDailyRecord(periodMonth, shiftDate)
AttendanceDailyRecord(periodMonth, userId)
AttendanceDailyRecord(shopperId)
AttendanceDailyRecord(importBatchId)
AttendancePickerMonthlySummary(periodMonth, userId)
AttendancePickerMonthlySummary(sourceBatchId)
AttendancePickerMonthlySummary(shopperId)
AttendanceImportIssue(batchId)
AttendanceImportIssue(issueCode)
AttendanceImportIssue(severity)
```

Unique constraints to consider:

```text
AttendanceDailyRecord(importBatchId, userId, shiftDate)
AttendancePickerMonthlySummary(sourceBatchId, userId)
```

Do not add a global unique constraint on `(periodMonth, userId, shiftDate)` because replaced historical batches may coexist.

## Data Type Guidance

Use schema-consistent types.

Recommended concepts:

```text
periodMonth: String formatted YYYY-MM, or Date representing first day of month if existing schema prefers DateTime
shiftDate: DateTime or Date-equivalent pattern used in repo
scheduledStartTime / scheduledEndTime: String if time-only type is not available in Prisma/Postgres style, or DateTime fields if repo prefers combined timestamps
scheduledStartAt / scheduledEndAt: DateTime
actualCheckinTime / actualCheckoutTime: DateTime nullable
scheduledShiftHours / actualWorkDurationHours: Decimal or Float consistent with repo style
breakDurationMins / rawLateMins / graceMins / chargeableLateMins: Int
boolean flags: Boolean with defaults where safe
counts: Int default 0
```

Avoid overengineering. The goal is a clean schema foundation for later parser/calculation phases.

## Migration

Create a Prisma migration using the repo's existing migration workflow.

Do not hand-edit generated migration unless necessary.

Do not run seed.

Do not reset the database.

## Checks Required

Run:

```powershell
npm run prisma:validate
npm run prisma:generate
```

If those pass and time allows, also run:

```powershell
npm run typecheck
```

Do not claim any check passed unless it actually ran.

If migration generation requires local database access and fails, report the exact reason and whether `schema.prisma` still validates.

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
