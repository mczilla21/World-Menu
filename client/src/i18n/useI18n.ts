import { useSettings } from '../hooks/useSettings';
import translations from './translations';

function getEmployeeLanguage(): string {
  try {
    const emp = JSON.parse(sessionStorage.getItem('wm_employee') || '');
    return emp?.language || '';
  } catch { return ''; }
}

export function useI18n() {
  const { settings } = useSettings();
  // Employee's preferred language overrides system default
  const employeeLang = getEmployeeLanguage();
  const lang = employeeLang || settings.native_language || 'en';

  const t = (key: string): string => {
    if (lang === 'en') return key;
    return translations[key]?.[lang] || key;
  };

  return { t, lang };
}
