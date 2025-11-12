#!/bin/bash

# Local Docker deployment script
echo "Building Docker image..."
docker build -t medical-translator:latest .

echo "Starting container..."
docker run -d \
  --name medical-translator \
  -p 3000:3000 \
  --env-file .env.local \
  medical-translator:latest

echo "Container started! Access the app at http://localhost:3000"
echo "To view logs: docker logs -f medical-translator"
echo "To stop: docker stop medical-translator"
echo "To remove: docker rm medical-translator"

