'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Language, SUPPORTED_LANGUAGES, TranscriptEntry, TranslationConfig } from '../types/translation';
import LanguageSelector from './LanguageSelector';
import TranscriptDisplay from './TranscriptDisplay';

type SpeakerRole = 'provider' | 'patient';

interface SpeakerBuffer {
  finalOriginal: string;
  finalTranslated: string;
  partialOriginal: string;
  partialTranslated: string;
  createdSegments: Set<string>;
  lastUpdateTime: number;
  pendingTimeout: NodeJS.Timeout | null;
  hasSourceSinceReset: boolean;
}

const createInitialBuffer = (): SpeakerBuffer => ({
  finalOriginal: '',
  finalTranslated: '',
  partialOriginal: '',
  partialTranslated: '',
  createdSegments: new Set(),
  lastUpdateTime: 0,
  pendingTimeout: null,
  hasSourceSinceReset: false,
});

const isNonEmptyString = (value: any): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const firstNonEmptyString = (...values: any[]): string => {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return '';
};

const firstTextFromArray = (items?: any[]): string => {
  if (!Array.isArray(items)) return '';
  for (const item of items) {
    const text = firstNonEmptyString(
      item?.text,
      item?.translation,
      item?.value,
      item?.content
    );
    if (text) {
      return text;
    }
  }
  return '';
};

const extractMessageOriginal = (message: any): string => {
  const textCandidate = firstNonEmptyString(
    message?.result?.text,
    message?.text,
    message?.full_text,
    message?.transcript,
    message?.original_text,
    message?.result?.original_text,
    message?.display_text
  );
  if (textCandidate) {
    return textCandidate;
  }

  const alternativeCandidate = firstTextFromArray(message?.result?.alternatives);
  if (alternativeCandidate) {
    return alternativeCandidate;
  }

  return firstTextFromArray(message?.alternatives);
};

const extractMessageTranslation = (message: any): string => {
  const translationArrays = [
    message?.translation,
    message?.translations,
    message?.result?.translation,
    message?.result?.translations,
  ];

  for (const arr of translationArrays) {
    const text = firstTextFromArray(arr);
    if (text) {
      return text;
    }
  }

  return firstNonEmptyString(
    message?.translation_text,
    message?.translated_text,
    message?.result?.translation_text,
    message?.result?.translated_text
  );
};

const normalizeLanguageCode = (code?: string) => {
  if (!code) return '';
  return code.toLowerCase().split('-')[0];
};

const extractCandidateLanguage = (token: any) =>
  normalizeLanguageCode(
    token?.language_code ??
      token?.language ??
      token?.lang ??
      token?.language_code_bcp_47 ??
      token?.lang_code
  );

const getTokenTranslations = (token: any) => {
  if (Array.isArray(token?.translation)) return token.translation;
  if (Array.isArray(token?.translations)) return token.translations;
  return [];
};

const findTextForLanguage = (token: any, languageCode: string, disallowLanguage?: string): string | null => {
  if (!token || !languageCode) return null;
  const normalized = normalizeLanguageCode(languageCode);
  if (!normalized) return null;

  const translations = getTokenTranslations(token);
  for (const translation of translations) {
    const translationLanguage = normalizeLanguageCode(
      translation?.language_code ??
        translation?.language ??
        translation?.lang ??
        translation?.language_code_bcp_47 ??
        translation?.lang_code
    );

    if (
      translationLanguage === normalized &&
      translationLanguage !== disallowLanguage &&
      typeof translation?.text === 'string'
    ) {
      return translation.text;
    }
  }

  const tokenLanguage = extractCandidateLanguage(token);
  if (
    tokenLanguage === normalized &&
    tokenLanguage !== disallowLanguage &&
    typeof token?.text === 'string'
  ) {
    return token.text;
  }

  return null;
};

const determineMessageIsFinal = (data: any, tokensAllFinal: boolean) => {
  if (!data) return false;

  const possibleFinalIndicators = [
    data.is_final,
    data.final,
    data.end_of_segment,
    data.segment_end,
    data.end_of_transcript,
    data.result?.is_final,
    data.result?.final,
  ];

  if (possibleFinalIndicators.some((indicator) => indicator === true)) {
    return true;
  }

  const typeStrings = [
    data.type,
    data.message_type,
    data.event,
    data.result?.type,
    data.result?.message_type,
  ];

  if (
    typeStrings.some(
      (value) => typeof value === 'string' && value.toLowerCase().includes('final')
    )
  ) {
    return true;
  }

  return tokensAllFinal;
};

export default function MedicalTranslator() {
  const [config, setConfig] = useState<TranslationConfig>({
    providerLanguage: SUPPORTED_LANGUAGES[0], // English
    patientLanguage: SUPPORTED_LANGUAGES[1], // Spanish
    enableTTS: false,
  });

  const [isActive, setIsActive] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<'provider' | 'patient'>('provider');
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSpeakerRef = useRef<'provider' | 'patient'>(currentSpeaker);
  const configRef = useRef<TranslationConfig>(config);
  const speakerBuffersRef = useRef<Record<SpeakerRole, SpeakerBuffer>>({
    provider: createInitialBuffer(),
    patient: createInitialBuffer(),
  });

  useEffect(() => {
    currentSpeakerRef.current = currentSpeaker;
  }, [currentSpeaker]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const resetSpeakerBuffers = useCallback(() => {
    speakerBuffersRef.current.provider = createInitialBuffer();
    speakerBuffersRef.current.patient = createInitialBuffer();
  }, []);

  const connectWebSocket = useCallback(() => {
    const apiKey = process.env.NEXT_PUBLIC_SONIOX_API_KEY;
    if (!apiKey) {
      console.error('Soniox API key not configured');
      return;
    }

    const ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnecting(false);
      setWsConnected(true);

      // Use refs to get the current values
      const speaker = currentSpeakerRef.current;
      const currentConfig = configRef.current;

      // Send configuration
      const sourceLanguage = speaker === 'provider'
        ? currentConfig.providerLanguage.code
        : currentConfig.patientLanguage.code;

      const targetLanguage = speaker === 'provider'
        ? currentConfig.patientLanguage.code
        : currentConfig.providerLanguage.code;

      // Only include translation if both languages are different
      const configMessage: any = {
        api_key: apiKey,
        model: 'stt-rt-preview',
        audio_format: 'auto',
        include_nonfinal: true,
        language_hints: [sourceLanguage],
      };

      // Add translation only if source and target are different
      if (sourceLanguage !== targetLanguage) {
        configMessage.translation = {
          type: 'one_way',
          target_language: targetLanguage,
        };
        console.log('Sending WebSocket config for speaker:', speaker, 'languageHints:', [sourceLanguage], 'Translation target:', targetLanguage);
      } else {
        console.log('Sending WebSocket config for speaker:', speaker, 'languageHints:', [sourceLanguage], '(no translation)');
      }

      ws.send(JSON.stringify(configMessage));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Check for error responses from Soniox
        if (data.error || data.status === 'error') {
          console.error('Soniox error response:', data);
          return;
        }
        
        console.log('Received WebSocket message for speaker:', currentSpeakerRef.current, data);

        const speaker = currentSpeakerRef.current;
        const sourceLanguageCode =
          speaker === 'provider'
            ? configRef.current.providerLanguage.code
            : configRef.current.patientLanguage.code;
        const targetLanguageCode =
          speaker === 'provider'
            ? configRef.current.patientLanguage.code
            : configRef.current.providerLanguage.code;
        const normalizedSource = normalizeLanguageCode(sourceLanguageCode);
        const normalizedTarget = normalizeLanguageCode(targetLanguageCode);

        const tokens = Array.isArray(data.tokens) ? data.tokens : [];
        const buffer = speakerBuffersRef.current[speaker];

        let finalOriginalAppend = '';
        let finalTranslatedAppend = '';
        let partialOriginalCurrent = '';
        let partialTranslatedCurrent = '';
        let sawSourceToken = false;

        // Soniox sends source and target language tokens separately
        // Source = original speech, Target = translation
        for (const token of tokens) {
          const tokenLanguage = extractCandidateLanguage(token);
          const tokenText = typeof token.text === 'string' ? token.text : '';
          const translationStatus =
            typeof token?.translation_status === 'string'
              ? token.translation_status.toLowerCase()
              : '';
          const isTranslationToken =
            tokenLanguage === normalizedTarget ||
            translationStatus.includes('translation');
          const isLikelySourceToken =
            tokenLanguage === normalizedSource || (!tokenLanguage && !isTranslationToken);

          if (!tokenText) continue;

          const hasMeaningfulText = tokenText.trim().length > 0;

          // Accept source language tokens OR untagged tokens that aren't marked as translations
          if (isLikelySourceToken) {
            if (token.is_final) {
              finalOriginalAppend += tokenText;
            } else {
              partialOriginalCurrent += tokenText;
            }
            if (hasMeaningfulText) {
              sawSourceToken = true;
            }
          }
          // Accept target language tokens ONLY if they come WITH source tokens
          // (translations from Soniox, not wrong-language speech)
          else if (isTranslationToken) {
            const hasSourceContext = buffer.hasSourceSinceReset || sawSourceToken;
            if (!hasSourceContext) {
              continue;
            }
            if (token.is_final) {
              finalTranslatedAppend += tokenText;
            } else {
              partialTranslatedCurrent += tokenText;
            }
          }
        }

        if (sawSourceToken) {
          buffer.hasSourceSinceReset = true;
        }

        // Append new final text fragments to the buffer
        if (finalOriginalAppend.trim().length > 0) {
          buffer.finalOriginal += finalOriginalAppend;
          buffer.lastUpdateTime = Date.now();
        }
        if (finalTranslatedAppend.trim().length > 0) {
          buffer.finalTranslated += finalTranslatedAppend;
          buffer.lastUpdateTime = Date.now();
        }

        // Update partial text (replaces, doesn't append)
        buffer.partialOriginal = partialOriginalCurrent;
        buffer.partialTranslated = partialTranslatedCurrent;

        // Check if the accumulated final text ends with sentence-ending punctuation
        const originalEndsWithPunctuation = /[.!?…]$/.test(buffer.finalOriginal.trim());
        const translatedEndsWithPunctuation = /[.!?…]$/.test(buffer.finalTranslated.trim());
        const endsWithSentencePunctuation = originalEndsWithPunctuation || translatedEndsWithPunctuation;

        // Clear any pending timeout
        if (buffer.pendingTimeout) {
          clearTimeout(buffer.pendingTimeout);
          buffer.pendingTimeout = null;
        }

        // Only create transcript entry when we have a complete sentence
        // and wait 1 second for more text to ensure we capture multi-sentence utterances
        if (endsWithSentencePunctuation) {
          const committedOriginal = buffer.finalOriginal.trim();
          const committedTranslated = buffer.finalTranslated.trim();

          // Must have BOTH original AND translated content with meaningful length
          // This ensures we only show properly translated conversations
          const hasValidTranslation =
            committedOriginal.length > 5 && committedTranslated.length > 5;

          if (hasValidTranslation) {
            // Set a timeout to finalize after 1 second of no new text
            buffer.pendingTimeout = setTimeout(() => {
              const segmentKey = `${committedOriginal}|${committedTranslated}`;

              if (!buffer.createdSegments.has(segmentKey)) {
                buffer.createdSegments.add(segmentKey);

                const entry: TranscriptEntry = {
                  id: `${Date.now()}-${Math.random()}`,
                  speaker,
                  originalText: committedOriginal,
                  translatedText: committedTranslated,
                  timestamp: new Date(),
                  isFinal: true,
                };

                setTranscripts((prev) => [...prev, entry]);

                if (
                  configRef.current.enableTTS &&
                  committedTranslated &&
                  speaker === currentSpeakerRef.current
                ) {
                  speakText(committedTranslated, speaker);
                }

                // Clear buffers after creating entry
                buffer.finalOriginal = '';
                buffer.finalTranslated = '';
                buffer.partialOriginal = '';
                buffer.partialTranslated = '';
                buffer.hasSourceSinceReset = false;
                buffer.pendingTimeout = null;
              }
            }, 1000); // Wait 1 second before finalizing
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
      setWsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', {
        code: event.code,
        reason: event.reason || '(no reason provided)',
        wasClean: event.wasClean,
        speaker: currentSpeakerRef.current
      });
      setIsConnecting(false);
      setWsConnected(false);
    };
  }, [config, currentSpeaker]);

  const speakText = async (text: string, speaker: 'provider' | 'patient') => {
    try {
      const targetLanguage = speaker === 'provider'
        ? config.patientLanguage.code
        : config.providerLanguage.code;

      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: targetLanguage,
          speaker,
        }),
      });

      const data = await response.json();
      
      // Check if TTS is not configured
      if (data.message === 'TTS not configured') {
        console.warn('Azure Speech Services not configured. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to .env.local');
        return;
      }
      
      if (data.error) {
        console.error('TTS error:', data.error, data.details);
        return;
      }
      
      if (data.success && data.audio) {
        // Convert base64 to audio and play it
        const audioData = atob(data.audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }
        
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.play().catch(err => {
          console.error('Error playing audio:', err);
        });
      }
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  };

  const startRecording = async () => {
    try {
      setIsConnecting(true);

      console.log('Requesting microphone access...');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('Microphone access granted');

      // Connect WebSocket first
      connectWebSocket();

      // Wait for WebSocket to open
      await new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve(true);
          }
        }, 100);
      });

      console.log('WebSocket connected, starting audio recording');

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('Sending audio chunk, size:', event.data.size, 'to WebSocket for speaker:', currentSpeakerRef.current);
            const arrayBuffer = await event.data.arrayBuffer();
            wsRef.current.send(arrayBuffer);
          } else {
            console.warn('WebSocket not open, state:', wsRef.current?.readyState, 'audio size:', event.data.size);
          }
        }
      };

      mediaRecorder.start(250); // Send data every 250ms
      setIsActive(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsConnecting(false);
      alert('Failed to access microphone. Please grant permission and try again.');
    }
  };

  const stopRecording = () => {
    // Finalize any pending buffers before stopping
    const speaker = currentSpeakerRef.current;
    const buffer = speakerBuffersRef.current[speaker];
    
    const committedOriginal = buffer.finalOriginal.trim();
    const committedTranslated = buffer.finalTranslated.trim();
    
    // Only create entry if we have BOTH texts and they're substantial
    if (committedOriginal.length > 2 && committedTranslated.length > 2) {
      const segmentKey = `${committedOriginal}|${committedTranslated}`;
      
      if (!buffer.createdSegments.has(segmentKey)) {
        const entry: TranscriptEntry = {
          id: `${Date.now()}-${Math.random()}`,
          speaker,
          originalText: committedOriginal,
          translatedText: committedTranslated,
          timestamp: new Date(),
          isFinal: true,
        };
        setTranscripts((prev) => [...prev, entry]);
      }
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsActive(false);
    resetSpeakerBuffers();
  };

  const switchSpeaker = useCallback(async (newSpeaker: 'provider' | 'patient') => {
    if (newSpeaker === currentSpeakerRef.current) return;
    
    console.log('Switching speaker from', currentSpeakerRef.current, 'to', newSpeaker);
    
    // Update current speaker immediately via ref
    currentSpeakerRef.current = newSpeaker;
    setCurrentSpeaker(newSpeaker);
    
    // If session is active, we need to restart both MediaRecorder and WebSocket
    if (isActive && wsRef.current && mediaRecorderRef.current) {
      console.log('Session is active, restarting MediaRecorder and WebSocket...');
      setWsConnected(false);
      
      // Stop and restart MediaRecorder to get fresh audio stream
      const currentMediaRecorder = mediaRecorderRef.current;
      const stream = currentMediaRecorder.stream;
      
      currentMediaRecorder.stop();
      
      // Close existing WebSocket gracefully
      if (wsRef.current) {
        const currentWs = wsRef.current;
        currentWs.onclose = null; // Remove handler to avoid state updates
        if (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING) {
          currentWs.close();
        }
      }
      
      // Small delay to ensure clean closure
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reconnect WebSocket with new configuration
      console.log('Creating new WebSocket connection...');
      connectWebSocket();
      
      // Wait for the connection to be established
      await new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout;
        const checkInterval = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            console.log('WebSocket reconnected successfully for speaker:', newSpeaker);
            resolve(true);
          }
        }, 50);
        
        // Timeout after 3 seconds
        timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            console.error('WebSocket reconnection timeout - connection not established');
          }
          resolve(false);
        }, 3000);
      });
      
      // Restart MediaRecorder with fresh stream
      console.log('Restarting MediaRecorder...');
      const newMediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = newMediaRecorder;
      
      newMediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('Sending audio chunk, size:', event.data.size, 'to WebSocket for speaker:', currentSpeakerRef.current);
            const arrayBuffer = await event.data.arrayBuffer();
            wsRef.current.send(arrayBuffer);
          } else {
            console.warn('WebSocket not open, state:', wsRef.current?.readyState, 'audio size:', event.data.size);
          }
        }
      };
      
      newMediaRecorder.start(250);
      console.log('MediaRecorder restarted');
    }
  }, [isActive, connectWebSocket]);

  const startProviderSpeaking = () => {
    setCurrentSpeaker('provider');
    currentSpeakerRef.current = 'provider';
    startRecording();
  };

  const startPatientSpeaking = () => {
    setCurrentSpeaker('patient');
    currentSpeakerRef.current = 'patient';
    startRecording();
  };

  const toggleSession = () => {
    if (isActive) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const clearTranscripts = () => {
    setTranscripts([]);
    resetSpeakerBuffers();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Animated background with subtle gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-2 sm:mb-3 text-slate-900 tracking-tight">
            Universal Medical Translator
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-medium">
            Real-Time Language Interpretation System
          </p>
        </div>

        {/* Control Panel */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <LanguageSelector
              label="Provider Language"
              selectedLanguage={config.providerLanguage}
              onLanguageChange={(lang) => setConfig({ ...config, providerLanguage: lang })}
              accentColor="#3b82f6"
            />

            <LanguageSelector
              label="Patient Language"
              selectedLanguage={config.patientLanguage}
              onLanguageChange={(lang) => setConfig({ ...config, patientLanguage: lang })}
              accentColor="#8b5cf6"
            />

            <div className="space-y-4 flex items-center justify-center">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={config.enableTTS}
                    onChange={(e) => setConfig({ ...config, enableTTS: e.target.checked })}
                    className="sr-only"
                  />
                  <div
                    className={`w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${
                      config.enableTTS 
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-emerald-500/30' 
                        : 'bg-slate-200'
                    }`}
                  />
                  <div
                    className={`absolute top-0.5 left-0.5 w-7 h-7 bg-white rounded-full transition-all duration-300 shadow-lg ${
                      config.enableTTS ? 'transform translate-x-6' : ''
                    }`}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  Voice Output (TTS)
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 md:gap-4 mt-4 sm:mt-6 md:mt-8">
            {!isActive ? (
              <>
                <button
                  onClick={startProviderSpeaking}
                  disabled={isConnecting}
                  className="px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none backdrop-blur-sm border border-white/20"
                >
                  {isConnecting && currentSpeaker === 'provider' ? 'Connecting...' : 'Provider Speaking'}
                </button>

                <button
                  onClick={startPatientSpeaking}
                  disabled={isConnecting}
                  className="px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none backdrop-blur-sm border border-white/20"
                >
                  {isConnecting && currentSpeaker === 'patient' ? 'Connecting...' : 'Patient Speaking'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => switchSpeaker('provider')}
                  className={`px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm border ${
                    currentSpeaker === 'provider'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/30 scale-[1.02] border-white/30'
                      : 'bg-white/30 text-blue-600 hover:bg-white/40 border-white/40'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    {currentSpeaker === 'provider' && !wsConnected && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full animate-pulse shadow-lg shadow-amber-400/50"></div>
                    )}
                    {currentSpeaker === 'provider' && wsConnected && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
                    )}
                    <span>Provider Speaking</span>
                  </div>
                </button>

                <button
                  onClick={() => switchSpeaker('patient')}
                  className={`px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm border ${
                    currentSpeaker === 'patient'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/30 scale-[1.02] border-white/30'
                      : 'bg-white/30 text-purple-600 hover:bg-white/40 border-white/40'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    {currentSpeaker === 'patient' && !wsConnected && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full animate-pulse shadow-lg shadow-amber-400/50"></div>
                    )}
                    {currentSpeaker === 'patient' && wsConnected && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
                    )}
                    <span>Patient Speaking</span>
                  </div>
                </button>

                <button
                  onClick={stopRecording}
                  className="px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white backdrop-blur-sm border border-white/20"
                >
                  Stop
                </button>
              </>
            )}

            <button
              onClick={clearTranscripts}
              className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-white/40 hover:bg-white/50 text-slate-700 backdrop-blur-sm border border-white/40"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Transcript Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 h-[400px] sm:h-[500px] lg:h-[600px] shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
            <TranscriptDisplay
              entries={transcripts}
              speaker="provider"
              accentColor="#3b82f6"
              label={`Provider (${config.providerLanguage.flag} ${config.providerLanguage.name})`}
            />
          </div>

          <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 h-[400px] sm:h-[500px] lg:h-[600px] shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
            <TranscriptDisplay
              entries={transcripts}
              speaker="patient"
              accentColor="#8b5cf6"
              label={`Patient (${config.patientLanguage.flag} ${config.patientLanguage.name})`}
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.5);
        }
      `}</style>
    </div>
  );
}
