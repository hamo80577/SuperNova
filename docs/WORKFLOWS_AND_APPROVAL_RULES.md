# Workflows and Approval Rules

## Core Lifecycle Rule

Sensitive lifecycle changes must follow:

```text
Request -> Approval -> System applies change
```

The system applies changes only after the required workflow step succeeds.

## Active Workflow Families

```text
New Hire / User Onboarding
Resignation
Transfer
Profile Completion
Admin Controls
Reports
Notifications
Audit Logs
```

Resignation is the only active offboarding lifecycle.

## New Hire Direction

Supported target roles:

```text
PICKER
CHAMP
AREA_MANAGER
```

Rules:

```text
Champ can create New Hire for PICKER only.
Area Manager can create New Hire for PICKER or CHAMP within assigned Chain scope.
Admin can create New Hire for PICKER, CHAMP, or AREA_MANAGER.
PICKER requires Branch context and Admin finalization with Shopper ID.
CHAMP requires Branch context and Admin finalization without Shopper ID.
AREA_MANAGER requires at least one Chain and can be created by Admin only.
Rehire applies to PICKER only for now.
Egypt phone and national ID validation are required.
Temporary password must not be sent in notifications.
Temporary password is revealed/reset only through authorized user profile credential controls.
```

## Attendance Is Not a Lifecycle Workflow

Attendance imports do not create lifecycle requests.

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

Attendance is read, match, calculate, summarize, and report.

## Historical Assignment Backfill Exception

Historical Assignment Backfill is not a normal lifecycle workflow and must not alter active operations.

Allowed behavior:

```text
Super Admin previews proposed closed past PickerBranchAssignment records
Super Admin explicitly confirms before records are created
records are PICKER-only
records are closed historical ranges with startDate and endDate
records are derived from Attendance Location code mapped to Vendor.vendorExternalId
```

Forbidden behavior:

```text
automatic assignment creation during normal attendance import
current active assignment mutation
closing, deleting, or replacing current assignments
CHAMP branch assignment creation
guessing from unmapped or conflicting Locations
using Shift Location as assignment source
```

## Dangerous Attendance Data Operations

Future Super Admin attendance maintenance operations may delete attendance records, recalculate summaries, or compress old months.

They must require:

```text
impact preview
typed confirmation
audit log
final summary
```

Delete operations must never affect:

```text
Users
Assignments
Requests
Approvals
Notifications
Audit logs
Access-control data
```
