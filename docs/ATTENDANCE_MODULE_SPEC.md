# Attendance Module Spec

## Scope

Attendance Analytics is approved only for:

```text
data import
metric calculation
compressed historical summaries
role-scoped reporting
Super Admin data operations
```

Implemented product surfaces:

```text
Super Admin Attendance Data Operations
Admin / Super Admin attendance reports
Area Manager scoped attendance reports
Champ scoped attendance reports
attendance-only maintenance and retention controls
```

It is not:

```text
payroll
payroll deduction system
GPS
live tracking
biometric integration
live punch-in/out
order integration
inventory
accounting
generic ERP
```

## Source File

Expected source file columns include:

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
Actual Checkin Time
Actual Checkout Time
Total Hours In Shift (hrs)
Actual Work Duration (hrs)
Status
```

Only rows where `Division = Egypt` are calculated.

Rows outside Egypt are ignored and counted in the import summary.

## User Matching

Only these SuperNova roles receive attendance calculations:

```text
PICKER
CHAMP
```

Role source:

```text
SuperNova User.role
```

Do not trust the attendance file `Role` or `Designation` as source of truth.

Picker matching:

```text
Attendance.Identifier = User.shopperId
```

Champ matching:

```text
Attendance.Identifier = User.ibsId
```

Matching outcomes:

```text
MATCHED_PICKER
MATCHED_CHAMP
UNMATCHED_IDENTIFIER
AMBIGUOUS_IDENTIFIER_MATCH
UNSUPPORTED_ROLE
```

## Aggregation

Picker attendance:

```text
calculated at user level
included in Branch totals
included in Chain totals
```

Champ attendance:

```text
calculated at user level only
shown separately
never included in Branch totals
never included in Chain totals
never mixed with Picker rows in Area Manager UI
```

## Import Safety

Attendance imports must never:

```text
create users
transfer users
archive/deactivate users
change active/current assignments
change User.role
change User.shopperId
change User.ibsId
change employmentStatus
change accountStatus
```

Normal imports also must never create historical assignments automatically.

## Historical Assignment Backfill

Historical Assignment Backfill is approved only as a controlled, explicit support flow for reconstructing past Picker branch assignment history from attendance files.

It must not run automatically as part of normal attendance import.

Rules:

```text
Allowed modes: Historical Backfill or explicit historical assignment backfill flow
Required actor: Super Admin
Required control: preview before confirmation
Created records: closed past PickerBranchAssignment records only
Forbidden records: open-ended assignments, current active assignment changes, CHAMP assignments
Source column: Location
Forbidden source column: Shift Location
Mapping: numeric code before first " - " maps to Vendor.vendorExternalId
Unmapped code: warning, no assignment
Conflicting Location evidence: conflict, no assignment
```

Example:

```text
Location = "740921 - Carrefour, Zahraa El Maadi - El Me'arag El Ouloy"
vendorExternalId = "740921"
```

Confirmation creates only closed past `PickerBranchAssignment` rows after server-side revalidation. It must not close, delete, replace, or alter any current active assignment.

## Duplicate Rows

If duplicate `Identifier + Shift Date` exists, create an import warning.

Do not silently hide duplicates.

## Reports

Reports are read-only.

Access:

```text
Admin / Super Admin: system attendance reports
Area Manager: assigned Chain scope only
Champ: assigned Branch scope only
Picker: no attendance report surface yet
```

Rules:

```text
Branch and Chain totals are Picker-only.
Champ attendance is user-level only.
Champ rows are never included in Branch or Chain totals.
Compressed months show monthly summaries only.
If daily detail is unavailable, the UI/API must say:
Daily detail is no longer stored for this month. Monthly summary is available.
```

## Maintenance

Maintenance operations are Super Admin only and affect attendance tables only.

Allowed targets:

```text
AttendanceDailyRecord
AttendanceMonthlyUserSummary
AttendanceMonthlyBranchSummary
AttendanceMonthlyChainSummary
AttendanceImportBatch
AttendanceImportIssue
```

Forbidden targets:

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

Dangerous operations require impact preview, typed confirmation, audit logging, and a final summary.

## Production Runbook

### Import MTD Attendance

```text
1. Sign in as Super Admin.
2. Open /super-admin/attendance-operations/upload.
3. Choose Daily MTD Override.
4. Select the XLSX file.
5. Confirm the derived current-month-to-yesterday period.
6. Start import and review final counts, warnings, errors, and sample calculated users.
```

### Historical Backfill and Assignment Backfill

```text
1. Choose Historical Backfill.
2. Select the target month and XLSX file.
3. Start attendance import to build summaries.
4. Separately run Historical Assignment Backfill Preview.
5. Review unmapped locations, conflicts, and proposals.
6. Confirm only when the typed confirmation is accepted and conflicts are resolved.
```

Historical assignment backfill is not part of normal import. It creates closed historical Picker assignments only.

### Read Reports by Role

```text
Admin / Super Admin: /admin/reports/attendance
Area Manager: /area-manager/reports/attendance
Champ: /champ/reports/attendance
```

Branch and Chain totals are Picker-only. Champ attendance is user-level only.

### Maintenance Preview and Confirm

```text
1. Open /super-admin/attendance-operations/maintenance.
2. Select the operation and inputs.
3. Run impact preview.
4. Confirm only if canProceed is true.
5. Type the required confirmation text exactly.
6. Review the final result and refreshed month retention status.
```

### Retention and Compression

```text
Current month: keep daily detail and monthly summaries.
Previous month: keep daily detail and monthly summaries.
Older months: keep monthly summaries only after compression.
```

Compression must verify monthly summaries before deleting old daily records.

### Emergency Attendance-Only Reset

Safe attendance reset tables:

```text
AttendanceDailyRecord
AttendanceMonthlyUserSummary
AttendanceMonthlyBranchSummary
AttendanceMonthlyChainSummary
AttendanceImportIssue
AttendanceImportBatch
```

Never delete or truncate:

```text
User
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
Request
RequestApproval
Notification
AuditLog
Access-control tables
Vendor
Chain
```

If production rollback is needed, restore from database backup or use Super Admin maintenance delete operations. Do not manually alter lifecycle, assignment, or user tables to repair attendance data.
