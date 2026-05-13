# 01 — Product Rules

## Product Boundary

SuperNova is a partner workforce operations system.

It manages:

```text
Users
Branches
Chains
Assignments
Requests
Approvals
Notifications
Audit logs
Reports
Role-based workspaces
```

It does not manage generic HR modules unless explicitly requested.

## Roles

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

## Operational Hierarchy

```text
Picker -> Branch/Vendor -> Champ -> Chain -> Area Manager
```

A user's operational context is not stored directly on the user record.

It is derived from active assignment tables.

## Source of Truth

Use:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Do not use:

```text
User.vendorId
User.chainId
User.managerId
```

## Active Workflow Families

```text
New Hire / User Onboarding
Resignation
Transfer
Picker Profile Completion
Admin Final Actions
Notifications
Audit Logs
Reports
```

Termination is outside current active MVP scope unless explicitly reintroduced.

## New Hire / User Onboarding

New Hire supports onboarding users into operational roles.

Target roles:

```text
PICKER
CHAMP
AREA_MANAGER
```

Creator permissions:

```text
Champ -> PICKER only
Area Manager -> PICKER or CHAMP within assigned Chain scope
Admin/Super Admin -> PICKER, CHAMP, AREA_MANAGER
```

Context rules:

```text
PICKER requires Branch context.
CHAMP requires Branch context.
AREA_MANAGER requires at least one Chain context.
```

Approval rules:

```text
Champ creates PICKER -> Area Manager approval -> Admin finalization
Area Manager creates PICKER/CHAMP -> Area Manager step SKIPPED -> Admin finalization
Admin creates PICKER/CHAMP -> Area Manager approval -> Admin finalization
Admin creates AREA_MANAGER -> completed immediately with audit/request history
```

Finalization rules:

```text
PICKER requires Shopper ID.
CHAMP does not require Shopper ID.
AREA_MANAGER does not use Admin finalization after approval; Admin creates it directly as completed workflow.
```

Rehire rules:

```text
Rehire applies to PICKER only for now.
Active users cannot be rehired.
Temporarily blocked users cannot be rehired until block expiry.
Permanently blocked users cannot be rehired until Admin removes block from user profile.
```

## Temporary Password Rules

Temporary password must never be sent in notification text or notification payload.

Temporary password can be revealed only from authorized user profile credential controls.

Visibility:

```text
Admin/Super Admin -> authorized
Area Manager -> only within assigned Chain scope
Champ -> only for Pickers assigned to their Branch scope
Picker -> never sees temporary password after login process starts
```

Actions must be audited:

```text
TEMPORARY_PASSWORD_REVEALED
TEMPORARY_PASSWORD_RESET
TEMPORARY_PASSWORD_GENERATED
```

## Notifications

Notifications should guide users to the correct screen.

They must not contain secrets.

Good:

```text
New Picker assigned to your Branch. Open profile to view login handoff.
```

Bad:

```text
Temporary password is SN-123...
```

## Reports

Reports are read-only.

Reports must not mutate data.
