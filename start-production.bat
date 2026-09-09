@echo off
title SpeedFace Attendance Server (Production)
cd /d "%~dp0"

echo =================================================================
echo  SpeedFace-V5L Automated Biometric Attendance Server (PRODUCTION)
echo =================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js (LTS version) from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing required production packages...
    call npm install --omit=dev
)

if not exist "logs" (
    mkdir "logs"
)

if not exist "data\backups" (
    mkdir "data\backups"
)

set NODE_ENV=production
echo [INFO] Environment: PRODUCTION
echo [INFO] Starting HTTP server and background SpeedFace sync engine...
echo [INFO] Dashboard URL: http://localhost:8088
echo.

:: Launch default browser
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8088"

:loop
echo [%date% %time%] Starting server process... >> logs\service.log
node server.js
echo [WARNING] Server stopped at %time%. Restarting in 5 seconds... >> logs\service.log
timeout /t 5 /nobreak >nul
goto loop
