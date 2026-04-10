@echo off
title World Menu POS - Setup
color 0E
cd /d "%~dp0"

echo.
echo   ============================================================
echo        W O R L D   M E N U   P O S   -   S E T U P
echo   ============================================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js is not installed!
    echo   Download it free from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo   Node.js found.

:: Ensure directories exist
if not exist "server\data" mkdir "server\data"
if not exist "server\uploads" mkdir "server\uploads"

:: Install dependencies
echo   Installing dependencies... (this may take a few minutes)
call npm install >nul 2>&1
echo   Dependencies installed.

:: Build client
echo   Building the app...
cd client && call npx vite build >nul 2>&1
copy /y public\manifest.json dist\ >nul 2>&1
copy /y public\embed.js dist\ >nul 2>&1
cd ..
echo   App built.

:: Create desktop shortcut
echo   Creating desktop shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([IO.Path]::Combine($ws.SpecialFolders('Desktop'), 'World Menu POS.lnk')); $sc.TargetPath = '%~dp0START.bat'; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'Launch World Menu POS'; $sc.Save()" >nul 2>&1
echo   Shortcut created.

echo.
echo   ============================================================
echo        SETUP COMPLETE!
echo   ============================================================
echo.
echo   Run START.bat to launch World Menu POS.
echo   A shortcut has been added to your desktop.
echo.
pause
