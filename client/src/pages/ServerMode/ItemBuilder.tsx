import { useState, useEffect } from 'react';
import { useOrderStore } from '../../stores/orderStore';

interface Modifier {
  id: number;
  name: string;
  extra_price: number;
  default_on: number;
}

interface ModifierGroup {
  id: number;
  name: string;
  selection_type: string;
  required: number;
  modifiers: Modifier[];
}

interface Props {
  categoryId: number;
  item: { id: number; name: string };
  onAdd: (item: { id: string; menu_item_id: number; item_name: string; quantity: number; show_in_kitchen: boolean; notes: string; customer_number: number; item_price: number; variant_name: string; combo_id: number | null; combo_slot_label: string }) => void;
  itemPrice?: number;
  onClose: () => void;
}

let bowlCounter = 0;

export default function ItemBuilder({ categoryId, item, onAdd, onClose, itemPrice = 0 }: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [selections, setSelections] = useState<Record<number, Set<number>>>({});
  const currentCustomer = useOrderStore(s => s.currentCustomer);

  useEffect(() => {
    fetch(`/api/menu/${item.id}/modifier-groups`)
      .then(r => r.json())
      .then((data: ModifierGroup[]) => {
        setGroups(data);
        const initial: Record<number, Set<number>> = {};
        for (const g of data) {
          if (g.selection_type === 'toggle') {
            initial[g.id] = new Set(g.modifiers.filter(m => m.default_on).map(m => m.id));
          } else {
            initial[g.id] = new Set();
          }
        }
        setSelections(initial);
        setLoading(false);
      });
  }, [categoryId]);

  if (loading) return <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">Loading...</div>;
  if (groups.length === 0) {
    onAdd({
      id: `simple-${item.id}-${Date.now()}`,
      menu_item_id: item.id,
      item_name: item.name,
      quantity: 1,
      show_in_kitchen: true,
      notes: '',
      customer_number: currentCustomer,
      item_price: itemPrice,
      variant_name: '',
      combo_id: null,
      combo_slot_label: '',
    });
    onClose();
    return null;
  }

  const currentGroup = groups[stepIdx];
  const isLastStep = stepIdx === groups.length - 1;
  const currentSel = selections[currentGroup?.id] || new Set();

  const toggleSelection = (modId: number) => {
    const group = currentGroup;
    const sel = new Set(currentSel);

    if (group.selection_type === 'single') {
      if (sel.has(modId)) sel.delete(modId);
      else { sel.clear(); sel.add(modId); }
    } else {
      if (sel.has(modId)) sel.delete(modId);
      else sel.add(modId);
    }
    setSelections({ ...selections, [group.id]: sel });
  };

  const canProceed = !currentGroup.required || currentSel.size > 0;

  const totalExtra = groups.reduce((sum, g) => {
    const sel = selections[g.id] || new Set();
    return sum + g.modifiers.filter(m => sel.has(m.id)).reduce((s, m) => s + m.extra_price, 0);
  }, 0);

  const handleDone = () => {
    const notesParts: string[] = [];
    for (const g of groups) {
      const sel = selections[g.id] || new Set();
      if (g.selection_type === 'toggle') {
        const removed = g.modifiers.filter(m => m.default_on && !sel.has(m.id));
        const added = g.modifiers.filter(m => !m.default_on && sel.has(m.id));
        if (removed.length > 0) notesParts.push(`NO: ${removed.map(m => m.name).join(', ')}`);
        if (added.length > 0) notesParts.push(`ADD: ${added.map(m => m.name).join(', ')}`);
      } else {
        const selected = g.modifiers.filter(m => sel.has(m.id));
        if (selected.length > 0) notesParts.push(selected.map(m => m.name).join(' + '));
      }
    }

    bowlCounter++;
    onAdd({
      id: `build-${Date.now()}-${bowlCounter}`,
      menu_item_id: item.id,
      item_name: item.name,
      quantity: 1,
      show_in_kitchen: true,
      notes: notesParts.join(' | '),
      customer_number: currentCustomer,
      item_price: itemPrice + totalExtra,
      variant_name: '',
      combo_id: null,
      combo_slot_label: '',
    });
    onClose();
  };

  const handleNext = () => {
    if (!canProceed) return;
    if (isLastStep) {
      handleDone();
    } else {
      setStepIdx(stepIdx + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">\u2715</button>
          <div>
            <h2 className="font-bold text-lg">{item.name}</h2>
            {(itemPrice > 0 || totalExtra > 0) && (
              <p className="text-sm text-yellow-400">
                {itemPrice > 0 ? `$${(itemPrice + totalExtra).toFixed(2)}` : `+$${totalExtra.toFixed(2)}`}
                {totalExtra > 0 && itemPrice > 0 && <span className="text-slate-500 ml-1">(+${totalExtra.toFixed(2)} extras)</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {groups.map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i === stepIdx ? 'bg-blue-500' : i < stepIdx ? 'bg-green-500' : 'bg-slate-600'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <h3 className="text-lg font-bold mb-1 text-center">{currentGroup.name}</h3>
        <p className="text-sm text-slate-400 text-center mb-4">
          {currentGroup.selection_type === 'single' && 'Tap to select one'}
          {currentGroup.selection_type === 'multi' && 'Tap to select \u2014 pick one or more'}
          {currentGroup.selection_type === 'toggle' && 'All included \u2014 uncheck to remove'}
        </p>

        <div className="grid gap-3 max-w-lg mx-auto grid-cols-2">
          {currentGroup.modifiers.map(mod => {
            const isSelected = currentSel.has(mod.id);

            if (currentGroup.selection_type === 'toggle') {
              return (
                <button
                  key={mod.id}
                  onClick={() => toggleSelection(mod.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isSelected ? 'bg-green-800/60' : 'bg-slate-800 text-slate-500 line-through'
                  }`}
                >
                  <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-green-500 bg-green-600' : 'border-slate-600'
                  }`}>
                    {isSelected && <span className="text-xs">\u2713</span>}
                  </span>
                  <div className="text-left">
                    <div className="text-sm font-medium">{mod.name}</div>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={mod.id}
                onClick={() => toggleSelection(mod.id)}
                className={`rounded-xl p-4 text-left transition-all active:scale-95 ${
                  isSelected ? 'bg-blue-700 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <div className="font-medium">{mod.name}</div>
                {mod.extra_price > 0 && <div className="text-yellow-400 text-sm mt-1">+${mod.extra_price.toFixed(2)}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4 shrink-0 flex gap-3">
        {stepIdx > 0 && (
          <button
            onClick={() => setStepIdx(stepIdx - 1)}
            className="flex-1 bg-slate-700 py-3 rounded-xl font-medium"
          >
            \u2190 Back
          </button>
        )}
        <button
          onClick={handleNext}
          className={`flex-1 py-3 rounded-xl font-bold text-lg ${
            canProceed
              ? (isLastStep ? 'bg-green-600' : 'bg-blue-600')
              : 'bg-slate-700 text-slate-500'
          }`}
        >
          {isLastStep ? 'ADD TO ORDER' : 'Next \u2192'}
        </button>
      </div>
    </div>
  );
}
