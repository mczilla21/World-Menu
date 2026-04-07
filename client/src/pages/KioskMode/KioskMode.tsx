import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import { useWebSocket } from '../../hooks/useWebSocket';
import FloorPlan from './FloorPlan';
import PaymentScreen from './PaymentScreen';

interface TableData {
  number: string;
  status: string;
  guests: number;
  elapsed: number;
  total: number;
  orderCount: number;
}

interface OrderItem {
  id: number;
  item_name: string;
  variant_name: string;
  quantity: number;
  item_price: number;
  notes: string;
  is_done: number;
}

export default function KioskMode() {
  const [view, setView] = useState<'floor' | 'detail' | 'payment'>('floor');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';
  const navigate = useNavigate();

  const handleWs = useCallback(() => {}, []);
  useWebSocket('server', handleWs);

  const handleSelectTable = async (table: TableData) => {
    setSelectedTable(table.number);

    if (table.status === 'empty') {
      // Empty table — go to server mode for this table
      return;
    }

    // Fetch order details
    try {
      const res = await fetch(`/api/orders/table/${encodeURIComponent(table.number)}/bill`);
      const data = await res.json();
      const items: OrderItem[] = [];
      let total = 0;
      for (const order of data.orders || []) {
        for (const item of order.items || []) {
          items.push(item);
          total += item.item_price * item.quantity;
        }
      }
      setOrderItems(items);
      setOrderTotal(total);
      setView('detail');
    } catch {}
  };

  const handlePaymentComplete = async (method: string, amountPaid: number) => {
    // Record payment method on all orders for this table
    if (selectedTable) {
      try {
        const [billRes, taxRes] = await Promise.all([
          fetch(`/api/orders/table/${encodeURIComponent(selectedTable)}/bill`),
          fetch('/api/tax-rates'),
        ]);
        const billData = await billRes.json();
        const taxRates = await taxRes.json().catch(() => []);
        const activeTaxRate = taxRates.find((t: any) => t.is_active)?.rate || 7;
        for (const order of (billData.orders || [])) {
          const subtotal = (order.items || []).reduce((s: number, i: any) => s + i.item_price * i.quantity, 0);
          const taxAmount = subtotal * (activeTaxRate / 100);
          await fetch(`/api/orders/${order.id}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_method: method, tax_amount: taxAmount }),
          });
        }
      } catch {}
      // Close the table
      await fetch(`/api/tables/${encodeURIComponent(selectedTable)}/close`, { method: 'POST' });
    }
    setView('floor');
    setSelectedTable(null);
    setOrderItems([]);
    setOrderTotal(0);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0f172a', color: '#fff' }}>
      {/* Header bar */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700/50 px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {settings.logo && (
            <img src={`/uploads/${settings.logo}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
          )}
          <div>
            <h1 className="font-bold text-base text-white leading-tight">{settings.restaurant_name}</h1>
            <span className="text-[10px] text-slate-500">POS Terminal</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Open drawer button */}
          <button
            onClick={() => fetch('/api/printer/open-drawer', { method: 'POST' })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
            style={{ background: '#334155', color: '#cbd5e1' }}
            title="Open cash drawer"
          >
            💰 Drawer
          </button>
          <div className="text-right">
            <div className="text-sm font-bold text-white tabular-nums">{timeStr}</div>
            <div className="text-[10px] text-slate-400">{dateStr}</div>
          </div>
          <button
            onClick={() => { localStorage.removeItem('role'); navigate('/'); }}
            className="text-xs hover:opacity-80"
            style={{ color: '#475569' }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {view === 'floor' && (
          <FloorPlan
            onSelectTable={handleSelectTable}
            selectedTable={selectedTable}
          />
        )}

        {view === 'detail' && selectedTable && (
          <div className="h-full flex">
            {/* Order detail - left */}
            <div className="flex-1 flex flex-col">
              <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Table {selectedTable}</h2>
                  <span className="text-sm text-slate-400">{orderItems.length} item{orderItems.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => { setView('floor'); setSelectedTable(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-medium text-slate-300"
                >
                  ← Floor Plan
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-1.5">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-800/80">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {item.quantity > 1 && <span className="text-amber-400 font-black">{item.quantity}×</span>}
                        <span className="font-medium text-white">{item.item_name}</span>
                        {item.variant_name && <span className="text-blue-300 text-sm">({item.variant_name})</span>}
                      </div>
                      {item.notes && <div className="text-xs text-slate-400 mt-0.5">{item.notes}</div>}
                    </div>
                    <span className="font-bold text-slate-200">{currency}{(item.item_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total + pay button */}
              <div className="p-5 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg text-slate-400">Subtotal</span>
                  <span className="text-2xl font-black text-emerald-400">{currency}{orderTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setView('payment')}
                  className="w-full py-5 rounded-2xl font-bold text-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98]"
                >
                  Pay Now
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'payment' && selectedTable && (
          <PaymentScreen
            tableNumber={selectedTable}
            items={orderItems}
            subtotal={orderTotal}
            currency={currency}
            onComplete={handlePaymentComplete}
            onBack={() => setView('detail')}
          />
        )}
      </div>
    </div>
  );
}
