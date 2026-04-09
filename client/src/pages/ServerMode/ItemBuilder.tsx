import { useState, useEffect } from 'react';
import { useOrderStore } from '../../stores/orderStore';
import { useTheme } from '../../hooks/useTheme';
import { useSettings } from '../../hooks/useSettings';

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
  showInKitchen?: boolean;
  onClose: () => void;
}

let bowlCounter = 0;

export default function ItemBuilder({ categoryId, item, onAdd, onClose, itemPrice = 0, showInKitchen = true }: Props) {
  const t = useTheme();
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';
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
  }, [item.id]);

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="animate-pulse text-lg" style={{ color: t.textSecondary }}>Loading...</div>
    </div>
  );

  if (groups.length === 0) {
    onAdd({
      id: `simple-${item.id}-${Date.now()}`,
      menu_item_id: item.id,
      item_name: item.name,
      quantity: 1,
      show_in_kitchen: showInKitchen,
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
      show_in_kitchen: showInKitchen,
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
    if (isLastStep) handleDone();
    else setStepIdx(stepIdx + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ background: t.bgCard, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: t.bg, color: t.textMuted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div>
            <h2 className="font-bold text-lg" style={{ color: t.text }}>{item.name}</h2>
            {(itemPrice > 0 || totalExtra > 0) && (
              <p className="text-sm" style={{ color: t.primary }}>
                {itemPrice > 0 ? `${currency}${(itemPrice + totalExtra).toFixed(2)}` : `+${currency}${totalExtra.toFixed(2)}`}
                {totalExtra > 0 && itemPrice > 0 && <span style={{ color: t.textMuted, marginLeft: 4 }}>(+{currency}{totalExtra.toFixed(2)} extras)</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {groups.map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: i === stepIdx ? t.primary : i < stepIdx ? t.success : t.border }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4" style={{ background: t.bg }}>
        <h3 className="text-lg font-bold mb-1 text-center" style={{ color: t.text }}>{currentGroup.name}</h3>
        <p className="text-sm text-center mb-4" style={{ color: t.textSecondary }}>
          {currentGroup.selection_type === 'single' && 'Tap to select one'}
          {currentGroup.selection_type === 'multi' && 'Tap to select — pick one or more'}
          {currentGroup.selection_type === 'toggle' && 'All included — uncheck to remove'}
          {currentGroup.required ? '' : ' (optional)'}
          {currentGroup.selection_type !== 'single' && currentSel.size > 0 && (
            <span style={{ color: t.primary, marginLeft: 8, fontWeight: 600 }}>{currentSel.size} selected</span>
          )}
        </p>

        <div className="grid gap-3 max-w-lg mx-auto grid-cols-2">
          {currentGroup.modifiers.map(mod => {
            const isSelected = currentSel.has(mod.id);

            if (currentGroup.selection_type === 'toggle') {
              return (
                <button
                  key={mod.id}
                  onClick={() => toggleSelection(mod.id)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all active:scale-95"
                  style={{
                    background: isSelected ? `${t.success}20` : t.bgCard,
                    border: `2px solid ${isSelected ? `${t.success}50` : t.border}`,
                    textDecoration: isSelected ? 'none' : 'line-through',
                    color: isSelected ? t.text : t.textMuted,
                  }}
                >
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{
                    border: `2px solid ${isSelected ? t.success : t.border}`,
                    background: isSelected ? t.success : 'transparent',
                  }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                  </span>
                  <span className="text-sm font-medium">{mod.name}</span>
                </button>
              );
            }

            return (
              <button
                key={mod.id}
                onClick={() => toggleSelection(mod.id)}
                className="relative rounded-xl p-4 text-left transition-all active:scale-95"
                style={{
                  background: isSelected ? `${t.info}30` : t.bgCard,
                  border: `2px solid ${isSelected ? t.info : t.border}`,
                  color: t.text,
                }}
              >
                <div className="font-semibold text-sm">{mod.name}</div>
                {mod.extra_price > 0 && <div className="text-sm mt-1" style={{ color: t.primary }}>+{currency}{mod.extra_price.toFixed(2)}</div>}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.info }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 shrink-0 flex gap-3" style={{ background: t.bg }}>
        {stepIdx > 0 && (
          <button
            onClick={() => setStepIdx(stepIdx - 1)}
            className="flex-1 py-3.5 rounded-xl font-semibold transition-colors"
            style={{ background: t.bgCard, color: t.textSecondary }}
          >
            ← Back
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="flex-1 py-3.5 rounded-xl font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-30"
          style={{
            background: isLastStep ? t.success : t.primary,
            color: isLastStep ? '#fff' : t.primaryText,
          }}
        >
          {isLastStep ? 'ADD TO ORDER' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
