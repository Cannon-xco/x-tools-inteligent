'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type Lang, type TranslationKey, translations } from './translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translations[key].en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const stored = localStorage.getItem('xtools_lang') as Lang | null;
    if (stored && ['en', 'id', 'ru'].includes(stored)) {
      setLangState(stored);
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('xtools_lang', l);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => translations[key][lang],
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
