# Docker Deployment Guide

This guide explains how to build and run the Medical Translator application using Docker.

## Prerequisites

- Docker installed on your system
- `.env.local` file with required environment variables

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Soniox API Configuration
NEXT_PUBLIC_SONIOX_API_KEY=your_soniox_api_key_here
SONIOX_API_KEY=your_soniox_api_key_here

# Azure Speech Services Configuration (optional, for TTS)
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

## Local Docker Deployment

### Option 1: Using Docker Compose (Recommended)

```bash
docker-compose up --build
```

The application will be available at `http://localhost:3000`

To stop:
```bash
docker-compose down
```

### Option 2: Using Docker Commands

**Build the image:**
```bash
docker build -t medical-translator:latest .
```

**Run the container:**
```bash
docker run -d \
  --name medical-translator \
  -p 3000:3000 \
  --env-file .env.local \
  medical-translator:latest
```

**View logs:**
```bash
docker logs -f medical-translator
```

**Stop the container:**
```bash
docker stop medical-translator
```

**Remove the container:**
```bash
docker rm medical-translator
```

### Option 3: Using Deployment Scripts (Recommended)

The deployment scripts automatically load environment variables from `.env.local` and pass build arguments correctly.

**Windows (PowerShell):**
```powershell
.\deploy-local.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy-local.sh
./deploy-local.sh
```

**Build Only (without running):**
```powershell
# Windows
.\build-local.ps1

# Linux/Mac
chmod +x build-local.sh
./build-local.sh
```

## Testing the Deployment

1. Open your browser and navigate to `http://localhost:3000`
2. Test the translation functionality
3. Check the Docker logs for any errors:
   ```bash
   docker logs -f medical-translator
   ```

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, you can change it:
```bash
docker run -d --name medical-translator -p 3001:3000 --env-file .env.local medical-translator:latest
```

### Environment Variables Not Loading
Make sure your `.env.local` file exists and contains all required variables. Check the file format (no spaces around `=`).

### Build Errors
If you encounter build errors:
1. Make sure Docker has enough resources allocated
2. Try clearing Docker cache: `docker builder prune`
3. Check that all dependencies in `package.json` are correct

### Container Exits Immediately
Check the logs:
```bash
docker logs medical-translator
```

Common issues:
- Missing environment variables
- Port conflicts
- Build errors

## Next Steps

Once you've tested locally, proceed to GCP deployment using the instructions in `GCP.md`.

