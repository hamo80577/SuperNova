Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Line = "=" * 60
$WebUrl = "http://localhost:3000"
$ApiUrl = "http://localhost:4000"
$HealthUrl = "$ApiUrl/api/health"
$LoginUrl = "$WebUrl/login"
$script:RunnerErrorPrinted = $false
$NpmCommand = "npm.cmd"

function Write-Section {
  param([Parameter(Mandatory = $true)][string]$Title)

  Write-Host ""
  Write-Host $Line -ForegroundColor DarkGray
  Write-Host "  $Title" -ForegroundColor Cyan
  Write-Host $Line -ForegroundColor DarkGray
}

function Write-Status {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Message,
    [ConsoleColor]$Color = [ConsoleColor]::White
  )

  Write-Host ("[{0}] {1}" -f $Label, $Message) -ForegroundColor $Color
}

function Write-SuperNovaBanner {
  Write-Host ""
  Write-Host "  ____                         _   _                 " -ForegroundColor DarkRed
  Write-Host " / ___| _   _ _ __   ___ _ __ | \ | | _____   ____ _ " -ForegroundColor DarkRed
  Write-Host " \___ \| | | | '_ \ / _ \ '__||  \| |/ _ \ \ / / _` |" -ForegroundColor DarkRed
  Write-Host "  ___) | |_| | |_) |  __/ |   | |\  | (_) \ V / (_| |" -ForegroundColor DarkRed
  Write-Host " |____/ \__,_| .__/ \___|_|   |_| \_|\___/ \_/ \__,_|" -ForegroundColor DarkRed
  Write-Host "             |_|                                      " -ForegroundColor DarkRed
  Write-Host ""
  Write-Host " SuperNova Dev Terminal" -ForegroundColor Cyan
  Write-Host " Professional local control surface for Web + API + Worker + Cache" -ForegroundColor DarkGray
}

function Write-ServiceRow {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Endpoint,
    [Parameter(Mandatory = $true)][string]$Purpose,
    [Parameter(Mandatory = $true)][string]$Status,
    [ConsoleColor]$Color = [ConsoleColor]::White
  )

  Write-Host ("  {0,-12} {1,-28} {2,-42} " -f $Name, $Endpoint, $Purpose) -NoNewline
  Write-Host $Status -ForegroundColor $Color
}

function Write-ServiceMatrix {
  Write-Section "Service Matrix"
  Write-Host ("  {0,-12} {1,-28} {2,-42} {3}" -f "Service", "Endpoint", "Purpose", "Status") -ForegroundColor DarkGray
  Write-Host ("  {0,-12} {1,-28} {2,-42} {3}" -f ("-" * 12), ("-" * 28), ("-" * 42), ("-" * 10)) -ForegroundColor DarkGray
  Write-ServiceRow -Name "Web" -Endpoint $WebUrl -Purpose "Next.js admin/operator UI" -Status "managed by dev" -Color Cyan
  Write-ServiceRow -Name "API" -Endpoint $ApiUrl -Purpose "NestJS backend and REST API" -Status "managed by dev" -Color Cyan
  Write-ServiceRow -Name "Worker" -Endpoint "local process" -Purpose "Excel queues + dashboard cache jobs" -Status "managed by dev" -Color Cyan
  Write-ServiceRow -Name "Postgres" -Endpoint "localhost:5432" -Purpose "Operational database" -Status "preflight checked" -Color Green
  Write-ServiceRow -Name "Redis" -Endpoint "localhost:6379" -Purpose "BullMQ + dashboard cache" -Status "preflight checked" -Color Green
}

function Write-CommandPalette {
  Write-Section "Controls"
  Write-Host "  R  Restart dev process tree" -ForegroundColor White
  Write-Host "  F  Run full checks, then restart" -ForegroundColor White
  Write-Host "  S  Show runtime service status" -ForegroundColor White
  Write-Host "  H  Check API health endpoint" -ForegroundColor White
  Write-Host "  C  Check cache/Redis connectivity" -ForegroundColor White
  Write-Host "  O  Open login page" -ForegroundColor White
  Write-Host "  Q  Stop all managed dev processes" -ForegroundColor White
}

function Stop-Runner {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Status "ERROR" $Message Red
  $script:RunnerErrorPrinted = $true
  throw $Message
}

function Find-RepoRoot {
  $currentPath = if ($PSScriptRoot) {
    Resolve-Path $PSScriptRoot
  }
  else {
    Resolve-Path (Get-Location)
  }

  while ($currentPath) {
    $packageJsonPath = Join-Path $currentPath "package.json"
    $apiPath = Join-Path $currentPath "apps\api"
    $webPath = Join-Path $currentPath "apps\web"

    if (
      (Test-Path -LiteralPath $packageJsonPath) -and
      (Test-Path -LiteralPath $apiPath) -and
      (Test-Path -LiteralPath $webPath)
    ) {
      return $currentPath.Path
    }

    $parent = Split-Path -Path $currentPath -Parent

    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $currentPath) {
      break
    }

    $currentPath = Resolve-Path $parent
  }

  Stop-Runner "Could not detect the SuperNova repo root. Run this script from inside the repository."
}

function Ensure-Directory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Ensure-EnvFile {
  param(
    [Parameter(Mandatory = $true)][string]$ExamplePath,
    [Parameter(Mandatory = $true)][string]$TargetPath,
    [Parameter(Mandatory = $true)][string]$DisplayName
  )

  if (Test-Path -LiteralPath $TargetPath) {
    Write-Status "OK" "$DisplayName already exists" Green
    return
  }

  if (-not (Test-Path -LiteralPath $ExamplePath)) {
    Stop-Runner "Missing env example file: $ExamplePath"
  }

  Copy-Item -LiteralPath $ExamplePath -Destination $TargetPath
  Write-Status "OK" "Created $DisplayName from example" Green
}

function Get-CommandVersion {
  param(
    [Parameter(Mandatory = $true)][string]$CommandName,
    [Parameter(Mandatory = $true)][string]$VersionArgument
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    Stop-Runner "$CommandName is not installed or is not available on PATH."
  }

  $version = & $CommandName $VersionArgument

  if ($LASTEXITCODE -ne 0) {
    Stop-Runner "Could not read $CommandName version."
  }

  return ($version | Select-Object -First 1).ToString().Trim()
}

function Test-TcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$TimeoutMs = 1200
  )

  $client = [System.Net.Sockets.TcpClient]::new()

  try {
    $connection = $client.BeginConnect($HostName, $Port, $null, $null)

    if (-not $connection.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }

    $client.EndConnect($connection)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $client.Close()
  }
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)

  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-PostgreSqlService {
  Get-Service -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "postgresql*" -or $_.DisplayName -like "PostgreSQL*"
    } |
    Sort-Object -Property Status, Name |
    Select-Object -First 1
}

function Get-RedisService {
  Get-Service -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "*redis*" -or
      $_.DisplayName -like "*redis*" -or
      $_.Name -like "*memurai*" -or
      $_.DisplayName -like "*memurai*"
    } |
    Sort-Object -Property Status, Name |
    Select-Object -First 1
}

function Get-RedisExecutable {
  $commandNames = @("redis-server", "memurai.exe", "memurai")

  foreach ($commandName in $commandNames) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue

    if ($command) {
      return $command.Source
    }
  }

  $candidatePaths = @(
    (Join-Path $env:ProgramFiles "Redis\redis-server.exe"),
    (Join-Path $env:ProgramFiles "Memurai\memurai.exe"),
    (Join-Path $env:LOCALAPPDATA "Temp\supernova-open-site\memurai_pkg\tools\memurai.exe")
  )

  foreach ($candidatePath in $candidatePaths) {
    if (Test-Path -LiteralPath $candidatePath) {
      return $candidatePath
    }
  }

  return $null
}

function Wait-ForPostgreSql {
  param([int]$Attempts = 12)

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    if (Test-TcpPort -HostName "localhost" -Port 5432) {
      return $true
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Test-RedisPing {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$TimeoutMs = 1200
  )

  $client = [System.Net.Sockets.TcpClient]::new()

  try {
    $connection = $client.BeginConnect($HostName, $Port, $null, $null)

    if (-not $connection.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }

    $client.EndConnect($connection)
    $stream = $client.GetStream()
    $stream.ReadTimeout = $TimeoutMs
    $stream.WriteTimeout = $TimeoutMs

    $pingBytes = [byte[]](42, 49, 13, 10, 36, 52, 13, 10, 80, 73, 78, 71, 13, 10)
    $stream.Write($pingBytes, 0, $pingBytes.Length)

    $buffer = New-Object byte[] 128
    $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
    $response = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $bytesRead)

    return $response.StartsWith("+PONG")
  }
  catch {
    return $false
  }
  finally {
    $client.Close()
  }
}

function Wait-ForRedis {
  param([int]$Attempts = 12)

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    if (Test-RedisPing -HostName "localhost" -Port 6379) {
      return $true
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Confirm-PostgreSql {
  Write-Section "PostgreSQL"

  if (Test-TcpPort -HostName "localhost" -Port 5432) {
    Write-Status "OK" "PostgreSQL is accepting connections on localhost:5432" Green
    return "Reachable on localhost:5432"
  }

  Write-Status "WARN" "PostgreSQL is not accepting connections on localhost:5432" Yellow
  $service = Get-PostgreSqlService

  if (-not $service) {
    Stop-Runner "No Windows PostgreSQL service was detected. Start PostgreSQL manually and rerun this script."
  }

  Write-Status "INFO" ("Detected Windows service: {0} ({1})" -f $service.Name, $service.Status) Cyan

  if ($service.Status -ne "Running") {
    Write-Status "RUN" ("Starting PostgreSQL service: {0}" -f $service.Name) Cyan

    try {
      Start-Service -Name $service.Name
    }
    catch {
      if (-not (Test-IsAdministrator)) {
        Stop-Runner "PostgreSQL service is stopped, but this PowerShell session is not running as Administrator. Start PostgreSQL from Services or rerun Start-SuperNova.bat as Administrator."
      }

      Stop-Runner "Could not start PostgreSQL service '$($service.Name)': $($_.Exception.Message)"
    }

    if (-not (Wait-ForPostgreSql)) {
      Stop-Runner "PostgreSQL service started, but localhost:5432 is still not reachable. Check PostgreSQL configuration and DATABASE_URL."
    }

    Write-Status "OK" "PostgreSQL started and is accepting connections on localhost:5432" Green
    return "Started service $($service.Name)"
  }

  Stop-Runner "PostgreSQL service is running, but localhost:5432 is not reachable. Check port binding, firewall rules, and DATABASE_URL."
}

function Confirm-Redis {
  Write-Section "Redis"

  if (Test-RedisPing -HostName "localhost" -Port 6379) {
    Write-Status "OK" "Redis-compatible server responded to PING on localhost:6379" Green
    return "Reachable on localhost:6379"
  }

  if (Test-TcpPort -HostName "localhost" -Port 6379) {
    Stop-Runner "Port 6379 is open, but it did not respond to Redis PING. Check REDIS_URL and the local Redis/Memurai process."
  }

  Write-Status "WARN" "Redis is not accepting connections on localhost:6379" Yellow
  $service = Get-RedisService

  if ($service) {
    Write-Status "INFO" ("Detected Windows service: {0} ({1})" -f $service.Name, $service.Status) Cyan

    if ($service.Status -ne "Running") {
      Write-Status "RUN" ("Starting Redis service: {0}" -f $service.Name) Cyan

      try {
        Start-Service -Name $service.Name
      }
      catch {
        if (-not (Test-IsAdministrator)) {
          Stop-Runner "Redis service is stopped, but this PowerShell session is not running as Administrator. Start Redis/Memurai manually or rerun Start-SuperNova.bat as Administrator."
        }

        Stop-Runner "Could not start Redis service '$($service.Name)': $($_.Exception.Message)"
      }
    }

    if (Wait-ForRedis) {
      Write-Status "OK" "Redis service started and responded to PING on localhost:6379" Green
      return "Started service $($service.Name)"
    }

    Stop-Runner "Redis service is running, but localhost:6379 did not respond to PING. Check REDIS_URL and service configuration."
  }

  $redisExecutable = Get-RedisExecutable

  if ($redisExecutable) {
    Write-Status "RUN" ("Starting Redis-compatible executable: {0}" -f $redisExecutable) Cyan
    Start-Process -FilePath $redisExecutable -ArgumentList @("--port", "6379") -WindowStyle Hidden | Out-Null

    if (Wait-ForRedis) {
      Write-Status "OK" "Redis-compatible server started and responded to PING on localhost:6379" Green
      return "Started $redisExecutable"
    }
  }

  Stop-Runner "Redis is required for BullMQ import queues and dashboard cache warming. Start Redis/Memurai on localhost:6379 and rerun Start-SuperNova.bat."
}

function Get-PortStatus {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port
  )

  if (Test-TcpPort -HostName $HostName -Port $Port) {
    return @{
      Color = [ConsoleColor]::Green
      Text = "online"
    }
  }

  return @{
    Color = [ConsoleColor]::Yellow
    Text = "waiting/offline"
  }
}

function Show-SystemStatus {
  Write-Section "Runtime Status"
  Write-Host ("  {0,-12} {1,-28} {2,-42} {3}" -f "Service", "Endpoint", "Purpose", "Status") -ForegroundColor DarkGray
  Write-Host ("  {0,-12} {1,-28} {2,-42} {3}" -f ("-" * 12), ("-" * 28), ("-" * 42), ("-" * 10)) -ForegroundColor DarkGray

  $webStatus = Get-PortStatus -HostName "localhost" -Port 3000
  Write-ServiceRow -Name "Web" -Endpoint $WebUrl -Purpose "Next.js UI" -Status $webStatus.Text -Color $webStatus.Color

  $apiStatus = Get-PortStatus -HostName "localhost" -Port 4000
  Write-ServiceRow -Name "API" -Endpoint $ApiUrl -Purpose "NestJS API" -Status $apiStatus.Text -Color $apiStatus.Color

  $postgresStatus = Get-PortStatus -HostName "localhost" -Port 5432
  Write-ServiceRow -Name "Postgres" -Endpoint "localhost:5432" -Purpose "Database" -Status $postgresStatus.Text -Color $postgresStatus.Color

  if (Test-RedisPing -HostName "localhost" -Port 6379) {
    Write-ServiceRow -Name "Redis" -Endpoint "localhost:6379" -Purpose "BullMQ + cache" -Status "PONG" -Color Green
  }
  else {
    Write-ServiceRow -Name "Redis" -Endpoint "localhost:6379" -Purpose "BullMQ + cache" -Status "not responding" -Color Red
  }

  Write-Host ""
}

function Invoke-ApiHealthCheck {
  Write-Section "API Health"

  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 4
    Write-Status "OK" ("{0} responded with HTTP {1}" -f $HealthUrl, $response.StatusCode) Green
  }
  catch {
    Write-Status "WARN" ("{0} is not healthy yet: {1}" -f $HealthUrl, $_.Exception.Message) Yellow
  }
}

function Invoke-CacheStatusCheck {
  Write-Section "Cache / Queue Backend"

  if (Test-RedisPing -HostName "localhost" -Port 6379) {
    Write-Status "OK" "Redis-compatible server responded to PING. BullMQ queues and dashboard cache can use localhost:6379." Green
    return
  }

  Write-Status "ERROR" "Redis did not respond to PING on localhost:6379. Imports and dashboard cache jobs will not run correctly." Red
}

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptName,
    [Parameter(Mandatory = $true)][string]$CompletionMessage
  )

  Write-Status "RUN" "npm run $ScriptName" Cyan
  & $NpmCommand run $ScriptName

  if ($LASTEXITCODE -ne 0) {
    Stop-Runner "npm run $ScriptName failed. Fix the error above, then rerun Start-SuperNova.bat."
  }

  Write-Status "OK" $CompletionMessage Green
}

function Invoke-StartupChecks {
  Write-Section "Startup Checks"
  Invoke-NpmScript -ScriptName "prisma:validate" -CompletionMessage "Prisma validate completed"
  Invoke-NpmScript -ScriptName "prisma:generate" -CompletionMessage "Prisma generate completed"
}

function Invoke-RequiredChecks {
  Write-Section "Full Checks"
  Invoke-NpmScript -ScriptName "prisma:validate" -CompletionMessage "Prisma validate completed"
  Invoke-NpmScript -ScriptName "prisma:generate" -CompletionMessage "Prisma generate completed"
  Invoke-NpmScript -ScriptName "typecheck" -CompletionMessage "Typecheck completed"
  Invoke-NpmScript -ScriptName "lint" -CompletionMessage "Lint completed"
  Invoke-NpmScript -ScriptName "build" -CompletionMessage "Build completed"
}

function Start-LoginOpener {
  param([Parameter(Mandatory = $true)][string]$Url)

  Start-Job -Name "OpenSuperNovaLogin" -ScriptBlock {
    param([string]$TargetUrl)

    for ($attempt = 1; $attempt -le 60; $attempt += 1) {
      try {
        Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
        Start-Process $TargetUrl
        break
      }
      catch {
        Start-Sleep -Seconds 2
      }
    }
  } -ArgumentList $Url | Out-Null
}

function Start-DevProcess {
  Write-Section "Development Servers"
  Write-Status "RUN" "npm run dev" Cyan
  Write-Status "INFO" "Starts Web, API, and API worker for Excel queues + dashboard cache warming." Cyan
  Write-Status "INFO" "Hot reload is active for normal Web/API/worker code changes." Cyan
  Write-CommandPalette
  Start-LoginOpener -Url $LoginUrl

  return Start-Process `
    -FilePath $NpmCommand `
    -ArgumentList @("run", "dev") `
    -NoNewWindow `
    -PassThru `
    -WorkingDirectory $repoRoot
}

function Stop-DevProcess {
  param([Parameter(Mandatory = $true)]$Process)

  if ($Process.HasExited) {
    return
  }

  Write-Status "STOP" "Stopping npm run dev process tree..." Yellow
  & taskkill.exe /PID $Process.Id /T /F | Out-Host
  $Process.WaitForExit(10000) | Out-Null
}

function Read-DevControlCommand {
  if (-not [Console]::KeyAvailable) {
    return $null
  }

  $key = [Console]::ReadKey($true)
  return $key.KeyChar.ToString().ToUpperInvariant()
}

function Start-DevControlLoop {
  $devProcess = Start-DevProcess

  while ($true) {
    if ($devProcess.HasExited) {
      Write-Status "WARN" "npm run dev exited with code $($devProcess.ExitCode)." Yellow
      Write-Host ""
      Write-Host "[R] Restart    [F] Full checks    [S] Status    [H] Health    [C] Cache    [O] Login    [Q] Quit"
      $choice = Read-Host "Choose"
      $command = $choice.Trim().ToUpperInvariant()
    }
    else {
      $command = Read-DevControlCommand

      if (-not $command) {
        Start-Sleep -Milliseconds 250
        continue
      }
    }

    switch ($command) {
      "R" {
        Stop-DevProcess -Process $devProcess
        $devProcess = Start-DevProcess
      }
      "F" {
        Stop-DevProcess -Process $devProcess
        Confirm-PostgreSql | Out-Null
        Confirm-Redis | Out-Null
        Invoke-RequiredChecks
        $devProcess = Start-DevProcess
      }
      "O" {
        Write-Status "OPEN" "Opening http://localhost:3000/login" Cyan
        Start-Process $LoginUrl
      }
      "S" {
        Show-SystemStatus
      }
      "H" {
        Invoke-ApiHealthCheck
      }
      "C" {
        Invoke-CacheStatusCheck
      }
      "Q" {
        Stop-DevProcess -Process $devProcess
        Write-Status "OK" "SuperNova dev runner stopped." Green
        return 0
      }
      default {
        Write-Status "INFO" "Use R, F, S, H, C, O, or Q." Cyan
      }
    }
  }
}

$repoRoot = Find-RepoRoot
$logsPath = Join-Path $repoRoot "logs"
Ensure-Directory $logsPath

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFilePath = Join-Path $logsPath "supernova-dev-$timestamp.log"
$transcriptStarted = $false
$exitCode = 0

try {
  Start-Transcript -Path $logFilePath -Append | Out-Null
  $transcriptStarted = $true

  Set-Location $repoRoot

  Write-SuperNovaBanner
  Write-Section "SuperNova Dev Runner"
  Write-Status "OK" "Repo detected" Green
  Write-Host ("Repo: {0}" -f $repoRoot)
  Write-Host ("Log:  {0}" -f $logFilePath)

  Write-Section "Environment Files"
  Ensure-EnvFile `
    -ExamplePath (Join-Path $repoRoot ".env.example") `
    -TargetPath (Join-Path $repoRoot ".env") `
    -DisplayName ".env"
  Ensure-EnvFile `
    -ExamplePath (Join-Path $repoRoot "apps\api\.env.example") `
    -TargetPath (Join-Path $repoRoot "apps\api\.env") `
    -DisplayName "apps\api\.env"
  Ensure-EnvFile `
    -ExamplePath (Join-Path $repoRoot "apps\web\.env.example") `
    -TargetPath (Join-Path $repoRoot "apps\web\.env.local") `
    -DisplayName "apps\web\.env.local"

  Write-Section "Tooling"
  $nodeVersion = Get-CommandVersion -CommandName "node" -VersionArgument "--version"
  Write-Status "OK" "Node version: $nodeVersion" Green

  $npmVersion = Get-CommandVersion -CommandName $NpmCommand -VersionArgument "--version"
  Write-Status "OK" "npm version: $npmVersion" Green

  $postgresStatus = Confirm-PostgreSql
  Write-Host ("PostgreSQL status: {0}" -f $postgresStatus)
  $redisStatus = Confirm-Redis
  Write-Host ("Redis status:      {0}" -f $redisStatus)

  Write-ServiceMatrix

  Write-Section "Links"
  Write-Host "Web:    http://localhost:3000"
  Write-Host "API:    http://localhost:4000"
  Write-Host "Health: http://localhost:4000/api/health"
  Write-Host "Login:  http://localhost:3000/login"

  Invoke-StartupChecks
  $exitCode = Start-DevControlLoop
}
catch {
  if (-not $script:RunnerErrorPrinted) {
    Write-Status "ERROR" $_.Exception.Message Red
  }

  $exitCode = if ($exitCode -ne 0) { $exitCode } else { 1 }
}
finally {
  if ($transcriptStarted) {
    Write-Host ""
    Write-Host ("Log saved to: {0}" -f $logFilePath)
    Stop-Transcript | Out-Null
  }
}

exit $exitCode
