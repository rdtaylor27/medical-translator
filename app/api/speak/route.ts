import { NextRequest, NextResponse } from 'next/server';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const LANGUAGE_TO_VOICE_MAP: Record<string, string> = {
  en: 'en-US-AvaMultilingualNeural',
  es: 'es-ES-ElviraNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ar: 'ar-SA-ZariyahNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  hi: 'hi-IN-SwaraNeural',
  ru: 'ru-RU-SvetlanaNeural',
  pt: 'pt-BR-FranciscaNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
  vi: 'vi-VN-HoaiMyNeural',
  it: 'it-IT-ElsaNeural',
  pl: 'pl-PL-ZofiaNeural',
  uk: 'uk-UA-PolinaNeural',
  fa: 'fa-IR-DilaraNeural',
  tr: 'tr-TR-EmelNeural',
  nl: 'nl-NL-ColetteNeural',
  th: 'th-TH-PremwadeeNeural',
  sv: 'sv-SE-SofieNeural',
};

export async function POST(request: NextRequest) {
  try {
    const { text, language, speaker } = await request.json();

    console.log('TTS Request:', { text: text?.substring(0, 50), language, speaker });

    if (!text || !language) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const speechKey = process.env.AZURE_SPEECH_KEY;
    const serviceRegion = process.env.AZURE_SPEECH_REGION;

    console.log('Azure credentials check:', {
      hasKey: !!speechKey,
      hasRegion: !!serviceRegion,
      region: serviceRegion
    });

    if (!speechKey || !serviceRegion) {
      console.warn('Azure Speech credentials not configured - TTS disabled');
      return NextResponse.json({
        message: 'TTS not configured',
        note: 'Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to .env.local'
      }, { status: 200 });
    }

    // Get appropriate voice for language
    const voiceName = LANGUAGE_TO_VOICE_MAP[language] || 'en-US-AvaMultilingualNeural';

    console.log('Creating speech config with voice:', voiceName);

    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, serviceRegion);
    speechConfig.speechSynthesisVoiceName = voiceName;
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    console.log('Creating synthesizer...');

    // Use null output to get audio data without trying to play it
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null as any);

    console.log('Starting speech synthesis...');

    return new Promise((resolve) => {
      synthesizer.speakTextAsync(
        text,
        (result) => {
          console.log('Synthesis result:', { 
            reason: result.reason, 
            audioLength: result.audioData?.byteLength 
          });

          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            // Convert audio data to base64
            const audioData = result.audioData;
            const base64Audio = Buffer.from(audioData).toString('base64');
            
            console.log('Synthesis successful, audio size:', base64Audio.length);
            
            synthesizer.close();
            resolve(
              NextResponse.json({
                success: true,
                audio: base64Audio,
                format: 'mp3',
              })
            );
          } else {
            console.error('Synthesis failed with reason:', result.reason);
            synthesizer.close();
            resolve(
              NextResponse.json(
                { error: 'Speech synthesis failed', reason: result.reason },
                { status: 500 }
              )
            );
          }
        },
        (error) => {
          console.error('Speech synthesis error:', error);
          synthesizer.close();
          resolve(
            NextResponse.json(
              { error: 'Speech synthesis error', details: error.toString() },
              { status: 500 }
            )
          );
        }
      );
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Failed to synthesize speech', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
