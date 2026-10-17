@echo off
setlocal

REM Re-enables all SmartShelter watchdog tasks (BIT/Client + MediaMTX)
REM after PC maintenance done with watchdog-pause.bat.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator rights required. Right-click -^> Run as administrator.
    pause
    exit /b 1
)

echo Enabling SmartShelter watchdog tasks...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$t = Get-ScheduledTask -TaskName 'SmartShelter-*' -ErrorAction SilentlyContinue; if ($t) { $t | Enable-ScheduledTask | Out-Null; $t.TaskName } else { Write-Host 'No SmartShelter watchdog tasks found.' }"

echo.
echo Done. Watchdog is active again.
pause
