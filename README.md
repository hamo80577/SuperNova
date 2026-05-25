# SuperNova

SuperNova is a Talabat-style Partner Workforce Operations System.

It manages partner workforce operations through:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a generic HR ERP.

## Current Product State

The core product is a modular monolith for operational workforce lifecycle management.

Implemented core areas include:

- Authentication, roles, and protected workspaces.
- Access Control V1 backend-complete foundation.
- Chains and Vendors/Branches.
- Picker, Champ, and Area Manager assignment hierarchy.
- Request and approval engine.
- Branch-first New Hire workflow.
- Picker Profile Completion workflow.
- Branch-first Resignation workflow.
- Branch-first Transfer workflow.
- Admin controls for pending final actions, archived users, and audit logs.
- Operational reports for Admin, Area Manager, and Champ.
- Notifications and audit logging.

Approved current workstream:

```text
Attendance Analytics + Super Admin Attendance Data Operations
```

Attendance implementation stays within the approved analytics/import/reporting scope and must not add payroll, GPS, live tracking, biometrics, order integration, inventory, accounting, or generic ERP behavior.

HR Google Sheets Sync remains a separate scoped lifecycle reporting integration. It must not own attendance behavior.

## Product Model

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Important rules:

- Do not store `managerId`, `vendorId`, or `chainId` on `User` as source of truth.
- Operational context is derived from assignment tables.
- Lifecycle actions are workflow-based.
- No direct manual Picker creation, transfer, archive, or active assignment change unless explicitly approved.

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
Deployment target: Docker Compose / VPS when deployment work is explicitly requested
Current dev mode: Local PostgreSQL + npm workspaces
```

Do not introduce microservices.

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
  /champ/reports/attendance

Area Manager:
  /area-manager/dashboard
  /area-manager/reports
  /area-manager/reports/attendance
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
  /admin/reports/attendance
  /admin/settings
  /super-admin/attendance-operations
  /super-admin/attendance-operations/upload
  /super-admin/attendance-operations/history
  /super-admin/attendance-operations/maintenance
  /super-admin/attendance-operations/rules
```

Resignation is the only offboarding lifecycle in the active product scope.

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
GET /api/reports/attendance/months
GET /api/reports/attendance/overview
GET /api/reports/attendance/chains
GET /api/reports/attendance/branches
GET /api/reports/attendance/users
GET /api/reports/attendance/users/:userId/daily
GET /api/reports/attendance/area-manager/months
GET /api/reports/attendance/area-manager/overview
GET /api/reports/attendance/area-manager/chains
GET /api/reports/attendance/area-manager/branches
GET /api/reports/attendance/area-manager/users
GET /api/reports/attendance/area-manager/users/:userId/daily
GET /api/reports/attendance/champ/months
GET /api/reports/attendance/champ/overview
GET /api/reports/attendance/champ/branches
GET /api/reports/attendance/champ/users
GET /api/reports/attendance/champ/users/:userId/daily

Attendance Operations:
POST /api/attendance-operations/imports
GET  /api/attendance-operations/imports
GET  /api/attendance-operations/imports/:id
GET  /api/attendance-operations/imports/:id/issues
GET  /api/attendance-operations/imports/:id/sample-users
POST /api/attendance-operations/historical-assignments/preview
POST /api/attendance-operations/historical-assignments/confirm
GET  /api/attendance-operations/maintenance/months
POST /api/attendance-operations/maintenance/preview
POST /api/attendance-operations/maintenance/delete-range
POST /api/attendance-operations/maintenance/delete-month
POST /api/attendance-operations/maintenance/delete-all
POST /api/attendance-operations/maintenance/recalculate
POST /api/attendance-operations/maintenance/compress-old-months
```

## Local Development

SuperNova currently runs in local-only development mode:

```text
Local PostgreSQL
npm workspaces
npm run dev
Prisma migrations against local PostgreSQL
```

Docker Compose is the deployment target when deployment work is explicitly requested, but it is not part of the current daily local development workflow.

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

Backend-only HR Sync environment variables, when that integration is enabled:

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

Current product docs:

- [Agent Rules](./AGENTS.md)
- [Current Product State](./docs/CURRENT_PRODUCT_STATE.md)
- [Product Scope and Guardrails](./docs/PRODUCT_SCOPE_AND_GUARDRAILS.md)
- [Domain Model and Assignments](./docs/DOMAIN_MODEL_AND_ASSIGNMENTS.md)
- [Workflows and Approval Rules](./docs/WORKFLOWS_AND_APPROVAL_RULES.md)
- [Access Control and Permissions](./docs/ACCESS_CONTROL_AND_PERMISSIONS.md)
- [Reports and Role Workspaces](./docs/REPORTS_AND_ROLE_WORKSPACES.md)
- [UI/UX Direction](./docs/UI_UX_DIRECTION.md)
- [UI/UX Component Rules](./docs/UI_UX_COMPONENT_RULES.md)
- [Codex Workflow Rules](./docs/CODEX_WORKFLOW_RULES.md)

Attendance Analytics docs:

- [Attendance Module Spec](./docs/ATTENDANCE_MODULE_SPEC.md)
- [Attendance Data Model](./docs/ATTENDANCE_DATA_MODEL.md)
- [Attendance Operations UI](./docs/ATTENDANCE_OPERATIONS_UI.md)
- [Attendance Calculation Rules](./docs/ATTENDANCE_CALCULATION_RULES.md)
- [Attendance Implementation Plan](./docs/ATTENDANCE_IMPLEMENTATION_PLAN.md)
- [Attendance Release Checklist](./docs/ATTENDANCE_RELEASE_CHECKLIST.md)

Historical and support docs:

- [Repo Index](./docs/REPO_INDEX.md)
- [Access Control History](./docs/access-control/README.md)
- [HR Google Sheets Sync Plan](./docs/integrations/HR_GOOGLE_SHEETS_SYNC_PLAN.md)
- [Pre-Attendance Analytics Archive](./docs/archive/pre-attendance-analytics/ARCHIVE_NOTE.md)
- [Local Dev Runner](./README-Start-SuperNova.md)

## Current Known Technical Debt

- `requests.service.ts` is large and should be split carefully later.
- Automated tests are limited.
- Production deployment strategy is not finalized.
- Next/PostCSS moderate audit warnings may remain until safe dependency updates are available.
- UI/UX needs page-by-page redesign.
- `apps/api/src/attendance/attendance-operations.service.ts` and `apps/api/src/reports/reports.service.ts` are large and should be split only with dedicated regression coverage.
