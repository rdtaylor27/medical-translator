#!/bin/bash

# GCP Cloud Run deployment script
# Make sure you have gcloud CLI installed and authenticated

set -e

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="medical-translator"

echo "Deploying to GCP Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Set the project
gcloud config set project $PROJECT_ID

# Build and submit the image with build args
echo "Building and pushing Docker image..."
echo "Note: Make sure NEXT_PUBLIC_SONIOX_API_KEY is set in your environment or use --substitutions"
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --substitutions=_NEXT_PUBLIC_SONIOX_API_KEY="${NEXT_PUBLIC_SONIOX_API_KEY:-$(gcloud secrets versions access latest --secret=next-public-soniox-api-key 2>/dev/null || echo '')}"

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
echo "Note: NEXT_PUBLIC_SONIOX_API_KEY is embedded at build time, but we set it at runtime too for consistency"

# Get secrets or use environment variables
SONIOX_KEY="${SONIOX_API_KEY:-$(gcloud secrets versions access latest --secret=soniox-api-key 2>/dev/null || echo '')}"
AZURE_KEY="${AZURE_SPEECH_KEY:-$(gcloud secrets versions access latest --secret=azure-speech-key 2>/dev/null || echo '')}"
AZURE_REGION="${AZURE_SPEECH_REGION:-$(gcloud secrets versions access latest --secret=azure-speech-region 2>/dev/null || echo 'eastus')}"
PUBLIC_KEY="${NEXT_PUBLIC_SONIOX_API_KEY:-$(gcloud secrets versions access latest --secret=next-public-soniox-api-key 2>/dev/null || echo '')}"

gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_SONIOX_API_KEY=${PUBLIC_KEY},SONIOX_API_KEY=${SONIOX_KEY},AZURE_SPEECH_KEY=${AZURE_KEY},AZURE_SPEECH_REGION=${AZURE_REGION}"

echo "Deployment complete!"
echo "Service URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"

