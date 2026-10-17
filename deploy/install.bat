@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM Smart-Shelter installer (USB deployment)
REM USB folder layout:
REM   install.bat
REM   watchdog-pause.bat
REM   watchdog-resume.bat
REM   set-lan2-ip.bat                            (used for Client only)
REM   BIT\win-unpacked\...
REM   BIT\mediamtx\mediamtx.exe, mediamtx.yml     (RTSP-to-HLS server, BIT only)
REM   Client\win-unpacked\...
REM ============================================================

REM Requires admin rights (for scheduled task registration)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator rights required. Right-click -^> Run as administrator.
    pause
    exit /b 1
)

echo ============================================
echo   Smart-Shelter Installer
echo ============================================
echo   1. BIT
echo   2. Client
echo ============================================
set /p CHOICE=Select program to install (1 or 2):

if "%CHOICE%"=="1" (
    set "APP_TYPE=BIT"
) else if "%CHOICE%"=="2" (
    set "APP_TYPE=Client"
) else (
    echo [ERROR] Invalid selection.
    pause
    exit /b 1
)

set "SRC=%~dp0%APP_TYPE%\win-unpacked"
set "DEST=C:\SmartShelter\%APP_TYPE%"
set "TASK_NAME=SmartShelter-%APP_TYPE%-Watchdog"
set "EXE_PATH=%DEST%\Smart-Shelter.exe"
set "MEDIAMTX_SRC=%~dp0BIT\mediamtx"
set "MEDIAMTX_DEST=%DEST%\mediamtx"
set "MEDIAMTX_TASK=SmartShelter-%APP_TYPE%-MediaMTX-Watchdog"

if not exist "%SRC%" (
    echo [ERROR] Install source not found: %SRC%
    pause
    exit /b 1
)

REM GUI app must run in the current interactive user's session, not SYSTEM/Session 0
set "RUN_USER=%USERDOMAIN%\%USERNAME%"

echo.
echo [1/7] Stopping existing process / tasks...
taskkill /f /im Smart-Shelter.exe >nul 2>&1
taskkill /f /im mediamtx.exe >nul 2>&1
schtasks /query /tn "%TASK_NAME%" >nul 2>&1 && schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
schtasks /query /tn "%MEDIAMTX_TASK%" >nul 2>&1 && schtasks /delete /tn "%MEDIAMTX_TASK%" /f >nul 2>&1

set "CFG_BACKUP=%TEMP%\smartshelter-cfg-backup-%APP_TYPE%"
if exist "%DEST%\resources\data\setting.json" (
    echo   Backing up local config ^(data\setting.json, config\settings.json^)...
    if exist "%CFG_BACKUP%" rmdir /s /q "%CFG_BACKUP%"
    mkdir "%CFG_BACKUP%" >nul 2>&1
    copy /y "%DEST%\resources\data\setting.json" "%CFG_BACKUP%\setting.json" >nul
    if exist "%DEST%\resources\config\settings.json" copy /y "%DEST%\resources\config\settings.json" "%CFG_BACKUP%\settings.json" >nul
)

echo [2/7] Copying files: %SRC% -^> %DEST%
robocopy "%SRC%" "%DEST%" /MIR /NFL /NDL /NJH /NJS
if %errorlevel% geq 8 (
    echo [ERROR] File copy failed ^(robocopy error code: %errorlevel%^)
    pause
    exit /b 1
)

if exist "%CFG_BACKUP%\setting.json" (
    echo   Restoring local config...
    copy /y "%CFG_BACKUP%\setting.json" "%DEST%\resources\data\setting.json" >nul
    if exist "%CFG_BACKUP%\settings.json" copy /y "%CFG_BACKUP%\settings.json" "%DEST%\resources\config\settings.json" >nul
    rmdir /s /q "%CFG_BACKUP%"
)

set "HAS_MEDIAMTX=0"
if "%APP_TYPE%"=="BIT" (
    if exist "%MEDIAMTX_SRC%" (
        echo [3/7] Copying MediaMTX: %MEDIAMTX_SRC% -^> %MEDIAMTX_DEST%
        robocopy "%MEDIAMTX_SRC%" "%MEDIAMTX_DEST%" /MIR /NFL /NDL /NJH /NJS
        if !errorlevel! geq 8 (
            echo [ERROR] MediaMTX copy failed ^(robocopy error code: !errorlevel!^)
            pause
            exit /b 1
        )
        set "HAS_MEDIAMTX=1"
    ) else (
        echo [3/7] MediaMTX source not found: %MEDIAMTX_SRC% - skipping
    )
) else (
    echo [3/7] MediaMTX not needed for Client - skipping
)

echo [4/7] Copying maintenance scripts to C:\SmartShelter...
copy /y "%~f0" "C:\SmartShelter\install.bat" >nul
if exist "%~dp0watchdog-pause.bat" copy /y "%~dp0watchdog-pause.bat" "C:\SmartShelter\watchdog-pause.bat" >nul
if exist "%~dp0watchdog-resume.bat" copy /y "%~dp0watchdog-resume.bat" "C:\SmartShelter\watchdog-resume.bat" >nul
if "%APP_TYPE%"=="Client" if exist "%~dp0set-lan2-ip.bat" copy /y "%~dp0set-lan2-ip.bat" "C:\SmartShelter\set-lan2-ip.bat" >nul

if "%APP_TYPE%"=="Client" (
    if exist "%~dp0set-lan2-ip.bat" (
        echo [5/7] Setting LAN2 static IP...
        call "%~dp0set-lan2-ip.bat"
    ) else (
        echo [5/7] set-lan2-ip.bat not found on USB - skipping
    )
) else (
    echo [5/7] LAN2 IP setup not needed for BIT - skipping
)

echo [6/7] Registering autostart + watchdog task^(s^)...
call :RegisterWatchdog "%TASK_NAME%" "%EXE_PATH%" "%DEST%" "Interactive"
if "%HAS_MEDIAMTX%"=="1" call :RegisterWatchdog "%MEDIAMTX_TASK%" "%MEDIAMTX_DEST%\mediamtx.exe" "%MEDIAMTX_DEST%" "System"

echo [7/7] Launching program^(s^)...
schtasks /run /tn "%TASK_NAME%" >nul 2>&1
if "%HAS_MEDIAMTX%"=="1" schtasks /run /tn "%MEDIAMTX_TASK%" >nul 2>&1

echo.
echo ============================================
echo   Install complete: %APP_TYPE% -^> %DEST%
echo   Watchdog task: %TASK_NAME% (starts at boot, checked every 1 min)
if "%HAS_MEDIAMTX%"=="1" echo   Watchdog task: %MEDIAMTX_TASK% (starts at boot, checked every 1 min)
echo   Maintenance scripts copied to C:\SmartShelter (install.bat, watchdog-pause.bat, watchdog-resume.bat)
echo ============================================
pause
exit /b 0

:RegisterWatchdog
set "TNAME=%~1"
set "TEXE=%~2"
set "TWORKDIR=%~3"
set "TMODE=%~4"
if /i "%TMODE%"=="Interactive" (
    REM Runs in the current logged-on user's interactive session (needed for GUI apps - SYSTEM/Session 0 has no visible desktop)
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$principal = New-ScheduledTaskPrincipal -UserId '%RUN_USER%' -LogonType Interactive -RunLevel Highest;" ^
        "$action = New-ScheduledTaskAction -Execute '%TEXE%' -WorkingDirectory '%TWORKDIR%';" ^
        "$t1 = New-ScheduledTaskTrigger -AtLogOn -User '%RUN_USER%';" ^
        "$t2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650);" ^
        "$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit 0 -AllowStartIfOnBatteries;" ^
        "Register-ScheduledTask -TaskName '%TNAME%' -Action $action -Trigger $t1,$t2 -Settings $settings -Principal $principal -Force | Out-Null"
) else (
    REM Headless (no GUI) - fine to run as SYSTEM even before any user logs on
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$action = New-ScheduledTaskAction -Execute '%TEXE%' -WorkingDirectory '%TWORKDIR%';" ^
        "$t1 = New-ScheduledTaskTrigger -AtStartup;" ^
        "$t2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650);" ^
        "$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit 0 -AllowStartIfOnBatteries;" ^
        "Register-ScheduledTask -TaskName '%TNAME%' -Action $action -Trigger $t1,$t2 -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null"
)
if %errorlevel% neq 0 (
    echo [ERROR] Task registration failed: %TNAME%
)
exit /b
