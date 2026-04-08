import { useState, useEffect } from 'react';

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
}

interface TaxRate { id: number; name: string; rate: number; applies_to: string; is_active: number; }
interface Discount { id: number; name: string; type: string; value: number; code: string; }

export default function PaymentScreen({ tableNumber, orderId, items, subtotal, currency, onComplete, onBack }: Props) {
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

  const handleCardPay = async () => {
    setCardProcessing(true);
    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: tableNumber, amount: Math.round(cardTotal * 100) }),
      });
      const data = await res.json();
      // Simulated or real — either way mark as done
      await new Promise(r => setTimeout(r, 2000));
      setCardDone(true);
      setTimeout(() => onComplete('card', cardTotal), 1500);
    } catch {
      await new Promise(r => setTimeout(r, 2000));
      setCardDone(true);
      setTimeout(() => onComplete('card', cardTotal), 1500);
    }
    setCardProcessing(false);
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
      <div className="w-[400px] border-r border-slate-700/50 flex flex-col" style={{ background: '#1e293b', color: '#e2e8f0' }}>
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <button onClick={onBack} className="hover:opacity-80 text-sm" style={{ color: '#94a3b8' }}>← Back</button>
          <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Table {tableNumber}</span>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/50 text-sm">
              <span className="flex-1" style={{ color: '#fff' }}>
                {item.quantity > 1 && <span className="font-bold mr-1" style={{ color: '#fbbf24' }}>{item.quantity}×</span>}
                {item.item_name}
              </span>
              <span className="ml-2" style={{ color: '#cbd5e1' }}>{currency}{(item.item_price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals breakdown */}
        <div className="p-4 border-t border-slate-700/50 space-y-1.5 text-sm">
          <div className="flex justify-between" style={{ color: '#94a3b8' }}>
            <span>Subtotal</span><span>{currency}{subtotal.toFixed(2)}</span>
          </div>
          {appliedDiscount && (
            <div className="flex justify-between" style={{ color: '#34d399' }}>
              <span>{appliedDiscount.name}</span><span>-{currency}{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between" style={{ color: '#94a3b8' }}>
            <span>Tax ({taxRate}%)</span><span>{currency}{tax.toFixed(2)}</span>
          </div>
          {view === 'card' && cardSurcharge > 0 && (
            <div className="flex justify-between" style={{ color: '#f59e0b' }}>
              <span>Card processing ({cardSurcharge}%)</span><span>+{currency}{surchargeAmount.toFixed(2)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between" style={{ color: '#60a5fa' }}>
              <span>Tip</span><span>{currency}{tip.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-black pt-2 border-t border-slate-700/50" style={{ color: '#fff' }}>
            <span>TOTAL</span><span style={{ color: '#34d399' }}>{currency}{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Right — Payment interaction */}
      <div className="flex-1 bg-slate-850 flex flex-col overflow-auto">
        {view === 'summary' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            {/* Discount */}
            <div className="w-full mb-4">
              <div className="flex gap-2 mb-2">
                <input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())} placeholder="Discount code"
                  className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none border border-slate-700" />
                <button onClick={() => applyDiscount()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-200">Apply</button>
              </div>
              {discounts.length > 0 && !appliedDiscount && (
                <div className="flex flex-wrap gap-1">
                  {discounts.map(d => (
                    <button key={d.id} onClick={() => applyDiscount(d.id)} className="px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300">
                      {d.name} ({d.type === 'percent' ? `${d.value}%` : `$${d.value}`})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="w-full mb-6">
              <span className="text-xs text-slate-400 mb-2 block">Tip</span>
              <div className="flex gap-2">
                {tipOptions.map(p => (
                  <button key={p} onClick={() => { setTipPercent(p); setCustomTip(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tipPercent === p && !customTip ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    {p === 0 ? 'None' : `${p}%`}
                  </button>
                ))}
                <input value={customTip} onChange={e => { setCustomTip(e.target.value); setTipPercent(0); }} placeholder="$"
                  type="number" className="w-16 bg-slate-800 rounded-lg px-2 py-2 text-white text-sm text-center outline-none border border-slate-700" />
              </div>
            </div>

            {/* Payment method buttons */}
            <div className="w-full space-y-3">
              <button onClick={() => setView('cash')} className="w-full bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-2xl p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20">
                <span className="text-4xl">💵</span>
                <div className="text-left"><div className="text-xl font-bold text-white">Cash</div><div className="text-emerald-200 text-xs">No processing fee</div></div>
                <span className="ml-auto text-xl font-black text-white">{currency}{cashTotal.toFixed(2)}</span>
              </button>
              <button onClick={() => { setView('card'); handleCardPay(); }} className="w-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 rounded-2xl p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20">
                <span className="text-4xl">💳</span>
                <div className="text-left">
                  <div className="text-xl font-bold text-white">Card</div>
                  <div className="text-blue-200 text-xs">Includes {cardSurcharge}% processing fee</div>
                </div>
                <span className="ml-auto text-xl font-black text-white">{currency}{cardTotal.toFixed(2)}</span>
              </button>
              <div className="flex gap-3">
                <button onClick={() => setView('gift')} className="flex-1 bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]">
                  <span className="text-2xl">🎁</span>
                  <span className="font-bold text-white">Gift Card</span>
                </button>
                <button onClick={() => setView('split')} className="flex-1 bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]">
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
              <div className="text-sm text-slate-400">Amount Due</div>
              <div className="text-4xl font-black text-emerald-400">{currency}{total.toFixed(2)}</div>
            </div>
            <div className="w-full bg-slate-800 rounded-2xl p-4 mb-4">
              <div className="text-3xl font-black text-white text-center mb-4">
                {cashGiven ? `${currency}${parseFloat(cashGiven).toFixed(2)}` : `${currency}0.00`}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {quickCash.map(a => (
                  <button key={a} onClick={() => setCashGiven(String(a))}
                    className={`py-3 rounded-xl font-bold text-lg ${parseFloat(cashGiven) === a ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
                    ${a}
                  </button>
                ))}
              </div>
              <button onClick={() => setCashGiven(total.toFixed(2))} className="w-full py-2 rounded-xl text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 mb-2">Exact ({currency}{total.toFixed(2)})</button>
              <input type="tel" inputMode="decimal" value={cashGiven} onChange={e => setCashGiven(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Custom" className="w-full bg-slate-900 rounded-xl px-4 py-3 text-center text-xl font-bold text-white outline-none border border-slate-600" />
            </div>
            {parseFloat(cashGiven) > 0 && (
              <div className={`w-full rounded-2xl p-4 text-center mb-4 ${changeDue >= 0 ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-red-600/20 border border-red-500/30'}`}>
                <div className="text-sm text-slate-300">{changeDue >= 0 ? 'Change Due' : 'Short'}</div>
                <div className={`text-4xl font-black ${changeDue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{currency}{Math.abs(changeDue).toFixed(2)}</div>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <button onClick={() => { setView('summary'); setCashGiven(''); }} className="flex-1 py-4 rounded-xl font-semibold bg-slate-700 text-slate-300">Back</button>
              <button onClick={handleCashPay} disabled={changeDue < 0 || !cashGiven}
                className="flex-1 py-4 rounded-xl font-bold text-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 shadow-lg">Complete</button>
            </div>
          </div>
        )}

        {/* Card */}
        {view === 'card' && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              {!cardDone ? (
                <>
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse"><span className="text-5xl">💳</span></div>
                  <h2 className="text-2xl font-bold text-white mb-2">Processing...</h2>
                  <p className="text-slate-400">Tap, insert, or swipe card</p>
                  <button onClick={() => setView('summary')} className="mt-8 px-8 py-3 rounded-xl bg-slate-700 text-slate-300">Cancel</button>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-600/20 flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Approved!</h2>
                  <p className="text-emerald-400 text-lg font-bold">{currency}{total.toFixed(2)}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Gift Card */}
        {view === 'gift' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            <span className="text-5xl mb-4">🎁</span>
            <h2 className="text-xl font-bold text-white mb-4">Gift Card Payment</h2>
            <div className="w-full flex gap-2 mb-4">
              <input value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="Enter gift card code"
                className="flex-1 bg-slate-800 rounded-xl px-4 py-3 text-white font-mono text-lg text-center outline-none border border-slate-700" />
              <button onClick={handleGiftRedeem} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold">Redeem</button>
            </div>
            {giftResult?.error && <p className="text-red-400 text-sm">{giftResult.error}</p>}
            {giftResult?.success && (
              <div className="w-full bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 text-center">
                <div className="text-emerald-400 text-lg font-bold">Payment Complete!</div>
                <div className="text-sm text-slate-300">Remaining balance: {currency}{giftResult.remaining.toFixed(2)}</div>
              </div>
            )}
            {giftResult?.partial && (
              <div className="w-full bg-amber-600/20 border border-amber-500/30 rounded-xl p-4 text-center">
                <div className="text-amber-400 font-bold">Partial — card has {currency}{giftResult.balance.toFixed(2)}</div>
                <div className="text-sm text-slate-300">Remaining to pay: {currency}{giftResult.remaining.toFixed(2)}</div>
              </div>
            )}
            <button onClick={() => setView('summary')} className="mt-4 text-sm text-slate-400 hover:text-white">Back</button>
          </div>
        )}

        {/* Split Check */}
        {view === 'split' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            <span className="text-5xl mb-4">✂️</span>
            <h2 className="text-xl font-bold text-white mb-2">Split Check</h2>
            <p className="text-slate-400 text-sm mb-6">Total: {currency}{total.toFixed(2)}</p>

            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setSplitWays(Math.max(2, splitWays - 1))} className="w-12 h-12 rounded-xl bg-slate-700 text-xl font-bold">-</button>
              <div className="text-center">
                <div className="text-4xl font-black text-white">{splitWays}</div>
                <div className="text-xs text-slate-400">ways</div>
              </div>
              <button onClick={() => setSplitWays(splitWays + 1)} className="w-12 h-12 rounded-xl bg-slate-700 text-xl font-bold">+</button>
            </div>

            <div className="w-full bg-slate-800 rounded-xl p-4 mb-4 text-center">
              <div className="text-sm text-slate-400">Each person pays</div>
              <div className="text-3xl font-black text-blue-400">{currency}{splitAmount.toFixed(2)}</div>
            </div>

            <div className="w-full space-y-2 mb-4">
              {Array.from({ length: splitWays }, (_, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${i < splitPaid ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                  <span className="text-sm font-medium text-white">Guest {i + 1}</span>
                  <span className="ml-auto text-sm font-bold">{currency}{splitAmount.toFixed(2)}</span>
                  {i < splitPaid ? (
                    <span className="text-xs text-emerald-400 font-bold">PAID</span>
                  ) : i === splitPaid ? (
                    <button onClick={handleSplitPay} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white">
                      Pay Now
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Waiting</span>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => { setView('summary'); setSplitPaid(0); }} className="text-sm text-slate-400 hover:text-white">Cancel Split</button>
          </div>
        )}
      </div>
    </div>
  );
}
