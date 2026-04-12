import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from './useLanguage';
import { useSettings } from './useSettings';

interface TranslationMap {
  [entityId: number]: { name?: string; description?: string };
}

// Global refresh trigger — incremented when TRANSLATIONS_UPDATED arrives
let translationRefreshKey = 0;
const translationListeners = new Set<() => void>();

// Listen for WebSocket translation updates (called once from any component)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data?.type === 'TRANSLATIONS_UPDATED') {
        translationRefreshKey++;
        translationListeners.forEach(fn => fn());
      }
    } catch {}
  });
}

/**
 * Fetches menu item and category translations for the current display language.
 * Returns helpers to get translated names — falls back to the original name.
 */
export function useMenuTranslations() {
  const { lang } = useLanguage();
  const { settings } = useSettings();
  const nativeLang = settings.native_language || 'en';
  const [itemTranslations, setItemTranslations] = useState<TranslationMap>({});
  const [catTranslations, setCatTranslations] = useState<TranslationMap>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for translation updates
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    translationListeners.add(handler);
    return () => { translationListeners.delete(handler); };
  }, []);

  // Only fetch translations if display language differs from native
  const needsTranslation = lang && lang !== nativeLang && lang !== 'en';

  useEffect(() => {
    if (!needsTranslation) {
      setItemTranslations({});
      setCatTranslations({});
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      try {
        const [itemRes, catRes] = await Promise.all([
          fetch(`/api/translations/menu_item?lang=${lang}`),
          fetch(`/api/translations/category?lang=${lang}`),
        ]);
        if (cancelled) return;
        const items = await itemRes.json();
        const cats = await catRes.json();
        if (cancelled) return;

        const iMap: TranslationMap = {};
        for (const t of items) {
          if (!iMap[t.entity_id]) iMap[t.entity_id] = {};
          iMap[t.entity_id][t.field as 'name' | 'description'] = t.value;
        }

        const cMap: TranslationMap = {};
        for (const t of cats) {
          if (!cMap[t.entity_id]) cMap[t.entity_id] = {};
          cMap[t.entity_id][t.field as 'name'] = t.value;
        }

        setItemTranslations(iMap);
        setCatTranslations(cMap);

        // If translations came back empty, server is translating in background — retry
        if (items.length === 0 && cats.length === 0) {
          timers.push(setTimeout(() => { if (!cancelled) setRefreshKey(k => k + 1); }, 5000));
          timers.push(setTimeout(() => { if (!cancelled) setRefreshKey(k => k + 1); }, 15000));
          timers.push(setTimeout(() => { if (!cancelled) setRefreshKey(k => k + 1); }, 30000));
        }
      } catch {
        if (!cancelled) { setItemTranslations({}); setCatTranslations({}); }
      }
    })();

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [lang, needsTranslation, refreshKey]);

  const itemName = useCallback((id: number, fallback: string) => {
    return itemTranslations[id]?.name || fallback;
  }, [itemTranslations]);

  const itemDesc = useCallback((id: number, fallback: string) => {
    return itemTranslations[id]?.description || fallback;
  }, [itemTranslations]);

  const catName = useCallback((id: number, fallback: string) => {
    return catTranslations[id]?.name || fallback;
  }, [catTranslations]);

  return { itemName, itemDesc, catName, lang, needsTranslation: !!needsTranslation };
}
