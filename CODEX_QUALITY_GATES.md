# SuperNova Codex Quality Gates

## Purpose

This file defines review gates that must be checked after each Codex implementation phase.

## Universal Gate

A phase is not complete unless:

```text
It matches the requested scope.
It does not start the next phase.
It passes available checks.
It has no obvious security bypass.
It has a clear final summary.
```

## Required Checks

Codex should run available commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

If command names differ, inspect package scripts and run the equivalent.

If a command cannot run, Codex must explain why.

## Backend Gates

Check:

```text
Are routes protected?
Are roles checked?
Is operational scope checked?
Are request statuses enforced?
Are invalid transitions blocked?
Are sensitive actions audited?
Are passwords hashed?
Are temporary passwords forced to change?
Are transactions used for multi-step workflow finalization?
Are active assignment constraints enforced?
```

## Frontend Gates

Check:

```text
Does the UI match the role?
Are unauthorized actions hidden?
Are backend errors displayed clearly?
Are forms validated?
Are loading states present?
Are empty states present?
Are tables paginated where needed?
Are status badges consistent?
Does the UI avoid fake data unless clearly seeded?
```

## Workflow Gates

### New Hire

Must verify:

```text
Champ can submit only for assigned branch.
Area Manager approval uses source Chain.
Admin finalization requires Shopper ID.
Picker is created only after final approval.
Picker gets active branch assignment.
Temporary password is generated and hashed.
Champ receives notification.
Picker must change password on first login.
```

### Resignation / Termination

Must verify:

```text
Champ can submit only for Pickers under their branches.
Area Manager approval is scoped.
Admin finalizes.
User is archived/deactivated.
Login is disabled.
Assignment is closed.
Block status is saved.
```

### Transfer

Must verify:

```text
Champ can submit only for Picker under their branch.
Same-chain transfer needs one Area Manager approval.
Cross-chain transfer needs source and destination Area Manager approvals.
Assignment is changed by system only.
Old assignment is closed.
New assignment is created.
History is preserved.
```

## Data Model Gates

Reject implementation if:

```text
User has managerId as source of truth.
User has vendorId as source of truth.
User has chainId as source of truth.
Age is stored instead of dateOfBirth.
Assignments are overwritten instead of historized.
Passwords are stored plain.
Shopper ID is optional in Admin finalization.
```

## UI/UX Gate

For frontend phases, Codex must apply professional UI/UX standards.

If tools/plugins/superpowers are available, use them, especially:

```text
ui-ux-pro-max
```

If unavailable, manually apply equivalent standards.

Review for:

```text
Clean dashboard layout
Good spacing
Clear tables
Status badges
Action clarity
Role-specific navigation
No clutter
No toy-like design
```

## Final Review Template

Use this template after each phase:

```text
Verdict:
Can move to next phase: Yes/No

Completed:
Missing:
Risks:
Required fixes:
Suggested Codex prompt:
```
