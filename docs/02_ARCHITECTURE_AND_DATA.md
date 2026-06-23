# Architecture And Data

## Architecture

SuperNova is a modular monolith.

Do not introduce microservices unless explicitly approved.

## Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Package manager: npm workspaces
```

## Monorepo Shape

```text
apps/web
apps/api
packages/shared
prisma
scripts
docs
```

`apps/web` owns the Next.js UI. `apps/api` owns the NestJS backend, API, worker entrypoint, and business services. `packages/shared` is the shared package surface. `prisma` owns schema, migrations, seed data, and data import scripts.

## Backend Module Boundaries

Current backend modules include:

```text
access-control
admin
assignments
attendance
audit
auth
chains
dashboard-cache
deductions
health
hr-sync
import-jobs
notifications
orders-kpis
prisma
reports
requests
users
vendors
workspaces
```

Controllers should stay thin. Services own business rules. Workflow-specific services should remain the authority for request creation, approval routing, finalization, assignment mutation, notification, and audit behavior.

## Data Model Rules

`User.role` is the persona/workspace role.

Operational scope is assignment-table based:

```text
PickerBranchAssignment -> Picker to Vendor/Branch
VendorChampAssignment -> Champ to Vendor/Branch
ChainAreaManagerAssignment -> Area Manager to Chain
```

Access roles are permission grants:

```text
AccessRole
AccessRolePermission
UserAccessRoleAssignment
```

Access roles must not replace `User.role` or operational assignment records.

## Request Data

`Request` stores workflow state and context. It must not store secrets.

Never store these in request payloads, notifications, audit payloads, or frontend responses:

```text
raw password
raw temporary password
passwordHash
tokens
cookies
credentials
JWT secrets
database URLs
```

## Prisma Rules

Use Prisma migrations for schema changes.

Do not use `prisma db push` as the normal development path.

When schema changes are scoped and approved, run:

```powershell
npm run prisma:generate
npm run prisma:validate
```

Use `npm run prisma:migrate` only when migration work is in scope and local database state is ready.

## Transactions

Use transactions for lifecycle operations that must complete atomically.

Examples:

- New Hire finalization approving the final step, creating/reactivating the user, creating assignment records, updating the request, creating notifications, and writing audit logs.
- Transfer application closing the old assignment, creating the new assignment, updating request state, and writing audit logs.
- Offboarding finalization closing assignments, changing account state, updating request state, and writing audit logs.

## External Integrations

External integrations stay inside the modular monolith.

HR Google Sheets Sync is a backend-to-Google Apps Script integration for supported Picker lifecycle events:

```text
PICKER_NEW_HIRE
PICKER_REHIRE
PICKER_RESIGNATION
```

Rules:

- SuperNova remains the source of truth.
- Google Sheets is not source of truth.
- Sync runs only after workflow finalization succeeds.
- Sync failure must not roll back user or assignment lifecycle changes.
- `HrSyncLog` records sent, failed, skipped, and pending states.
- Backend-only env keys are `HR_SYNC_ENABLED`, `HR_SYNC_WEB_APP_URL`, and `HR_SYNC_SECRET`.

The Apps Script source and sample payloads live under:

```text
scripts/google-apps-script/hr-sync
```

## Runtime Infrastructure

Local Docker Compose provides:

```text
PostgreSQL: localhost:5432
Redis: localhost:6379
PgBouncer: localhost:6432
```

Runtime Prisma traffic uses PgBouncer when configured through `DATABASE_URL`; migrations use direct PostgreSQL through `DIRECT_URL`.
