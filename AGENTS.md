# AGENTS.md — SuperNova Operating Rules

## Mission

SuperNova is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Build for real operations: safe workflows, clean UX, auditable actions, and role-scoped visibility.

## Current Mode

The project is in planning reset mode.

Do not continue old rejected branches or previous implementation plans unless the product owner explicitly re-approves them.

Before any new feature work:

```text
1. Inspect the repo.
2. Summarize current behavior.
3. Identify the real product problem.
4. Propose a small scoped plan.
5. Wait for the approved direction inside the current task.
```

## Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: modular monolith
Deployment target: Docker Compose / VPS when deployment work is requested
```

Do not introduce microservices.

## Domain Rules

Hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Source of truth:

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

## Workflow Safety

Sensitive lifecycle changes must follow:

```text
Request -> Approval -> System applies change
```

No direct manual Picker creation, transfer, archive/deactivation, or active assignment changes unless a new scoped rule is explicitly approved.

## UI/UX Rules

Work page by page.

Design first for mobile widths:

```text
360px–430px
```

Use clean cards, tables, badges, forms, step indicators, and clear operational copy. Avoid toy dashboards, fake data, random SaaS templates, clutter, and horizontal overflow.

## Scope Guardrails

Do not add unless explicitly requested:

```text
Payroll
Salary deductions
GPS
Live tracking
Order integration
Inventory
Accounting
POS
Generic ERP modules
Biometric attendance
Microservices
```

## Codex / Agent Work Contract

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

Run relevant checks and never claim a check passed unless it actually ran.

Common checks:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
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
