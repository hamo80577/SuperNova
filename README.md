# SuperNova

SuperNova is a Talabat-style Partner Workforce Operations System.

It manages partner workforce operations through:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a generic HR ERP.

## Current MVP Status

The MVP core is complete.

Implemented:

- Authentication, roles, protected workspaces.
- Access Control V1 backend-complete foundation.
- Policy Authorization migration for selected static and workflow-adjacent routes.
- Chains and Vendors/Branches.
- Picker/Champ/Area Manager assignment hierarchy.
- Request and approval engine.
- Branch-first New Hire workflow.
- Picker Profile Completion workflow.
- Branch-first Resignation workflow.
- Branch-first Transfer workflow.
- Admin controls for pending final actions, archived users, and audit logs.
- Operational reports for Admin, Area Manager, and Champ.
- Security/hardening pass with access checks, redaction, and query indexes.

Current planned workstream:

1. HR Google Sheets Sync planning and integration.
2. Return to page-by-page UI/UX redesign after the integration plan is ready.

HR Sync is planned only. It is not implemented yet.

## Product Model

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Important rules:

- Do not store `managerId`, `vendorId`, or `chainId` on `User` as source of truth.
- Operational context is derived from assignment tables.
- Lifecycle actions are workflow-based.
- No direct manual Picker creation, transfer, archive, or active assignment change.

Correct lifecycle pattern:

```text
Request -> Approval -> System applies change
```

## Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: modular monolith
Current dev mode: Local PostgreSQL + npm workspaces
```

## Repository Shape

```text
supernova/
  apps/
    api/
    web/
  packages/
    shared/
  prisma/
  docs/
  AGENTS.md
  README.md
```

## Main Routes

```text
Login: /login

Picker:
  /picker/dashboard
  /picker/profile-completion

Champ:
  /champ/dashboard
  /champ/branches
  /champ/branches/:vendorId
  /champ/branches/:vendorId/new-hire
  /champ/branches/:vendorId/transfer
  /champ/branches/:vendorId/resignation
  /champ/reports

Resignation is the only offboarding lifecycle in the active MVP scope.

Area Manager:
  /area-manager/dashboard
  /area-manager/reports
  /approvals
  /requests

Admin / Super Admin:
  /admin/dashboard
  /admin/chains
  /admin/vendors
  /admin/assignments
  /admin/pending-actions
  /admin/archived-users
  /admin/audit-logs
  /admin/reports
  /admin/settings
```

## API Highlights

```text
GET  /api/health

Auth:
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/change-password
GET  /api/auth/me

Workspaces:
GET /api/workspaces/picker
GET /api/workspaces/champ
GET /api/workspaces/champ/branches
GET /api/workspaces/champ/branches/:vendorId
GET /api/workspaces/area-manager
GET /api/workspaces/admin

Requests:
GET  /api/requests
GET  /api/requests/my/submitted
GET  /api/requests/:id
POST /api/requests/new-hire
POST /api/requests/offboarding
POST /api/requests/transfer
POST /api/requests/:id/finalize-new-hire
POST /api/requests/:id/finalize-offboarding

Approvals:
GET  /api/approvals/pending
POST /api/approvals/:approvalId/approve
POST /api/approvals/:approvalId/reject

Admin:
GET /api/admin/pending-actions
GET /api/admin/archived-users
GET /api/admin/audit-logs

Reports:
GET /api/reports/admin/overview
GET /api/reports/area-manager/overview
GET /api/reports/champ/overview
```

## Local Development

SuperNova currently runs in local-only development mode:

```text
Local PostgreSQL
npm workspaces
npm run dev
Prisma migrations against local PostgreSQL
```

Docker is not part of the current repo or daily development workflow.

1. Install Node.js/npm.

Use a current Node.js version compatible with the repo package manager.

2. Install PostgreSQL locally on Windows.

Create a local database:

```powershell
createdb -U postgres -h localhost -p 5432 supernova
```

If the database already exists, keep it.

3. Copy environment files.

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

Configure local values:

```text
DATABASE_URL="postgresql://postgres:<LOCAL_PASSWORD>@localhost:5432/supernova"
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
JWT_SECRET=<long local-only random secret>
JWT_EXPIRES_IN=8h
AUTH_COOKIE_NAME=supernova_session
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Never commit local `.env` files or secrets.

Planned backend-only HR Sync environment variables, not active until backend integration:

```text
HR_SYNC_ENABLED=true|false
HR_SYNC_WEB_APP_URL=https://script.google.com/macros/s/.../exec
HR_SYNC_SECRET=<long random secret>
```

These values belong only in backend configuration such as `apps/api/.env`. Do not put the Web App URL or secret in frontend environment variables.

4. Install dependencies.

```powershell
npm install
```

5. Run Prisma.

```powershell
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
```

6. Seed local development data.

```powershell
npm run db:seed
```

7. Start the apps.

```powershell
npm run dev
```

Expected:

```text
Web: http://localhost:3000
API: http://localhost:4000
Health: http://localhost:4000/api/health
Login: http://localhost:3000/login
```

## Documentation Map

- [Agent Rules](./AGENTS.md)
- [Repo Index](./docs/REPO_INDEX.md)
- [Project Operating System](./docs/00_PROJECT_OPERATING_SYSTEM.md)
- [Product Rules](./docs/01_PRODUCT_RULES.md)
- [Workflow Rules](./docs/02_WORKFLOW_RULES.md)
- [Architecture Rules](./docs/03_ARCHITECTURE_RULES.md)
- [Data Model Rules](./docs/04_DATA_MODEL_RULES.md)
- [Security and Privacy Rules](./docs/05_SECURITY_AND_PRIVACY_RULES.md)
- [UI/UX System](./docs/06_UI_UX_SYSTEM.md)
- [Verification and Testing](./docs/07_VERIFICATION_AND_TESTING.md)
- [Access Control History](./docs/access-control/README.md)
- [HR Google Sheets Sync Plan](./docs/integrations/HR_GOOGLE_SHEETS_SYNC_PLAN.md)
- [Documentation Cleanup Report](./docs/DOCS_CLEANUP_REPORT.md)

## Current Known Technical Debt

- `requests.service.ts` is large and should be split carefully later.
- Automated tests are limited.
- Production deployment strategy is not finalized.
- Next/PostCSS moderate audit warnings may remain until safe dependency updates are available.
- UI/UX needs page-by-page redesign.
- HR Google Sheets Sync is planned but not implemented.
