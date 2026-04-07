import { getDb } from './db/connection.js';

// Automatically save a daily log for yesterday if one doesn't exist
// Called periodically (e.g. every hour) — not a hard reset, just bookkeeping
export function checkAndSaveDailyLog() {
  const db = getDb();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Check if yesterday's log already exists
  const existing = db.prepare('SELECT id FROM daily_logs WHERE date = ?').get(yesterday) as any;
  if (existing) return; // Already logged

  // Check if there were any orders yesterday
  const orders = db.prepare(
    "SELECT id FROM orders WHERE date(created_at) = ? AND status != 'voided'"
  ).all(yesterday) as any[];

  if (orders.length === 0) return; // No orders yesterday, skip

  const orderIds = orders.map((o: any) => o.id);
  const ph = orderIds.map(() => '?').join(',');

  const items = db.prepare(
    `SELECT item_name, SUM(quantity) as total_qty, SUM(item_price * quantity) as total_price
     FROM order_items WHERE order_id IN (${ph})
     GROUP BY item_name ORDER BY total_qty DESC LIMIT 10`
  ).all(...orderIds) as any[];

  const totalRevenue = items.reduce((s: number, i: any) => s + (i.total_price || 0), 0);
  const totalItems = items.reduce((s: number, i: any) => s + (i.total_qty || 0), 0);
  const topItems = items.map((i: any) => ({ name: i.item_name, qty: i.total_qty }));

  db.prepare(
    'INSERT OR REPLACE INTO daily_logs (date, order_count, item_count, total_revenue, top_items) VALUES (?, ?, ?, ?, ?)'
  ).run(yesterday, orders.length, totalItems, totalRevenue, JSON.stringify(topItems));

  console.log(`Auto daily log: ${yesterday} — ${orders.length} orders, $${totalRevenue.toFixed(2)}`);
}

// Start the hourly check
export function startAutoDailyLog() {
  // Check immediately on startup
  try { checkAndSaveDailyLog(); } catch {}

  // Then check every hour
  setInterval(() => {
    try { checkAndSaveDailyLog(); } catch {}
  }, 60 * 60 * 1000);
}
