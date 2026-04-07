import { useState, useEffect } from 'react';
import type { Order } from '../../hooks/useOrders';
import { useSettings } from '../../hooks/useSettings';

interface Props {
  onBack: () => void;
  onGoToTable?: (tableNumber: string) => void;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(orders: Order[]): { label: string; orders: Order[] }[] {
  const groups: Map<string, Order[]> = new Map();

  for (const order of orders) {
    const dateKey = new Date(order.created_at).toLocaleDateString();
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(order);
  }

  return Array.from(groups.entries()).map(([, orders]) => ({
    label: formatDateLabel(orders[0].created_at),
    orders,
  }));
}

export default function OrderHistory({ onBack, onGoToTable }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  const fetchOrders = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/orders/active').then(r => r.json()),
      fetch('/api/orders/finished').then(r => r.json()),
    ]).then(([active, finished]) => {
      const all = [...active, ...finished].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(all);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleClearHistory = async () => {
    if (!confirm('Settle all active tables?')) return;
    setClearing(true);
    await fetch('/api/orders/clear-history', { method: 'POST' });
    setOrders([]);
    setClearing(false);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const dayGroups = groupByDate(orders);
  const totalOrders = orders.length;
  const activeCount = orders.filter(o => o.status === 'active').length;
  const finishedCount = orders.filter(o => o.status === 'finished').length;
  const grandTotal = orders.reduce((sum, o) =>
    sum + o.items.reduce((s, i) => s + (i.item_price || 0) * i.quantity, 0), 0
  );

  return (
    <div className="p-4 max-w-lg mx-auto">
      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-16 text-slate-600">
          <p className="mt-3 text-sm">No orders yet</p>
        </div>
      )}

      {orders.length > 0 && (
        <>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center border border-slate-700/50">
              <div className="text-xl font-bold">{totalOrders}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Orders</div>
            </div>
            <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center border border-slate-700/50">
              <div className="text-xl font-bold text-amber-400">{activeCount}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active</div>
            </div>
            <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center border border-slate-700/50">
              <div className="text-xl font-bold text-emerald-400">{finishedCount}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Done</div>
            </div>
            {grandTotal > 0 && (
              <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-xl font-bold text-emerald-400">{currency}{grandTotal.toFixed(0)}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
              </div>
            )}
          </div>

          {activeCount > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              className="w-full mb-4 py-2.5 rounded-xl text-sm font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/30 transition-colors"
            >
              {clearing ? 'Settling...' : 'Settle All Tables'}
            </button>
          )}
        </>
      )}

      <div className="space-y-5">
        {dayGroups.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-3 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.label}</h3>
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[11px] text-slate-600">{group.orders.length} order{group.orders.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2.5">
              {group.orders.map(order => {
                const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const orderTotal = order.items.reduce((sum, i) => sum + (i.item_price || 0) * i.quantity, 0);
                return (
                  <div key={order.id} className="bg-slate-800 rounded-xl p-3.5 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{order.order_number}</span>
                        {order.order_type === 'dine_in' && <span className="text-xs text-slate-500">Table {order.table_number}</span>}
                        {order.order_type === 'takeout' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/40 text-orange-400 font-medium">Takeout</span>}
                        {order.order_type === 'pickup' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 font-medium">Pickup</span>}
                        {order.order_type !== 'takeout' && order.order_type !== 'pickup' && !order.order_type && <span className="text-xs text-slate-500">Table {order.table_number}</span>}
                        {order.customer_name && <span className="text-xs text-slate-400">{order.customer_name}</span>}
                        {order.source === 'customer' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 text-purple-400 font-medium">Self</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">{time}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          order.status === 'finished' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'
                        }`}>
                          {order.status === 'finished' ? 'Done' : 'Active'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map(item => (
                        <div key={item.id}>
                          <div className="text-sm text-slate-300 flex items-center justify-between">
                            <span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.item_name}{item.variant_name ? ` (${item.variant_name})` : ''}</span>
                            {(item.item_price || 0) * item.quantity > 0 && (
                              <span className="text-[11px] text-slate-600 ml-2 shrink-0">{currency}{((item.item_price || 0) * item.quantity).toFixed(2)}</span>
                            )}
                          </div>
                          {item.notes && (
                            <div className="text-[11px] text-slate-600 pl-3">
                              {item.notes.split(' | ').map((part, i) => (
                                <span key={i} className={part.startsWith('NO:') ? 'text-red-400' : ''}>
                                  {i > 0 ? ' \u00b7 ' : ''}{part}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {(orderTotal > 0 || order.tip_amount > 0) && (
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/40">
                        <span className="text-xs font-semibold text-slate-500">Total</span>
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-400">{currency}{orderTotal.toFixed(2)}</span>
                          {order.tip_amount > 0 && (
                            <span className="text-[10px] text-amber-400 ml-2">+ {currency}{order.tip_amount.toFixed(2)} tip</span>
                          )}
                        </div>
                      </div>
                    )}
                    {order.status === 'active' && onGoToTable && (
                      <button
                        onClick={() => onGoToTable(String(order.table_number))}
                        className="mt-2.5 w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                      >
                        + Add Items to Table {order.table_number}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
