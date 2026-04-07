import { useState, useEffect } from 'react';

interface DrawerSession { id: number; employee_id: number; opened_at: string; closed_at: string; starting_amount: number; ending_amount: number; expected_amount: number; cash_in: number; cash_out: number; over_short: number; notes: string; }

export default function CashDrawerManager() {
  const [current, setCurrent] = useState<DrawerSession | null>(null);
  const [history, setHistory] = useState<DrawerSession[]>([]);
  const [startAmount, setStartAmount] = useState('200');
  const [endAmount, setEndAmount] = useState('');
  const [notes, setNotes] = useState('');

  const fetch_ = async () => {
    const [c, h] = await Promise.all([
      fetch('/api/cash-drawer/current').then(r => r.json()),
      fetch('/api/cash-drawer/history').then(r => r.json()),
    ]);
    setCurrent(c.status === 'closed' ? null : c);
    setHistory(h);
  };
  useEffect(() => { fetch_(); }, []);

  const handleOpen = async () => {
    await fetch('/api/cash-drawer/open', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starting_amount: parseFloat(startAmount) || 0 }) });
    fetch_();
  };

  const handleClose = async () => {
    if (!endAmount) return;
    await fetch('/api/cash-drawer/close', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ending_amount: parseFloat(endAmount), notes }) });
    setEndAmount(''); setNotes('');
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Cash Drawer</h3>

        {!current ? (
          <div>
            <p className="text-sm text-slate-400 mb-3">Drawer is closed. Open to start a shift.</p>
            <div className="flex gap-2">
              <input value={startAmount} onChange={e => setStartAmount(e.target.value)} placeholder="Starting amount" type="number" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm w-40" />
              <button onClick={handleOpen} className="bg-emerald-600 hover:bg-emerald-500 rounded-lg px-6 py-2 text-sm font-bold">Open Drawer</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase">Started</div>
                <div className="text-lg font-bold text-white">${current.starting_amount.toFixed(2)}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase">Cash In</div>
                <div className="text-lg font-bold text-emerald-400">${current.cash_in.toFixed(2)}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase">Cash Out</div>
                <div className="text-lg font-bold text-red-400">${current.cash_out.toFixed(2)}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase">Expected</div>
                <div className="text-lg font-bold text-blue-400">${(current.starting_amount + current.cash_in - current.cash_out).toFixed(2)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={endAmount} onChange={e => setEndAmount(e.target.value)} placeholder="Count in drawer" type="number" step="0.01" className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (opt)" className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
              <button onClick={handleClose} className="bg-red-600 hover:bg-red-500 rounded-lg px-6 py-2 text-sm font-bold">Close Drawer</button>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-semibold text-slate-200 mb-3">Shift History</h3>
          <div className="space-y-1.5">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50">
                <div className="flex-1">
                  <span className="text-xs text-slate-400">{h.opened_at?.slice(0, 16)} → {h.closed_at?.slice(11, 16) || '...'}</span>
                </div>
                <span className="text-xs text-slate-400">Start: ${h.starting_amount}</span>
                <span className="text-xs text-slate-400">End: ${h.ending_amount}</span>
                <span className={`text-xs font-bold ${h.over_short >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {h.over_short >= 0 ? '+' : ''}{h.over_short?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
