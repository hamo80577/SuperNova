# SuperNova

SuperNova is a Talabat-style Partner Workforce Operations System.

It manages partner workforce operations through:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a generic HR ERP.

## Current Status

The MVP workflow foundation exists, but the project is now in planning reset mode for the next workstream.

A previous branch/workstream result was rejected and must not be merged or continued blindly.

Current goal:

```text
Re-plan the next product direction from a clean main-based branch before implementation.
```

No new large module should be implemented until the plan is re-approved.

## Current Baseline

Implemented product areas include:

- Authentication and protected role workspaces.
- Chains and Vendors/Branches.
- Picker, Champ, and Area Manager assignment hierarchy.
- Request and approval engine.
- New Hire workflow.
- Picker Profile Completion workflow.
- Resignation / Offboarding workflow.
- Transfer workflow.
- Admin controls.
- Reports.
- Notifications and audit logs.
- Access-control foundation.

## Product Model

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Important rules:

- Do not store `managerId`, `vendorId`, or `chainId` on `User` as source of truth.
- Operational context comes from assignment tables.
- Sensitive lifecycle actions are workflow-based.
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
Deployment: Docker Compose / VPS when deployment work is requested
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

## Active Planning Rule

Before starting the next workstream:

1. Review the current repo baseline.
2. Define the business problem.
3. Decide whether the next workstream is UI/UX polish, reporting, attendance planning, integration, or another scoped product area.
4. Write a short plan.
5. Execute one small phase/page/module at a time.

Do not restart old implementation phases automatically.

## Local Development

Typical local flow:

```powershell
npm install
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Expected local URLs:

```text
Web: http://localhost:3000
API: http://localhost:4000
Health: http://localhost:4000/api/health
Login: http://localhost:3000/login
```

Never commit local `.env` files or secrets.

## Documentation Map

- [Agent Rules](./AGENTS.md)
- [Repo Index](./docs/REPO_INDEX.md)
- [Project Operating System](./docs/00_PROJECT_OPERATING_SYSTEM.md)
- [Planning Reset](./docs/PLANNING_RESET.md)

## Known Technical Debt

- Some large services should be split carefully later.
- Automated test coverage is limited.
- Production deployment strategy is not finalized.
- UI/UX still needs page-by-page production polish.
- The next workstream must be re-planned before implementation.
