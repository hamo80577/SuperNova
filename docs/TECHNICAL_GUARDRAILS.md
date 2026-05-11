# Technical Guardrails — SuperNova

## Purpose

This file protects the working MVP from accidental regressions during future UI/UX and maintenance work.

## Product Guardrails

SuperNova is:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Do not add unrelated modules unless explicitly requested.

Forbidden unless explicitly approved:

```text
Payroll
Attendance
GPS
Order integration
Inventory
Accounting
Generic ERP modules
Microservices
```

## Lifecycle Guardrails

Do not bypass workflows.

Forbidden direct lifecycle changes:

```text
Direct Picker creation
Direct Picker transfer
Direct Picker archive/deactivation
Direct active Picker assignment edit
```

Correct:

```text
Request -> Approval -> System applies change
```

## Assignment Guardrails

Do not store:

```text
User.managerId
User.vendorId
User.chainId
```

Use:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

## Backend Guardrails

Every protected mutation must validate:

```text
Authentication
Role
Operational scope
Entity state
Request state
Approval ownership
Audit log creation
```

Frontend hiding is not security.

## Auth Guardrails

- Inactive accounts cannot login.
- Archived/deactivated accounts cannot login.
- Permanently blocked accounts cannot login.
- Temporary blocked accounts cannot login while block is active.
- Temporary password must be changed before normal access.
- Picker profile completion comes after password change.

## Sensitive Data Guardrails

Never expose:

```text
passwordHash
raw password
raw temporary password except Champ notification after New Hire finalization
JWT secret
tokens
cookies
credentials
```

API responses containing JSON payloads should redact secret-like keys.

## Workflow Endpoint Guardrails

Workflow-specific requests must use:

```text
POST /api/requests/new-hire
POST /api/requests/offboarding
POST /api/requests/transfer
```

Generic request creation must not create:

```text
NEW_HIRE
RESIGNATION
TERMINATION
TRANSFER
```

## Database Guardrails

Use Prisma migrations.

Do not use `prisma db push` as the normal path.

Preserve history:

- close assignments, do not delete them
- archive/deactivate users, do not delete them
- keep audit logs

## UI Guardrails

For UI-only redesign:

- Do not change backend logic.
- Do not change API contracts unless approved.
- Do not change workflow behavior.
- Do not add fake data.
- Do not hide broken data with frontend-only hacks.
- Use the verification tier that matches the actual change.

## Verification Tier Policy

Use the lightest verification tier that matches the actual change. The goal is correct verification, not infrastructure churn.

### Tier 1 — Docs-only

Use for documentation or instruction edits only.

Do not run app startup, Prisma, build, lint, or typecheck unless explicitly requested.

Allowed lightweight checks:

```powershell
git diff
git status
git diff --check
```

### Tier 2 — UI-only lightweight

Use for frontend-only visual work:

```text
spacing
colors
layout
copy
cards/tables/badges
responsive styling
frontend-only page composition
shadcn/Tailwind component polish
```

Required checks:

```powershell
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
```

Run only when the UI change is structural or before final page acceptance:

```powershell
npm run build --workspace @supernova/web
```

Do not run for normal UI-only work:

```text
prisma migrate
prisma db seed
database reset
full-stack restart
```

### Tier 3 — Frontend behavior

Use when frontend changes touch auth routing, protected route logic, login redirect behavior, API client usage, or cookie/auth UI interaction.

Run:

```powershell
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
npm run build --workspace @supernova/web
```

Do not run local PostgreSQL/Prisma setup unless backend, API, auth server, database, or environment files were changed.

### Tier 4 — Backend/full-stack

Only run local PostgreSQL full-stack verification when changes touch:

```text
apps/api
prisma
.env examples
auth backend/cookies/session behavior
API contracts
database migrations
request/approval/workflow backend logic
reports backend logic
deployment/runtime config
```

Backend/full-stack verification may include:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
npm run typecheck
npm run lint
npm run build
npm run dev
```

Verify:

```text
http://localhost:4000/api/health
http://localhost:3000/login
```

### Existing Local Environment Rule

If the local app is already running, use that existing environment for manual browser checks. Do not stop or restart local services unless the current task requires backend/full-stack verification.

```text
http://localhost:3000
http://localhost:4000
```

### Final Response Rule

For every task, state the verification tier used:

```text
Docs-only
UI-only lightweight
UI structural
Frontend behavior
Backend/full-stack
```

Also state why local PostgreSQL/app startup was or was not run.

## Commit Guardrails

Do not commit:

```text
.env
.env.local
runtime logs
local database files
real passwords
real tokens
real JWT secrets
temporary credentials
```

## Known Technical Debt

- `requests.service.ts` is large.
- Automated tests are limited.
- Production deployment strategy needs a dedicated pass.
- UI needs page-by-page redesign.
