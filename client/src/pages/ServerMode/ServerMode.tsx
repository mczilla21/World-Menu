import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '../../hooks/useMenu';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useOrderStore } from '../../stores/orderStore';
import { useSettings } from '../../hooks/useSettings';
import FloorPlan from '../KioskMode/FloorPlan';
import OrderTypeSelect from './OrderTypeSelect';
import MenuGrid from './MenuGrid';
import OrderReview from './OrderReview';
import OrderHistory from './OrderHistory';
import ItemBuilder from './ItemBuilder';
import VariantPicker from './VariantPicker';
import ServiceCallBadge from './ServiceCallBadge';
import ApprovalBadge from './ApprovalBadge';
import LangToggle from '../../components/LangToggle';
import type { MenuItem, ItemVariant } from '../../hooks/useMenu';
import { useI18n } from '../../i18n/useI18n';

type View = 'order_type' | 'table' | 'menu' | 'review' | 'history' | 'sent' | 'overview';

function loadServerState() {
  try {
    const raw = sessionStorage.getItem('server_view_state');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function ServerMode() {
  const saved = loadServerState();
  const [view, setViewRaw] = useState<View>(saved?.view || 'order_type');
  const [builderTarget, setBuilderTarget] = useState<{ categoryId: number; item: { id: number; name: string }; price: number } | null>(null);
  const [variantTarget, setVariantTarget] = useState<MenuItem | null>(null);
  const [lastTable, setLastTable] = useState(saved?.lastTable || '');
  const [lastOrderType, setLastOrderType] = useState(saved?.lastOrderType || '');
  // Wrap setView to persist state
  const setView = useCallback((v: View) => {
    setViewRaw(v);
  }, []);

  const navigate = useNavigate();
  const { items, categories, loading, refresh } = useMenu();
  const { settings } = useSettings();
  const { tableNumber, cart, orderType, customerName, setTable, setExistingOrder, setOrderType, setCustomerName, addItem, addSimpleItem, removeItem, incrementItem, updateItemNote, clearCart, submitOrder } = useOrderStore();
  const { t } = useI18n();

  // Persist server view state across role switches
  useEffect(() => {
    sessionStorage.setItem('server_view_state', JSON.stringify({
      view, lastTable, lastOrderType,
    }));
  }, [view, lastTable, lastOrderType]);

  const enabledTypes = (settings.order_types_enabled || 'dine_in,takeout,pickup').split(',').filter(Boolean);
  const takeoutOnly = settings.takeout_only === '1';

  // Auto-return to menu after order sent (2s flash)
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (view === 'sent') {
      sentTimer.current = setTimeout(() => {
        setView('menu');
      }, 2000);
    }
    return () => { if (sentTimer.current) clearTimeout(sentTimer.current); };
  }, [view]);

  const [readyOrders, setReadyOrders] = useState<{ id: number; orderNumber: string; tableNumber: string }[]>([]);

  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === 'MENU_UPDATED') refresh();
    if (msg.type === 'TABLE_CLOSED' || msg.type === 'TABLE_REOPENED' || msg.type === 'HISTORY_CLEARED') { /* refresh handled by FloorPlan */ }
    if (msg.type === 'ORDER_READY' && msg.order) {
      // Show ready notification
      setReadyOrders(prev => [...prev, { id: msg.order.id, orderNumber: msg.order.order_number, tableNumber: msg.order.table_number }]);
      // Play sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 523; osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.frequency.value = 659; osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.5);
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.connect(gain3); gain3.connect(ctx.destination);
        osc3.frequency.value = 784; osc3.type = 'sine';
        gain3.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
        gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc3.start(ctx.currentTime + 0.3); osc3.stop(ctx.currentTime + 0.7);
      } catch {}
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setReadyOrders(prev => prev.filter(o => o.id !== msg.order.id));
      }, 10000);
    }
  }, [refresh]);

  useWebSocket('server', handleWsMessage);

  const handleOrderTypeSelect = (type: 'dine_in' | 'takeout' | 'pickup', name?: string) => {
    setOrderType(type);
    if (name) setCustomerName(name);
    if (type === 'dine_in') {
      setView('table');
    } else {
      // Takeout/pickup — go straight to menu
      setTable('');
      setExistingOrder(null);
      setView('menu');
    }
  };

  const handleTableSelect = async (t: string) => {
    setTable(t);
    try {
      const res = await fetch(`/api/orders/table/${encodeURIComponent(t)}/current`);
      if (res.ok) {
        const order = await res.json();
        if (order && order.id) {
          setExistingOrder(order.id);
        } else {
          setExistingOrder(null);
        }
      }
    } catch {
      setExistingOrder(null);
    }
    setView('menu');
  };

  const handleSend = async () => {
    const savedTable = tableNumber;
    const savedType = orderType;
    const savedName = customerName;
    const ok = await submitOrder();
    if (ok) {
      setLastTable(savedTable);
      setLastOrderType(savedType);
      // Stay on the same table — go right back to menu
      setTable(savedTable);
      setOrderType(savedType as any);
      if (savedName) setCustomerName(savedName);
      try {
        const res = await fetch(`/api/orders/table/${encodeURIComponent(savedTable)}/current`);
        if (res.ok) {
          const order = await res.json();
          if (order && order.id) setExistingOrder(order.id);
        }
      } catch {}
      setView('sent');
    }
  };

  const handleAddMore = async () => {
    setTable(lastTable);
    setOrderType(lastOrderType as any);
    try {
      const res = await fetch(`/api/orders/table/${encodeURIComponent(lastTable)}/current`);
      if (res.ok) {
        const order = await res.json();
        if (order && order.id) {
          setExistingOrder(order.id);
        }
      }
    } catch {}
    setView('menu');
  };

  const handleVariantSelect = (item: MenuItem, variant: ItemVariant) => {
    addSimpleItem(item.id, item.name, !!item.category_show_in_kitchen, variant.price, variant.name);
    setVariantTarget(null);
  };

  const switchRole = () => {
    localStorage.removeItem('role'); sessionStorage.removeItem('wm_employee');
    navigate('/');
  };

  const handleBack = () => {
    if (view === 'review') setView('menu');
    else if (view === 'menu') {
      if (cart.length > 0) {
        if (confirm('Leave this table? Cart will be cleared.')) {
          clearCart();
          if (orderType === 'dine_in') setView('table');
          else setView('order_type');
        }
      } else {
        if (orderType === 'dine_in') { setView('table'); }
        else { setView('order_type'); }
      }
    }
    else if (view === 'table') { setView('order_type'); }
    else if (view === 'history') setView('order_type');
    else if (view === 'overview') setView('order_type');
  };

  // Auto-select order type if only one option
  useEffect(() => {
    if (view === 'order_type' && takeoutOnly) {
      handleOrderTypeSelect('takeout');
    } else if (view === 'order_type' && enabledTypes.length === 1) {
      handleOrderTypeSelect(enabledTypes[0] as 'dine_in' | 'takeout' | 'pickup');
    }
  }, [view, takeoutOnly, enabledTypes.length]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="text-slate-400">Loading...</div></div>;

  const viewTitle: Record<View, string> = {
    order_type: t('New Order'),
    table: t('Select Table'),
    menu: orderType === 'dine_in' ? `${t('Table')} ${tableNumber}` : (customerName ? `${t(orderType === 'takeout' ? 'Takeout' : 'Pickup')} — ${customerName}` : t(orderType === 'takeout' ? 'Takeout' : 'Pickup')),
    review: t('Review Order'),
    history: t('Order History'),
    sent: t('Order Sent'),
    overview: t('Table Overview'),
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Ready order notifications */}
      {readyOrders.length > 0 && (
        <div className="shrink-0">
          {readyOrders.map(o => (
            <div key={o.id} onClick={() => setReadyOrders(prev => prev.filter(x => x.id !== o.id))}
              style={{ background: '#22c55e', color: '#fff', padding: '12px 16px', cursor: 'pointer', textAlign: 'center', fontSize: 15, fontWeight: 700 }}>
              🔔 Order {o.orderNumber} is READY — Table {o.tableNumber} (tap to dismiss)
            </div>
          ))}
        </div>
      )}
      <header className="bg-slate-800 border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {view !== 'order_type' && (
            <button onClick={view === 'sent' ? () => { clearCart(); setView('order_type'); } : handleBack} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <h1 className="font-semibold text-base text-white">{viewTitle[view]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ApprovalBadge />
          <ServiceCallBadge />
          <LangToggle />
          {(view === 'order_type' || view === 'table') && (
            <>
              <button onClick={() => setView('overview')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-700 hover:bg-blue-600 text-blue-100 transition-colors">
                {t('Tables')}
              </button>
              <button onClick={() => setView('history')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                {t('History')}
              </button>
            </>
          )}
          <button onClick={() => navigate('/staff-select')} style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          <button onClick={switchRole} style={{ fontSize: 11, color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {view === 'order_type' && <OrderTypeSelect onSelect={handleOrderTypeSelect} />}
        {view === 'table' && (
          <FloorPlan
            onSelectTable={(table) => handleTableSelect(table.number)}
            selectedTable={null}
          />
        )}
        {view === 'menu' && (
          <MenuGrid
            items={items}
            categories={categories}
            cart={cart}
            onAddSimple={addSimpleItem}
            onRemove={removeItem}
            onOpenBuilder={(categoryId, item, price) => setBuilderTarget({ categoryId, item, price })}
            onOpenVariant={(item) => setVariantTarget(item)}
            onReview={() => setView('review')}
          />
        )}
        {view === 'review' && (
          <OrderReview
            cart={cart}
            tableNumber={tableNumber}
            orderType={orderType}
            customerName={customerName}
            onSend={handleSend}
            onRemove={removeItem}
            onIncrement={incrementItem}
            onUpdateNote={updateItemNote}
            onBack={() => setView('menu')}
          />
        )}
        {view === 'history' && (
          <OrderHistory onBack={() => setView('order_type')} onGoToTable={(t) => handleTableSelect(t)} />
        )}
        {view === 'overview' && (
          <FloorPlan
            onSelectTable={(table) => handleTableSelect(table.number)}
            selectedTable={null}
          />
        )}
        {view === 'sent' && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4 animate-pulse" style={{ background: '#dcfce7' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Sent to Kitchen!</h2>
            <p className="text-slate-400 text-sm mb-6">
              {lastOrderType === 'dine_in' ? `Table ${lastTable}` : lastOrderType === 'takeout' ? 'Takeout' : 'Pickup'}
            </p>
            <p className="text-slate-600 text-xs mb-8">Returning to menu...</p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={handleAddMore}
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-6 py-4 rounded-xl font-semibold text-base transition-colors"
              >
                Continue Ordering
              </button>
              <button
                onClick={() => { clearCart(); setView('order_type'); }}
                className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-xl font-medium text-sm transition-colors text-slate-300"
              >
                Different Table / New Order
              </button>
            </div>
          </div>
        )}
      </div>

      {builderTarget && (
        <ItemBuilder
          categoryId={builderTarget.categoryId}
          item={builderTarget.item}
          itemPrice={builderTarget.price}
          onAdd={(item) => addItem(item)}
          onClose={() => setBuilderTarget(null)}
        />
      )}

      {variantTarget && (
        <VariantPicker
          item={variantTarget}
          onSelect={(v) => handleVariantSelect(variantTarget, v)}
          onClose={() => setVariantTarget(null)}
        />
      )}
    </div>
  );
}
