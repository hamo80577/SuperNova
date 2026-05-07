# SuperNova Data Model Foundation

## Core Rule

The database foundation exists to support assignment-derived hierarchy and request-based lifecycle operations. SuperNova should not model manager ownership directly on `User`.

## Core Models

- `User`
- `Chain`
- `Vendor`
- `PickerBranchAssignment`
- `VendorChampAssignment`
- `ChainAreaManagerAssignment`
- `Request`
- `RequestApproval`
- `Notification`
- `AuditLog`

## User Rules

The `User` model includes identity, lifecycle, and access posture fields such as:

- `ibsId`
- `shopperId`
- `role`
- `phoneNumber`
- `dateOfBirth`
- `employmentStatus`
- `accountStatus`
- `profileStatus`
- `blockStatus`
- `passwordHash`
- `mustChangePassword`

Forbidden user fields as source of truth:

- `age`
- `chainId`
- `vendorId`
- `managerId`

## Assignment-Derived Ownership

Operational ownership is derived through these paths:

```text
Picker -> active PickerBranchAssignment -> Vendor
Vendor -> active VendorChampAssignment -> Champ
Vendor -> Chain -> active ChainAreaManagerAssignment -> Area Manager
```

## Request and Approval Foundation

`Request` stores lifecycle metadata for:

- `NEW_HIRE`
- `RESIGNATION`
- `TERMINATION`
- `TRANSFER`

`RequestApproval` stores step-level approvals, including:

- `AREA_MANAGER_APPROVAL`
- `SOURCE_AREA_MANAGER_APPROVAL`
- `DESTINATION_AREA_MANAGER_APPROVAL`
- `ADMIN_FINAL_APPROVAL`

Phase 0 defines these structures only. It does not implement request orchestration yet.

## Indexing

The Prisma schema adds baseline indexes for lookup and future scoping:

- `User.phoneNumber` via unique constraint
- `User.role`
- `User.accountStatus`
- `User.employmentStatus`
- `Vendor.chainId`
- `PickerBranchAssignment(pickerId, status)`
- `VendorChampAssignment(vendorId, status)`
- `ChainAreaManagerAssignment(chainId, status)`
- `Request.status`
- `Request.type`
- `Request.createdById`
- `Request.targetUserId`
- `Request.sourceVendorId`
- `Request.destinationVendorId`
- `RequestApproval(approverId, status)`

## Partial Unique Index Note

Phase 0 does not fake partial uniqueness with incorrect global unique constraints.

PostgreSQL partial unique indexes will be needed later for:

- one active picker assignment per picker
- one active champ assignment per vendor
- one active area manager assignment per chain

These should be added in a future SQL migration once Phase 3 implements the assignment engine.
