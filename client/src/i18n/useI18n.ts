import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import translations from './translations';

function getEmployeeLanguage(): string {
  try {
    const emp = JSON.parse(sessionStorage.getItem('wm_employee') || '');
    return emp?.language || '';
  } catch { return ''; }
}

export function useI18n() {
  const { settings } = useSettings();
  const { lang: displayLang } = useLanguage();
  // Priority: globe toggle > employee preference > system native language
  const employeeLang = getEmployeeLanguage();
  const lang = displayLang || employeeLang || settings.native_language || 'en';

  const t = (key: string): string => {
    if (lang === 'en') return key;
    return translations[key]?.[lang] || key;
  };

  return { t, lang };
}
