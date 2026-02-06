# Run Healthcare Assistant AI (Backend + Frontend)
# Uses cmd.exe to avoid PowerShell execution policy issues

Write-Host "Starting Healthcare Assistant AI..." -ForegroundColor Cyan

$Root = Get-Location

# Start Backend (cmd.exe avoids execution policy)
$BackendPath = Join-Path $Root "apps\api"
Write-Host "Launching Backend from: $BackendPath"
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$BackendPath`" && echo Starting Backend... && uvicorn main:app --reload --host 127.0.0.1 --port 8000"

# Start Frontend (cmd.exe avoids execution policy)
$FrontendPath = Join-Path $Root "apps\web"
Write-Host "Launching Frontend from: $FrontendPath"
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$FrontendPath`" && echo Starting Frontend... && npm run dev"

Write-Host ""
Write-Host "Two windows opened:" -ForegroundColor Green
Write-Host "  - Backend: http://127.0.0.1:8000"
Write-Host "  - Frontend: http://localhost:3000"
Write-Host ""
Write-Host "Close both windows to stop the servers." -ForegroundColor Yellow
