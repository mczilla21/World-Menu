import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-color', settings.theme_color);
  }, [settings.theme_color]);

  return <>{children}</>;
}
