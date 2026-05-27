# Attendance Engine Spec

## Repo Inspection Notes

This spec was prepared from the clean planning baseline on branch `feature/attendance-analytics-clean-v2`.

Current repo behavior:

- SuperNova already has authentication, role workspaces, Chains, Vendors/Branches, assignment tables, requests, approvals, notifications, audit logs, access control, and operational reports.
- There is no Attendance Engine implementation yet. No attendance Prisma models, migrations, NestJS modules, parser services, report APIs, UI pages, or tests exist in the current codebase.
- Existing reports are read-only operational overview endpoints under the NestJS `ReportsModule` and matching Next.js report pages.
- Operational hierarchy is already modeled through assignment tables, not source-of-truth fields on `User`.
- A local attendance Excel sample was found at `docs/attendance/daliy report example.xlsx` after initial inspection. Its first-row headers were inspected and are listed in the source file contract below.

## 1. Purpose

The Attendance Engine will let SuperNova import a daily MTD attendance Excel file, validate it, calculate Picker attendance results in the backend, store calculated PostgreSQL results, and expose auditable role-based reports.

The engine is part of SuperNova's workforce operations model:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a payroll engine, live punching system, biometric integration, generic HR ERP module, or source of operational hierarchy.

Attendance imports must never create users, transfer users, deactivate users, or mutate active assignment source-of-truth data.

## 2. Scope v1

Version 1 covers Picker-level attendance only.

Included:

- Daily MTD Excel upload.
- MTD coverage from the first day of the month through yesterday only.
- Backend-only parsing, validation, and calculation.
- Validation preview before confirmation.
- Confirmed monthly snapshot replacement.
- PostgreSQL storage of calculated daily rows, monthly Picker summaries, import batches, and import issues in later implementation phases.
- Admin/Super Admin daily Picker attendance report.
- Audit trail for upload, validation, confirmation, replacement, locking, and exceptional replacement actions.
- Future Picker self-service attendance view using the same stored calculated records.

Approved v1 product decisions:

- Identifier is `User.shopperId`.
- Division is `Egypt` / `EGYPT` only.
- Role comes from SuperNova, not Excel `Designation`.
- Only SuperNova role `PICKER` is calculated in v1.
- Excel `Designation` is stored only as a source/debug snapshot.
- MTD upload covers month start through yesterday only, not today/upload day.
- Grace period is 15 minutes.
- Late buckets use Option B.

## 3. Out of Scope v1

Do not include these behaviors in v1:

- Payroll.
- Salary deductions.
- Annual leave balance mutation.
- GPS or live punching.
- Biometric integration.
- Order integration.
- Inventory.
- Accounting.
- POS.
- Generic ERP modules.
- Branch/Chain analytics as first scope.
- User creation from attendance files.
- Assignment changes from attendance files.
- Picker transfer from attendance files.
- Picker archive/deactivation from attendance files.
- Frontend parsing of attendance files.
- Microservices.

## 4. Source File Contract

The source file is an Excel MTD attendance export uploaded by an Admin or Super Admin.

The file must represent one period month only. Each row is interpreted as one source attendance row for one employee on one shift date.

Inspected source file headers from `docs/attendance/daliy report example.xlsx`:

```text
Name
Identifier
Designation
Department
Division
Sub Division
Location
Role
Job Type
Employee Current Status
Shift Name
Shift Date
Shift Scheduled Start Time
Shift Scheduled End Time
Shift Location
Shift Break Duration (mins)
Shift Notes
Actual Checkin Time
Actual Checkout Time
Total Hours In Shift (hrs)
Actual Work Duration (hrs)
Break Duration (mins)
Checkin Location
Checkout Location
Status
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

Source file rules:

- `Identifier` is matched to `User.shopperId`.
- Names are never used for matching.
- `Designation` is not trusted for role decisions.
- `Division` controls eligibility for v1 calculation.
- Source rows are snapshots only; they must not mutate SuperNova users, assignments, employment status, account status, branches, chains, or role data.
- Reports must read stored calculated results, not the uploaded Excel file.

## 5. MTD Coverage Contract

MTD means the first day of the month through yesterday only.

Normal daily uploads must not include the upload day/today.

For normal daily imports:

```text
coverageStartDate = earliest Shift Date in the file
coverageEndDate = latest Shift Date in the file
expectedCoverageEndDate = upload date - 1 day
```

The engine must capture:

```text
coverageStartDate
coverageEndDate
expectedCoverageEndDate
```

Validation rules:

- `coverageStartDate` must be the first day of `periodMonth`.
- `coverageEndDate` must equal `expectedCoverageEndDate`.
- The file must not include upload day/today.
- The file must not include future dates.
- Coverage mismatch must appear in validation preview before confirm.
- For normal daily imports, coverage mismatch is a blocking validation error.

Examples:

```text
Uploaded on May 9  -> expected coverage is May 1 - May 8
Uploaded on May 10 -> expected coverage is May 1 - May 9
Uploaded on May 11 -> expected coverage is May 1 - May 10
```

Historical/manual imports are not part of normal v1 upload behavior unless explicitly approved later with stricter confirmation and audit rules.

## 6. Required Columns

These columns must exist in the source file for v1 validation:

| Column | Required because |
| --- | --- |
| `Identifier` | Matches source row to `User.shopperId`. |
| `Division` | Filters eligible rows to Egypt only. |
| `Shift Date` | Determines period month, coverage, daily row date, and monthly summary range. |
| `Shift Name` | Identifies off days and leave rows before regular attendance calculation. |
| `Shift Scheduled Start Time` | Builds scheduled start timestamp and late calculation. |
| `Shift Scheduled End Time` | Builds scheduled end timestamp and report output. |
| `Shift Break Duration (mins)` | Stores break duration snapshot. |
| `Total Hours In Shift (hrs)` | Stores scheduled shift hours snapshot. |
| `Actual Checkin Time` | Calculates late/on-time where applicable. Column must exist; row value may be blank for absence, leave, or off day. |
| `Actual Checkout Time` | Stores checkout snapshot and supports work-duration review. Column must exist; row value may be blank where operationally valid. |
| `Actual Work Duration (hrs)` | Supports under-8-hours and over-15-hours flags. Column must exist; row value may be blank where operationally valid. |
| `Status` | Provides source status for absent/on-leave interpretation and debug. |

Missing required columns produce `INVALID_REQUIRED_COLUMN` issues and block confirmation.

## 7. Optional / Snapshot Columns

These columns should be stored when present but must not control v1 source-of-truth decisions:

| Column | Stored as | Notes |
| --- | --- | --- |
| `Name` | `sourceName` | Debug/source display only. |
| `Designation` | `sourceDesignation` | Stored only; role comes from SuperNova. |
| `Department` | Source snapshot | Not used for v1 calculation. |
| `Sub Division` | `sourceSubDivision` | Source snapshot. |
| `Location` | `sourceLocation` | Source snapshot. |
| `Role` | Source snapshot | Stored only; role comes from SuperNova. |
| `Job Type` | Source snapshot | Not used for v1 calculation. |
| `Employee Current Status` | Source snapshot | Employment/account status comes from SuperNova. |
| `Shift Location` | Source snapshot | May support report detail but is not assignment source of truth. |
| `Shift Notes` | Source snapshot | Not used for v1 calculation. |
| `Break Duration (mins)` | Source snapshot | Distinct from scheduled `Shift Break Duration (mins)`; not used unless approved. |
| `Checkin Location` | Source snapshot | Not used for GPS/live tracking. |
| `Checkout Location` | Source snapshot | Not used for GPS/live tracking. |
| `Latest Edited By` | Source snapshot | Source-side edit metadata only. |
| `Latest Edited At` | Source snapshot | Source-side edit metadata only. |
| `Attendance Edited Reason` | Source snapshot | Source-side edit metadata only. |
| `Original Shift Name` | Source snapshot | Not used for v1 calculation unless separately approved. |
| `Original Shift Location` | Source snapshot | Not used for v1 calculation unless separately approved. |
| `Original Shift Scheduled Start Time` | Source snapshot | Not used for v1 calculation unless separately approved. |
| `Original Shift Scheduled End Time` | Source snapshot | Not used for v1 calculation unless separately approved. |
| `Original First Clock in time` | Source snapshot | Not used for v1 calculation unless separately approved. |
| `Original Last Clock out time` | Source snapshot | Not used for v1 calculation unless separately approved. |

`sourceLocationCode` must be stored only if a source column or approved parsing rule provides a reliable code. The inspected sample does not confirm a dedicated location-code column.

## 8. Upload and Monthly Replace Behavior

The upload is monthly snapshot replacement, not append-based storage.

Flow:

1. Admin/Super Admin uploads the MTD Excel file.
2. Backend parses the file.
3. Backend validates required columns, dates, coverage, matching, role eligibility, duplicates, and calculation prerequisites.
4. Backend returns a validation preview.
5. Admin/Super Admin confirms replacement only after preview.
6. Backend replaces the active monthly snapshot for the same `periodMonth`.
7. Previous active batch becomes `REPLACED`.
8. New confirmed batch becomes `ACTIVE`.
9. Daily records, monthly summaries, import issues, and audit logs are stored from the confirmed calculation.

Rules:

- Uploaded or validated batches must not affect reports until confirmed.
- Reports use only the active confirmed batch for a month.
- Replacement must be transactional.
- A failed confirmation must leave the previous active batch unchanged.
- Re-uploading the same month creates a new batch and replaces the active snapshot only after confirm.

## 9. Month Locking Behavior

Month locking protects closed attendance periods from accidental replacement.

Required behavior once implemented:

- A locked month cannot be replaced through normal daily import.
- Lock/unlock actions require Admin or Super Admin authorization.
- Lock/unlock actions must be audited.
- Replacing a locked month, if later approved, must require an explicit exceptional flow with reason capture and audit.
- Lock state must be visible in import history and validation preview.

Phase 8 owns maintenance controls. Until that phase exists, the spec must not assume that users can lock or unlock months in the UI.

## 10. Matching Rules

Matching uses only:

```text
Excel Identifier = SuperNova User.shopperId
```

Rules:

- Trim surrounding whitespace before matching.
- Preserve the original source `Identifier` value for audit/debug.
- Do not match by `Name`.
- Do not match by phone number, national ID, branch, location, or designation.
- If no user matches `shopperId`, mark the row `UNMATCHED_IDENTIFIER`.
- If the matched user is not role `PICKER`, mark the row `EXCLUDED_NOT_PICKER`.
- Store the matched `userId` only when there is exactly one matched SuperNova user.
- `User.shopperId` is unique in the current Prisma schema and remains the matching authority.

Open product question: whether matched users with inactive account or non-active employment status should be excluded, warned, or calculated. The current approved v1 rule only says role `PICKER` is calculated.

## 11. Division Filtering Rules

Only Egypt rows are eligible for v1 calculation.

Accepted values:

```text
Egypt
EGYPT
```

Normalization:

- Trim surrounding whitespace.
- Compare case-insensitively to `EGYPT`.
- Store the original source value as `division`.

Non-Egypt rows:

- Are excluded from calculated Picker attendance.
- Must appear in import preview counts.
- Must produce `NON_EGYPT_ROW` import issues.
- Must not create daily calculated attendance records for v1 reports unless a later implementation chooses to store excluded debug rows separately.

## 12. Role Filtering Rules

Role comes from SuperNova:

```text
User.role
```

Only users with:

```text
User.role = PICKER
```

are calculated in v1.

Excel `Designation`:

- Is stored as `sourceDesignation`.
- Is visible in row details for debug.
- Must not decide role, access, hierarchy, or assignment scope.

Rows matched to non-Picker users:

- Are excluded from v1 calculated attendance.
- Must appear in preview counts.
- Must produce `MATCHED_USER_NOT_PICKER` or equivalent issue code.

## 13. Status Normalization

The source `Status` value is stored as `sourceStatus`.

Normalization for calculation:

- Trim surrounding whitespace.
- Compare known statuses case-insensitively.
- Preserve the original source string for audit/debug.

Known v1 calculation inputs:

| Source signal | Calculation use |
| --- | --- |
| `Shift Name` contains `Off Day` | Calculates `OFF_DAY`. |
| `Shift Name` contains `Annual Leave` | Calculates `ANNUAL_LEAVE`. |
| `Shift Name` contains `Medical Leave` | Calculates `MEDICAL_LEAVE`. |
| `Status` equals `On Leave` | Calculates `OTHER_LEAVE` if annual/medical leave was not already identified. |
| `Status` equals `Absent` | Calculates `ABSENT` if higher-priority leave/off-day rules did not apply. |
| Actual check-in exists and scheduled start exists | Calculates `ON_TIME` or `LATE`. |

Unknown statuses:

- Store the original value.
- Produce `UNKNOWN_STATUS` when the row cannot be safely calculated from stronger signals.
- Do not invent leave types from unknown source text.

## 14. Late Calculation Rules

Approved grace period:

```text
graceMins = 15
```

Definitions:

```text
rawLateMins = actualCheckin - scheduledStart
chargeableLateMins = max(0, rawLateMins - 15)
```

Late bucket rule - Option B:

```text
NONE   = rawLateMins <= 15
LATE_1 = rawLateMins 16 - 30
LATE_2 = rawLateMins 31 - 45
LATE_3 = rawLateMins >= 46
```

Rules:

- Build `scheduledStartAt` from `Shift Date` + `Shift Scheduled Start Time`.
- Build `scheduledEndAt` from `Shift Date` + `Shift Scheduled End Time`.
- Build actual timestamps from `Shift Date` + actual check-in/check-out values.
- If `actualCheckin` is earlier than scheduled start, `rawLateMins` may be negative or zero.
- `isLate = true` only when `calculatedStatus = LATE`.
- `isOnTime = true` only when `calculatedStatus = ON_TIME`.
- `lateBucket = NONE` when `rawLateMins <= 15`.
- Do not calculate late minutes for off day, leave, absence, unmatched, non-Picker, or non-Egypt rows.

Open product question: handling overnight shifts where scheduled end or checkout occurs after midnight.

## 15. Leave / Off Day Rules

Leave and off-day interpretation happens before regular attendance late calculation.

Priority:

1. `Shift Name` contains `Off Day` -> `OFF_DAY`.
2. `Shift Name` contains `Annual Leave` -> `ANNUAL_LEAVE`.
3. `Shift Name` contains `Medical Leave` -> `MEDICAL_LEAVE`.
4. `Status` equals `On Leave` -> `OTHER_LEAVE`.

Derived flags:

| Calculated status | Flags |
| --- | --- |
| `OFF_DAY` | `isOffDay = true`, `isWorkingDay = false` |
| `ANNUAL_LEAVE` | `isOnLeave = true`, `isAnnualLeave = true`, `leaveType = ANNUAL_LEAVE`, `isWorkingDay = false` |
| `MEDICAL_LEAVE` | `isOnLeave = true`, `isMedicalLeave = true`, `leaveType = MEDICAL_LEAVE`, `isWorkingDay = false` |
| `OTHER_LEAVE` | `isOnLeave = true`, `leaveType = OTHER_LEAVE`, `isWorkingDay = false` |

Leave/off-day rows must not mutate annual leave balances or employment records.

## 16. Work Duration Rules

Work duration comes from:

```text
Actual Work Duration (hrs)
```

Scheduled shift duration comes from:

```text
Total Hours In Shift (hrs)
```

Break duration comes from:

```text
Shift Break Duration (mins)
```

Derived flags:

- `isWorkingDay = true` only when `calculatedStatus` is `ON_TIME` or `LATE`.
- `isWorkingDay = false` for `ABSENT`, leave, off-day, non-Egypt, unmatched, non-Picker, and invalid rows.
- `isUnder8Hours = true` only when `isWorkingDay = true` and `actualWorkDurationHours < 8`.
- `isOver15Hours = true` only when `isWorkingDay = true` and `actualWorkDurationHours > 15`.
- If an actual worked day has missing or invalid actual work duration, create an import issue and keep duration flags false unless a later approved rule says otherwise.
- `ABSENT` rows remain scheduled/source rows and are counted separately in `absentCount`; they must not count as working days.

## 17. Daily Result Headers

Final intended daily output headers:

| Header | Source or calculation |
| --- | --- |
| `periodMonth` | Month derived from `Shift Date`, stored as the attendance period month. |
| `shiftDate` | Source `Shift Date`. |
| `shopperId` | Matched `User.shopperId`; source `Identifier` when unmatched debug rows are stored. |
| `userId` | Matched SuperNova `User.id`; null for unmatched rows if excluded/debug rows are stored. |
| `pickerName` | SuperNova user display name snapshot, preferably `User.nameEn`. |
| `sourceName` | Source `Name` column when present. |
| `sourceDesignation` | Source `Designation` column when present. |
| `division` | Source `Division` value, preserved after trim. |
| `sourceSubDivision` | Source `Sub Division` column when present. |
| `sourceLocation` | Source `Location` column when present. |
| `sourceLocationCode` | Dedicated source location code if present, or approved parsed code. Otherwise null. |
| `shiftName` | Source `Shift Name`. |
| `scheduledStartTime` | Source `Shift Scheduled Start Time`. |
| `scheduledEndTime` | Source `Shift Scheduled End Time`. |
| `scheduledStartAt` | `shiftDate` + scheduled start time. |
| `scheduledEndAt` | `shiftDate` + scheduled end time, subject to future overnight-shift decision. |
| `scheduledShiftHours` | Source `Total Hours In Shift (hrs)`. |
| `breakDurationMins` | Source `Shift Break Duration (mins)`. |
| `actualCheckinTime` | Source `Actual Checkin Time`. |
| `actualCheckoutTime` | Source `Actual Checkout Time`. |
| `actualWorkDurationHours` | Source `Actual Work Duration (hrs)`. |
| `sourceStatus` | Source `Status`. |
| `calculatedStatus` | Result from calculated status priority. |
| `rawLateMins` | `actualCheckin - scheduledStart` in minutes when applicable. |
| `graceMins` | Constant `15` for v1 `ON_TIME` and `LATE` rows. |
| `chargeableLateMins` | `max(0, rawLateMins - 15)` when applicable. |
| `lateBucket` | `NONE`, `LATE_1`, `LATE_2`, or `LATE_3`. |
| `isLate` | True when `calculatedStatus = LATE`. |
| `isOnTime` | True when `calculatedStatus = ON_TIME`. |
| `isAbsent` | True when `calculatedStatus = ABSENT`. |
| `isOffDay` | True when `calculatedStatus = OFF_DAY`. |
| `isOnLeave` | True for annual, medical, or other leave statuses. |
| `leaveType` | `ANNUAL_LEAVE`, `MEDICAL_LEAVE`, `OTHER_LEAVE`, or null. |
| `isAnnualLeave` | True when `calculatedStatus = ANNUAL_LEAVE`. |
| `isMedicalLeave` | True when `calculatedStatus = MEDICAL_LEAVE`. |
| `isWorkingDay` | True only when `calculatedStatus` is `ON_TIME` or `LATE`; false for `ABSENT`. |
| `isUnder8Hours` | True for actual worked rows with actual duration below 8 hours. |
| `isOver15Hours` | True for actual worked rows with actual duration above 15 hours. |
| `matchStatus` | Match outcome such as `MATCHED_PICKER`, `UNMATCHED_IDENTIFIER`, `EXCLUDED_NOT_PICKER`, or `EXCLUDED_NON_EGYPT`. |
| `importBatchId` | Confirmed import batch that produced the row. |
| `rawRowNumber` | Original spreadsheet row number. |
| `rowHash` | Deterministic hash of normalized row content for duplicate/debug tracking. |
| `issuesCount` | Count of import issues attached to the row. |

## 18. Monthly Picker Summary Headers

Final intended monthly Picker summary headers:

| Header | Calculation |
| --- | --- |
| `periodMonth` | Attendance month for the active batch. |
| `shopperId` | Picker `User.shopperId`. |
| `userId` | Picker `User.id`. |
| `pickerName` | SuperNova Picker name snapshot. |
| `totalScheduledRows` | Count of scheduled/source rows for the Picker in the active batch. |
| `totalWorkingDays` | Count of actual worked days only: rows where `calculatedStatus` is `ON_TIME` or `LATE`. |
| `onTimeDays` | Count of rows where `calculatedStatus = ON_TIME`. |
| `lateDays` | Count of rows where `calculatedStatus = LATE`. |
| `totalRawLateMins` | Sum of `rawLateMins` for rows where late minutes are calculated. |
| `totalChargeableLateMins` | Sum of `chargeableLateMins` for rows where late minutes are calculated. |
| `late1Count` | Count of rows where `lateBucket = LATE_1`. |
| `late2Count` | Count of rows where `lateBucket = LATE_2`. |
| `late3Count` | Count of rows where `lateBucket = LATE_3`. |
| `absentCount` | Count of rows where `calculatedStatus = ABSENT`; absences stay separate from `totalWorkingDays`. |
| `leaveCount` | Count of annual, medical, and other leave rows. |
| `annualLeaveCount` | Count of rows where `calculatedStatus = ANNUAL_LEAVE`. |
| `medicalLeaveCount` | Count of rows where `calculatedStatus = MEDICAL_LEAVE`. |
| `otherLeaveCount` | Count of rows where `calculatedStatus = OTHER_LEAVE`. |
| `offDayCount` | Count of rows where `calculatedStatus = OFF_DAY`. |
| `under8HoursCount` | Count of actual worked rows where `isUnder8Hours = true`. |
| `over15HoursCount` | Count of actual worked rows where `isOver15Hours = true`. |
| `firstShiftDate` | Earliest `shiftDate` for this Picker in the active batch. |
| `lastShiftDate` | Latest `shiftDate` for this Picker in the active batch. |
| `lastCalculatedAt` | Timestamp when the summary was calculated. |
| `sourceBatchId` | Active import batch used to calculate the summary. |

## 19. Import Batch Fields

Intended import batch fields:

| Field | Purpose |
| --- | --- |
| `id` | Batch identifier. |
| `periodMonth` | Attendance month represented by the file. |
| `fileName` | Original uploaded file name. |
| `fileHash` | Hash of uploaded file content for duplicate tracking. |
| `uploadedByUserId` | Admin/Super Admin who uploaded the file. |
| `uploadedAt` | Upload timestamp. |
| `status` | Batch lifecycle status. |
| `rowCount` | Total source rows parsed. |
| `egyptRows` | Rows with accepted Egypt division. |
| `matchedPickerRows` | Rows matched to SuperNova Pickers. |
| `unmatchedRows` | Rows with no matching `User.shopperId`. |
| `excludedNonPickerRows` | Rows matched to non-Picker users. |
| `excludedNonEgyptRows` | Rows excluded because Division is not Egypt. |
| `errorRows` | Rows with blocking errors. |
| `warningRows` | Rows with non-blocking warnings. |
| `coverageStartDate` | Earliest source `Shift Date`. |
| `coverageEndDate` | Latest source `Shift Date`. |
| `expectedCoverageEndDate` | Upload date minus one day for normal daily import. |
| `replaceOfBatchId` | Previous active batch replaced by this batch, if any. |
| `confirmedByUserId` | User who confirmed replacement. |
| `confirmedAt` | Confirmation timestamp. |
| `notes` | Optional confirmation or admin notes. |
| `createdAt` | Record creation timestamp. |
| `updatedAt` | Record update timestamp. |

Candidate batch statuses:

```text
UPLOADED
VALIDATED
CONFIRMED
ACTIVE
REPLACED
FAILED
LOCKED
```

Implementation may split `CONFIRMED` and `ACTIVE` if the final model needs a separate confirmation event from active snapshot state.

## 20. Import Issue Fields

Intended import issue fields:

| Field | Purpose |
| --- | --- |
| `id` | Issue identifier. |
| `batchId` | Related import batch. |
| `rowNumber` | Source spreadsheet row number, null for file-level issues. |
| `shopperId` | Source identifier or matched shopper ID when available. |
| `severity` | `ERROR` or `WARNING`. |
| `issueCode` | Stable machine-readable issue code. |
| `fieldName` | Source column or calculated field related to the issue. |
| `message` | Human-readable operational message. |
| `resolutionStatus` | Review/resolution state for later issue workflows. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Update timestamp. |

Required coverage issue codes:

```text
MTD_COVERAGE_START_NOT_MONTH_START
MTD_COVERAGE_END_NOT_YESTERDAY
MTD_INCLUDES_UPLOAD_DAY
MTD_INCLUDES_FUTURE_DATE
```

Additional v1 issue codes:

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
INVALID_WORK_DURATION
INVALID_SHIFT_DURATION
INVALID_BREAK_DURATION
```

## 21. Validation Rules

File-level validation:

- File must be a supported Excel format.
- Required columns must exist.
- File must contain one period month only.
- `coverageStartDate` must equal the first day of the month.
- `coverageEndDate` must equal upload date minus one day for normal daily import.
- File must not include upload day/today.
- File must not include future dates.

Row-level validation:

- `Identifier` must be present.
- `Shift Date` must parse to a valid date.
- Time fields must parse where needed for calculation.
- Duration fields must parse as numbers where present.
- Division must be classified as Egypt or non-Egypt.
- Matched user must be found by `User.shopperId`.
- Matched user must be role `PICKER` for v1 calculation.
- Duplicate Picker/date rows must be detected.
- Source status must be known or safely overridden by stronger shift-name rules.

Blocking errors:

- Missing required columns.
- Multiple months in one file.
- Coverage start not month start.
- Coverage end not yesterday for normal daily import.
- File includes upload day/today.
- File includes future dates.
- Invalid shift dates.
- Duplicate Picker/date rows unless a later product rule approves multi-shift handling.

Warnings or excluded rows:

- Non-Egypt rows.
- Unmatched identifiers.
- Matched non-Picker users.
- Unknown source statuses when the row is excluded or otherwise not calculated.

The validation preview must show counts, coverage fields, coverage mismatches, replacement impact, and issue summaries before confirm.

## 22. Duplicate Handling

Duplicate detection key for v1:

```text
periodMonth + shiftDate + matched userId
```

Fallback key for unmatched rows:

```text
periodMonth + shiftDate + normalized Identifier
```

Rules:

- Duplicate Picker/date rows produce `DUPLICATE_PICKER_DATE`.
- v1 must not silently merge duplicate rows.
- v1 must not choose the first or last duplicate automatically.
- Duplicate Picker/date rows block confirmation unless an approved multi-shift rule is added later.
- `rowHash` should identify exact duplicate source rows for debugging but must not replace the Picker/date duplicate rule.

Open product question: whether multiple shifts for the same Picker on the same date are valid in source data.

## 23. Calculated Status Priority

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

Reports must use `calculatedStatus` for final attendance logic.

## 24. Access Control Rules

Backend access control is mandatory. Frontend hiding is not security.

Initial rules:

| Capability | Allowed roles |
| --- | --- |
| Upload attendance file | `ADMIN`, `SUPER_ADMIN` |
| Validate attendance file | `ADMIN`, `SUPER_ADMIN` |
| Confirm monthly replacement | `ADMIN`, `SUPER_ADMIN` |
| View Admin daily Picker attendance report | `ADMIN`, `SUPER_ADMIN` |
| Lock/unlock month | `ADMIN`, `SUPER_ADMIN` |
| Picker self-view | The authenticated Picker can read only their own records, in a later phase. |

Champ and Area Manager attendance views are future scoped reports and are not v1 behavior.

## 25. Audit Requirements

Audit these events:

```text
Attendance file uploaded
Attendance file validated
Attendance month replaced
Attendance month locked
Attendance month unlocked
Rejected/failed import
Dangerous historical replacement
MTD coverage mismatch accepted/rejected
```

Audit fields should include:

```text
Actor
Operation
Period month
Batch id
Coverage start date
Coverage end date
Expected coverage end date
Previous active batch id when replaced
Result
Timestamp
Reason if historical/locked data was changed
```

Attendance audit logs must not expose secrets, passwords, password hashes, JWT secrets, or raw private environment values.

## 26. Report UX Requirements

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

UX rules:

- Design mobile-first for 360px-430px.
- Use clean cards, tables, badges, filters, and operational copy.
- Avoid fake dashboards, toy analytics, random SaaS templates, and clutter.
- Avoid horizontal overflow on mobile.
- Make issue states clear before confirmation.
- Make replacement impact clear before confirmation.
- Show coverage start, coverage end, and expected coverage end in import preview.

## 27. Future Reuse Possibilities

Future phases may reuse the stored attendance model for:

- Picker self-service attendance page.
- Month lock and controlled historical replacement.
- Import issue review workflows.
- Attendance export.
- Branch/Chain scoped attendance reports after Picker v1 stabilizes.
- Area Manager and Champ scoped views using assignment tables for visibility.
- Trend reporting from stored monthly summaries.

These are future possibilities, not v1 commitments.

## 28. Open Questions / Product Decisions Needed

1. Confirm whether `sourceLocationCode` comes from a future dedicated source column or an approved parsing rule from `Location` / `Shift Location`. The inspected sample does not include a clear location-code column.
2. Confirm whether source columns `Role` and `Job Type` should be stored as debug snapshots in Phase 1, or intentionally ignored.
3. Confirm how to handle overnight shifts where checkout or scheduled end is after midnight.
4. Confirm whether matched inactive or non-active-employment Pickers should be calculated, warned, or excluded.
5. Confirm whether multiple shifts for the same Picker on the same date can be valid.
6. Confirm the complete accepted source `Status` vocabulary.
7. Confirm the timezone used for upload date and expected coverage end date. The project context uses Africa/Cairo.
8. Confirm default month lock timing and who can unlock historical months.
9. Confirm whether duplicate uploaded files should be blocked by `fileHash` or allowed as re-validation attempts.
10. Confirm whether historical/manual import is part of v1 or a later controlled maintenance flow.

## 29. Implementation Phase Breakdown

Preserved phased direction:

```text
Phase 0 - Specification Only
Phase 1 - Prisma Data Model
Phase 2 - Parser + Validator
Phase 3 - Calculation Engine
Phase 4 - Confirm Replace + Storage
Phase 5 - Admin Daily Report API
Phase 6 - Admin Attendance UI
Phase 7 - Picker Attendance Page
Phase 8 - Maintenance Controls
```

Phase 0 - Specification Only:

- Deliver this spec.
- Do not add Prisma models, migrations, API endpoints, services, parser code, UI pages, tests, seed data, or dependencies.

Phase 1 - Prisma Data Model:

- Add attendance models, enums, indexes, and migration only.
- No upload/API/UI.

Phase 2 - Parser + Validator:

- Add backend parsing and validation preview.
- Validate columns, row parsing, coverage, duplicates, matching, role filtering, and issue generation.

Phase 3 - Calculation Engine:

- Add daily calculation and monthly summary calculation.
- Cover late grace, late buckets, leave/off-day/absence priority, duration flags, non-Egypt, unmatched, non-Picker, duplicates, and MTD cutoff behavior.

Phase 4 - Confirm Replace + Storage:

- Add transactional confirm flow.
- Replace active monthly snapshot.
- Store calculated daily records, summaries, import issues, and audit event.

Phase 5 - Admin Daily Report API:

- Add read-only report API with filters and pagination.
- Enforce backend access control.

Phase 6 - Admin Attendance UI:

- Add import console and daily report UI.
- Keep mobile-first operational UX.

Phase 7 - Picker Attendance Page:

- Allow Picker to view only their own attendance records and monthly summary.

Phase 8 - Maintenance Controls:

- Add month lock, unlock, import history, issue review, and controlled historical replacement.
