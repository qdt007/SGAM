@echo off
setlocal EnableDelayedExpansion
title SGAM - Start All
color 0A

rem ============================================================
rem  SGAM launcher
rem
rem  Usage:
rem    start-all.bat          normal start (clears the Vite dep cache)
rem    start-all.bat quick    keep the cache, for a fast restart
rem
rem  It never starts a second copy of a server that is already
rem  running. Two Vite servers on one project is what produces the
rem  "Failed to fetch dynamically imported module" blank screen.
rem ============================================================

cd /d "%~dp0"
set "ROOT=%~dp0"
set "SERVER=%ROOT%server"
set "CLIENT=%ROOT%client"
set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
set "PGDATA=C:\Program Files\PostgreSQL\18\data"

echo ========================================
echo   SGAM - START ALL
echo ========================================
echo.

rem ---- What is already running? -------------------------------
set "BACKEND_UP="
set "FRONTEND_UP="
netstat -ano | findstr "LISTENING" | findstr ":5000" >nul 2>&1 && set "BACKEND_UP=1"
netstat -ano | findstr "LISTENING" | findstr ":5173" >nul 2>&1 && set "FRONTEND_UP=1"

if not defined BACKEND_UP goto StartPg
if not defined FRONTEND_UP goto StartPg
echo [i] Both servers are already running - opening the browser instead
echo     of starting a second copy.
echo.
echo     If the app misbehaves, run stop-all.bat first, then this again.
ping -n 3 127.0.0.1 >nul
start "" http://localhost:5173
exit /b 0

rem ---- 1. PostgreSQL ------------------------------------------
:StartPg
echo [1/5] PostgreSQL...
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q >nul 2>&1
if not errorlevel 1 goto PgReady

schtasks /query /tn "PostgreSQLSvc" >nul 2>&1
if not errorlevel 1 goto PgRun
echo       registering scheduled task...
schtasks /create /tn "PostgreSQLSvc" /tr "\"%PGBIN%\postgres.exe\" -D \"%PGDATA%\"" /sc ONCE /st 00:00 /ru "NT AUTHORITY\NetworkService" /f >nul 2>&1

:PgRun
schtasks /run /tn "PostgreSQLSvc" >nul 2>&1
echo       waiting for the database...
set /a pgtries=0

:WaitPg
set /a pgtries+=1
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q >nul 2>&1
if not errorlevel 1 goto PgReady
if !pgtries! geq 20 goto PgFail
ping -n 2 127.0.0.1 >nul
goto WaitPg

:PgFail
echo   [!] PostgreSQL did not come up. Start it manually, then rerun.
pause
exit /b 1

:PgReady
echo       ready

rem ---- 2. Dependencies ----------------------------------------
echo [2/5] Dependencies...
if exist "%SERVER%\node_modules" goto ClientDeps
echo       installing server packages, this takes a minute...
pushd "%SERVER%"
call npm install
popd

:ClientDeps
if exist "%CLIENT%\node_modules" goto DepsOk
echo       installing client packages, this takes a minute...
pushd "%CLIENT%"
call npm install
popd

:DepsOk
echo       ok

rem ---- 3. Database schema -------------------------------------
echo [3/5] Database schema...
pushd "%SERVER%"
call npx prisma generate >nul 2>&1
call npx prisma migrate deploy
if errorlevel 1 goto MigrateFail
popd
goto ClearCache

:MigrateFail
popd
echo   [!] Migration failed. Check DATABASE_URL in server\.env
pause
exit /b 1

rem ---- 4. Servers ---------------------------------------------
rem The Vite dep cache goes stale whenever packages change, and a stale
rem cache answers 404 for /node_modules/.vite/deps/*?v=<hash>.
:ClearCache
if /I "%~1"=="quick" goto StartServers
if not exist "%CLIENT%\node_modules\.vite" goto StartServers
echo       clearing Vite cache
rd /s /q "%CLIENT%\node_modules\.vite"

:StartServers
echo [4/5] Servers...
if defined BACKEND_UP echo       backend already on :5000, leaving it alone
if not defined BACKEND_UP start "SGAM backend :5000" /D "%SERVER%" cmd /k npm run dev
if defined FRONTEND_UP echo       frontend already on :5173, leaving it alone
if not defined FRONTEND_UP start "SGAM frontend :5173" /D "%CLIENT%" cmd /k npm run dev

rem ---- 5. Wait until they actually answer ----------------------
echo [5/5] Waiting for the app...
set /a tries=0

:WaitUp
set /a tries+=1
curl -s -o nul -m 2 http://localhost:5000/health
if errorlevel 1 goto NotYet
curl -s -o nul -m 2 http://localhost:5173/
if errorlevel 1 goto NotYet
goto AllUp

:NotYet
if !tries! geq 45 goto TimedOut
ping -n 2 127.0.0.1 >nul
goto WaitUp

:TimedOut
echo.
echo   [!] The servers did not answer in time.
echo       Two console windows just opened - the error is printed there.
pause
exit /b 1

:AllUp
echo.
echo ========================================
echo   Ready:  http://localhost:5173
echo   Login:  demo@test.com / Demo1234^^!
echo ========================================
echo.
echo   Demo data:  cd server ^&^& npm run seed
echo   Stop all:   stop-all.bat
echo.
start "" http://localhost:5173
exit /b 0
