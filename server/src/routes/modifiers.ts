import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

export function registerModifierRoutes(app: FastifyInstance) {
  // Get modifier groups for a category (fallback if no item-specific ones)
  app.get<{ Params: { categoryId: string } }>('/api/categories/:categoryId/modifier-groups', (req) => {
    const db = getDb();
    const groups = db.prepare('SELECT * FROM modifier_groups WHERE category_id = ? ORDER BY sort_order, id').all(Number(req.params.categoryId)) as any[];
    for (const group of groups) {
      group.modifiers = db.prepare('SELECT * FROM modifiers WHERE group_id = ? ORDER BY sort_order, id').all(group.id);
    }
    return groups;
  });

  // Get modifier groups for a SPECIFIC item (check item-level first, fall back to category)
  app.get<{ Params: { itemId: string } }>('/api/menu/:itemId/modifier-groups', (req) => {
    const db = getDb();
    const itemId = Number(req.params.itemId);

    // Check for item-specific assignments
    let itemGroups: any[] = [];
    try {
      itemGroups = db.prepare(
        `SELECT mg.* FROM modifier_groups mg
         JOIN item_modifier_groups img ON mg.id = img.modifier_group_id
         WHERE img.menu_item_id = ?
         ORDER BY img.sort_order, mg.sort_order, mg.id`
      ).all(itemId) as any[];
    } catch {}

    if (itemGroups.length > 0) {
      for (const group of itemGroups) {
        group.modifiers = db.prepare('SELECT * FROM modifiers WHERE group_id = ? ORDER BY sort_order, id').all(group.id);
      }
      return itemGroups;
    }

    // Fall back to category-level
    const item = db.prepare('SELECT category_id FROM menu_items WHERE id = ?').get(itemId) as any;
    if (!item) return [];
    const groups = db.prepare('SELECT * FROM modifier_groups WHERE category_id = ? ORDER BY sort_order, id').all(item.category_id) as any[];
    for (const group of groups) {
      group.modifiers = db.prepare('SELECT * FROM modifiers WHERE group_id = ? ORDER BY sort_order, id').all(group.id);
    }
    return groups;
  });

  // Assign modifier groups to a specific item
  app.put<{ Params: { itemId: string }; Body: { group_ids: number[] } }>('/api/menu/:itemId/modifier-groups', (req) => {
    const db = getDb();
    const itemId = Number(req.params.itemId);
    try {
      db.prepare('DELETE FROM item_modifier_groups WHERE menu_item_id = ?').run(itemId);
      const insert = db.prepare('INSERT INTO item_modifier_groups (menu_item_id, modifier_group_id, sort_order) VALUES (?, ?, ?)');
      req.body.group_ids.forEach((gid, i) => insert.run(itemId, gid, i));
    } catch {}
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });

  // Get which items a modifier group is assigned to
  app.get<{ Params: { groupId: string } }>('/api/modifier-groups/:groupId/items', (req) => {
    const db = getDb();
    try {
      return db.prepare('SELECT menu_item_id FROM item_modifier_groups WHERE modifier_group_id = ?').all(Number(req.params.groupId));
    } catch { return []; }
  });

  app.get('/api/modifier-groups', () => {
    const db = getDb();
    const groups = db.prepare('SELECT * FROM modifier_groups ORDER BY category_id, sort_order, id').all() as any[];
    for (const group of groups) {
      group.modifiers = db.prepare('SELECT * FROM modifiers WHERE group_id = ? ORDER BY sort_order, id').all(group.id);
    }
    return groups;
  });

  app.post<{ Body: { category_id: number; name: string; selection_type?: string; required?: boolean; sort_order?: number } }>(
    '/api/modifier-groups',
    (req) => {
      const { category_id, name, selection_type = 'single', required = true, sort_order = 0 } = req.body;
      const result = getDb()
        .prepare('INSERT INTO modifier_groups (category_id, name, selection_type, required, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(category_id, name, selection_type, required ? 1 : 0, sort_order);
      broadcastToAll({ type: 'MENU_UPDATED' });
      const group = getDb().prepare('SELECT * FROM modifier_groups WHERE id = ?').get(result.lastInsertRowid) as any;
      group.modifiers = [];
      return group;
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; selection_type?: string; required?: boolean; sort_order?: number } }>(
    '/api/modifier-groups/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };
      const name = req.body.name ?? existing.name;
      const selection_type = req.body.selection_type ?? existing.selection_type;
      const required = req.body.required !== undefined ? (req.body.required ? 1 : 0) : existing.required;
      const sort_order = req.body.sort_order ?? existing.sort_order;
      db.prepare('UPDATE modifier_groups SET name = ?, selection_type = ?, required = ?, sort_order = ? WHERE id = ?')
        .run(name, selection_type, required, sort_order, req.params.id);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(req.params.id);
    }
  );

  app.delete<{ Params: { id: string } }>('/api/modifier-groups/:id', (req) => {
    const db = getDb();
    db.prepare('DELETE FROM modifiers WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM translations WHERE entity_type = 'modifier_group' AND entity_id = ?").run(req.params.id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });

  app.post<{ Body: { group_id: number; name: string; extra_price?: number; default_on?: boolean; sort_order?: number } }>(
    '/api/modifiers',
    (req) => {
      const { group_id, name, extra_price = 0, default_on = false, sort_order = 0 } = req.body;
      const result = getDb()
        .prepare('INSERT INTO modifiers (group_id, name, extra_price, default_on, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(group_id, name, extra_price, default_on ? 1 : 0, sort_order);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return getDb().prepare('SELECT * FROM modifiers WHERE id = ?').get(result.lastInsertRowid);
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; extra_price?: number; default_on?: boolean; sort_order?: number } }>(
    '/api/modifiers/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM modifiers WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };
      const name = req.body.name ?? existing.name;
      const extra_price = req.body.extra_price ?? existing.extra_price;
      const default_on = req.body.default_on !== undefined ? (req.body.default_on ? 1 : 0) : existing.default_on;
      const sort_order = req.body.sort_order ?? existing.sort_order;
      db.prepare('UPDATE modifiers SET name = ?, extra_price = ?, default_on = ?, sort_order = ? WHERE id = ?')
        .run(name, extra_price, default_on, sort_order, req.params.id);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return db.prepare('SELECT * FROM modifiers WHERE id = ?').get(req.params.id);
    }
  );

  app.delete<{ Params: { id: string } }>('/api/modifiers/:id', (req) => {
    const db = getDb();
    db.prepare('DELETE FROM modifiers WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM translations WHERE entity_type = 'modifier' AND entity_id = ?").run(req.params.id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });
}
