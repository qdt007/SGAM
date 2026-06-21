@echo off
title EXE101 Project Management - Start All
color 0A

echo ========================================
echo   EXE101 Project Management - START ALL
echo ========================================
echo.

:: Start PostgreSQL via Task Scheduler (runs as NetworkService, not admin)
echo [1/3] Starting PostgreSQL...
schtasks /run /tn "PostgreSQLSvc" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Task not found, registering...
    schtasks /create /tn "PostgreSQLSvc" /tr "\"C:\Program Files\PostgreSQL\18\bin\postgres.exe\" -D \"C:\Program Files\PostgreSQL\18\data\"" /sc ONCE /st 00:00 /ru "NT AUTHORITY\NetworkService" /f >nul 2>&1
    schtasks /run /tn "PostgreSQLSvc" >nul 2>&1
)
timeout /t 6 /nobreak > nul
echo [1/3] PostgreSQL started

:: Start Backend
echo [2/3] Starting Backend (port 5000)...
start "Backend" /MIN cmd /c "cd /d d:\SUMMER2026\EXE101\project-management\server && npm run dev"
timeout /t 5 /nobreak > nul
echo [2/3] Backend starting...

:: Start Frontend
echo [3/3] Starting Frontend (port 5173)...
start "Frontend" /MIN cmd /c "cd /d d:\SUMMER2026\EXE101\project-management\client && npm run dev"
timeout /t 3 /nobreak > nul
echo [3/3] Frontend starting...

echo.
echo ========================================
echo   App ready at: http://localhost:5173
echo   Login: demo@test.com / Demo1234!
echo ========================================
echo.
echo Opening browser...
timeout /t 4 /nobreak > nul
start http://localhost:5173
pause
