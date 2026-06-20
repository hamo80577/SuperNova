# SuperNova Local Dev Runner

Place these files in the SuperNova repo root:

- `Start-SuperNova.bat`
- `Start-SuperNova.ps1`
- `README-Start-SuperNova.md`

## How to Run

Double-click `Start-SuperNova.bat` from Windows Explorer.

You can also run the PowerShell script directly from the repo root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-SuperNova.ps1
```

## What the Runner Does

The runner:

- Detects the SuperNova repo root.
- Creates the `logs\` folder if it is missing.
- Saves terminal output to `logs\supernova-dev-YYYYMMDD-HHMMSS.log`.
- Creates missing env files from examples only when the target file is missing:
  - `.env.example` to `.env`
  - `apps\api\.env.example` to `apps\api\.env`
  - `apps\web\.env.example` to `apps\web\.env.local`
- Expects `docker compose up -d` to have started PostgreSQL, Redis, and PgBouncer.
- Checks Node and npm availability and prints their versions.
- Checks whether PostgreSQL is accepting connections on `localhost:5432`.
- Detects a Windows PostgreSQL service when PostgreSQL is not reachable.
- Tries to start the PostgreSQL service if it exists but is stopped.
- Stops with a clear message if PostgreSQL is still not reachable.
- Runs these commands in order:
  - `npm run prisma:validate`
  - `npm run prisma:generate`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run dev`
- Opens `http://localhost:3000/login` after the web server is ready.
- Keeps a small dev control loop in the same terminal while `npm run dev` is running.

The runner does not hide command output. If a command fails, read the error shown above the runner error line.

## Useful Links

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/api/health`
- Login: `http://localhost:3000/login`

## How to Stop the Dev Servers

While `npm run dev` is running, use the runner controls:

- Press `R` to restart API and Web quickly without rerunning validation/build checks.
- Press `F` to stop dev, rerun the full check sequence, then start dev again.
- Press `O` to open `http://localhost:3000/login` again.
- Press `Q` to stop dev and quit the runner.

When the dev process is already stopped, the same choices are shown as a prompt and you can type the letter then press Enter.

For normal frontend and API code changes, you usually do not need to restart. Next.js and the API watcher reload changes automatically. Use `R` when the browser connection, API process, or dev output gets stuck.

`Ctrl+C` still works as a last-resort terminal interrupt. If Windows asks whether to terminate the batch job, type `Y` and press Enter.

## Fix Database or Queue Infrastructure

`npm run dev` does not start infrastructure containers. Start PostgreSQL, Redis, and PgBouncer from the repository root:

```powershell
docker compose up -d
```

The required local ports are PostgreSQL `5432`, Redis `6379`, and PgBouncer `6432`.

If any service is unavailable, inspect `docker compose ps` and `docker compose logs`, correct the container error, and rerun `docker compose up -d`. A standalone Windows PostgreSQL service is insufficient because imports also require Redis and PgBouncer.

Runtime Prisma traffic must use PgBouncer, while migrations use PostgreSQL directly:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:6432/supernova?pgbouncer=true&connection_limit=100
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/supernova
```

## Reading Logs

Each run writes a log file under `logs\`.

The filename includes the local timestamp, for example:

```text
logs\supernova-dev-20260517-142210.log
```

Open the latest log when you need to review a failed validation, build, or dev-server startup.

## API Request Logging

In non-production mode, the API logs each request after the response finishes. The log includes method, path, final status code, duration, timestamp, IP, and a short user-agent summary.

The logger does not log request bodies, cookies, authorization headers, or passwords.

Optional API flag:

```text
API_REQUEST_LOGGER=true
API_REQUEST_LOGGER=false
```

When `NODE_ENV` is production, request logging stays off unless `API_REQUEST_LOGGER=true` is set.
