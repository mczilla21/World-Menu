import { useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n/useI18n';
import { useTheme } from '../hooks/useTheme';

const getModes = (theme: any) => [
  { id: 'server', label: 'Server', desc: 'Orders, tables, & payments', icon: '📋', color: theme.info },
  { id: 'kitchen', label: 'Chef / Kitchen', desc: 'View & complete orders', icon: '👨‍🍳', color: theme.orange },
  { id: 'admin', label: 'Admin Panel', desc: 'Menu, team, finance, settings', icon: '⚙️', color: theme.textMuted },
];

// Manager and owner see all modes; server/kitchen only see their own + admin if owner
const getVisibleModes = (role: string, modes: ReturnType<typeof getModes>) => {
  if (role === 'owner' || role === 'manager') return modes;
  if (role === 'server') return modes.filter(m => m.id === 'server');
  if (role === 'kitchen') return modes.filter(m => m.id === 'kitchen');
  return modes;
};

export default function StaffSelect() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t } = useI18n();
  const theme = useTheme();
  const modes = getModes(theme);

  const employee = (() => {
    try { return JSON.parse(sessionStorage.getItem('wm_employee') || ''); } catch { return null; }
  })();

  if (!employee) {
    navigate('/');
    return null;
  }

  const pick = (mode: string) => {
    // Manager uses server interface with elevated permissions
    const route = mode === 'server' || mode === 'manager' ? 'server' : mode;
    localStorage.setItem('role', route);
    navigate('/' + route);
  };

  const visibleModes = getVisibleModes(employee.role, modes);

  const endShift = async () => {
    if (!confirm(`End shift for ${employee.name}? This will clock you out.`)) return;
    try {
      const res = await fetch('/api/employees/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: employee.pin || '' }),
      });
      const data = await res.json();
      if (data.error && data.error !== 'Not clocked in') {
        alert('Could not clock out: ' + data.error);
        return;
      }
    } catch {
      alert('Could not reach server. Please try again.');
      return;
    }
    sessionStorage.removeItem('wm_employee');
    sessionStorage.removeItem('wm_access');
    localStorage.removeItem('role');
    navigate('/');
  };

  const logout = () => {
    sessionStorage.removeItem('wm_employee');
    sessionStorage.removeItem('wm_access');
    localStorage.removeItem('role');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bgCard} 100%)` }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{settings.restaurant_name}</h1>
          <div className="mt-3 inline-block px-5 py-2.5 rounded-2xl" style={{ background: theme.bgCard, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 14, color: theme.textSecondary }}>Hey </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{employee.name}!</span>
            <span className="ml-2 px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: `${({owner:theme.purple,manager:theme.purple,server:theme.info,kitchen:theme.orange,host:theme.success} as Record<string,string>)[employee.role] || theme.textMuted}20`, color: ({owner:theme.purple,manager:theme.purple,server:theme.info,kitchen:theme.orange,host:theme.success} as Record<string,string>)[employee.role] || theme.textMuted }}>{employee.role}</span>
          </div>
        </div>

        <div className="space-y-3">
          {visibleModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => pick(mode.id)}
              className="w-full py-5 px-5 rounded-2xl text-left transition-all active:scale-[0.96] flex items-center gap-4"
              style={{ background: theme.bgCard, boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: `2px solid ${theme.border}` }}
            >
              <span style={{ fontSize: 28, width: 44, textAlign: 'center' }}>{mode.icon}</span>
              <div className="flex-1">
                <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>{t(mode.label)}</div>
                <div className="text-xs" style={{ color: theme.textSecondary }}>{t(mode.desc)}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: mode.color }} />
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-4">
          {employee.role !== 'owner' && employee.role !== 'manager' && (
            <button onClick={endShift} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              🕐 End Shift
            </button>
          )}
          <button onClick={logout} className="text-sm" style={{ color: theme.textMuted }}>
            {employee.role === 'owner' || employee.role === 'manager' ? 'Logout' : 'Switch User'}
          </button>
        </div>
      </div>
    </div>
  );
}
