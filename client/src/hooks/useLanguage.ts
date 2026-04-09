import { useState, useEffect, useCallback } from 'react';

export type DisplayLang = string;

const STORAGE_KEY = 'display_language';

function getStoredLang(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val) return val;
  } catch {}
  return 'en';
}

let listeners: Array<(lang: string) => void> = [];

export function useLanguage() {
  const [lang, setLang] = useState<string>(getStoredLang);

  useEffect(() => {
    const handler = (newLang: string) => setLang(newLang);
    listeners.push(handler);
    return () => { listeners = listeners.filter(l => l !== handler); };
  }, []);

  const setLanguage = useCallback((val: string) => {
    localStorage.setItem(STORAGE_KEY, val);
    setLang(val);
    listeners.forEach(fn => fn(val));
  }, []);

  return { lang, setLanguage };
}

// Display name helper for server/kitchen mode
// In the new system, "name" is always the native language
// Translations come from the translations table
export function displayName(nativeName: string, translatedName: string | undefined, lang: DisplayLang): string {
  if (lang === 'translated' && translatedName) return translatedName;
  if (lang === 'native') return nativeName;
  return nativeName;
}

export function displayNameBoth(nativeName: string, translatedName: string | undefined, lang: DisplayLang): { primary: string; secondary?: string } {
  if (lang === 'translated') return { primary: translatedName || nativeName };
  if (lang === 'native') return { primary: nativeName };
  if (!translatedName) return { primary: nativeName };
  return { primary: nativeName, secondary: translatedName };
}
