# SuperNova Repo Index

Use this as a practical map. Prefer direct file inspection with `rg` and targeted reads before editing.

## Root

- `README.md`: Short project overview and local development entrypoint.
- `AGENTS.md`: Required operating rules for AI agents.
- `package.json`: npm workspace scripts.
- `docker-compose.yml`: Local PostgreSQL, Redis, and PgBouncer.
- `Start-SuperNova.bat` / `Start-SuperNova.ps1`: Windows local dev runner.
- `mprocs.yaml`: Optional local process layout for Prisma, API, worker, and web.

## Monorepo

- `apps/web`: Next.js app, app routes, components, API clients, Tailwind config, shadcn-style UI primitives.
- `apps/api`: NestJS app, REST controllers, services, worker entrypoint, background job modules.
- `packages/shared`: Shared package surface.
- `prisma`: Prisma schema, migrations, seed scripts, and data import helpers.
- `scripts`: External helper packages such as HR Google Apps Script.
- `docs`: Official product and engineering documentation.

## Frontend Areas

Auth:

- `apps/web/app/login/page.tsx`
- `apps/web/app/change-password/page.tsx`
- `apps/web/components/auth`
- `apps/web/lib/auth`

Dashboard shell and navigation:

- `apps/web/components/dashboard`
- `apps/web/lib/navigation.ts`
- `apps/web/lib/navigation-loading.ts`

Role workspaces:

- `apps/web/app/picker/dashboard/page.tsx`
- `apps/web/app/champ/dashboard/page.tsx`
- `apps/web/app/champ/branches`
- `apps/web/app/area-manager/dashboard/page.tsx`
- `apps/web/app/admin/dashboard/page.tsx`
- `apps/web/components/workspaces`

Requests and approvals:

- `apps/web/app/requests`
- `apps/web/app/approvals`
- `apps/web/components/requests`
- `apps/web/lib/api/requests.ts`
- `apps/web/lib/api/approvals.ts`

Users and profiles:

- `apps/web/app/users/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/components/users`
- `apps/web/lib/api/users.ts`

Organization and assignments:

- `apps/web/app/admin/organization/page.tsx`
- `apps/web/app/admin/assignments/page.tsx`
- `apps/web/app/admin/chains/page.tsx`
- `apps/web/app/admin/vendors/page.tsx`
- `apps/web/components/admin`
- `apps/web/lib/api/organization.ts`
- `apps/web/lib/api/assignments.ts`

Reports and imports:

- `apps/web/app/admin/reports`
- `apps/web/app/area-manager/reports`
- `apps/web/app/champ/reports`
- `apps/web/app/admin/imports`
- `apps/web/app/admin/attendance/imports`
- `apps/web/components/reports`
- `apps/web/components/attendance`
- `apps/web/components/orders-kpis`
- `apps/web/components/imports`

Notifications, audit, settings, access control:

- `apps/web/app/notifications/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/app/settings`
- `apps/web/app/super-admin/access-control/page.tsx`
- `apps/web/components/notifications`
- `apps/web/components/access-control`

UI primitives:

- `apps/web/components/ui`
- `apps/web/components/sn`
- `apps/web/app/globals.css`
- `apps/web/components.json`
- `apps/web/tailwind.config.ts`

## Backend Areas

Auth:

- `apps/api/src/auth`
- `apps/api/src/config`
- `apps/api/src/common/middleware/request-logger.middleware.ts`

Users:

- `apps/api/src/users`

Workspaces and dashboards:

- `apps/api/src/workspaces`
- `apps/api/src/dashboard-cache`
- `apps/api/src/worker.ts`
- `apps/api/src/worker-app.module.ts`

Organization and assignments:

- `apps/api/src/admin`
- `apps/api/src/chains`
- `apps/api/src/vendors`
- `apps/api/src/assignments`

Requests and workflows:

- `apps/api/src/requests`
- `apps/api/src/requests/workflows`
- `apps/api/src/approvals`

Reports and operational imports:

- `apps/api/src/reports`
- `apps/api/src/attendance`
- `apps/api/src/orders-kpis`
- `apps/api/src/import-jobs`

Notifications and audit:

- `apps/api/src/notifications`
- `apps/api/src/audit`

Access control:

- `apps/api/src/access-control`
- `apps/api/src/access-control/permissions.ts`
- `apps/api/src/access-control/role-permission.matrix.ts`
- `apps/api/src/access-control/access-policy.service.ts`
- `apps/api/src/access-control/permission.guard.ts`
- `apps/api/src/access-control/require-permission.decorator.ts`

HR Sync:

- `apps/api/src/hr-sync`
- `scripts/google-apps-script/hr-sync/Code.gs`
- `scripts/google-apps-script/hr-sync/sample-new-hire.payload.json`
- `scripts/google-apps-script/hr-sync/sample-rehire.payload.json`
- `scripts/google-apps-script/hr-sync/sample-resign.payload.json`

Health:

- `apps/api/src/health`

## Prisma

- `prisma/schema.prisma`: Schema and enums.
- `prisma/migrations`: Migrations.
- `prisma/seed.ts`: Seed script.
- `prisma/import-real-pickers.ts`: Picker import helper.
- `prisma/access-role-seed.ts`: Access-role seed support.
- `prisma/seed-deduction-policy.ts`: Deduction policy seed support.

Core source-of-truth models:

```text
User
Chain
Vendor
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
Request
RequestApproval
Notification
AuditLog
AccessRole
UserAccessRoleAssignment
HrSyncLog
AttendanceImportBatch
AttendanceDailyRecord
AttendancePickerMonthlySummary
OrdersKpiImportBatch
OrdersKpiDailyRecord
OrdersKpiTargetSettings
```

## API Route Groups

Controllers currently expose route groups under:

```text
/api/access-control
/api/admin
/api/assignments
/api/attendance/imports
/api/attendance/reports
/api/audit
/api/auth
/api/chains
/api/deductions
/api/health
/api/notifications
/api/orders-kpis/imports
/api/orders-kpis/reports
/api/orders-kpis/settings
/api/reports
/api/requests
/api/users
/api/vendors
/api/workspaces
```

Verify specific endpoints against `apps/api/src/**/*controller.ts` before documenting or changing contracts.

## Tests

Common focused test locations:

- `apps/api/test`
- `apps/web/**/*.test.ts`
- `apps/web/**/*.test.tsx`

Use nearby test style before adding tests. Do not add broad test suites for docs-only changes.

## Commands

Root checks:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Local development:

```powershell
npm install
docker compose up -d
npm run prisma:migrate
npm run db:seed
npm run dev
```

Workspace-specific:

```powershell
npm run dev --workspace @supernova/api
npm run dev:worker --workspace @supernova/api
npm run dev --workspace @supernova/web
npm run typecheck --workspace @supernova/api
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/api
npm run lint --workspace @supernova/web
```

Docs-only verification:

```powershell
git diff --check
git status --short
```

## Local Agent Assets

Tracked reusable agent skills:

- `.agents/skills/supernova-product-architect/SKILL.md`
- `.agents/skills/supernova-ui-ux-pro-max/SKILL.md`
- `.agents/skills/supernova-refactor-debug-review/SKILL.md`
- `.agents/skills/docs-guard/SKILL.md`
- `.agents/skills/test-guard/SKILL.md`
- `.agents/skills/clean-code-guard/SKILL.md`
- `.claude/skills/supernova-product-architect/SKILL.md`
- `.claude/skills/supernova-ui-ux-pro-max/SKILL.md`
- `.claude/skills/supernova-refactor-debug-review/SKILL.md`

These are not the official product docs, but they are useful local agent assets and should not be deleted during normal documentation cleanup.
