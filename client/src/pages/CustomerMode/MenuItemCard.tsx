import { useRef } from 'react';
import type { MenuItem } from '../../hooks/useMenu';
import { ALLERGEN_MAP } from '../../constants/allergens';

const TAG_ICONS: Record<string, { icon: string; bg: string; fg: string }> = {
  'Vegetarian': { icon: '🌿', bg: 'bg-green-100', fg: 'text-green-700' },
  'Vegan': { icon: '🌱', bg: 'bg-green-100', fg: 'text-green-700' },
  'Gluten-Free': { icon: 'GF', bg: 'bg-amber-100', fg: 'text-amber-700' },
  'Spicy': { icon: '🌶', bg: 'bg-red-100', fg: 'text-red-700' },
  'Nuts': { icon: '🥜', bg: 'bg-orange-100', fg: 'text-orange-700' },
  'Dairy': { icon: '🥛', bg: 'bg-blue-100', fg: 'text-blue-700' },
  'Seafood': { icon: '🐟', bg: 'bg-cyan-100', fg: 'text-cyan-700' },
  'Halal': { icon: '☪', bg: 'bg-emerald-100', fg: 'text-emerald-700' },
};

interface Props {
  item: MenuItem;
  translatedName: string;
  translatedDesc: string;
  currency: string;
  themeColor: string;
  onClick: () => void;
  onLongPress: () => void;
}

export default function MenuItemCard({ item, translatedName, translatedDesc, currency, themeColor, onClick, onLongPress }: Props) {
  const hasVariants = item.variants && item.variants.length > 0;
  const minVariantPrice = hasVariants ? Math.min(...item.variants.map(v => v.price)) : 0;
  const displayPrice = hasVariants ? minVariantPrice : (item.is_special && item.special_price != null ? item.special_price : item.price);
  const hasIngredients = !!(item.ingredients || '').trim();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const start = () => {
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
    if (!didLongPress.current) onClick();
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
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left relative"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Popular badge */}
      {!!item.is_popular && (
        <div className="absolute top-2 left-2 z-10 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          &#11088; Popular
        </div>
      )}

      {/* Special badge */}
      {!!item.is_special && (
        <div className="absolute top-2 right-2 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          Special
        </div>
      )}

      {item.image ? (
        <div className="w-full aspect-[3/2] bg-gradient-to-br from-gray-50 to-gray-100">
          <img
            src={`/uploads/${item.image}`}
            alt={translatedName}
            className={`w-full h-full ${item.image.endsWith('.svg') ? 'object-contain p-2' : 'object-cover'}`}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-full aspect-[3/2] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
      )}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{translatedName}</h3>
        {translatedDesc && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{translatedDesc}</p>
        )}

        {/* Info row: serves + prep time */}
        {(item.serves || item.prep_time_minutes > 0) && (
          <div className="flex gap-2 mt-1.5 text-[10px] text-gray-400">
            {item.serves && <span>Serves {item.serves}</span>}
            {item.prep_time_minutes > 0 && <span>~{item.prep_time_minutes} min</span>}
          </div>
        )}

        {/* Tags */}
        {item.tags && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {item.tags.split(',').filter(Boolean).map(tag => {
              const info = TAG_ICONS[tag.trim()];
              return (
                <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${info ? `${info.bg} ${info.fg}` : 'bg-gray-100 text-gray-500'}`}>
                  {info ? `${info.icon} ${tag.trim()}` : tag.trim()}
                </span>
              );
            })}
          </div>
        )}

        {/* Allergen icons */}
        {item.allergens && item.allergens.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {item.allergens.map(code => {
              const a = ALLERGEN_MAP[code];
              return a ? (
                <span key={code} className="text-xs" title={a.name}>{a.icon}</span>
              ) : null;
            })}
          </div>
        )}

        {/* Price */}
        {displayPrice > 0 && (
          <div className="text-sm font-bold mt-2 flex items-center justify-between" style={{ color: themeColor }}>
            <span>
              {hasVariants && <span className="text-xs font-normal text-gray-400">From </span>}
              {item.is_special && item.special_price != null && !hasVariants && (
                <span className="line-through text-gray-400 font-normal mr-1">{currency}{item.price.toFixed(2)}</span>
              )}
              {currency}{displayPrice.toFixed(2)}
            </span>
            {hasIngredients && (
              <span className="text-[10px] text-gray-400 font-normal">Hold for info</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
