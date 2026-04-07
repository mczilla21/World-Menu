import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

export function registerCategoryRoutes(app: FastifyInstance) {
  app.get('/api/categories', () => {
    return getDb().prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  });

  app.post<{ Body: { name: string; sort_order?: number; show_in_kitchen?: boolean } }>(
    '/api/categories',
    (req) => {
      const { name, sort_order = 0, show_in_kitchen = true } = req.body;
      const result = getDb()
        .prepare('INSERT INTO categories (name, sort_order, show_in_kitchen) VALUES (?, ?, ?)')
        .run(name, sort_order, show_in_kitchen ? 1 : 0);
      const category = getDb().prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return category;
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; sort_order?: number; show_in_kitchen?: boolean } }>(
    '/api/categories/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };

      const name = req.body.name ?? existing.name;
      const sort_order = req.body.sort_order ?? existing.sort_order;
      const show_in_kitchen = req.body.show_in_kitchen !== undefined
        ? (req.body.show_in_kitchen ? 1 : 0)
        : existing.show_in_kitchen;

      db.prepare('UPDATE categories SET name = ?, sort_order = ?, show_in_kitchen = ? WHERE id = ?')
        .run(name, sort_order, show_in_kitchen, req.params.id);

      broadcastToAll({ type: 'MENU_UPDATED' });
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    }
  );

  app.delete<{ Params: { id: string } }>('/api/categories/:id', (req, reply) => {
    const db = getDb();
    const items = db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?').get(Number(req.params.id)) as any;
    if (items.count > 0) {
      return reply.status(400).send({ error: 'Category has menu items. Remove them first.' });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    // Clean up translations
    db.prepare("DELETE FROM translations WHERE entity_type = 'category' AND entity_id = ?").run(req.params.id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });
}
