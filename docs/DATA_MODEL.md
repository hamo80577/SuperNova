# Data Model — SuperNova

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

## User

Represents Pickers, Champs, Area Managers, Admins, and Super Admins.

Important fields:

```text
id
ibsId
shopperId
role
nameEn
nameAr
phoneNumber
nationalId
address
dateOfBirth
gender
joiningDate
employmentStatus
resignationDate
accountStatus
profileStatus
blockStatus
blockedUntil
blockReason
passwordHash
mustChangePassword
temporaryPasswordExpiresAt
lastLoginAt
createdAt
updatedAt
```

Rules:

- Do not store age. Calculate from `dateOfBirth`.
- Do not store `chainId`, `vendorId`, or `managerId`.
- Do not expose `passwordHash`.
- Do not expose temporary password values.
- Temporary password expiry metadata should not be included in broad safe-user responses.

## Chain

Represents a partner chain.

Important fields:

```text
id
chainName
chainCode
status
createdAt
updatedAt
```

## Vendor

Represents a Branch/Vendor under a Chain.

Important fields:

```text
id
vendorName
vendorCode
vendorExternalId
status
chainId
address
area
city
createdAt
updatedAt
```

## PickerBranchAssignment

Represents Picker assignment to Branch.

Important fields:

```text
id
pickerId
vendorId
status
startDate
endDate
createdByRequestId
createdAt
updatedAt
```

Rules:

- One active Branch assignment per Picker.
- Old assignments are closed, not deleted.
- New Hire creates the first active assignment.
- Transfer closes old assignment and creates new assignment.

## VendorChampAssignment

Represents Champ responsibility for a Branch.

Important fields:

```text
id
vendorId
champId
status
startDate
endDate
createdAt
updatedAt
```

Rules:

- One active Champ assignment per Vendor.
- A Champ may manage many Vendors.
- A Champ may manage Vendors across different Chains.

## ChainAreaManagerAssignment

Represents Area Manager responsibility for a Chain.

Important fields:

```text
id
chainId
areaManagerId
status
startDate
endDate
createdAt
updatedAt
```

Rules:

- One active Area Manager assignment per Chain.
- Area Manager scope is derived from active Chain assignments.

## Request

Represents workflow request.

Request types:

```text
NEW_HIRE
RESIGNATION
TERMINATION
TRANSFER
```

Statuses:

```text
DRAFT
PENDING_AREA_MANAGER
PENDING_DESTINATION_AREA_MANAGER
PENDING_ADMIN
APPROVED
REJECTED
CANCELLED
COMPLETED
```

Important fields:

```text
id
type
status
createdById
targetUserId
sourceChainId
sourceVendorId
destinationChainId
destinationVendorId
payload
currentStep
completedAt
createdAt
updatedAt
```

Rules:

- Payload must not store secrets.
- API responses redact sensitive payload keys.
- Workflow-specific requests must be created through workflow-specific endpoints.

## RequestApproval

Represents approval step ownership and decision.

Steps:

```text
AREA_MANAGER_APPROVAL
SOURCE_AREA_MANAGER_APPROVAL
DESTINATION_AREA_MANAGER_APPROVAL
ADMIN_FINAL_APPROVAL
```

Statuses:

```text
PENDING
APPROVED
REJECTED
SKIPPED
```

Rules:

- Approvers can act only on owned pending steps.
- Out-of-scope approvers must get 403.
- Rejection must not apply lifecycle change.
- Cancellation must not apply lifecycle change.

## Notification

Represents in-app notification.

Important use:

- New Hire credential handoff to Champ.
- Workflow state updates.
- Approval/finalization messages.

Temporary password may appear only in the Champ notification after successful New Hire finalization.

## AuditLog

Represents sensitive action history.

Important actions include:

```text
LOGIN_SUCCESS
LOGIN_FAILED
PASSWORD_CHANGED
FORCED_PASSWORD_CHANGED
PICKER_PROFILE_COMPLETED
REQUEST_CREATED
REQUEST_SUBMITTED
REQUEST_CANCELLED
APPROVAL_APPROVED
APPROVAL_REJECTED
ADMIN_FINALIZED_NEW_HIRE
ADMIN_FINALIZED_OFFBOARDING
TRANSFER_APPLIED
PICKER_BRANCH_ASSIGNMENT_CREATED
PICKER_BRANCH_ASSIGNMENT_CLOSED
REQUEST_COMPLETED
```

Rules:

- Do not log raw passwords.
- Do not log raw temporary passwords.
- Audit API responses must redact secret-like JSON keys.

## Indexing Direction

Indexes should support:

- auth lookup by phone
- user role/status summaries
- active assignments
- request queues
- approval queues
- audit filtering
- notification lookups
- scoped reporting

Partial unique active-assignment constraints are implemented through SQL migrations where Prisma schema cannot express them directly.
