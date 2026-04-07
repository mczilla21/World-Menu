import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

interface ServiceCall {
  id: number;
  table_number: string;
  call_type: string;
  status: string;
  created_at: string;
}

export default function ServiceCallBadge() {
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/service/calls');
      setCalls(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const playAlert = useCallback((type: 'waiter' | 'check') => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'check') {
        // Urgent double ding for check request
        osc.frequency.value = 1047;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      } else {
        // Single bell for waiter call
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      }
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, []);

  const handleWs = useCallback((msg: any) => {
    if (msg.type === 'WAITER_CALLED') {
      fetchCalls();
      const call = msg.call;
      playAlert(call?.call_type === 'check_requested' ? 'check' : 'waiter');
    } else if (msg.type === 'CALL_RESOLVED') {
      fetchCalls();
    }
  }, [fetchCalls, playAlert]);

  useWebSocket('server', handleWs);

  const handleAcknowledge = async (id: number) => {
    await fetch(`/api/service/calls/${id}/resolve`, { method: 'PATCH' });
    setCalls(prev => prev.filter(c => c.id !== id));
  };

  const checkCalls = calls.filter(c => c.call_type === 'check_requested');
  const waiterCalls = calls.filter(c => c.call_type !== 'check_requested');

  if (calls.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
          checkCalls.length > 0
            ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 animate-pulse'
            : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
          {calls.length}
        </span>
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowDropdown(false)} />
          <div className="fixed right-2 left-2 top-14 sm:left-auto sm:right-4 sm:w-80 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: '#fff', border: '1px solid #e2e8f0', maxHeight: '80vh' }}>
            <div className="px-3 py-2 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Notifications ({calls.length})
            </div>

            {/* Check requests first - they're more urgent */}
            {checkCalls.map(call => {
              const ago = Math.round((Date.now() - new Date(call.created_at).getTime()) / 60000);
              return (
                <div key={call.id} className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/50 bg-blue-600/10">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 text-lg">💳</span>
                    <div>
                      <span className="font-semibold text-white">Table {call.table_number}</span>
                      <div className="text-xs text-blue-400 font-medium">Check Requested</div>
                    </div>
                    <span className="text-xs text-slate-500 ml-1">{ago}m</span>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(call.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
              );
            })}

            {/* Regular waiter calls */}
            {waiterCalls.map(call => {
              const ago = Math.round((Date.now() - new Date(call.created_at).getTime()) / 60000);
              return (
                <div key={call.id} className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-lg">🔔</span>
                    <div>
                      <span className="font-semibold text-white">Table {call.table_number}</span>
                      <div className="text-xs text-amber-400 font-medium">Needs Waiter</div>
                    </div>
                    <span className="text-xs text-slate-500 ml-1">{ago}m</span>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(call.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
                  >
                    Done
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
