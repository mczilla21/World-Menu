import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

function enrichItems(items: any[]) {
  const db = getDb();
  const variants = db.prepare('SELECT * FROM item_variants ORDER BY menu_item_id, sort_order, id').all() as any[];
  const allergens = db.prepare('SELECT * FROM item_allergens ORDER BY menu_item_id').all() as any[];

  const variantMap = new Map<number, any[]>();
  for (const v of variants) {
    if (!variantMap.has(v.menu_item_id)) variantMap.set(v.menu_item_id, []);
    variantMap.get(v.menu_item_id)!.push(v);
  }

  const allergenMap = new Map<number, string[]>();
  for (const a of allergens) {
    if (!allergenMap.has(a.menu_item_id)) allergenMap.set(a.menu_item_id, []);
    allergenMap.get(a.menu_item_id)!.push(a.allergen_code);
  }

  return items.map(item => ({
    ...item,
    variants: variantMap.get(item.id) || [],
    allergens: allergenMap.get(item.id) || [],
  }));
}

export function registerMenuRoutes(app: FastifyInstance) {
  app.get('/api/menu', () => {
    const items = getDb().prepare(`
      SELECT m.*, c.name as category_name, c.show_in_kitchen as category_show_in_kitchen
      FROM menu_items m
      JOIN categories c ON m.category_id = c.id
      ORDER BY c.sort_order, c.id, m.sort_order, m.id
    `).all();
    return enrichItems(items);
  });

  app.post<{ Body: {
    category_id: number; name: string; sort_order?: number; price?: number;
    description?: string; image?: string; tags?: string;
    is_popular?: boolean; prep_time_minutes?: number; is_special?: boolean;
    special_price?: number | null; serves?: string; is_alcohol?: boolean;
    ingredients?: string;
  } }>(
    '/api/menu',
    (req) => {
      const {
        category_id, name, sort_order = 0, price = 0, description = '', image = '', tags = '',
        is_popular = false, prep_time_minutes = 0, is_special = false,
        special_price = null, serves = '', is_alcohol = false, ingredients = '',
      } = req.body;
      const result = getDb()
        .prepare(`INSERT INTO menu_items (category_id, name, sort_order, price, description, image, tags,
          is_popular, prep_time_minutes, is_special, special_price, serves, is_alcohol, ingredients)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(category_id, name, sort_order, price, description, image, tags,
          is_popular ? 1 : 0, prep_time_minutes, is_special ? 1 : 0, special_price, serves, is_alcohol ? 1 : 0, ingredients);
      broadcastToAll({ type: 'MENU_UPDATED' });
      const item = getDb().prepare(`
        SELECT m.*, c.name as category_name, c.show_in_kitchen as category_show_in_kitchen
        FROM menu_items m JOIN categories c ON m.category_id = c.id WHERE m.id = ?
      `).get(result.lastInsertRowid);
      return enrichItems([item])[0];
    }
  );

  app.put<{ Params: { id: string }; Body: {
    name?: string; category_id?: number; is_active?: boolean; sort_order?: number;
    price?: number; description?: string; image?: string; tags?: string;
    is_popular?: boolean; prep_time_minutes?: number; is_special?: boolean;
    special_price?: number | null; serves?: string; is_alcohol?: boolean;
    ingredients?: string;
  } }>(
    '/api/menu/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };

      const b = req.body;
      const name = b.name ?? existing.name;
      const category_id = b.category_id ?? existing.category_id;
      const is_active = b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing.is_active;
      const sort_order = b.sort_order ?? existing.sort_order;
      const price = b.price ?? existing.price ?? 0;
      const description = b.description ?? existing.description;
      const image = b.image ?? existing.image;
      const tags = b.tags ?? existing.tags;
      const is_popular = b.is_popular !== undefined ? (b.is_popular ? 1 : 0) : existing.is_popular;
      const prep_time_minutes = b.prep_time_minutes ?? existing.prep_time_minutes;
      const is_special = b.is_special !== undefined ? (b.is_special ? 1 : 0) : existing.is_special;
      const special_price = b.special_price !== undefined ? b.special_price : existing.special_price;
      const serves = b.serves ?? existing.serves;
      const is_alcohol = b.is_alcohol !== undefined ? (b.is_alcohol ? 1 : 0) : existing.is_alcohol;
      const ingredients = b.ingredients ?? existing.ingredients ?? '';

      db.prepare(`UPDATE menu_items SET name=?, category_id=?, is_active=?, sort_order=?, price=?,
        description=?, image=?, tags=?, is_popular=?, prep_time_minutes=?, is_special=?,
        special_price=?, serves=?, is_alcohol=?, ingredients=? WHERE id=?`)
        .run(name, category_id, is_active, sort_order, price, description, image, tags,
          is_popular, prep_time_minutes, is_special, special_price, serves, is_alcohol, ingredients, req.params.id);

      broadcastToAll({ type: 'MENU_UPDATED' });
      const item = db.prepare(`
        SELECT m.*, c.name as category_name, c.show_in_kitchen as category_show_in_kitchen
        FROM menu_items m JOIN categories c ON m.category_id = c.id WHERE m.id = ?
      `).get(req.params.id);
      return enrichItems([item])[0];
    }
  );

  app.delete<{ Params: { id: string } }>('/api/menu/:id', (req) => {
    const db = getDb();
    const id = Number(req.params.id);
    db.prepare('DELETE FROM item_variants WHERE menu_item_id = ?').run(id);
    db.prepare('DELETE FROM item_allergens WHERE menu_item_id = ?').run(id);
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
    db.prepare("DELETE FROM translations WHERE entity_type IN ('menu_item','item_variant') AND entity_id = ?").run(id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });

  // === Item Variants ===
  app.get<{ Params: { id: string } }>('/api/menu/:id/variants', (req) => {
    return getDb().prepare('SELECT * FROM item_variants WHERE menu_item_id = ? ORDER BY sort_order, id')
      .all(Number(req.params.id));
  });

  app.post<{ Params: { id: string }; Body: { name: string; price: number; sort_order?: number } }>(
    '/api/menu/:id/variants',
    (req) => {
      const db = getDb();
      const { name, price, sort_order = 0 } = req.body;
      const result = db.prepare('INSERT INTO item_variants (menu_item_id, name, price, sort_order) VALUES (?, ?, ?, ?)')
        .run(Number(req.params.id), name, price, sort_order);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return db.prepare('SELECT * FROM item_variants WHERE id = ?').get(result.lastInsertRowid);
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; price?: number; sort_order?: number } }>(
    '/api/variants/:id',
    (req) => {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM item_variants WHERE id = ?').get(Number(req.params.id)) as any;
      if (!existing) return { error: 'Not found' };
      db.prepare('UPDATE item_variants SET name=?, price=?, sort_order=? WHERE id=?')
        .run(req.body.name ?? existing.name, req.body.price ?? existing.price,
          req.body.sort_order ?? existing.sort_order, req.params.id);
      broadcastToAll({ type: 'MENU_UPDATED' });
      return db.prepare('SELECT * FROM item_variants WHERE id = ?').get(req.params.id);
    }
  );

  app.delete<{ Params: { id: string } }>('/api/variants/:id', (req) => {
    const db = getDb();
    db.prepare('DELETE FROM item_variants WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM translations WHERE entity_type = 'item_variant' AND entity_id = ?").run(req.params.id);
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });

  // === Allergens ===
  app.put<{ Params: { id: string }; Body: { allergens: string[] } }>(
    '/api/menu/:id/allergens',
    (req) => {
      const db = getDb();
      const menuItemId = Number(req.params.id);
      db.prepare('DELETE FROM item_allergens WHERE menu_item_id = ?').run(menuItemId);
      const insert = db.prepare('INSERT INTO item_allergens (menu_item_id, allergen_code) VALUES (?, ?)');
      for (const code of req.body.allergens) {
        insert.run(menuItemId, code);
      }
      broadcastToAll({ type: 'MENU_UPDATED' });
      return { ok: true };
    }
  );
}
