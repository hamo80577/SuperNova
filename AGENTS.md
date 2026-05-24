# AGENTS.md - SuperNova Engineering Operating Rules

## Mission

SuperNova is a Talabat-style Partner Workforce Operations System.

It is not a generic HR ERP.

The product exists to manage operational workforce lifecycle through:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Build a reliable production-quality system, not a prototype dashboard.

## Required Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: modular monolith
Deployment target: VPS / Docker Compose when deployment work is explicitly requested
```

Do not introduce microservices.

## Core Domain

Operational hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Source of truth:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Never store these as source-of-truth fields on `User`:

```text
managerId
vendorId
chainId
```

## Lifecycle Rule

Sensitive lifecycle changes must be workflow-based:

```text
Request -> Approval -> System applies change
```

Forbidden direct actions unless explicitly approved in a scoped task:

```text
Direct Picker creation
Direct Picker transfer
Direct Picker archive/deactivation
Direct active Picker assignment edit
Direct role/status changes from imports
```

## Current Active Product Scope

Active core workflow families:

```text
New Hire / User Onboarding
Resignation
Transfer
Profile Completion
Admin Controls
Reports
Notifications
Audit Logs
```

Resignation is the only active offboarding lifecycle unless the product owner explicitly expands scope.

## New Hire Direction

New Hire is evolving into a unified onboarding workflow.

Supported target roles:

```text
PICKER
CHAMP
AREA_MANAGER
```

Rules:

```text
Champ can create New Hire for PICKER only.
Area Manager can create New Hire for PICKER or CHAMP within assigned Chain scope.
Admin can create New Hire for PICKER, CHAMP, or AREA_MANAGER.
PICKER requires Branch context and Admin finalization with Shopper ID.
CHAMP requires Branch context and Admin finalization without Shopper ID.
AREA_MANAGER requires at least one Chain and can be created by Admin only.
Rehire applies to PICKER only for now.
Egypt phone and national ID validation are required.
Temporary password must not be sent in notifications.
Temporary password is revealed/reset only through authorized user profile credential controls.
```

## Attendance Analytics Scope

Attendance Analytics is approved only as:

```text
data import
metric calculation
compressed historical summaries
role-scoped reporting
Super Admin data operations
```

Attendance Analytics is not:

```text
payroll
payroll deductions
salary calculations
GPS
live tracking
biometric integration
live punch-in/out
order integration
inventory
accounting
generic ERP
microservices
```

Attendance imports must never:

```text
create users
transfer users
archive/deactivate users
change assignments
change User.role
change User.shopperId
change User.ibsId
change employmentStatus
change accountStatus
```

Attendance role matching must use SuperNova `User.role`, not the uploaded file `Role` or `Designation`.

Picker matching:

```text
Attendance.Identifier = User.shopperId
```

Champ matching:

```text
Attendance.Identifier = User.ibsId
```

## HR Sync Rules

HR Sync to Google Sheets is scoped to Picker lifecycle reporting only.

Rules:

```text
HR Sync is post-finalization only.
HR Sync failure must not roll back workflow success.
Google Sheets is not source of truth.
HR Sync is Picker-only unless explicitly expanded.
Backend sends to Google Apps Script Web App only after SuperNova applies the lifecycle change.
Apps Script/webhook integrations must validate a shared secret.
Apps Script deployment URL and secret are backend env only.
Do not hardcode Apps Script deployment URLs.
Do not expose Apps Script URL or secret in frontend or UI.
Do not commit real Apps Script URLs or secrets.
Do not add payroll, attendance, GPS, order integration, inventory, accounting, or ERP behavior under HR Sync.
```

## Quality Bar

Every code change must be treated as production work.

Minimum standards:

```text
Type safety
Clear boundaries
No workflow bypass
No accidental data exposure
No fake data
No broad refactors without a scoped plan
No UI changes that hide broken backend behavior
No backend changes hidden inside UI polish tasks
No undocumented behavior change
```

## Agent Work Protocol

Before editing code, the agent must:

```text
1. Inspect the relevant files.
2. Summarize current behavior.
3. Identify the exact gap.
4. Write a short implementation plan.
5. State scope boundaries.
6. State verification tier.
```

During implementation:

```text
1. Keep changes scoped.
2. Prefer small services/components over huge files.
3. Preserve existing behavior unless the task explicitly changes it.
4. Add validation at backend level, not only frontend.
5. Update docs when behavior changes.
6. Run the correct checks.
```

For documentation-only work:

```text
Inspect current docs first.
State a short plan before edits.
Do not run build/typecheck/lint unless source code changed accidentally.
Run git diff --check and git status.
```

## UI/UX Work Rules

SuperNova UI must be mobile-first.

Design first for:

```text
360px - 430px width
```

UI requirements:

```text
No horizontal overflow
Touch-friendly controls
Clear primary action
Operational copy
Clean cards/tables/badges/timelines
Strong page context
Clear workflow steps
No fake data
No random SaaS template look
```

For UI/UX tasks, the agent should use:

```text
ui-ux-pro-max
```

If `ui-ux-pro-max` is available in the coding environment, use it for design audit, layout planning, responsive review, and polish pass.

If it is not available, manually apply the same standards from `docs/UI_UX_DIRECTION.md` and `docs/UI_UX_COMPONENT_RULES.md`.

Do not use UI work as a reason to expand backend scope.

## Verification Rules

Use the lightest verification tier that matches the change.

Do not claim a check passed unless it actually ran.

If a check cannot run, state the exact reason.

Docs-only:

```powershell
git diff --check
git status
```

Common code-phase commands:

```powershell
npm run typecheck
npm run lint
npm run build
npm run prisma:generate
npm run prisma:validate
```

For Windows Prisma DLL lock:

```powershell
Get-Process node
Stop-Process -Name node -Force
npm run prisma:generate
```

## Final Response Format

For implementation work, final response must include:

```text
Summary
Files Changed
Behavior Changes
Behavior Preserved
Tests/Checks Run
Manual Verification
Security/Scope Review
Known Risks
Completion Status
Next Recommendation
```

If the user provides a task-specific final response format, follow that exact format.

## Forbidden Unless Explicitly Approved

Do not add unless explicitly requested:

```text
Payroll
Payroll deductions
Salary calculations
GPS
Live tracking
Biometric integration
Live punch-in/out
Order integration
Inventory
Accounting
Generic ERP modules
Microservices
```

Attendance is explicitly approved only within the Attendance Analytics scope above.

Do not commit or expose:

```text
.env
.env.local
real tokens
real passwords
raw temporary passwords in notifications
passwordHash
JWT secrets
database dumps with personal data
```
