# SuperNova

SuperNova is a Talabat-style Partner Workforce Operations System. The MVP is centered on assignments, request-driven lifecycle changes, approvals, auditability, and role-scoped workspaces. It is not a generic HR ERP.

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
  docker-compose.yml
  AGENTS.md
  IMPLEMENTATION_PHASES.md
  README.md
```

## Product Rules

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
Sensitive lifecycle changes -> Request -> Approval -> Final Action -> System Applies Change
```

Do not use `User.managerId`, `User.chainId`, or `User.vendorId` as source-of-truth fields. Manager and ownership context must come from assignment tables.

Champ operations are Branch-first. A Champ with one assigned Branch works inside
that Branch context; a Champ with multiple Branches may see aggregate dashboard
data, but every mutation/action must start by opening one selected Branch. New
Hire, Transfer, Resignation, and Termination are launched from the selected
Branch context.
User-facing Champ forms must not ask the Champ to manually choose
`sourceChainId` or `sourceVendorId`.

## Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui-compatible structure
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: modular monolith
Deployment: Docker Compose
```

## Local Setup

1. Copy environment examples.

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

Set `JWT_SECRET` to a long random value before starting the API. The API requires it and does not provide a production fallback.

2. Install dependencies.

```powershell
npm install
```

3. Start PostgreSQL with Docker Compose.

```powershell
docker compose up -d postgres
```

4. Generate Prisma client and validate the schema.

```powershell
npm run prisma:generate
npm run prisma:validate
```

5. Optional local admin seed.

Set these in `.env` before running the seed:

```text
SEED_ADMIN_PHONE=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_NAME=SuperNova Admin
```

Then run:

```powershell
npm run db:seed
```

The seed hashes the password and is intended for local development only.

6. Start the apps.

```powershell
npm run dev
```

Expected local endpoints:

```text
Web: http://localhost:3000
API health: http://localhost:4000/api/health
Login: http://localhost:3000/login
Admin Chains: http://localhost:3000/admin/chains
Admin Vendors: http://localhost:3000/admin/vendors
Admin Assignments: http://localhost:3000/admin/assignments
Admin Pending Actions: http://localhost:3000/admin/pending-actions
Admin Archived Users: http://localhost:3000/admin/archived-users
Admin Audit Logs: http://localhost:3000/admin/audit-logs
Admin Settings: http://localhost:3000/admin/settings
Picker Workspace: http://localhost:3000/picker/dashboard
Picker Profile Completion: http://localhost:3000/picker/profile-completion
Champ Workspace: http://localhost:3000/champ/dashboard
Champ Branches: http://localhost:3000/champ/branches
Branch New Hire: http://localhost:3000/champ/branches/:vendorId/new-hire
Branch Transfer: http://localhost:3000/champ/branches/:vendorId/transfer
Branch Resignation: http://localhost:3000/champ/branches/:vendorId/resignation
Branch Termination: http://localhost:3000/champ/branches/:vendorId/termination
Area Manager Workspace: http://localhost:3000/area-manager/dashboard
Requests: http://localhost:3000/requests
Approvals: http://localhost:3000/approvals
Notifications: http://localhost:3000/notifications
```

## Phase Notes

- `apps/web` includes auth screens, Phase 2 admin organization pages, Phase 3 admin assignment setup, Phase 4 role-scoped workspace dashboards, Phase 5 request/approval pages, Phase 6 Branch-first New Hire submission/finalization surfaces, Phase 7 Picker profile completion, Phase 8 Branch-first Resignation/Termination surfaces, Phase 9 Branch-first Transfer surfaces, and Phase 10 Admin control/audit surfaces.
- `apps/api` exposes foundation modules, `GET /api/health`, Phase 1 auth endpoints, Phase 2 Chains/Vendors endpoints, Phase 3 assignment hierarchy endpoints, Phase 4 workspace endpoints, Phase 5 request/approval/notification endpoints, Phase 6 New Hire workflow endpoints, Phase 7 Picker profile completion endpoints, Phase 8 Offboarding workflow endpoints, Phase 9 Transfer workflow endpoints, and Phase 10 Admin control endpoints.
- `prisma/schema.prisma` defines the core data model and indexes for future assignment, request, and approval work.
- Partial unique indexes for "one active assignment" rules are implemented in SQL migrations because Prisma cannot model them directly in schema syntax.
- New Hire is implemented as a Branch-first workflow in Phase 6. Phase 7 lets the created Picker complete safe profile fields after forced password change. Phase 8 implements Branch-first Resignation/Termination finalization. Phase 9 implements Branch-first Transfer execution.

## Auth Endpoints

```text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/change-password
GET /api/auth/me
GET /api/users/me
GET /api/users/me/profile-completion
PATCH /api/users/me/profile-completion
```

Browser auth uses an HTTP-only JWT cookie. Bearer tokens are accepted by the backend guard for API testing.

Picker profile completion is PICKER-only. It accepts only safe self-service fields
(`nameEn`, `nameAr`, `nationalId`, `address`, `dateOfBirth`, `gender`,
`joiningDate`) and cannot change role, account status, employment status,
Shopper ID, passwords, assignments, or lifecycle state.

## Organization Endpoints

Admin and Super Admin only:

```text
GET /api/chains
GET /api/chains/:id
POST /api/chains
PATCH /api/chains/:id
GET /api/vendors
GET /api/vendors/:id
POST /api/vendors
PATCH /api/vendors/:id
```

Chains and Vendors support pagination, search, and status filters. Vendors must belong to an existing Chain.

## Assignment Endpoints

Admin and Super Admin only:

```text
GET /api/assignments/picker/:pickerId/current
GET /api/assignments/vendor/:vendorId/champ/current
GET /api/assignments/chain/:chainId/area-manager/current
GET /api/assignments/pickers
GET /api/assignments/vendor-champs
GET /api/assignments/chain-area-managers
POST /api/assignments/picker-branch
POST /api/assignments/vendor-champ
POST /api/assignments/chain-area-manager
PATCH /api/assignments/picker-branch/:id/close
PATCH /api/assignments/vendor-champ/:id/close
PATCH /api/assignments/chain-area-manager/:id/close
```

Assignment setup preserves history. Creating a new active assignment rejects if the target Picker, Vendor, or Chain already has an active assignment. New Hire creates the initial Picker Branch assignment through the Phase 6 workflow; Transfer automation closes the old Picker Branch assignment and creates a new active assignment only through the Phase 9 workflow.

Optional local verification data:

```text
SEED_DEMO_ASSIGNMENT_USERS=true
SEED_DEMO_PASSWORD=
```

The demo assignment users are local/dev only. When enabled, the seed also creates
a local demo Chain, Branch, Champ assignment, and Area Manager assignment for
workflow verification. This does not implement production Picker creation CRUD.

## Workspace Endpoints

Role-specific workspace endpoints are read-only and scoped by the authenticated user:

```text
GET /api/workspaces/picker
GET /api/workspaces/champ
GET /api/workspaces/champ/branches
GET /api/workspaces/champ/branches/:vendorId
GET /api/workspaces/area-manager
GET /api/workspaces/admin
```

These endpoints derive visibility from assignment tables. They do not implement request creation, approval decisions, or lifecycle finalization; workflow mutations live in the Requests and Approvals modules.

The Champ Branch endpoints are CHAMP-only and enforce active
`VendorChampAssignment` scope in the backend. `/champ/dashboard` may aggregate
assigned Branch totals, while `/champ/branches/:vendorId` is the selected Branch
context for Champ lifecycle actions. Workflow forms launch from that selected
Branch route and derive source Vendor/Chain context from it.

## Request and Approval Endpoints

Authenticated users:

```text
GET /api/requests
GET /api/requests/my/submitted
GET /api/requests/:id
POST /api/requests
POST /api/requests/new-hire
POST /api/requests/offboarding
POST /api/requests/transfer
POST /api/requests/:id/submit
POST /api/requests/:id/cancel
POST /api/requests/:id/finalize-new-hire
POST /api/requests/:id/finalize-offboarding
GET /api/approvals/pending
POST /api/approvals/:approvalId/approve
POST /api/approvals/:approvalId/reject
GET /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

Generic approval completion moves non-finalized request records to `APPROVED`,
not `COMPLETED`. New Hire and Offboarding have workflow-specific Admin
finalization endpoints.
New Hire requires Shopper ID, creates the Picker, creates the source Branch
assignment, notifies the Champ with the temporary password, and marks the
request `COMPLETED`. Offboarding requires block status and deactivation
confirmation, archives the Picker account, closes the active Branch assignment,
notifies the Champ, and marks the request `COMPLETED`. Transfer uses
workflow-specific Branch-first request creation and applies the assignment move
automatically after the required Area Manager approvals; same-chain Transfer
requires source Chain Area Manager approval only, while cross-chain Transfer
requires source and destination Chain Area Manager approvals.

The generic request creation UI is Admin/Super Admin-only and exists for internal
Phase 5 request engine testing. Real workflow-specific forms for Champs and other
roles are implemented from the correct Branch context. New Hire starts at
`/champ/branches/:vendorId/new-hire`; Transfer starts at
`/champ/branches/:vendorId/transfer`; Resignation and Termination start at
`/champ/branches/:vendorId/resignation` and
`/champ/branches/:vendorId/termination`. Champ-facing workflow forms do not ask
for `sourceChainId` or `sourceVendorId`.

## Admin Control Endpoints

Admin and Super Admin only:

```text
GET /api/admin/pending-actions
GET /api/admin/archived-users
GET /api/admin/audit-logs
```

Phase 10 Admin controls are visibility and final-action navigation surfaces only.
They expose pending final actions, archived/deactivated users with block context,
and paginated audit logs. They do not add direct Picker creation, archive,
transfer, or assignment-edit bypasses.

## Reference Docs

- [AGENTS.md](./AGENTS.md)
- [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Workflows](./docs/WORKFLOWS.md)
