# Codex Prompt — Phase 2 Attendance Parser + Validator

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

Phase 0 and Phase 1 are complete.

Approved spec:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Implementation plan:

```text
docs/attendance/ATTENDANCE_ENGINE_IMPLEMENTATION_PLAN.md
```

Phase 1 added only the Prisma data model and migration.

## Goal

Implement Phase 2 only: backend attendance Excel parser + validator preview.

This phase must read an uploaded MTD Excel file server-side, parse rows into normalized in-memory DTOs, validate file-level and row-level rules, and return a validation preview object.

This phase must not confirm, replace, or store final calculated attendance records.

## Important Sample File Note

There may be a temporary sample file in the repo:

```text
docs/attendance/daliy report example.xlsx
```

Use it only as a structure/header reference while developing Phase 2.

Rules:

```text
Do not hardcode this filename.
Do not depend on this file existing in production.
Do not depend on real values from this file.
Do not commit new sample data.
Do not add more Excel files.
If you touch this file, stop and explain why.
```

If the sample contains real data, do not copy names, IDs, or operational values into tests, docs, fixtures, or code.

## Product Rules To Preserve

```text
Identifier = User.shopperId
Division = Egypt / EGYPT only
Role comes from SuperNova, not Excel Designation
Only SuperNova role PICKER is eligible for calculated rows in v1
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

Do not implement Phase 3 calculation engine yet.

Do not implement:

```text
Confirm replace
Final storage of AttendanceDailyRecord
Final storage of AttendancePickerMonthlySummary
Admin UI
Frontend parser
Picker attendance page
Branch/Chain analytics
Payroll
Salary deductions
Leave balance mutation
GPS/live punching
Biometric integration
Order integration
User creation from attendance
Assignment changes from attendance
```

Attendance files must not mutate SuperNova operational source-of-truth data.

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
apps/api/src
apps/api/test
package.json
```

Inspect existing NestJS module/service/controller/test conventions before editing.

Before edits, provide a short plan.

## Scope Allowed

Allowed:

```text
Add backend attendance parser/validator module/service files
Add DTO/types needed for parser/validator preview
Add focused backend tests for parser/validator rules
Add a minimal internal method/API only if needed to test preview behavior, but prefer service-level tests in this phase
Use existing dependencies if available
Add one Excel parsing dependency only if there is no existing suitable dependency, and justify it
```

Prefer not adding an API route in this phase unless the existing project pattern makes it clearly better.

If adding an API endpoint, it must be preview-only and must not persist final attendance records.

Not allowed:

```text
No UI
No frontend code
No final confirm endpoint
No transaction replace logic
No calculation summaries
No report API
No seed data
No broad refactor
No unrelated cleanup
```

## Required Parser Behavior

The parser must accept an uploaded Excel buffer or file input from backend code and return normalized parsed rows.

Required source columns for Phase 2 validation:

```text
Identifier
Division
Shift Date
Shift Name
Shift Scheduled Start Time
Shift Scheduled End Time
Shift Break Duration (mins)
Total Hours In Shift (hrs)
Actual Checkin Time
Actual Checkout Time
Actual Work Duration (hrs)
Status
```

Known optional/snapshot columns:

```text
Name
Designation
Department
Sub Division
Location
Role
Job Type
Employee Current Status
Shift Location
Shift Notes
Break Duration (mins)
Checkin Location
Checkout Location
Latest Edited By
Latest Edited At
Attendance Edited Reason
Original Shift Name
Original Shift Location
Original Shift Scheduled Start Time
Original Shift Scheduled End Time
Original First Clock in time
Original Last Clock out time
```

Parser must handle:

```text
Trimmed strings
Blank cells
Excel date values
Excel time values
String dates/times where possible
Dash/null placeholders for missing check-in/check-out
Case-insensitive statuses where applicable
```

Do not silently coerce invalid dates/times into valid values.

## Required Validation Preview

The service must return a preview object shaped around these concepts:

```text
periodMonth
coverageStartDate
coverageEndDate
expectedCoverageEndDate
rowCount
egyptRows
nonEgyptRows
matchedPickerRows
unmatchedRows
excludedNonPickerRows
errorRows
warningRows
canConfirm
issues[]
rowsPreview[] optional, limited/safe
```

In Phase 2, matching against users may be implemented by querying the database or by injecting a lookup abstraction/mocked lookup for tests.

If implemented service-level only, make matching easy to test by dependency injection.

## Required Validation Rules

File-level validation:

```text
File must be readable Excel
Required columns must exist
File must contain one period month only
coverageStartDate must be first day of the period month
coverageEndDate must equal upload date minus one day for normal daily import
File must not include upload day/today
File must not include future dates
```

Row-level validation:

```text
Identifier required
Shift Date valid
Required time/duration fields parse where needed
Division classified as Egypt or non-Egypt
User matched by User.shopperId where lookup is available
Matched user must be role PICKER for v1 eligibility
Duplicate picker/date rows detected
Status recognized or safely handled by stronger shift-name rules
```

Blocking errors:

```text
Missing required columns
Multiple months in one file
Coverage start not month start
Coverage end not yesterday
Includes upload day/today
Includes future dates
Invalid shift dates
Duplicate Picker/date rows unless future multi-shift rule approved
```

Warnings/exclusions:

```text
Non-Egypt rows
Unmatched identifiers
Matched non-Picker users
Unknown source statuses where row is excluded or not safely calculated
```

## Required Issue Codes

Use existing Prisma enum values from Phase 1 where applicable:

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

## Matching Rules

Use only:

```text
Excel Identifier = User.shopperId
```

Do not match by:

```text
Name
Phone
Designation
Role source column
Branch/location
National ID
```

If matching is included in Phase 2:

```text
Trim Identifier
Preserve source Identifier for issue messages
Matched user must have role PICKER
Non-Picker matched users are excluded and counted
Unmatched identifiers create issues
```

## Duplicate Rule

For matched Pickers:

```text
periodMonth + shiftDate + userId
```

For unmatched rows:

```text
periodMonth + shiftDate + normalized Identifier
```

Do not silently merge duplicates.

Duplicates must appear in preview issues and block confirmation.

## MTD Cutoff Rule

Normal daily import:

```text
coverageStartDate = first day of month
coverageEndDate = uploadDate - 1 day
```

The upload date should be injectable in tests so tests are deterministic.

Do not use `new Date()` directly deep inside validation logic without a way to override it in tests.

Use Africa/Cairo timezone assumptions if the repo already has a timezone convention. If not, clearly isolate the decision and document the risk in Known Risks.

## Tests Required

Add focused backend tests for parser/validator.

Tests should cover at least:

```text
Missing required column
Valid Egypt MTD file covering month start through yesterday
Reject/warn when file includes upload day
Reject/warn when file includes future date
Reject multiple months in one file
Reject coverage start not month start
Non-Egypt row counted/excluded
Missing Identifier
Unmatched Identifier
Matched non-Picker user
Duplicate picker/date
Invalid Shift Date
Invalid time
Unknown Status
```

Do not use real personal data in tests.

Use generated in-memory rows or tiny generated workbook buffers in tests.

Do not rely on the temporary sample Excel file for automated tests.

## Expected Design

Prefer a small internal module structure, for example:

```text
apps/api/src/attendance/
  attendance.module.ts
  attendance-parser.service.ts
  attendance-validator.service.ts
  attendance-preview.types.ts
```

Or use a structure matching existing repo conventions.

Keep services small and testable.

Avoid a large god-file.

## Checks Required

Run:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
```

Also run the focused backend tests you add.

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
