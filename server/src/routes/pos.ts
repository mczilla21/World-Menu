import type { FastifyInstance, FastifyReply } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

export function registerPosRoutes(app: FastifyInstance) {

  // ============================================
  // 1. EMPLOYEES
  // ============================================
  app.get('/api/employees', () => {
    return getDb().prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY name').all();
  });

  app.get('/api/employees/all', () => {
    return getDb().prepare('SELECT * FROM employees ORDER BY name').all();
  });

  app.post<{ Body: { name: string; pin: string; role?: string; hourly_rate?: number } }>('/api/employees', (req, reply) => {
    const db = getDb();
    const { name, pin, role = 'server', hourly_rate = 0 } = req.body;
    const existing = db.prepare('SELECT id FROM employees WHERE pin = ? AND is_active = 1').get(pin) as any;
    if (existing) return reply.code(409).send({ error: 'PIN already taken, pick another' });
    const result = db.prepare('INSERT INTO employees (name, pin, role, hourly_rate) VALUES (?, ?, ?, ?)').run(name, pin, role, hourly_rate);
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: Record<string, any> }>('/api/employees/:id', (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(req.params.id)) as any;
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const b = req.body;
    const newPin = b.pin ?? existing.pin;
    if (newPin !== existing.pin) {
      const dupe = db.prepare('SELECT id FROM employees WHERE pin = ? AND is_active = 1 AND id != ?').get(newPin, Number(req.params.id)) as any;
      if (dupe) return reply.code(409).send({ error: 'PIN already taken, pick another' });
    }
    db.prepare('UPDATE employees SET name=?, pin=?, role=?, hourly_rate=?, is_active=? WHERE id=?')
      .run(b.name ?? existing.name, newPin, b.role ?? existing.role,
        b.hourly_rate ?? existing.hourly_rate, b.is_active ?? existing.is_active, req.params.id);
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  });

  // Delete employee (hard delete — only if no time entries exist, otherwise deactivate)
  app.delete<{ Params: { id: string } }>('/api/employees/:id', (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'Invalid ID' });
    const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(id) as any;
    if (!emp) return reply.code(404).send({ error: 'Employee not found' });
    // Check if currently clocked in
    const activeShift = db.prepare('SELECT id FROM time_entries WHERE employee_id = ? AND clock_out IS NULL').get(id) as any;
    if (activeShift) {
      // Clock them out first
      db.prepare('UPDATE time_entries SET clock_out = datetime(\'now\') WHERE id = ?').run(activeShift.id);
    }
    const hasEntries = db.prepare('SELECT COUNT(*) as c FROM time_entries WHERE employee_id = ?').get(id) as any;
    if (hasEntries && hasEntries.c > 0) {
      // Has history — deactivate instead of delete to preserve audit trail
      db.prepare('UPDATE employees SET is_active = 0 WHERE id = ?').run(id);
      return { ok: true, deactivated: true, message: 'Employee has time entries — deactivated instead of deleted' };
    }
    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    return { ok: true };
  });

  // Authenticate by PIN
  app.post<{ Body: { pin: string } }>('/api/employees/auth', (req, reply) => {
    const db = getDb();
    const emp = db.prepare('SELECT id, name, role, pin FROM employees WHERE pin = ? AND is_active = 1').get(req.body.pin) as any;
    if (!emp) return reply.code(401).send({ error: 'Invalid PIN' });
    return { ok: true, employee: emp };
  });

  // Clock in
  app.post<{ Body: { pin: string } }>('/api/employees/clock-in', (req, reply) => {
    const db = getDb();
    const emp = db.prepare('SELECT * FROM employees WHERE pin = ? AND is_active = 1').get(req.body.pin) as any;
    if (!emp) return reply.code(401).send({ error: 'Invalid PIN' });
    const active = db.prepare('SELECT * FROM time_entries WHERE employee_id = ? AND clock_out IS NULL').get(emp.id) as any;
    if (active) return reply.code(409).send({ error: 'Already clocked in', entry: active, employee: emp });
    const result = db.prepare('INSERT INTO time_entries (employee_id) VALUES (?)').run(emp.id);
    return { ok: true, employee: emp, entry_id: Number(result.lastInsertRowid) };
  });

  // Clock out
  app.post<{ Body: { pin: string; tips?: number } }>('/api/employees/clock-out', (req, reply) => {
    const db = getDb();
    const emp = db.prepare('SELECT * FROM employees WHERE pin = ? AND is_active = 1').get(req.body.pin) as any;
    if (!emp) return reply.code(401).send({ error: 'Invalid PIN' });
    const active = db.prepare('SELECT * FROM time_entries WHERE employee_id = ? AND clock_out IS NULL').get(emp.id) as any;
    if (!active) return reply.code(400).send({ error: 'Not clocked in' });
    db.prepare("UPDATE time_entries SET clock_out = datetime('now', 'localtime'), tips = ? WHERE id = ?")
      .run(req.body.tips || 0, active.id);
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(active.id);
    return { ok: true, employee: emp, entry };
  });

  // Time entries report
  app.get<{ Querystring: { date?: string } }>('/api/time-entries', (req) => {
    const db = getDb();
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    return db.prepare(`
      SELECT te.*, e.name as employee_name, e.role as employee_role, e.hourly_rate
      FROM time_entries te JOIN employees e ON te.employee_id = e.id
      WHERE date(te.clock_in) = ? ORDER BY te.clock_in DESC
    `).all(date);
  });

  // Edit time entry (owner adjustments)
  app.put<{ Params: { id: string }; Body: { clock_in?: string; clock_out?: string; tips?: number; notes?: string } }>('/api/time-entries/:id', (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(Number(req.params.id)) as any;
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const b = req.body;
    db.prepare('UPDATE time_entries SET clock_in=?, clock_out=?, tips=?, notes=? WHERE id=?')
      .run(b.clock_in ?? existing.clock_in, b.clock_out ?? existing.clock_out,
        b.tips ?? existing.tips, b.notes ?? existing.notes ?? '', req.params.id);
    return { ok: true };
  });

  // Delete time entry
  app.delete<{ Params: { id: string } }>('/api/time-entries/:id', (req) => {
    getDb().prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  // Add manual time entry
  app.post<{ Body: { employee_id: number; clock_in: string; clock_out: string; tips?: number; notes?: string } }>('/api/time-entries', (req) => {
    const db = getDb();
    const b = req.body;
    const result = db.prepare('INSERT INTO time_entries (employee_id, clock_in, clock_out, tips, notes) VALUES (?, ?, ?, ?, ?)')
      .run(b.employee_id, b.clock_in, b.clock_out, b.tips || 0, b.notes || '');
    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid);
  });

  // Edit an order (price adjustments, notes)
  app.put<{ Params: { id: string }; Body: Record<string, any> }>('/api/order-items/:id/edit', (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM order_items WHERE id = ?').get(Number(req.params.id)) as any;
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const b = req.body;
    db.prepare('UPDATE order_items SET item_name=?, item_price=?, quantity=?, notes=? WHERE id=?')
      .run(b.item_name ?? existing.item_name, b.item_price ?? existing.item_price,
        b.quantity ?? existing.quantity, b.notes ?? existing.notes, req.params.id);
    return { ok: true };
  });

  // Add manual transaction/order
  app.post<{ Body: { table_number?: string; order_type?: string; items: { item_name: string; quantity: number; item_price: number; notes?: string }[]; notes?: string } }>('/api/orders/manual', (req) => {
    const db = getDb();
    const b = req.body;
    const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'order_prefix'").get() as any)?.value || 'A';
    const today = new Date().toISOString().slice(0, 10);
    const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = ?").get(today) as any).c;
    const orderNumber = prefix + String(count + 1).padStart(3, '0');

    const result = db.prepare(
      "INSERT INTO orders (order_number, table_number, source, order_type, status) VALUES (?, ?, 'manual', ?, 'finished')"
    ).run(orderNumber, b.table_number || 'MANUAL', b.order_type || 'dine_in');
    const orderId = Number(result.lastInsertRowid);

    const insertItem = db.prepare('INSERT INTO order_items (order_id, item_name, quantity, item_price, show_in_kitchen, notes) VALUES (?, ?, ?, ?, 0, ?)');
    for (const item of b.items) {
      insertItem.run(orderId, item.item_name, item.quantity, item.item_price, item.notes || '');
    }

    return { ok: true, order_id: orderId, order_number: orderNumber };
  });

  // Void an order (mark as voided, don't delete — keeps audit trail)
  app.delete<{ Params: { id: string } }>('/api/orders/:id/delete', (req) => {
    const db = getDb();
    db.prepare("UPDATE orders SET status = 'voided', is_archived = 1 WHERE id = ?").run(req.params.id);
    return { ok: true };
  });

  // ============================================
  // 2. DISCOUNTS & PROMOS
  // ============================================
  app.get('/api/discounts', () => {
    return getDb().prepare('SELECT * FROM discounts ORDER BY name').all();
  });

  app.post<{ Body: Record<string, any> }>('/api/discounts', (req) => {
    const db = getDb();
    const b = req.body;
    const result = db.prepare(
      'INSERT INTO discounts (name, type, value, code, min_order, max_uses, schedule_start, schedule_end, schedule_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(b.name, b.type || 'percent', b.value || 0, b.code || '', b.min_order || 0, b.max_uses || 0, b.schedule_start || '', b.schedule_end || '', b.schedule_days || '');
    return db.prepare('SELECT * FROM discounts WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: Record<string, any> }>('/api/discounts/:id', (req) => {
    const db = getDb();
    const b = req.body;
    db.prepare('UPDATE discounts SET name=?, type=?, value=?, code=?, min_order=?, max_uses=?, schedule_start=?, schedule_end=?, schedule_days=?, is_active=? WHERE id=?')
      .run(b.name, b.type, b.value, b.code, b.min_order, b.max_uses, b.schedule_start || '', b.schedule_end || '', b.schedule_days || '', b.is_active ?? 1, req.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/discounts/:id', (req) => {
    getDb().prepare('DELETE FROM discounts WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  // Apply discount to order
  app.post<{ Body: { order_id: number; discount_id?: number; code?: string } }>('/api/orders/apply-discount', (req, reply) => {
    const db = getDb();
    let discount: any;
    if (req.body.code) {
      discount = db.prepare('SELECT * FROM discounts WHERE code = ? AND is_active = 1').get(req.body.code);
    } else if (req.body.discount_id) {
      discount = db.prepare('SELECT * FROM discounts WHERE id = ? AND is_active = 1').get(req.body.discount_id);
    }
    if (!discount) return reply.code(404).send({ error: 'Invalid discount' });
    if (discount.max_uses > 0 && discount.used_count >= discount.max_uses) return reply.code(400).send({ error: 'Discount expired' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id) as any;
    if (!order) return reply.code(404).send({ error: 'Order not found' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
    const subtotal = items.reduce((s: number, i: any) => s + i.item_price * i.quantity, 0);

    let discountAmount = 0;
    if (discount.type === 'percent') discountAmount = subtotal * (discount.value / 100);
    else if (discount.type === 'fixed') discountAmount = discount.value;
    else if (discount.type === 'bogo') discountAmount = Math.min(...items.map((i: any) => i.item_price));

    db.prepare('UPDATE orders SET discount_id = ?, discount_amount = ? WHERE id = ?')
      .run(discount.id, discountAmount, order.id);
    db.prepare('UPDATE discounts SET used_count = used_count + 1 WHERE id = ?').run(discount.id);

    return { ok: true, discount_amount: discountAmount };
  });

  // ============================================
  // 3. REFUNDS & VOIDS
  // ============================================
  app.post<{ Body: { order_id: number; order_item_id?: number; amount: number; reason: string; type?: string; employee_id?: number } }>('/api/refunds', (req) => {
    const db = getDb();
    const b = req.body;
    const result = db.prepare(
      'INSERT INTO refunds (order_id, order_item_id, amount, reason, type, employee_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(b.order_id, b.order_item_id || null, b.amount, b.reason, b.type || 'refund', b.employee_id || null);
    return db.prepare('SELECT * FROM refunds WHERE id = ?').get(result.lastInsertRowid);
  });

  app.get('/api/refunds', () => {
    return getDb().prepare(`
      SELECT r.*, e.name as employee_name FROM refunds r
      LEFT JOIN employees e ON r.employee_id = e.id
      ORDER BY r.created_at DESC LIMIT 100
    `).all();
  });

  // ============================================
  // 4. TAX RATES
  // ============================================
  app.get('/api/tax-rates', () => {
    return getDb().prepare('SELECT * FROM tax_rates ORDER BY id').all();
  });

  app.put<{ Params: { id: string }; Body: { name?: string; rate?: number; applies_to?: string; is_active?: boolean } }>(
    '/api/tax-rates/:id', (req, reply) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return reply.code(404).send({ error: 'Not found' });
      db.prepare('UPDATE tax_rates SET name=?, rate=?, applies_to=?, is_active=? WHERE id=?')
        .run(req.body.name ?? existing.name, req.body.rate ?? existing.rate,
          req.body.applies_to ?? existing.applies_to, req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active, req.params.id);
      return { ok: true };
    }
  );

  app.post<{ Body: { name: string; rate: number; applies_to?: string } }>('/api/tax-rates', (req) => {
    const db = getDb();
    const result = db.prepare('INSERT INTO tax_rates (name, rate, applies_to) VALUES (?, ?, ?)')
      .run(req.body.name, req.body.rate, req.body.applies_to || 'all');
    return db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(result.lastInsertRowid);
  });

  // ============================================
  // 5. CASH DRAWER
  // ============================================
  app.post<{ Body: { employee_id?: number; starting_amount: number } }>('/api/cash-drawer/open', (req, reply) => {
    const db = getDb();
    const active = db.prepare('SELECT * FROM cash_drawer_sessions WHERE closed_at IS NULL').get() as any;
    if (active) return reply.code(409).send({ error: 'Drawer already open', session: active });
    const result = db.prepare('INSERT INTO cash_drawer_sessions (employee_id, starting_amount) VALUES (?, ?)')
      .run(req.body.employee_id || null, req.body.starting_amount);
    return db.prepare('SELECT * FROM cash_drawer_sessions WHERE id = ?').get(result.lastInsertRowid);
  });

  app.post<{ Body: { ending_amount: number; notes?: string } }>('/api/cash-drawer/close', (req, reply) => {
    const db = getDb();
    const active = db.prepare('SELECT * FROM cash_drawer_sessions WHERE closed_at IS NULL').get() as any;
    if (!active) return reply.code(400).send({ error: 'No open drawer' });

    const expected = active.starting_amount + active.cash_in - active.cash_out;
    const overShort = req.body.ending_amount - expected;

    db.prepare("UPDATE cash_drawer_sessions SET closed_at = datetime('now', 'localtime'), ending_amount = ?, expected_amount = ?, over_short = ?, notes = ? WHERE id = ?")
      .run(req.body.ending_amount, expected, overShort, req.body.notes || '', active.id);

    return db.prepare('SELECT * FROM cash_drawer_sessions WHERE id = ?').get(active.id);
  });

  app.get('/api/cash-drawer/current', () => {
    return getDb().prepare('SELECT * FROM cash_drawer_sessions WHERE closed_at IS NULL').get() || { status: 'closed' };
  });

  app.get('/api/cash-drawer/history', () => {
    return getDb().prepare('SELECT * FROM cash_drawer_sessions ORDER BY opened_at DESC LIMIT 30').all();
  });

  // Record cash transaction
  app.post<{ Body: { amount: number; type: 'in' | 'out' } }>('/api/cash-drawer/transaction', (req, reply) => {
    const db = getDb();
    const active = db.prepare('SELECT * FROM cash_drawer_sessions WHERE closed_at IS NULL').get() as any;
    if (!active) return reply.code(400).send({ error: 'No open drawer' });
    if (req.body.type === 'in') {
      db.prepare('UPDATE cash_drawer_sessions SET cash_in = cash_in + ? WHERE id = ?').run(req.body.amount, active.id);
    } else {
      db.prepare('UPDATE cash_drawer_sessions SET cash_out = cash_out + ? WHERE id = ?').run(req.body.amount, active.id);
    }
    return { ok: true };
  });

  // ============================================
  // 6. CUSTOMERS & LOYALTY
  // ============================================
  app.get('/api/customers', () => {
    return getDb().prepare('SELECT * FROM customers ORDER BY name LIMIT 500').all();
  });

  app.get<{ Querystring: { q: string } }>('/api/customers/search', (req) => {
    const q = `%${req.query.q}%`;
    return getDb().prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? LIMIT 20').all(q, q, q);
  });

  app.post<{ Body: { name: string; phone?: string; email?: string; birthday?: string } }>('/api/customers', (req) => {
    const db = getDb();
    const b = req.body;
    const result = db.prepare('INSERT INTO customers (name, phone, email, birthday) VALUES (?, ?, ?, ?)')
      .run(b.name, b.phone || '', b.email || '', b.birthday || '');
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: Record<string, any> }>('/api/customers/:id', (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id)) as any;
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const b = req.body;
    db.prepare('UPDATE customers SET name=?, phone=?, email=?, birthday=?, notes=?, points=? WHERE id=?')
      .run(b.name ?? existing.name, b.phone ?? existing.phone, b.email ?? existing.email,
        b.birthday ?? existing.birthday, b.notes ?? existing.notes, b.points ?? existing.points, req.params.id);
    return { ok: true };
  });

  // Add loyalty points
  app.post<{ Body: { customer_id: number; points: number; spent: number } }>('/api/customers/add-visit', (req) => {
    const db = getDb();
    db.prepare('UPDATE customers SET total_visits = total_visits + 1, total_spent = total_spent + ?, points = points + ? WHERE id = ?')
      .run(req.body.spent, req.body.points, req.body.customer_id);
    return { ok: true };
  });

  // ============================================
  // 7. INVENTORY
  // ============================================
  app.get('/api/inventory', () => {
    return getDb().prepare(`
      SELECT i.*, m.name as item_name, m.is_active, c.name as category_name
      FROM inventory i JOIN menu_items m ON i.menu_item_id = m.id
      JOIN categories c ON m.category_id = c.id
      ORDER BY c.sort_order, m.sort_order
    `).all();
  });

  app.put<{ Params: { menuItemId: string }; Body: { stock_count: number; low_stock_threshold?: number; auto_86?: boolean } }>(
    '/api/inventory/:menuItemId', (req) => {
      const db = getDb();
      const id = Number(req.params.menuItemId);
      db.prepare(
        'INSERT OR REPLACE INTO inventory (menu_item_id, stock_count, low_stock_threshold, auto_86) VALUES (?, ?, ?, ?)'
      ).run(id, req.body.stock_count, req.body.low_stock_threshold ?? 5, req.body.auto_86 !== false ? 1 : 0);

      // Auto-86 if stock is 0
      if (req.body.stock_count === 0 && req.body.auto_86 !== false) {
        db.prepare('UPDATE menu_items SET is_active = 0 WHERE id = ?').run(id);
        broadcastToAll({ type: 'MENU_UPDATED' });
      } else if (req.body.stock_count > 0) {
        db.prepare('UPDATE menu_items SET is_active = 1 WHERE id = ?').run(id);
        broadcastToAll({ type: 'MENU_UPDATED' });
      }

      return { ok: true };
    }
  );

  // Decrement stock (called when order is placed)
  app.post<{ Body: { menu_item_id: number; quantity: number } }>('/api/inventory/decrement', (req) => {
    const db = getDb();
    const inv = db.prepare('SELECT * FROM inventory WHERE menu_item_id = ?').get(req.body.menu_item_id) as any;
    if (!inv || inv.stock_count < 0) return { ok: true }; // -1 means unlimited

    const newCount = Math.max(0, inv.stock_count - req.body.quantity);
    db.prepare('UPDATE inventory SET stock_count = ? WHERE menu_item_id = ?').run(newCount, req.body.menu_item_id);

    if (newCount === 0 && inv.auto_86) {
      db.prepare('UPDATE menu_items SET is_active = 0 WHERE id = ?').run(req.body.menu_item_id);
      broadcastToAll({ type: 'MENU_UPDATED' });
    }

    return { ok: true, remaining: newCount };
  });

  // ============================================
  // 8. MENU SCHEDULES
  // ============================================
  app.get('/api/menu-schedules', () => {
    return getDb().prepare('SELECT * FROM menu_schedules ORDER BY start_time').all();
  });

  app.post<{ Body: Record<string, any> }>('/api/menu-schedules', (req) => {
    const db = getDb();
    const b = req.body;
    const result = db.prepare(
      'INSERT INTO menu_schedules (name, start_time, end_time, days, category_ids) VALUES (?, ?, ?, ?, ?)'
    ).run(b.name, b.start_time, b.end_time, b.days || 'mon,tue,wed,thu,fri,sat,sun', b.category_ids || '');
    return db.prepare('SELECT * FROM menu_schedules WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: Record<string, any> }>('/api/menu-schedules/:id', (req) => {
    const db = getDb();
    const b = req.body;
    db.prepare('UPDATE menu_schedules SET name=?, start_time=?, end_time=?, days=?, category_ids=?, is_active=? WHERE id=?')
      .run(b.name, b.start_time, b.end_time, b.days, b.category_ids, b.is_active ?? 1, req.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/menu-schedules/:id', (req) => {
    getDb().prepare('DELETE FROM menu_schedules WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  // Get currently active schedule
  app.get('/api/menu-schedules/current', () => {
    const db = getDb();
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const schedules = db.prepare('SELECT * FROM menu_schedules WHERE is_active = 1').all() as any[];
    return schedules.filter(s => {
      if (s.start_time && s.end_time && (time < s.start_time || time > s.end_time)) return false;
      if (s.days && !s.days.includes(day)) return false;
      return true;
    });
  });

  // ============================================
  // 9. RESERVATIONS
  // ============================================
  app.get<{ Querystring: { date?: string } }>('/api/reservations', (req) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    return getDb().prepare('SELECT * FROM reservations WHERE date = ? ORDER BY time ASC').all(date);
  });

  app.post<{ Body: Record<string, any> }>('/api/reservations', (req) => {
    const db = getDb();
    const b = req.body;
    const result = db.prepare(
      'INSERT INTO reservations (customer_name, phone, party_size, date, time, table_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(b.customer_name, b.phone || '', b.party_size || 2, b.date, b.time, b.table_number || '', b.notes || '');
    return db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: Record<string, any> }>('/api/reservations/:id', (req) => {
    const db = getDb();
    const b = req.body;
    db.prepare('UPDATE reservations SET customer_name=?, phone=?, party_size=?, date=?, time=?, table_number=?, status=?, notes=? WHERE id=?')
      .run(b.customer_name, b.phone, b.party_size, b.date, b.time, b.table_number, b.status, b.notes, req.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/reservations/:id', (req) => {
    getDb().prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  // ============================================
  // 10. GIFT CARDS
  // ============================================
  app.get('/api/gift-cards', () => {
    return getDb().prepare('SELECT * FROM gift_cards ORDER BY created_at DESC').all();
  });

  app.post<{ Body: { amount: number; customer_name?: string } }>('/api/gift-cards', (req, reply) => {
    if (!req.body.amount || req.body.amount <= 0) return reply.code(400).send({ error: 'Amount must be greater than 0' });
    const db = getDb();
    const code = 'GC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const result = db.prepare(
      'INSERT INTO gift_cards (code, balance, original_amount, customer_name) VALUES (?, ?, ?, ?)'
    ).run(code, req.body.amount, req.body.amount, req.body.customer_name || '');
    return db.prepare('SELECT * FROM gift_cards WHERE id = ?').get(result.lastInsertRowid);
  });

  app.get<{ Params: { code: string } }>('/api/gift-cards/:code', (req, reply) => {
    const card = getDb().prepare('SELECT * FROM gift_cards WHERE code = ? AND is_active = 1').get(req.params.code);
    if (!card) return reply.code(404).send({ error: 'Gift card not found' });
    return card;
  });

  app.post<{ Body: { code: string; amount: number } }>('/api/gift-cards/redeem', (req, reply) => {
    const db = getDb();
    const card = db.prepare('SELECT * FROM gift_cards WHERE code = ? AND is_active = 1').get(req.body.code) as any;
    if (!card) return reply.code(404).send({ error: 'Gift card not found' });
    if (card.balance < req.body.amount) return reply.code(400).send({ error: 'Insufficient balance', balance: card.balance });
    db.prepare('UPDATE gift_cards SET balance = balance - ? WHERE id = ?').run(req.body.amount, card.id);
    return { ok: true, remaining: card.balance - req.body.amount };
  });

  // ============================================
  // 11. SPLIT PAYMENTS
  // ============================================
  app.post<{ Body: { order_id: number; payments: { method: string; amount: number; guest_number?: number; reference?: string }[] } }>(
    '/api/split-payments', (req) => {
      const db = getDb();
      const insert = db.prepare('INSERT INTO split_payments (order_id, method, amount, guest_number, reference) VALUES (?, ?, ?, ?, ?)');
      for (const p of req.body.payments) {
        insert.run(req.body.order_id, p.method, p.amount, p.guest_number || 0, p.reference || '');
      }
      return { ok: true };
    }
  );

  app.get<{ Params: { orderId: string } }>('/api/split-payments/:orderId', (req) => {
    return getDb().prepare('SELECT * FROM split_payments WHERE order_id = ?').all(Number(req.params.orderId));
  });
}
