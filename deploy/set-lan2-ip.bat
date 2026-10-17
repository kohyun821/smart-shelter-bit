@echo off
setlocal

REM ============================================================
REM Set static IP on LAN2 adapter
REM   IP      : 10.1.0.100
REM   Subnet  : 255.255.255.0 (/24)
REM   Gateway : 10.1.0.254
REM ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrator rights required. Right-click -^> Run as administrator.
    pause
    exit /b 1
)

echo ============================================
echo   Current network adapters
echo ============================================
netsh interface show interface
echo ============================================
echo.
set /p IFNAME=Type the exact adapter name for LAN2 from the list above:

netsh interface ipv4 set address name="%IFNAME%" static 10.1.0.100 255.255.255.0 10.1.0.254
if %errorlevel% neq 0 (
    echo [!] Failed to set IP - check the adapter name is correct.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Done: %IFNAME% -^> 10.1.0.100/24, GW 10.1.0.254
echo ============================================
netsh interface ipv4 show addresses name="%IFNAME%"
pause
