import { useSettings } from './useSettings';
import { getTheme, type Theme } from '../theme';

export function useTheme(): Theme {
  const { settings } = useSettings();
  return getTheme(settings.app_theme);
}
