import { useState, useEffect, useCallback } from 'react';

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  item_name: string;
  quantity: number;
  is_done: number;
  show_in_kitchen: number;
  notes: string;
  customer_number: number;
  item_price: number;
  // v2
  variant_name: string;
  combo_id: number | null;
  combo_slot_label: string;
}

export interface Order {
  id: number;
  order_number: string;
  table_number: string;
  status: string;
  source: string;
  created_at: string;
  finished_at: string | null;
  items: OrderItem[];
  // v2
  order_type: string;
  customer_name: string;
  customer_status: string;
  tip_amount: number;
  packaging?: string[];
  notes?: string;
}

export function useOrders() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<Order[]>([]);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/active');
      setActiveOrders(await res.json());
    } catch {
      setActiveOrders([]);
    }
  }, []);

  const fetchFinished = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/finished');
      setFinishedOrders(await res.json());
    } catch {
      setFinishedOrders([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchActive(), fetchFinished()]);
  }, [fetchActive, fetchFinished]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { activeOrders, setActiveOrders, finishedOrders, setFinishedOrders, fetchAll, fetchActive, fetchFinished };
}
