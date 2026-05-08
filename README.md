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
Picker Workspace: http://localhost:3000/picker/dashboard
Champ Workspace: http://localhost:3000/champ/dashboard
Area Manager Workspace: http://localhost:3000/area-manager/dashboard
```

## Phase Notes

- `apps/web` includes auth screens, Phase 2 admin organization pages, Phase 3 admin assignment setup, and Phase 4 role-scoped workspace dashboards.
- `apps/api` exposes foundation modules, `GET /api/health`, Phase 1 auth endpoints, Phase 2 Chains/Vendors endpoints, Phase 3 assignment hierarchy endpoints, and Phase 4 workspace endpoints.
- `prisma/schema.prisma` defines the core data model and indexes for future assignment, request, and approval work.
- Partial unique indexes for "one active assignment" rules are implemented in SQL migrations because Prisma cannot model them directly in schema syntax.
- Request, approval, transfer, resignation, termination, and New Hire workflows are not implemented in Phase 4.

## Auth Endpoints

```text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/change-password
GET /api/auth/me
GET /api/users/me
```

Browser auth uses an HTTP-only JWT cookie. Bearer tokens are accepted by the backend guard for API testing.

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

Assignment setup preserves history. Creating a new active assignment rejects if the target Picker, Vendor, or Chain already has an active assignment. Transfer and New Hire automation remain later workflow phases.

Optional local verification data:

```text
SEED_DEMO_ASSIGNMENT_USERS=true
SEED_DEMO_PASSWORD=
```

The demo assignment users are local/dev only and do not implement Picker creation CRUD.

## Workspace Endpoints

Role-specific workspace endpoints are read-only and scoped by the authenticated user:

```text
GET /api/workspaces/picker
GET /api/workspaces/champ
GET /api/workspaces/area-manager
GET /api/workspaces/admin
```

These endpoints derive visibility from assignment tables. They do not implement request creation, approval decisions, New Hire, Transfer, or Resignation/Termination workflows.

## Reference Docs

- [AGENTS.md](./AGENTS.md)
- [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Workflows](./docs/WORKFLOWS.md)
