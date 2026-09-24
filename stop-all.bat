@echo off
setlocal EnableDelayedExpansion
title SGAM - Stop All

rem ============================================================
rem  Stops whatever is listening on the app's two ports.
rem  PostgreSQL is left running - it is slow to bring back and
rem  nothing else depends on stopping it.
rem ============================================================

echo ========================================
echo   SGAM - STOP ALL
echo ========================================
echo.

call :KillPort 5173 frontend
call :KillPort 5000 backend

echo.
echo Done. Start again with start-all.bat
ping -n 4 127.0.0.1 >nul
exit /b 0

:KillPort
set "PORT=%~1"
set "LABEL=%~2"
set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT%"') do (
    if not "%%p"=="0" (
        echo Stopping %LABEL% on port %PORT% ^(pid %%p^)
        taskkill /pid %%p /f /t >nul 2>&1
        set "FOUND=1"
    )
)
if not defined FOUND echo No %LABEL% running on port %PORT%
exit /b 0
