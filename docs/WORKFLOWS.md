# SuperNova Workflow Guardrails

## Operating Principle

Sensitive lifecycle changes must not happen through direct data edits. The enforced product pattern is:

```text
Request -> Approval -> Final Action -> System Applies Change
```

## Protected Lifecycle Actions

These actions must stay workflow-based:

- Picker creation
- Picker transfer
- Picker archive/deactivation
- Picker assignment changes

## Champ Branch-First Rule

Champ operations are Branch-first. The active operational context for Champ
actions is the selected Vendor/Branch, not a generic Chain or manually entered
source identifier.

- If a Champ has one assigned Branch, the Champ should work inside that Branch context.
- If a Champ has multiple assigned Branches, dashboards may aggregate visibility, but every mutation/action must start by opening one Branch.
- New Hire, Resignation, and Termination are launched from a selected Branch context. Transfer must use the same Branch-first launch pattern in its later phase.
- User-facing Champ workflow forms must not ask the Champ to manually select `sourceChainId` or `sourceVendorId`.
- The selected Branch route is `/champ/branches/:vendorId`; future forms must derive `sourceVendorId` from that route and `sourceChainId` from the Branch Chain returned by the backend.
- `/champ/dashboard` is for aggregate visibility only and must not present global lifecycle action launchers.

## New Hire

Phase 6 implements New Hire end-to-end from the selected Champ Branch context:

```text
Champ request
-> Area Manager approval
-> Admin approval
-> Admin enters Shopper ID
-> System creates Picker
-> System assigns Picker to source Vendor
-> System notifies Champ with temporary credentials
-> Picker logs in and must change password
```

Rules:

- Champ starts New Hire from `/champ/branches/:vendorId/new-hire`.
- Backend verifies the Champ has an active `VendorChampAssignment` for that Branch.
- Backend derives `sourceVendorId` from the route payload and `sourceChainId` from the Branch Chain.
- Area Manager approval is scoped to the active `ChainAreaManagerAssignment` for the source Chain.
- Admin finalization requires Shopper ID and runs the final system action transaction.
- Temporary password is never stored as plain text on `User`; it appears only in the Champ notification created after finalization.
- The created Picker has `profileStatus=INCOMPLETE`, `mustChangePassword=true`, and an active `PickerBranchAssignment` to the source Branch.

## Picker Profile Completion

Phase 7 implements the post-New Hire onboarding step for newly created Pickers:

```text
Picker logs in with temporary password
-> Picker changes password
-> Picker completes required profile fields
-> profileStatus becomes COMPLETE
-> Picker opens full workspace
```

Rules:

- `mustChangePassword` always comes before profile completion.
- Pickers with `profileStatus=INCOMPLETE` are routed to `/picker/profile-completion`.
- Required fields are `nationalId`, `address`, `dateOfBirth`, and `joiningDate`.
- Age is not stored; any age display must be derived from `dateOfBirth`.
- Profile completion can update only safe profile fields: `nameEn`, `nameAr`, `nationalId`, `address`, `dateOfBirth`, `gender`, and `joiningDate`.
- Profile completion cannot change role, account status, employment status, block status, Shopper ID, IBS ID, passwords, assignments, or lifecycle request state.
- Documents are not uploaded or stored in Phase 7.

## Resignation / Termination

Phase 8 implements Resignation and Termination end-to-end from the selected Champ Branch context:

```text
Champ request
-> Area Manager approval
-> Admin approval
-> System archives/deactivates Picker
-> System closes active assignment
-> System records block status
```

Rules:

- Champ starts Resignation from `/champ/branches/:vendorId/resignation`.
- Champ starts Termination from `/champ/branches/:vendorId/termination`.
- Backend verifies the Champ has an active `VendorChampAssignment` for that Branch.
- Backend limits the target Picker to active `PickerBranchAssignment` rows for that selected Branch.
- Backend derives `sourceChainId` from the selected Branch Chain and assigns Area Manager approval from the active `ChainAreaManagerAssignment`.
- A duplicate pending Resignation or Termination request for the same Picker is rejected.
- Admin finalization requires block status and explicit internal deactivation confirmation.
- Finalization archives the Picker account, disables login by making the account non-active, closes the active Picker Branch assignment, saves block status, completes the request, notifies the Champ, and writes audit logs.
- Rejected or cancelled requests do not deactivate the Picker and do not close assignments.
- The generic Admin request endpoint must not be used to create Resignation or Termination requests.

## Transfer

Same chain:

```text
Champ request
-> Source Chain Area Manager approval
-> System transfers Picker
```

Cross chain:

```text
Champ request
-> Source Chain Area Manager approval
-> Destination Chain Area Manager approval
-> System transfers Picker
```

Phase 5 does not implement final Transfer execution. It may create and approve a generic `TRANSFER` request, but it does not move Picker assignments.

## Phase 3 Assignment Setup Is Not Transfer

Admin assignment management in Phase 3 is setup tooling for the operational hierarchy only.

Allowed in Phase 3:

- create an active Picker -> Vendor assignment when no active Picker assignment exists
- create an active Vendor -> Champ assignment when no active Vendor Champ assignment exists
- create an active Chain -> Area Manager assignment when no active Chain Area Manager assignment exists
- close an active assignment while preserving its history row
- derive current management context from active assignment rows

Not allowed in Phase 3:

- automatic Picker transfer
- auto-closing old assignments during create
- request approval logic
- direct Picker creation screen
- lifecycle finalization actions

## Explicit MVP Exclusions

Do not add these to MVP unless explicitly requested:

- Payroll
- Attendance
- GPS tracking
- Order integration
- Microservices
- Advanced analytics

## Phase 4 Role Workspaces Are Read-Only

Phase 4 workspaces expose scoped operational visibility only:

- Picker can view own profile, branch, chain, Champ, and Area Manager context.
- Champ can view assigned branches and active Pickers under those branches.
- Area Manager can view assigned Chains, Vendors under those Chains, and assigned users under those Vendors.
- Admin can view system-wide operational counts and links to existing controlled management pages.

These workspaces must not bypass lifecycle workflows. Request creation and approval decisions are introduced by the Phase 5 generic engine. New Hire final execution is implemented in Phase 6, Resignation/Termination final execution is implemented in Phase 8, and Transfer final execution remains a later phase.

## Phase 5 Generic Engine Is Not Finalization

Allowed in Phase 5:

- create generic lifecycle request records
- submit requests to generated approval steps
- approve or reject pending approval steps
- move fully approved requests to `APPROVED`
- create notifications and audit logs for request/approval activity
- show request lists, details, timelines, and pending approval queues
- expose an Admin/Super Admin-only internal generic request creation UI for engine testing

Not allowed in Phase 5:

- creating a Picker after New Hire approval
- requiring or storing Admin Shopper ID finalization
- moving a Picker branch after Transfer approval
- closing old assignments from Transfer approval
- archiving/deactivating Pickers from Resignation or Termination approval
- marking requests `COMPLETED`
- presenting the internal generic request creation form as a real Champ operations workflow
- creating `NEW_HIRE` through the generic Admin request endpoint; New Hire must use the Branch-first endpoint
- creating `RESIGNATION` or `TERMINATION` through the generic Admin request endpoint; Offboarding must use the Branch-first endpoint

## Phase 6 New Hire Is Not Generic CRUD

Allowed in Phase 6:

- Champ submits New Hire only from a selected assigned Branch.
- Area Manager approves/rejects only when scoped to the Branch Chain.
- Admin/Super Admin finalizes only with Shopper ID.
- System creates the Picker and Branch assignment after approvals and finalization.
- System delivers temporary credentials only through the Champ notification.

Not allowed in Phase 6:

- direct Picker creation screens
- Transfer execution
- Resignation/Termination finalization
- document uploads, payroll, attendance, GPS, or analytics

## Phase 7 Profile Completion Is Not Lifecycle Finalization

Allowed in Phase 7:

- Picker-only safe self-service profile completion.
- Redirecting incomplete Pickers away from the full Picker workspace after password change.
- Updating `profileStatus` to `COMPLETE` after required fields validate.
- Audit logging profile completion submission.

Not allowed in Phase 7:

- Transfer execution
- document upload storage
- Admin profile review workflow
- direct Picker assignment changes

## Phase 8 Offboarding Is Not Transfer

Allowed in Phase 8:

- Champ submits Resignation or Termination only from a selected assigned Branch.
- Area Manager approves/rejects only when scoped to the source Branch Chain.
- Admin/Super Admin finalizes with block status and internal deactivation confirmation.
- System archives the Picker account and closes the active Branch assignment after approvals and finalization.
- System preserves User and assignment history and writes audit logs.

Not allowed in Phase 8:

- Transfer execution
- direct Picker archive/deactivation outside the workflow
- deleting Picker users or assignment rows
- direct Picker assignment edits
- payroll, attendance, GPS, order integration, documents upload, or analytics
