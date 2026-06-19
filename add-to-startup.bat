@echo off
echo Adding dashboard to Windows startup...

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set BAT_FILE=F:\Internship\Claude AI works\start.bat

copy "%BAT_FILE%" "%STARTUP%\n8n-dashboard.bat" >nul

echo Done! The dashboard will now start automatically when Windows boots.
echo Startup folder: %STARTUP%
pause
