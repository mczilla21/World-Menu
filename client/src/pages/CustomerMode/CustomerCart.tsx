import { useCustomerStore } from '../../stores/customerStore';
import { useSettings } from '../../hooks/useSettings';
import TipSelector from './TipSelector';

interface Props {
  currency: string;
  themeColor: string;
  onClose: () => void;
  onOrderSent: () => void;
}

export default function CustomerCart({ currency, themeColor, onClose, onOrderSent }: Props) {
  const { cart, removeItem, incrementItem, tipAmount, setTipAmount, submitOrder } = useCustomerStore();
  const { settings } = useSettings();
  const subtotal = cart.reduce((s, i) => s + i.item_price * i.quantity, 0);
  const total = subtotal + tipAmount;
  const tippingEnabled = settings.tipping_enabled === '1';
  const tipPercentages = (settings.tip_percentages || '15,18,20').split(',').map(Number).filter(n => !isNaN(n));

  const handleSubmit = async () => {
    const ok = await submitOrder();
    if (ok) onOrderSent();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mt-auto bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Your Order</h2>
          <button onClick={onClose} aria-label="Close cart" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">{'\uD83D\uDED2'}</div>
              <p className="text-gray-500 font-medium">Nothing here yet!</p>
              <p className="text-gray-400 text-sm mt-1">Browse the menu to add items</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {item.item_name_translated}
                      {item.variant_name && <span className="text-gray-500 ml-1">({item.variant_name})</span>}
                    </div>
                    {item.combo_slot_label && (
                      <div className="text-[10px] text-purple-500 font-medium">{item.combo_slot_label}</div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.notes.split(' | ').map((part, i) => (
                          <span key={i} className={part.startsWith('NO:') ? 'text-red-500' : ''}>
                            {i > 0 ? ' · ' : ''}{part}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-sm font-semibold mt-1" style={{ color: themeColor }}>
                      {currency}{(item.item_price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-900 w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => incrementItem(item.id)}
                      className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tipping moved to bill/check screen */}
        </div>

        {cart.length > 0 && (
          <div className="shrink-0 p-5 border-t border-gray-100">
            <div className="space-y-1 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-sm text-gray-700">{currency}{subtotal.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tip</span>
                  <span className="text-sm text-gray-700">{currency}{tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold" style={{ color: themeColor }}>{currency}{total.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.98]"
              style={{ backgroundColor: themeColor }}
            >
              Place Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
