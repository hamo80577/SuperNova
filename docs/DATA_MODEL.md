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

`APPROVED` means all generic approval steps are complete. It does not mean the lifecycle change has been applied. `COMPLETED` is used only by workflow-specific finalization paths such as New Hire, Offboarding, and Transfer.

## Phase 7 Profile Completion Usage

Phase 7 uses existing `User` fields only. It does not add new profile tables or
document storage.

Profile completion updates safe Picker-owned profile fields:

- `nameEn`
- `nameAr`
- `nationalId`
- `address`
- `dateOfBirth`
- `gender`
- `joiningDate`

Required completion fields are `nationalId`, `address`, `dateOfBirth`, and
`joiningDate`. `profileStatus` moves to `COMPLETE` after validation succeeds.

Forbidden profile completion updates include `role`, `accountStatus`,
`employmentStatus`, `blockStatus`, `shopperId`, `ibsId`, password fields, and
assignment relationships. Age is never stored; it must be derived from
`dateOfBirth` when needed.

## Phase 8 Offboarding Usage

Phase 8 uses the existing `Request`, `RequestApproval`, `Notification`,
`AuditLog`, `User`, and `PickerBranchAssignment` models. No new direct manager,
Chain, or Vendor shortcut fields are added to `User`.

- Resignation and Termination requests store Branch-first context in `Request.sourceVendorId`, `Request.sourceChainId`, `Request.targetUserId`, and structured `payload`.
- Admin finalization updates the target `User.accountStatus` to `ARCHIVED`, sets `employmentStatus` to `RESIGNED` or `TERMINATED`, saves `blockStatus`, `blockedUntil`, and `blockReason`, and clears temporary password state.
- Admin finalization closes the active `PickerBranchAssignment` by setting `status=CLOSED` and `endDate`; it does not delete assignment history.
- The request is marked `COMPLETED` only after the user update, assignment closure, Admin approval update, notifications, and audit logs complete in one transaction.
- Offboarding does not add `User.managerId`, `User.chainId`, or `User.vendorId`.

## Phase 9 Transfer Usage

Phase 9 uses the existing `Request`, `RequestApproval`, `Notification`,
`AuditLog`, `User`, `Vendor`, `Chain`, and `PickerBranchAssignment` models. No
new shortcut fields are added to `User`.

- Transfer requests store Branch-first context in `Request.sourceVendorId`, `Request.sourceChainId`, `Request.destinationVendorId`, `Request.destinationChainId`, `Request.targetUserId`, and structured `payload`.
- Same-chain Transfer creates one `SOURCE_AREA_MANAGER_APPROVAL` step.
- Cross-chain Transfer creates `SOURCE_AREA_MANAGER_APPROVAL` and `DESTINATION_AREA_MANAGER_APPROVAL` steps.
- Applying Transfer closes the old active `PickerBranchAssignment` by setting `status=CLOSED` and `endDate`; it does not delete assignment history.
- Applying Transfer creates a new active `PickerBranchAssignment` for the destination Branch with `createdByRequestId` set to the Transfer request.

## Phase 10 Admin Control Reads

Phase 10 reuses existing tables and does not add schema:

- Pending final actions are read from `Request` rows at `PENDING_ADMIN` with
  `currentStep=ADMIN_FINAL_APPROVAL` and pending Admin approval rows.
- Archived users are read from `User` rows with non-active account state or
  resigned/terminated/archived employment state.
- Block detail is read from `User.blockStatus`, `blockedUntil`, and
  `blockReason`, plus the latest offboarding `Request` for context.
- Closed assignment history is read from `PickerBranchAssignment` rows with
  `status=CLOSED`; assignment history is never deleted.
- Audit tables are read through paginated Admin endpoints with redaction of
  secret-like JSON keys.

These reads do not create direct lifecycle mutation paths.
- The PostgreSQL partial unique index for one active Picker assignment enforces that a Picker cannot end up with two active Branch assignments.
- The request is marked `COMPLETED` only after the final approval update, old assignment closure, new assignment creation, notifications, and audit logs complete in one transaction.

## Phase 11 Reporting Reads

Phase 11 does not add reporting tables or stored summary totals. Reports read
existing normalized data:

- Admin system counts read `Chain`, `Vendor`, `User`, `Request`,
  `RequestApproval`, and active `PickerBranchAssignment` rows.
- Area Manager report scope comes from active `ChainAreaManagerAssignment`
  rows, then reads Vendors, Pickers, Champs, Requests, and Approvals within
  those Chains.
- Champ report scope comes from active `VendorChampAssignment` rows, then reads
  Branch Pickers and requests submitted by that Champ.
- Active manpower is counted only from active `PickerBranchAssignment` rows
  where the Picker user is `ACTIVE` and employment status is `ACTIVE`.
- Archived/deactivated and block summaries read existing `User.accountStatus`,
  `employmentStatus`, `blockStatus`, `blockedUntil`, and `blockReason` fields.

Reports must not introduce `User.managerId`, `User.chainId`, or `User.vendorId`,
and must not expose password hashes, temporary passwords, or raw secret payloads.
