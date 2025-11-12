'use client';

import { TranscriptEntry } from '../types/translation';
import { useEffect, useRef } from 'react';

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  speaker: 'provider' | 'patient';
  accentColor: string;
  label: string;
}

export default function TranscriptDisplay({
  entries,
  speaker,
  accentColor,
  label,
}: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Filter entries - only show entries that have BOTH original and translated text
  const filteredEntries = entries.filter((entry) => {
    const hasOriginal = entry.originalText.trim().length > 0;
    const hasTranslated = entry.translatedText.trim().length > 0;
    
    // Must have both to display
    return hasOriginal && hasTranslated;
  });

  const renderText = (entry: TranscriptEntry) => {
    // Each pane shows text in their own language
    // If Provider spoke: originalText is English, translatedText is Spanish
    // If Patient spoke: originalText is Spanish, translatedText is English
    
    if (speaker === 'provider') {
      // Provider pane should always show English
      if (entry.speaker === 'provider') {
        return entry.originalText; // Provider spoke English
      } else {
        return entry.translatedText; // Patient spoke Spanish, show English translation
      }
    } else {
      // Patient pane should always show Spanish
      if (entry.speaker === 'patient') {
        return entry.originalText; // Patient spoke Spanish
      } else {
        return entry.translatedText; // Provider spoke English, show Spanish translation
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/30">
        <h3 className="text-lg font-semibold text-slate-800">
          {label}
        </h3>
        <div className="flex items-center space-x-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse shadow-lg"
            style={{ 
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}40`
            }}
          />
          <span className="text-xs font-medium text-slate-600">
            ACTIVE
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar"
      >
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-center text-slate-500 font-medium">
              Waiting for speech input...
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`p-4 rounded-xl backdrop-blur-sm transition-all duration-300 shadow-sm border ${
                entry.isFinal 
                  ? 'bg-white/50 border-white/40' 
                  : 'bg-white/40 border-l-4 border-white/60'
              }`}
              style={{
                borderLeftColor: entry.isFinal ? undefined : accentColor,
              }}
            >
              <div className="flex items-start justify-between mb-2.5">
                <span className="text-xs font-medium text-slate-500">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                {!entry.isFinal && (
                  <span 
                    className="text-xs animate-pulse"
                    style={{ color: accentColor }}
                  >
                    ●
                  </span>
                )}
              </div>
              <p className="text-base leading-relaxed text-slate-800 font-medium">
                {renderText(entry)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
