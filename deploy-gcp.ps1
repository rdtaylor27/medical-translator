# GCP Cloud Run deployment script for PowerShell
# Make sure you have gcloud CLI installed and authenticated

param(
    [string]$ProjectId = "your-project-id",
    [string]$Region = "us-central1",
    [string]$ServiceName = "medical-translator"
)

Write-Host "Deploying to GCP Cloud Run..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Cyan

# Set the project
gcloud config set project $ProjectId

# Build and submit the image with build args
Write-Host "Building and pushing Docker image..." -ForegroundColor Yellow
Write-Host "Note: Make sure NEXT_PUBLIC_SONIOX_API_KEY is set in your environment" -ForegroundColor Yellow

$publicKey = if ($env:NEXT_PUBLIC_SONIOX_API_KEY) { 
    $env:NEXT_PUBLIC_SONIOX_API_KEY 
} else { 
    try { 
        gcloud secrets versions access latest --secret=next-public-soniox-api-key 2>$null 
    } catch { 
        "" 
    } 
}

gcloud builds submit `
  --tag "gcr.io/$ProjectId/$ServiceName`:latest" `
  --substitutions="_NEXT_PUBLIC_SONIOX_API_KEY=$publicKey"

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "Note: NEXT_PUBLIC_SONIOX_API_KEY is embedded at build time, but we set it at runtime too for consistency" -ForegroundColor Yellow

# Get secrets or use environment variables
$sonioxKey = if ($env:SONIOX_API_KEY) { 
    $env:SONIOX_API_KEY 
} else { 
    try { 
        gcloud secrets versions access latest --secret=soniox-api-key 2>$null 
    } catch { 
        "" 
    } 
}

$azureKey = if ($env:AZURE_SPEECH_KEY) { 
    $env:AZURE_SPEECH_KEY 
} else { 
    try { 
        gcloud secrets versions access latest --secret=azure-speech-key 2>$null 
    } catch { 
        "" 
    } 
}

$azureRegion = if ($env:AZURE_SPEECH_REGION) { 
    $env:AZURE_SPEECH_REGION 
} else { 
    try { 
        gcloud secrets versions access latest --secret=azure-speech-region 2>$null 
    } catch { 
        "eastus" 
    } 
}

$publicKey = if ($env:NEXT_PUBLIC_SONIOX_API_KEY) { 
    $env:NEXT_PUBLIC_SONIOX_API_KEY 
} else { 
    try { 
        gcloud secrets versions access latest --secret=next-public-soniox-api-key 2>$null 
    } catch { 
        "" 
    } 
}

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
  --set-env-vars "NEXT_PUBLIC_SONIOX_API_KEY=$publicKey,SONIOX_API_KEY=$sonioxKey,AZURE_SPEECH_KEY=$azureKey,AZURE_SPEECH_REGION=$azureRegion"

Write-Host "Deployment complete!" -ForegroundColor Green
$serviceUrl = gcloud run services describe $ServiceName --region $Region --format 'value(status.url)'
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan

