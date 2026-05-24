# 04 — Data Model Rules

## Core Entities

```text
User
Chain
Vendor
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
Request
RequestApproval
Notification
AuditLog
```

## User Rules

`User` represents all system users.

Roles:

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

Do not store source-of-truth operational context on User.

Forbidden source-of-truth fields:

```text
managerId
vendorId
chainId
```

## Assignment Rules

Use assignment tables:

```text
PickerBranchAssignment -> Picker to Branch
VendorChampAssignment -> Champ to Branch
ChainAreaManagerAssignment -> Area Manager to Chain
```

History must be preserved:

```text
Close old assignments
Do not delete old assignments
Create new assignments for new operational context
```

## Request Payload Rules

Request payloads may store workflow context, but must not store secrets.

Never store:

```text
raw password
raw temporary password
tokens
cookies
credentials
JWT secrets
```

Temporary password must stay in encrypted user credential fields and be revealed only through authorized profile controls.

## National ID and Phone Rules

For Egypt MVP:

```text
phoneNumber:
- required for New Hire
- numeric only
- exactly 11 digits
- starts with 010, 011, 012, or 015

nationalId:
- required for New Hire
- numeric only
- exactly 14 digits
```

## Rehire Rules

Rehire applies to Picker only for now.

A previous Picker can be rehired only if:

```text
account is not ACTIVE with ACTIVE employment
blockStatus is NO_BLOCK
or TEMPORARY_BLOCK has expired
no ACTIVE PickerBranchAssignment exists
no duplicate pending New Hire/Rehire exists
```

Permanent block must be removed by Admin from user profile before rehire.

## Notification Data Rules

Notifications must not contain temporary passwords.

Notification payloads must not contain secrets.

Use profile links, request IDs, and user IDs only.

## Audit Rules

Sensitive actions must create audit logs.

Important actions include:

```text
REQUEST_CREATED
REQUEST_SUBMITTED
APPROVAL_GENERATED
APPROVAL_APPROVED
APPROVAL_REJECTED
ADMIN_FINALIZED_NEW_HIRE
ADMIN_FINALIZED_OFFBOARDING
USER_CREATED
USER_REACTIVATED
PICKER_BRANCH_ASSIGNMENT_CREATED
PICKER_BRANCH_ASSIGNMENT_CLOSED
VENDOR_CHAMP_ASSIGNMENT_CREATED
CHAIN_AREA_MANAGER_ASSIGNMENT_CREATED
TEMPORARY_PASSWORD_GENERATED
TEMPORARY_PASSWORD_REVEALED
TEMPORARY_PASSWORD_RESET
REQUEST_COMPLETED
```

Audit logs must not contain raw passwords.

## Planned HR Sync Data Rules

Prefer a dedicated `HrSyncLog` model/table for HR Google Sheets Sync tracking.

Do not add many HR Sync status columns directly to `Request` unless a later schema design proves that simpler and safer.

Planned `HrSyncLog` fields:

```text
id
requestId
workflowType
targetSheet
status: NOT_SENT | SENT | FAILED | SKIPPED
payloadSnapshot
responseSnapshot
errorMessage
sentAt
createdAt
updatedAt
```

Rules:

```text
Google Sheets is not source of truth.
Payload snapshots must not contain secrets.
HR Sync status must not control workflow state.
Picker New Hire/Rehire should store actualJoiningDate in request payload.
Picker Resignation should store or verify lastWorkingDate in request payload.
```
