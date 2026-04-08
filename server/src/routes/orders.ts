import type { FastifyInstance, FastifyReply } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToRole, broadcastToAll, broadcastToTable } from '../ws/broadcast.js';
import { getPrinterSettings, printReceipt } from '../printer.js';

function generateOrderNumber(): string {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'order_prefix'").get() as any;
  const prefix = prefixRow?.value || 'A';

  const upsert = db.prepare(`
    INSERT INTO order_sequence (date_key, last_number) VALUES (?, 1)
    ON CONFLICT(date_key) DO UPDATE SET last_number = last_number + 1
  `);
  upsert.run(today);

  const row = db.prepare('SELECT last_number FROM order_sequence WHERE date_key = ?').get(today) as any;
  const num = String(row.last_number).padStart(3, '0');
  return `${prefix}${num}`;
}

function getOrderWithItems(orderId: number) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  order.packaging = db.prepare(`
    SELECT p.name FROM order_packaging op
    JOIN packaging_options p ON op.packaging_option_id = p.id
    WHERE op.order_id = ?
  `).all(orderId).map((r: any) => r.name);
  return order;
}

function allKitchenItemsDone(orderId: number): boolean {
  const db = getDb();
  const remaining = db.prepare(`
    SELECT COUNT(*) as count FROM order_items
    WHERE order_id = ? AND show_in_kitchen = 1 AND is_done = 0
  `).get(orderId) as any;
  return remaining.count === 0;
}

export function registerOrderRoutes(app: FastifyInstance) {
  // Create order
  app.post<{
    Body: {
      table_number: string;
      source?: string;
      order_type?: string;
      customer_name?: string;
      tip_amount?: number;
      items: Array<{
        menu_item_id: number; item_name: string; quantity: number;
        show_in_kitchen: boolean; notes?: string; customer_number?: number;
        item_price?: number; variant_name?: string;
        combo_id?: number; combo_slot_label?: string;
      }>;
    };
  }>('/api/orders', (req) => {
    const db = getDb();
    const {
      table_number, items, source = 'server',
      order_type = 'dine_in', customer_name = '', tip_amount = 0,
    } = req.body;
    const order_number = generateOrderNumber();

    const insertOrder = db.prepare(
      'INSERT INTO orders (order_number, table_number, source, order_type, customer_name, tip_amount, needs_approval) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, show_in_kitchen,
       notes, customer_number, item_price, variant_name, combo_id, combo_slot_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let orderId: number;
    db.exec('BEGIN');
    try {
      const needsApproval = (source === 'customer') ? 1 : 0;
      const orderResult = insertOrder.run(order_number, table_number, source, order_type, customer_name, tip_amount, needsApproval);
      orderId = Number(orderResult.lastInsertRowid);
      for (const item of items) {
        insertItem.run(orderId, item.menu_item_id, item.item_name, item.quantity,
          item.show_in_kitchen ? 1 : 0, item.notes || '', item.customer_number || 0,
          item.item_price || 0, item.variant_name || '', item.combo_id || null, item.combo_slot_label || '');
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const order = getOrderWithItems(orderId!);

    if (source === 'customer') {
      // Customer orders need server approval first
      broadcastToRole('server', { type: 'ORDER_NEEDS_APPROVAL', order });
    } else {
      // Server/staff orders go straight to kitchen + notify floor plan
      broadcastToRole('kitchen', { type: 'NEW_ORDER', order });
      broadcastToRole('server', { type: 'NEW_ORDER', order });
    }

    // Auto-print kitchen ticket if configured (only for non-customer / approved orders)
    if (source !== 'customer') try {
      const ps = getPrinterSettings();
      if (ps.auto_print_kitchen && ps.kitchen_ip) {
        const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get() as any;
        const kitchenItems = order.items.filter((i: any) => i.show_in_kitchen);
        if (kitchenItems.length > 0) {
          printReceipt(ps.kitchen_ip, ps.kitchen_port, {
            restaurant_name: settingsRow?.value || 'Restaurant',
            table_number: order.table_number,
            order_number: order.order_number,
            items: kitchenItems,
            subtotal: 0,
            type: 'kitchen',
            date: new Date().toLocaleString(),
          }).catch(() => {});
        }
      }
    } catch {}

    return order;
  });

  // Approve a customer order (sends it to kitchen)
  app.patch<{ Params: { id: string }; Body: { employee_id?: number } }>('/api/orders/:id/approve', (req) => {
    const db = getDb();
    const orderId = Number(req.params.id);
    db.prepare("UPDATE orders SET needs_approval = 0, approved_by = ?, approved_at = datetime('now', 'localtime') WHERE id = ?")
      .run(req.body.employee_id || null, orderId);

    const order = getOrderWithItems(orderId);
    broadcastToRole('kitchen', { type: 'NEW_ORDER', order });
    broadcastToRole('server', { type: 'NEW_ORDER', order });
    broadcastToTable(order.table_number, { type: 'ORDER_APPROVED', orderId });

    // Auto-print kitchen ticket now that it's approved
    try {
      const ps = getPrinterSettings();
      if (ps.auto_print_kitchen && ps.kitchen_ip) {
        const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get() as any;
        const kitchenItems = order.items.filter((i: any) => i.show_in_kitchen);
        if (kitchenItems.length > 0) {
          printReceipt(ps.kitchen_ip, ps.kitchen_port, {
            restaurant_name: settingsRow?.value || 'Restaurant',
            table_number: order.table_number,
            order_number: order.order_number,
            items: kitchenItems,
            subtotal: 0,
            type: 'kitchen',
            date: new Date().toLocaleString(),
          }).catch(() => {});
        }
      }
    } catch {}

    return { ok: true };
  });

  // Reject a customer order
  app.patch<{ Params: { id: string }; Body: { reason?: string } }>('/api/orders/:id/reject', (req) => {
    const db = getDb();
    const orderId = Number(req.params.id);
    const order = getOrderWithItems(orderId);

    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);

    broadcastToTable(order.table_number, { type: 'ORDER_REJECTED', orderId, reason: req.body.reason || 'Order declined by server' });

    return { ok: true };
  });

  // Get pending approval orders
  app.get('/api/orders/pending-approval', () => {
    const db = getDb();
    const orders = db.prepare("SELECT * FROM orders WHERE needs_approval = 1 AND status = 'active' AND is_archived = 0 ORDER BY created_at ASC").all() as any[];
    return orders.map(o => {
      o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return o;
    });
  });

  // List active orders
  app.get('/api/orders/active', () => {
    const db = getDb();
    const orders = db.prepare("SELECT * FROM orders WHERE status = 'active' AND closed = 0 AND is_archived = 0 ORDER BY created_at ASC").all() as any[];
    return orders.map(o => {
      o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return o;
    });
  });

  // List finished orders
  app.get('/api/orders/finished', () => {
    const db = getDb();
    const orders = db.prepare("SELECT * FROM orders WHERE status = 'finished' AND closed = 0 AND is_archived = 0 ORDER BY finished_at DESC LIMIT 50").all() as any[];
    return orders.map(o => {
      o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return o;
    });
  });

  // Remove item from order (server correction)
  app.delete<{ Params: { id: string } }>('/api/order-items/:id', (req, reply) => {
    const db = getDb();
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(Number(req.params.id)) as any;
    if (!item) return reply.code(404).send({ error: 'Not found' });

    db.prepare('DELETE FROM order_items WHERE id = ?').run(req.params.id);

    // Check if order is now empty
    const remaining = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE order_id = ?').get(item.order_id) as any;
    if (remaining.count === 0) {
      db.prepare('DELETE FROM orders WHERE id = ?').run(item.order_id);
    }

    const order = getOrderWithItems(item.order_id);
    broadcastToRole('kitchen', { type: 'ORDER_UPDATED', order, newItemIds: [] });
    broadcastToRole('server', { type: 'ORDER_UPDATED', order });

    return { ok: true };
  });

  // Mark item as done
  app.patch<{ Params: { id: string } }>('/api/order-items/:id/done', (req, reply) => {
    const db = getDb();
    db.prepare('UPDATE order_items SET is_done = 1 WHERE id = ?').run(req.params.id);

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(Number(req.params.id)) as any;
    if (!item) return reply.code(404).send({ error: 'Not found' });

    const allDone = allKitchenItemsDone(item.order_id);
    broadcastToRole('kitchen', { type: 'ITEM_DONE', itemId: item.id, orderId: item.order_id, allDone });

    // Notify customer
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(item.order_id) as any;
    if (order?.table_number) {
      broadcastToTable(order.table_number, { type: 'ITEM_DONE', itemId: item.id, orderId: item.order_id, allDone });
    }

    return { ok: true, allDone };
  });

  // Undo item done
  app.patch<{ Params: { id: string } }>('/api/order-items/:id/undone', (req, reply) => {
    const db = getDb();
    db.prepare('UPDATE order_items SET is_done = 0 WHERE id = ?').run(req.params.id);

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(Number(req.params.id)) as any;
    if (!item) return reply.code(404).send({ error: 'Not found' });

    db.prepare("UPDATE orders SET status = 'active', finished_at = NULL WHERE id = ? AND status = 'finished'")
      .run(item.order_id);

    const order = getOrderWithItems(item.order_id);
    broadcastToRole('kitchen', { type: 'ITEM_UNDONE', itemId: item.id, orderId: item.order_id, order });

    return { ok: true };
  });

  // Complete an order (manual)
  app.patch<{ Params: { id: string } }>('/api/orders/:id/complete', (req) => {
    const db = getDb();
    db.prepare("UPDATE orders SET status = 'finished', customer_status = 'ready', finished_at = datetime('now', 'localtime') WHERE id = ? AND status = 'active'")
      .run(req.params.id);
    const order = getOrderWithItems(Number(req.params.id));
    broadcastToRole('kitchen', { type: 'ORDER_FINISHED', order });
    broadcastToRole('server', { type: 'ORDER_READY', order });
    if (order?.table_number) {
      broadcastToTable(order.table_number, { type: 'ORDER_READY', orderId: order.id, orderNumber: order.order_number, tableNumber: order.table_number });
    }
    return { ok: true };
  });

  // Record payment method and tax on an order
  app.patch<{ Params: { id: string }; Body: { payment_method?: string; tax_amount?: number; tip_amount?: number } }>('/api/orders/:id/payment', (req, reply) => {
    const db = getDb();
    const b = req.body;
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id)) as any;
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const updates: string[] = [];
    const values: any[] = [];
    if (b.payment_method) { updates.push('payment_method = ?'); values.push(b.payment_method); }
    if (b.tax_amount !== undefined) { updates.push('tax_amount = ?'); values.push(b.tax_amount); }
    if (b.tip_amount !== undefined) { updates.push('tip_amount = ?'); values.push(b.tip_amount); }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    return { ok: true };
  });

  // Update customer-facing status
  app.patch<{ Params: { id: string }; Body: { status: string } }>('/api/orders/:id/customer-status', (req) => {
    const db = getDb();
    const { status } = req.body;
    db.prepare('UPDATE orders SET customer_status = ? WHERE id = ?').run(status, req.params.id);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id)) as any;
    if (order?.table_number) {
      broadcastToTable(order.table_number, { type: 'ORDER_STATUS_CHANGED', orderId: order.id, status });
    }
    broadcastToRole('kitchen', { type: 'ORDER_STATUS_CHANGED', orderId: Number(req.params.id), status });
    return { ok: true };
  });

  // Update tip
  app.patch<{ Params: { id: string }; Body: { tip_amount: number } }>('/api/orders/:id/tip', (req) => {
    getDb().prepare('UPDATE orders SET tip_amount = ? WHERE id = ?').run(req.body.tip_amount, req.params.id);
    return { ok: true };
  });

  // Get bill for a table (all unclosed orders)
  app.get<{ Params: { tableNumber: string } }>('/api/orders/table/:tableNumber/bill', (req) => {
    const db = getDb();
    const orders = db.prepare(
      "SELECT * FROM orders WHERE table_number = ? AND closed = 0 ORDER BY created_at ASC"
    ).all(req.params.tableNumber) as any[];

    let grandTotal = 0;
    let tipTotal = 0;
    for (const o of orders) {
      o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      o.subtotal = o.items.reduce((s: number, i: any) => s + (i.item_price * i.quantity), 0);
      grandTotal += o.subtotal;
      tipTotal += o.tip_amount || 0;
    }

    return { orders, grandTotal, tipTotal };
  });

  // Set packaging on an order
  app.post<{ Params: { id: string }; Body: { packaging_option_ids: number[] } }>('/api/orders/:id/packaging', (req) => {
    const db = getDb();
    const orderId = Number(req.params.id);
    db.prepare('DELETE FROM order_packaging WHERE order_id = ?').run(orderId);
    const insert = db.prepare('INSERT OR IGNORE INTO order_packaging (order_id, packaging_option_id) VALUES (?, ?)');
    for (const pid of req.body.packaging_option_ids) {
      insert.run(orderId, pid);
    }
    return { ok: true };
  });

  // Customer orders for a table
  app.get<{ Params: { tableNumber: string } }>('/api/orders/customer/:tableNumber', (req) => {
    const db = getDb();
    const orders = db.prepare(
      "SELECT * FROM orders WHERE table_number = ? AND closed = 0 ORDER BY created_at DESC"
    ).all(req.params.tableNumber) as any[];
    return orders.map(o => {
      o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return o;
    });
  });

  // Add items to existing order
  app.post<{
    Params: { id: string };
    Body: {
      items: Array<{
        menu_item_id: number; item_name: string; quantity: number;
        show_in_kitchen: boolean; notes?: string; customer_number?: number;
        item_price?: number; variant_name?: string;
        combo_id?: number; combo_slot_label?: string;
      }>;
    };
  }>('/api/orders/:id/add-items', (req, reply) => {
    const db = getDb();
    const orderId = Number(req.params.id);
    const { items } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return reply.code(404).send({ error: 'Order not found' });

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, show_in_kitchen,
       notes, customer_number, item_price, variant_name, combo_id, combo_slot_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const newItemIds: number[] = [];

    db.exec('BEGIN');
    try {
      if (order.status === 'finished') {
        db.prepare("UPDATE orders SET status = 'active', finished_at = NULL WHERE id = ?").run(orderId);
      }
      for (const item of items) {
        const result = insertItem.run(orderId, item.menu_item_id, item.item_name, item.quantity,
          item.show_in_kitchen ? 1 : 0, item.notes || '', item.customer_number || 0,
          item.item_price || 0, item.variant_name || '', item.combo_id || null, item.combo_slot_label || '');
        newItemIds.push(Number(result.lastInsertRowid));
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const updated = getOrderWithItems(orderId);
    broadcastToRole('kitchen', { type: 'ORDER_UPDATED', order: updated, newItemIds });
    broadcastToRole('server', { type: 'ORDER_UPDATED', order: updated });
    return updated;
  });

  // Get current order for a table
  app.get<{ Params: { tableNumber: string } }>('/api/orders/table/:tableNumber/current', (req) => {
    const db = getDb();
    const { tableNumber } = req.params;

    let order = db.prepare(
      "SELECT * FROM orders WHERE table_number = ? AND status = 'active' AND closed = 0 ORDER BY created_at DESC LIMIT 1"
    ).get(tableNumber) as any;

    if (!order) {
      order = db.prepare(
        "SELECT * FROM orders WHERE table_number = ? AND status = 'finished' AND closed = 0 AND date(created_at) = date('now', 'localtime') ORDER BY finished_at DESC LIMIT 1"
      ).get(tableNumber) as any;
    }

    if (!order) return null;
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return order;
  });

  // Get single order
  app.get<{ Params: { id: string } }>('/api/orders/:id', (req) => {
    return getOrderWithItems(Number(req.params.id));
  });

  // Close table
  app.post<{ Params: { tableNumber: string } }>('/api/tables/:tableNumber/close', (req) => {
    const db = getDb();
    const { tableNumber } = req.params;

    db.prepare(
      "UPDATE orders SET closed = 1, status = 'finished', finished_at = COALESCE(finished_at, datetime('now', 'localtime')) WHERE table_number = ? AND closed = 0"
    ).run(tableNumber);

    broadcastToAll({ type: 'TABLE_CLOSED', tableNumber });
    return { ok: true };
  });

  // Settle all
  app.post('/api/orders/clear-history', () => {
    const db = getDb();
    db.prepare(
      "UPDATE orders SET closed = 1, status = 'finished', finished_at = COALESCE(finished_at, datetime('now', 'localtime')) WHERE closed = 0 AND status = 'active'"
    ).run();
    db.prepare(
      "UPDATE orders SET closed = 1 WHERE closed = 0 AND status = 'finished'"
    ).run();
    broadcastToAll({ type: 'HISTORY_CLEARED' });
    return { ok: true };
  });

  // Reopen table
  app.post<{ Params: { tableNumber: string } }>('/api/tables/:tableNumber/reopen', (req) => {
    const db = getDb();
    const { tableNumber } = req.params;

    db.prepare(
      "UPDATE orders SET closed = 0 WHERE table_number = ? AND closed = 1 AND date(created_at) = date('now', 'localtime')"
    ).run(tableNumber);

    broadcastToAll({ type: 'TABLE_REOPENED', tableNumber });
    return { ok: true };
  });
}
