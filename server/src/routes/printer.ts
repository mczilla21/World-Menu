import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { scanForPrinters, printReceipt, getPrinterSettings } from '../printer.js';

function getSettingValue(key: string, def: string = ''): string {
  return (getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as any)?.value || def;
}

export function registerPrinterRoutes(app: FastifyInstance) {
  // Scan network for printers
  app.post('/api/printer/scan', async () => {
    const printers = await scanForPrinters();
    return { printers };
  });

  // Test print
  app.post<{ Body: { ip: string; port?: number } }>('/api/printer/test', async (req) => {
    const ok = await printReceipt(req.body.ip, req.body.port || 9100, {
      restaurant_name: getSettingValue('restaurant_name', 'World Menu'),
      items: [{ item_name: 'Test Print - SUCCESS', quantity: 1, item_price: 0 }],
      subtotal: 0,
      total: 0,
      type: 'receipt',
      date: new Date().toLocaleString(),
      qr_url: 'https://worldmenu.app',
    });
    return { ok };
  });

  // Print receipt for a table (with tax, QR code)
  app.post<{ Body: { table_number: string } }>('/api/printer/receipt', async (req) => {
    const db = getDb();
    const ps = getPrinterSettings();
    if (!ps.receipt_ip) return { error: 'No receipt printer configured' };

    const restaurantName = getSettingValue('restaurant_name', 'Restaurant');

    const orders = db.prepare(
      "SELECT * FROM orders WHERE table_number = ? AND closed = 0 AND is_archived = 0 ORDER BY created_at ASC"
    ).all(req.body.table_number) as any[];

    const allItems: any[] = [];
    let subtotal = 0;
    for (const o of orders) {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) as any[];
      for (const item of items) {
        allItems.push(item);
        subtotal += item.item_price * item.quantity;
      }
    }

    // Get tax rate
    let taxRate = 0;
    try {
      const rates = db.prepare('SELECT * FROM tax_rates WHERE is_active = 1').all() as any[];
      if (rates.length > 0) taxRate = rates[0].rate;
    } catch {}
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    // Build QR URL for online ordering
    const qrUrl = getSettingValue('online_order_url', '');

    const ok = await printReceipt(ps.receipt_ip, ps.receipt_port, {
      restaurant_name: restaurantName,
      table_number: req.body.table_number,
      items: allItems,
      subtotal,
      tax,
      total,
      type: 'receipt',
      date: new Date().toLocaleString(),
      qr_url: qrUrl || undefined,
    });
    return { ok };
  });

  // Print kitchen ticket
  app.post<{ Body: { order_id: number } }>('/api/printer/kitchen', async (req) => {
    const db = getDb();
    const ps = getPrinterSettings();
    if (!ps.kitchen_ip) return { error: 'No kitchen printer configured' };

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id) as any;
    if (!order) return { error: 'Order not found' };

    const restaurantName = getSettingValue('restaurant_name', 'Restaurant');
    const items = db.prepare(
      'SELECT * FROM order_items WHERE order_id = ? AND show_in_kitchen = 1'
    ).all(order.id) as any[];

    const ok = await printReceipt(ps.kitchen_ip, ps.kitchen_port, {
      restaurant_name: restaurantName,
      table_number: order.table_number,
      order_number: order.order_number,
      items,
      subtotal: 0,
      type: 'kitchen',
      date: new Date().toLocaleString(),
    });
    return { ok };
  });

  // Open cash drawer manually
  app.post('/api/printer/open-drawer', async () => {
    const ps = getPrinterSettings();
    if (!ps.receipt_ip) return { error: 'No receipt printer configured' };

    // Send just the cash drawer kick command
    const ok = await printReceipt(ps.receipt_ip, ps.receipt_port, {
      restaurant_name: '',
      items: [],
      subtotal: 0,
      type: 'receipt',
      date: '',
    });
    return { ok };
  });
}
