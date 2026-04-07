import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';

interface FloorTable {
  id: number;
  label: string;
  type: string;
  capacity: number;
}

export default function CustomerEntry() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const navigate = useNavigate();
  const { settings } = useSettings();

  useEffect(() => {
    fetch('/api/floor-tables').then(r => r.json()).then(setTables).catch(() => {});
  }, []);

  const handleGo = () => {
    if (!selectedTable) return;
    navigate(`/menu/${selectedTable}`);
  };

  const typeStyles: Record<string, { bg: string; border: string; radius: string }> = {
    table: { bg: '#dcfce7', border: '#86efac', radius: '12px' },
    booth: { bg: '#fef3c7', border: '#fcd34d', radius: '8px 8px 20px 20px' },
    bar: { bg: '#dbeafe', border: '#93c5fd', radius: '50%' },
    patio: { bg: '#e0e7ff', border: '#a5b4fc', radius: '16px' },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          {settings.logo && (
            <img src={`/uploads/${settings.logo}`} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{settings.restaurant_name}</h1>
          <p className="text-sm text-gray-500 mt-1">Select your table</p>
        </div>

        {tables.length > 0 ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {tables.map(t => {
                const ts = typeStyles[t.type] || typeStyles.table;
                const isSelected = selectedTable === t.label;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t.label)}
                    style={{
                      width: t.type === 'bar' ? 56 : t.type === 'booth' ? 90 : 72,
                      height: t.type === 'bar' ? 56 : 64,
                      borderRadius: ts.radius,
                      border: isSelected ? '3px solid #3b82f6' : `2px solid ${ts.border}`,
                      background: isSelected ? '#dbeafe' : ts.bg,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column' as const,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{t.label}</span>
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{t.type}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleGo}
              disabled={!selectedTable}
              className="w-full mt-4 py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
              style={{ background: selectedTable ? (settings.theme_color || '#3b82f6') : '#cbd5e1', color: '#fff' }}
            >
              {selectedTable ? `Go to ${selectedTable}` : 'Select a table'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-3">
            <input
              type="tel"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleGo()}
              placeholder="Table #"
              className="w-full border border-gray-200 rounded-xl px-4 py-5 text-3xl font-bold text-center outline-none focus:border-blue-500 text-gray-900 bg-white mb-3"
              autoFocus
            />
            <button
              onClick={handleGo}
              disabled={!selectedTable}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
              style={{ background: settings.theme_color || '#3b82f6', color: '#fff' }}
            >
              Go
            </button>
          </div>
        )}

        <button
          onClick={() => { localStorage.removeItem('role'); navigate('/'); }}
          className="mt-4 text-xs text-gray-300 hover:text-gray-500 mx-auto block"
        >
          Back
        </button>
      </div>
    </div>
  );
}
