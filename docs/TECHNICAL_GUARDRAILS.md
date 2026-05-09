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
- Run typecheck/lint/build.

## Verification Commands

UI-only:

```powershell
npm run typecheck
npm run lint
npm run build
```

Backend/full-stack:

```powershell
docker compose up -d postgres
docker compose ps
docker compose logs postgres --tail=80
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
docker compose --profile app build --progress=plain
docker compose --profile app up -d --force-recreate api web
```

Verify:

```text
http://localhost:4000/api/health
http://localhost:3000/login
```

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
- Docker production image strategy needs a dedicated deployment pass.
- UI needs page-by-page redesign.
