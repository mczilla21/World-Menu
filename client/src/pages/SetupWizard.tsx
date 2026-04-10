import { useState } from 'react';
import { LANGUAGE_OPTIONS } from '../hooks/useSettings';

const steps = ['Welcome', 'Owner', 'Restaurant', 'Language', 'Tables', 'Ready'];

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  // Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [ownerPinConfirm, setOwnerPinConfirm] = useState('');
  const [langSearch, setLangSearch] = useState('');
  // Restaurant
  const [name, setName] = useState('');
  const [nativeLang, setNativeLang] = useState('en');
  const [supportedLangs, setSupportedLangs] = useState<Set<string>>(new Set(['en']));
  const [tableCount, setTableCount] = useState('10');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [pinError, setPinError] = useState('');

  const handleLogoSelect = (file: File) => {
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleOwnerNext = () => {
    if (!ownerName.trim()) { setPinError('Enter your name'); return; }
    if (ownerPin.length < 4) { setPinError('PIN must be 4 digits'); return; }
    if (ownerPin !== ownerPinConfirm) { setPinError('PINs do not match'); return; }
    setPinError('');
    setStep(2);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // 1. Create owner account
      const empRes = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ownerName.trim(), pin: ownerPin, role: 'owner', hourly_rate: 0 }),
      });
      if (!empRes.ok) throw new Error(`Failed to create owner account: ${empRes.statusText}`);

      // 2. Upload logo
      let logoFilename = '';
      if (logo) {
        const formData = new FormData();
        formData.append('file', logo);
        const res = await fetch('/api/uploads', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`Failed to upload logo: ${res.statusText}`);
        const data = await res.json();
        logoFilename = data.filename || '';
      }

      // 3. Save settings
      const settings: Record<string, string> = {
        restaurant_name: name,
        native_language: nativeLang,
        supported_languages: [...supportedLangs].join(','),
        table_count: tableCount,
        setup_complete: '1',
        sandbox_mode: '1',
        license_key: licenseKey.trim(),
        license_status: licenseKey.trim().startsWith('WM-') || licenseKey.trim() === 'OWNER' ? (licenseKey.trim() === 'OWNER' ? 'owner' : 'active') : 'demo',
      };
      if (logoFilename) settings.logo = logoFilename;

      const settingsRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, pin: ownerPin }),
      });
      if (!settingsRes.ok) throw new Error(`Failed to save settings: ${settingsRes.statusText}`);

      window.location.href = '/';
    } catch (err: any) {
      alert(`Setup failed: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-md">
        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 30 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? '#f59e0b' : '#e2e8f0' }} />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🌍🍜</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>World Menu</h1>
            <p style={{ fontSize: 16, color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>Your restaurant, every language, one system.</p>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>Let's get you set up in 60 seconds.</p>
            <button onClick={() => setStep(1)} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '18px 48px', fontSize: 18, fontWeight: 700, borderRadius: 14, cursor: 'pointer' }}>
              Let's Go!
            </button>
          </div>
        )}

        {/* Step 1: Create Owner Account */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Create Your Account</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>This is the owner/admin account. You'll use this PIN to access everything.</p>

            <div style={{ textAlign: 'left', maxWidth: 360, margin: '0 auto' }}>
              <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 4 }}>Your Name</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="e.g. John"
                style={{ width: '100%', padding: '14px 16px', fontSize: 16, border: '2px solid #e2e8f0', borderRadius: 12, marginBottom: 16, outline: 'none', color: '#0f172a' }} />

              <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 4 }}>Create a 4-digit PIN</label>
              <input value={ownerPin} onChange={e => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 1234"
                type="tel" inputMode="numeric" maxLength={4}
                style={{ width: '100%', padding: '14px 16px', fontSize: 24, fontWeight: 700, textAlign: 'center', letterSpacing: 12, border: '2px solid #e2e8f0', borderRadius: 12, marginBottom: 16, outline: 'none', color: '#0f172a' }} />

              <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 4 }}>Confirm PIN</label>
              <input value={ownerPinConfirm} onChange={e => setOwnerPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Enter PIN again"
                type="tel" inputMode="numeric" maxLength={4}
                style={{ width: '100%', padding: '14px 16px', fontSize: 24, fontWeight: 700, textAlign: 'center', letterSpacing: 12, border: '2px solid #e2e8f0', borderRadius: 12, marginBottom: 8, outline: 'none', color: '#0f172a' }} />

              {pinError && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{pinError}</p>}
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setStep(0)} style={{ background: '#e2e8f0', color: '#64748b', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, cursor: 'pointer' }}>Back</button>
              <button onClick={handleOwnerNext} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: 'pointer' }}>Next</button>
            </div>
          </div>
        )}

        {/* Step 2: Restaurant Name + Logo */}
        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Your Restaurant</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>What's it called?</p>

            <input value={name} onChange={e => setName(e.target.value)} placeholder="Restaurant name" autoFocus
              style={{ width: '100%', padding: '16px', fontSize: 20, fontWeight: 600, border: '2px solid #e2e8f0', borderRadius: 12, marginBottom: 16, outline: 'none', textAlign: 'center', color: '#0f172a' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
              {logoPreview ? (
                <img src={logoPreview} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#94a3b8' }}>📷</div>
              )}
              <label style={{ fontSize: 14, color: '#3b82f6', cursor: 'pointer' }}>
                {logoPreview ? 'Change logo' : 'Add logo (optional)'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleLogoSelect(e.target.files[0])} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setStep(1)} style={{ background: '#e2e8f0', color: '#64748b', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, cursor: 'pointer' }}>Back</button>
              <button onClick={() => setStep(3)} disabled={!name.trim()} style={{ background: name.trim() ? '#3b82f6' : '#cbd5e1', color: '#fff', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: 'pointer' }}>Next</button>
            </div>
          </div>
        )}

        {/* Step 3: Language */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Default Language</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>This sets the language for menus, kitchen tickets, and admin screens. Add more languages later in Settings.</p>

            <input
              value={langSearch}
              onChange={e => setLangSearch(e.target.value)}
              placeholder="Search languages..."
              style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '2px solid #e2e8f0', borderRadius: 10, marginBottom: 12, outline: 'none', color: '#0f172a' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24, textAlign: 'left', maxHeight: 320, overflowY: 'auto' }}>
              {LANGUAGE_OPTIONS.filter(lang => !langSearch || lang.name.toLowerCase().includes(langSearch.toLowerCase()) || lang.code.toLowerCase().includes(langSearch.toLowerCase())).map(lang => (
                <button key={lang.code} onClick={() => { setNativeLang(lang.code); setSupportedLangs(new Set([lang.code])); }}
                  style={{ padding: '12px 14px', borderRadius: 10, border: nativeLang === lang.code ? '2px solid #3b82f6' : '2px solid #e2e8f0', background: nativeLang === lang.code ? '#dbeafe' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                  <b style={{ marginRight: 6, color: '#94a3b8' }}>{lang.flag}</b>{lang.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setStep(2)} style={{ background: '#e2e8f0', color: '#64748b', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, cursor: 'pointer' }}>Back</button>
              <button onClick={() => setStep(4)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: 'pointer' }}>Next</button>
            </div>
          </div>
        )}

        {/* Step 4: Tables */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🪑</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Seating</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>How many seats total? (tables + booths + bar seats) You can set up the exact floor plan later.</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
              <button onClick={() => setTableCount(String(Math.max(1, parseInt(tableCount) - 1)))} style={{ width: 56, height: 56, borderRadius: 12, background: '#f1f5f9', border: 'none', fontSize: 24, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>-</button>
              <input type="tel" inputMode="numeric" value={tableCount} onChange={e => setTableCount(e.target.value.replace(/\D/g, '') || '1')}
                style={{ width: 80, textAlign: 'center', fontSize: 40, fontWeight: 800, background: 'transparent', border: 'none', outline: 'none', color: '#0f172a' }} />
              <button onClick={() => setTableCount(String(parseInt(tableCount) + 1))} style={{ width: 56, height: 56, borderRadius: 12, background: '#f1f5f9', border: 'none', fontSize: 24, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>+</button>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setStep(3)} style={{ background: '#e2e8f0', color: '#64748b', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, cursor: 'pointer' }}>Back</button>
              <button onClick={() => setStep(5)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: 'pointer' }}>Next</button>
            </div>
          </div>
        )}

        {/* Step 5: Ready */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>You're All Set!</h2>

            <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6 }}>License Key (optional)</label>
              <input
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="WM-XXXX-XXXX-XXXX"
                style={{ width: '100%', padding: '12px 14px', fontSize: 15, fontFamily: 'monospace', letterSpacing: 2, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none', color: '#0f172a', textAlign: 'center' }}
              />
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Skip for demo mode (5 tables, 3 employees). Enter a key to unlock full access.</p>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: '#64748b' }}>Owner</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{ownerName} (PIN: {'•'.repeat(ownerPin.length)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: '#64748b' }}>Restaurant</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: '#64748b' }}>Default Language</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{LANGUAGE_OPTIONS.find(l => l.code === nativeLang)?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: '#64748b' }}>Seats</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{tableCount}</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>You can change all of this in Admin → Settings anytime.</p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setStep(4)} style={{ background: '#e2e8f0', color: '#64748b', border: 'none', padding: '14px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, cursor: 'pointer' }}>Back</button>
              <button onClick={handleFinish} disabled={saving} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '18px 48px', fontSize: 18, fontWeight: 700, borderRadius: 14, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Setting up...' : 'Launch World Menu!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
