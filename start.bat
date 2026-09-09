@echo off
title SpeedFace-V5L Attendance Manager
cd /d "%~dp0"

echo ==========================================================
echo       SpeedFace-V5L Series Attendance Application
echo ==========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

if not exist "node_modules" (
    echo [INFO] Installing required dependencies...
    call npm install
)

echo [INFO] Starting Attendance Server on http://localhost:8088...
echo [INFO] Connecting to SpeedFace terminal at 192.168.10.15:4370...
echo.

:: Open default browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8088"

:: Start the application server
node server.js

pause
