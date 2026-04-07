import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

function getCombosWithSlots() {
  const db = getDb();
  const combos = db.prepare('SELECT * FROM combos ORDER BY sort_order, id').all() as any[];
  const slots = db.prepare(`
    SELECT cs.*, c.name as category_name
    FROM combo_slots cs
    JOIN categories c ON cs.category_id = c.id
    ORDER BY cs.combo_id, cs.sort_order, cs.id
  `).all() as any[];

  const slotMap = new Map<number, any[]>();
  for (const s of slots) {
    if (!slotMap.has(s.combo_id)) slotMap.set(s.combo_id, []);
    slotMap.get(s.combo_id)!.push(s);
  }

  return combos.map(c => ({ ...c, slots: slotMap.get(c.id) || [] }));
}

export function registerComboRoutes(app: FastifyInstance) {
  app.get('/api/combos', () => getCombosWithSlots());

  app.post<{ Body: { name: string; price: number; description?: string; image?: string; sort_order?: number } }>(
    '/api/combos',
    (req) => {
      const db = getDb();
      const { name, price, description = '', image = '', sort_order = 0 } = req.body;
      const result = db.prepare(
        'INSERT INTO combos (name, price, description, image, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(name, price, description, image, sort_order);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return { ...db.prepare('SELECT * FROM combos WHERE id = ?').get(result.lastInsertRowid), slots: [] };
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; price?: number; description?: string; image?: string; is_active?: boolean; sort_order?: number } }>(
    '/api/combos/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM combos WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };
      const b = req.body;
      db.prepare('UPDATE combos SET name=?, price=?, description=?, image=?, is_active=?, sort_order=? WHERE id=?')
        .run(
          b.name ?? existing.name, b.price ?? existing.price,
          b.description ?? existing.description, b.image ?? existing.image,
          b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing.is_active,
          b.sort_order ?? existing.sort_order, req.params.id
        );
      broadcastToAll({ type: 'MENU_UPDATED' });
      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>('/api/combos/:id', (req) => {
    const db = getDb();
    const id = Number(req.params.id);
    db.prepare('DELETE FROM combo_slots WHERE combo_id = ?').run(id);
    db.prepare('DELETE FROM combos WHERE id = ?').run(id);
    db.prepare("DELETE FROM translations WHERE entity_type IN ('combo','combo_slot') AND entity_id = ?").run(id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });

  // Combo slots
  app.post<{ Params: { id: string }; Body: { category_id: number; label: string; sort_order?: number } }>(
    '/api/combos/:id/slots',
    (req) => {
      const db = getDb();
      const { category_id, label, sort_order = 0 } = req.body;
      const result = db.prepare(
        'INSERT INTO combo_slots (combo_id, category_id, label, sort_order) VALUES (?, ?, ?, ?)'
      ).run(Number(req.params.id), category_id, label, sort_order);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return db.prepare('SELECT cs.*, c.name as category_name FROM combo_slots cs JOIN categories c ON cs.category_id = c.id WHERE cs.id = ?')
        .get(result.lastInsertRowid);
    }
  );

  app.put<{ Params: { id: string }; Body: { category_id?: number; label?: string; sort_order?: number } }>(
    '/api/combo-slots/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM combo_slots WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };
      db.prepare('UPDATE combo_slots SET category_id=?, label=?, sort_order=? WHERE id=?')
        .run(req.body.category_id ?? existing.category_id, req.body.label ?? existing.label,
          req.body.sort_order ?? existing.sort_order, req.params.id);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>('/api/combo-slots/:id', (req) => {
    getDb().prepare('DELETE FROM combo_slots WHERE id = ?').run(req.params.id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });
}
