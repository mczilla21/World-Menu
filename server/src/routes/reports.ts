import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

export function registerReportRoutes(app: FastifyInstance) {
  // Today's live stats
  app.get('/api/reports/today', () => {
    const db = getDb();

    const orders = db.prepare(
      "SELECT * FROM orders WHERE date(created_at) = date('now', 'localtime') AND is_archived = 0 AND status != 'voided'"
    ).all() as any[];

    const orderIds = orders.map(o => o.id);
    let items: any[] = [];
    let totalRevenue = 0;
    let totalItems = 0;

    if (orderIds.length > 0) {
      const ph = orderIds.map(() => '?').join(',');
      items = db.prepare(
        `SELECT item_name, SUM(quantity) as total_qty, SUM(item_price * quantity) as total_price
         FROM order_items WHERE order_id IN (${ph})
         GROUP BY item_name ORDER BY total_qty DESC`
      ).all(...orderIds) as any[];

      totalRevenue = items.reduce((s, i) => s + (i.total_price || 0), 0);
      totalItems = items.reduce((s, i) => s + (i.total_qty || 0), 0);
    }

    // Orders by hour
    const hourly: Record<number, { orders: number; revenue: number }> = {};
    for (const o of orders) {
      const hour = new Date(o.created_at).getHours();
      if (!hourly[hour]) hourly[hour] = { orders: 0, revenue: 0 };
      hourly[hour].orders++;
    }
    // Add revenue per hour
    if (orderIds.length > 0) {
      const ph = orderIds.map(() => '?').join(',');
      const hourItems = db.prepare(
        `SELECT o.created_at, oi.item_price, oi.quantity
         FROM order_items oi JOIN orders o ON oi.order_id = o.id
         WHERE o.id IN (${ph})`
      ).all(...orderIds) as any[];
      for (const hi of hourItems) {
        const hour = new Date(hi.created_at).getHours();
        if (!hourly[hour]) hourly[hour] = { orders: 0, revenue: 0 };
        hourly[hour].revenue += (hi.item_price * hi.quantity);
      }
    }

    return {
      date: today,
      order_count: orders.length,
      item_count: totalItems,
      total_revenue: totalRevenue,
      top_items: items.slice(0, 15),
      hourly,
      active_count: orders.filter(o => o.status === 'active').length,
      finished_count: orders.filter(o => o.status === 'finished').length,
    };
  });

  // Historical daily data (for charts)
  app.get('/api/reports/history', () => {
    const db = getDb();
    return db.prepare('SELECT * FROM daily_logs ORDER BY date DESC LIMIT 30').all();
  });

  // Print receipt data for a table
  app.get<{ Params: { tableNumber: string } }>('/api/reports/receipt/:tableNumber', (req) => {
    const db = getDb();
    const orders = db.prepare(
      "SELECT * FROM orders WHERE table_number = ? AND closed = 0 AND is_archived = 0 ORDER BY created_at ASC"
    ).all(req.params.tableNumber) as any[];

    const allItems: any[] = [];
    let subtotal = 0;

    for (const o of orders) {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) as any[];
      for (const item of items) {
        allItems.push(item);
        subtotal += item.item_price * item.quantity;
      }
    }

    const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    return {
      restaurant_name: settingsMap.restaurant_name || 'Restaurant',
      table_number: req.params.tableNumber,
      items: allItems,
      subtotal,
      order_count: orders.length,
      date: new Date().toLocaleString(),
    };
  });
}
