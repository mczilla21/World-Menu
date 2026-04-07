import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSettings } from '../../hooks/useSettings';

interface PendingOrder {
  id: number;
  order_number: string;
  table_number: string;
  created_at: string;
  items: { item_name: string; variant_name: string; quantity: number; item_price: number; notes: string }[];
}

export default function ApprovalBadge() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/pending-approval');
      setOrders(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Play sound for new approval requests
  const playAlert = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 660; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
      // Second tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = 880; osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  const handleWs = useCallback((msg: any) => {
    if (msg.type === 'ORDER_NEEDS_APPROVAL') {
      fetchPending();
      playAlert();
    }
  }, [fetchPending, playAlert]);

  useWebSocket('server', handleWs);

  const handleApprove = async (orderId: number) => {
    await fetch(`/api/orders/${orderId}/approve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleReject = async (orderId: number) => {
    if (!confirm('Reject this order? The customer will be notified.')) return;
    await fetch(`/api/orders/${orderId}/reject`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  if (orders.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
        style={{ background: '#fef3c7', color: '#92400e' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: '#ef4444' }}>
          {orders.length}
        </span>
      </button>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowPanel(false)} />
          <div className="fixed right-2 left-2 top-14 sm:left-auto sm:right-4 sm:w-96 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: '#fff', border: '1px solid #e2e8f0', maxHeight: '80vh' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <span className="text-xs font-bold uppercase" style={{ color: '#ef4444' }}>
                {orders.length} Order{orders.length !== 1 ? 's' : ''} Awaiting Approval
              </span>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {orders.map(order => {
                const total = order.items.reduce((s, i) => s + i.item_price * i.quantity, 0);
                const ago = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
                return (
                  <div key={order.id} className="p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold" style={{ color: '#0f172a' }}>{order.order_number}</span>
                        <span className="text-xs ml-2" style={{ color: '#64748b' }}>Table {order.table_number}</span>
                        <span className="text-xs ml-2" style={{ color: '#94a3b8' }}>{ago}m ago</span>
                      </div>
                      <span className="font-bold" style={{ color: '#059669' }}>{currency}{total.toFixed(2)}</span>
                    </div>

                    <div className="mb-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm" style={{ color: '#334155' }}>
                          {item.quantity > 1 && <span className="font-bold" style={{ color: '#d97706' }}>{item.quantity}× </span>}
                          {item.item_name}
                          {item.variant_name && <span style={{ color: '#3b82f6' }}> ({item.variant_name})</span>}
                          {item.notes && <span className="text-xs block" style={{ color: '#94a3b8' }}>  → {item.notes}</span>}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(order.id)}
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-white"
                        style={{ background: '#22c55e' }}
                      >
                        ✓ Approve → Kitchen
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
