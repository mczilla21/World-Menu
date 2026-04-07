import { useState } from 'react';

interface Props {
  subtotal: number;
  currency: string;
  themeColor: string;
  tipPercentages: number[];
  tipAmount: number;
  onTipChange: (amount: number) => void;
}

export default function TipSelector({ subtotal, currency, themeColor, tipPercentages, tipAmount, onTipChange }: Props) {
  const [customTip, setCustomTip] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (pct: number) => {
    setShowCustom(false);
    const amount = Math.round(subtotal * pct) / 100;
    onTipChange(amount);
  };

  const handleNoTip = () => {
    setShowCustom(false);
    setCustomTip('');
    onTipChange(0);
  };

  const handleCustomSubmit = () => {
    const val = parseFloat(customTip);
    onTipChange(isNaN(val) ? 0 : val);
  };

  // Find which preset is active
  const activePercent = tipPercentages.find(pct => {
    const expected = Math.round(subtotal * pct) / 100;
    return Math.abs(expected - tipAmount) < 0.01;
  });

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">Add a tip</div>
      <div className="flex gap-2">
        <button
          onClick={handleNoTip}
          className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
            tipAmount === 0 && !showCustom ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
          }`}
        >
          No tip
        </button>
        {tipPercentages.map(pct => (
          <button
            key={pct}
            onClick={() => handlePreset(pct)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
              activePercent === pct ? 'text-white' : 'border-gray-200 text-gray-600'
            }`}
            style={activePercent === pct ? { borderColor: themeColor, backgroundColor: themeColor } : undefined}
          >
            <div>{pct}%</div>
            <div className="text-[10px] opacity-70">{currency}{(subtotal * pct / 100).toFixed(2)}</div>
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
            showCustom ? 'text-white' : 'border-gray-200 text-gray-600'
          }`}
          style={showCustom ? { borderColor: themeColor, backgroundColor: themeColor } : undefined}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex gap-2 items-center">
          <span className="text-gray-500">{currency}</span>
          <input
            value={customTip}
            onChange={(e) => setCustomTip(e.target.value)}
            onBlur={handleCustomSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:ring-2"
            style={{ '--tw-ring-color': themeColor } as any}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
