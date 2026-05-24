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
change assignments
change User.role
change User.shopperId
change User.ibsId
change employmentStatus
change accountStatus
```

## Duplicate Rows

If duplicate `Identifier + Shift Date` exists, create an import warning.

Do not silently hide duplicates.
