import { useEffect, useState } from 'react';
import type { Order, OrderItem } from '../../hooks/useOrders';

interface Props {
  order: Order;
  minutes: number;
  timeColor: string;
  isNew: boolean;
  newItemIds: Set<number>;
  isHistory: boolean;
  onCheck: (itemId: number) => void;
  onUncheck: (itemId: number) => void;
  onComplete: (orderId: number) => void;
  onMarkPreparing?: (orderId: number) => void;
  on86?: (menuItemId: number, itemName: string) => void;
}

function groupByCustomer(items: OrderItem[]): Map<number, OrderItem[]> {
  const groups = new Map<number, OrderItem[]>();
  for (const item of items) {
    const key = item.customer_number || 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

export default function OrderCard({ order, minutes, timeColor, isNew, newItemIds, isHistory, onCheck, onUncheck, onComplete, onMarkPreparing, on86 }: Props) {
  const kitchenItems = order.items.filter((i) => i.show_in_kitchen);
  const [elapsedSec, setElapsedSec] = useState(() => Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const elapsed = Math.floor(elapsedSec / 60);

  if (kitchenItems.length === 0) return null;

  const allDone = kitchenItems.every(i => i.is_done);
  const doneCount = kitchenItems.filter(i => i.is_done).length;
  const grouped = groupByCustomer(kitchenItems);
  const showCustomerHeaders = grouped.size > 1 || (grouped.size === 1 && [...grouped.keys()][0] > 0);

  // Max prep time from items (estimated)
  const maxPrepTime = Math.max(...order.items.map(i => (i as any).prep_time_minutes || 0), 0);

  const getTimeColor = (m: number) => {
    if (m >= 20) return 'text-red-400';
    if (m >= 10) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const orderTypeBadge = () => {
    const ot = order.order_type || 'dine_in';
    if (ot === 'takeout' || ot === 'pickup') return <span style={{ background: '#f97316', color: '#fff', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>TAKEOUT</span>;
    return <span style={{ background: '#3b82f6', color: '#fff', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>DINE IN</span>;
  };

  const renderItem = (item: OrderItem) => {
    const isNewItem = newItemIds.has(item.id);
    return (
      <button
        key={item.id}
        onClick={() => {
          if (isHistory) return;
          item.is_done ? onUncheck(item.id) : onCheck(item.id);
        }}
        disabled={isHistory}
        className={`w-full text-left px-3 py-2.5 rounded-lg mb-1.5 last:mb-0 flex items-center gap-3 transition-all ${
          item.is_done
            ? 'bg-emerald-900/30 text-emerald-300/70 line-through'
            : isNewItem
              ? 'bg-amber-900/40 ring-1 ring-amber-500/50'
              : 'bg-slate-700/70 hover:bg-slate-600 active:bg-slate-500'
        } ${isHistory ? 'cursor-default' : ''}`}
      >
        <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
          item.is_done ? 'border-emerald-500 bg-emerald-600' : 'border-slate-500'
        }`}>
          {item.is_done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">
              {item.item_name}
              {item.variant_name && <span className="text-blue-300 ml-1">({item.variant_name})</span>}
            </span>
            {isNewItem && (
              <span className="bg-amber-500 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shrink-0 uppercase tracking-wider">New</span>
            )}
          </div>
          {item.combo_slot_label && (
            <div className="text-[10px] text-purple-400">{item.combo_slot_label}</div>
          )}
          {item.notes && (
            <div className="mt-1 leading-snug">
              {item.notes.split(' | ').map((part, i) => (
                <div key={i} className={`text-sm font-medium ${
                  part.startsWith('NO:') ? 'text-red-500' :
                  part.startsWith('ADD:') ? 'text-emerald-500' :
                  'text-blue-500'
                }`} style={{ padding: '1px 0' }}>
                  {part.startsWith('NO:') ? '✕ ' : part.startsWith('ADD:') ? '+ ' : '→ '}{part}
                </div>
              ))}
            </div>
          )}
        </div>
        {item.quantity > 1 && (
          <span className="text-lg font-black text-amber-400 shrink-0">x{item.quantity}</span>
        )}
        {/* 86 button */}
        {!isHistory && !item.is_done && on86 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`86 "${item.item_name}"? This will hide it from all menus.`)) {
                on86(item.menu_item_id, item.item_name);
              }
            }}
            className="shrink-0 px-2 py-1 rounded text-[10px] font-bold bg-red-900/50 text-red-400 hover:bg-red-800 transition-colors"
            title="86 this item"
          >
            86
          </button>
        )}
      </button>
    );
  };

  return (
    <div
      className={`bg-slate-800 rounded-xl overflow-hidden transition-all ${
        isNew ? 'animate-new-order border-2 border-amber-400' :
        allDone && !isHistory ? 'border border-emerald-500/50 shadow-lg shadow-emerald-500/10' :
        'border border-slate-700/50'
      } ${isHistory ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-black text-white">{order.order_number}</span>
          {order.order_type === 'dine_in' || !order.order_type ? (
            <span className="text-xs text-slate-500 font-medium">Table {order.table_number}</span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">{order.customer_name || ''}</span>
          )}
          {orderTypeBadge()}
          {order.source === 'customer' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 text-purple-400 font-medium">Self-order</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isHistory && (
            <span className="text-[11px] text-slate-600">{doneCount}/{kitchenItems.length}</span>
          )}
          <span className={`text-sm font-bold tabular-nums ${isHistory ? 'text-slate-600' : getTimeColor(elapsed)}`}>
            {isHistory ? 'Done' : elapsed < 1 ? `${elapsedSec}s` : `${elapsed}m`}
          </span>
        </div>
      </div>

      {/* Timer progress bar */}
      {!isHistory && (
        <div className="h-1 bg-slate-700">
          <div
            className={`h-full transition-all duration-1000 ${
              elapsed >= 20 ? 'bg-red-500 animate-pulse' : elapsed >= 10 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, (elapsed / 30) * 100)}%` }}
          />
        </div>
      )}

      <div className="p-2.5">
        {[...grouped.entries()].map(([custNum, items]) => (
          <div key={custNum} className={showCustomerHeaders ? 'mb-2.5 last:mb-0' : ''}>
            {showCustomerHeaders && custNum > 0 && (
              <div className="text-[10px] font-semibold text-blue-400 mb-1 px-1 uppercase tracking-wider">
                Guest {custNum}
              </div>
            )}
            {showCustomerHeaders && custNum === 0 && (
              <div className="text-[10px] font-semibold text-slate-600 mb-1 px-1 uppercase tracking-wider">
                Shared
              </div>
            )}
            {items.map(renderItem)}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {!isHistory && (
        <div className="p-2.5 pt-0 space-y-1.5">
          {!allDone && order.customer_status === 'received' && onMarkPreparing && (
            <button
              onClick={() => onMarkPreparing(order.id)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              Mark Preparing
            </button>
          )}
          {allDone && (
            <button
              onClick={() => onComplete(order.id)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-emerald-600/20"
            >
              COMPLETE
            </button>
          )}
        </div>
      )}
    </div>
  );
}
