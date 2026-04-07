import { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';

interface Props {
  onSelect: (type: 'dine_in' | 'takeout' | 'pickup', name?: string) => void;
}

export default function OrderTypeSelect({ onSelect }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [selectedType, setSelectedType] = useState<'takeout' | 'pickup' | null>(null);
  const { settings } = useSettings();

  const enabled = (settings.order_types_enabled || 'dine_in,takeout,pickup').split(',').filter(Boolean);

  const types = [
    { key: 'dine_in' as const, label: 'Dine In', icon: '🍽️', color: 'bg-blue-600 hover:bg-blue-500', shadow: 'shadow-blue-600/20' },
    { key: 'takeout' as const, label: 'Takeout', icon: '🥡', color: 'bg-orange-600 hover:bg-orange-500', shadow: 'shadow-orange-600/20' },
    { key: 'pickup' as const, label: 'Pickup', icon: '🚗', color: 'bg-green-600 hover:bg-green-500', shadow: 'shadow-green-600/20' },
  ].filter(t => enabled.includes(t.key));

  const handleTypeSelect = (type: 'dine_in' | 'takeout' | 'pickup') => {
    if (type === 'dine_in') {
      onSelect('dine_in');
    } else {
      setSelectedType(type);
    }
  };

  if (selectedType) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h2 className="text-xl font-bold mb-6">
          {selectedType === 'takeout' ? '🥡 Takeout' : '🚗 Pickup'} Order
        </h2>
        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Customer Name (optional)</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(selectedType, customerName.trim() || undefined)}
              placeholder="Enter name..."
              className="w-full rounded-xl px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-purple-500"
              style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0' }}
              autoFocus
            />
          </div>
          <button
            onClick={() => onSelect(selectedType, customerName.trim() || undefined)}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
              selectedType === 'takeout' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            Continue to Menu
          </button>
          <button
            onClick={() => { setSelectedType(null); setCustomerName(''); }}
            className="w-full py-3 text-slate-400 text-sm hover:text-slate-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-xl font-bold mb-8">Order Type</h2>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {types.map(t => (
          <button
            key={t.key}
            onClick={() => handleTypeSelect(t.key)}
            className={`${t.color} px-6 py-5 rounded-xl font-semibold text-lg transition-all active:scale-[0.98] shadow-lg ${t.shadow} flex items-center gap-3`}
          >
            <span className="text-2xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
