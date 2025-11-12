# Quick Start Guide

Get the Medical Translator running locally with Docker in minutes!

## Prerequisites

- Docker Desktop installed and running
- Soniox API key ([Get one here](https://console.soniox.com))

## Step 1: Clone and Setup

```bash
git clone https://github.com/rdtaylor27/medical-translator.git
cd medical-translator
```

## Step 2: Create Environment File

Copy the example environment file:

```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# Linux/Mac
cp .env.example .env.local
```

Edit `.env.local` and add your Soniox API key:

```env
NEXT_PUBLIC_SONIOX_API_KEY=your_soniox_api_key_here
SONIOX_API_KEY=your_soniox_api_key_here
```

## Step 3: Build and Run with Docker Compose

```bash
docker-compose up --build
```

The application will be available at: **http://localhost:3000**

## Step 4: Test the Application

1. Open http://localhost:3000 in your browser
2. Select languages for Provider and Patient
3. Click "Provider Speaking" or "Patient Speaking"
4. Grant microphone permissions
5. Start speaking!

## Stopping the Application

Press `Ctrl+C` in the terminal, or:

```bash
docker-compose down
```

## Troubleshooting

### Port 3000 Already in Use

Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "3001:3000"  # Use port 3001 instead
```

### Environment Variables Not Working

- Ensure `.env.local` exists in the project root
- Check that variable names match exactly (case-sensitive)
- Restart the container after changing `.env.local`

### Build Errors

```bash
# Clean Docker cache and rebuild
docker builder prune
docker-compose build --no-cache
docker-compose up
```

## Next Steps

- **Add Azure TTS**: See [DOCKER.md](DOCKER.md) for optional TTS setup
- **Deploy to GCP**: See [GCP.md](GCP.md) for production deployment
- **Customize**: Check [README.md](README.md) for customization options

## Need Help?

- Check the full [DOCKER.md](DOCKER.md) guide
- Review [README.md](README.md) for detailed documentation
- Check Docker logs: `docker-compose logs -f`

