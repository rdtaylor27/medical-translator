#!/bin/bash

# Local Docker build script (build only, no run)
# Use this when you only want to build the image without running it

set -e

echo "Loading environment variables from .env.local..."

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
    echo "Environment variables loaded from .env.local"
else
    echo "Warning: .env.local file not found. Make sure environment variables are set."
fi

# Validate required build argument
if [ -z "$NEXT_PUBLIC_SONIOX_API_KEY" ]; then
    echo "Error: NEXT_PUBLIC_SONIOX_API_KEY is required for build"
    echo "Please create .env.local file with NEXT_PUBLIC_SONIOX_API_KEY=your-key"
    exit 1
fi

echo "Building Docker image with build arguments..."
docker build \
  --build-arg NEXT_PUBLIC_SONIOX_API_KEY="$NEXT_PUBLIC_SONIOX_API_KEY" \
  -t medical-translator:latest .

echo ""
echo "✓ Build completed successfully!"
echo "Image: medical-translator:latest"
echo ""
echo "To run the container:"
echo "  docker run -d -p 3000:3000 --env-file .env.local --name medical-translator medical-translator:latest"

