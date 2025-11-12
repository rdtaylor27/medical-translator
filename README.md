# Universal Medical Translator

A next-generation, Star Trek-inspired real-time medical translation application that enables seamless communication between healthcare providers and patients who speak different languages.

## Features

### Core Capabilities
- **Real-Time Speech Recognition** - Leverages Soniox WebSocket API for ultra-low latency transcription
- **Instant Translation** - Translates between any pair of 60+ supported languages in real-time
- **Bidirectional Communication** - Separate channels for provider and patient speech
- **Text-to-Speech Output** - Optional Azure TTS to speak translated text aloud
- **Medical-Grade Accuracy** - SOC 2 Type II certified and HIPAA-ready
- **Futuristic UI** - Star Trek-inspired interface with animated backgrounds and smooth transitions

### User Experience
- Dual-panel display showing provider and patient conversations separately
- Real-time visual feedback with animated status indicators
- Color-coded interfaces (blue for provider, purple for patient)
- Clear distinction between interim and final transcriptions
- Easy language selection with flag icons
- One-click session start/stop
- Speaker toggle to switch between provider and patient input

## Technology Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Speech Recognition**: Soniox WebSocket API (Real-time STT)
- **Translation**: Soniox Translation Service (60+ languages)
- **Text-to-Speech**: Azure Cognitive Services Speech SDK
- **Real-time Communication**: WebSocket connections

## Supported Languages

The application supports 60+ languages including:
- English, Spanish, Chinese, Arabic, French, German
- Hindi, Russian, Portuguese, Japanese, Korean, Vietnamese
- Italian, Polish, Ukrainian, Persian, Turkish, Dutch
- Thai, Swedish, and many more...

## Setup Instructions

### Prerequisites
- Node.js v14 or higher
- Soniox API key ([Get one here](https://console.soniox.com))
- Azure Speech Services key (optional, for TTS) ([Get one here](https://portal.azure.com))

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:

Edit [.env.local](.env.local) and add your API keys:

```env
# Soniox API Key (Required)
SONIOX_API_KEY=your_soniox_api_key_here
NEXT_PUBLIC_SONIOX_API_KEY=your_soniox_api_key_here

# Azure Speech Services (Optional - for TTS)
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=eastus
```

Note: The Soniox API key is already configured. You only need to add Azure credentials if you want text-to-speech functionality.

3. **Run the development server**:
```bash
npm run dev
```

4. **Open the application**:
Navigate to [http://localhost:3001](http://localhost:3001)

## Usage Guide

### Starting a Translation Session

1. **Select Languages**
   - Choose the provider's language from the first dropdown
   - Choose the patient's language from the second dropdown

2. **Enable Text-to-Speech (Optional)**
   - Toggle "Voice Output (TTS)" to enable spoken translations
   - Requires Azure Speech Services configuration

3. **Select Current Speaker**
   - Click "Provider" or "Patient" to indicate who will speak
   - Switch between speakers as needed during conversation

4. **Start Session**
   - Click "Start Session" button
   - Grant microphone permissions when prompted
   - Begin speaking in the selected speaker's language

5. **Monitor Translations**
   - Left panel shows provider's speech and translations
   - Right panel shows patient's speech and translations
   - Real-time transcription appears as you speak
   - Final transcriptions are highlighted

6. **Switch Speakers**
   - Stop the session
   - Select the other speaker
   - Restart the session

7. **Clear History**
   - Click "Clear" to remove all transcript entries

## Architecture

### Component Structure

```
app/
├── components/
│   ├── MedicalTranslator.tsx      # Main translator interface
│   ├── LanguageSelector.tsx       # Language selection dropdown
│   ├── TranscriptDisplay.tsx      # Real-time transcript display
│   └── AudioRecorder.tsx          # Legacy component (not used)
├── api/
│   ├── speak/
│   │   └── route.ts               # Azure TTS API endpoint
│   └── transcribe/
│       └── route.ts               # Legacy endpoint (not used)
├── types/
│   └── translation.ts             # TypeScript interfaces
├── page.tsx                       # Main page
├── layout.tsx                     # Root layout
└── globals.css                    # Global styles
```

### Data Flow

1. **Audio Capture** → MediaRecorder API captures microphone input
2. **WebSocket Connection** → Streams audio to Soniox real-time API
3. **Transcription** → Soniox returns transcribed text in source language
4. **Translation** → Soniox simultaneously translates to target language
5. **Display** → Both original and translated text appear in real-time
6. **Text-to-Speech** → Azure TTS speaks the translated text (if enabled)

## Configuration

### Language Voice Mapping

The application automatically selects appropriate Azure TTS voices for each language. See [app/api/speak/route.ts:5](app/api/speak/route.ts#L5) for the complete voice mapping.

### WebSocket Settings

Real-time transcription uses these parameters:
- Model: `stt-rt-preview`
- Audio Format: `pcm_s16le`
- Sample Rate: `16000 Hz`
- Include Non-Final: `true` (for interim results)

### Customization

You can customize:
- Color schemes in [MedicalTranslator.tsx](app/components/MedicalTranslator.tsx)
- Supported languages in [translation.ts](app/types/translation.ts)
- Voice selections in [speak/route.ts](app/api/speak/route.ts)

## Security Considerations

- **HIPAA Compliance**: Soniox is HIPAA-ready and SOC 2 Type II certified
- **API Keys**: Keep your API keys secure in `.env.local` (never commit to git)
- **Client-Side Keys**: The Soniox API key is exposed to the browser via `NEXT_PUBLIC_*`
  - For production, implement temporary API key generation
  - Use server-side proxy for additional security
- **Data Retention**: Configure data retention policies per your requirements

## Troubleshooting

### Microphone Access
- Ensure browser has microphone permissions
- Check system audio settings
- Try a different browser (Chrome recommended)

### WebSocket Connection Issues
- Verify Soniox API key is correct
- Check network/firewall settings
- Look for errors in browser console

### TTS Not Working

**If you see a 500 error or "TTS not configured" message:**

1. **Get Azure Speech Services credentials** (if you don't have them):
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a "Speech Services" resource
   - Copy the Key and Region

2. **Create `.env.local` file** in the project root with:
```env
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=your_region_here
```

3. **Restart the dev server** after adding credentials:
```bash
npm run dev
```

**Other TTS issues:**
- Verify Azure subscription is active
- Review browser console for detailed error messages
- Check server terminal logs for Azure API errors

### No Translation Appearing
- Ensure different languages are selected for provider and patient
- Check WebSocket connection is established
- Verify speaking clearly and at moderate pace

## Production Deployment

### Docker Deployment (Local Testing)

The application can be containerized using Docker for easy local testing and deployment.

**Quick Start:**
```bash
# Using Docker Compose (Recommended)
docker-compose up --build

# Or using Docker directly
docker build -t medical-translator:latest .
docker run -d -p 3000:3000 --env-file .env.local medical-translator:latest
```

**For detailed Docker instructions, see [DOCKER.md](DOCKER.md)**

### Google Cloud Platform Deployment

Deploy to GCP Cloud Run for scalable, serverless hosting.

**Quick Start:**
```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Build and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/medical-translator:latest
gcloud run deploy medical-translator \
  --image gcr.io/$PROJECT_ID/medical-translator:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

**For detailed GCP deployment instructions, see [GCP.md](GCP.md)**

### Other Deployment Options

1. **Secure API Keys**
   - Implement server-side API key management
   - Use temporary keys for client connections
   - Set up key rotation policies
   - Use Secret Manager (GCP) or similar services

2. **Optimize Performance**
   - Enable compression for audio streams
   - Implement connection pooling
   - Add retry logic for WebSocket failures

3. **Build for Production**
```bash
npm run build
npm start
```

4. **Deploy to Other Platforms**
   - **Vercel**: `vercel deploy`
   - **AWS**: Use AWS App Runner or ECS
   - **Azure**: Use Azure Container Apps
   - Configure environment variables on hosting platform
   - Set up SSL certificates for secure connections

## License

ISC

## Credits

- **Speech Recognition & Translation**: [Soniox](https://soniox.com)
- **Text-to-Speech**: [Azure Cognitive Services](https://azure.microsoft.com/en-us/services/cognitive-services/speech-services/)
- **Framework**: [Next.js](https://nextjs.org)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)

---

**Built with** ❤️ **for healthcare professionals and patients worldwide**
