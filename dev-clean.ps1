# AgentScore — Clean Dev Start
# Kills all Node processes, clears .next cache, starts fresh dev server on port 3000
# Usage: .\dev-clean.ps1  (or: npm run dev:clean)

Write-Host "Stopping all Node.js processes..." -ForegroundColor Yellow
taskkill /f /im node.exe 2>$null
Start-Sleep -Seconds 2

Write-Host "Clearing .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host ".next removed." -ForegroundColor Green
} else {
    Write-Host ".next not found, skipping." -ForegroundColor Gray
}

Write-Host "Starting dev server..." -ForegroundColor Cyan
npm run dev
