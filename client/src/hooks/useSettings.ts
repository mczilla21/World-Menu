import { useState, useEffect, useCallback } from 'react';

export interface Settings {
  restaurant_name: string;
  native_language: string;
  supported_languages: string;
  currency_symbol: string;
  table_count: string;
  order_prefix: string;
  theme_color: string;
  customer_mode_enabled: string;
  logo: string;
  [key: string]: string;
}

const defaultSettings: Settings = {
  restaurant_name: 'My Restaurant',
  native_language: 'en',
  supported_languages: 'en',
  currency_symbol: '$',
  table_count: '20',
  order_prefix: 'A',
  theme_color: '#3b82f6',
  customer_mode_enabled: '1',
  logo: '',
  admin_pin: '',
  github_repo: 'mczilla21/World-Menu',
  // v2
  order_types_enabled: 'dine_in,takeout,pickup',
  takeout_only: '0',
  call_waiter_enabled: '1',
  tipping_enabled: '0',
  tip_percentages: '15,18,20',
  // Theme
  app_theme: 'warm-night',
  // Floor plan
  floor_theme: 'dark-wood',
  floor_bg_image: '',
  // Mode
  setup_complete: '0',
  sandbox_mode: '1',
  // License
  license_key: '',
  license_status: 'demo',
  // Payment
  card_surcharge: '3',
  // Idle screen
  idle_screen_enabled: '0',
  idle_screen_timeout: '3',
  idle_screen_message: 'Welcome! Tap to start ordering',
  idle_screen_bg_image: '',
};

let cachedSettings: Settings | null = null;
let listeners: Array<(s: Settings) => void> = [];

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cachedSettings || defaultSettings);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    const handler = (s: Settings) => setSettings(s);
    listeners.push(handler);
    return () => { listeners = listeners.filter(l => l !== handler); };
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const merged = { ...defaultSettings, ...data };
      cachedSettings = merged;
      setSettings(merged);
      listeners.forEach(fn => fn(merged));
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedSettings) fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key: string, value: string) => {
    const previous = cachedSettings;
    const updated = { ...cachedSettings!, [key]: value };
    cachedSettings = updated;
    setSettings(updated);
    listeners.forEach(fn => fn(updated));
    try {
      await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch (e) {
      console.error('Failed to update setting:', e);
      if (previous) {
        cachedSettings = previous;
        setSettings(previous);
        listeners.forEach(fn => fn(previous));
      }
    }
  }, []);

  const updateSettings = useCallback(async (updates: Record<string, string>) => {
    const previous = cachedSettings;
    const updated = { ...cachedSettings!, ...updates };
    cachedSettings = updated;
    setSettings(updated);
    listeners.forEach(fn => fn(updated));
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.error('Failed to update settings:', e);
      if (previous) {
        cachedSettings = previous;
        setSettings(previous);
        listeners.forEach(fn => fn(previous));
      }
    }
  }, []);

  return { settings, loading, fetchSettings, updateSetting, updateSettings };
}

// Supported languages — all major world languages
export const LANGUAGE_OPTIONS = [
  // Top global languages
  { code: 'en', name: 'English', flag: 'EN' },
  { code: 'es', name: 'Español', flag: 'ES' },
  { code: 'zh', name: '中文', flag: 'ZH' },
  { code: 'hi', name: 'हिन्दी', flag: 'HI' },
  { code: 'ar', name: 'العربية', flag: 'AR' },
  { code: 'pt', name: 'Português', flag: 'PT' },
  { code: 'bn', name: 'বাংলা', flag: 'BN' },
  { code: 'ru', name: 'Русский', flag: 'RU' },
  { code: 'ja', name: '日本語', flag: 'JA' },
  { code: 'fr', name: 'Français', flag: 'FR' },
  { code: 'de', name: 'Deutsch', flag: 'DE' },
  { code: 'ko', name: '한국어', flag: 'KO' },
  { code: 'it', name: 'Italiano', flag: 'IT' },
  { code: 'tr', name: 'Türkçe', flag: 'TR' },
  { code: 'vi', name: 'Tiếng Việt', flag: 'VI' },
  { code: 'th', name: 'ไทย', flag: 'TH' },
  { code: 'pl', name: 'Polski', flag: 'PL' },
  { code: 'uk', name: 'Українська', flag: 'UK' },
  { code: 'nl', name: 'Nederlands', flag: 'NL' },
  { code: 'el', name: 'Ελληνικά', flag: 'EL' },
  { code: 'he', name: 'עברית', flag: 'HE' },
  { code: 'sv', name: 'Svenska', flag: 'SV' },
  { code: 'da', name: 'Dansk', flag: 'DA' },
  { code: 'no', name: 'Norsk', flag: 'NO' },
  { code: 'fi', name: 'Suomi', flag: 'FI' },
  { code: 'cs', name: 'Čeština', flag: 'CS' },
  { code: 'ro', name: 'Română', flag: 'RO' },
  { code: 'hu', name: 'Magyar', flag: 'HU' },
  { code: 'id', name: 'Bahasa Indonesia', flag: 'ID' },
  { code: 'ms', name: 'Bahasa Melayu', flag: 'MS' },
  { code: 'tl', name: 'Filipino', flag: 'TL' },
  { code: 'sw', name: 'Kiswahili', flag: 'SW' },
  { code: 'fa', name: 'فارسی', flag: 'FA' },
  { code: 'ur', name: 'اردو', flag: 'UR' },
  { code: 'ta', name: 'தமிழ்', flag: 'TA' },
  { code: 'te', name: 'తెలుగు', flag: 'TE' },
  { code: 'mr', name: 'मराठी', flag: 'MR' },
  { code: 'gu', name: 'ગુજરાતી', flag: 'GU' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: 'PA' },
  { code: 'my', name: 'မြန်မာ', flag: 'MY' },
  { code: 'km', name: 'ខ្មែរ', flag: 'KM' },
  { code: 'lo', name: 'ລາວ', flag: 'LO' },
  { code: 'ne', name: 'नेपाली', flag: 'NE' },
  { code: 'si', name: 'සිංහල', flag: 'SI' },
  { code: 'am', name: 'አማርኛ', flag: 'AM' },
  { code: 'so', name: 'Soomaali', flag: 'SO' },
  { code: 'ht', name: 'Kreyòl Ayisyen', flag: 'HT' },
  { code: 'ka', name: 'ქართული', flag: 'KA' },
  { code: 'hr', name: 'Hrvatski', flag: 'HR' },
  { code: 'sr', name: 'Српски', flag: 'SR' },
  { code: 'bg', name: 'Български', flag: 'BG' },
  { code: 'sk', name: 'Slovenčina', flag: 'SK' },
  { code: 'lt', name: 'Lietuvių', flag: 'LT' },
  { code: 'lv', name: 'Latviešu', flag: 'LV' },
  { code: 'et', name: 'Eesti', flag: 'ET' },
  { code: 'ca', name: 'Català', flag: 'CA' },
  { code: 'eu', name: 'Euskara', flag: 'EU' },
  { code: 'gl', name: 'Galego', flag: 'GL' },
  { code: 'af', name: 'Afrikaans', flag: 'AF' },
  { code: 'zu', name: 'isiZulu', flag: 'ZU' },
];
