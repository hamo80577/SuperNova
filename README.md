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

5. Start the apps.

```powershell
npm run dev
```

Expected local endpoints:

```text
Web: http://localhost:3000
API health: http://localhost:4000/api/health
```

## Phase 0 Notes

- `apps/web` is a professional placeholder shell only. No dashboards or role workspace implementation yet.
- `apps/api` exposes foundation modules plus `GET /api/health`. No auth flows or request workflow logic are implemented yet.
- `prisma/schema.prisma` defines the core data model and indexes for future assignment, request, and approval work.
- Partial unique indexes for “one active assignment” rules are documented for later SQL migrations because Prisma cannot model them directly in schema syntax.

## Reference Docs

- [AGENTS.md](/C:/Users/hp/Desktop/SuperNova/AGENTS.md)
- [IMPLEMENTATION_PHASES.md](/C:/Users/hp/Desktop/SuperNova/IMPLEMENTATION_PHASES.md)
- [Architecture](/C:/Users/hp/Desktop/SuperNova/docs/ARCHITECTURE.md)
- [Data Model](/C:/Users/hp/Desktop/SuperNova/docs/DATA_MODEL.md)
- [Workflows](/C:/Users/hp/Desktop/SuperNova/docs/WORKFLOWS.md)
