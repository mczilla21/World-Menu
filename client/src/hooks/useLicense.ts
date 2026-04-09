import { useSettings } from './useSettings';

export function useLicense() {
  const { settings } = useSettings();
  const key = settings.license_key || '';
  const isOwner = key === 'OWNER';
  const isDemo = !key || (!isOwner && !key.startsWith('WM-'));
  const plan = isOwner ? 'owner' : isDemo ? 'demo' : 'pro';
  return { isDemo, isOwner, plan };
}
