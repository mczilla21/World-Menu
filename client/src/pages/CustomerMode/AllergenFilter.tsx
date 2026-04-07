import { ALLERGENS } from '../../constants/allergens';

interface Props {
  excluded: Set<string>;
  onToggle: (code: string) => void;
  onClose: () => void;
  themeColor: string;
}

export default function AllergenFilter({ excluded, onToggle, onClose, themeColor }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mt-auto bg-white rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Filter Allergens</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p className="px-5 pt-2 text-sm text-gray-500">Tap to exclude items containing these allergens</p>
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 gap-2">
            {ALLERGENS.map(a => {
              const isExcluded = excluded.has(a.code);
              return (
                <button
                  key={a.code}
                  onClick={() => onToggle(a.code)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-left transition-all border-2 ${
                    isExcluded
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{a.icon}</span>
                  <div>
                    <div className={`text-sm font-medium ${isExcluded ? 'text-red-700' : 'text-gray-900'}`}>{a.name}</div>
                    {isExcluded && <div className="text-[10px] text-red-500 font-medium">Excluded</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-white transition-all"
            style={{ backgroundColor: themeColor }}
          >
            Apply {excluded.size > 0 ? `(${excluded.size} excluded)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
