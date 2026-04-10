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
