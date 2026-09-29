@echo off
title Install SpeedFace Server Auto-Start Task
cd /d "%~dp0\.."

echo =================================================================
echo   SpeedFace-V5L Windows Auto-Start Scheduler
echo =================================================================
echo.
echo This will configure Windows Task Scheduler to automatically start
echo the Attendance Server when the computer boots up.
echo.

set "TASK_NAME=SpeedFaceAttendanceServer"
set "APP_DIR=%~dp0\.."
set "START_SCRIPT=%APP_DIR%\start-production.bat"

echo Target Script: %START_SCRIPT%
echo.

:: Register task in Windows Task Scheduler
schtasks /create /tn "%TASK_NAME%" /tr ""%START_SCRIPT%"" /sc onstart /ru SYSTEM /rl HIGHEST /f >nul 2>&1

if %errorlevel% equ 0 (
    echo [SUCCESS] Windows Auto-Start Task '%TASK_NAME%' has been created successfully!
    echo The server will now automatically run when this computer turns on.
) else (
    echo [INFO] Registering for current user startup...
    schtasks /create /tn "%TASK_NAME%" /tr ""%START_SCRIPT%"" /sc onlogon /rl HIGHEST /f
    if %errorlevel% equ 0 (
        echo [SUCCESS] Auto-start task created on user logon!
    ) else (
        echo [NOTICE] Please run this batch script as Administrator to enable system boot auto-start.
    )
)

echo.
pause
