@echo off
title Stop Attendance Server
cd /d "%~dp0"

echo [INFO] Stopping Attendance Server process on port 8088...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8088" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo [SUCCESS] Stopped server PID %%a
)

echo Done.
timeout /t 2 /nobreak >nul
