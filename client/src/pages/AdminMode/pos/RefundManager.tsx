import { useState, useEffect } from 'react';

interface Refund { id: number; order_id: number; order_item_id: number; amount: number; reason: string; type: string; employee_name: string; created_at: string; }

export default function RefundManager() {
  const [refunds, setRefunds] = useState<Refund[]>([]);

  useEffect(() => {
    fetch('/api/refunds').then(r => r.json()).then(setRefunds);
  }, []);

  const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0);
  const totalVoids = refunds.filter(r => r.type === 'void').reduce((s, r) => s + r.amount, 0);
  const totalComps = refunds.filter(r => r.type === 'comp').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Refund & Void History</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase">Refunds</div>
            <div className="text-lg font-bold text-red-400">${totalRefunds.toFixed(2)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase">Voids</div>
            <div className="text-lg font-bold text-amber-400">${totalVoids.toFixed(2)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase">Comps</div>
            <div className="text-lg font-bold text-purple-400">${totalComps.toFixed(2)}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          {refunds.length === 0 && <p className="text-xs text-slate-500">No refunds or voids yet</p>}
          {refunds.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700/50">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                r.type === 'void' ? 'bg-amber-600/20 text-amber-400' :
                r.type === 'comp' ? 'bg-purple-600/20 text-purple-400' : 'bg-red-600/20 text-red-400'
              }`}>{r.type}</span>
              <div className="flex-1">
                <span className="text-sm text-white">Order #{r.order_id}</span>
                <span className="text-xs text-slate-400 ml-2">{r.reason}</span>
              </div>
              {r.employee_name && <span className="text-xs text-slate-500">{r.employee_name}</span>}
              <span className="text-sm font-bold text-red-400">-${r.amount.toFixed(2)}</span>
              <span className="text-xs text-slate-500">{r.created_at?.slice(0, 16)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
