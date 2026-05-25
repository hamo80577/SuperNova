# Attendance Engine Implementation Plan

## Status

This is a new clean plan for the Attendance Engine.

It replaces the rejected old attendance direction.

Do not use old attendance branches or old phase documents as implementation authority.

## Product Goal

Build an internal SuperNova Attendance Engine that accepts a daily MTD Excel upload, calculates picker attendance results, stores the calculated data in PostgreSQL, and exposes clean role-based reports.

The first version focuses on Picker-level attendance only.

No Branch/Chain aggregated metrics are required in v1.

## Core Input

The input is an MTD Excel sheet uploaded daily.

Important cutoff rule:

```text
MTD means from the first day of the month through yesterday only.
It does not include the upload day / today.
```

Example behavior:

```text
Uploaded on May 9  -> file covers May 1 - May 8  -> May active snapshot v1
Uploaded on May 10 -> file covers May 1 - May 9  -> May active snapshot v2 replaces v1
Uploaded on May 11 -> file covers May 1 - May 10 -> May active snapshot v3 replaces v2
```

The upload is not append-based.

Every new upload for the same period replaces the active monthly snapshot after validation and confirmation.

The engine must store and validate the file coverage range:

```text
coverageStartDate = first shift date in the file
coverageEndDate = last shift date in the file
expectedCoverageEndDate = upload date - 1 day, unless this is a historical/manual import
```

## Hard Guardrails

Attendance must not mutate operational source-of-truth data.

Forbidden in v1:

```text
Create users
Transfer users
Archive/deactivate users
Change Picker branch assignment
Change Champ assignment
Change Area Manager assignment
Payroll
Salary deductions
Annual leave balance mutation
GPS/live punching
Biometric integration
Order integration
Branch/Chain analytics as first scope
```

SuperNova remains source of truth for user role and operational assignment context.

## Business Rules Approved For v1

### Matching

```text
Excel Identifier = SuperNova User.shopperId
```

Do not match by name.

If Identifier does not match a SuperNova user, create an import issue.

### Division filter

Only rows with:

```text
Division = Egypt / EGYPT
```

are eligible for calculation.

Non-Egypt rows are excluded and counted in import preview.

### MTD coverage rule

Daily MTD upload coverage is from month start through yesterday.

For normal daily imports:

```text
latest Shift Date in file must be yesterday relative to upload date
```

If the file contains today, future dates, or dates after the expected cutoff, the validation preview must surface this clearly before confirmation.

Historical/manual imports can be handled later with stricter confirmation and audit requirements.

### Role source

Role is taken from SuperNova, not from the Excel `Designation` column.

Only users with SuperNova role `PICKER` are calculated in v1.

The Excel `Designation` value is stored only as source snapshot/debug information.

### Late grace period

```text
Grace period = 15 minutes
```

A Picker is not considered late for the first 15 minutes after scheduled start.

### Late bucket rule — Option B

Late buckets use raw late minutes from scheduled start time.

```text
NONE   = rawLateMins <= 15
LATE_1 = rawLateMins 16 - 30
LATE_2 = rawLateMins 31 - 45
LATE_3 = rawLateMins >= 46
```

Store both values:

```text
rawLateMins = actualCheckin - scheduledStart
chargeableLateMins = max(0, rawLateMins - 15)
```

Reports should use calculated status, not source status, for final attendance logic.

## Main Output Tables

### 1. AttendanceImportBatch

Purpose: track each uploaded file, validation result, confirmation, replacement, and active snapshot state.

Candidate fields:

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

Expected statuses:

```text
UPLOADED
VALIDATED
CONFIRMED
ACTIVE
REPLACED
FAILED
LOCKED
```

### 2. AttendanceDailyRecord

Purpose: store the calculated daily attendance result for each Picker and shift date.

Candidate fields:

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
sourceDivision
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

### 3. AttendancePickerMonthlySummary

Purpose: provide fast Picker monthly report data without recalculating all rows on every page load.

Candidate fields:

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

### 4. AttendanceImportIssue

Purpose: store validation and calculation issues for audit and operational review.

Candidate fields:

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

Candidate issue codes:

```text
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
MTD_COVERAGE_START_NOT_MONTH_START
MTD_COVERAGE_END_NOT_YESTERDAY
MTD_INCLUDES_UPLOAD_DAY
MTD_INCLUDES_FUTURE_DATE
```

## Calculated Status Priority

Use this priority order:

```text
1. Division not Egypt/EGYPT
   -> EXCLUDED_NON_EGYPT

2. Identifier does not match User.shopperId
   -> UNMATCHED_IDENTIFIER

3. Matched user is not role PICKER in SuperNova
   -> EXCLUDED_NOT_PICKER

4. Shift Name contains Off Day
   -> OFF_DAY

5. Shift Name contains Annual Leave
   -> ANNUAL_LEAVE

6. Shift Name contains Medical Leave
   -> MEDICAL_LEAVE

7. Source Status = On Leave
   -> OTHER_LEAVE

8. Source Status = Absent
   -> ABSENT

9. Actual Checkin exists and Scheduled Start exists
   -> calculate rawLateMins
   -> rawLateMins <= 15 => ON_TIME
   -> rawLateMins > 15  => LATE

10. Otherwise
   -> INVALID_OR_MISSING_ATTENDANCE_DATA
```

## Report Output Headers

The first UI report should be a daily Picker attendance table.

Recommended visible columns:

```text
Picker
Shopper ID
Date
Shift
Scheduled Start
Scheduled End
Check-in
Check-out
Work Hours
Status
Raw Late
Chargeable Late
Late Bucket
Leave Type
Location
Issues
```

Row detail drawer should show:

```text
Source Name
Source Designation
Source Status
SuperNova Role
Import Batch
Raw row number
Late calculation explanation
Warnings/errors
```

## Import Flow

### Step 1 — Upload

Admin/Super Admin uploads MTD Excel file.

The file is parsed server-side only.

Do not parse attendance files in the frontend.

### Step 2 — Validate

Backend validates:

```text
Required columns exist
File contains one period month
Coverage starts at month start
Coverage ends at yesterday for normal daily import
File does not include upload day/today for normal daily import
File does not include future dates
Division values
Identifier values
Date/time values
Duplicate picker/date rows
Supported statuses
```

### Step 3 — Preview

Before applying, show preview:

```text
Total rows
Egypt rows
Matched Picker rows
Unmatched rows
Excluded non-Picker rows
Excluded non-Egypt rows
Warnings
Errors
Period covered
Expected coverage end date
Coverage mismatch warnings/errors
Replacement impact for the active month
```

### Step 4 — Confirm Replace

Admin/Super Admin confirms.

System replaces the active monthly snapshot for the same period.

Previous active batch becomes `REPLACED`.

New confirmed batch becomes `ACTIVE`.

### Step 5 — Store Results

Backend stores:

```text
Daily calculated records
Picker monthly summaries
Import issues
Import batch metadata
Audit event
```

### Step 6 — Report

Reports read from PostgreSQL only.

No report should read directly from the uploaded Excel file.

## UI Scope v1

### Attendance Import Console

Candidate route:

```text
/admin/attendance/imports
```

or, if restricted to Super Admin:

```text
/super-admin/attendance/imports
```

Required areas:

```text
Upload MTD File
Validation Preview
Confirm Replace
Import History
Issues / Unmatched Rows
Month Lock status
```

### Daily Picker Attendance Report

Candidate route:

```text
/admin/reports/attendance
```

Required filters:

```text
Month
Date range
Picker search
Shopper ID
Status
Late only
Absent only
On Leave only
```

## Picker Self-Service Scope

A later phase should expose:

```text
/picker/attendance
```

Picker can see only their own attendance records and monthly summary.

This is not the first UI page unless explicitly prioritized.

## Access Control

Backend must enforce access control.

Frontend hiding is not security.

Initial recommendation:

```text
Upload/replace/lock: Admin or Super Admin only
Daily global report: Admin or Super Admin only
Picker self-view: Picker can read own data only
Champ/Area Manager views: future scoped reports only after v1 is stable
```

## Audit Requirements

Audit these events:

```text
Attendance file uploaded
Attendance file validated
Attendance month replaced
Attendance month locked/unlocked
Rejected/failed import
Dangerous historical replacement
MTD coverage mismatch accepted/rejected
```

Audit log should include:

```text
Actor
Operation
Period month
Batch id
Coverage start/end
Expected coverage end
Previous active batch id when replaced
Result
Timestamp
Reason if historical/locked data was changed
```

## Implementation Phases

### Phase 0 — Specification Only

Create/maintain the approved Attendance Engine spec.

No schema, API, parser, or UI changes.

Deliverable:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

### Phase 1 — Prisma Data Model

Add only schema foundation and migration.

Deliverables:

```text
AttendanceImportBatch
AttendanceDailyRecord
AttendancePickerMonthlySummary
AttendanceImportIssue
Enums for status, late bucket, issue severity, batch status
Indexes for month, userId, shopperId, shiftDate, batchId
```

No upload/API/UI in this phase.

### Phase 2 — Parser + Validator

Add backend service that reads the MTD Excel file and returns validation preview.

No final storage yet except temporary batch metadata if needed.

Add unit tests for column validation, row parsing, and MTD coverage validation.

### Phase 3 — Calculation Engine

Add calculation service for daily records and monthly summaries.

Test heavily:

```text
15-minute grace
Option B late buckets
On Time
Late
Absent
On Leave
Annual Leave
Medical Leave
Off Day
Under 8 hours
Over 15 hours
Unmatched Identifier
Non-Picker matched user
Non-Egypt rows
Duplicate picker/date rows
MTD from month start through yesterday
Reject/warn when file includes upload day
Reject/warn when file includes future dates
```

### Phase 4 — Confirm Replace + Storage

Add confirm endpoint that replaces active month snapshot safely.

Add transaction handling.

Add audit log.

Add import issue persistence.

### Phase 5 — Admin Daily Report API

Add read-only API for daily picker attendance report.

Support filters and pagination.

No UI yet unless explicitly included.

### Phase 6 — Admin Attendance UI

Build the report table and import console page.

Mobile-first but desktop table-friendly.

No fake dashboard clutter.

### Phase 7 — Picker Attendance Page

Expose Picker self-view.

Picker can see monthly summary and daily records only for themselves.

### Phase 8 — Maintenance Controls

Add month lock, import history, issue review, and controlled historical replacement.

## Verification Strategy

Every implementation phase must run the relevant checks:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Backend logic phases must include focused tests for parser, validator, calculation, replacement, coverage validation, and access control.

## First Codex Task Recommendation

Start with Phase 0 only.

Codex should inspect the repo and sample Excel file, then create:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Do not create Prisma models, API endpoints, parser, services, or UI in Phase 0.
