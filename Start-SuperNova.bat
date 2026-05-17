@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start-SuperNova.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo SuperNova Dev Runner stopped with exit code %EXIT_CODE%.
)

echo.
pause
exit /b %EXIT_CODE%
