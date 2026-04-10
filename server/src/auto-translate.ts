import { getDb } from './db/connection.js';
import { broadcastToAll } from './ws/broadcast.js';

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

function getTranslationLangs(): { nativeLang: string; langs: string[] } {
  const db = getDb();
  const nativeLang = (db.prepare("SELECT value FROM settings WHERE key = 'native_language'").get() as any)?.value || 'en';
  const supported = (db.prepare("SELECT value FROM settings WHERE key = 'supported_languages'").get() as any)?.value || '';
  const langs = supported.split(',').filter((l: string) => l && l !== nativeLang);
  return { nativeLang, langs };
}

export async function autoTranslateItem(itemId: number, name: string, description: string) {
  const { nativeLang, langs } = getTranslationLangs();
  if (langs.length === 0) return;

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO translations (entity_type, entity_id, field, lang, value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id, field, lang) DO UPDATE SET value = excluded.value
  `);

  for (const lang of langs) {
    const translated = await translateText(name, nativeLang, lang);
    if (translated) upsert.run('menu_item', itemId, 'name', lang, translated);
    await new Promise(r => setTimeout(r, 300));

    if (description) {
      const descTranslated = await translateText(description, nativeLang, lang);
      if (descTranslated) upsert.run('menu_item', itemId, 'description', lang, descTranslated);
      await new Promise(r => setTimeout(r, 300));
    }
  }
  broadcastToAll({ type: 'MENU_UPDATED' });
}

export async function autoTranslateCategory(catId: number, name: string) {
  const { nativeLang, langs } = getTranslationLangs();
  if (langs.length === 0) return;

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO translations (entity_type, entity_id, field, lang, value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id, field, lang) DO UPDATE SET value = excluded.value
  `);

  for (const lang of langs) {
    const translated = await translateText(name, nativeLang, lang);
    if (translated) upsert.run('category', catId, 'name', lang, translated);
    await new Promise(r => setTimeout(r, 300));
  }
}

/** Auto-translate entire menu on startup if translations are empty */
export async function autoTranslateMenuIfEmpty() {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM translations').get() as any)?.c || 0;
  if (count > 0) return; // Already has translations

  const items = db.prepare('SELECT id, name, description FROM menu_items WHERE is_active = 1').all() as any[];
  const cats = db.prepare('SELECT id, name FROM categories').all() as any[];
  if (items.length === 0) return;

  const { nativeLang, langs } = getTranslationLangs();
  // On startup, translate to top 10 languages to keep it fast
  const topLangs = langs.slice(0, 10);
  if (topLangs.length === 0) return;

  console.log(`[Auto-translate] No translations found. Translating ${items.length} items + ${cats.length} categories to ${topLangs.length} languages...`);

  const upsert = db.prepare(`
    INSERT INTO translations (entity_type, entity_id, field, lang, value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id, field, lang) DO UPDATE SET value = excluded.value
  `);

  for (const cat of cats) {
    for (const lang of topLangs) {
      const translated = await translateText(cat.name, nativeLang, lang);
      if (translated) upsert.run('category', cat.id, 'name', lang, translated);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  for (const item of items) {
    for (const lang of topLangs) {
      const translated = await translateText(item.name, nativeLang, lang);
      if (translated) upsert.run('menu_item', item.id, 'name', lang, translated);
      await new Promise(r => setTimeout(r, 300));

      if (item.description) {
        const descTranslated = await translateText(item.description, nativeLang, lang);
        if (descTranslated) upsert.run('menu_item', item.id, 'description', lang, descTranslated);
        await new Promise(r => setTimeout(r, 300));
      }
    }
    console.log(`[Auto-translate] ${item.name} done`);
  }

  console.log('[Auto-translate] Startup translation complete!');
  broadcastToAll({ type: 'MENU_UPDATED' });
}
