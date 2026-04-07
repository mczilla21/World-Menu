import type { MenuItem, ItemVariant } from '../../hooks/useMenu';
import { useSettings } from '../../hooks/useSettings';

interface Props {
  item: MenuItem;
  onSelect: (variant: ItemVariant) => void;
  onClose: () => void;
}

export default function VariantPicker({ item, onSelect, onClose }: Props) {
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-sm mx-4 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/50" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h3 className="font-bold text-lg text-white">{item.name}</h3>
          <p className="text-xs text-slate-400">Select a size</p>
        </div>
        <div className="p-3 space-y-2">
          {item.variants.map(v => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors active:scale-[0.98]"
            >
              <span className="font-medium text-white">{v.name}</span>
              <span className="text-emerald-400 font-semibold">{currency}{v.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <button onClick={onClose} className="w-full py-2.5 text-slate-400 text-sm hover:text-slate-300 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
