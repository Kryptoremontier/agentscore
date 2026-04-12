# restart-dev.ps1
# Kills all Node processes, clears .next cache, restarts dev server.
# Run: .\restart-dev.ps1

Write-Host "`n[1/3] Killing Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "[2/3] Clearing .next cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "[3/3] Starting dev server on http://localhost:3000" -ForegroundColor Green
npm run dev
