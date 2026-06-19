@echo off
echo ================================
echo  Starting n8n Dashboard
echo ================================

echo [1/3] Starting backend server...
start "Backend Server" cmd /k "cd /d F:\Internship\Claude AI works\server && npm run dev"

timeout /t 4 /nobreak >nul

echo [2/3] Starting ngrok tunnel...
start "ngrok Tunnel" cmd /k "ngrok http --domain=doorman-skeleton-pushchair.ngrok-free.dev 3001"

timeout /t 3 /nobreak >nul

echo [3/3] Starting dashboard...
start "Dashboard" cmd /k "cd /d F:\Internship\Claude AI works\dashboard && npm run dev"

echo.
echo All services started!
echo Backend:   http://localhost:3001
echo Dashboard: http://localhost:5173
echo Tunnel:    https://doorman-skeleton-pushchair.ngrok-free.dev
echo.
echo You can close this window.
pause
