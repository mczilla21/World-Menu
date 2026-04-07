import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { broadcastToAll } from '../ws/broadcast.js';

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
        return db.prepare(
          'SELECT * FROM translations WHERE entity_type = ? AND lang = ?'
        ).all(entityType, lang);
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
}
