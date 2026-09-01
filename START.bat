@echo off
title World Menu POS - Server
color 0A
mode con: cols=80 lines=35
cd /d "%~dp0"

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
echo        HOW TO CONNECT A TABLET OR PHONE
echo   ============================================================
echo.
echo    1. Wait for "Tablets/Phones: http://..." to appear below --
echo       that's this computer's real address on the network. (Not
echo       computed here on purpose: a machine with a VPN, Hyper-V,
echo       or similar installed can have more than one network
echo       adapter, and guessing wrong here means sending a tablet to
echo       an address nothing is listening on. The server below picks
echo       correctly.)
echo    2. Connect the tablet/phone to the SAME WiFi as this computer
echo    3. Open Chrome (or Safari on iPhone/iPad) and type that address
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

:: Start the server — auto-restart after updates
:loop
cd /d "%~dp0"
cd server && npx tsx src/index.ts
echo.
echo   Server stopped. Restarting in 3 seconds...
echo   (Close this window to stop World Menu)
timeout /t 3 /nobreak >nul
goto loop
