import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders, type Order } from '../../hooks/useOrders';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMenu } from '../../hooks/useMenu';
import { useI18n } from '../../i18n/useI18n';
import OrderCard from './OrderCard';

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

export default function KitchenMode() {
  const [showHistory, setShowHistory] = useState(false);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [stationFilter, setStationFilter] = useState<Set<number>>(() => {
    try {
      const saved = sessionStorage.getItem('kitchen_station');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set<number>(); // empty = all categories (head chef)
  });
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const { activeOrders, setActiveOrders, finishedOrders, setFinishedOrders, fetchAll } = useOrders();
  const { items: menuItems, categories } = useMenu();
  const { t } = useI18n();
  const initialLoadDone = useRef(false);

  // Build a map of menu_item_id -> category_id
  const itemCatMap = useRef(new Map<number, number>());
  useEffect(() => {
    const m = new Map<number, number>();
    for (const item of menuItems) m.set(item.id, item.category_id);
    itemCatMap.current = m;
  }, [menuItems]);

  useEffect(() => {
    if (activeOrders.length > 0 || finishedOrders.length > 0) {
      initialLoadDone.current = true;
    }
  }, [activeOrders, finishedOrders]);

  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === 'NEW_ORDER') {
      setActiveOrders((prev) => [...prev, msg.order]);
      if (initialLoadDone.current) {
        playChime();
        setNewOrderIds((prev) => new Set(prev).add(msg.order.id));
        setTimeout(() => {
          setNewOrderIds((prev) => {
            const next = new Set(prev);
            next.delete(msg.order.id);
            return next;
          });
        }, 3000);
      }
    } else if (msg.type === 'ITEM_DONE') {
      setActiveOrders((prev) =>
        prev.map((o) =>
          o.id === msg.orderId
            ? { ...o, items: o.items.map((i) => (i.id === msg.itemId ? { ...i, is_done: 1 } : i)) }
            : o
        )
      );
    } else if (msg.type === 'ORDER_FINISHED') {
      setActiveOrders((prev) => prev.filter((o) => o.id !== msg.order.id));
      setFinishedOrders((prev) => [msg.order, ...prev.filter((o) => o.id !== msg.order.id)]);
    } else if (msg.type === 'ORDER_UPDATED') {
      setFinishedOrders((prev) => prev.filter((o) => o.id !== msg.order.id));
      setActiveOrders((prev) => {
        const exists = prev.find((o) => o.id === msg.order.id);
        if (exists) {
          return prev.map((o) => (o.id === msg.order.id ? msg.order : o));
        }
        return [...prev, msg.order];
      });
      if (initialLoadDone.current) {
        playChime();
        setNewOrderIds((prev) => new Set(prev).add(msg.order.id));
        setTimeout(() => {
          setNewOrderIds((prev) => {
            const next = new Set(prev);
            next.delete(msg.order.id);
            return next;
          });
        }, 3000);
        if (msg.newItemIds && msg.newItemIds.length > 0) {
          setNewItemIds((prev) => {
            const next = new Set(prev);
            for (const id of msg.newItemIds) next.add(id);
            return next;
          });
          setTimeout(() => {
            setNewItemIds((prev) => {
              const next = new Set(prev);
              for (const id of msg.newItemIds) next.delete(id);
              return next;
            });
          }, 5000);
        }
      }
    } else if (msg.type === 'TABLE_CLOSED') {
      setActiveOrders((prev) => prev.filter((o) => String(o.table_number) !== String(msg.tableNumber)));
      setFinishedOrders((prev) => prev.filter((o) => String(o.table_number) !== String(msg.tableNumber)));
    } else if (msg.type === 'TABLE_REOPENED') {
      fetchAll();
    } else if (msg.type === 'HISTORY_CLEARED') {
      setActiveOrders([]);
      setFinishedOrders([]);
    } else if (msg.type === 'ORDER_STATUS_CHANGED') {
      setActiveOrders((prev) =>
        prev.map((o) => o.id === msg.orderId ? { ...o, customer_status: msg.customer_status } : o)
      );
    } else if (msg.type === 'ITEM_UNDONE') {
      if (msg.order) {
        setFinishedOrders((prev) => prev.filter((o) => o.id !== msg.orderId));
        setActiveOrders((prev) => {
          const exists = prev.find((o) => o.id === msg.orderId);
          if (exists) {
            return prev.map((o) =>
              o.id === msg.orderId
                ? { ...o, status: 'active', items: o.items.map((i) => (i.id === msg.itemId ? { ...i, is_done: 0 } : i)) }
                : o
            );
          }
          return [...prev, msg.order];
        });
      }
    }
  }, [setActiveOrders, setFinishedOrders, fetchAll]);

  const { connected } = useWebSocket('kitchen', handleWsMessage);

  const prevConnected = useRef(connected);
  useEffect(() => {
    if (connected && !prevConnected.current) {
      fetchAll();
    }
    prevConnected.current = connected;
  }, [connected, fetchAll]);

  const handleCheckItem = async (itemId: number) => {
    await fetch(`/api/order-items/${itemId}/done`, { method: 'PATCH' });
  };

  const handleUncheckItem = async (itemId: number) => {
    await fetch(`/api/order-items/${itemId}/undone`, { method: 'PATCH' });
  };

  const handleComplete = async (orderId: number) => {
    await fetch(`/api/orders/${orderId}/complete`, { method: 'PATCH' });
  };

  const handle86 = async (menuItemId: number, itemName: string) => {
    await fetch(`/api/menu/${menuItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    });
  };

  const handleMarkPreparing = async (orderId: number) => {
    await fetch(`/api/orders/${orderId}/customer-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_status: 'preparing' }),
    });
    // Update local state
    setActiveOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, customer_status: 'preparing' } : o)
    );
  };

  const getElapsedMinutes = (createdAt: string) => {
    const created = new Date(createdAt);
    return Math.floor((Date.now() - created.getTime()) / 60000);
  };

  const getTimeColor = (minutes: number) => {
    if (minutes >= 20) return 'text-red-400';
    if (minutes >= 10) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const switchRole = () => {
    localStorage.removeItem('role'); sessionStorage.removeItem('wm_employee');
    navigate('/');
  };

  // Filter orders by station (category filter)
  const filterOrdersByStation = (orders: Order[]) => {
    if (stationFilter.size === 0) return orders; // no filter = show all
    return orders.map(order => ({
      ...order,
      items: order.items.filter(item => {
        const catId = itemCatMap.current.get(item.menu_item_id);
        return catId !== undefined && stationFilter.has(catId);
      }),
    })).filter(order => order.items.length > 0);
  };

  const displayOrders = filterOrdersByStation(showHistory ? finishedOrders : activeOrders);
  const stationLabel = stationFilter.size === 0 ? 'All' :
    categories.filter(c => stationFilter.has(c.id)).map(c => c.name).join(', ');

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="font-semibold text-base text-white">{t('Chef / Kitchen')}</h1>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          {!connected && <span className="text-[11px] text-red-400">Reconnecting...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStationPicker(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stationFilter.size > 0 ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {stationFilter.size === 0 ? t('All Stations') : stationLabel}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showHistory ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {showHistory ? 'Active' : `History (${finishedOrders.length})`}
          </button>
          <button onClick={() => navigate('/staff-select')} style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          <button onClick={switchRole} style={{ fontSize: 11, color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {displayOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full p-8 mt-20">
            <div className="text-6xl mb-4">{showHistory ? '\uD83D\uDCCB' : '\uD83D\uDC68\u200D\uD83C\uDF73'}</div>
            <h2 className="text-xl font-bold text-slate-300 mb-2">
              {showHistory ? t('No finished orders yet') : t('All quiet in the kitchen!')}
            </h2>
            <p className="text-slate-500 text-sm">
              {showHistory ? t('History') : t('Orders will appear here when they come in')}
            </p>
            {!showHistory && (
              <div className="mt-4 flex gap-2">
                <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{animationDelay:'0s'}} />
                <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{animationDelay:'0.2s'}} />
                <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{animationDelay:'0.4s'}} />
              </div>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayOrders.map((order) => {
            const minutes = getElapsedMinutes(order.created_at);
            return (
              <OrderCard
                key={order.id}
                order={order}
                minutes={minutes}
                timeColor={getTimeColor(minutes)}
                isNew={newOrderIds.has(order.id)}
                newItemIds={newItemIds}
                isHistory={showHistory}
                onCheck={handleCheckItem}
                onUncheck={handleUncheckItem}
                onComplete={handleComplete}
                onMarkPreparing={handleMarkPreparing}
                on86={handle86}
              />
            );
          })}
        </div>
      </div>

      {/* Station picker modal */}
      {showStationPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowStationPicker(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-2 border-b border-slate-700/50">
              <h3 className="text-base font-bold text-white">Select Your Station</h3>
              <p className="text-xs text-slate-400 mt-0.5">Pick which categories you're working. Leave empty for all.</p>
            </div>
            <div className="p-3 space-y-1.5 max-h-[60vh] overflow-auto">
              {categories.filter(c => c.show_in_kitchen).map(cat => {
                const isOn = stationFilter.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      const next = new Set(stationFilter);
                      if (isOn) next.delete(cat.id);
                      else next.add(cat.id);
                      setStationFilter(next);
                      sessionStorage.setItem('kitchen_station', JSON.stringify([...next]));
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                      isOn ? 'bg-orange-600/20 border border-orange-500/40' : 'bg-slate-700/50 border border-transparent'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                      isOn ? 'bg-orange-600 text-white' : 'bg-slate-600 border border-slate-500'
                    }`}>
                      {isOn && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </span>
                    <span className={`text-sm font-medium ${isOn ? 'text-orange-300' : 'text-slate-300'}`}>{cat.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-slate-700/50 flex gap-2">
              <button
                onClick={() => {
                  setStationFilter(new Set());
                  sessionStorage.removeItem('kitchen_station');
                  setShowStationPicker(false);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300"
              >
                All Stations
              </button>
              <button
                onClick={() => setShowStationPicker(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
