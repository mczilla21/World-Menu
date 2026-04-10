import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { getDb } from '../db/connection.js';
import { runBackupNow, listBackups, downloadBackup } from '../cloud-backup.js';

export function registerBackupRoutes(app: FastifyInstance) {
  // Download database backup
  app.get('/api/backup/download', (req, reply) => {
    const dbPath = config.dbPath;
    if (!fs.existsSync(dbPath)) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    // Force WAL checkpoint to ensure all data is in main db file
    try {
      getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {}

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `worldmenu-backup-${timestamp}.db`;

    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(dbPath);
    return reply.send(stream);
  });

  // Download full backup (db + uploads as JSON manifest)
  app.get('/api/backup/full', (req, reply) => {
    const db = getDb();

    // Force checkpoint
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}

    // Get all data — safely handle missing tables
    const safeAll = (sql: string) => { try { return db.prepare(sql).all(); } catch { return []; } };
    const settings = safeAll('SELECT * FROM settings');
    const categories = safeAll('SELECT * FROM categories');
    const menuItems = safeAll('SELECT * FROM menu_items');
    const variants = safeAll('SELECT * FROM item_variants');
    const allergens = safeAll('SELECT * FROM item_allergens');
    const modGroups = safeAll('SELECT * FROM modifier_groups');
    const modOptions = safeAll('SELECT * FROM modifier_options');
    const translations = safeAll('SELECT * FROM translations');
    const dailyLogs = safeAll('SELECT * FROM daily_logs');

    const backup = {
      version: 1,
      created_at: new Date().toISOString(),
      settings,
      categories,
      menu_items: menuItems,
      item_variants: variants,
      item_allergens: allergens,
      modifier_groups: modGroups,
      modifier_options: modOptions,
      translations,
      daily_logs: dailyLogs,
    };

    const timestamp = new Date().toISOString().slice(0, 10);
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="worldmenu-backup-${timestamp}.json"`);
    return reply.send(JSON.stringify(backup, null, 2));
  });

  // Restore from JSON backup
  app.post('/api/backup/restore', async (req) => {
    const body = req.body as any;
    if (!body || !body.version || !body.categories) {
      return { error: 'Invalid backup file' };
    }

    const db = getDb();

    try {
      db.exec('BEGIN');

      // Clear existing data (order of operations matters for FK)
      db.exec('DELETE FROM translations');
      db.exec('DELETE FROM item_allergens');
      db.exec('DELETE FROM item_variants');
      db.exec('DELETE FROM modifier_options');
      db.exec('DELETE FROM modifier_groups');
      db.exec('DELETE FROM menu_items');
      db.exec('DELETE FROM categories');
      db.exec('DELETE FROM settings');

      // Restore settings
      const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const s of body.settings || []) {
        insertSetting.run(s.key, s.value);
      }

      // Restore categories
      const insertCat = db.prepare('INSERT INTO categories (id, name, sort_order, show_in_kitchen) VALUES (?, ?, ?, ?)');
      for (const c of body.categories || []) {
        insertCat.run(c.id, c.name, c.sort_order, c.show_in_kitchen);
      }

      // Restore menu items
      const insertItem = db.prepare(
        `INSERT INTO menu_items (id, category_id, name, sort_order, price, description, image, tags, is_active,
         is_popular, prep_time_minutes, is_special, special_price, serves, is_alcohol, ingredients)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const i of body.menu_items || []) {
        insertItem.run(i.id, i.category_id, i.name, i.sort_order, i.price, i.description, i.image, i.tags,
          i.is_active, i.is_popular, i.prep_time_minutes, i.is_special, i.special_price, i.serves, i.is_alcohol, i.ingredients || '');
      }

      // Restore variants
      const insertVariant = db.prepare('INSERT INTO item_variants (id, menu_item_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const v of body.item_variants || []) {
        insertVariant.run(v.id, v.menu_item_id, v.name, v.price, v.sort_order);
      }

      // Restore allergens
      const insertAllergen = db.prepare('INSERT INTO item_allergens (menu_item_id, allergen_code) VALUES (?, ?)');
      for (const a of body.item_allergens || []) {
        insertAllergen.run(a.menu_item_id, a.allergen_code);
      }

      // Restore modifier groups
      const insertMG = db.prepare('INSERT INTO modifier_groups (id, category_id, name, required, multi_select, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
      for (const g of body.modifier_groups || []) {
        insertMG.run(g.id, g.category_id, g.name, g.required, g.multi_select, g.sort_order);
      }

      // Restore modifier options
      const insertMO = db.prepare('INSERT INTO modifier_options (id, group_id, name, price_adjustment, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const o of body.modifier_options || []) {
        insertMO.run(o.id, o.group_id, o.name, o.price_adjustment, o.sort_order);
      }

      // Restore translations
      const insertTrans = db.prepare('INSERT INTO translations (entity_type, entity_id, field, lang, value) VALUES (?, ?, ?, ?, ?)');
      for (const t of body.translations || []) {
        insertTrans.run(t.entity_type, t.entity_id, t.field, t.lang, t.value);
      }

      // Restore daily logs
      if (body.daily_logs) {
        const insertLog = db.prepare('INSERT OR REPLACE INTO daily_logs (id, date, order_count, item_count, total_revenue, top_items) VALUES (?, ?, ?, ?, ?, ?)');
        for (const l of body.daily_logs) {
          insertLog.run(l.id, l.date, l.order_count, l.item_count, l.total_revenue, l.top_items);
        }
      }

      db.exec('COMMIT');
      return { ok: true, message: 'Backup restored successfully' };
    } catch (e: any) {
      db.exec('ROLLBACK');
      return { error: e.message || 'Restore failed' };
    }
  });

  // Cloud backup — manual trigger
  app.post('/api/backup/cloud', async () => {
    return runBackupNow();
  });

  // List cloud backups
  app.get('/api/backup/cloud/list', async () => {
    return listBackups();
  });

  // Restore from cloud backup
  app.post<{ Body: { file: string } }>('/api/backup/cloud/restore', async (req) => {
    const data = await downloadBackup(req.body.file);
    if (!data) return { error: 'Backup not found' };
    try {
      const backup = JSON.parse(data);
      // Reuse the existing restore logic by injecting into the restore endpoint
      const db = getDb();
      db.exec('BEGIN');

      const safeExec = (sql: string) => { try { db.exec(sql); } catch {} };
      safeExec('DELETE FROM translations');
      safeExec('DELETE FROM item_allergens');
      safeExec('DELETE FROM item_variants');
      safeExec('DELETE FROM modifier_options');
      safeExec('DELETE FROM modifier_groups');
      safeExec('DELETE FROM menu_items');
      safeExec('DELETE FROM categories');

      // Restore each table from the backup
      for (const [table, rows] of Object.entries(backup)) {
        if (table === 'sqlite_sequence') continue;
        for (const row of rows as any[]) {
          const cols = Object.keys(row);
          const placeholders = cols.map(() => '?').join(',');
          try {
            db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).run(...cols.map(c => (row as any)[c]));
          } catch {}
        }
      }

      db.exec('COMMIT');
      return { ok: true, message: 'Cloud backup restored' };
    } catch (e: any) {
      return { error: e.message || 'Restore failed' };
    }
  });
}
