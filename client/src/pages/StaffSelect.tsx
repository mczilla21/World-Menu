import { useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n/useI18n';

const modes = [
  { id: 'server', label: 'Server', desc: 'Take & manage orders', icon: '📋', color: '#3b82f6' },
  { id: 'kitchen', label: 'Chef / Kitchen', desc: 'View & complete orders', icon: '👨‍🍳', color: '#f97316' },
  { id: 'kiosk', label: 'POS / Register', desc: 'Floor plan & payments', icon: '💰', color: '#8b5cf6' },
  { id: 'admin', label: 'Admin Panel', desc: 'Menu, settings, reports', icon: '⚙️', color: '#475569' },
];

export default function StaffSelect() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t } = useI18n();

  const employee = (() => {
    try { return JSON.parse(sessionStorage.getItem('wm_employee') || ''); } catch { return null; }
  })();

  if (!employee) {
    navigate('/');
    return null;
  }

  const pick = (mode: string) => {
    localStorage.setItem('role', mode);
    navigate('/' + mode);
  };

  const logout = () => {
    sessionStorage.removeItem('wm_employee');
    sessionStorage.removeItem('wm_access');
    localStorage.removeItem('role');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold" style={{ color: '#0f172a' }}>{settings.restaurant_name}</h1>
          <div className="mt-3 inline-block px-4 py-2 rounded-xl" style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <span className="text-sm" style={{ color: '#64748b' }}>Welcome, </span>
            <span className="text-sm font-bold" style={{ color: '#0f172a' }}>{employee.name}</span>
            <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>{employee.role}</span>
          </div>
        </div>

        <div className="space-y-3">
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => pick(mode.id)}
              className="w-full py-5 px-5 rounded-2xl text-left transition-all active:scale-[0.98] flex items-center gap-4"
              style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
            >
              <span className="text-2xl w-10 text-center">{mode.icon}</span>
              <div className="flex-1">
                <div className="font-semibold" style={{ color: '#0f172a' }}>{t(mode.label)}</div>
                <div className="text-xs" style={{ color: '#94a3b8' }}>{t(mode.desc)}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: mode.color }} />
            </button>
          ))}
        </div>

        <button onClick={logout} className="mt-6 text-sm mx-auto block" style={{ color: '#94a3b8' }}>
          Logout
        </button>
      </div>
    </div>
  );
}
