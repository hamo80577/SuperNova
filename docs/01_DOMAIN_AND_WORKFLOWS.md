# Domain And Workflows

## Assignment Source Of Truth

Do not store operational hierarchy as source-of-truth fields on `User`.

Forbidden source-of-truth fields:

```text
User.managerId
User.vendorId
User.chainId
```

Correct source-of-truth tables:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Assignment history must be preserved. Close old active assignments and create new assignment rows when operational context changes.

## Workflow Safety

Sensitive lifecycle changes must follow:

```text
Request -> Approval -> System applies change
```

Do not bypass this pattern for:

- Picker creation.
- Picker transfer.
- Picker archive/deactivation.
- Active Picker assignment changes.
- Sensitive assignment or lifecycle changes.

## Request And Approval Model

Current Prisma request types include:

```text
NEW_HIRE
RESIGNATION
TRANSFER
DEDUCTION
ANNUAL_LEAVE
```

Current request statuses include:

```text
DRAFT
PENDING_CHAMP
PENDING_AREA_MANAGER
PENDING_DESTINATION_AREA_MANAGER
PENDING_ADMIN
APPROVED
REJECTED
CANCELLED
COMPLETED
```

Current approval steps include:

```text
CHAMP_APPROVAL
AREA_MANAGER_APPROVAL
SOURCE_AREA_MANAGER_APPROVAL
DESTINATION_AREA_MANAGER_APPROVAL
ADMIN_FINAL_APPROVAL
```

Approval ownership, request state, target role, source/destination scope, and entity state remain service-level rules. Route permissions are not enough to apply lifecycle changes.

## New Hire

New Hire supports controlled onboarding for operational roles.

Target roles:

```text
PICKER
CHAMP
AREA_MANAGER
```

Rules:

- Picker onboarding requires Branch context and creates/reactivates a user only after the required approvals/finalization path.
- Champ onboarding requires Branch context and creates/reactivates a user plus `VendorChampAssignment` through workflow finalization.
- Area Manager onboarding creates the user through the approved workflow; active Chain scope is managed through `ChainAreaManagerAssignment`, not `User.chainId`.
- Rehire keeps prior profile data as source of truth where the workflow allows it.
- Active users, active assignments, blocked users, and duplicate pending requests must be handled by workflow policy.
- Temporary passwords are never sent in notifications.

## Picker Profile Completion

Picker Profile Completion is an authenticated Picker flow after password change.

Rules:

- It is Picker-persona specific.
- It must not expose password fields or credential internals.
- Backend validation must confirm the actor and target are the same allowed Picker path.

## Resignation / Offboarding

Resignation / Offboarding is workflow-based.

Rules:

- No deletion of operational history.
- Active assignments close through finalization.
- Account access changes only after the approved workflow applies them.
- Rejection or cancellation must not apply the lifecycle change.
- Pending resignation blocks conflicting lifecycle workflows where the services enforce that rule.
- Block decisions and final state must be audited.

## Transfer

Transfer is Picker-focused.

Rules:

- Transfer to the same Branch is blocked.
- Archived/deactivated Pickers cannot be transferred.
- Duplicate pending Transfer is blocked.
- Pending resignation blocks Transfer.
- Same-Chain and cross-Chain flows must respect source and destination approval ownership.
- Applying Transfer closes the old active `PickerBranchAssignment` and creates a new active `PickerBranchAssignment`.

## Notifications And Audit

Notifications guide users to the right screen. They must not carry secrets.

Good notification pattern:

```text
New Picker assigned to your Branch. Open profile to view login handoff.
```

Bad notification pattern:

```text
Temporary password is SN-123...
```

Sensitive actions must write audit logs. Audit payloads must not contain raw passwords, tokens, cookies, JWT secrets, or database URLs.

## Reporting And Imports

Reports are read-only. Report routes and import workflows must not mutate Users, roles, assignments, request workflow state, or lifecycle fields unless a scoped workflow explicitly owns that mutation.

Attendance and Orders KPI imports are operational reporting surfaces. They must not become payroll, salary deductions, live tracking, or live order integration without explicit approval.
