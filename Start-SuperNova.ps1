Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Line = "=" * 60
$LoginUrl = "http://localhost:3000/login"
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

function Invoke-RequiredChecks {
  Write-Section "Checks"
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
  Write-Status "INFO" "Hot reload is active for normal Web/API code changes." Cyan
  Write-Status "INFO" "Press R to restart dev, F for full checks + restart, O to open login, or Q to stop." Cyan
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
      Write-Host "[R] Restart dev only    [F] Full checks + restart    [O] Open login    [Q] Quit"
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
        Invoke-RequiredChecks
        $devProcess = Start-DevProcess
      }
      "O" {
        Write-Status "OPEN" "Opening http://localhost:3000/login" Cyan
        Start-Process $LoginUrl
      }
      "Q" {
        Stop-DevProcess -Process $devProcess
        Write-Status "OK" "SuperNova dev runner stopped." Green
        return 0
      }
      default {
        Write-Status "INFO" "Use R, F, O, or Q." Cyan
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

  Write-Section "Links"
  Write-Host "Web:    http://localhost:3000"
  Write-Host "API:    http://localhost:4000"
  Write-Host "Health: http://localhost:4000/api/health"
  Write-Host "Login:  http://localhost:3000/login"

  Invoke-RequiredChecks
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
