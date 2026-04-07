import { useSettings } from '../hooks/useSettings';
import translations from './translations';

export function useI18n() {
  const { settings } = useSettings();
  const lang = settings.native_language || 'en';

  const t = (key: string): string => {
    if (lang === 'en') return key;
    return translations[key]?.[lang] || key;
  };

  return { t, lang };
}
