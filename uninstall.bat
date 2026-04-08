@echo off
echo ==========================================
echo   Uninstalling World Menu POS
echo ==========================================
echo.

:: Stop any running server
taskkill /F /IM node.exe >nul 2>&1
echo Stopped server.

:: Remove desktop shortcut
del "%USERPROFILE%\Desktop\World Menu POS.lnk" >nul 2>&1
echo Removed desktop shortcut.

:: Remove start menu
rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\World Menu POS" >nul 2>&1
echo Removed start menu entry.

:: Remove registry
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\WorldMenuPOS" /f >nul 2>&1
echo Removed registry entry.

:: Remove C:\world-menu-pos if it exists
if exist "C:\world-menu-pos" (
    rmdir /s /q "C:\world-menu-pos" >nul 2>&1
    echo Removed C:\world-menu-pos
)

echo.
echo ==========================================
echo   World Menu POS has been uninstalled.
echo   You can delete this folder manually.
echo ==========================================
echo.
pause
