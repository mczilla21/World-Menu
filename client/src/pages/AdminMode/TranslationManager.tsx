import { useState, useEffect, useCallback } from 'react';
import { useSettings, LANGUAGE_OPTIONS } from '../../hooks/useSettings';
import { saveTranslations, autoTranslate } from '../../hooks/useTranslations';
import type { Category, MenuItem } from '../../hooks/useMenu';

interface ModifierGroup {
  id: number;
  category_id: number;
  name: string;
  selection_type: string;
  modifiers: { id: number; name: string; extra_price: number }[];
}

interface TranslationRow {
  entity_type: string;
  entity_id: number;
  field: string;
  lang: string;
  value: string;
}

interface Props {
  items: MenuItem[];
  categories: Category[];
}

export default function TranslationManager({ items, categories }: Props) {
  const { settings } = useSettings();
  const nativeLang = settings.native_language || 'en';
  const supported = settings.supported_languages.split(',').filter(l => l && l !== nativeLang);
  const nativeLangName = LANGUAGE_OPTIONS.find(l => l.code === nativeLang)?.name || nativeLang;

  const [translations, setTranslations] = useState<TranslationRow[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [dirty, setDirty] = useState<Map<string, string>>(new Map()); // key -> value
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null); // entity key being translated
  const [translatingAll, setTranslatingAll] = useState(false);
  const [section, setSection] = useState<'categories' | 'items' | 'modifiers'>('categories');

  const makeKey = (et: string, eid: number, field: string, lang: string) =>
    `${et}:${eid}:${field}:${lang}`;

  const fetchAll = useCallback(async () => {
    const [catT, itemT, modT, modGT, groupsRes] = await Promise.all([
      fetch('/api/translations/category').then(r => r.json()),
      fetch('/api/translations/menu_item').then(r => r.json()),
      fetch('/api/translations/modifier').then(r => r.json()),
      fetch('/api/translations/modifier_group').then(r => r.json()),
      fetch('/api/modifier-groups').then(r => r.json()),
    ]);
    setTranslations([...catT, ...itemT, ...modT, ...modGT]);
    setGroups(groupsRes);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getTranslation = (et: string, eid: number, field: string, lang: string): string => {
    const key = makeKey(et, eid, field, lang);
    if (dirty.has(key)) return dirty.get(key)!;
    const t = translations.find(
      tr => tr.entity_type === et && tr.entity_id === eid && tr.field === field && tr.lang === lang
    );
    return t?.value || '';
  };

  const setLocal = (et: string, eid: number, field: string, lang: string, value: string) => {
    const key = makeKey(et, eid, field, lang);
    setDirty(new Map(dirty).set(key, value));
  };

  const handleSave = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    const rows: TranslationRow[] = [];
    for (const [key, value] of dirty) {
      const [et, eid, field, lang] = key.split(':');
      rows.push({ entity_type: et, entity_id: Number(eid), field, lang, value });
    }
    await saveTranslations(rows);
    setDirty(new Map());
    await fetchAll();
    setSaving(false);
  };

  const handleAutoTranslate = async (entityType: string, entityId: number, nativeName: string, fields: string[] = ['name']) => {
    if (supported.length === 0) return;
    const key = `${entityType}:${entityId}`;
    setTranslating(key);

    for (const field of fields) {
      const text = field === 'name' ? nativeName :
        (entityType === 'menu_item' ? (items.find(i => i.id === entityId)?.description || '') : '');
      if (!text) continue;
      const result = await autoTranslate(text, nativeLang, supported);
      for (const [lang, translated] of Object.entries(result)) {
        if (translated && translated !== text) {
          setLocal(entityType, entityId, field, lang, translated);
        }
      }
    }
    setTranslating(null);
  };

  // Translate all entities and save directly (bypasses React state batching issues)
  const handleAutoTranslateAll = async () => {
    if (supported.length === 0) return;
    setTranslatingAll(true);

    const allRows: TranslationRow[] = [];

    const translateEntity = async (entityType: string, entityId: number, nativeName: string, fields: string[] = ['name']) => {
      for (const field of fields) {
        const text = field === 'name' ? nativeName :
          (entityType === 'menu_item' ? (items.find(i => i.id === entityId)?.description || '') : '');
        if (!text) continue;
        const result = await autoTranslate(text, nativeLang, supported);
        for (const [lang, translated] of Object.entries(result)) {
          if (translated && translated !== text) {
            allRows.push({ entity_type: entityType, entity_id: entityId, field, lang, value: translated });
          }
        }
      }
    };

    for (const cat of categories) {
      await translateEntity('category', cat.id, cat.name);
    }
    for (const item of items) {
      await translateEntity('menu_item', item.id, item.name, item.description ? ['name', 'description'] : ['name']);
    }
    for (const group of groups) {
      await translateEntity('modifier_group', group.id, group.name);
      for (const mod of group.modifiers) {
        await translateEntity('modifier', mod.id, mod.name);
      }
    }

    // Save directly to server
    if (allRows.length > 0) {
      await saveTranslations(allRows);
    }
    setDirty(new Map());
    await fetchAll();
    setTranslatingAll(false);
  };

  if (supported.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-5 text-center">
          <p className="text-yellow-300 font-medium mb-1">No translation languages configured</p>
          <p className="text-sm text-yellow-400/70">
            Go to <span className="font-bold text-yellow-300">Settings</span> and add supported languages
            beyond your native language ({nativeLangName}) to enable translations.
          </p>
        </div>
      </div>
    );
  }

  const langCols = supported.map(code => ({
    code,
    name: LANGUAGE_OPTIONS.find(l => l.code === code)?.name || code,
    flag: LANGUAGE_OPTIONS.find(l => l.code === code)?.flag || code.toUpperCase(),
  }));

  const renderRow = (entityType: string, entityId: number, nativeName: string, fields: string[] = ['name']) => {
    const isTranslating = translating === `${entityType}:${entityId}`;
    return (
      <div key={`${entityType}-${entityId}`} className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-white">{nativeName}</span>
            <span className="text-xs text-slate-500 ml-2">({nativeLangName})</span>
          </div>
          <button
            onClick={() => handleAutoTranslate(entityType, entityId, nativeName, fields)}
            disabled={isTranslating || translatingAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors shrink-0"
          >
            {isTranslating ? 'Translating...' : 'Auto-translate'}
          </button>
        </div>
        {fields.map(field => (
          <div key={field} className="space-y-1.5">
            {fields.length > 1 && (
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{field}</span>
            )}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(langCols.length, 3)}, 1fr)` }}>
              {langCols.map(lang => (
                <div key={lang.code} className="relative">
                  <span className="absolute top-1.5 left-2 text-[9px] font-bold text-slate-500 uppercase pointer-events-none z-10">
                    {lang.flag}
                  </span>
                  <input
                    value={getTranslation(entityType, entityId, field, lang.code)}
                    onChange={e => setLocal(entityType, entityId, field, lang.code, e.target.value)}
                    placeholder={`${lang.name}...`}
                    className="w-full bg-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-sm text-slate-200">Translation Management</h3>
        <p className="text-xs text-slate-400">
          Translate menu content from <span className="text-white font-medium">{nativeLangName}</span> to
          {' '}{langCols.map(l => l.name).join(', ')}.
          Auto-translate uses a free translation service — review and edit results for accuracy.
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['categories', 'items', 'modifiers'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                section === s ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s === 'categories' ? `Categories (${categories.length})` :
               s === 'items' ? `Items (${items.length})` :
               `Modifiers (${groups.length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoTranslateAll}
            disabled={translatingAll}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-700 hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {translatingAll ? 'Translating all...' : 'Translate All'}
          </button>
          <button
            onClick={handleSave}
            disabled={dirty.size === 0 || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving...' : `Save (${dirty.size})`}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {section === 'categories' && categories.map(cat =>
          renderRow('category', cat.id, cat.name)
        )}

        {section === 'items' && categories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id}>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 mt-2">{cat.name}</h4>
              <div className="space-y-3">
                {catItems.map(item =>
                  renderRow('menu_item', item.id, item.name, item.description ? ['name', 'description'] : ['name'])
                )}
              </div>
            </div>
          );
        })}

        {section === 'modifiers' && groups.map(group => (
          <div key={group.id}>
            <div className="mb-3">
              {renderRow('modifier_group', group.id, group.name)}
            </div>
            {group.modifiers.length > 0 && (
              <div className="ml-6 space-y-2">
                {group.modifiers.map(mod =>
                  renderRow('modifier', mod.id, mod.name)
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {dirty.size > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 shadow-xl shadow-green-600/20 transition-all"
          >
            {saving ? 'Saving...' : `Save ${dirty.size} translation${dirty.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
