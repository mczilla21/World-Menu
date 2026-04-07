import { create } from 'zustand';
import { resilientFetch } from '../lib/offlineQueue';

export interface CustomerCartItem {
  id: string;
  menu_item_id: number;
  item_name: string;
  item_name_translated: string;
  quantity: number;
  notes: string;
  item_price: number;
  variant_name: string;
  combo_id: number | null;
  combo_slot_label: string;
}

interface CustomerStore {
  tableNumber: string;
  cart: CustomerCartItem[];
  customerLang: string;
  orderType: 'dine_in' | 'takeout';
  tipAmount: number;
  ageVerified: boolean;
  setTableNumber: (t: string) => void;
  setCustomerLang: (lang: string) => void;
  setOrderType: (t: 'dine_in' | 'takeout') => void;
  setTipAmount: (n: number) => void;
  setAgeVerified: () => void;
  addItem: (item: Omit<CustomerCartItem, 'id'>) => void;
  removeItem: (cartId: string) => void;
  incrementItem: (cartId: string) => void;
  clearCart: () => void;
  submitOrder: () => Promise<boolean>;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  tableNumber: '',
  cart: [],
  customerLang: 'en',
  orderType: 'dine_in',
  tipAmount: 0,
  ageVerified: false,

  setTableNumber: (t) => set({ tableNumber: t }),
  setCustomerLang: (lang) => set({ customerLang: lang }),
  setOrderType: (t) => set({ orderType: t }),
  setTipAmount: (n) => set({ tipAmount: n }),
  setAgeVerified: () => set({ ageVerified: true }),

  addItem: (item) => {
    const { cart } = get();
    const newCart = [...cart];
    const existing = newCart.find(i => i.menu_item_id === item.menu_item_id && !i.notes && !item.notes && i.variant_name === item.variant_name && !i.combo_id);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      newCart.push({ ...item, id: `cust-${item.menu_item_id}-${Date.now()}` });
    }
    set({ cart: newCart });
  },

  removeItem: (cartId) => {
    const cart = [...get().cart];
    const idx = cart.findIndex(i => i.id === cartId);
    if (idx === -1) return;
    if (cart[idx].quantity > 1) {
      cart[idx] = { ...cart[idx], quantity: cart[idx].quantity - 1 };
    } else {
      cart.splice(idx, 1);
    }
    set({ cart });
  },

  incrementItem: (cartId) => {
    const cart = [...get().cart];
    const idx = cart.findIndex(i => i.id === cartId);
    if (idx === -1) return;
    cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + 1 };
    set({ cart });
  },

  clearCart: () => set({ cart: [], tipAmount: 0 }),

  submitOrder: async () => {
    const { tableNumber, cart, orderType, tipAmount } = get();
    if (cart.length === 0) return false;

    const itemsPayload = cart.map(i => ({
      menu_item_id: i.menu_item_id,
      item_name: i.item_name,
      quantity: i.quantity,
      show_in_kitchen: true,
      notes: i.notes,
      customer_number: 0,
      item_price: i.item_price,
      variant_name: i.variant_name,
      combo_id: i.combo_id,
      combo_slot_label: i.combo_slot_label,
    }));

    try {
      const res = await resilientFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: tableNumber || `TO-${Date.now()}`,
          source: 'customer',
          order_type: orderType,
          tip_amount: tipAmount,
          items: itemsPayload,
        }),
      });
      if (!res.ok) return false;
      // Save last order for "Order Again"
      try {
        localStorage.setItem('last_order', JSON.stringify(cart));
      } catch {}
      set({ cart: [], tipAmount: 0 });
      return true;
    } catch {
      return false;
    }
  },
}));
