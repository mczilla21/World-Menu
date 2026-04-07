import { getDb } from './db/connection.js';
import { broadcastToAll } from './ws/broadcast.js';

export function runDailyReset() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Summarize all non-archived orders
  const orders = db.prepare(
    "SELECT * FROM orders WHERE is_archived = 0"
  ).all() as any[];

  if (orders.length > 0) {
    const orderIds = orders.map((o: any) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    const items = db.prepare(
      `SELECT item_name, SUM(quantity) as total_qty, SUM(item_price * quantity) as total_price
       FROM order_items WHERE order_id IN (${placeholders})
       GROUP BY item_name ORDER BY total_qty DESC LIMIT 10`
    ).all(...orderIds) as any[];

    const totalRevenue = items.reduce((s: number, i: any) => s + (i.total_price || 0), 0);
    const totalItems = items.reduce((s: number, i: any) => s + (i.total_qty || 0), 0);
    const topItems = items.map((i: any) => ({ name: i.item_name, qty: i.total_qty }));

    // Save daily log
    db.prepare(
      `INSERT OR REPLACE INTO daily_logs (date, order_count, item_count, total_revenue, top_items)
       VALUES (?, ?, ?, ?, ?)`
    ).run(today, orders.length, totalItems, totalRevenue, JSON.stringify(topItems));

    // Archive all current orders
    db.prepare("UPDATE orders SET is_archived = 1 WHERE is_archived = 0").run();

    console.log(`Daily reset: archived ${orders.length} orders, revenue: $${totalRevenue.toFixed(2)}`);
  }

  // Clear all service calls
  db.prepare("DELETE FROM service_calls").run();

  // Broadcast reset to all clients
  broadcastToAll({ type: 'HISTORY_CLEARED' });
}
