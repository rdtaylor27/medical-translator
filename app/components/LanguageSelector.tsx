'use client';

import { Language, SUPPORTED_LANGUAGES } from '../types/translation';

interface LanguageSelectorProps {
  label: string;
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
  accentColor: string;
}

export default function LanguageSelector({
  label,
  selectedLanguage,
  onLanguageChange,
  accentColor,
}: LanguageSelectorProps) {
  return (
    <div className="space-y-2.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <div className="relative">
        <select
          value={selectedLanguage.code}
          onChange={(e) => {
            const lang = SUPPORTED_LANGUAGES.find((l) => l.code === e.target.value);
            if (lang) onLanguageChange(lang);
          }}
          className="w-full bg-white/50 backdrop-blur-md border border-white/60 rounded-xl pl-4 pr-12 py-3 text-base font-medium appearance-none cursor-pointer transition-all duration-300 hover:bg-white/60 hover:border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 text-slate-800 shadow-sm"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-white text-slate-800">
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none text-xl">
          {selectedLanguage.flag}
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
