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

  // === Menu Export ===
  app.get('/api/menu/export', () => {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all() as any[];

    const allItems = db.prepare(`
      SELECT m.* FROM menu_items m ORDER BY m.sort_order, m.id
    `).all() as any[];
    const allVariants = db.prepare('SELECT * FROM item_variants ORDER BY menu_item_id, sort_order, id').all() as any[];
    const allItemModGroups = db.prepare(
      `SELECT img.menu_item_id, mg.* FROM item_modifier_groups img
       JOIN modifier_groups mg ON mg.id = img.modifier_group_id
       ORDER BY img.menu_item_id, img.sort_order, mg.sort_order, mg.id`
    ).all() as any[];
    const allModifiers = db.prepare('SELECT * FROM modifiers ORDER BY group_id, sort_order, id').all() as any[];

    // Build lookup maps
    const variantMap = new Map<number, any[]>();
    for (const v of allVariants) {
      if (!variantMap.has(v.menu_item_id)) variantMap.set(v.menu_item_id, []);
      variantMap.get(v.menu_item_id)!.push({ name: v.name, price: v.price, sort_order: v.sort_order });
    }

    const modifierMap = new Map<number, any[]>();
    for (const m of allModifiers) {
      if (!modifierMap.has(m.group_id)) modifierMap.set(m.group_id, []);
      modifierMap.get(m.group_id)!.push({ name: m.name, extra_price: m.extra_price, default_on: m.default_on, sort_order: m.sort_order });
    }

    const itemModGroupMap = new Map<number, any[]>();
    for (const img of allItemModGroups) {
      if (!itemModGroupMap.has(img.menu_item_id)) itemModGroupMap.set(img.menu_item_id, []);
      itemModGroupMap.get(img.menu_item_id)!.push({
        name: img.name,
        selection_type: img.selection_type,
        required: img.required,
        sort_order: img.sort_order,
        modifiers: modifierMap.get(img.id) || [],
      });
    }

    // For items without item-level modifier group assignments, fall back to category-level
    const categoryModGroups = db.prepare('SELECT * FROM modifier_groups ORDER BY category_id, sort_order, id').all() as any[];
    const catModGroupMap = new Map<number, any[]>();
    for (const g of categoryModGroups) {
      if (!catModGroupMap.has(g.category_id)) catModGroupMap.set(g.category_id, []);
      catModGroupMap.get(g.category_id)!.push({
        name: g.name,
        selection_type: g.selection_type,
        required: g.required,
        sort_order: g.sort_order,
        modifiers: modifierMap.get(g.id) || [],
      });
    }

    const itemsByCat = new Map<number, any[]>();
    for (const item of allItems) {
      if (!itemsByCat.has(item.category_id)) itemsByCat.set(item.category_id, []);

      // Determine modifier groups: item-level if present, else category-level
      let modGroups = itemModGroupMap.get(item.id);
      if (!modGroups || modGroups.length === 0) {
        modGroups = catModGroupMap.get(item.category_id) || [];
      }

      itemsByCat.get(item.category_id)!.push({
        name: item.name,
        price: item.price,
        description: item.description || '',
        tags: item.tags || '',
        is_popular: item.is_popular || 0,
        is_special: item.is_special || 0,
        special_price: item.special_price ?? null,
        prep_time_minutes: item.prep_time_minutes || 0,
        serves: item.serves || '',
        is_alcohol: item.is_alcohol || 0,
        ingredients: item.ingredients || '',
        image: item.image || '',
        sort_order: item.sort_order || 0,
        variants: variantMap.get(item.id) || [],
        modifier_groups: modGroups,
      });
    }

    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      categories: categories.map(cat => ({
        name: cat.name,
        sort_order: cat.sort_order,
        show_in_kitchen: cat.show_in_kitchen,
        items: itemsByCat.get(cat.id) || [],
      })),
    };
  });

  // === Menu Import ===
  app.post<{ Body: {
    version?: string;
    categories: Array<{
      name: string;
      sort_order?: number;
      show_in_kitchen?: number;
      items?: Array<{
        name: string;
        price?: number;
        description?: string;
        tags?: string;
        is_popular?: number;
        is_special?: number;
        special_price?: number | null;
        prep_time_minutes?: number;
        serves?: string;
        is_alcohol?: number;
        ingredients?: string;
        image?: string;
        sort_order?: number;
        variants?: Array<{ name: string; price: number; sort_order?: number }>;
        modifier_groups?: Array<{
          name: string;
          selection_type?: string;
          required?: number;
          sort_order?: number;
          modifiers?: Array<{ name: string; extra_price?: number; default_on?: number; sort_order?: number }>;
        }>;
      }>;
    }>;
  } }>('/api/menu/import', (req) => {
    const db = getDb();
    const data = req.body;
    let categoriesCreated = 0;
    let itemsCreated = 0;
    let variantsCreated = 0;
    let modGroupsCreated = 0;
    let modifiersCreated = 0;

    for (const catData of data.categories) {
      // INSERT OR IGNORE category by name
      db.prepare('INSERT OR IGNORE INTO categories (name, sort_order, show_in_kitchen) VALUES (?, ?, ?)')
        .run(catData.name, catData.sort_order ?? 0, catData.show_in_kitchen ?? 1);
      const cat = db.prepare('SELECT * FROM categories WHERE name = ?').get(catData.name) as any;
      if (!cat) continue;
      categoriesCreated++;

      for (const itemData of (catData.items || [])) {
        // Skip if item with same name already exists in this category
        const existingItem = db.prepare('SELECT id FROM menu_items WHERE name = ? AND category_id = ?').get(itemData.name, cat.id) as any;
        if (existingItem) continue;

        const itemResult = db.prepare(
          `INSERT INTO menu_items (category_id, name, price, description, tags, is_popular, is_special,
           special_price, prep_time_minutes, serves, is_alcohol, ingredients, image, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          cat.id, itemData.name, itemData.price ?? 0, itemData.description ?? '',
          itemData.tags ?? '', itemData.is_popular ?? 0, itemData.is_special ?? 0,
          itemData.special_price ?? null, itemData.prep_time_minutes ?? 0,
          itemData.serves ?? '', itemData.is_alcohol ?? 0, itemData.ingredients ?? '',
          itemData.image ?? '', itemData.sort_order ?? 0
        );
        const itemId = Number(itemResult.lastInsertRowid);
        itemsCreated++;

        // Create variants
        for (const v of (itemData.variants || [])) {
          db.prepare('INSERT INTO item_variants (menu_item_id, name, price, sort_order) VALUES (?, ?, ?, ?)')
            .run(itemId, v.name, v.price, v.sort_order ?? 0);
          variantsCreated++;
        }

        // Create modifier groups and assign to item
        const assignedGroupIds: number[] = [];
        for (const mgData of (itemData.modifier_groups || [])) {
          // Check if group with same name exists for this category
          let group = db.prepare('SELECT * FROM modifier_groups WHERE name = ? AND category_id = ?').get(mgData.name, cat.id) as any;
          if (!group) {
            const mgResult = db.prepare(
              'INSERT INTO modifier_groups (category_id, name, selection_type, required, sort_order) VALUES (?, ?, ?, ?, ?)'
            ).run(cat.id, mgData.name, mgData.selection_type ?? 'single', mgData.required ?? 1, mgData.sort_order ?? 0);
            group = db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(mgResult.lastInsertRowid) as any;
            modGroupsCreated++;

            // Create modifiers for this new group
            for (const mod of (mgData.modifiers || [])) {
              db.prepare('INSERT INTO modifiers (group_id, name, extra_price, default_on, sort_order) VALUES (?, ?, ?, ?, ?)')
                .run(group.id, mod.name, mod.extra_price ?? 0, mod.default_on ?? 0, mod.sort_order ?? 0);
              modifiersCreated++;
            }
          }
          assignedGroupIds.push(group.id);
        }

        // Assign modifier groups to item
        if (assignedGroupIds.length > 0) {
          const insertAssign = db.prepare('INSERT OR IGNORE INTO item_modifier_groups (menu_item_id, modifier_group_id, sort_order) VALUES (?, ?, ?)');
          assignedGroupIds.forEach((gid, i) => insertAssign.run(itemId, gid, i));
        }
      }
    }
    broadcastToAll({ type: 'MENU_UPDATED' });

    return {
      ok: true,
      categories_processed: categoriesCreated,
      items_created: itemsCreated,
      variants_created: variantsCreated,
      modifier_groups_created: modGroupsCreated,
      modifiers_created: modifiersCreated,
    };
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
