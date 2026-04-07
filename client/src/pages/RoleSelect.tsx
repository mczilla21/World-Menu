import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n/useI18n';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hasEmployees, setHasEmployees] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(emps => {
      setHasEmployees(emps.length > 0);
    }).catch(() => setHasEmployees(false));
  }, []);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) handlePinSubmit();
  }, [pin]);

  const handlePinSubmit = async () => {
    if (!pin.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/employees/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.employee) {
        sessionStorage.setItem('wm_employee', JSON.stringify(data.employee));
        const role = data.employee.role;

        // Route based on role
        if (role === 'owner' || role === 'manager') {
          // Owners/managers go to a role picker since they can access everything
          sessionStorage.setItem('wm_access', 'full');
          navigate('/staff-select');
        } else if (role === 'server' || role === 'host') {
          localStorage.setItem('role', 'server');
          navigate('/server');
        } else if (role === 'kitchen') {
          localStorage.setItem('role', 'kitchen');
          navigate('/kitchen');
        } else {
          localStorage.setItem('role', 'server');
          navigate('/server');
        }
      } else {
        setError('Invalid PIN');
        setPin('');
      }
    } catch {
      setError('Connection error');
      setPin('');
    }
  };

  const handleDineIn = () => {
    localStorage.setItem('role', 'customer');
    navigate('/customer');
  };

  // Loading
  if (hasEmployees === null) return <div className="min-h-screen bg-slate-50" />;

  // No employees — redirect to setup wizard
  if (hasEmployees === false) {
    navigate('/setup', { replace: true });
    return <div className="min-h-screen" style={{ background: '#f8fafc' }} />;
  }

  // Main screen — Dine In or Staff Login
  if (!showPin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#f8fafc' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            {settings.logo && (
              <img src={`/uploads/${settings.logo}`} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
            )}
            <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>{settings.restaurant_name}</h1>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleDineIn}
              className="w-full py-6 rounded-2xl font-bold text-xl text-white transition-all active:scale-[0.98]"
              style={{ background: '#22c55e', boxShadow: '0 4px 14px rgba(34,197,94,0.3)' }}
            >
              🍽️ Dine In
            </button>

            <button
              onClick={() => setShowPin(true)}
              className="w-full py-6 rounded-2xl font-bold text-xl text-white transition-all active:scale-[0.98]"
              style={{ background: '#3b82f6', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
            >
              🔑 Staff Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PIN entry screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold" style={{ color: '#0f172a' }}>Staff Login</h2>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Enter your PIN</p>
        </div>

        <div className="p-6 rounded-2xl" style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {/* Hidden input for keyboard typing */}
          <input
            type="tel"
            value={pin}
            onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setPin(v); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && pin.length === 4) handlePinSubmit(); }}
            autoFocus
            autoComplete="off"
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />

          {/* PIN dots */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: error ? '#ef4444' : i < pin.length ? '#0f172a' : '#e2e8f0',
                transition: 'background 0.15s',
              }} />
            ))}
          </div>

          {error && <p className="text-center text-sm mb-4" style={{ color: '#ef4444' }}>{error}</p>}

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map(key => (
              <button
                key={key || 'empty'}
                onClick={() => {
                  if (key === '⌫') { setPin(prev => prev.slice(0, -1)); setError(''); }
                  else if (key && pin.length < 4) { setPin(prev => prev + key); setError(''); }
                }}
                disabled={!key}
                style={{
                  height: 56, border: 'none', borderRadius: 12,
                  fontSize: key === '⌫' ? 18 : 22, fontWeight: 700,
                  cursor: key ? 'pointer' : 'default',
                  background: !key ? 'transparent' : '#f1f5f9',
                  color: key === '⌫' ? '#64748b' : '#0f172a',
                  visibility: key ? 'visible' : 'hidden',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => { setShowPin(false); setPin(''); setError(''); }}
          className="mt-6 text-sm mx-auto block"
          style={{ color: '#94a3b8' }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
