import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

export function registerTaxReportRoutes(app: FastifyInstance) {

  // Summary report for a date range
  app.get<{ Querystring: { start?: string; end?: string; period?: string } }>('/api/reports/tax', (req) => {
    const db = getDb();
    const now = new Date();
    let start = req.query.start || '';
    let end = req.query.end || '';

    // Period shortcuts
    const period = req.query.period || 'month';
    if (!req.query.start) {
      if (period === 'today') {
        start = now.toISOString().slice(0, 10);
        end = start;
      } else if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay());
        start = d.toISOString().slice(0, 10);
        end = now.toISOString().slice(0, 10);
      } else if (period === 'month') {
        start = now.toISOString().slice(0, 7) + '-01';
        end = now.toISOString().slice(0, 10);
      } else if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3) * 3;
        start = now.getFullYear() + '-' + String(q + 1).padStart(2, '0') + '-01';
        end = now.toISOString().slice(0, 10);
      } else if (period === 'year') {
        start = now.getFullYear() + '-01-01';
        end = now.toISOString().slice(0, 10);
      }
    }

    // Get all orders in date range (both active and archived)
    const orders = db.prepare(
      "SELECT * FROM orders WHERE date(created_at) >= ? AND date(created_at) <= ? AND status IN ('active', 'finished')"
    ).all(start, end) as any[];

    const orderIds = orders.map(o => o.id);
    let items: any[] = [];
    let grossSales = 0;
    let itemCount = 0;

    if (orderIds.length > 0) {
      const ph = orderIds.map(() => '?').join(',');
      items = db.prepare(
        `SELECT oi.*, o.order_type, o.created_at as order_date, o.table_number
         FROM order_items oi JOIN orders o ON oi.order_id = o.id
         WHERE o.id IN (${ph})
         ORDER BY o.created_at`
      ).all(...orderIds) as any[];

      grossSales = items.reduce((s, i) => s + (i.item_price * i.quantity), 0);
      itemCount = items.reduce((s, i) => s + i.quantity, 0);
    }

    // Tax rates
    let taxRates: any[] = [];
    try { taxRates = db.prepare('SELECT * FROM tax_rates WHERE is_active = 1').all() as any[]; } catch {}
    const taxRate = taxRates.length > 0 ? taxRates[0].rate : 7;
    let taxCollected = grossSales * (taxRate / 100);
    const netSales = grossSales;
    let totalWithTax = grossSales + taxCollected;

    // Discounts
    const discountTotal = orders.reduce((s, o) => s + (o.discount_amount || 0), 0);

    // Tips
    const tipTotal = orders.reduce((s, o) => s + (o.tip_amount || 0), 0);

    // Refunds
    let refundTotal = 0;
    try {
      const refunds = db.prepare(
        "SELECT SUM(amount) as total FROM refunds WHERE date(created_at) >= ? AND date(created_at) <= ?"
      ).get(start, end) as any;
      refundTotal = refunds?.total || 0;
    } catch {}

    // Sales by category
    const categoryBreakdown: Record<string, { count: number; revenue: number }> = {};
    for (const item of items) {
      const menuItem = db.prepare('SELECT m.*, c.name as cat_name FROM menu_items m JOIN categories c ON m.category_id = c.id WHERE m.id = ?').get(item.menu_item_id) as any;
      const cat = menuItem?.cat_name || 'Other';
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, revenue: 0 };
      categoryBreakdown[cat].count += item.quantity;
      categoryBreakdown[cat].revenue += item.item_price * item.quantity;
    }

    // Sales by order type
    const typeBreakdown: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const type = order.order_type || 'dine_in';
      if (!typeBreakdown[type]) typeBreakdown[type] = { count: 0, revenue: 0 };
      typeBreakdown[type].count++;
      const orderItems = items.filter(i => i.order_id === order.id);
      typeBreakdown[type].revenue += orderItems.reduce((s, i) => s + i.item_price * i.quantity, 0);
    }

    // Sales by day
    const dailyBreakdown: Record<string, { orders: number; revenue: number; tax: number }> = {};
    for (const order of orders) {
      const day = order.created_at.slice(0, 10);
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { orders: 0, revenue: 0, tax: 0 };
      dailyBreakdown[day].orders++;
      const dayItems = items.filter(i => i.order_id === order.id);
      const dayRev = dayItems.reduce((s, i) => s + i.item_price * i.quantity, 0);
      dailyBreakdown[day].revenue += dayRev;
      dailyBreakdown[day].tax += dayRev * (taxRate / 100);
    }

    // Top items
    const itemBreakdown: Record<string, { qty: number; revenue: number }> = {};
    for (const item of items) {
      const name = item.item_name;
      if (!itemBreakdown[name]) itemBreakdown[name] = { qty: 0, revenue: 0 };
      itemBreakdown[name].qty += item.quantity;
      itemBreakdown[name].revenue += item.item_price * item.quantity;
    }
    const topItems = Object.entries(itemBreakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    // Labor (if time entries exist)
    let laborCost = 0;
    try {
      const labor = db.prepare(
        `SELECT SUM(
          CASE WHEN te.clock_out IS NOT NULL THEN
            (julianday(te.clock_out) - julianday(te.clock_in)) * 24 * e.hourly_rate
          ELSE 0 END
        ) as total
        FROM time_entries te JOIN employees e ON te.employee_id = e.id
        WHERE date(te.clock_in) >= ? AND date(te.clock_in) <= ?`
      ).get(start, end) as any;
      laborCost = labor?.total || 0;
    } catch {}

    // Voided orders count
    let voidedCount = 0;
    try {
      const voided = db.prepare(
        "SELECT COUNT(*) as c FROM orders WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'voided'"
      ).get(start, end) as any;
      voidedCount = voided?.c || 0;
    } catch {}

    // Use stored tax amounts when available, fall back to calculated
    const storedTax = orders.reduce((s, o) => s + (o.tax_amount || 0), 0);
    if (storedTax > 0) {
      taxCollected = storedTax;
      totalWithTax = grossSales + taxCollected;
    }

    // Payment methods
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
    for (const order of orders) {
      const method = order.payment_method || 'unrecorded';
      if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, amount: 0 };
      paymentBreakdown[method].count++;
      const oItems = items.filter(i => i.order_id === order.id);
      paymentBreakdown[method].amount += oItems.reduce((s, i) => s + i.item_price * i.quantity, 0);
    }

    const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get() as any;

    return {
      restaurant_name: settingsRow?.value || 'Restaurant',
      period: { start, end, label: period },
      summary: {
        gross_sales: grossSales,
        net_sales: netSales,
        tax_rate: taxRate,
        tax_collected: taxCollected,
        total_with_tax: totalWithTax,
        discounts: discountTotal,
        refunds: refundTotal,
        tips: tipTotal,
        labor_cost: laborCost,
        order_count: orders.length,
        voided_count: voidedCount,
        item_count: itemCount,
        avg_order: orders.length > 0 ? grossSales / orders.length : 0,
      },
      by_category: categoryBreakdown,
      by_order_type: typeBreakdown,
      by_day: dailyBreakdown,
      by_payment: paymentBreakdown,
      top_items: topItems,
    };
  });

  // Transaction log — every order line item for the date range
  app.get<{ Querystring: { start?: string; end?: string } }>('/api/reports/transactions', (req) => {
    const db = getDb();
    const start = req.query.start || new Date().toISOString().slice(0, 7) + '-01';
    const end = req.query.end || new Date().toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT o.order_number, o.table_number, o.order_type, o.created_at, o.payment_method,
             o.discount_amount, o.tip_amount, o.source,
             oi.item_name, oi.variant_name, oi.quantity, oi.item_price, oi.notes
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE date(o.created_at) >= ? AND date(o.created_at) <= ?
      ORDER BY o.created_at ASC
    `).all(start, end);

    return { start, end, transactions: rows };
  });
}
