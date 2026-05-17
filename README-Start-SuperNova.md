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

## Fix PostgreSQL Not Running

`npm run dev` does not start PostgreSQL by itself. PostgreSQL must already be installed and reachable on `localhost:5432`.

If the runner says PostgreSQL is not reachable:

1. Open Windows Services.
2. Find the PostgreSQL service, usually named like `postgresql-x64-16`.
3. Start the service.
4. Rerun `Start-SuperNova.bat`.

If the runner detects the service but cannot start it because PowerShell is not running as Administrator, either start PostgreSQL from Windows Services or right-click `Start-SuperNova.bat` and choose `Run as administrator`.

Also confirm that `DATABASE_URL` points to the expected local database:

```text
postgresql://postgres:postgres@localhost:5432/supernova
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
