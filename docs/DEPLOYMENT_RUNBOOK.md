# Deployment Runbook — SuperNova

## Purpose

This file is the practical runbook for local and VPS-style deployment.

## Local Development

### 1. Install dependencies

```powershell
npm install
```

### 2. Prepare environment

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

Set at minimum:

```text
DATABASE_URL=
JWT_SECRET=
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Use a long random `JWT_SECRET`.

### 3. Start PostgreSQL

```powershell
docker compose up -d postgres
docker compose ps
docker compose logs postgres --tail=80
```

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

## Docker App Profile

```powershell
docker compose --profile app build --progress=plain
docker compose --profile app up -d --force-recreate api web
docker compose ps
```

Health checks:

```powershell
curl http://localhost:4000/api/health
curl -I http://localhost:3000/login
```

## Database Reset for Local Development

Use carefully. This removes local development data.

```powershell
docker compose down -v --remove-orphans
docker compose up -d postgres
npm run prisma:migrate
npm run db:seed
```

Do not run broad destructive Docker prune commands unless you know what will be deleted.

## VPS Deployment Direction

Recommended high-level setup:

```text
Cloudflare / HTTPS reverse proxy
-> Web container
-> API container
-> PostgreSQL container or managed PostgreSQL
```

Startup order:

1. Prepare environment variables.
2. Start PostgreSQL.
3. Run Prisma migrations.
4. Seed only if a controlled bootstrap user is needed.
5. Start API.
6. Start Web.
7. Verify health and login.
8. Put Cloudflare/HTTPS in front.

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
- Confirm Cloudflare/HTTPS routing.
