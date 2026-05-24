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

Phase 3 exposes:

```text
Upload Attendance
Import History
Calculation Rules
```

Phase 4 may add:

```text
Data Maintenance
```

## Upload Modes

Phase 3 exposes:

```text
Daily MTD Override
Historical Backfill
```

Phase 4 may add:

```text
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
polling backend import status if imports become asynchronous
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
Rebuilding user summaries
Rebuilding branch summaries
Rebuilding chain summaries
Saving import issues
Finalizing
```

If Phase 3 import processing remains synchronous, the UI should show the
processing state during the request and render the result after completion. It
must not fake polling.

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

Do not expose Data Maintenance in Phase 3.

## Historical Assignment Backfill

Historical Assignment Backfill is available only as an explicit Super Admin
preview and typed confirmation flow.

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

## Calculation Rules Tab

The Calculation Rules tab should present current calculation definitions in operational language.

It should not be editable unless a later product decision approves configurable rules.
