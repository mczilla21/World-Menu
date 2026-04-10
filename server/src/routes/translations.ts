import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

// Track in-progress translations to avoid duplicates
const translatingLangs = new Set<string>();

async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text?.trim()) return '';
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${from}|${to}`)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json() as any;
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      }
    }
  } catch {}
  return '';
}

function triggerBackgroundTranslate(entityType: string, lang: string) {
  const key = `${entityType}:${lang}`;
  if (translatingLangs.has(key)) return;
  translatingLangs.add(key);

  const db = getDb();
  const nativeLang = (db.prepare("SELECT value FROM settings WHERE key = 'native_language'").get() as any)?.value || 'en';

  (async () => {
    try {
      const entities = entityType === 'menu_item'
        ? db.prepare('SELECT id, name, description FROM menu_items WHERE is_active = 1').all() as any[]
        : db.prepare('SELECT id, name FROM categories').all() as any[];

      const upsert = db.prepare(`
        INSERT INTO translations (entity_type, entity_id, field, lang, value)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(entity_type, entity_id, field, lang) DO UPDATE SET value = excluded.value
      `);

      console.log(`[Auto-translate] Translating ${entities.length} ${entityType}s to ${lang}...`);

      for (const entity of entities) {
        const translated = await translateText(entity.name, nativeLang, lang);
        if (translated) upsert.run(entityType, entity.id, 'name', lang, translated);
        await new Promise(r => setTimeout(r, 300));

        if (entityType === 'menu_item' && entity.description) {
          const descTranslated = await translateText(entity.description, nativeLang, lang);
          if (descTranslated) upsert.run(entityType, entity.id, 'description', lang, descTranslated);
          await new Promise(r => setTimeout(r, 300));
        }
      }

      console.log(`[Auto-translate] ${entityType} → ${lang} complete!`);
      broadcastToAll({ type: 'MENU_UPDATED' });
    } catch (e) {
      console.error(`[Auto-translate] Failed:`, e);
    } finally {
      translatingLangs.delete(key);
    }
  })();
}

export function registerTranslationRoutes(app: FastifyInstance) {
  // Get all translations for an entity
  app.get<{ Params: { entityType: string; entityId: string } }>(
    '/api/translations/:entityType/:entityId',
    (req) => {
      const db = getDb();
      return db.prepare(
        'SELECT * FROM translations WHERE entity_type = ? AND entity_id = ? ORDER BY field, lang'
      ).all(req.params.entityType, Number(req.params.entityId));
    }
  );

  // Get translations for multiple entities of a type (batch)
  app.get<{ Params: { entityType: string }; Querystring: { ids?: string; lang?: string } }>(
    '/api/translations/:entityType',
    (req) => {
      const db = getDb();
      const { entityType } = req.params;
      const lang = req.query.lang;
      const ids = req.query.ids;

      if (ids) {
        const idList = ids.split(',').map(Number).filter(n => !isNaN(n));
        if (idList.length === 0) return [];
        const placeholders = idList.map(() => '?').join(',');
        if (lang) {
          return db.prepare(
            `SELECT * FROM translations WHERE entity_type = ? AND entity_id IN (${placeholders}) AND lang = ?`
          ).all(entityType, ...idList, lang);
        }
        return db.prepare(
          `SELECT * FROM translations WHERE entity_type = ? AND entity_id IN (${placeholders})`
        ).all(entityType, ...idList);
      }

      if (lang) {
        const existing = db.prepare(
          'SELECT * FROM translations WHERE entity_type = ? AND lang = ?'
        ).all(entityType, lang);

        // If no translations exist for this language, trigger auto-translate in background
        if (existing.length === 0 && lang !== 'en') {
          triggerBackgroundTranslate(entityType, lang);
        }

        return existing;
      }

      return db.prepare(
        'SELECT * FROM translations WHERE entity_type = ? ORDER BY entity_id, field, lang'
      ).all(entityType);
    }
  );

  // Batch upsert translations
  app.put<{
    Body: Array<{ entity_type: string; entity_id: number; field: string; lang: string; value: string }>;
  }>('/api/translations', (req) => {
    const db = getDb();
    const upsert = db.prepare(`
      INSERT INTO translations (entity_type, entity_id, field, lang, value)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id, field, lang) DO UPDATE SET value = excluded.value
    `);
    for (const t of req.body) {
      if (t.value.trim()) {
        upsert.run(t.entity_type, t.entity_id, t.field, t.lang, t.value.trim());
      } else {
        // Delete empty translations
        db.prepare(
          'DELETE FROM translations WHERE entity_type = ? AND entity_id = ? AND field = ? AND lang = ?'
        ).run(t.entity_type, t.entity_id, t.field, t.lang);
      }
    }
    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true };
  });

  // Auto-translate endpoint using MyMemory (free, no API key needed)
  app.post<{
    Body: { text: string; from: string; to: string[] };
  }>('/api/translate', async (req) => {
    const { text, from, to } = req.body;
    const results: Record<string, string> = {};

    for (const targetLang of to) {
      if (targetLang === from) {
        results[targetLang] = text;
        continue;
      }
      try {
        const langPair = `${from}|${targetLang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json() as any;
          if (data.responseStatus === 200 && data.responseData?.translatedText) {
            const translated = data.responseData.translatedText;
            // MyMemory returns UPPERCASE sometimes for short strings; fix that
            if (text[0] === text[0].toLowerCase() && translated[0] !== translated[0].toLowerCase()) {
              results[targetLang] = translated[0].toLowerCase() + translated.slice(1);
            } else {
              results[targetLang] = translated;
            }
            continue;
          }
        }
      } catch {}

      // Fallback: return original text
      results[targetLang] = text;
    }

    return results;
  });

  // Bulk auto-translate entire menu to a target language
  app.post<{ Body: { target_lang: string } }>('/api/translations/auto-translate', async (req, reply) => {
    const { target_lang } = req.body;
    if (!target_lang) return reply.code(400).send({ error: 'target_lang required' });

    const db = getDb();
    const nativeLang = (db.prepare("SELECT value FROM settings WHERE key = 'native_language'").get() as any)?.value || 'en';
    if (target_lang === nativeLang) return { ok: true, translated: 0, message: 'Target is same as native language' };

    // Get all menu items and categories
    const items = db.prepare('SELECT id, name, description FROM menu_items').all() as any[];
    const categories = db.prepare('SELECT id, name FROM categories').all() as any[];

    const upsert = db.prepare(`
      INSERT INTO translations (entity_type, entity_id, field, lang, value)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id, field, lang) DO UPDATE SET value = excluded.value
    `);

    let translated = 0;
    const errors: string[] = [];

    // Translate helper
    async function translateText(text: string): Promise<string> {
      if (!text || !text.trim()) return '';
      try {
        const langPair = `${nativeLang}|${target_lang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json() as any;
          if (data.responseStatus === 200 && data.responseData?.translatedText) {
            return data.responseData.translatedText;
          }
        }
      } catch {}
      return '';
    }

    // Translate categories
    for (const cat of categories) {
      const existing = db.prepare("SELECT value FROM translations WHERE entity_type='category' AND entity_id=? AND field='name' AND lang=?").get(cat.id, target_lang) as any;
      if (!existing?.value) {
        const result = await translateText(cat.name);
        if (result) {
          upsert.run('category', cat.id, 'name', target_lang, result);
          translated++;
        }
        // Rate limit: 1 req per 500ms for free API
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Translate menu items (name + description)
    for (const item of items) {
      // Name
      const existingName = db.prepare("SELECT value FROM translations WHERE entity_type='menu_item' AND entity_id=? AND field='name' AND lang=?").get(item.id, target_lang) as any;
      if (!existingName?.value) {
        const result = await translateText(item.name);
        if (result) {
          upsert.run('menu_item', item.id, 'name', target_lang, result);
          translated++;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // Description
      if (item.description) {
        const existingDesc = db.prepare("SELECT value FROM translations WHERE entity_type='menu_item' AND entity_id=? AND field='description' AND lang=?").get(item.id, target_lang) as any;
        if (!existingDesc?.value) {
          const result = await translateText(item.description);
          if (result) {
            upsert.run('menu_item', item.id, 'description', target_lang, result);
            translated++;
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    broadcastToAll({ type: 'MENU_UPDATED' });
    return { ok: true, translated, total_items: items.length, total_categories: categories.length };
  });
}
