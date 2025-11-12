# Google Cloud Platform Deployment Guide

This guide explains how to deploy the Medical Translator application to Google Cloud Run.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. Google Cloud SDK (gcloud CLI) installed and authenticated
3. Docker installed (for local testing)
4. API keys stored securely

## Setup Steps

### 1. Create a GCP Project

```bash
gcloud projects create medical-translator-project --name="Medical Translator"
gcloud config set project medical-translator-project
```

### 2. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Set Up Secret Manager (Recommended)

Store your API keys securely in Secret Manager:

```bash
# Create secrets
echo -n "your-soniox-api-key" | gcloud secrets create next-public-soniox-api-key --data-file=-
echo -n "your-soniox-api-key" | gcloud secrets create soniox-api-key --data-file=-
echo -n "your-azure-speech-key" | gcloud secrets create azure-speech-key --data-file=-
echo -n "your-azure-region" | gcloud secrets create azure-speech-region --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding next-public-soniox-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding soniox-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding azure-speech-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding azure-speech-region \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Replace `PROJECT_NUMBER` with your actual project number (find it with `gcloud projects describe PROJECT_ID --format="value(projectNumber)"`).

### 4. Deploy Using Cloud Build (Recommended)

**Using cloudbuild.yaml:**

```bash
# Set substitution variables
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SONIOX_API_KEY="your-key",_SONIOX_API_KEY="your-key",_AZURE_SPEECH_KEY="your-key",_AZURE_SPEECH_REGION="your-region"
```

### 5. Deploy Using gcloud CLI

**Build and push the image:**

```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/medical-translator:latest
```

**Deploy to Cloud Run:**

```bash
gcloud run deploy medical-translator \
  --image gcr.io/$PROJECT_ID/medical-translator:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_SONIOX_API_KEY=your-key,SONIOX_API_KEY=your-key,AZURE_SPEECH_KEY=your-key,AZURE_SPEECH_REGION=your-region"
```

### 6. Deploy Using Scripts

**Option A: Simple Script (Recommended - uses .env.local automatically)**

**Windows (PowerShell):**
```powershell
.\deploy-gcp-simple.ps1 -ProjectId "your-project-id" -Region "us-central1"
```

**Linux/Mac:**
```bash
chmod +x deploy-gcp-simple.sh
./deploy-gcp-simple.sh your-project-id us-central1
```

**Option B: Advanced Script (with Secret Manager support)**

**Windows (PowerShell):**
```powershell
# Set environment variables first (or use Secret Manager)
$env:NEXT_PUBLIC_SONIOX_API_KEY = "your-key"
$env:SONIOX_API_KEY = "your-key"
$env:AZURE_SPEECH_KEY = "your-key"
$env:AZURE_SPEECH_REGION = "your-region"

.\deploy-gcp.ps1 -ProjectId "your-project-id" -Region "us-central1"
```

**Linux/Mac:**
```bash
# Export environment variables first
export NEXT_PUBLIC_SONIOX_API_KEY="your-key"
export SONIOX_API_KEY="your-key"
export AZURE_SPEECH_KEY="your-key"
export AZURE_SPEECH_REGION="your-region"

chmod +x deploy-gcp.sh
./deploy-gcp.sh your-project-id us-central1
```

## Post-Deployment

### Get Service URL

```bash
gcloud run services describe medical-translator \
  --region us-central1 \
  --format 'value(status.url)'
```

### View Logs

```bash
gcloud run services logs read medical-translator --region us-central1
```

### Update Environment Variables

```bash
gcloud run services update medical-translator \
  --region us-central1 \
  --update-env-vars "NEXT_PUBLIC_SONIOX_API_KEY=new-value"
```

### Scale the Service

```bash
gcloud run services update medical-translator \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 20 \
  --memory 1Gi \
  --cpu 2
```

## Using Secret Manager (Best Practice)

If you set up Secret Manager, update your deployment to use secrets:

```bash
gcloud run services update medical-translator \
  --region us-central1 \
  --update-secrets="NEXT_PUBLIC_SONIOX_API_KEY=next-public-soniox-api-key:latest,SONIOX_API_KEY=soniox-api-key:latest,AZURE_SPEECH_KEY=azure-speech-key:latest,AZURE_SPEECH_REGION=azure-speech-region:latest"
```

## Monitoring

### View Metrics

```bash
# Open Cloud Console
gcloud run services describe medical-translator --region us-central1
```

Or visit: https://console.cloud.google.com/run

### Set Up Alerts

1. Go to Cloud Monitoring
2. Create alert policies for:
   - High error rates
   - High latency
   - Resource usage

## Cost Optimization

- **Min instances**: Set to 0 to avoid charges when not in use
- **Max instances**: Adjust based on expected traffic
- **Memory/CPU**: Start with 512Mi/1 CPU, scale up if needed
- **Region**: Choose the closest region to your users

## Troubleshooting

### Build Failures

```bash
# View build logs
gcloud builds list --limit=1
gcloud builds log BUILD_ID
```

### Service Won't Start

```bash
# Check logs
gcloud run services logs read medical-translator --region us-central1 --limit=50
```

### Environment Variables Not Working

- Verify variables are set correctly
- Check Secret Manager permissions if using secrets
- Ensure variable names match exactly (case-sensitive)

### WebSocket Issues

Cloud Run supports WebSockets, but ensure:
- Your client uses HTTPS (not HTTP)
- Timeout settings are appropriate
- Keep-alive is configured

## Security Best Practices

1. **Use Secret Manager** for sensitive data
2. **Enable authentication** if needed: `--no-allow-unauthenticated`
3. **Set up IAM policies** to restrict access
4. **Enable VPC connector** if accessing private resources
5. **Use Cloud Armor** for DDoS protection

## Cleanup

To delete the service:

```bash
gcloud run services delete medical-translator --region us-central1
```

To delete the container image:

```bash
gcloud container images delete gcr.io/$PROJECT_ID/medical-translator:latest
```

