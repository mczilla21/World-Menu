import { Routes, Route, Navigate } from 'react-router-dom';
import RoleSelect from './pages/RoleSelect';
import ServerMode from './pages/ServerMode/ServerMode';
import KitchenMode from './pages/KitchenMode/KitchenMode';
import AdminMode from './pages/AdminMode/AdminMode';
import CustomerEntry from './pages/CustomerMode/CustomerEntry';
import CustomerMenu from './pages/CustomerMode/CustomerMenu';
import SetupWizard from './pages/SetupWizard';
import StaffSelect from './pages/StaffSelect';
import KioskMode from './pages/KioskMode/KioskMode';
import OfflineIndicator from './components/OfflineIndicator';
import ProtectedRoute from './components/ProtectedRoute';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const { settings, loading } = useSettings();

  if (loading) return <div className="min-h-screen" style={{ background: '#f8fafc' }} />;

  const needsSetup = !settings.setup_complete || settings.setup_complete !== '1';

  return (
    <>
      <OfflineIndicator />
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
            <Route path="/kiosk" element={<ProtectedRoute allowedRoles={['kiosk']}><KioskMode /></ProtectedRoute>} />
            <Route path="/menu/:tableNumber" element={<CustomerMenu />} />
            <Route path="/menu" element={<CustomerMenu />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </>
  );
}
