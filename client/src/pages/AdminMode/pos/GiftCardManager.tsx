import { useState, useEffect } from 'react';

interface GiftCard { id: number; code: string; balance: number; original_amount: number; customer_name: string; is_active: number; created_at: string; }

export default function GiftCardManager() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [amount, setAmount] = useState('25');
  const [customerName, setCustomerName] = useState('');
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);

  const fetch_ = () => fetch('/api/gift-cards').then(r => r.json()).then(setCards);
  useEffect(() => { fetch_(); }, []);

  const handleCreate = async () => {
    if (!amount) return;
    await fetch('/api/gift-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), customer_name: customerName }) });
    setCustomerName('');
    fetch_();
  };

  const handleCheck = async () => {
    if (!checkCode.trim()) return;
    const res = await fetch(`/api/gift-cards/${encodeURIComponent(checkCode.trim())}`);
    setCheckResult(await res.json());
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Create Gift Card</h3>
        <div className="grid grid-cols-3 gap-2">
          <select value={amount} onChange={e => setAmount(e.target.value)} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm">
            <option value="15">$15</option>
            <option value="25">$25</option>
            <option value="50">$50</option>
            <option value="75">$75</option>
            <option value="100">$100</option>
          </select>
          <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (opt)" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2 text-sm font-bold">Create Card</button>
        </div>
      </div>

      {/* Check balance */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Check Balance</h3>
        <div className="flex gap-2">
          <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Enter gift card code" className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm uppercase font-mono" />
          <button onClick={handleCheck} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Check</button>
        </div>
        {checkResult && (
          <div className="mt-3 p-3 rounded-lg bg-slate-700/50">
            {checkResult.error ? (
              <span className="text-sm text-red-400">{checkResult.error}</span>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-mono">{checkResult.code}</span>
                <span className="text-lg font-bold text-emerald-400">${checkResult.balance.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All cards */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Gift Cards ({cards.length})</h3>
        <div className="space-y-1.5">
          {cards.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50">
              <span className="text-sm font-mono font-bold text-blue-400">{c.code}</span>
              <span className="text-xs text-slate-400 flex-1">{c.customer_name || 'Anonymous'}</span>
              <span className="text-xs text-slate-500">${c.original_amount} original</span>
              <span className={`text-sm font-bold ${c.balance > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>${c.balance.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
