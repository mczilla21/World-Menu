import { useState, useEffect, useRef } from 'react';
import type { MenuItem, ItemVariant } from '../../hooks/useMenu';
import { useCustomerStore } from '../../stores/customerStore';

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

// ── Visual mappings ──────────────────────────────────────────

function getBrothColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('thick')) return '#9B7020';
  if (n.includes('clear')) return '#E8C872';
  if (n.includes('tom yum')) return '#D44D2D';
  if (n.includes('yen ta')) return '#C94277';
  if (n.includes('dry')) return '#E8D8B8';
  return '#D4A843';
}

function getBrothGradient(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('thick')) return 'linear-gradient(to bottom, #B8862D, #7A5C1A)';
  if (n.includes('clear')) return 'linear-gradient(to bottom, #F0D87A, #D4B85A)';
  if (n.includes('tom yum')) return 'linear-gradient(to bottom, #E86B50, #C43D20)';
  if (n.includes('yen ta')) return 'linear-gradient(to bottom, #E06090, #B83462)';
  if (n.includes('dry')) return 'linear-gradient(to bottom, #F0E4CE, #E0D0B0)';
  return 'linear-gradient(to bottom, #E8C872, #C4A050)';
}

function getNoodleColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('glass')) return 'rgba(255,255,255,0.5)';
  if (n.includes('egg')) return '#F0C840';
  if (n.includes('instant')) return '#FFD54F';
  return '#F5DEB3';
}

function getNoodleThick(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('flat') || n.includes('egg');
}

function isWonton(name: string): boolean {
  return name.toLowerCase().includes('wonton');
}

function getProteinEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('tofu')) return '🫘';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('pork')) return '🥩';
  if (n.includes('beef')) return '🥩';
  if (n.includes('seafood') || n.includes('shrimp')) return '🦐';
  if (n.includes('fish')) return '🐟';
  return '🍖';
}

function getStepType(groupName: string): 'broth' | 'noodle' | 'protein' | 'topping' | 'other' {
  const n = groupName.toLowerCase();
  if (n.includes('broth') || n.includes('soup')) return 'broth';
  if (n.includes('noodle')) return 'noodle';
  if (n.includes('protein') || n.includes('meat')) return 'protein';
  if (n.includes('topping') || n.includes('extra') || n.includes('customize') || n.includes('add-on') || n.includes('garnish')) return 'topping';
  return 'other';
}

function getToppingEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bean sprout')) return '🌱';
  if (n.includes('green onion') || n.includes('scallion')) return '🧅';
  if (n.includes('cilantro') || n.includes('coriander')) return '🌿';
  if (n.includes('spinach') || n.includes('watercress') || n.includes('water spinach')) return '🥬';
  if (n.includes('peanut')) return '🥜';
  if (n.includes('soy sauce') || n.includes('sauce')) return '🫗';
  if (n.includes('egg')) return '🥚';
  if (n.includes('lime')) return '🍋';
  if (n.includes('chili') || n.includes('spicy') || n.includes('pepper')) return '🌶️';
  if (n.includes('garlic')) return '🧄';
  if (n.includes('mushroom')) return '🍄';
  if (n.includes('corn')) return '🌽';
  if (n.includes('seaweed') || n.includes('nori')) return '🍃';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('pork')) return '🥩';
  if (n.includes('beef')) return '🥩';
  if (n.includes('shrimp') || n.includes('seafood')) return '🦐';
  if (n.includes('tofu')) return '🫘';
  if (n.includes('fish')) return '🐟';
  return '✨';
}

// Get a friendly step label from group name (strip "Step X:" prefix)
function cleanStepName(name: string): string {
  return name.replace(/^step\s*\d+\s*:\s*/i, '');
}

// ── Noodle SVG lines ─────────────────────────────────────────

function NoodleLines({ color, thick }: { color: string; thick: boolean }) {
  const w = thick ? 4 : 2.5;
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <path
          key={i}
          d={`M${10 + i * 6},${5 + i * 9} Q${50 + i * 4},${-2 + i * 9} ${100},${8 + i * 9} Q${150 - i * 4},${18 + i * 9} ${190 - i * 6},${5 + i * 9}`}
          stroke={color}
          fill="none"
          strokeWidth={w}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

function WontonShapes({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
      {[
        [40, 20], [90, 15], [140, 25], [60, 40], [120, 38], [170, 18],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy} rx={14} ry={10} fill={color} opacity={0.7} />
          <path d={`M${cx! - 8},${cy! - 2} Q${cx},${cy! - 10} ${cx! + 8},${cy! - 2}`} stroke="#D4A843" fill="none" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

// ── Steam animation ──────────────────────────────────────────

function Steam() {
  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-10 pointer-events-none">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full bg-white/30"
          style={{
            width: 8 + i * 4,
            height: 8 + i * 4,
            left: `${30 + i * 20}%`,
            animation: `steam ${1.5 + i * 0.3}s ease-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Toppings in bowl ─────────────────────────────────────────

function BowlToppings({ toppings }: { toppings: { name: string }[] }) {
  if (toppings.length === 0) return null;
  // Spread toppings across the full bowl surface in a circular pattern
  // Positions are within the inner circle (avoid edges where rim is)
  const positions = [
    { x: '18%', y: '18%' }, { x: '62%', y: '15%' },
    { x: '72%', y: '42%' }, { x: '15%', y: '55%' },
    { x: '55%', y: '65%' }, { x: '35%', y: '35%' },
    { x: '68%', y: '68%' }, { x: '22%', y: '72%' },
    { x: '48%', y: '18%' }, { x: '78%', y: '25%' },
    { x: '10%', y: '38%' }, { x: '42%', y: '78%' },
  ];
  return (
    <>
      {toppings.slice(0, 12).map((t, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: positions[i % positions.length].x,
            top: positions[i % positions.length].y,
            fontSize: 14,
            animation: `garnishDrop 0.3s ease-out ${i * 0.06}s both`,
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))',
          }}
        >
          {getToppingEmoji(t.name)}
        </div>
      ))}
    </>
  );
}

function Garnish() {
  const dots = [
    { x: '20%', y: '15%', color: '#4CAF50', size: 5 },
    { x: '75%', y: '20%', color: '#8BC34A', size: 4 },
    { x: '40%', y: '10%', color: '#66BB6A', size: 3 },
    { x: '60%', y: '25%', color: '#AED581', size: 4 },
    { x: '85%', y: '12%', color: '#4CAF50', size: 3 },
    { x: '30%', y: '22%', color: '#81C784', size: 5 },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: d.x, top: d.y, width: d.size, height: d.size,
            backgroundColor: d.color,
            animation: `garnishDrop 0.4s ease-out ${i * 0.05}s both`,
          }}
        />
      ))}
    </>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function NoodleBowlBuilder({
  item, translatedName, translatedDesc, currency, nativeName, themeColor, onClose,
  translateModGroup, translateModifier,
}: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [selections, setSelections] = useState<Record<number, Set<number>>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const { addItem } = useCustomerStore();

  const hasVariants = item.variants && item.variants.length > 0;

  useEffect(() => {
    fetch(`/api/menu/${item.id}/modifier-groups`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
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
      })
      .catch(() => {});
  }, [item.id]);

  // Auto-select first variant
  useEffect(() => {
    if (item.variants && item.variants.length > 0 && !selectedVariant) {
      setSelectedVariant(item.variants[0]);
    }
  }, [item.id]);

  // Current selection helpers
  const currentGroup = groups[stepIdx] || null;
  const currentSel = currentGroup ? (selections[currentGroup.id] || new Set<number>()) : new Set<number>();

  // Get first selected modifier for visualization (broth/noodle/protein)
  const getSelectedMod = (groupId: number) => {
    const sel = selections[groupId];
    if (!sel || sel.size === 0) return null;
    const firstId = sel.values().next().value;
    const g = groups.find(gr => gr.id === groupId);
    return g?.modifiers.find(m => m.id === firstId) || null;
  };

  // Get all selected modifiers for a group
  const getSelectedMods = (groupId: number) => {
    const sel = selections[groupId];
    if (!sel || sel.size === 0) return [];
    const g = groups.find(gr => gr.id === groupId);
    return g?.modifiers.filter(m => sel.has(m.id)) || [];
  };

  // Visual state derived from selections
  const brothGroup = groups.find(g => getStepType(g.name) === 'broth');
  const noodleGroup = groups.find(g => getStepType(g.name) === 'noodle');
  const proteinGroup = groups.find(g => getStepType(g.name) === 'protein');

  const selectedBroth = brothGroup ? getSelectedMod(brothGroup.id) : null;
  const selectedNoodle = noodleGroup ? getSelectedMod(noodleGroup.id) : null;
  const selectedProtein = proteinGroup ? getSelectedMod(proteinGroup.id) : null;

  // Collect all selected toppings from non-broth/noodle/protein groups
  const selectedToppings = groups
    .filter(g => !['broth', 'noodle', 'protein'].includes(getStepType(g.name)))
    .flatMap(g => getSelectedMods(g.id));

  const isComplete = groups.length > 0 && groups.every(g => !g.required || (selections[g.id] && selections[g.id].size > 0));

  // Auto-advance timer ref (cleanup on unmount)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); }, []);

  // Select a modifier — single-select for 'single', multi for 'multi'/'toggle'
  const handleSelect = (modId: number) => {
    if (!currentGroup) return;
    const isSingle = currentGroup.selection_type === 'single';
    setSelections(prev => {
      const current = new Set(prev[currentGroup.id] || []);
      if (isSingle) {
        // Replace selection
        return { ...prev, [currentGroup.id]: new Set([modId]) };
      } else {
        // Toggle in/out
        if (current.has(modId)) current.delete(modId);
        else current.add(modId);
        return { ...prev, [currentGroup.id]: current };
      }
    });
    // Auto-advance only for single-select groups
    if (isSingle && stepIdx < groups.length - 1) {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = setTimeout(() => setStepIdx(s => Math.min(s + 1, groups.length - 1)), 400);
    }
  };

  // Price calculation — sum all selected modifiers across all groups
  const totalExtra = groups.reduce((sum, g) => {
    const mods = getSelectedMods(g.id);
    return sum + mods.reduce((s, m) => s + m.extra_price, 0);
  }, 0);

  const basePrice = hasVariants && selectedVariant ? selectedVariant.price
    : (item.is_special && item.special_price != null ? item.special_price : item.price);
  const totalPrice = (basePrice + totalExtra) * quantity;

  // Add to cart
  const handleAddToCart = () => {
    if (groups.some(g => g.required && (!selections[g.id] || selections[g.id].size === 0))) return;
    const notesParts: string[] = [];
    for (const g of groups) {
      const mods = getSelectedMods(g.id);
      if (mods.length > 0) notesParts.push(mods.map(m => m.name).join(', '));
    }
    if (notes.trim()) notesParts.push(notes.trim());

    addItem({
      menu_item_id: item.id,
      item_name: nativeName,
      item_name_translated: translatedName,
      quantity,
      notes: notesParts.join(' | '),
      item_price: basePrice + totalExtra,
      variant_name: selectedVariant?.name || '',
      combo_id: null,
      combo_slot_label: '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-orange-50 to-amber-50">
      {/* Keyframes */}
      <style>{`
        @keyframes steam {
          0% { opacity: 0.4; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-24px) scale(1.5); }
        }
        @keyframes garnishDrop {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bowlPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes floatIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-orange-100">
        <button onClick={onClose} aria-label="Go back" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">{translatedName}</h1>
        <div className="w-10" />
      </div>

      {/* Main content — bowl on right, selections on left */}
      <div className="flex-1 flex overflow-hidden">
        {/* Right: Bowl visual — top-down view */}
        <div className="hidden sm:flex w-[220px] shrink-0 flex-col items-center justify-center p-3 border-l border-orange-100 bg-gradient-to-b from-orange-50/50 to-amber-50/50">
          {/* Top-down bowl */}
          <div
            className="relative"
            style={{ width: 180, height: 180, animation: isComplete ? 'bowlPulse 2s ease-in-out infinite' : undefined }}
          >
            {/* Bowl rim (outer circle) */}
            <div className="absolute inset-0 rounded-full" style={{
              background: 'linear-gradient(135deg, #D4A855, #A88840)',
              boxShadow: '0 4px 16px rgba(139,110,46,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
            }} />

            {/* Bowl interior (inner circle) */}
            <div className="absolute rounded-full overflow-hidden" style={{
              top: 8, left: 8, right: 8, bottom: 8,
              background: selectedBroth ? getBrothColor(selectedBroth.name) : '#FFF8F0',
              transition: 'background 0.6s ease',
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {/* Empty state */}
              {!selectedBroth && !selectedNoodle && !selectedProtein && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {brothGroup ? (
                    <span className="text-gray-300 text-xs font-medium">Pick ingredients!</span>
                  ) : (
                    <span className="text-4xl">🍜</span>
                  )}
                </div>
              )}

              {/* Noodles — curved lines across the bowl */}
              {selectedNoodle && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  {[15, 30, 45, 60, 75].map((y, i) => (
                    <path key={i}
                      d={`M${10+i*3},${y} Q${30+i*5},${y-8} 50,${y} Q${70-i*5},${y+8} ${90-i*3},${y}`}
                      stroke={getNoodleColor(selectedNoodle.name)}
                      fill="none" strokeWidth={getNoodleThick(selectedNoodle.name) ? 3 : 2}
                      opacity={0.7} strokeLinecap="round"
                    />
                  ))}
                </svg>
              )}

              {/* Protein — center of bowl */}
              {selectedProtein && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
                  style={{ fontSize: 36, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))', animation: 'floatIn 0.4s ease-out' }}>
                  {getProteinEmoji(selectedProtein.name)}
                </div>
              )}

              {/* Toppings — scattered around the bowl surface */}
              {selectedToppings.length > 0 && <BowlToppings toppings={selectedToppings} />}
              {selectedProtein && selectedToppings.length === 0 && <Garnish />}

              {/* Broth shimmer overlay */}
              {selectedBroth && (
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                }} />
              )}
            </div>

            {/* Chopsticks */}
            <div className="absolute" style={{ top: -5, right: -10, transform: 'rotate(30deg)', transformOrigin: 'bottom left' }}>
              <div style={{ width: 4, height: 70, background: 'linear-gradient(to bottom, #D2691E, #8B4513)', borderRadius: 2, position: 'absolute', left: 0 }} />
              <div style={{ width: 4, height: 70, background: 'linear-gradient(to bottom, #D2691E, #8B4513)', borderRadius: 2, position: 'absolute', left: 8 }} />
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex gap-1 mt-3 flex-wrap justify-center">
            {selectedBroth && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: getBrothColor(selectedBroth.name) + '25', color: getBrothColor(selectedBroth.name) }}>
                {translateModifier(selectedBroth.id, selectedBroth.name)}
              </span>
            )}
            {selectedNoodle && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {translateModifier(selectedNoodle.id, selectedNoodle.name)}
              </span>
            )}
            {selectedProtein && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                {getProteinEmoji(selectedProtein.name)} {translateModifier(selectedProtein.id, selectedProtein.name)}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="text-lg font-bold mt-1" style={{ color: themeColor }}>
            {totalExtra > 0 && <span className="text-sm text-gray-400 mr-1 line-through">{currency}{basePrice.toFixed(2)}</span>}
            {currency}{(basePrice + totalExtra).toFixed(2)}
          </div>
        </div>{/* End right bowl panel */}

        {/* Left: selections (scrollable) */}
        <div className="flex-1 overflow-auto order-first pt-3">
        {groups.length > 0 && (
          <div className="flex items-center justify-center gap-2 px-4 pb-3">
            {groups.map((g, i) => {
              const done = selections[g.id] && selections[g.id].size > 0;
              const active = i === stepIdx;
              return (
                <button
                  key={g.id}
                  onClick={() => setStepIdx(i)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: active ? themeColor + '18' : done ? '#dcfce7' : '#f1f5f9',
                    color: active ? themeColor : done ? '#16a34a' : '#94a3b8',
                    border: active ? `2px solid ${themeColor}` : '2px solid transparent',
                  }}
                >
                  {done && !active && <span>&#10003;</span>}
                  <span>{i + 1}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Current step */}
        {currentGroup && (
          <div className="px-4 pb-4" style={{ animation: 'floatIn 0.3s ease-out' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {translateModGroup(currentGroup.id, cleanStepName(currentGroup.name))}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {getStepType(currentGroup.name) === 'broth' && 'Pick your soup base'}
              {getStepType(currentGroup.name) === 'noodle' && 'Choose your noodles'}
              {getStepType(currentGroup.name) === 'protein' && 'Add your protein'}
              {getStepType(currentGroup.name) === 'topping' && 'Pick as many as you like'}
              {getStepType(currentGroup.name) === 'other' && (currentGroup.selection_type === 'single' ? 'Select one' : 'Pick as many as you like')}
              {currentGroup.required ? '' : ' (optional)'}
              {currentSel.size > 0 && currentGroup.selection_type !== 'single' && (
                <span className="ml-2 font-semibold" style={{ color: themeColor }}>{currentSel.size} selected</span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {currentGroup.modifiers.map(mod => {
                const isSelected = currentSel.has(mod.id);
                const stepType = getStepType(currentGroup.name);
                return (
                  <button
                    key={mod.id}
                    onClick={() => handleSelect(mod.id)}
                    className="relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all active:scale-95 border-2"
                    style={{
                      borderColor: isSelected ? themeColor : '#e5e7eb',
                      backgroundColor: isSelected ? themeColor + '10' : '#fff',
                      boxShadow: isSelected ? `0 4px 12px ${themeColor}25` : '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    {/* Visual preview */}
                    <div className="text-2xl mb-1.5">
                      {stepType === 'broth' && (
                        <div className="w-8 h-8 rounded-full" style={{ background: getBrothGradient(mod.name) }} />
                      )}
                      {stepType === 'noodle' && (
                        isWonton(mod.name) ? '🥟' : (
                          <div className="w-8 h-3 rounded-full" style={{ background: getNoodleColor(mod.name), border: '1px solid rgba(0,0,0,0.1)' }} />
                        )
                      )}
                      {stepType === 'protein' && getProteinEmoji(mod.name)}
                      {stepType === 'topping' && getToppingEmoji(mod.name)}
                      {stepType === 'other' && '🍽'}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 text-center leading-tight">
                      {translateModifier(mod.id, mod.name.replace(/\s*\(\+\$[\d.]+\)\s*$/, ''))}
                    </span>
                    {mod.extra_price > 0 && (
                      <span className="text-xs text-gray-500 mt-0.5">+{currency}{mod.extra_price.toFixed(2)}</span>
                    )}
                    {isSelected && (
                      <div
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: themeColor }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Next button for multi-select steps */}
            {currentGroup.selection_type !== 'single' && stepIdx < groups.length - 1 && (
              <button
                onClick={() => setStepIdx(s => s + 1)}
                className="w-full mt-3 py-3 rounded-xl font-bold text-white text-sm"
                style={{ backgroundColor: themeColor }}
              >
                Next →
              </button>
            )}
          </div>
        )}

        {/* Variant picker (if item has size variants) */}
        {hasVariants && (
          <div className="px-4 pb-3">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Select size</label>
            <div className="flex gap-2 flex-wrap">
              {item.variants.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                    selectedVariant?.id === v.id ? 'text-white' : 'border-gray-200 text-gray-700'
                  }`}
                  style={selectedVariant?.id === v.id ? { borderColor: themeColor, backgroundColor: themeColor } : undefined}
                >
                  {v.name} — {currency}{v.price.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Special requests */}
        <div className="px-4 pb-4">
          {!showNotes ? (
            <button
              onClick={() => setShowNotes(true)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              Special requests
            </button>
          ) : (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any allergies or preferences..."
              rows={2}
              autoFocus
              className="w-full bg-white rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 resize-none border border-gray-200"
              style={{ '--tw-ring-color': themeColor } as any}
            />
          )}
        </div>
        </div>{/* End left selections panel */}
      </div>{/* End main flex row */}

      {/* Bottom bar */}
      <div className="shrink-0 p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 py-2">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-bold">-</button>
            <span className="text-lg font-bold text-gray-900 w-6 text-center">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-bold">+</button>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={groups.some(g => g.required && (!selections[g.id] || selections[g.id].size === 0))}
            className="flex-1 py-3.5 rounded-2xl font-bold text-white text-lg disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ backgroundColor: themeColor }}
          >
            Add {currency}{totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
