import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import FloorPlan from '../KioskMode/FloorPlan';

export default function CustomerEntry() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', textAlign: 'center' }}>
        {settings.logo && (
          <img src={`/uploads/${settings.logo}`} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', margin: '0 auto 8px' }} />
        )}
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{settings.restaurant_name}</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Select your table</p>
      </div>

      {/* Floor Plan */}
      <div className="flex-1 overflow-hidden">
        <FloorPlan
          onSelectTable={(table) => navigate(`/menu/${table.number}`)}
          selectedTable={null}
        />
      </div>

      {/* Back button */}
      <div style={{ padding: '8px 16px', background: '#fff', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
        <button
          onClick={() => { localStorage.removeItem('role'); navigate('/'); }}
          style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
