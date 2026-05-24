# Attendance Operations UI

## Route

Recommended route:

```text
/super-admin/attendance-operations
```

Access:

```text
SUPER_ADMIN only
```

Page name:

```text
Attendance Data Operations
```

## Tabs

```text
Upload Attendance
Import History
Data Maintenance
Calculation Rules
```

## Upload Modes

```text
Daily MTD Override
Historical Backfill
Recalculate Only
```

## Upload UX

Upload Attendance must include:

```text
file selector
period from
period to
upload mode
preflight summary
processing state
progress/stepper
polling backend import status
professional final summary
warnings/issues display
```

## Processing Steps

```text
Uploading file
Reading rows
Filtering Egypt rows
Matching users
Calculating metrics
Rebuilding summaries
Saving import issues
Finalizing
```

## Import History

Import History should show:

```text
batch status
upload mode
period
fileName
fileHash
createdBy
startedAt
finishedAt
row counts
matched counts
ignored non-Egypt counts
issue counts
final summary
```

## Data Maintenance

Data Maintenance must support later:

```text
delete by date range
delete month
delete all attendance data
recalculate summaries
compress old months
```

Dangerous operations must require:

```text
impact preview
typed confirmation
audit log
final summary
```

Delete must never affect:

```text
Users
Assignments
Requests
Approvals
Notifications
Audit logs
Access-control data
```

## Calculation Rules Tab

The Calculation Rules tab should present current calculation definitions in operational language.

It should not be editable unless a later product decision approves configurable rules.
