import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { MenuItem, Category } from '../../hooks/useMenu';
import type { CartItem } from '../../stores/orderStore';
import { useOrderStore } from '../../stores/orderStore';
import { useSettings } from '../../hooks/useSettings';
import { useI18n } from '../../i18n/useI18n';
import IngredientPopup from '../../components/IngredientPopup';

interface Props {
  items: MenuItem[];
  categories: Category[];
  cart: CartItem[];
  onAddSimple: (id: number, name: string, showInKitchen: boolean, price?: number, variantName?: string) => void;
  onRemove: (cartId: string) => void;
  onOpenBuilder: (categoryId: number, item: { id: number; name: string }, price: number, showInKitchen: boolean) => void;
  onOpenVariant: (item: MenuItem) => void;
  onReview: () => void;
}

/** Sort categories into a logical dining service order:
 *  1. Drinks/Beverages
 *  2. Appetizers/Starters/Sides
 *  3. Main courses (everything else, keep existing sort_order)
 *  4. Desserts/Sweets
 */
function sortCategoriesInServiceOrder(cats: Category[]): Category[] {
  const getPriority = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower.includes('drink') || lower.includes('beverage')) return 0;
    if (lower.includes('appetizer') || lower.includes('starter') || lower.includes('side')) return 1;
    if (lower.includes('dessert') || lower.includes('sweet')) return 3;
    return 2; // main courses
  };

  return [...cats].sort((a, b) => {
    const pa = getPriority(a.name);
    const pb = getPriority(b.name);
    if (pa !== pb) return pa - pb;
    return a.sort_order - b.sort_order;
  });
}

export default function MenuGrid({ items, categories, cart, onAddSimple, onRemove, onOpenBuilder, onOpenVariant, onReview }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [builderCats, setBuilderCats] = useState<Set<number>>(new Set());
  const { currentCustomer, customerCount, setCurrentCustomer, addCustomer } = useOrderStore();
  const { settings } = useSettings();
  const { t } = useI18n();

  // Sort categories into service order
  const sortedCategories = useMemo(() => sortCategoriesInServiceOrder(categories), [categories]);

  useEffect(() => {
    // Fetch all modifier groups + item assignments to know which items have modifiers
    Promise.all([
      fetch('/api/modifier-groups').then(r => r.json()),
    ]).then(([groups]) => {
      const catIds = new Set<number>(groups.map((g: any) => g.category_id as number));
      setBuilderCats(catIds);
    });
  }, []);

  const currentCat = sortedCategories[stepIndex];
  const isLastStep = stepIndex === sortedCategories.length - 1;
  const isBuilderTab = builderCats.has(currentCat?.id ?? -1);
  const filtered = currentCat ? items.filter((i) => i.category_id === currentCat.id) : [];

  const getSimpleQty = (id: number) => cart.filter((c) => c.menu_item_id === id && !c.notes).reduce((s, c) => s + c.quantity, 0);
  const getBuildCount = (id: number) => cart.filter((c) => c.menu_item_id === id && c.notes).length;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.item_price * i.quantity, 0);

  const catItemCount = (catId: number) => {
    const catItemIds = new Set(items.filter(i => i.category_id === catId).map(i => i.id));
    return cart.filter(c => catItemIds.has(c.menu_item_id)).reduce((s, c) => s + c.quantity, 0);
  };

  const customerItemCount = (custNum: number) =>
    cart.filter(c => c.customer_number === custNum).reduce((s, c) => s + c.quantity, 0);

  const currency = settings.currency_symbol || '$';

  const [ingredientTarget, setIngredientTarget] = useState<MenuItem | null>(null);

  const handleItemTap = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      onOpenVariant(item);
    } else if (isBuilderTab) {
      onOpenBuilder(currentCat!.id, { id: item.id, name: item.name }, item.price || 0, !!item.category_show_in_kitchen);
    } else {
      onAddSimple(item.id, item.name, !!item.category_show_in_kitchen, item.price);
    }
  };

  const handleItemLongPress = (item: MenuItem) => {
    const ingredients = (item.ingredients || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ingredients.length > 0) {
      setIngredientTarget(item);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Customer selector */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mr-1">{t('Guest')}</span>
        {Array.from({ length: customerCount }, (_, i) => i + 1).map((n) => {
          const count = customerItemCount(n);
          return (
            <button
              key={n}
              onClick={() => setCurrentCustomer(n)}
              className={`relative w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                n === currentCustomer
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {n}
              {count > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  n === currentCustomer ? 'bg-blue-400 text-blue-950' : 'bg-green-600 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={addCustomer}
          className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-500 hover:text-slate-300 text-base font-bold flex items-center justify-center transition-colors"
        >
          +
        </button>
      </div>

      {/* Step indicator */}
      <div className="px-4 py-1.5 bg-slate-800/60 border-b border-slate-700/30 text-xs font-semibold text-slate-400 tracking-wide">
        Step {stepIndex + 1} of {sortedCategories.length}: <span className="text-white">{currentCat?.name ?? ''}</span>
      </div>

      {/* Category tabs - wrap to multiple rows */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5 shrink-0 bg-slate-850 border-b border-slate-700/30">
        {sortedCategories.map((c, i) => {
          const count = catItemCount(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setStepIndex(i)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                i === stepIndex
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {c.name}
              {count > 0 && (
                <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  i === stepIndex ? 'bg-white/20 text-white' : 'bg-green-600 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-auto p-3">
        {isBuilderTab && (
          <p className="text-center text-slate-500 text-xs mb-3">Tap to customize</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filtered.map((item) => {
            const is86d = !item.is_active;
            const simpleQty = getSimpleQty(item.id);
            const buildCount = getBuildCount(item.id);
            const totalQty = simpleQty + buildCount;
            const hasVariants = item.variants && item.variants.length > 0;
            const displayPrice = hasVariants
              ? Math.min(...item.variants.map(v => v.price))
              : (item.is_special && item.special_price != null ? item.special_price : item.price);

            return (
              <ItemButton
                key={item.id}
                disabled={is86d}
                onTap={() => handleItemTap(item)}
                onLongPress={() => handleItemLongPress(item)}
                hasIngredients={!!(item.ingredients || '').trim()}
                className={`relative rounded-xl p-3.5 text-left transition-all active:scale-[0.97] ${
                  is86d
                    ? 'bg-slate-800/60 opacity-40 cursor-not-allowed'
                    : totalQty > 0
                      ? 'bg-blue-600/90 shadow-lg shadow-blue-600/20'
                      : 'bg-slate-800 hover:bg-slate-700 border border-slate-700/50'
                }`}
              >
                {item.image && (
                  <div className="w-full h-16 mb-2 rounded-lg overflow-hidden bg-slate-700">
                    <img src={`/uploads/${item.image}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="font-medium text-sm leading-tight">
                  {item.name}
                  {/* Badges */}
                  {!!item.is_popular && <span className="ml-1 text-[10px]" title="Popular">&#11088;</span>}
                  {!!item.is_alcohol && <span className="ml-1 text-[10px]" title="Alcohol">&#127863;</span>}
                </div>
                {displayPrice > 0 && (
                  <div className={`text-xs mt-1.5 font-medium ${is86d ? 'text-slate-600' : totalQty > 0 ? 'text-blue-200' : 'text-emerald-400'}`}>
                    {hasVariants && <span className="text-slate-400">from </span>}
                    {item.is_special && item.special_price != null && !hasVariants && (
                      <span className="line-through text-slate-500 mr-1">{currency}{item.price.toFixed(2)}</span>
                    )}
                    {currency}{displayPrice.toFixed(2)}
                  </div>
                )}
                {!!item.prep_time_minutes && (
                  <div className="text-[10px] text-slate-500 mt-0.5">~{item.prep_time_minutes}min</div>
                )}
                {is86d && (
                  <div className="absolute top-2 right-2 bg-red-900/80 text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded">86'd</div>
                )}
                {!is86d && totalQty > 0 && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {!isBuilderTab && !hasVariants && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const cartItem = cart.find(c => c.menu_item_id === item.id && !c.notes && c.customer_number === currentCustomer)
                            || cart.find(c => c.menu_item_id === item.id && !c.notes);
                          if (cartItem) onRemove(cartItem.id);
                        }}
                        className="w-6 h-6 rounded-full bg-black/30 hover:bg-red-600 text-xs font-bold flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                    )}
                    <span className="w-6 text-center font-bold text-sm">{totalQty}</span>
                  </div>
                )}
              </ItemButton>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 mt-8 text-sm">No items in this category</p>
        )}
      </div>

      {/* Ingredient popup */}
      {ingredientTarget && (
        <IngredientPopup
          itemName={ingredientTarget.name}
          ingredients={(ingredientTarget.ingredients || '').split(',').map(s => s.trim()).filter(Boolean)}
          onConfirm={(mods) => {
            onAddSimple(
              ingredientTarget.id,
              ingredientTarget.name,
              !!ingredientTarget.category_show_in_kitchen,
              ingredientTarget.price
            );
            if (mods) {
              // Find the item we just added and update its notes
              setTimeout(() => {
                const items = useOrderStore.getState().cart;
                const lastItem = [...items].reverse().find(c => c.menu_item_id === ingredientTarget.id);
                if (lastItem) {
                  useOrderStore.getState().updateItemNote(lastItem.id, mods);
                }
              }, 0);
            }
            setIngredientTarget(null);
          }}
          onClose={() => setIngredientTarget(null)}
        />
      )}

      {/* Bottom bar */}
      <div className="shrink-0 bg-slate-800 border-t border-slate-700/50 px-3 py-2.5 flex items-center gap-2">
        {/* Back button */}
        <button
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            stepIndex === 0
              ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          ← {t('Back')}
        </button>

        {/* Cart summary - center */}
        <div className="flex-1 text-center text-sm text-slate-400">
          {totalItems > 0 ? (
            <>
              <span className="font-bold text-white">{totalItems}</span>
              <span className="ml-1">item{totalItems !== 1 ? 's' : ''}</span>
              {totalPrice > 0 && <span className="text-emerald-400 font-semibold ml-2">{currency}{totalPrice.toFixed(2)}</span>}
            </>
          ) : (
            <span className="text-slate-600">{t('No items')}</span>
          )}
        </div>

        {/* Review button - always visible when cart has items */}
        {totalItems > 0 && (
          <button
            onClick={onReview}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-500 active:bg-green-700 shadow-lg shadow-green-600/20 transition-all"
          >
            {t('Review')}
          </button>
        )}

        {/* Next button */}
        <button
          onClick={() => setStepIndex(Math.min(sortedCategories.length - 1, stepIndex + 1))}
          disabled={isLastStep}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            isLastStep
              ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-600/20'
          }`}
        >
          {t('Next')} →
        </button>
      </div>
    </div>
  );
}

// Long-press aware button wrapper
function ItemButton({ onTap, onLongPress, hasIngredients, disabled, className, children }: {
  onTap: () => void;
  onLongPress: () => void;
  hasIngredients: boolean;
  disabled: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const start = () => {
    if (disabled) return;
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, 500);
  };

  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const end = (e: React.TouchEvent | React.MouseEvent) => {
    cancel();
    if (disabled) return;
    if (!didLongPress.current) {
      onTap();
    }
    // Prevent ghost click after touch
    if ('touches' in e) e.preventDefault();
  };

  return (
    <div
      onTouchStart={start}
      onTouchEnd={end}
      onTouchMove={cancel}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={cancel}
      className={className}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {children}
      {/* Small dot indicator that ingredients info is available */}
      {hasIngredients && (
        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full bg-amber-500/70" title="Hold for ingredients" />
      )}
    </div>
  );
}
