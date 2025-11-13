# Local Docker deployment script for PowerShell
# This script builds and runs the Docker container with proper build arguments

Write-Host "Loading environment variables from .env.local..." -ForegroundColor Yellow

# Load environment variables from .env.local if it exists
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Environment variables loaded from .env.local" -ForegroundColor Green
} else {
    Write-Host "Warning: .env.local file not found. Make sure environment variables are set." -ForegroundColor Yellow
}

# Validate required build argument
if (-not $env:NEXT_PUBLIC_SONIOX_API_KEY) {
    Write-Host "Error: NEXT_PUBLIC_SONIOX_API_KEY is required for build" -ForegroundColor Red
    Write-Host "Please create .env.local file with NEXT_PUBLIC_SONIOX_API_KEY=your-key" -ForegroundColor Yellow
    exit 1
}

Write-Host "Building Docker image with build arguments..." -ForegroundColor Green
docker build `
  --build-arg NEXT_PUBLIC_SONIOX_API_KEY="$env:NEXT_PUBLIC_SONIOX_API_KEY" `
  -t medical-translator:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Stopping existing container (if any)..." -ForegroundColor Yellow
docker stop medical-translator 2>$null
docker rm medical-translator 2>$null

Write-Host "Starting container..." -ForegroundColor Green
docker run -d `
  --name medical-translator `
  -p 3004:3000 `
  --env-file .env.local `
  medical-translator:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start container!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Container started successfully!" -ForegroundColor Green
Write-Host "Access the app at: http://localhost:3004" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs:    docker logs -f medical-translator" -ForegroundColor White
Write-Host "  Stop:        docker stop medical-translator" -ForegroundColor White
Write-Host "  Remove:      docker rm medical-translator" -ForegroundColor White
Write-Host "  Restart:     docker restart medical-translator" -ForegroundColor White

