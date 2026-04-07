@echo off
title World Menu
cd /d "%~dp0"

:: Kill any existing World Menu servers on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Create logs dir
if not exist logs mkdir logs

:: Build client if needed
if not exist "client\dist\index.html" (
    echo Building client...
    cd client && call npx vite build && cd ..
    copy /y client\public\manifest.json client\dist\ >nul 2>&1
    copy /y client\public\embed.js client\dist\ >nul 2>&1
)

echo.
echo =========================================
echo   World Menu starting on port 3000...
echo   http://localhost:3000
echo =========================================
echo.

cd server && npx tsx src/index.ts
