import { useState, useEffect, useCallback } from 'react';

export interface Translation {
  id: number;
  entity_type: string;
  entity_id: number;
  field: string;
  lang: string;
  value: string;
}

export function useTranslations(entityType: string, lang?: string) {
  const [translations, setTranslations] = useState<Translation[]>([]);

  const fetchTranslations = useCallback(async () => {
    try {
      const url = lang
        ? `/api/translations/${entityType}?lang=${lang}`
        : `/api/translations/${entityType}`;
      const res = await fetch(url);
      setTranslations(await res.json());
    } catch (e) {
      console.error('Failed to fetch translations:', e);
    }
  }, [entityType, lang]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const getTranslation = useCallback(
    (entityId: number, field: string, langCode?: string): string | undefined => {
      const t = translations.find(
        (t) => t.entity_id === entityId && t.field === field && (langCode ? t.lang === langCode : true)
      );
      return t?.value;
    },
    [translations]
  );

  const getTranslatedName = useCallback(
    (entityId: number, langCode: string): string | undefined => {
      return getTranslation(entityId, 'name', langCode);
    },
    [getTranslation]
  );

  return { translations, fetchTranslations, getTranslation, getTranslatedName };
}

export async function saveTranslations(
  items: Array<{ entity_type: string; entity_id: number; field: string; lang: string; value: string }>
) {
  await fetch('/api/translations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });
}

export async function autoTranslate(text: string, from: string, to: string[]): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to }),
    });
    return await res.json();
  } catch {
    return {};
  }
}
