# Deployment Runbook — SuperNova

## Purpose

This file is the practical runbook for the current local development mode and the future production deployment pass.

## Current Deployment Posture

SuperNova is local-only for the current development stage.

Current mode:

```text
Local PostgreSQL
npm workspaces
Prisma migrations against local PostgreSQL
npm run dev
```

Production deployment strategy will be revisited later. A future deployment pass may choose Docker again, PM2, systemd, managed hosting, or another VPS strategy. Do not invent or assume the final production strategy during normal feature/UI work.

## Local Development

### 1. Install dependencies

```powershell
npm install
```

### 2. Install PostgreSQL locally

Install PostgreSQL on Windows and make sure `psql` is available.

Create the local database if it does not exist:

```powershell
createdb -U postgres -h localhost -p 5432 supernova
```

Use:

```text
database: supernova
host: localhost
port: 5432
```

### 3. Prepare environment

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

Set at minimum:

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

### 4. Prisma

```powershell
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
```

### 5. Seed

```powershell
npm run db:seed
```

Optional demo data can be controlled through existing seed environment variables.

### 6. Start development apps

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

## Local Database Reset

Use carefully. This removes local development data from the local PostgreSQL database.

```powershell
npm run prisma:migrate
npm run db:seed
```

If a destructive local reset is needed, perform it explicitly with PostgreSQL tools after confirming the target database is `supernova`.

## Future Production Deployment

Production deployment is deferred.

Before production launch, make a dedicated deployment decision and document it. The future strategy may use:

```text
PM2
systemd services
managed platform hosting
container-based deployment
another VPS strategy
```

Do not treat any strategy as final until that deployment pass is completed.

## Required Production Environment

Minimum:

```text
NODE_ENV=production
DATABASE_URL=
JWT_SECRET=
WEB_ORIGIN=
NEXT_PUBLIC_API_URL=
AUTH_COOKIE_NAME=
```

Rules:

- `JWT_SECRET` must be long and random.
- `WEB_ORIGIN` must match the browser origin.
- `NEXT_PUBLIC_API_URL` must match the public API origin.
- Never commit production secrets.

## Production Migration

Use:

```powershell
npm run prisma:migrate
```

Do not use `prisma db push` for production.

## Health Verification

API:

```text
GET /api/health
```

Web:

```text
GET /login
```

Manual smoke:

- Super Admin login.
- Admin dashboard.
- Champ branch workspace.
- Area Manager approvals.
- Picker dashboard.

## Backup Notes

Before production launch, define:

- PostgreSQL backup schedule.
- Restore test process.
- VPS snapshot policy.
- `.env` secure backup storage.
- Audit log retention approach.

## Release Checklist

- Clean demo data if needed.
- Seed only approved bootstrap users.
- Confirm no `.env` committed.
- Confirm migrations applied.
- Confirm API health.
- Confirm login.
- Confirm core workflows.
- Confirm production routing strategy.
