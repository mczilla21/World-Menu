import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
  allowedRoles: string[];
}

// Check if employees exist — if not, allow free access (first-time setup)
// If employees exist, require a valid session
export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const [checking, setChecking] = useState(true);
  const [hasEmployees, setHasEmployees] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(emps => {
        if (emps.length === 0) {
          // No employees set up — allow everything (first-time setup)
          setAuthorized(true);
        } else {
          setHasEmployees(true);
          // Check if there's a valid session
          const session = sessionStorage.getItem('wm_employee');
          if (session) {
            try {
              const emp = JSON.parse(session);
              const roleAccess: Record<string, string[]> = {
                owner: ['server', 'kitchen', 'kiosk', 'admin'],
                manager: ['server', 'kitchen', 'kiosk', 'admin'],
                server: ['server'],
                kitchen: ['kitchen'],
                host: ['server'],
              };
              const allowed = roleAccess[emp.role] || [];
              setAuthorized(allowedRoles.some(r => allowed.includes(r)));
            } catch {
              setAuthorized(false);
            }
          }
        }
        setChecking(false);
      })
      .catch(() => { setAuthorized(true); setChecking(false); });
  }, [allowedRoles]);

  if (checking) return <div className="min-h-screen bg-slate-50" />;
  if (!authorized) return <Navigate to="/" replace />;
  return <>{children}</>;
}
