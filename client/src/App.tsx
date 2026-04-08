import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RoleSelect from './pages/RoleSelect';
import SetupWizard from './pages/SetupWizard';
import StaffSelect from './pages/StaffSelect';
import OfflineIndicator from './components/OfflineIndicator';
import ProtectedRoute from './components/ProtectedRoute';
import { useSettings } from './hooks/useSettings';

const ServerMode = lazy(() => import('./pages/ServerMode/ServerMode'));
const KitchenMode = lazy(() => import('./pages/KitchenMode/KitchenMode'));
const AdminMode = lazy(() => import('./pages/AdminMode/AdminMode'));
const CustomerEntry = lazy(() => import('./pages/CustomerMode/CustomerEntry'));
const CustomerMenu = lazy(() => import('./pages/CustomerMode/CustomerMenu'));

export default function App() {
  const { settings, loading } = useSettings();

  if (loading) return <div className="min-h-screen" style={{ background: '#f8fafc' }} />;

  const needsSetup = !settings.setup_complete || settings.setup_complete !== '1';

  return (
    <>
      <OfflineIndicator />
      {settings.sandbox_mode === '1' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ transform: 'rotate(-35deg)', fontSize: 120, fontWeight: 900, color: 'rgba(249,115,22,0.08)', whiteSpace: 'nowrap', userSelect: 'none', letterSpacing: 8 }}>
            SANDBOX
          </div>
        </div>
      )}
      <Suspense fallback={<div className="min-h-screen" style={{background:'#f8fafc'}} />}>
        <Routes>
          {needsSetup ? (
            <>
              <Route path="/setup" element={<SetupWizard />} />
              <Route path="*" element={<Navigate to="/setup" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<RoleSelect />} />
              <Route path="/setup" element={<SetupWizard />} />
              <Route path="/staff-select" element={<StaffSelect />} />
              <Route path="/customer" element={<CustomerEntry />} />
              <Route path="/server" element={<ProtectedRoute allowedRoles={['server']}><ServerMode /></ProtectedRoute>} />
              <Route path="/kitchen" element={<ProtectedRoute allowedRoles={['kitchen']}><KitchenMode /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminMode /></ProtectedRoute>} />
              <Route path="/menu/:tableNumber" element={<CustomerMenu />} />
              <Route path="/menu" element={<CustomerMenu />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </Suspense>
    </>
  );
}
