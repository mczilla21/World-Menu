@echo off
title World Menu POS - Setup
color 0E
cd /d "%~dp0"

echo.
echo   ============================================================
echo        W O R L D   M E N U   P O S   -   S E T U P
echo   ============================================================
echo.

:: Check Node.js — auto-install if missing
node --version >nul 2>&1
if errorlevel 1 (
    echo   Node.js not found — installing automatically...
    echo   Downloading Node.js... (this may take a minute)
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi' -OutFile '%TEMP%\node-install.msi'" >nul 2>&1
    if not exist "%TEMP%\node-install.msi" (
        echo   ERROR: Could not download Node.js. Check internet connection.
        echo   Or download manually from https://nodejs.org
        pause
        exit /b 1
    )
    echo   Installing Node.js silently...
    msiexec /i "%TEMP%\node-install.msi" /qn /norestart >nul 2>&1
    del "%TEMP%\node-install.msi" >nul 2>&1
    :: Refresh PATH so node is available
    set "PATH=%PATH%;C:\Program Files\nodejs"
    node --version >nul 2>&1
    if errorlevel 1 (
        echo   ERROR: Node.js install failed. Please install manually from https://nodejs.org
        pause
        exit /b 1
    )
    echo   Node.js installed!
) else (
    echo   Node.js found.
)

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
