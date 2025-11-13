# Local Docker build script for PowerShell (build only, no run)
# Use this when you only want to build the image without running it

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

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Build completed successfully!" -ForegroundColor Green
    Write-Host "Image: medical-translator:latest" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To run the container:" -ForegroundColor Yellow
    Write-Host "  docker run -d -p 3000:3000 --env-file .env.local --name medical-translator medical-translator:latest" -ForegroundColor White
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

