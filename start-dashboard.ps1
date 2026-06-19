# n8n Code Pipeline Dashboard — Start Script
# Run this from the project root: .\start-dashboard.ps1

Write-Host "`n⚡ Starting n8n Pipeline Dashboard...`n" -ForegroundColor Cyan

# Start backend server
Write-Host "🔧 Starting API server (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; node src/index.js"

Start-Sleep -Seconds 1

# Start frontend
Write-Host "🎨 Starting dashboard UI (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\dashboard'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "`n✅ Dashboard is starting up!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   API:      http://localhost:3001" -ForegroundColor Cyan
Write-Host "   Webhook:  http://localhost:3001/api/webhook/n8n" -ForegroundColor Cyan
Write-Host "`n📋 Next steps:" -ForegroundColor White
Write-Host "   1. Edit server\.env with your GitHub token, FTP credentials" -ForegroundColor Gray
Write-Host "   2. Add an HTTP Request node at the end of your n8n workflow" -ForegroundColor Gray
Write-Host "   3. Point it to: http://YOUR_NAS_IP:3001/api/webhook/n8n" -ForegroundColor Gray
Write-Host ""
