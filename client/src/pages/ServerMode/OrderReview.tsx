import { useState } from 'react';
import type { CartItem } from '../../stores/orderStore';
import { useSettings } from '../../hooks/useSettings';

interface Props {
  cart: CartItem[];
  tableNumber: string;
  orderType: string;
  customerName: string;
  onSend: () => void;
  onRemove: (cartId: string) => void;
  onIncrement: (cartId: string) => void;
  onUpdateNote: (cartId: string, note: string) => void;
  onBack: () => void;
}

function groupByCustomer(cart: CartItem[]): Map<number, CartItem[]> {
  const groups = new Map<number, CartItem[]>();
  for (const item of cart) {
    const key = item.customer_number || 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

export default function OrderReview({ cart, tableNumber, orderType, customerName, onSend, onRemove, onIncrement, onUpdateNote, onBack }: Props) {
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const grouped = groupByCustomer(cart);
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  const grandTotal = cart.reduce((sum, i) => sum + i.item_price * i.quantity, 0);

  const customerTotal = (items: CartItem[]) =>
    items.reduce((sum, i) => sum + i.item_price * i.quantity, 0);

  const handleStartNote = (item: CartItem) => {
    setEditingNote(item.id);
    setNoteText(item.notes);
  };

  const handleSaveNote = () => {
    if (editingNote) {
      onUpdateNote(editingNote, noteText.trim());
      setEditingNote(null);
      setNoteText('');
    }
  };

  const orderLabel = orderType === 'dine_in'
    ? `Dine-in — Table ${tableNumber}`
    : orderType === 'takeout'
      ? `Takeout${customerName ? ` — ${customerName}` : ''}`
      : `Pickup${customerName ? ` — ${customerName}` : ''}`;

  const orderTypeBadgeColor = orderType === 'dine_in' ? 'bg-blue-600' : orderType === 'takeout' ? 'bg-orange-600' : 'bg-green-600';

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="bg-slate-800 rounded-2xl overflow-hidden mb-4 border border-slate-700/50">
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700/50 flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium text-white ${orderTypeBadgeColor}`}>
            {orderType === 'dine_in' ? 'Dine-in' : orderType === 'takeout' ? 'Takeout' : 'Pickup'}
          </span>
          <span className="text-sm text-slate-400">{orderLabel}</span>
        </div>

        <div className="p-4">
          {[...grouped.entries()].map(([custNum, items]) => (
            <div key={custNum}>
              {custNum > 0 && (
                <div className="flex items-center justify-between mt-4 mb-2 first:mt-0">
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Guest {custNum}</div>
                  {customerTotal(items) > 0 && (
                    <div className="text-xs text-slate-500">{currency}{customerTotal(items).toFixed(2)}</div>
                  )}
                </div>
              )}
              {items.map((item) => {
                const hasBuilderNotes = item.notes && item.id.startsWith('build-');
                const lineTotal = item.item_price * item.quantity;

                return (
                  <div key={item.id} className="py-3 border-b border-slate-700/40 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-white">
                          {item.item_name}
                          {item.variant_name && <span className="text-blue-300 ml-1">({item.variant_name})</span>}
                        </span>
                        {item.combo_slot_label && (
                          <div className="text-[10px] text-purple-400">{item.combo_slot_label}</div>
                        )}
                        {item.item_price > 0 && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {currency}{item.item_price.toFixed(2)}
                            {item.quantity > 1 && <span className="text-emerald-400 font-medium ml-1">= {currency}{lineTotal.toFixed(2)}</span>}
                          </div>
                        )}
                      </div>
                      {hasBuilderNotes ? (
                        <button
                          onClick={() => onRemove(item.id)}
                          className="w-8 h-8 rounded-lg bg-red-900/50 hover:bg-red-800 flex items-center justify-center text-red-300 text-xs shrink-0 transition-colors"
                        >
                          ✕
                        </button>
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => onRemove(item.id)} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-red-900/50 flex items-center justify-center text-slate-400 hover:text-red-300 text-sm font-bold transition-colors">-</button>
                          <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                          <button onClick={() => onIncrement(item.id)} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-green-900/50 flex items-center justify-center text-slate-400 hover:text-green-300 text-sm font-bold transition-colors">+</button>
                        </div>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-slate-400 mt-1.5 pl-0.5 space-y-0.5">
                        {item.notes.split(' | ').map((part, i) => (
                          <div key={i} className={part.startsWith('NO:') ? 'text-red-400 font-medium' : ''}>{part}</div>
                        ))}
                      </div>
                    )}
                    {!hasBuilderNotes && editingNote !== item.id && (
                      <button onClick={() => handleStartNote(item)} className="text-[11px] text-blue-400/70 mt-1.5 pl-0.5 hover:text-blue-300 transition-colors">
                        {item.notes ? 'edit note' : '+ note'}
                      </button>
                    )}
                    {editingNote === item.id && (
                      <div className="flex gap-2 mt-2">
                        <input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                          placeholder="e.g. no ice, extra spicy"
                          className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-600"
                          autoFocus
                        />
                        <button onClick={handleSaveNote} className="text-emerald-400 text-xs px-2 font-medium hover:text-emerald-300">Save</button>
                        <button onClick={() => setEditingNote(null)} className="text-slate-500 text-xs px-2 hover:text-slate-400">Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {grandTotal > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t border-slate-700/50">
            <span className="font-semibold text-slate-300">Total</span>
            <span className="font-bold text-lg text-emerald-400">{currency}{grandTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2.5">
        <button onClick={onBack} className="flex-1 py-3.5 rounded-xl font-semibold transition-colors" style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
          + Add More
        </button>
        <button onClick={onSend} className="flex-1 bg-green-600 hover:bg-green-500 active:bg-green-700 py-3.5 rounded-xl font-semibold transition-colors shadow-lg shadow-green-600/20">
          Send to Kitchen
        </button>
      </div>
    </div>
  );
}
