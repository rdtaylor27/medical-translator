# Simplified GCP Cloud Run deployment script for PowerShell
# This script uses environment variables from .env.local

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    
    [string]$Region = "us-central1",
    [string]$ServiceName = "medical-translator"
)

Write-Host "Deploying to GCP Cloud Run..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Cyan

# Load environment variables from .env.local if it exists
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Validate required variables
if (-not $env:NEXT_PUBLIC_SONIOX_API_KEY) {
    Write-Host "Error: NEXT_PUBLIC_SONIOX_API_KEY is required" -ForegroundColor Red
    Write-Host "Set it in .env.local or export it: `$env:NEXT_PUBLIC_SONIOX_API_KEY='your-key'" -ForegroundColor Yellow
    exit 1
}

# Set the project
gcloud config set project $ProjectId

# Build and submit the image with build args
Write-Host "Building and pushing Docker image..." -ForegroundColor Yellow

# Create temporary cloudbuild.yaml for this build
$tempBuildConfig = @"
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_SONIOX_API_KEY=$($env:NEXT_PUBLIC_SONIOX_API_KEY)'
      - '-t'
      - 'gcr.io/$ProjectId/${ServiceName}:latest'
      - '.'
images:
  - 'gcr.io/$ProjectId/${ServiceName}:latest'
"@

$tempBuildConfig | Out-File -FilePath "cloudbuild.temp.yaml" -Encoding utf8

gcloud builds submit --config=cloudbuild.temp.yaml --project=$ProjectId

# Clean up temp file
Remove-Item "cloudbuild.temp.yaml" -ErrorAction SilentlyContinue

# Prepare environment variables
$envVars = "NEXT_PUBLIC_SONIOX_API_KEY=$env:NEXT_PUBLIC_SONIOX_API_KEY"

if ($env:SONIOX_API_KEY) {
    $envVars += ",SONIOX_API_KEY=$env:SONIOX_API_KEY"
}

if ($env:AZURE_SPEECH_KEY) {
    $envVars += ",AZURE_SPEECH_KEY=$env:AZURE_SPEECH_KEY"
}

if ($env:AZURE_SPEECH_REGION) {
    $envVars += ",AZURE_SPEECH_REGION=$env:AZURE_SPEECH_REGION"
}

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
  --image "gcr.io/$ProjectId/$ServiceName`:latest" `
  --platform managed `
  --region $Region `
  --allow-unauthenticated `
  --port 3000 `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 10 `
  --set-env-vars $envVars

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
$serviceUrl = gcloud run services describe $ServiceName --region $Region --format 'value(status.url)'
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan

