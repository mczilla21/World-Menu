import { useState } from 'react';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
  pin: string;
}

export default function PinGate({ onSuccess, onCancel, pin }: Props) {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (entry === pin) {
      onSuccess();
    } else {
      setError(true);
      setEntry('');
      setTimeout(() => setError(false), 1500);
    }
  };

  const handleKey = (digit: string) => {
    if (digit === 'clear') {
      setEntry('');
      setError(false);
    } else if (digit === 'back') {
      setEntry(prev => prev.slice(0, -1));
    } else {
      const next = entry + digit;
      setEntry(next);
      // Auto-submit when length matches pin
      if (next.length === pin.length) {
        if (next === pin) {
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => { setError(false); setEntry(''); }, 1000);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-xs p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Enter PIN</h3>
        <p className="text-xs text-gray-400 text-center mb-4">Admin access required</p>

        {/* PIN display */}
        <div className={`flex justify-center gap-2 mb-6 ${error ? 'animate-shake' : ''}`}>
          {Array.from({ length: pin.length }, (_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                error
                  ? 'bg-red-500'
                  : i < entry.length
                  ? 'bg-gray-900'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                key === 'clear'
                  ? 'bg-gray-100 text-gray-500 text-sm'
                  : key === 'back'
                  ? 'bg-gray-100 text-gray-500 text-sm'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              {key === 'back' ? '⌫' : key === 'clear' ? 'C' : key}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-4 py-2.5 text-sm text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
