@echo off
setlocal

REM Temporarily disables all SmartShelter watchdog tasks (BIT/Client + MediaMTX)
REM so the app/mediamtx won't auto-relaunch while you do PC maintenance.
REM Run watchdog-resume.bat when you're done.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator rights required. Right-click -^> Run as administrator.
    pause
    exit /b 1
)

echo Disabling SmartShelter watchdog tasks...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$t = Get-ScheduledTask -TaskName 'SmartShelter-*' -ErrorAction SilentlyContinue; if ($t) { $t | Disable-ScheduledTask | Out-Null; $t.TaskName } else { Write-Host 'No SmartShelter watchdog tasks found.' }"

echo.
echo Done. Run watchdog-resume.bat to turn watchdog back on.
pause
