import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n/useI18n';
import { useTheme } from '../hooks/useTheme';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t } = useI18n();
  const theme = useTheme();
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
  const submittingRef = useRef(false);
  useEffect(() => {
    if (pin.length === 4 && !submittingRef.current) {
      submittingRef.current = true;
      handlePinSubmit().finally(() => { submittingRef.current = false; });
    }
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
        const { pin: empPin, ...empWithoutPin } = data.employee;
        sessionStorage.setItem('wm_employee', JSON.stringify(empWithoutPin));
        // Store pin separately for clock-out only
        sessionStorage.setItem('wm_pin', empPin);
        const role = data.employee.role;

        // Set display language to employee's preference (or system default)
        if (data.employee.language) {
          localStorage.setItem('wm_display_lang', 'translated');
        }

        // Auto clock-in for hourly staff only (not owners/managers)
        if (role !== 'owner' && role !== 'manager') try {
          const clockRes = await fetch('/api/employees/clock-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin.trim() }),
          });
          const clockData = await clockRes.json();
          if (clockData.entry) {
            sessionStorage.setItem('wm_clocked_in', '1');
          } else if (clockData.error === 'Already clocked in') {
            sessionStorage.setItem('wm_clocked_in', '1');
          }
        } catch {}

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bgCard} 100%)` }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            {settings.logo && (
              <img src={`/uploads/${settings.logo}`} alt="" style={{ width: 80, height: 80, borderRadius: 24, objectFit: 'cover', margin: '0 auto 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            )}
            <h1 style={{ fontSize: 28, fontWeight: 800, color: theme.text, marginBottom: 4 }}>{settings.restaurant_name}</h1>
            <p style={{ fontSize: 14, color: theme.textSecondary }}>Welcome! What can we do for you?</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleDineIn}
              className="w-full py-7 rounded-3xl font-bold text-xl text-white transition-all active:scale-[0.97]"
              style={{ background: `linear-gradient(135deg, ${theme.success} 0%, ${theme.successDark} 100%)`, boxShadow: `0 6px 20px ${theme.success}40` }}
            >
              <span style={{ fontSize: 28, display: 'block', marginBottom: 4 }}>🍜</span>
              Dine In
            </button>

            <button
              onClick={() => setShowPin(true)}
              className="w-full py-5 rounded-3xl font-bold text-lg text-white transition-all active:scale-[0.97]"
              style={{ background: `linear-gradient(135deg, ${theme.info} 0%, ${theme.infoDark} 100%)`, boxShadow: `0 6px 20px ${theme.info}40` }}
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: theme.bg }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>Welcome Back!</h2>
          <p style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>Enter your 4-digit PIN</p>
        </div>

        <div className="p-6 rounded-3xl" style={{ background: theme.bgCard, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
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
                width: 20, height: 20, borderRadius: '50%',
                background: error ? theme.danger : i < pin.length ? theme.primary : theme.border,
                transition: 'all 0.2s',
                transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
                boxShadow: i < pin.length ? `0 2px 8px ${theme.primary}40` : 'none',
              }} />
            ))}
          </div>

          {error && <p className="text-center text-sm mb-4" style={{ color: theme.danger }}>{error}</p>}

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map(key => (
              <button
                key={key || 'empty'}
                aria-label={key === '⌫' ? 'Delete last digit' : key ? `Digit ${key}` : undefined}
                onClick={() => {
                  if (key === '⌫') { setPin(prev => prev.slice(0, -1)); setError(''); }
                  else if (key && pin.length < 4) { setPin(prev => prev + key); setError(''); }
                }}
                disabled={!key}
                style={{
                  height: 60, border: 'none', borderRadius: 16,
                  fontSize: key === '⌫' ? 20 : 24, fontWeight: 700,
                  cursor: key ? 'pointer' : 'default',
                  background: !key ? 'transparent' : theme.bgInput,
                  color: key === '⌫' ? theme.textMuted : theme.text,
                  visibility: key ? 'visible' : 'hidden',
                  transition: 'all 0.1s',
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
          style={{ color: theme.textMuted }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
