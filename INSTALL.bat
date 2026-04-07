@echo off
echo Installing World Menu dependencies...
echo.
cd /d "%~dp0"
call npm install
echo.
echo Building client...
call npm run build
echo.
echo Done! Run START.bat to launch.
pause
