import { useState, useEffect, useCallback } from 'react';

export interface ItemVariant {
  id: number;
  menu_item_id: number;
  name: string;
  price: number;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  tags: string;
  is_active: number;
  sort_order: number;
  category_name: string;
  category_show_in_kitchen: number;
  // v2 fields
  is_popular: number;
  prep_time_minutes: number;
  is_special: number;
  special_price: number | null;
  serves: string;
  is_alcohol: number;
  ingredients: string;
  variants: ItemVariant[];
  allergens: string[];
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  show_in_kitchen: number;
}

export interface Combo {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  is_active: number;
  sort_order: number;
  slots: ComboSlot[];
}

export interface ComboSlot {
  id: number;
  combo_id: number;
  category_id: number;
  category_name: string;
  label: string;
  sort_order: number;
}

export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = useCallback(async () => {
    try {
      const [menuRes, catRes, comboRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/categories'),
        fetch('/api/combos'),
      ]);
      setItems(await menuRes.json());
      setCategories(await catRes.json());
      setCombos(await comboRes.json());
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  return { items, categories, combos, loading, refresh: fetchMenu };
}
