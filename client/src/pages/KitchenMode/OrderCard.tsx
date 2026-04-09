import { useState, useRef, useCallback } from 'react';
import type { Order, OrderItem } from '../../hooks/useOrders';
import { useTheme } from '../../hooks/useTheme';

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
  onDismiss?: (orderId: number) => void;
  tick?: number;
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

export default function OrderCard({ order, minutes, timeColor, isNew, newItemIds, isHistory, onCheck, onUncheck, onComplete, onMarkPreparing, on86, onDismiss, tick }: Props) {
  const t = useTheme();
  const kitchenItems = order.items.filter((i) => i.show_in_kitchen);

  // Long-press popup state
  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    if (isHistory) return;
    longPressTimer.current = setTimeout(() => {
      setShowLongPressMenu(true);
    }, 500);
  }, [isHistory]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Compute elapsed time directly in render, driven by parent's shared tick
  const elapsedSec = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
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
    if (ot === 'takeout' || ot === 'pickup') return <span style={{ background: t.orange, color: '#fff', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>TAKEOUT</span>;
    return <span style={{ background: t.info, color: '#fff', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>DINE IN</span>;
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
          item.is_done ? 'line-through' : ''
        } ${isHistory ? 'cursor-default' : ''}`}
        style={{
          background: item.is_done ? `${t.success}15` : isNewItem ? `${t.primary}25` : `${t.bgCardHover}90`,
          color: item.is_done ? `${t.success}90` : t.text,
          boxShadow: isNewItem ? `inset 0 0 0 1px ${t.primary}50` : undefined,
        }}
      >
        <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors" style={{
          border: `1px solid ${item.is_done ? t.success : t.border}`,
          background: item.is_done ? t.success : 'transparent',
        }}>
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
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shrink-0 uppercase tracking-wider" style={{ background: t.primary, color: t.primaryText }}>New</span>
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
          <span className="text-lg font-black shrink-0" style={{ color: t.accent }}>x{item.quantity}</span>
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
            className="shrink-0 px-2 py-1 rounded text-[10px] font-bold transition-colors"
            style={{ background: `${t.danger}30`, color: t.danger }}
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
      className={`rounded-xl overflow-hidden transition-all relative ${
        isNew ? 'animate-new-order' :
        ''
      } ${isHistory ? 'opacity-60' : ''}`}
      style={{
        background: t.bgCard,
        border: isNew ? `2px solid ${t.primary}` : allDone && !isHistory ? `1px solid ${t.success}60` : `1px solid ${t.border}`,
        boxShadow: allDone && !isHistory ? `0 4px 12px ${t.success}15` : undefined,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      {/* Long-press popup menu */}
      {showLongPressMenu && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 'inherit' }}>
          <div className="flex flex-col gap-2 p-4 w-full max-w-[220px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Mark all items done then complete
                const undoneItems = kitchenItems.filter(i => !i.is_done);
                undoneItems.forEach(i => onCheck(i.id));
                setTimeout(() => onComplete(order.id), 100);
                setShowLongPressMenu(false);
              }}
              className="w-full py-3 rounded-lg font-bold text-sm transition-colors"
              style={{ background: t.success, color: '#fff' }}
            >
              Complete Order
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onDismiss) {
                  onDismiss(order.id);
                } else {
                  // Fallback: complete order to remove from view
                  onComplete(order.id);
                }
                setShowLongPressMenu(false);
              }}
              className="w-full py-3 rounded-lg font-bold text-sm transition-colors"
              style={{ background: t.accent, color: '#fff' }}
            >
              Dismiss
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLongPressMenu(false);
              }}
              className="w-full py-3 rounded-lg font-bold text-sm transition-colors"
              style={{ background: t.border, color: t.text }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-black" style={{ color: t.text }}>{order.order_number}</span>
          {order.order_type === 'dine_in' || !order.order_type ? (
            <span className="text-xs font-medium" style={{ color: t.textMuted }}>Table {order.table_number}</span>
          ) : (
            <span className="text-xs font-medium" style={{ color: t.textSecondary }}>{order.customer_name || ''}</span>
          )}
          {orderTypeBadge()}
          {order.source === 'customer' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${t.purple}30`, color: t.purple }}>Self-order</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isHistory && (
            <span className="text-[11px]" style={{ color: t.textMuted }}>{doneCount}/{kitchenItems.length}</span>
          )}
          <span className={`text-sm font-bold tabular-nums ${isHistory ? 'text-slate-600' : getTimeColor(elapsed)}`}>
            {isHistory ? 'Done' : elapsed < 1 ? `${elapsedSec}s` : `${elapsed}m`}
          </span>
        </div>
      </div>

      {/* Timer progress bar */}
      {!isHistory && (
        <div className="h-1" style={{ background: t.border }}>
          <div
            className={`h-full transition-all duration-1000 ${elapsed >= 20 ? 'animate-pulse' : ''}`}
            style={{ background: elapsed >= 20 ? t.danger : elapsed >= 10 ? t.accent : t.success, width: `${Math.min(100, (elapsed / 30) * 100)}%` }}
          />
        </div>
      )}

      <div className="p-2.5">
        {[...grouped.entries()].map(([custNum, items]) => (
          <div key={custNum} className={showCustomerHeaders ? 'mb-2.5 last:mb-0' : ''}>
            {showCustomerHeaders && custNum > 0 && (
              <div className="text-[10px] font-semibold mb-1 px-1 uppercase tracking-wider" style={{ color: t.info }}>
                Guest {custNum}
              </div>
            )}
            {showCustomerHeaders && custNum === 0 && (
              <div className="text-[10px] font-semibold mb-1 px-1 uppercase tracking-wider" style={{ color: t.textMuted }}>
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
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors"
              style={{ background: t.info, color: '#fff' }}
            >
              Mark Preparing
            </button>
          )}
          {allDone && (
            <button
              onClick={() => onComplete(order.id)}
              className="w-full py-3 rounded-lg font-bold transition-colors"
              style={{ background: t.success, color: '#fff', boxShadow: `0 4px 12px ${t.success}30` }}
            >
              COMPLETE
            </button>
          )}
        </div>
      )}
    </div>
  );
}
