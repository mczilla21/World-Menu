import { useState } from 'react';

interface Props {
  itemName: string;
  ingredients: string[];
  onConfirm: (modifications: string) => void;
  onClose: () => void;
  viewOnly?: boolean;
}

type Mod = 'normal' | 'remove' | 'extra';

export default function IngredientPopup({ itemName, ingredients, onConfirm, onClose, viewOnly }: Props) {
  const [mods, setMods] = useState<Record<string, Mod>>(
    Object.fromEntries(ingredients.map(i => [i, 'normal' as Mod]))
  );

  const cycle = (ingredient: string) => {
    setMods(prev => {
      const current = prev[ingredient];
      const next: Mod = current === 'normal' ? 'remove' : current === 'remove' ? 'extra' : 'normal';
      return { ...prev, [ingredient]: next };
    });
  };

  const handleConfirm = () => {
    const parts: string[] = [];
    for (const [name, mod] of Object.entries(mods)) {
      if (mod === 'remove') parts.push(`NO ${name}`);
      if (mod === 'extra') parts.push(`EXTRA ${name}`);
    }
    onConfirm(parts.join(', '));
  };

  const hasChanges = Object.values(mods).some(m => m !== 'normal');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-slate-700/50">
          <h3 className="text-base font-bold text-white">{itemName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{viewOnly ? 'Ingredients in this dish' : 'Tap to cycle: included → remove → extra'}</p>
        </div>

        {/* Ingredients list */}
        <div className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-1.5">
            {ingredients.map(ingredient => {
              const mod = mods[ingredient];
              return (
                <button
                  key={ingredient}
                  onClick={() => cycle(ingredient)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98] ${
                    mod === 'remove'
                      ? 'bg-red-600/20 border border-red-500/30'
                      : mod === 'extra'
                      ? 'bg-green-600/20 border border-green-500/30'
                      : 'bg-slate-700/50 border border-transparent'
                  }`}
                >
                  {/* Status icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    mod === 'remove'
                      ? 'bg-red-600 text-white'
                      : mod === 'extra'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-600 text-slate-300'
                  }`}>
                    {mod === 'remove' ? '✕' : mod === 'extra' ? '+' : '✓'}
                  </div>

                  {/* Name */}
                  <span className={`text-sm font-medium flex-1 ${
                    mod === 'remove'
                      ? 'text-red-300 line-through'
                      : mod === 'extra'
                      ? 'text-green-300'
                      : 'text-slate-200'
                  }`}>
                    {ingredient}
                  </span>

                  {/* Badge */}
                  {mod !== 'normal' && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      mod === 'remove' ? 'bg-red-600/30 text-red-300' : 'bg-green-600/30 text-green-300'
                    }`}>
                      {mod === 'remove' ? 'NO' : 'EXTRA'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50 flex gap-2">
          {viewOnly ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Got It
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                {hasChanges ? 'Add with Changes' : 'Add as Is'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
