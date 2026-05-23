# 02 — Workflow Rules

## Core Principle

Sensitive lifecycle changes must follow:

```text
Request -> Approval -> System applies change
```

## Forbidden Direct Changes

Do not directly perform:

```text
Picker creation
Picker branch transfer
Picker archive/deactivation
Active Picker assignment edit
```

unless the task explicitly defines an approved admin-only exception.

## Request Types

Current active request types:

```text
NEW_HIRE
RESIGNATION
TRANSFER
```

Resignation is the only active offboarding workflow.

Do not add another offboarding lifecycle unless explicitly requested.

## Approval Steps

Current workflow step types:

```text
AREA_MANAGER_APPROVAL
SOURCE_AREA_MANAGER_APPROVAL
DESTINATION_AREA_MANAGER_APPROVAL
ADMIN_FINAL_APPROVAL
```

Approval statuses:

```text
PENDING
APPROVED
REJECTED
SKIPPED
```

## New Hire Workflow

### Picker created by Champ

```text
Champ submits from Branch
-> Area Manager approval
-> Admin finalization with Shopper ID
-> Picker user created/rehired
-> PickerBranchAssignment created
-> Notification without password
-> Credential handoff from user profile
```

### Picker created by Area Manager

```text
Area Manager submits within Chain scope
-> Area Manager approval step is SKIPPED
-> Admin finalization with Shopper ID
-> Picker user created/rehired
-> PickerBranchAssignment created
```

### Picker created by Admin

```text
Admin submits for selected Branch
-> Area Manager approval
-> Admin finalization with Shopper ID
-> Picker user created/rehired
-> PickerBranchAssignment created
```

### Champ created by Area Manager

```text
Area Manager submits within Chain scope
-> Area Manager approval step is SKIPPED
-> Admin finalization
-> Champ user created
-> VendorChampAssignment created
```

### Champ created by Admin

```text
Admin submits for selected Branch
-> Area Manager approval
-> Admin finalization
-> Champ user created
-> VendorChampAssignment created
```

### Area Manager created by Admin

```text
Admin selects at least one Chain
-> System creates completed NEW_HIRE request/audit record
-> Area Manager user created
-> ChainAreaManagerAssignment created
-> Temporary password generated
-> Credential handoff from user profile
```

## Resignation Workflow

```text
Champ/Admin submits for a scoped active Picker
-> Area Manager block decision approval
-> Admin finalization with fixed block decision
-> Picker account archived/deactivated
-> Active PickerBranchAssignment closed
-> Login disabled
-> Audit logs created
```

Rules:

```text
No deletion
Assignment history preserved
Pending resignation blocks Transfer
Rejection/cancellation does not deactivate Picker
Area Manager submits within assigned Chain scope and skips own Area Manager approval
Branch/Chain context is resolved from the Picker active assignment
Block decisions are NO_BLOCK, THREE_MONTHS, SIX_MONTHS, ONE_YEAR, or PERMANENT
Temporary blockedUntil is calculated during Admin finalization
```

## Transfer Workflow

Same Chain:

```text
Submit Transfer
-> Source Chain Area Manager approval
-> Close old active PickerBranchAssignment
-> Create new active PickerBranchAssignment
```

Cross Chain:

```text
Submit Transfer
-> Source Chain Area Manager approval
-> Destination Chain Area Manager approval
-> Close old active PickerBranchAssignment
-> Create new active PickerBranchAssignment
```

Rules:

```text
Transfer to same Branch is blocked
Archived/deactivated Picker transfer is blocked
Pending resignation blocks Transfer
Duplicate pending Transfer is blocked
```

## Generic Request Protection

Generic request creation must not create workflow-specific lifecycle requests.

Workflow-specific creation must use:

```text
POST /api/requests/new-hire
POST /api/requests/offboarding
POST /api/requests/transfer
```

## Planned HR Sync Integration

HR Sync to Google Sheets is post-finalization only.

Supported planned events:

```text
Picker New Hire
Picker Rehire
Picker Resignation
```

Rules:

```text
Workflow finalization applies the lifecycle change first.
HR Sync runs only after the system change is complete.
Google Sheets does not drive request state.
Google Sheets does not drive user or assignment state.
HR Sync failure must not roll back user creation, reactivation, assignment creation, assignment closure, or resignation finalization.
Failed sync should be logged and treated as retryable later.
```

Planned request payload changes:

```text
Picker New Hire/Rehire requires actualJoiningDate.
Picker Resignation should carry lastWorkingDate.
```
