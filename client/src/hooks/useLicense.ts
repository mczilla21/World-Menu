import { useSettings } from './useSettings';

export function useLicense() {
  const { settings } = useSettings();
  const isDemo = !settings.license_key || settings.license_key === '';
  const isOwner = settings.license_key === 'OWNER';
  return { isDemo, isOwner, plan: isDemo ? 'demo' : 'pro' };
}
