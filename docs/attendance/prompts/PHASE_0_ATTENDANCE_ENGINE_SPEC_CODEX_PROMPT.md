# Codex Prompt — Phase 0 Attendance Engine Specification

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

The previous Attendance implementation direction was rejected. Do not continue from old rejected branches or old attendance phases.

This task is **planning/specification only**.

## Goal

Create a clear, implementation-ready specification for the new Attendance Engine.

The engine will later support:

```text
Daily MTD Excel upload
MTD coverage from month start through yesterday only
Monthly snapshot replace
Backend validation
Backend calculation
PostgreSQL stored calculated results
Daily Picker attendance report
Future Picker self-service attendance view
```

## Business Rules Already Approved

Use these rules as product decisions:

```text
Identifier = SuperNova User.shopperId
Division = Egypt / EGYPT only
Role comes from SuperNova, not Excel Designation
Only SuperNova role PICKER is calculated in v1
Excel Designation is stored only as source/debug snapshot
MTD upload covers first day of month through yesterday only, not today/upload day
Grace period = 15 minutes
Late bucket rule = Option B
```

MTD cutoff rule:

```text
For normal daily imports, latest Shift Date in the file must equal upload date - 1 day.
The file must not include today/upload day or future dates.
```

Late buckets:

```text
NONE   = rawLateMins <= 15
LATE_1 = rawLateMins 16 - 30
LATE_2 = rawLateMins 31 - 45
LATE_3 = rawLateMins >= 46
```

Store both:

```text
rawLateMins = actualCheckin - scheduledStart
chargeableLateMins = max(0, rawLateMins - 15)
```

## Hard Guardrails

Do not implement anything in this phase.

Do not add:

```text
Prisma models
Migrations
API endpoints
NestJS services
Parser code
Calculation services
UI pages
Tests
Seed data
Package dependencies
```

Do not add or plan v1 behavior for:

```text
Payroll
Salary deductions
Annual leave balance mutation
GPS/live punching
Biometric integration
Order integration
Branch/Chain analytics as first scope
User creation from attendance file
Assignment changes from attendance file
```

Attendance files must not mutate SuperNova operational source-of-truth data.

SuperNova remains source of truth for:

```text
User role
Picker branch assignment
Champ branch assignment
Area Manager chain assignment
Employment/account status
```

## Required Repo Inspection Before Editing

Inspect these files before editing:

```text
AGENTS.md
README.md
docs/PLANNING_RESET.md
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
prisma/schema.prisma
```

Also inspect current API/web structure only enough to understand naming conventions and docs placement.

If the sample Excel file exists locally in the repo or project resources, inspect its headers. If it is not available in the repo, state that clearly in the spec assumptions and rely on the known headers below.

Known source file headers include:

```text
Name
Identifier
Designation
Department
Division
Sub Division
Location
Employee Current Status
Shift Name
Shift Date
Shift Scheduled Start Time
Shift Scheduled End Time
Shift Break Duration (mins)
Actual Checkin Time
Actual Checkout Time
Total Hours In Shift (hrs)
Actual Work Duration (hrs)
Status
Original Shift...
```

## Deliverable

Create this file only:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Do not modify any other file unless there is a strong docs-only reason, and explain it before editing.

## Required Contents Of The Spec

The spec must include these sections:

```text
1. Purpose
2. Scope v1
3. Out of Scope v1
4. Source File Contract
5. MTD Coverage Contract
6. Required Columns
7. Optional / Snapshot Columns
8. Upload and Monthly Replace Behavior
9. Month Locking Behavior
10. Matching Rules
11. Division Filtering Rules
12. Role Filtering Rules
13. Status Normalization
14. Late Calculation Rules
15. Leave / Off Day Rules
16. Work Duration Rules
17. Daily Result Headers
18. Monthly Picker Summary Headers
19. Import Batch Fields
20. Import Issue Fields
21. Validation Rules
22. Duplicate Handling
23. Calculated Status Priority
24. Access Control Rules
25. Audit Requirements
26. Report UX Requirements
27. Future Reuse Possibilities
28. Open Questions / Product Decisions Needed
29. Implementation Phase Breakdown
```

The MTD Coverage Contract must state clearly:

```text
MTD = first day of month through yesterday only.
Normal daily uploads must not include the upload day/today.
The engine should capture coverageStartDate, coverageEndDate, and expectedCoverageEndDate.
Coverage mismatch must appear in validation preview before confirm.
```

## Daily Result Headers Required

Document the final intended daily output headers and explain how each is sourced or calculated:

```text
periodMonth
shiftDate
shopperId
userId
pickerName
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
importBatchId
rawRowNumber
rowHash
issuesCount
```

## Monthly Picker Summary Headers Required

Document these and how each is calculated:

```text
periodMonth
shopperId
userId
pickerName
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
sourceBatchId
```

## Import Batch Fields Required

The spec must include coverage fields:

```text
coverageStartDate
coverageEndDate
expectedCoverageEndDate
```

## Import Issues Required

The spec must include coverage issue codes:

```text
MTD_COVERAGE_START_NOT_MONTH_START
MTD_COVERAGE_END_NOT_YESTERDAY
MTD_INCLUDES_UPLOAD_DAY
MTD_INCLUDES_FUTURE_DATE
```

## Report UX v1

The first report is an Admin/Super Admin daily Picker attendance table.

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

## Implementation Phase Breakdown Required

The spec must preserve this phased direction:

```text
Phase 0 — Specification Only
Phase 1 — Prisma Data Model
Phase 2 — Parser + Validator
Phase 3 — Calculation Engine
Phase 4 — Confirm Replace + Storage
Phase 5 — Admin Daily Report API
Phase 6 — Admin Attendance UI
Phase 7 — Picker Attendance Page
Phase 8 — Maintenance Controls
```

## Quality Bar

The spec must be practical, direct, and implementation-ready.

Avoid vague wording.

Do not invent product behavior beyond approved rules. Put unresolved items in Open Questions.

## Checks

Because this is docs-only, no build is required unless repo policy demands it.

At minimum, verify the new markdown file exists and is readable.

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
