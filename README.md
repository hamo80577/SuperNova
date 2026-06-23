# SuperNova

SuperNova is a Talabat-style Partner Workforce Operations System.

It manages real partner workforce operations through:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a generic HR ERP.

## Current Status

Current mode: official product development and production hardening.

The product foundation is mostly built. Future work should harden, polish, and extend the official product in small scoped slices. Do not revive old one-off plans or broad branches as product authority.

## Core Workflows

- Authentication and protected role workspaces.
- Organization setup for Chains and Vendors/Branches.
- Users and operational profiles.
- Assignment source-of-truth records.
- New Hire workflow.
- Picker Profile Completion.
- Resignation / Offboarding workflow.
- Transfer workflow.
- Requests and Approvals.
- Notifications and audit logs.
- Reports and admin controls.
- Access-control foundation.

## Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: Modular monolith
Deployment: Docker Compose / VPS when deployment work is requested
```

Do not introduce microservices unless the product owner explicitly approves that architecture change.

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
  scripts/
  AGENTS.md
  README.md
```

## Local Development

Typical local setup:

```powershell
npm install
docker compose up -d
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

Windows convenience runner:

```powershell
.\Start-SuperNova.bat
```

The runner performs local checks, starts the dev process tree, and writes logs under `logs/`. It does not replace source documentation or committed environment examples.

## Documentation

- [Agent Rules](./AGENTS.md)
- [Product Brief](./docs/00_PRODUCT_BRIEF.md)
- [Domain and Workflows](./docs/01_DOMAIN_AND_WORKFLOWS.md)
- [Architecture and Data](./docs/02_ARCHITECTURE_AND_DATA.md)
- [Access Control and Security](./docs/03_ACCESS_CONTROL_AND_SECURITY.md)
- [UI/UX and Design System](./docs/04_UI_UX_AND_DESIGN_SYSTEM.md)
- [Agent Workflow](./docs/05_AGENT_WORKFLOW.md)
- [Current Status and Roadmap](./docs/06_CURRENT_STATUS_AND_ROADMAP.md)
- [Repo Index](./docs/REPO_INDEX.md)

## Safety

Never commit local `.env` files, real tokens, real passwords, temporary passwords in notifications, password hashes, JWT secrets, or database dumps with personal data.
