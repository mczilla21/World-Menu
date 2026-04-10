import { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface OrderItem {
  id?: number;
  item_name: string;
  variant_name?: string;
  quantity: number;
  item_price: number;
  notes?: string;
  customer_number?: number;
}

interface Props {
  tableNumber: string;
  orderId?: number;
  items: OrderItem[];
  subtotal: number;
  currency: string;
  onComplete: (method: 'cash' | 'card' | 'gift_card' | 'split', amountPaid: number) => void;
  onBack: () => void;
  /** When true, enables receipt prompt flow after card payment */
  enableReceiptPrompt?: boolean;
}

interface TaxRate { id: number; name: string; rate: number; applies_to: string; is_active: number; }
interface Discount { id: number; name: string; type: string; value: number; code: string; }

export default function PaymentScreen({ tableNumber, orderId, items, subtotal, currency, onComplete, onBack, enableReceiptPrompt = false }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<'summary' | 'cash' | 'card' | 'gift' | 'split'>('summary');
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<{ name: string; amount: number } | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [tipPercent, setTipPercent] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [giftCode, setGiftCode] = useState('');
  const [giftResult, setGiftResult] = useState<any>(null);
  const [cardProcessing, setCardProcessing] = useState(false);
  const [cardDone, setCardDone] = useState(false);
  const [splitWays, setSplitWays] = useState(2);
  const [splitPaid, setSplitPaid] = useState(0);
  const [cardSurcharge, setCardSurcharge] = useState(3);
  const [receiptPrompt, setReceiptPrompt] = useState(false);
  const [receiptPrinting, setReceiptPrinting] = useState(false);

  const printReceiptCopy = async (type: 'merchant' | 'customer' | 'both') => {
    try {
      const res = await fetch('/api/printer/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: tableNumber,
          order_id: orderId || 0,
          type,
          payment_method: view === 'card' ? 'card' : view === 'gift' ? 'gift_card' : 'cash',
          amount_paid: total,
          tip_amount: tip,
          card_surcharge: view === 'card' ? surchargeAmount : 0,
        }),
      });
      const data = await res.json();
      if (data.html && type !== 'merchant') {
        // Open browser print dialog for customer copy
        const w = window.open('', '_blank', 'width=400,height=600');
        if (w) {
          w.document.write(data.html);
          w.document.close();
          w.focus();
          w.print();
          setTimeout(() => w.close(), 2000);
        }
      }
    } catch {
      // Silently fail — receipt printing is best-effort
    }
  };

  useEffect(() => {
    fetch('/api/tax-rates').then(r => r.json()).then(setTaxRates).catch(() => {});
    fetch('/api/discounts').then(r => r.json()).then(d => setDiscounts(d.filter((x: any) => x.is_active))).catch(() => {});
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.card_surcharge) setCardSurcharge(parseFloat(s.card_surcharge) || 3);
    }).catch(() => {});
  }, []);

  // Calculations
  const taxRate = taxRates.find(t => t.is_active)?.rate || 7;
  const discountAmount = appliedDiscount?.amount || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const tax = afterDiscount * (taxRate / 100);
  const tip = customTip ? parseFloat(customTip) || 0 : afterDiscount * (tipPercent / 100);
  const cashTotal = afterDiscount + tax + tip;
  const surchargeAmount = afterDiscount * (cardSurcharge / 100);
  const cardTotal = afterDiscount + surchargeAmount + tax + tip;
  const total = view === 'card' ? cardTotal : cashTotal;
  const changeDue = parseFloat(cashGiven) - cashTotal;
  const splitAmount = cashTotal / splitWays;

  const applyDiscount = async (discountId?: number) => {
    const body: any = {};
    if (discountId) body.discount_id = discountId;
    else if (discountCode.trim()) body.code = discountCode.trim();
    else return;
    if (orderId) body.order_id = orderId;

    // Calculate locally since we might not have an order_id
    const d = discounts.find(x => discountId ? x.id === discountId : x.code === discountCode.trim());
    if (!d) return;
    let amt = 0;
    if (d.type === 'percent') amt = subtotal * (d.value / 100);
    else if (d.type === 'fixed') amt = d.value;
    else if (d.type === 'bogo') amt = Math.min(...items.map(i => i.item_price));
    setAppliedDiscount({ name: d.name, amount: amt });
    setDiscountCode('');
  };

  const handleCashPay = async () => {
    if (changeDue < 0) return;
    await fetch('/api/cash-drawer/transaction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: total, type: 'in' }) }).catch(() => {});
    onComplete('cash', parseFloat(cashGiven));
  };

  const [cardError, setCardError] = useState('');

  const handleCardPay = async () => {
    setCardProcessing(true);
    setCardError('');
    try {
      // Step 1: Get checkout token from server
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: tableNumber, amount: Math.round(cardTotal * 100) }),
      });
      const data = await res.json();

      if (data.checkoutToken) {
        setCardProcessing(false);

        // Step 2: Listen for payment result via postMessage
        const handleMessage = (event: MessageEvent) => {
          if (typeof event.data === 'string') {
            try {
              const parsed = JSON.parse(event.data);
              if (parsed.eventName === 'helcim-pay-success') {
                window.removeEventListener('message', handleMessage);
                setCardDone(true);
                if (enableReceiptPrompt) {
                  setReceiptPrompt(true);
                } else {
                  onComplete('card', cardTotal);
                }
              } else if (parsed.eventName === 'helcim-pay-error') {
                window.removeEventListener('message', handleMessage);
                setCardError('Payment declined. Please try again.');
              } else if (parsed.eventName === 'helcim-pay-close') {
                window.removeEventListener('message', handleMessage);
              }
            } catch {}
          }
        };
        window.addEventListener('message', handleMessage);

        // Step 3: Open Helcim checkout in popup window (iframe blocked by X-Frame-Options)
        const checkoutUrl = `https://secure.helcim.app/helcim-pay/${data.checkoutToken}?allowExit`;
        const popup = window.open(checkoutUrl, 'HelcimPay', 'width=500,height=700,scrollbars=yes,resizable=yes');

        // Poll for popup close (user closed without completing)
        if (popup) {
          const pollTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(pollTimer);
              window.removeEventListener('message', handleMessage);
              if (!cardDone) setCardError('Payment window was closed.');
            }
          }, 500);
        } else {
          setCardError('Popup blocked — please allow popups for this site.');
        }
      } else if (data.error) {
        setCardProcessing(false);
        setCardError(data.error);
      } else {
        // No payment provider — simulate
        await new Promise(r => setTimeout(r, 2000));
        setCardDone(true);
        setCardProcessing(false);
        onComplete('card', cardTotal);
      }
    } catch {
      setCardProcessing(false);
      setCardError('Payment failed — check internet connection.');
    }
  };

  const handleGiftRedeem = async () => {
    if (!giftCode.trim()) return;
    const res = await fetch(`/api/gift-cards/${encodeURIComponent(giftCode.trim())}`);
    const card = await res.json();
    if (card.error) { setGiftResult({ error: card.error }); return; }
    if (card.balance >= total) {
      await fetch('/api/gift-cards/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: giftCode.trim(), amount: total }) });
      setGiftResult({ success: true, remaining: card.balance - total });
      setTimeout(() => onComplete('gift_card', total), 1500);
    } else {
      setGiftResult({ partial: true, balance: card.balance, remaining: total - card.balance });
    }
  };

  const handleSplitPay = () => {
    setSplitPaid(prev => {
      const next = prev + 1;
      if (next >= splitWays) {
        setTimeout(() => onComplete('split', total), 500);
      }
      return next;
    });
  };

  const quickCash = [1, 5, 10, 20, 50, 100];
  const tipOptions = [0, 15, 18, 20, 25];

  return (
    <div className="h-full flex">
      {/* Left — Order + Totals */}
      <div className="w-[400px] flex flex-col" style={{ background: theme.bgCard, color: theme.text, borderRight: `1px solid ${theme.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <button onClick={onBack} className="hover:opacity-80 text-sm" style={{ color: theme.textMuted }}>← Back</button>
          <span className="text-sm font-medium" style={{ color: theme.textMuted }}>Table {tableNumber}</span>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm" style={{ background: `${theme.bgCardHover}50` }}>
              <span className="flex-1" style={{ color: theme.text }}>
                {item.quantity > 1 && <span className="font-bold mr-1" style={{ color: theme.primary }}>{item.quantity}×</span>}
                {item.item_name}
              </span>
              <span className="ml-2" style={{ color: theme.textSecondary }}>{currency}{(item.item_price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals breakdown */}
        <div className="p-4 space-y-1.5 text-sm" style={{ borderTop: `1px solid ${theme.border}` }}>
          <div className="flex justify-between" style={{ color: theme.textSecondary }}>
            <span>Subtotal</span><span>{currency}{subtotal.toFixed(2)}</span>
          </div>
          {appliedDiscount && (
            <div className="flex justify-between" style={{ color: theme.success }}>
              <span>{appliedDiscount.name}</span><span>-{currency}{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between" style={{ color: theme.textSecondary }}>
            <span>Tax ({taxRate}%)</span><span>{currency}{tax.toFixed(2)}</span>
          </div>
          {view === 'card' && cardSurcharge > 0 && (
            <div className="flex justify-between" style={{ color: theme.accent }}>
              <span>Card processing ({cardSurcharge}%)</span><span>+{currency}{surchargeAmount.toFixed(2)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between" style={{ color: theme.info }}>
              <span>Tip</span><span>{currency}{tip.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-black pt-2" style={{ color: theme.text, borderTop: `1px solid ${theme.border}` }}>
            <span>TOTAL</span><span style={{ color: theme.success }}>{currency}{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Right — Payment interaction */}
      <div className="flex-1 flex flex-col overflow-auto" style={{ background: theme.bg }}>
        {view === 'summary' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            {/* Discount */}
            <div className="w-full mb-4">
              <div className="flex gap-2 mb-2">
                <input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())} placeholder="Discount code"
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}` }} />
                <button onClick={() => applyDiscount()} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ background: theme.bgCardHover, color: theme.textSecondary }}>Apply</button>
              </div>
              {discounts.length > 0 && !appliedDiscount && (
                <div className="flex flex-wrap gap-1">
                  {discounts.map(d => (
                    <button key={d.id} onClick={() => applyDiscount(d.id)} className="px-2 py-1 rounded text-[10px]" style={{ background: theme.bgInput, color: theme.textSecondary }}>
                      {d.name} ({d.type === 'percent' ? `${d.value}%` : `$${d.value}`})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="w-full mb-6">
              <span className="text-xs mb-2 block" style={{ color: theme.textMuted }}>Tip</span>
              <div className="flex gap-2">
                {tipOptions.map(p => (
                  <button key={p} onClick={() => { setTipPercent(p); setCustomTip(''); }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={tipPercent === p && !customTip ? { background: theme.info, color: '#fff' } : { background: theme.bgInput, color: theme.textSecondary }}>
                    {p === 0 ? 'None' : `${p}%`}
                  </button>
                ))}
                <input value={customTip} onChange={e => { setCustomTip(e.target.value); setTipPercent(0); }} placeholder="$"
                  type="number" className="w-16 rounded-lg px-2 py-2 text-sm text-center outline-none" style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}` }} />
              </div>
            </div>

            {/* Payment method buttons */}
            <div className="w-full space-y-3">
              <button onClick={() => setView('cash')} className="w-full rounded-2xl p-5 flex items-center gap-4 transition-all active:scale-[0.98]" style={{ background: `linear-gradient(to bottom, ${theme.success}, ${theme.successDark})`, boxShadow: `0 4px 12px ${theme.success}30` }}>
                <span className="text-4xl">💵</span>
                <div className="text-left"><div className="text-xl font-bold text-white">Cash</div><div className="text-xs" style={{ color: '#ffffffbb' }}>No processing fee</div></div>
                <span className="ml-auto text-xl font-black text-white">{currency}{cashTotal.toFixed(2)}</span>
              </button>
              <button onClick={() => { setView('card'); handleCardPay(); }} className="w-full rounded-2xl p-5 flex items-center gap-4 transition-all active:scale-[0.98]" style={{ background: `linear-gradient(to bottom, ${theme.info}, ${theme.infoDark})`, boxShadow: `0 4px 12px ${theme.info}30` }}>
                <span className="text-4xl">💳</span>
                <div className="text-left">
                  <div className="text-xl font-bold text-white">Card</div>
                  <div className="text-xs" style={{ color: '#ffffffbb' }}>Includes {cardSurcharge}% processing fee</div>
                </div>
                <span className="ml-auto text-xl font-black text-white">{currency}{cardTotal.toFixed(2)}</span>
              </button>
              <div className="flex gap-3">
                <button onClick={() => setView('gift')} className="flex-1 rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]" style={{ background: `linear-gradient(to bottom, ${theme.purple}, ${theme.purple}cc)` }}>
                  <span className="text-2xl">🎁</span>
                  <span className="font-bold text-white">Gift Card</span>
                </button>
                <button onClick={() => setView('split')} className="flex-1 rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]" style={{ background: `linear-gradient(to bottom, ${theme.accent}, ${theme.accentDark})` }}>
                  <span className="text-2xl">✂️</span>
                  <span className="font-bold text-white">Split Check</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cash */}
        {view === 'cash' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            <div className="text-center mb-4">
              <div className="text-sm" style={{ color: theme.textMuted }}>Amount Due</div>
              <div className="text-4xl font-black" style={{ color: theme.success }}>{currency}{total.toFixed(2)}</div>
            </div>
            <div className="w-full rounded-2xl p-4 mb-4" style={{ background: theme.bgCard }}>
              <div className="text-3xl font-black text-center mb-4" style={{ color: theme.text }}>
                {cashGiven ? `${currency}${parseFloat(cashGiven).toFixed(2)}` : `${currency}0.00`}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {quickCash.map(a => (
                  <button key={a} onClick={() => setCashGiven(String(a))}
                    className="py-3 rounded-xl font-bold text-lg"
                    style={parseFloat(cashGiven) === a ? { background: theme.success, color: '#fff' } : { background: theme.bgCardHover, color: theme.textSecondary }}>
                    ${a}
                  </button>
                ))}
              </div>
              <button onClick={() => setCashGiven(total.toFixed(2))} className="w-full py-2 rounded-xl text-sm mb-2" style={{ background: theme.bgCardHover, color: theme.textSecondary }}>Exact ({currency}{total.toFixed(2)})</button>
              <input type="tel" inputMode="decimal" value={cashGiven} onChange={e => setCashGiven(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Custom" className="w-full rounded-xl px-4 py-3 text-center text-xl font-bold outline-none" style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }} />
            </div>
            {parseFloat(cashGiven) > 0 && (
              <div className="w-full rounded-2xl p-4 text-center mb-4" style={{ background: changeDue >= 0 ? `${theme.success}20` : `${theme.danger}20`, border: `1px solid ${changeDue >= 0 ? `${theme.success}40` : `${theme.danger}40`}` }}>
                <div className="text-sm" style={{ color: theme.textSecondary }}>{changeDue >= 0 ? 'Change Due' : 'Short'}</div>
                <div className="text-4xl font-black" style={{ color: changeDue >= 0 ? theme.success : theme.danger }}>{currency}{Math.abs(changeDue).toFixed(2)}</div>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <button onClick={() => { setView('summary'); setCashGiven(''); }} className="flex-1 py-4 rounded-xl font-semibold" style={{ background: theme.bgCardHover, color: theme.textSecondary }}>Back</button>
              <button onClick={handleCashPay} disabled={changeDue < 0 || !cashGiven}
                className="flex-1 py-4 rounded-xl font-bold text-lg disabled:opacity-30" style={{ background: theme.success, color: '#fff', boxShadow: `0 4px 12px ${theme.success}30` }}>Complete</button>
            </div>
          </div>
        )}

        {/* Card */}
        {view === 'card' && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center w-full max-w-sm">
              {!cardDone ? (
                <>
                  <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: `${theme.info}20` }}><span className="text-4xl">💳</span></div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>
                    {cardProcessing ? 'Opening payment...' : 'Card Payment'}
                  </h2>
                  <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
                    {cardProcessing ? 'A secure payment window will open' : 'Complete payment in the Helcim window'}
                  </p>
                  {cardError && (
                    <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#ef444420', color: '#ef4444' }}>
                      {cardError}
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {!cardProcessing && (
                      <button
                        onClick={handleCardPay}
                        className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.98]"
                        style={{ background: theme.info, boxShadow: `0 4px 12px ${theme.info}30` }}
                      >
                        {cardError ? 'Try Again' : 'Pay'} {currency}{cardTotal.toFixed(2)}
                      </button>
                    )}
                    <button
                      onClick={() => { setCardError(''); setView('summary'); }}
                      className="w-full py-3 rounded-xl font-semibold"
                      style={{ background: theme.bgCardHover, color: theme.textSecondary }}
                    >
                      Cancel
                    </button>
                    </div>
                  )}
                  {cardProcessing && (
                    <div className="mt-4">
                      <div className="animate-spin w-8 h-8 border-4 rounded-full mx-auto mb-3" style={{ borderColor: `${theme.info}30`, borderTopColor: theme.info }} />
                      <p style={{ color: theme.textMuted }}>Charging card...</p>
                    </div>
                  )}
                </>
              ) : receiptPrompt ? (
                <>
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: `${theme.success}20` }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>Payment Complete!</h2>
                  <p className="text-lg font-bold mb-6" style={{ color: theme.success }}>{currency}{total.toFixed(2)}</p>
                  <div className="flex flex-col gap-3 w-72 mx-auto">
                    <button
                      onClick={async () => {
                        setReceiptPrinting(true);
                        await printReceiptCopy('customer');
                        setReceiptPrinting(false);
                        onComplete('card', cardTotal);
                      }}
                      disabled={receiptPrinting}
                      className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{ background: theme.info, color: '#fff', boxShadow: `0 4px 12px ${theme.info}30` }}
                    >
                      {receiptPrinting ? 'Printing...' : '\uD83D\uDDA8 Print Receipt'}
                    </button>
                    <button
                      onClick={() => onComplete('card', cardTotal)}
                      className="w-full py-4 rounded-2xl font-semibold text-base transition-all active:scale-[0.98]"
                      style={{ background: theme.bgCardHover, color: theme.textSecondary }}
                    >
                      No Receipt
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: `${theme.success}20` }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>Approved!</h2>
                  <p className="text-lg font-bold" style={{ color: theme.success }}>{currency}{total.toFixed(2)}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Gift Card */}
        {view === 'gift' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            <span className="text-5xl mb-4">🎁</span>
            <h2 className="text-xl font-bold mb-4" style={{ color: theme.text }}>Gift Card Payment</h2>
            <div className="w-full flex gap-2 mb-4">
              <input value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="Enter gift card code"
                className="flex-1 rounded-xl px-4 py-3 font-mono text-lg text-center outline-none" style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}` }} />
              <button onClick={handleGiftRedeem} className="px-6 py-3 rounded-xl font-bold" style={{ background: theme.purple, color: '#fff' }}>Redeem</button>
            </div>
            {giftResult?.error && <p className="text-sm" style={{ color: theme.danger }}>{giftResult.error}</p>}
            {giftResult?.success && (
              <div className="w-full rounded-xl p-4 text-center" style={{ background: `${theme.success}20`, border: `1px solid ${theme.success}40` }}>
                <div className="text-lg font-bold" style={{ color: theme.success }}>Payment Complete!</div>
                <div className="text-sm" style={{ color: theme.textSecondary }}>Remaining balance: {currency}{giftResult.remaining.toFixed(2)}</div>
              </div>
            )}
            {giftResult?.partial && (
              <div className="w-full rounded-xl p-4 text-center" style={{ background: `${theme.accent}20`, border: `1px solid ${theme.accent}40` }}>
                <div className="font-bold" style={{ color: theme.accent }}>Partial — card has {currency}{giftResult.balance.toFixed(2)}</div>
                <div className="text-sm" style={{ color: theme.textSecondary }}>Remaining to pay: {currency}{giftResult.remaining.toFixed(2)}</div>
              </div>
            )}
            <button onClick={() => setView('summary')} className="mt-4 text-sm" style={{ color: theme.textMuted }}>Back</button>
          </div>
        )}

        {/* Split Check */}
        {view === 'split' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            <span className="text-5xl mb-4">✂️</span>
            <h2 className="text-xl font-bold mb-2" style={{ color: theme.text }}>Split Check</h2>
            <p className="text-sm mb-6" style={{ color: theme.textMuted }}>Total: {currency}{total.toFixed(2)}</p>

            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setSplitWays(Math.max(2, splitWays - 1))} className="w-12 h-12 rounded-xl text-xl font-bold" style={{ background: theme.bgCardHover, color: theme.text }}>-</button>
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: theme.text }}>{splitWays}</div>
                <div className="text-xs" style={{ color: theme.textMuted }}>ways</div>
              </div>
              <button onClick={() => setSplitWays(splitWays + 1)} className="w-12 h-12 rounded-xl text-xl font-bold" style={{ background: theme.bgCardHover, color: theme.text }}>+</button>
            </div>

            <div className="w-full rounded-xl p-4 mb-4 text-center" style={{ background: theme.bgCard }}>
              <div className="text-sm" style={{ color: theme.textMuted }}>Each person pays</div>
              <div className="text-3xl font-black" style={{ color: theme.info }}>{currency}{splitAmount.toFixed(2)}</div>
            </div>

            <div className="w-full space-y-2 mb-4">
              {Array.from({ length: splitWays }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={i < splitPaid ? { background: `${theme.success}20`, border: `1px solid ${theme.success}40` } : { background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                  <span className="text-sm font-medium" style={{ color: theme.text }}>Guest {i + 1}</span>
                  <span className="ml-auto text-sm font-bold" style={{ color: theme.text }}>{currency}{splitAmount.toFixed(2)}</span>
                  {i < splitPaid ? (
                    <span className="text-xs font-bold" style={{ color: theme.success }}>PAID</span>
                  ) : i === splitPaid ? (
                    <button onClick={handleSplitPay} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: theme.info, color: '#fff' }}>
                      Pay Now
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: theme.textMuted }}>Waiting</span>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => { setView('summary'); setSplitPaid(0); }} className="text-sm" style={{ color: theme.textMuted }}>Cancel Split</button>
          </div>
        )}
      </div>
    </div>
  );
}
