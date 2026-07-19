# AGENTS.md - SuperNova Operating Rules

## Product Identity

SuperNova is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Build for real operations: safe workflows, clean UX, auditable actions, and role-scoped visibility.

## Current Mode

Current mode: official product development and production hardening.

The product foundation is mostly built. Future work must improve, harden, and extend the official product in small scoped slices. Do not continue old one-off plans, prompts, or branches unless the product owner explicitly re-approves the direction inside the current task.

## Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: Modular monolith
Deployment target: Docker Compose / VPS when deployment work is requested
```

Do not introduce microservices unless explicitly approved.

## Domain Rules

Hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Roles:

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

Assignment source of truth:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Do not store operational hierarchy as source-of-truth fields on `User`.

Forbidden source-of-truth fields:

```text
User.managerId
User.vendorId
User.chainId
```

`User.role` remains the persona/workspace role. `AccessRole` and `UserAccessRoleAssignment` are additive permission surfaces, not replacements for operational assignments or workspace identity.

## Workflow Safety

Sensitive lifecycle changes must follow:

```text
Request -> Approval -> System applies change
```

No direct manual Picker creation, transfer, archive/deactivation, active assignment changes, or sensitive lifecycle changes unless a scoped product rule explicitly approves the exception.

## Access Control

Frontend hiding is not security.

Backend must enforce:

```text
Authentication
Role perimeter
Permission checks
Operational scope validation
Entity/request state validation
Audit logging for sensitive actions
```

Permission checks must not bypass service-level workflow rules, assignment-table scope, approval ownership, request state, or audit requirements.

## UI/UX Standards

Work page by page.

Design first for mobile widths:

```text
360px-430px
```

Use clean cards, tables, badges, forms, dialogs, tabs, steppers/timelines, empty states, and clear operational copy. Avoid fake dashboards, fake data, random SaaS templates, clutter, decorative noise, and horizontal overflow.

## Scope Guardrails

Do not add or present these as current product scope unless explicitly requested:

```text
Payroll
Salary calculations
Payroll deductions
Attendance penalty automation
GPS
Live tracking
Order integration
Inventory
Accounting
POS
Generic ERP modules
Biometric attendance
Live punch-in / punch-out app
Microservices
```

Existing attendance, Orders KPI, deduction, and HR sync code must remain scoped operational/reporting surfaces. Do not expand them into the forbidden areas above without approval.

## Codex / Agent Work Contract

Before implementation work:

```text
1. Inspect the repo.
2. Summarize current behavior.
3. Identify the real product problem.
4. Propose a short scoped plan.
5. Keep changes inside the approved scope.
```

SuperNova is a large operational system. After every task, agents must treat regressions as the main risk:

```text
1. Review the diff before delivery.
2. Check whether shared contracts, shared components, role-scoped pages, workflows, imports, dashboards, or reports were affected.
3. Run the relevant targeted tests and app-level typecheck/lint when code changed.
4. Do not claim visual, runtime, or integration verification unless it actually ran.
5. Do not commit unrelated dirty worktree changes unless they are part of the active requested slice.
```

Run relevant checks and never claim a check passed unless it actually ran.

Common checks:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

For documentation-only work, run at minimum:

```powershell
git status --short
git diff --check
```

If package scripts are unaffected, say explicitly that code checks were not run because the change was documentation-only.

## Final Response Format

Every implementation response must include:

```text
Summary
Files Changed
Behavior Changes
Tests/Checks Run
Manual Verification
Known Risks
Completion Status
Next Recommendation
```

Use only these completion statuses:

```text
Complete
Complete with known risks
Blocked
Partially complete
Rejected / needs correction
```

## Security

Never commit or expose:

```text
.env
.env.local
real tokens
real passwords
temporary passwords in notifications
passwordHash
JWT secrets
database dumps with personal data
```
