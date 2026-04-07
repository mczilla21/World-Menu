import { useState, useEffect } from 'react';

interface Discount { id: number; name: string; type: string; value: number; code: string; min_order: number; max_uses: number; used_count: number; schedule_start: string; schedule_end: string; schedule_days: string; is_active: number; }

export default function DiscountManager() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');

  const fetch_ = () => fetch('/api/discounts').then(r => r.json()).then(setDiscounts);
  useEffect(() => { fetch_(); }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await fetch('/api/discounts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type, value: parseFloat(value) || 0, code: code.trim() }) });
    setName(''); setValue(''); setCode('');
    fetch_();
  };

  const toggle = async (d: Discount) => {
    await fetch(`/api/discounts/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, is_active: d.is_active ? 0 : 1 }) });
    fetch_();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this discount?')) return;
    await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Create Discount</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Happy Hour)" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <select value={type} onChange={e => setType(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm">
            <option value="percent">% Off</option>
            <option value="fixed">$ Off</option>
            <option value="bogo">BOGO</option>
          </select>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'percent' ? '% amount' : '$ amount'} type="number" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Code (optional)" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm uppercase" />
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Add</button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Active Discounts</h3>
        <div className="space-y-1.5">
          {discounts.length === 0 && <p className="text-xs text-slate-500">No discounts yet</p>}
          {discounts.map(d => (
            <div key={d.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${d.is_active ? 'bg-slate-700/50' : 'bg-slate-700/20 opacity-50'}`}>
              <div className="flex-1">
                <span className="text-sm font-medium text-white">{d.name}</span>
                <span className="text-xs text-amber-400 ml-2">
                  {d.type === 'percent' ? `${d.value}% off` : d.type === 'fixed' ? `$${d.value} off` : 'BOGO'}
                </span>
                {d.code && <span className="text-xs text-blue-400 ml-2">Code: {d.code}</span>}
              </div>
              <span className="text-xs text-slate-500">Used {d.used_count}x</span>
              <button onClick={() => toggle(d)} className={`text-xs px-2 py-1 rounded ${d.is_active ? 'bg-slate-600 text-slate-300' : 'bg-emerald-900/50 text-emerald-400'}`}>
                {d.is_active ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => remove(d.id)} className="text-xs text-red-400 hover:text-red-300">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
