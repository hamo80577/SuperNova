# Workflows — SuperNova

## Workflow Principle

Sensitive lifecycle changes must be workflow-based.

```text
Request -> Approval -> System applies change
```

Never implement direct manual edits for:

```text
Picker creation
Picker transfer
Picker archive/deactivation
Picker active branch assignment changes
```

## Branch-First Rule

Champ lifecycle actions start from a selected Branch.

Correct pattern:

```text
/champ/branches/:vendorId
-> select workflow action
```

The backend derives:

```text
sourceVendorId
sourceChainId
Area Manager scope
```

The Champ must not manually choose source Chain IDs.

## New Hire

Route:

```text
/champ/branches/:vendorId/new-hire
```

Backend:

```text
POST /api/requests/new-hire
POST /api/requests/:id/finalize-new-hire
```

Flow:

```text
Champ submits New Hire
-> Area Manager approves/rejects
-> Admin finalizes with Shopper ID
-> System creates Picker
-> System creates active PickerBranchAssignment
-> System generates temporary password
-> System notifies Champ
-> Picker logs in
-> Picker changes password
-> Picker completes profile
```

Hard rules:

- Champ can submit only for assigned Branches.
- Admin cannot finalize without Shopper ID.
- Temporary password is hashed.
- Temporary password is exposed only in Champ notification.
- Picker must change password first.
- Picker profile starts incomplete.

## Profile Completion

Route:

```text
/picker/profile-completion
```

Backend:

```text
GET /api/users/me/profile-completion
PATCH /api/users/me/profile-completion
```

Flow:

```text
Picker logs in
-> mustChangePassword if true
-> profile completion if profileStatus = INCOMPLETE
-> safe field update
-> profileStatus = COMPLETE
-> access Picker dashboard
```

Allowed self-service fields are intentionally limited.

Forbidden:

```text
role
accountStatus
employmentStatus
shopperId
passwordHash
mustChangePassword
temporaryPasswordExpiresAt
assignment fields
workflow fields
```

## Resignation / Termination

Routes:

```text
/champ/branches/:vendorId/resignation
/champ/branches/:vendorId/termination
```

Backend:

```text
POST /api/requests/offboarding
POST /api/requests/:id/finalize-offboarding
```

Flow:

```text
Champ submits for active Picker under selected Branch
-> Area Manager approves/rejects
-> Admin finalizes with block status and deactivation confirmation
-> System archives/deactivates Picker
-> System closes active PickerBranchAssignment
-> System disables login
-> Request becomes COMPLETED
```

Block statuses:

```text
NO_BLOCK
TEMPORARY_BLOCK
PERMANENT_BLOCK
```

Rules:

- No deletion.
- Assignment history remains.
- Rejection/cancellation must not deactivate Picker.
- Duplicate pending offboarding request for same Picker is blocked.

## Transfer

Route:

```text
/champ/branches/:vendorId/transfer
```

Backend:

```text
POST /api/requests/transfer
```

Same Chain:

```text
Champ submits Transfer
-> Source Chain Area Manager approves
-> System applies transfer
```

Cross Chain:

```text
Champ submits Transfer
-> Source Chain Area Manager approves
-> Destination Chain Area Manager approves
-> System applies transfer
```

System application:

```text
Close old active PickerBranchAssignment
Create new active PickerBranchAssignment
Preserve history
Mark Request COMPLETED
Create notifications
Create audit logs
```

Rules:

- Transfer to same source Vendor is blocked.
- Transfer for archived/deactivated Picker is blocked.
- Transfer with pending offboarding is blocked.
- Duplicate pending Transfer is blocked.
- Cross-chain transfer must not apply after source approval only.

## Admin Final Actions

Admin final action is required for:

```text
New Hire
Resignation
Termination
```

Admin final action is not required for Transfer unless explicitly changed later.

Admin pages:

```text
/admin/pending-actions
/admin/archived-users
/admin/audit-logs
/admin/settings
```

## Reporting

Reporting is read-only.

Reports must not mutate data.

Routes:

```text
/admin/reports
/area-manager/reports
/champ/reports
```

Backend:

```text
GET /api/reports/admin/overview
GET /api/reports/area-manager/overview
GET /api/reports/champ/overview
```

## UI/UX Workflow Rule

During page-by-page redesign, workflow behavior must not change.

UI changes can improve:

- layout
- hierarchy
- cards
- tables
- badges
- timelines
- form flow
- action placement

UI changes must not change:

- who can submit
- who can approve
- when system applies
- request statuses
- assignment behavior
- audit behavior
