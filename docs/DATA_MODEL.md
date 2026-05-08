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

## Phase 2 Organization Rules

Phase 2 makes `Chain` and `Vendor` operational for Admin/Super Admin management.

- `Vendor.chainId` is required and must reference an existing `Chain`.
- `Chain.chainCode` stays unique.
- `Vendor.vendorCode` stays unique.
- `Vendor.vendorExternalId` stays unique when provided.
- Chain and Vendor deletion is out of scope for Phase 2.

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

## Phase 3 Assignment Enforcement

Phase 3 enforces active assignment rules with PostgreSQL partial unique indexes in a raw SQL Prisma migration.

Prisma schema syntax cannot express these partial unique indexes directly, so they live in `prisma/migrations/20260507200500_active_assignment_partial_indexes/migration.sql`.

Required database constraints:

- one `ACTIVE` `PickerBranchAssignment` per `pickerId`
- one `ACTIVE` `VendorChampAssignment` per `vendorId`
- one `ACTIVE` `ChainAreaManagerAssignment` per `chainId`

Closed assignment rows remain in place as history. The system must not delete assignment history or overwrite old assignment rows.

## Phase 4 Workspace Reads

Role workspaces do not add new source-of-truth fields. They read the existing data model through assignment-derived scope:

- Picker context comes from the active `PickerBranchAssignment`.
- Champ branch ownership comes from active `VendorChampAssignment` rows.
- Area Manager chain ownership comes from active `ChainAreaManagerAssignment` rows.
- Admin workspace counts read all Chains, Vendors, Users, and active assignment rows.

No `User.managerId`, `User.chainId`, or `User.vendorId` fields are introduced for workspace visibility.

## Phase 5 Request Engine Usage

Phase 5 starts using the existing `Request`, `RequestApproval`, `Notification`, and `AuditLog` models.

- `Request` stores generic lifecycle metadata and remains the parent record for approval state.
- `RequestApproval` stores generated approval steps, approver role, optional specific approver, decision status, decision time, and notes.
- `Notification` stores in-app notification records for submitted requests, pending approvals, decisions, and cancellations.
- `AuditLog` records request and approval actions.

`APPROVED` means all generic approval steps are complete. It does not mean the lifecycle change has been applied. `COMPLETED` is reserved for later workflow finalization phases.
