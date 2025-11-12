#!/bin/bash

# Simplified GCP Cloud Run deployment script
# This script uses environment variables from .env.local or prompts for them

set -e

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="medical-translator"

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

echo "Deploying to GCP Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Validate required variables
if [ -z "$NEXT_PUBLIC_SONIOX_API_KEY" ]; then
    echo "Error: NEXT_PUBLIC_SONIOX_API_KEY is required"
    echo "Set it in .env.local or export it: export NEXT_PUBLIC_SONIOX_API_KEY=your-key"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Build and submit the image with build args
echo "Building and pushing Docker image..."

# Create temporary cloudbuild.yaml for this build
cat > cloudbuild.temp.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_SONIOX_API_KEY=$NEXT_PUBLIC_SONIOX_API_KEY'
      - '-t'
      - 'gcr.io/\$PROJECT_ID/$SERVICE_NAME:latest'
      - '.'
images:
  - 'gcr.io/\$PROJECT_ID/$SERVICE_NAME:latest'
EOF

gcloud builds submit --config=cloudbuild.temp.yaml

# Clean up temp file
rm -f cloudbuild.temp.yaml

# Prepare environment variables
ENV_VARS="NEXT_PUBLIC_SONIOX_API_KEY=$NEXT_PUBLIC_SONIOX_API_KEY"

if [ -n "$SONIOX_API_KEY" ]; then
    ENV_VARS="$ENV_VARS,SONIOX_API_KEY=$SONIOX_API_KEY"
fi

if [ -n "$AZURE_SPEECH_KEY" ]; then
    ENV_VARS="$ENV_VARS,AZURE_SPEECH_KEY=$AZURE_SPEECH_KEY"
fi

if [ -n "$AZURE_SPEECH_REGION" ]; then
    ENV_VARS="$ENV_VARS,AZURE_SPEECH_REGION=$AZURE_SPEECH_REGION"
fi

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
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
  --set-env-vars "$ENV_VARS"

echo ""
echo "Deployment complete!"
echo "Service URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"

