import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSettings, LANGUAGE_OPTIONS } from '../../hooks/useSettings';
import { useCustomerStore } from '../../stores/customerStore';
import type { MenuItem, Category } from '../../hooks/useMenu';
import MenuItemCard from './MenuItemCard';
import ItemDetail from './ItemDetail';
import CustomerCart from './CustomerCart';
import OrderConfirmation from './OrderConfirmation';
import AllergenFilter from './AllergenFilter';
import IngredientPopup from '../../components/IngredientPopup';
import PinGate from '../../components/PinGate';
import IdleScreen from './IdleScreen';
import { useWebSocket } from '../../hooks/useWebSocket';

interface TranslationMap {
  [key: string]: string;
}

export default function CustomerMenu() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { setTableNumber, cart, customerLang, setCustomerLang, setOrderType, clearCart } = useCustomerStore();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [selectedCat, setSelectedCat] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [excludedAllergens, setExcludedAllergens] = useState<Set<string>>(new Set());
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [ingredientTarget, setIngredientTarget] = useState<MenuItem | null>(null);
  const [langSelected, setLangSelected] = useState(false);
  const [hasOrdered, setHasOrdered] = useState(false);
  const [checkRequested, setCheckRequested] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [customTipInput, setCustomTipInput] = useState<string | null>(null);

  // Stable callback for idle screen dismiss — resets all state for next customer
  const handleIdleDismiss = useCallback(() => {
    setLangSelected(false);
    setHasOrdered(false);
    setOrderSent(false);
    setCheckRequested(false);
    setSearchQuery('');
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (tableNumber) {
      setTableNumber(tableNumber);
      setOrderType('dine_in');
    } else {
      // No table = takeout mode
      setOrderType('takeout');
    }
  }, [tableNumber, setTableNumber, setOrderType]);

  // Listen for table close/reset via WebSocket
  const handleWs = useCallback((msg: any) => {
    if (msg.type === 'TABLE_CLOSED' && String(msg.tableNumber) === tableNumber) {
      // Table settled — reset for next customer
      setLangSelected(false);
      setHasOrdered(false);
      setOrderSent(false);
      setCheckRequested(false);
      setSearchQuery('');
      setCustomerLang(settings.native_language);
      clearCart();
    }
    if (msg.type === 'ORDER_APPROVED') {
      setOrderStatus('preparing');
      setTimeout(() => setOrderStatus(''), 5000);
    }
    if (msg.type === 'ORDER_READY') {
      setOrderStatus('ready');
    }
    if (msg.type === 'ORDER_REJECTED') {
      alert(msg.reason || 'Your order was declined. Please ask your server.');
    }
  }, [tableNumber, settings.native_language, setCustomerLang, clearCart]);

  useWebSocket(tableNumber ? `table-${tableNumber}` : '', handleWs);

  // If only one language, auto-select and skip the picker
  const supportedLangs = settings.supported_languages.split(',').filter(Boolean);
  const allLangs = [settings.native_language, ...supportedLangs.filter(l => l !== settings.native_language)];
  useEffect(() => {
    if (allLangs.length <= 1) {
      setCustomerLang(settings.native_language);
      setLangSelected(true);
    }
  }, [settings.native_language, allLangs.length, setCustomerLang]);

  const fetchMenu = useCallback(async () => {
    try {
      const [menuRes, catRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/categories'),
      ]);
      const menuData = await menuRes.json();
      const catData = await catRes.json();
      setItems(menuData.filter((i: MenuItem) => i.is_active));
      setCategories(catData);
      if (catData.length > 0) setSelectedCat(catData[0].id);
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTranslations = useCallback(async () => {
    if (customerLang === settings.native_language) {
      setTranslations({});
      return;
    }
    try {
      const [catT, itemT, modT, modGT] = await Promise.all([
        fetch(`/api/translations/category?lang=${customerLang}`).then(r => r.json()),
        fetch(`/api/translations/menu_item?lang=${customerLang}`).then(r => r.json()),
        fetch(`/api/translations/modifier?lang=${customerLang}`).then(r => r.json()),
        fetch(`/api/translations/modifier_group?lang=${customerLang}`).then(r => r.json()),
      ]);
      const map: TranslationMap = {};
      for (const t of [...catT, ...itemT, ...modT, ...modGT]) {
        map[`${t.entity_type}:${t.entity_id}:${t.field}`] = t.value;
      }
      setTranslations(map);
    } catch {}
  }, [customerLang, settings.native_language]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);
  useEffect(() => { fetchTranslations(); }, [fetchTranslations]);

  const t = (entityType: string, entityId: number, field: string, fallback: string): string => {
    if (customerLang === settings.native_language) return fallback;
    return translations[`${entityType}:${entityId}:${field}`] || fallback;
  };

  // Filter out items with excluded allergens
  const filterByAllergens = (itemList: MenuItem[]) => {
    if (excludedAllergens.size === 0) return itemList;
    return itemList.filter(item => {
      if (!item.allergens || item.allergens.length === 0) return true;
      return !item.allergens.some(a => excludedAllergens.has(a));
    });
  };

  const searchResults = searchQuery.trim()
    ? filterByAllergens(items.filter(i => {
        const q = searchQuery.toLowerCase();
        const translatedName = t('menu_item', i.id, 'name', i.name).toLowerCase();
        return i.name.toLowerCase().includes(q) || translatedName.includes(q) || (i.description || '').toLowerCase().includes(q);
      }))
    : null;
  const filteredItems = searchResults || filterByAllergens(items.filter(i => i.category_id === selectedCat));
  const specialItems = filterByAllergens(items.filter(i => i.is_special));
  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);
  const currency = settings.currency_symbol || '$';
  const callWaiterEnabled = settings.call_waiter_enabled !== '0' && !!tableNumber;

  const toggleAllergen = (code: string) => {
    const next = new Set(excludedAllergens);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExcludedAllergens(next);
  };

  const [showBill, setShowBill] = useState(false);
  const [billItems, setBillItems] = useState<any[]>([]);
  const [billTotal, setBillTotal] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [splitMode, setSplitMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [paidItems, setPaidItems] = useState<Set<number>>(new Set());

  const handleShowBill = async () => {
    if (!tableNumber) return;
    try {
      const res = await fetch(`/api/orders/table/${encodeURIComponent(tableNumber)}/bill`);
      const data = await res.json();
      const items: any[] = [];
      let total = 0;
      for (const order of data.orders || []) {
        for (const item of order.items || []) {
          items.push(item);
          total += item.item_price * item.quantity;
        }
      }
      setBillItems(items);
      setBillTotal(total);
      setTipAmount(0);
      setShowBill(true);
    } catch {}
  };

  const handleConfirmCheck = async () => {
    if (!tableNumber || checkRequested) return;
    setShowBill(false);
    setCheckRequested(true);
    try {
      await fetch('/api/service/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: tableNumber, type: 'check_requested' }),
      });
    } catch {}
  };

  const handleCallWaiter = async () => {
    if (!tableNumber || callingWaiter) return;
    setCallingWaiter(true);
    try {
      await fetch('/api/service/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: tableNumber }),
      });
      setTimeout(() => setCallingWaiter(false), 5000);
    } catch {
      setCallingWaiter(false);
    }
  };

  if (checkRequested) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M7 15h4" />
            <path d="M7 11h10" />
            <path d="M7 8h10" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Requested!</h2>
        <p className="text-gray-500 text-center">Your server has been notified.<br/>Thank you for dining at {settings.restaurant_name}!</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="animate-pulse space-y-4 max-w-lg mx-auto pt-8">
          <div className="h-8 bg-gray-200 rounded-xl w-48 mx-auto" />
          <div className="h-4 bg-gray-100 rounded w-32 mx-auto" />
          <div className="flex gap-2 overflow-hidden py-2">
            {[1,2,3,4].map(i => <div key={i} className="h-9 w-24 bg-gray-200 rounded-full shrink-0" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="h-32 bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-5 bg-gray-200 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (orderSent) {
    return (
      <OrderConfirmation
        tableNumber={tableNumber || ''}
        onAddMore={() => setOrderSent(false)}
        restaurantName={settings.restaurant_name}
        orderType={tableNumber ? 'dine_in' : 'takeout'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Order status banner */}
      {orderStatus === 'preparing' && (
        <div style={{ background: '#3b82f6', color: '#fff', padding: '14px 16px', textAlign: 'center', fontWeight: 700, fontSize: 15 }}
          onClick={() => setOrderStatus('')}>
          👨‍🍳 Your order has been approved and is being prepared!
        </div>
      )}
      {orderStatus === 'ready' && (
        <div style={{ background: '#22c55e', color: '#fff', padding: '16px', textAlign: 'center', fontWeight: 700, fontSize: 18 }}
          className="animate-pulse" onClick={() => setOrderStatus('')}>
          🎉 Your order is READY!
        </div>
      )}
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logo && (
              <img src={`/uploads/${settings.logo}`} alt="" className="w-10 h-10 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="font-bold text-lg text-gray-900">{settings.restaurant_name}</h1>
              <p className="text-xs text-gray-500">{tableNumber ? `Table ${tableNumber}` : 'Takeout'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Allergen filter button */}
            <button
              onClick={() => setShowAllergenFilter(true)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                excludedAllergens.size > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {excludedAllergens.size > 0 ? `Allergens (${excludedAllergens.size})` : 'Allergens'}
            </button>
            {allLangs.length > 1 && (
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5"
              >
                <span>🌐</span>
                <span>{LANGUAGE_OPTIONS.find(l => l.code === customerLang)?.name || 'Language'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Language picker popup */}
        {showLangPicker && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowLangPicker(false)} />
            <div className="fixed inset-x-4 top-24 z-50 max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 text-center">🌐 Choose Language</h3>
              </div>
              <div className="max-h-80 overflow-auto p-2">
                {allLangs.map(code => {
                  const langInfo = LANGUAGE_OPTIONS.find(l => l.code === code);
                  const isActive = customerLang === code;
                  return (
                    <button
                      key={code}
                      onClick={() => { setCustomerLang(code); setShowLangPicker(false); }}
                      className={`w-full text-left px-4 py-3.5 rounded-xl mb-1 flex items-center gap-3 transition-all active:scale-[0.97] ${
                        isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      <span className={`text-lg font-bold w-10 text-center ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                        {langInfo?.flag || code.toUpperCase()}
                      </span>
                      <span className="text-base font-semibold">{langInfo?.name || code}</span>
                      {isActive && <span className="ml-auto">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Search */}
        <div className="px-4 pb-2">
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search menu..."
            className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 placeholder-gray-400"
          />
        </div>

        {/* Category scroll */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCat === cat.id
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={selectedCat === cat.id ? { backgroundColor: settings.theme_color } : undefined}
            >
              {t('category', cat.id, 'name', cat.name)}
            </button>
          ))}
        </div>
      </header>

      {/* Specials section */}
      {specialItems.length > 0 && selectedCat === categories[0]?.id && (
        <div className="px-4 pt-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Today's Specials</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {specialItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="flex-shrink-0 w-40 bg-white rounded-xl shadow-sm overflow-hidden text-left"
              >
                {item.image && (
                  <img src={`/uploads/${item.image}`} alt="" className="w-full h-24 object-cover" />
                )}
                <div className="p-2.5">
                  <div className="text-xs font-semibold text-gray-900 line-clamp-1">{t('menu_item', item.id, 'name', item.name)}</div>
                  <div className="text-xs mt-1">
                    <span className="line-through text-gray-400 mr-1">{currency}{item.price.toFixed(2)}</span>
                    <span className="font-bold" style={{ color: settings.theme_color }}>{currency}{(item.special_price ?? item.price).toFixed(2)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu grid */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              translatedName={t('menu_item', item.id, 'name', item.name)}
              translatedDesc={t('menu_item', item.id, 'description', item.description)}
              currency={currency}
              themeColor={settings.theme_color}
              onClick={() => setSelectedItem(item)}
              onLongPress={() => {
                const ingredients = (item.ingredients || '').split(',').map(s => s.trim()).filter(Boolean);
                if (ingredients.length > 0) setIngredientTarget(item);
                else setSelectedItem(item);
              }}
            />
          ))}
        </div>
        {filteredItems.length === 0 && (
          <p className="text-center text-gray-400 mt-8">No items in this category</p>
        )}
      </div>

      {/* Floating action buttons */}
      {callWaiterEnabled && totalCartItems === 0 && !showCart && (
        <div className="fixed bottom-6 right-4 z-20 flex flex-col gap-3 items-end">
          {/* Request Check - only after ordering */}
          {hasOrdered && (
            <button
              onClick={handleShowBill}
              className="h-14 px-5 rounded-full shadow-lg flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 15h4" />
                <path d="M7 11h10" />
              </svg>
              Request Check
            </button>
          )}
          {/* Call Waiter */}
          <button
            onClick={handleCallWaiter}
            disabled={callingWaiter}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
              callingWaiter ? 'bg-green-500' : 'bg-amber-500 hover:bg-amber-400 active:scale-95'
            }`}
          >
            {callingWaiter ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Floating cart button */}
      {totalCartItems > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 z-20">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            style={{ backgroundColor: settings.theme_color }}
          >
            <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-base font-black">{totalCartItems}</span>
            View Cart
            <span className="ml-auto mr-1 font-bold">
              {currency}{cart.reduce((s, i) => s + i.item_price * i.quantity, 0).toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          translatedName={t('menu_item', selectedItem.id, 'name', selectedItem.name)}
          translatedDesc={t('menu_item', selectedItem.id, 'description', selectedItem.description)}
          currency={currency}
          nativeName={selectedItem.name}
          themeColor={settings.theme_color}
          onClose={() => setSelectedItem(null)}
          translateModGroup={(groupId: number, fallback: string) => t('modifier_group', groupId, 'name', fallback)}
          translateModifier={(modId: number, fallback: string) => t('modifier', modId, 'name', fallback)}
        />
      )}

      {/* Cart slide-up */}
      {showCart && (
        <CustomerCart
          currency={currency}
          themeColor={settings.theme_color}
          onClose={() => setShowCart(false)}
          onOrderSent={() => { setShowCart(false); setOrderSent(true); setHasOrdered(true); }}
        />
      )}

      {/* Allergen filter modal */}
      {showAllergenFilter && (
        <AllergenFilter
          excluded={excludedAllergens}
          onToggle={toggleAllergen}
          onClose={() => setShowAllergenFilter(false)}
          themeColor={settings.theme_color}
        />
      )}

      {/* Switch Role - at very bottom of menu, locked behind PIN */}
      <div className="py-6 flex justify-center">
        <button
          onClick={() => {
            if (settings.admin_pin) {
              setShowPin(true);
            } else {
              localStorage.removeItem('role');
              navigate('/');
            }
          }}
          className="text-[10px] text-gray-300 hover:text-gray-400"
        >
          Switch Role
        </button>
      </div>

      {/* Ingredient popup on long press */}
      {ingredientTarget && (
        <IngredientPopup
          itemName={t('menu_item', ingredientTarget.id, 'name', ingredientTarget.name)}
          ingredients={(ingredientTarget.ingredients || '').split(',').map(s => s.trim()).filter(Boolean)}
          viewOnly
          onConfirm={() => setIngredientTarget(null)}
          onClose={() => setIngredientTarget(null)}
        />
      )}

      {/* Language selection overlay — shows on top of the menu */}
      {!langSelected && allLangs.length > 1 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center mb-6">
              {settings.logo && (
                <img src={`/uploads/${settings.logo}`} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
              )}
              <h2 className="text-xl font-bold text-gray-900">{settings.restaurant_name}</h2>
              <p className="text-gray-500 text-sm mt-1">Choose your language</p>
            </div>
            <div className="grid gap-2">
              {allLangs.map(code => {
                const langInfo = LANGUAGE_OPTIONS.find(l => l.code === code);
                return (
                  <button
                    key={code}
                    onClick={() => {
                      setCustomerLang(code);
                      setLangSelected(true);
                    }}
                    className="rounded-2xl px-5 py-4 text-left flex items-center gap-4 transition-all active:scale-[0.97] hover:bg-gray-50 border-2 border-gray-100 hover:border-gray-300"
                  >
                    <span className="text-2xl font-bold text-gray-400 w-10 text-center">{langInfo?.flag || code.toUpperCase()}</span>
                    <span className="text-lg font-semibold text-gray-900">{langInfo?.name || code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bill / Split / Tip / Receipt screen */}
      {showBill && (() => {
        const unpaidItems = billItems.filter((_: any, i: number) => !paidItems.has(i));
        const myItems = splitMode ? billItems.filter((_: any, i: number) => selectedItems.has(i)) : unpaidItems;
        const myTotal = myItems.reduce((s: number, i: any) => s + i.item_price * i.quantity, 0);
        const tipPcts = (settings.tip_percentages || '15,18,20').split(',').map(Number).filter(n => !isNaN(n));
        const allPaid = splitMode && paidItems.size + selectedItems.size >= billItems.length;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto', padding: 24 }}
              className="sm:rounded-3xl">

              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 4 }}>
                {splitMode ? 'Select Your Items' : 'Your Bill'}
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
                Table {tableNumber}{splitMode ? ' — Tap the items you\'re paying for' : ''}
              </p>

              {/* Split / Full toggle */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                <button onClick={() => { setSplitMode(false); setSelectedItems(new Set()); }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: !splitMode ? '#fff' : 'transparent', color: !splitMode ? '#0f172a' : '#94a3b8', boxShadow: !splitMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  Full Bill
                </button>
                <button onClick={() => setSplitMode(true)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: splitMode ? '#fff' : 'transparent', color: splitMode ? '#0f172a' : '#94a3b8', boxShadow: splitMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  Split Check ✂️
                </button>
              </div>

              {/* Items */}
              <div style={{ marginBottom: 16 }}>
                {billItems.map((item: any, idx: number) => {
                  const isPaid = paidItems.has(idx);
                  const isSelected = selectedItems.has(idx);
                  const isSelectable = splitMode && !isPaid;

                  return (
                    <button key={idx}
                      onClick={() => {
                        if (!isSelectable) return;
                        const next = new Set(selectedItems);
                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                        setSelectedItems(next);
                      }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 12px', marginBottom: 4,
                        borderRadius: 12, border: 'none', cursor: isSelectable ? 'pointer' : 'default', textAlign: 'left',
                        background: isPaid ? '#f1f5f9' : isSelected ? '#dcfce7' : '#fff',
                        opacity: isPaid ? 0.4 : 1,
                        outline: isSelected ? '2px solid #22c55e' : 'none',
                        fontSize: 14,
                      }}>
                      <span style={{ color: isPaid ? '#94a3b8' : '#1e293b', textDecoration: isPaid ? 'line-through' : 'none' }}>
                        {splitMode && !isPaid && <span style={{ marginRight: 8 }}>{isSelected ? '✅' : '⬜'}</span>}
                        {item.quantity > 1 && <b style={{ color: '#d97706' }}>{item.quantity}× </b>}
                        {item.item_name}
                      </span>
                      <span style={{ color: '#64748b' }}>{currency}{(item.item_price * item.quantity).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>

              {/* My subtotal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                <span>{splitMode ? 'Your share' : 'Subtotal'}</span>
                <span>{currency}{myTotal.toFixed(2)}</span>
              </div>

              {/* Tip */}
              {settings.tipping_enabled === '1' && myTotal > 0 && (
                <div style={{ margin: '12px 0', padding: 12, background: '#f8fafc', borderRadius: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Add a tip?</p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setTipAmount(0)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tipAmount === 0 ? '#0f172a' : '#e2e8f0', color: tipAmount === 0 ? '#fff' : '#475569' }}>
                      None
                    </button>
                    {tipPcts.map(pct => {
                      const amt = Math.round(myTotal * pct) / 100;
                      const isActive = Math.abs(tipAmount - amt) < 0.01;
                      return (
                        <button key={pct} onClick={() => setTipAmount(amt)}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: isActive ? (settings.theme_color || '#3b82f6') : '#e2e8f0', color: isActive ? '#fff' : '#475569' }}>
                          <div>{pct}%</div>
                          <div style={{ fontSize: 9, opacity: 0.7 }}>{currency}{amt.toFixed(2)}</div>
                        </button>
                      );
                    })}
                    {customTipInput !== null ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        autoFocus
                        value={customTipInput}
                        onChange={e => setCustomTipInput(e.target.value)}
                        onBlur={() => { setTipAmount(parseFloat(customTipInput) || 0); setCustomTipInput(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') { setTipAmount(parseFloat(customTipInput) || 0); setCustomTipInput(null); } }}
                        style={{ flex: 1, width: 0, minWidth: 0, padding: '6px 4px', borderRadius: 10, border: '2px solid #3b82f6', fontSize: 13, fontWeight: 600, textAlign: 'center', outline: 'none', background: '#fff', color: '#0f172a' }}
                        placeholder="$"
                      />
                    ) : (
                      <button onClick={() => setCustomTipInput('')}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#e2e8f0', color: '#475569' }}>
                        Custom
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 20, fontWeight: 800, color: '#0f172a', borderTop: '2px solid #e2e8f0' }}>
                <span>Total</span>
                <span style={{ color: '#059669' }}>{currency}{(myTotal + tipAmount).toFixed(2)}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {splitMode && selectedItems.size > 0 && (
                  <button onClick={() => {
                    // Mark selected items as paid
                    setPaidItems(prev => {
                      const next = new Set(prev);
                      selectedItems.forEach(i => next.add(i));
                      return next;
                    });
                    setSelectedItems(new Set());
                    setTipAmount(0);

                    // If all items now paid, request check
                    if (paidItems.size + selectedItems.size >= billItems.length) {
                      handleConfirmCheck();
                    }
                  }} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, background: '#8b5cf6', color: '#fff' }}>
                    Pay My Share ({currency}{(myTotal + tipAmount).toFixed(2)})
                  </button>
                )}

                {!splitMode && (
                  <>
                    <button onClick={async () => {
                      try { await fetch('/api/printer/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_number: tableNumber }) }); } catch {}
                      handleConfirmCheck();
                    }} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, background: '#22c55e', color: '#fff' }}>
                      🖨️ Print Receipt & Request Check
                    </button>
                    <button onClick={handleConfirmCheck}
                      style={{ width: '100%', padding: 12, borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: '#3b82f6', color: '#fff' }}>
                      No Receipt — Just the Check
                    </button>
                  </>
                )}

                <button onClick={() => { setShowBill(false); setSplitMode(false); setSelectedItems(new Set()); setPaidItems(new Set()); setTipAmount(0); }}
                  style={{ width: '100%', padding: 8, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8', background: 'transparent' }}>
                  ← Keep Ordering
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PIN gate */}
      {showPin && (
        <PinGate
          pin={settings.admin_pin}
          onSuccess={() => {
            localStorage.removeItem('role');
            navigate('/');
          }}
          onCancel={() => setShowPin(false)}
        />
      )}

      {/* Idle / Welcome Screen */}
      {settings.idle_screen_enabled === '1' && (
        <IdleScreen
          restaurantName={settings.restaurant_name}
          logo={settings.logo}
          message={settings.idle_screen_message || 'Welcome! Tap to start ordering'}
          bgImage={settings.idle_screen_bg_image || ''}
          themeColor={settings.theme_color}
          timeoutMinutes={parseInt(settings.idle_screen_timeout || '3') || 3}
          onDismiss={handleIdleDismiss}
        />
      )}
    </div>
  );
}
