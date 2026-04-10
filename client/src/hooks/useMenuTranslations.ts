import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from './useLanguage';
import { useSettings } from './useSettings';

interface TranslationMap {
  [entityId: number]: { name?: string; description?: string };
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

  // Only fetch translations if display language differs from native
  const needsTranslation = lang && lang !== nativeLang && lang !== 'en';

  useEffect(() => {
    if (!needsTranslation) {
      setItemTranslations({});
      setCatTranslations({});
      return;
    }

    (async () => {
      try {
        const [itemRes, catRes] = await Promise.all([
          fetch(`/api/translations/menu_item?lang=${lang}`),
          fetch(`/api/translations/category?lang=${lang}`),
        ]);
        const items = await itemRes.json();
        const cats = await catRes.json();

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
      } catch {
        setItemTranslations({});
        setCatTranslations({});
      }
    })();
  }, [lang, needsTranslation]);

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
