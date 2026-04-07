import { create } from 'zustand';
import { resilientFetch } from '../lib/offlineQueue';

export interface CartItem {
  id: string;
  menu_item_id: number;
  item_name: string;
  quantity: number;
  show_in_kitchen: boolean;
  notes: string;
  customer_number: number;
  item_price: number;
  variant_name: string;
  combo_id: number | null;
  combo_slot_label: string;
}

interface OrderStore {
  tableNumber: string;
  existingOrderId: number | null;
  currentCustomer: number;
  customerCount: number;
  cart: CartItem[];
  orderType: 'dine_in' | 'takeout' | 'pickup';
  customerName: string;
  setTable: (t: string) => void;
  setExistingOrder: (id: number | null) => void;
  setCurrentCustomer: (n: number) => void;
  setOrderType: (t: 'dine_in' | 'takeout' | 'pickup') => void;
  setCustomerName: (n: string) => void;
  addCustomer: () => void;
  addItem: (item: CartItem) => void;
  addSimpleItem: (id: number, name: string, showInKitchen: boolean, price?: number, variantName?: string) => void;
  removeItem: (cartId: string) => void;
  incrementItem: (cartId: string) => void;
  updateItemNote: (cartId: string, note: string) => void;
  clearCart: () => void;
  submitOrder: (source?: string) => Promise<boolean>;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  tableNumber: '',
  existingOrderId: null,
  currentCustomer: 1,
  customerCount: 1,
  cart: [],
  orderType: 'dine_in',
  customerName: '',

  setTable: (t) => set({ tableNumber: t }),
  setExistingOrder: (id) => set({ existingOrderId: id }),
  setCurrentCustomer: (n) => set({ currentCustomer: n }),
  setOrderType: (t) => set({ orderType: t }),
  setCustomerName: (n) => set({ customerName: n }),

  addCustomer: () => {
    const next = get().customerCount + 1;
    set({ customerCount: next, currentCustomer: next });
  },

  addItem: (item) => {
    set({ cart: [...get().cart, { ...item, customer_number: get().currentCustomer }] });
  },

  addSimpleItem: (id, name, showInKitchen, price = 0, variantName = '') => {
    const { cart, currentCustomer } = get();
    const newCart = [...cart];
    const existing = newCart.find((i) => i.menu_item_id === id && !i.notes && i.customer_number === currentCustomer && i.variant_name === variantName);
    if (existing) {
      existing.quantity++;
    } else {
      newCart.push({
        id: `simple-${id}-c${currentCustomer}-${Date.now()}`,
        menu_item_id: id,
        item_name: name,
        quantity: 1,
        show_in_kitchen: showInKitchen,
        notes: '',
        customer_number: currentCustomer,
        item_price: price,
        variant_name: variantName,
        combo_id: null,
        combo_slot_label: '',
      });
    }
    set({ cart: newCart });
  },

  removeItem: (cartId) => {
    const cart = [...get().cart];
    const idx = cart.findIndex((i) => i.id === cartId);
    if (idx === -1) return;
    if (cart[idx].quantity > 1 && !cart[idx].notes) {
      cart[idx] = { ...cart[idx], quantity: cart[idx].quantity - 1 };
    } else {
      cart.splice(idx, 1);
    }
    set({ cart });
  },

  incrementItem: (cartId) => {
    const cart = [...get().cart];
    const idx = cart.findIndex((i) => i.id === cartId);
    if (idx === -1) return;
    cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + 1 };
    set({ cart });
  },

  updateItemNote: (cartId, note) => {
    const cart = [...get().cart];
    const idx = cart.findIndex((i) => i.id === cartId);
    if (idx === -1) return;

    if (note && cart[idx].quantity > 1 && !cart[idx].notes) {
      cart[idx] = { ...cart[idx], quantity: cart[idx].quantity - 1 };
      cart.splice(idx + 1, 0, {
        ...cart[idx],
        id: `noted-${Date.now()}-${idx}`,
        quantity: 1,
        notes: note,
      });
    } else {
      cart[idx] = { ...cart[idx], notes: note };
      if (note && cart[idx].id.startsWith('simple-')) {
        cart[idx] = { ...cart[idx], id: `noted-${Date.now()}-${idx}` };
      }
    }
    set({ cart });
  },

  clearCart: () => set({ cart: [], tableNumber: '', existingOrderId: null, currentCustomer: 1, customerCount: 1, orderType: 'dine_in', customerName: '' }),

  submitOrder: async (source = 'server') => {
    const { tableNumber, cart, existingOrderId, orderType, customerName } = get();
    if (cart.length === 0) return false;
    // For takeout/pickup, table_number can be empty
    if (orderType === 'dine_in' && !tableNumber) return false;

    const itemsPayload = cart.map(i => ({
      menu_item_id: i.menu_item_id,
      item_name: i.item_name,
      quantity: i.quantity,
      show_in_kitchen: i.show_in_kitchen,
      notes: i.notes,
      customer_number: i.customer_number,
      item_price: i.item_price,
      variant_name: i.variant_name,
      combo_id: i.combo_id,
      combo_slot_label: i.combo_slot_label,
    }));

    try {
      let res: Response;
      if (existingOrderId) {
        res = await resilientFetch(`/api/orders/${existingOrderId}/add-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsPayload }),
        });
      } else {
        res = await resilientFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_number: tableNumber || `TO-${Date.now()}`,
            source, items: itemsPayload,
            order_type: orderType,
            customer_name: customerName,
          }),
        });
      }
      if (!res.ok) return false;
      set({ cart: [], tableNumber: '', existingOrderId: null, currentCustomer: 1, customerCount: 1, orderType: 'dine_in', customerName: '' });
      return true;
    } catch {
      return false;
    }
  },
}));
