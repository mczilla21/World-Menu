import { useState, useEffect } from 'react';

interface TaxRate { id: number; name: string; rate: number; applies_to: string; is_active: number; }

export default function TaxManager() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [appliesTo, setAppliesTo] = useState('all');

  const fetch_ = () => fetch('/api/tax-rates').then(r => r.json()).then(setRates);
  useEffect(() => { fetch_(); }, []);

  const handleAdd = async () => {
    if (!name.trim() || !rate) return;
    await fetch('/api/tax-rates', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), rate: parseFloat(rate), applies_to: appliesTo }) });
    setName(''); setRate('');
    fetch_();
  };

  const handleUpdate = async (r: TaxRate, newRate: string) => {
    await fetch(`/api/tax-rates/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...r, rate: parseFloat(newRate) }) });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Tax Rates</h3>
        <div className="space-y-2">
          {rates.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50">
              <span className="text-sm font-medium text-white flex-1">{r.name}</span>
              <span className="text-xs text-slate-400">Applies to: {r.applies_to}</span>
              <div className="flex items-center gap-1">
                <input type="number" step="0.1" defaultValue={r.rate} onBlur={e => handleUpdate(r, e.target.value)}
                  className="w-20 bg-slate-600 rounded px-2 py-1 text-white text-sm text-right outline-none" />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="grid grid-cols-4 gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tax name" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
            <input value={rate} onChange={e => setRate(e.target.value)} placeholder="Rate %" type="number" step="0.1" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
            <select value={appliesTo} onChange={e => setAppliesTo(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm">
              <option value="all">All items</option>
              <option value="food">Food only</option>
              <option value="alcohol">Alcohol only</option>
            </select>
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
