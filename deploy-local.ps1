# Local Docker deployment script for PowerShell
Write-Host "Building Docker image..." -ForegroundColor Green
docker build -t medical-translator:latest .

Write-Host "Stopping existing container (if any)..." -ForegroundColor Yellow
docker stop medical-translator 2>$null
docker rm medical-translator 2>$null

Write-Host "Starting container..." -ForegroundColor Green
docker run -d `
  --name medical-translator `
  -p 3000:3000 `
  --env-file .env.local `
  medical-translator:latest

Write-Host "Container started! Access the app at http://localhost:3000" -ForegroundColor Cyan
Write-Host "To view logs: docker logs -f medical-translator" -ForegroundColor Yellow
Write-Host "To stop: docker stop medical-translator" -ForegroundColor Yellow
Write-Host "To remove: docker rm medical-translator" -ForegroundColor Yellow

