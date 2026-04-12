import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToRole } from '../ws/broadcast.js';

/**
 * Delivery Integration
 *
 * This provides a webhook endpoint that DoorDash, UberEats, GrubHub
 * (or any third-party delivery service) can POST orders to.
 *
 * The order flows into the same kitchen queue as regular orders.
 *
 * For actual DoorDash/UberEats integration, you'd need:
 * 1. A merchant account with them
 * 2. Their SDK/API keys configured
 * 3. Their webhook pointed at /api/delivery/webhook
 *
 * This also supports manual delivery order entry.
 */

function generateOrderNumber(): string {
  const db = getDb();
  const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'order_prefix'").get() as any)?.value || 'A';
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO order_sequence (date_key, last_number) VALUES (?, 0) ON CONFLICT(date_key) DO UPDATE SET last_number = last_number + 1").run(today);
  const num = (db.prepare('SELECT last_number FROM order_sequence WHERE date_key = ?').get(today) as any).last_number;
  return `${prefix}${String(num).padStart(3, '0')}`;
}

export function registerDeliveryRoutes(app: FastifyInstance) {
  // Webhook — accepts delivery orders from external services
  app.post<{ Body: any }>('/api/delivery/webhook', (req) => {
    const db = getDb();
    const body = req.body as any;

    // Normalize from various delivery platforms
    const source = body.source || body.platform || 'delivery';
    const customerName = body.customer_name || body.customer?.name || 'Delivery Customer';
    const orderNumber = generateOrderNumber();
    const items = body.items || [];

    if (items.length === 0) return { error: 'No items in order' };

    const result = db.prepare(
      `INSERT INTO orders (table_number, order_number, source, status, order_type, customer_name)
       VALUES (?, ?, ?, 'active', 'pickup', ?)`
    ).run(`DEL-${Date.now()}`, orderNumber, source, customerName);

    const orderId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, item_price, show_in_kitchen, notes, variant_name)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    );

    for (const item of items) {
      // Try to match menu item by name
      const menuItem = db.prepare('SELECT id, price FROM menu_items WHERE name = ?').get(item.name || item.item_name) as any;
      insertItem.run(
        orderId,
        menuItem?.id || 0,
        item.name || item.item_name || 'Unknown Item',
        item.quantity || 1,
        item.price || item.item_price || menuItem?.price || 0,
        item.notes || item.special_instructions || '',
        item.variant || item.variant_name || '',
      );
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    broadcastToRole('kitchen', { type: 'NEW_ORDER', order });
    broadcastToRole('server', { type: 'NEW_ORDER', order });

    return { ok: true, order_id: orderId, order_number: orderNumber };
  });

  // Manual delivery order entry
  app.post<{ Body: { platform: string; customer_name: string; items: { name: string; quantity: number; price: number; notes?: string }[] } }>(
    '/api/delivery/manual', (req) => {
      // Reuse the webhook handler
      return app.inject({
        method: 'POST',
        url: '/api/delivery/webhook',
        payload: { ...req.body, source: req.body.platform },
      }).then(r => r.json());
    }
  );

  // List delivery orders
  app.get('/api/delivery/orders', () => {
    const db = getDb();
    const orders = db.prepare(
      "SELECT * FROM orders WHERE source IN ('doordash', 'ubereats', 'grubhub', 'delivery') AND is_archived = 0 ORDER BY created_at DESC LIMIT 50"
    ).all() as any[];
    return orders.map(o => {
      o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return o;
    });
  });
}
