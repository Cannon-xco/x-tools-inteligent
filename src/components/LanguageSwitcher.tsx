'use client';

import { useLanguage } from '@/lib/i18n/context';
import type { Lang } from '@/lib/i18n/translations';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'id', label: 'ID', flag: '🇮🇩' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
];

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5 ${className}`}>
      {LANGS.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
            lang === code
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          aria-pressed={lang === code}
          title={`Switch to ${label}`}
        >
          <span>{flag}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
