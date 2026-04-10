@echo off
title Uninstall World Menu POS
color 0C
echo.
echo   ============================================================
echo        U N I N S T A L L   W O R L D   M E N U   P O S
echo   ============================================================
echo.
echo   This will remove World Menu POS from this computer.
echo   Your menu data and settings will be deleted.
echo.
set /p confirm="   Type UNINSTALL to confirm: "
if /i not "%confirm%"=="UNINSTALL" (
    echo   Cancelled.
    pause
    exit /b
)
echo.

:: Stop any running server
echo   Stopping server...
taskkill /F /IM node.exe >nul 2>&1

:: Remove desktop shortcut
echo   Removing shortcuts...
del "%USERPROFILE%\Desktop\World Menu POS.lnk" >nul 2>&1

:: Remove start menu
rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\World Menu POS" >nul 2>&1

:: Remove registry (Add/Remove Programs)
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\WorldMenuPOS" /f >nul 2>&1

:: Remove install directories
if exist "C:\World Menu POS" (
    echo   Removing C:\World Menu POS...
    rmdir /s /q "C:\World Menu POS" >nul 2>&1
)
if exist "C:\world-menu-pos" (
    echo   Removing C:\world-menu-pos (legacy)...
    rmdir /s /q "C:\world-menu-pos" >nul 2>&1
)

:: Remove the current folder (if running from install dir)
echo   Removing program files...
set "INSTALLDIR=%~dp0"

echo.
echo   ============================================================
echo   World Menu POS has been uninstalled.
echo   ============================================================
echo.
echo   You can now delete this folder: %INSTALLDIR%
echo.
pause
