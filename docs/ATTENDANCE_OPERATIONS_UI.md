# Attendance Operations UI

## Route

Super Admin operations live under:

```text
/super-admin/attendance-operations
```

The base route redirects to:

```text
/super-admin/attendance-operations/upload
```

Access:

```text
SUPER_ADMIN only
```

Backend protection is required for every `/api/attendance-operations/*` route. Frontend hiding is not security.

## Child Views

```text
Upload Attendance
Import History
Data Maintenance
Calculation Rules
```

## Upload Attendance

Supported upload modes:

```text
Daily MTD Override
Historical Backfill
```

Daily MTD Override derives the period automatically:

```text
first day of current month -> yesterday
```

Historical Backfill uses a month picker and derives:

```text
first day of selected month -> last day of selected month
```

The upload view includes:

```text
reusable file selector
compact preflight checklist
processing state
final summary
sample calculated users
historical assignment backfill preview and confirmation for Historical Backfill only
```

Normal attendance import must not create historical assignments automatically.

## Import History

Import History lists recent batches and opens a read-only detail modal on row click.

Detail modal shows:

```text
batch status
file and period
created by
counts
retention result
warning/error counts
issue list
```

The history view does not expose delete, recalculate, or compression actions.

## Data Maintenance

Data Maintenance supports attendance-only maintenance operations:

```text
delete by date range
delete month
delete all attendance data
recalculate summaries
compress old months
```

Every operation requires:

```text
impact preview
typed confirmation
audit log
final result summary
```

Typed confirmations:

```text
DELETE ATTENDANCE DATA
RECALCULATE ATTENDANCE SUMMARIES
COMPRESS ATTENDANCE MONTHS
```

Delete and compression operations must affect attendance tables only and must never delete users, assignments, requests, approvals, notifications, audit logs, access-control data, vendors, or chains.

## Historical Assignment Backfill

Historical Assignment Backfill is available only as an explicit Super Admin preview and typed confirmation flow.

Rules:

```text
Use Location column only.
Extract the branch code before the first " - ".
Match Location code to Vendor.vendorExternalId.
Do not use Shift Location as assignment source.
Preview must not create assignments.
Confirmation must revalidate server-side.
Create CLOSED historical PickerBranchAssignment records only.
Do not change current active assignments.
Do not create Champ assignments.
Do not accept raw frontend proposal objects as trusted confirmation input.
```

## Calculation Rules

The Calculation Rules view is read-only.

It documents:

```text
Division = Egypt
Picker match: Identifier = shopperId
Champ match: Identifier = ibsId
SuperNova User.role is the role source
Branch and Chain totals are Picker-only
Champ attendance is user-level only
late, absence, leave, duration, needed shift, and retention rules
historical assignment backfill exception
```

## Mobile UI Requirements

The operations UI must remain usable at:

```text
360px
390px
430px
```

Requirements:

```text
no horizontal page overflow
touch-friendly buttons
clear loading, empty, and error states
dangerous operations visually isolated
typed confirmations readable on mobile
tables converted to cards or controlled horizontal scroll
```
