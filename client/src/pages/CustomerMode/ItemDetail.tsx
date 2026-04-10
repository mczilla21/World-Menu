import { useState, useEffect } from 'react';
import type { MenuItem, ItemVariant } from '../../hooks/useMenu';
import { useCustomerStore } from '../../stores/customerStore';
import { ALLERGEN_MAP } from '../../constants/allergens';
import NoodleBowlBuilder from './NoodleBowlBuilder';

const TAG_ICONS: Record<string, string> = {
  'Vegetarian': '🌿', 'Vegan': '🌱', 'Gluten-Free': 'GF', 'Spicy': '🌶',
  'Nuts': '🥜', 'Dairy': '🥛', 'Seafood': '🐟', 'Halal': '☪',
};

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
  item: MenuItem;
  translatedName: string;
  translatedDesc: string;
  currency: string;
  nativeName: string;
  themeColor: string;
  onClose: () => void;
  translateModGroup: (groupId: number, fallback: string) => string;
  translateModifier: (modId: number, fallback: string) => string;
}

import { useSettings } from '../../hooks/useSettings';

export default function ItemDetail({ item, translatedName, translatedDesc, currency, nativeName, themeColor, onClose, translateModGroup, translateModifier }: Props) {
  const { settings } = useSettings();
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [selections, setSelections] = useState<Record<number, Set<number>>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
  const [showAgeCheck, setShowAgeCheck] = useState(false);
  const { addItem, ageVerified, setAgeVerified } = useCustomerStore();

  const hasVariants = item.variants && item.variants.length > 0;

  useEffect(() => {
    // If alcohol and not age verified, show check
    if (item.is_alcohol && !ageVerified) {
      setShowAgeCheck(true);
    }
  }, [item.is_alcohol, ageVerified]);

  useEffect(() => {
    setGroupsLoaded(false);
    fetch(`/api/menu/${item.id}/modifier-groups`)
      .then(r => r.json())
      .then((data: ModifierGroup[]) => {
        setGroups(data);
        const initial: Record<number, Set<number>> = {};
        for (const g of data) {
          if (g.selection_type === 'toggle') {
            initial[g.id] = new Set(g.modifiers.filter(m => m.default_on).map(m => m.id));
          } else {
            initial[g.id] = new Set<number>();
          }
        }
        setSelections(initial);
        setGroupsLoaded(true);
      })
      .catch(() => setGroupsLoaded(true));
  }, [item.id]);

  // Auto-select first variant if available
  useEffect(() => {
    if (hasVariants && !selectedVariant) {
      setSelectedVariant(item.variants[0]);
    }
  }, [hasVariants, item.variants, selectedVariant]);

  const hasModifiers = groups.length > 0;
  const currentGroup = hasModifiers ? groups[stepIdx] : null;
  const currentSel: Set<number> = currentGroup ? (selections[currentGroup.id] || new Set<number>()) : new Set<number>();

  const toggleSelection = (modId: number) => {
    if (!currentGroup) return;
    const sel = new Set(currentSel);
    if (currentGroup.selection_type === 'single') {
      if (sel.has(modId)) sel.delete(modId);
      else { sel.clear(); sel.add(modId); }
    } else {
      if (sel.has(modId)) sel.delete(modId);
      else sel.add(modId);
    }
    setSelections(prev => ({ ...prev, [currentGroup.id]: sel }));
  };

  const totalExtra = groups.reduce((sum, g) => {
    const sel = selections[g.id] || new Set<number>();
    return sum + g.modifiers.filter(m => sel.has(m.id)).reduce((s, m) => s + m.extra_price, 0);
  }, 0);

  const basePrice = hasVariants && selectedVariant ? selectedVariant.price
    : (item.is_special && item.special_price != null ? item.special_price : item.price);
  const totalPrice = (basePrice + totalExtra) * quantity;

  const handleAddToCart = () => {
    const notesParts: string[] = [];
    for (const g of groups) {
      const sel = selections[g.id] || new Set<number>();
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
    if (notes.trim()) notesParts.push(notes.trim());

    addItem({
      menu_item_id: item.id,
      item_name: nativeName,
      item_name_translated: translatedName,
      quantity,
      show_in_kitchen: !!item.category_show_in_kitchen,
      notes: notesParts.join(' | '),
      item_price: basePrice + totalExtra,
      variant_name: selectedVariant?.name || '',
      combo_id: null,
      combo_slot_label: '',
    });
    onClose();
  };

  // Bowl builder — only when enabled in settings
  const bowlBuilderEnabled = settings.bowl_builder_enabled === '1';
  const hasBuildSteps = bowlBuilderEnabled && groups.length >= 3
    && groups.some(g => /broth|soup/i.test(g.name))
    && groups.some(g => /noodle/i.test(g.name))
    && groups.some(g => /protein|meat/i.test(g.name));
  const isNoodleCategory = bowlBuilderEnabled && /ramen|noodle/i.test(item.category_name || '');
  const isBowlBuilder = groupsLoaded && (hasBuildSteps || (isNoodleCategory && groups.length > 0));

  // Loading state while modifier groups haven't loaded yet
  if (!groupsLoaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-gray-200 rounded-full mx-auto" style={{ borderTopColor: themeColor }} />
          <p className="text-gray-500 mt-3 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Bowl builder gets its own full-screen experience
  if (isBowlBuilder && !showAgeCheck) {
    return (
      <NoodleBowlBuilder
        item={item}
        translatedName={translatedName}
        translatedDesc={translatedDesc}
        currency={currency}
        nativeName={nativeName}
        themeColor={themeColor}
        onClose={onClose}
        translateModGroup={translateModGroup}
        translateModifier={translateModifier}
      />
    );
  }

  // Age verification modal
  if (showAgeCheck) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-8 max-w-sm mx-4 text-center">
          <div className="text-4xl mb-4">🍷</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Age Verification</h2>
          <p className="text-gray-500 mb-6">Are you of legal drinking age in your country?</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold bg-gray-100 text-gray-600"
            >
              No
            </button>
            <button
              onClick={() => { setAgeVerified(); setShowAgeCheck(false); }}
              className="flex-1 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mt-auto bg-white rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Image */}
        {item.image && (
          <div className="w-full h-56 rounded-t-3xl overflow-hidden shrink-0">
            <img src={`/uploads/${item.image}`} alt={translatedName} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 overflow-auto p-5">
          <h2 className="text-2xl font-bold text-gray-900">{translatedName}</h2>
          {translatedDesc && <p className="text-gray-500 mt-2">{translatedDesc}</p>}

          {/* Info */}
          {(item.serves || item.prep_time_minutes > 0) && (
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              {item.serves && <span>Serves {item.serves}</span>}
              {item.prep_time_minutes > 0 && <span>~{item.prep_time_minutes} min</span>}
            </div>
          )}

          {/* Tags */}
          {item.tags && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {item.tags.split(',').filter(Boolean).map(tag => {
                const icon = TAG_ICONS[tag.trim()];
                return (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {icon ? `${icon} ` : ''}{tag.trim()}
                  </span>
                );
              })}
            </div>
          )}

          {/* Allergens */}
          {item.allergens && item.allergens.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {item.allergens.map(code => {
                const a = ALLERGEN_MAP[code];
                return a ? (
                  <span key={code} className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 font-medium">
                    {a.icon} {a.name}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Variant picker */}
          {hasVariants && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Select size</label>
              <div className="flex gap-2 flex-wrap">
                {item.variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                      selectedVariant?.id === v.id
                        ? 'border-opacity-100 text-white'
                        : 'border-gray-200 text-gray-700'
                    }`}
                    style={selectedVariant?.id === v.id ? { borderColor: themeColor, backgroundColor: themeColor } : undefined}
                  >
                    {v.name} — {currency}{v.price.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price */}
          <div className="text-xl font-bold mt-3" style={{ color: themeColor }}>
            {item.is_special && item.special_price != null && !hasVariants && (
              <span className="line-through text-gray-400 font-normal mr-2 text-base">{currency}{item.price.toFixed(2)}</span>
            )}
            {currency}{basePrice.toFixed(2)}
            {totalExtra > 0 && <span className="text-sm text-gray-500 ml-2">+{currency}{totalExtra.toFixed(2)}</span>}
          </div>

          {/* Modifier steps */}
          {hasModifiers && currentGroup && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                {groups.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= stepIdx ? 'opacity-100' : 'opacity-30'}`} style={{ backgroundColor: themeColor }} />
                ))}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{translateModGroup(currentGroup.id, currentGroup.name)}</h3>
              <p className="text-xs text-gray-500 mb-3">
                {currentGroup.selection_type === 'single' && 'Select one'}
                {currentGroup.selection_type === 'multi' && 'Select one or more'}
                {currentGroup.selection_type === 'toggle' && 'All included — tap to remove'}
                {currentGroup.required ? ' (required)' : ' (optional)'}
              </p>
              <div className="space-y-2">
                {currentGroup.modifiers.map(mod => {
                  const isSelected = currentSel.has(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleSelection(mod.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border-2 ${
                        isSelected ? 'border-opacity-100 bg-opacity-5' : 'border-gray-200 bg-white'
                      }`}
                      style={isSelected ? { borderColor: themeColor, backgroundColor: `${themeColor}10` } : undefined}
                    >
                      <span className="font-medium text-gray-900">{translateModifier(mod.id, mod.name)}</span>
                      <div className="flex items-center gap-2">
                        {mod.extra_price > 0 && <span className="text-sm text-gray-500">+{currency}{mod.extra_price.toFixed(2)}</span>}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-current' : 'border-gray-300'}`}
                          style={isSelected ? { borderColor: themeColor, backgroundColor: themeColor } : undefined}
                        >
                          {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {stepIdx < groups.length - 1 && (
                <button
                  onClick={() => setStepIdx(stepIdx + 1)}
                  disabled={!!currentGroup.required && currentSel.size === 0}
                  className="w-full mt-3 py-3 rounded-xl font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: themeColor }}
                >
                  Next
                </button>
              )}
              {stepIdx > 0 && (
                <button
                  onClick={() => setStepIdx(stepIdx - 1)}
                  className="w-full mt-2 py-2 text-gray-500 text-sm"
                >
                  Back
                </button>
              )}
            </div>
          )}

          {/* Special requests */}
          <div className="mt-5">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Special requests</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any allergies or preferences..."
              rows={2}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': themeColor } as any}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 py-2">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-bold">-</button>
              <span className="text-lg font-bold text-gray-900 w-6 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-bold">+</button>
            </div>
            {hasModifiers && stepIdx < groups.length - 1 ? (
              <button
                onClick={() => setStepIdx(stepIdx + 1)}
                disabled={!!currentGroup?.required && currentSel.size === 0}
                className="flex-1 py-3.5 rounded-xl font-bold text-white text-lg disabled:opacity-40 transition-all active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={(hasModifiers && !!currentGroup?.required && currentSel.size === 0) || (hasVariants && !selectedVariant)}
                className="flex-1 py-3.5 rounded-xl font-bold text-white text-lg disabled:opacity-40 transition-all active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}
              >
                Add {currency}{totalPrice.toFixed(2)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
