# Current Product State — SuperNova

## Status

SuperNova MVP core is complete.

The backend logic works and the core workflows have been verified. The next product work is UI/UX redesign page by page.

## Product Identity

SuperNova is a Talabat-style Partner Workforce Operations System.

It manages:

```text
Chains
Vendors / Branches
Pickers
Champs
Area Managers
Admins
Assignments
Requests
Approvals
Notifications
Audit Logs
Reports
```

It is not a generic HR ERP.

## Core Product

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

## Roles

### Picker

Can see:

- Own profile.
- Own Branch.
- Own Chain.
- Own Champ.
- Own Area Manager.
- Profile completion state.
- Own workspace.

### Champ

Can see:

- Assigned Branches.
- Active Pickers under assigned Branches.
- Branch-first lifecycle forms.
- Requests submitted.
- Notifications.
- Reports scoped to assigned Branches.

### Area Manager

Can see:

- Assigned Chains.
- Vendors/Branches under assigned Chains.
- Users under responsibility.
- Pending approvals.
- Requests under Chain scope.
- Reports scoped to assigned Chains.

### Admin

Can see and manage:

- Chains.
- Vendors.
- Assignment setup.
- Pending final actions.
- Archived users.
- Audit logs.
- Reports.
- Settings placeholders.

### Super Admin

Same as Admin with full system control.

## Completed Workflows

### New Hire

Status: Complete.

Key behavior:

- Champ submits from selected Branch.
- Backend validates Champ branch scope.
- Source Chain is derived from selected Vendor.
- Area Manager approves.
- Admin finalizes with Shopper ID.
- Picker is created.
- PickerBranchAssignment is created.
- Temporary password is generated and sent only to Champ notification.
- Picker must change password.
- Picker completes profile.

### Profile Completion

Status: Complete.

Key behavior:

- Incomplete Picker is redirected after password change.
- Picker can update only safe profile fields.
- Backend blocks forbidden fields.
- Profile status becomes complete.
- Audit log is created.

### Resignation / Termination

Status: Complete.

Key behavior:

- Champ submits from selected Branch.
- Area Manager approves.
- Admin finalizes with block status.
- Picker is archived/deactivated.
- Active assignment is closed.
- Login is disabled.
- Assignment history remains.

### Transfer

Status: Complete.

Key behavior:

- Champ submits from selected source Branch.
- Same-chain transfer needs source Chain Area Manager approval only.
- Cross-chain transfer needs source and destination Area Manager approvals.
- Old assignment is closed.
- New assignment is created.
- Assignment history remains.
- Picker workspace reflects new Branch.

## Admin Controls

Status: Complete.

Admin can inspect:

- Pending final actions.
- Archived/deactivated users.
- Block status.
- Audit logs.
- Settings placeholders.

Admin control surfaces do not add lifecycle bypasses.

## Reporting

Status: Complete.

Reports are read-only.

Admin:

- System-wide counts.
- Workforce summaries.
- Request summaries.
- Profile completion.
- Archive/block summary.
- Pending actions.

Area Manager:

- Chain-scoped counts.
- Vendor/Branch counts.
- Pending approvals.
- Profile completion.
- Requests in scope.

Champ:

- Assigned Branches.
- Active Pickers.
- Submitted requests.
- Workflow outcomes.
- Profile completion.

## Hardening Status

Status: Complete for MVP baseline.

Implemented:

- Blocked/inactive accounts rejected by auth.
- Temporary blocked accounts rejected while block is active.
- Safe user response shaping.
- Request/admin audit redaction.
- Workflow-specific generic request bypass protection.
- Query indexes for common queues/reports.
- Prisma config moved out of deprecated package config.
- Local PostgreSQL verification is the current development verification path.

## Current Active Workstream

```text
Page-by-page UI/UX redesign
```

The logic works. The UI needs product-owner-led redesign.

## Known Technical Debt

- `requests.service.ts` remains large.
- Automated tests are limited.
- Some UI pages were built quickly during backend workflow phases.
- Current dev mode is local PostgreSQL + npm run dev.
- Moderate dependency audit warnings may remain due to Next/PostCSS chain.
- Production deployment strategy is not finalized.
