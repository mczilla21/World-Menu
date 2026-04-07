@echo off
title World Menu POS - Server
color 0A
cd /d "%~dp0"

:: Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0"') do (
    set "LOCALIP=%%a"
    goto :found
)
:found
set LOCALIP=%LOCALIP: =%

cls
echo.
echo   ============================================================
echo.
echo        W O R L D   M E N U   P O S
echo.
echo        Your restaurant is starting up...
echo.
echo   ============================================================
echo.
echo   ============================================================
echo        CONNECTION INFO - SAVE THIS!
echo   ============================================================
echo.
echo        On THIS computer:
echo        http://localhost:3000
echo.
echo        On TABLETS and PHONES (same WiFi):
echo        http://%LOCALIP%:3000
echo.
echo   ============================================================
echo        HOW TO CONNECT A TABLET OR PHONE
echo   ============================================================
echo.
echo    1. Connect the tablet/phone to the SAME WiFi as this computer
echo    2. Open Chrome (or Safari on iPhone/iPad)
echo    3. Type this in the address bar:
echo.
echo            http://%LOCALIP%:3000
echo.
echo    4. Bookmark it or tap "Add to Home Screen" for easy access
echo    5. That's it! Pick your role and start using World Menu
echo.
echo   ============================================================
echo.
echo    WARNING: DO NOT CLOSE THIS WINDOW!
echo    Closing this window will shut down World Menu for everyone.
echo    Minimize it instead.
echo.
echo   ============================================================
echo.

:: Start the server (open http://localhost:3000 in your browser)
cd server && npx tsx src/index.ts
