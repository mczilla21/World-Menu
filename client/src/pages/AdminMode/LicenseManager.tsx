import { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useLicense } from '../../hooks/useLicense';

export default function LicenseManager() {
  const { settings, updateSetting } = useSettings();
  const { isDemo, isOwner, plan } = useLicense();
  const [keyInput, setKeyInput] = useState('');

  const handleActivate = async () => {
    const key = keyInput.trim().toUpperCase();
    if (!key) return;
    await updateSetting('license_key', key);
    setKeyInput('');
  };

  return (
    <div className="max-w-lg space-y-4">
      {/* Status */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-300">License Status</span>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            isOwner ? 'bg-blue-600 text-white' : isDemo ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {isOwner ? 'Owner' : isDemo ? 'Demo' : 'Pro'}
          </span>
        </div>
        {settings.license_key && (
          <div className="text-xs font-mono text-slate-500 mt-1">{settings.license_key}</div>
        )}
        {isDemo && (
          <p className="text-xs text-slate-500 mt-2">Demo mode: limited tables and employees. Enter a license key to unlock full access.</p>
        )}
      </div>

      {/* Enter key */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">{settings.license_key ? 'Change License Key' : 'Enter License Key'}</h3>
        <div className="flex gap-2">
          <input
            value={keyInput}
            onChange={e => setKeyInput(e.target.value.toUpperCase())}
            placeholder="WM-XXXX-XXXX-XXXX or OWNER"
            className="flex-1 bg-slate-700 rounded-lg px-4 py-3 text-white outline-none text-sm font-mono tracking-wider text-center"
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
          />
          <button
            onClick={handleActivate}
            disabled={!keyInput.trim()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-bold text-white"
          >
            Activate
          </button>
        </div>
      </div>

      {/* Remove key */}
      {settings.license_key && (
        <button
          onClick={() => { if (confirm('Remove license key? App will run in demo mode.')) updateSetting('license_key', ''); }}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove License Key
        </button>
      )}
    </div>
  );
}
