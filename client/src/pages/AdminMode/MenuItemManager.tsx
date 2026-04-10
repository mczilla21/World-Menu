import { useState, useEffect, useRef } from 'react';
import type { MenuItem, Category, ItemVariant } from '../../hooks/useMenu';
import { useSettings } from '../../hooks/useSettings';
import { ALLERGENS } from '../../constants/allergens';

interface Props {
  items: MenuItem[];
  categories: Category[];
  onUpdate: () => void;
}

export default function MenuItemManager({ items, categories, onUpdate }: Props) {
  const [name, setName] = useState('');
  const [catId, setCatId] = useState<number>(categories[0]?.id ?? 0);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  // v2 edit fields
  const [editPopular, setEditPopular] = useState(false);
  const [editSpecial, setEditSpecial] = useState(false);
  const [editSpecialPrice, setEditSpecialPrice] = useState('');
  const [editAlcohol, setEditAlcohol] = useState(false);
  const [editPrepTime, setEditPrepTime] = useState('');
  const [editServes, setEditServes] = useState('');
  const [editAllergens, setEditAllergens] = useState<Set<string>>(new Set());
  const [editIngredients, setEditIngredients] = useState('');
  // Variants
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [showVariants, setShowVariants] = useState(false);

  // Modifier group assignment
  const [allModifierGroups, setAllModifierGroups] = useState<{ id: number; name: string; category_id: number; selection_type: string; required: number; modifiers: { id: number; name: string; extra_price: number; default_on: number }[] }[]>([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState<Set<number>>(new Set());
  const [modGroupsLoading, setModGroupsLoading] = useState(false);
  const [modGroupsSaving, setModGroupsSaving] = useState(false);
  // Inline modifier creation
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('single');
  const [addingModToGroup, setAddingModToGroup] = useState<number | null>(null);
  const [newModName, setNewModName] = useState('');
  const [newModPrice, setNewModPrice] = useState('');

  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  const handleExport = async () => {
    try {
      const res = await fetch('/api/menu/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch('/api/menu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.ok) {
        onUpdate();
      } else {
        console.error('Import failed:', result);
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    setImporting(false);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!name.trim() || !catId) return;
    await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: catId, name: name.trim(), price: parseFloat(price) || 0, description: description.trim(), tags: tags.trim() }),
    });
    setName('');
    setPrice('');
    setDescription('');
    setTags('');
    onUpdate();
  };

  const handleToggle86 = async (item: MenuItem) => {
    await fetch(`/api/menu/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    onUpdate();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this menu item?')) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    onUpdate();
  };

  const startEdit = async (item: MenuItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price || 0));
    setEditDescription(item.description || '');
    setEditTags(item.tags || '');
    setEditPopular(!!item.is_popular);
    setEditSpecial(!!item.is_special);
    setEditSpecialPrice(item.special_price != null ? String(item.special_price) : '');
    setEditAlcohol(!!item.is_alcohol);
    setEditPrepTime(item.prep_time_minutes ? String(item.prep_time_minutes) : '');
    setEditServes(item.serves || '');
    setEditAllergens(new Set(item.allergens || []));
    setEditIngredients(item.ingredients || '');
    setVariants(item.variants || []);
    setShowVariants((item.variants?.length || 0) > 0);
    setNewVariantName('');
    setNewVariantPrice('');

    // Load modifier groups and current assignments
    setModGroupsLoading(true);
    try {
      const [allRes, assignedRes] = await Promise.all([
        fetch('/api/modifier-groups'),
        fetch(`/api/menu/${item.id}/modifier-groups`),
      ]);
      const allGroups = await allRes.json();
      const assignedGroups = await assignedRes.json();
      setAllModifierGroups(allGroups);
      setAssignedGroupIds(new Set(assignedGroups.map((g: { id: number }) => g.id)));
    } catch (e) {
      console.error('Failed to load modifier groups:', e);
      setAllModifierGroups([]);
      setAssignedGroupIds(new Set());
    }
    setModGroupsLoading(false);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    await fetch(`/api/menu/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        price: parseFloat(editPrice) || 0,
        description: editDescription.trim(),
        tags: editTags.trim(),
        is_popular: editPopular ? 1 : 0,
        is_special: editSpecial ? 1 : 0,
        special_price: editSpecial && editSpecialPrice ? parseFloat(editSpecialPrice) : null,
        is_alcohol: editAlcohol ? 1 : 0,
        prep_time_minutes: parseInt(editPrepTime) || 0,
        serves: editServes.trim(),
        ingredients: editIngredients.trim(),
      }),
    });
    // Save allergens
    await fetch(`/api/menu/${id}/allergens`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allergens: [...editAllergens] }),
    });
    setEditingId(null);
    onUpdate();
  };

  const toggleModifierGroup = (groupId: number) => {
    setAssignedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const saveModifierGroups = async (itemId: number) => {
    setModGroupsSaving(true);
    try {
      await fetch(`/api/menu/${itemId}/modifier-groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_ids: [...assignedGroupIds] }),
      });
    } catch (e) {
      console.error('Failed to save modifier groups:', e);
    }
    setModGroupsSaving(false);
  };

  // Variant CRUD
  const addVariant = async (itemId: number) => {
    if (!newVariantName.trim()) return;
    const res = await fetch(`/api/menu/${itemId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newVariantName.trim(), price: parseFloat(newVariantPrice) || 0 }),
    });
    if (res.ok) {
      const variant = await res.json();
      setVariants([...variants, variant]);
      setNewVariantName('');
      setNewVariantPrice('');
      onUpdate();
    }
  };

  const deleteVariant = async (variantId: number) => {
    await fetch(`/api/variants/${variantId}`, { method: 'DELETE' });
    setVariants(variants.filter(v => v.id !== variantId));
    onUpdate();
  };

  const handleImageUpload = async (itemId: number, file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.filename) {
        await fetch(`/api/menu/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: data.filename }),
        });
        onUpdate();
      }
    } catch (e) {
      console.error('Upload failed:', e);
    }
    setUploading(false);
  };

  const grouped = categories.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category_id === cat.id),
  }));

  const tagOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Spicy', 'Nuts', 'Dairy', 'Seafood', 'Halal'];

  const toggleAllergen = (code: string) => {
    const next = new Set(editAllergens);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setEditAllergens(next);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-sm text-slate-200">Menu items</h3>
        <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
          <li>Names are in the restaurant's <span className="text-white">native language</span> (what the kitchen sees)</li>
          <li>Tap an item to edit details, add sizes/variants, allergens, and more</li>
          <li>Upload photos by clicking the camera icon on each item</li>
        </ul>
      </div>

      {/* Import / Export */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          Export Menu
        </button>
        <button
          onClick={() => importFileRef.current?.click()}
          disabled={importing}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import Menu'}
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
          }}
        />
      </div>

      {/* Add new */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={catId}
            onChange={(e) => setCatId(Number(e.target.value))}
            className="bg-slate-800 rounded-lg px-3 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Item name (native language)"
            className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-500 px-5 rounded-lg font-medium transition-colors">Add</button>
        </div>
        <div className="flex gap-2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Price"
            type="number"
            step="0.01"
            min="0"
            className="w-24 bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.id}>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">{group.name}</h3>
            {!group.show_in_kitchen && <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded">hidden from kitchen</span>}
            <span className="text-xs text-slate-600">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
          </div>
          {group.items.length === 0 && <p className="text-slate-600 text-sm mb-2 pl-1">No items in this category yet</p>}
          <div className="space-y-2">
            {group.items.map((item) => (
              <div key={item.id} className={`bg-slate-800 rounded-xl p-3 transition-opacity ${!item.is_active ? 'opacity-40' : ''}`}>
                {editingId === item.id ? (
                  <div className="space-y-3">
                    {/* Name + Price */}
                    <div className="flex gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                        placeholder="Name"
                        className="flex-1 bg-slate-700 rounded px-3 py-1.5 text-white outline-none"
                        autoFocus
                      />
                      <input
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="Price"
                        type="number"
                        step="0.01"
                        className="w-20 bg-slate-700 rounded px-3 py-1.5 text-white outline-none"
                      />
                    </div>

                    {/* Description */}
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      className="w-full bg-slate-700 rounded px-3 py-1.5 text-white outline-none"
                    />

                    {/* Toggle badges row */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setEditPopular(!editPopular)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          editPopular ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        <span>&#11088;</span> Popular
                      </button>
                      <button
                        onClick={() => setEditSpecial(!editSpecial)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          editSpecial ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        <span>&#127991;&#65039;</span> Special
                      </button>
                      <button
                        onClick={() => setEditAlcohol(!editAlcohol)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          editAlcohol ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        <span>&#127863;</span> Alcohol
                      </button>
                    </div>

                    {/* Special price (when special toggled) */}
                    {editSpecial && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Special price:</label>
                        <input
                          value={editSpecialPrice}
                          onChange={(e) => setEditSpecialPrice(e.target.value)}
                          placeholder="Sale price"
                          type="number"
                          step="0.01"
                          className="w-28 bg-slate-700 rounded px-3 py-1.5 text-white outline-none"
                        />
                      </div>
                    )}

                    {/* Prep time + Serves */}
                    <div className="flex gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 whitespace-nowrap">Prep time:</label>
                        <input
                          value={editPrepTime}
                          onChange={(e) => setEditPrepTime(e.target.value)}
                          placeholder="min"
                          type="number"
                          min="0"
                          className="w-16 bg-slate-700 rounded px-2 py-1.5 text-white outline-none text-sm"
                        />
                        <span className="text-xs text-slate-500">min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Serves:</label>
                        <input
                          value={editServes}
                          onChange={(e) => setEditServes(e.target.value)}
                          placeholder="e.g. 2-3"
                          className="w-20 bg-slate-700 rounded px-2 py-1.5 text-white outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1 block">Ingredients (comma-separated)</label>
                      <input
                        value={editIngredients}
                        onChange={(e) => setEditIngredients(e.target.value)}
                        placeholder="e.g. rice noodles, bean sprouts, egg, peanuts, lime"
                        className="w-full bg-slate-700 rounded px-2.5 py-2 text-white outline-none text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Customers can long-press items to see ingredients</p>
                    </div>

                    {/* Dietary tags */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1 block">Dietary tags</label>
                      <div className="flex flex-wrap gap-1.5">
                        {tagOptions.map(tag => {
                          const isOn = editTags.split(',').map(t => t.trim()).includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                const current = editTags.split(',').map(t => t.trim()).filter(Boolean);
                                if (isOn) {
                                  setEditTags(current.filter(t => t !== tag).join(','));
                                } else {
                                  setEditTags([...current, tag].join(','));
                                }
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                isOn ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-400'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Allergens */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1 block">Allergens</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ALLERGENS.map(a => {
                          const isOn = editAllergens.has(a.code);
                          return (
                            <button
                              key={a.code}
                              onClick={() => toggleAllergen(a.code)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                isOn ? 'bg-orange-600 text-white' : 'bg-slate-600 text-slate-400'
                              }`}
                            >
                              {a.icon} {a.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Variants / Sizes */}
                    <div>
                      <button
                        onClick={() => setShowVariants(!showVariants)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium mb-2"
                      >
                        {showVariants ? '- Hide Sizes/Variants' : '+ Sizes/Variants'}
                      </button>
                      {showVariants && (
                        <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                          {variants.length > 0 && (
                            <p className="text-[10px] text-slate-500">When variants exist, base price is ignored — each variant has its own price.</p>
                          )}
                          {variants.map(v => (
                            <div key={v.id} className="flex items-center gap-2">
                              <span className="text-sm text-white flex-1">{v.name}</span>
                              <span className="text-sm text-green-400">{currency}{v.price.toFixed(2)}</span>
                              <button onClick={() => deleteVariant(v.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <input
                              value={newVariantName}
                              onChange={(e) => setNewVariantName(e.target.value)}
                              placeholder="Name (e.g. Large)"
                              className="flex-1 bg-slate-600 rounded px-2 py-1.5 text-sm text-white outline-none"
                            />
                            <input
                              value={newVariantPrice}
                              onChange={(e) => setNewVariantPrice(e.target.value)}
                              placeholder="Price"
                              type="number"
                              step="0.01"
                              className="w-20 bg-slate-600 rounded px-2 py-1.5 text-sm text-white outline-none"
                            />
                            <button
                              onClick={() => addVariant(item.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Customizations — inline modifier group management */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2 block">Customizations</label>
                      {modGroupsLoading ? (
                        <p className="text-xs text-slate-500">Loading...</p>
                      ) : (
                        <div className="space-y-2">
                          {/* Assigned groups with their options */}
                          {allModifierGroups.filter(g => assignedGroupIds.has(g.id)).map(group => (
                            <div key={group.id} className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-purple-300">{group.name}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">{group.selection_type}</span>
                                </div>
                                <button onClick={() => { toggleModifierGroup(group.id); saveModifierGroups(item.id); }} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                              </div>
                              {/* Options list */}
                              <div className="space-y-1 mb-2">
                                {(group.modifiers || []).map(mod => (
                                  <div key={mod.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-800/50">
                                    <span className="text-slate-300">{mod.name}</span>
                                    <div className="flex items-center gap-2">
                                      {mod.extra_price > 0 && <span className="text-slate-500">+{currency}{mod.extra_price.toFixed(2)}</span>}
                                      <button onClick={async () => { await fetch(`/api/modifiers/${mod.id}`, { method: 'DELETE' }); startEdit(item); }} className="text-red-500 hover:text-red-400 text-[10px]">✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* Add option inline */}
                              {addingModToGroup === group.id ? (
                                <div className="flex gap-1">
                                  <input value={newModName} onChange={e => setNewModName(e.target.value)} placeholder="Option name" className="flex-1 bg-slate-700 rounded px-2 py-1 text-white text-xs outline-none" />
                                  <input value={newModPrice} onChange={e => setNewModPrice(e.target.value)} placeholder="$" type="number" className="w-14 bg-slate-700 rounded px-2 py-1 text-white text-xs outline-none" />
                                  <button onClick={async () => {
                                    if (!newModName.trim()) return;
                                    await fetch('/api/modifiers', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ group_id: group.id, name: newModName.trim(), extra_price: parseFloat(newModPrice) || 0 }) });
                                    setNewModName(''); setNewModPrice(''); setAddingModToGroup(null); startEdit(item);
                                  }} className="px-2 py-1 bg-purple-600 rounded text-[10px] font-bold text-white">Add</button>
                                  <button onClick={() => setAddingModToGroup(null)} className="px-2 py-1 bg-slate-700 rounded text-[10px] text-slate-400">✕</button>
                                </div>
                              ) : (
                                <button onClick={() => { setAddingModToGroup(group.id); setNewModName(''); setNewModPrice(''); }} className="text-[10px] text-purple-400 hover:text-purple-300 font-medium">+ Add option</button>
                              )}
                            </div>
                          ))}

                          {/* Unassigned groups (collapsed, checkboxes) */}
                          {allModifierGroups.filter(g => !assignedGroupIds.has(g.id)).length > 0 && (
                            <div className="rounded-lg p-2" style={{ background: 'rgba(51,65,85,0.3)' }}>
                              <span className="text-[10px] text-slate-500 block mb-1">Available groups:</span>
                              <div className="flex flex-wrap gap-1">
                                {allModifierGroups.filter(g => !assignedGroupIds.has(g.id)).map(group => (
                                  <button key={group.id} onClick={() => { toggleModifierGroup(group.id); setTimeout(() => saveModifierGroups(item.id), 100); }}
                                    className="px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300">
                                    + {group.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Create new group inline */}
                          <div className="flex gap-1 items-center">
                            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="New group name" className="flex-1 bg-slate-700 rounded px-2 py-1.5 text-white text-xs outline-none" />
                            <select value={newGroupType} onChange={e => setNewGroupType(e.target.value)} className="bg-slate-700 rounded px-2 py-1.5 text-white text-xs outline-none">
                              <option value="single">Pick One</option>
                              <option value="multi">Pick Many</option>
                              <option value="toggle">On/Off</option>
                            </select>
                            <button onClick={async () => {
                              if (!newGroupName.trim()) return;
                              const res = await fetch('/api/modifier-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ category_id: item.category_id, name: newGroupName.trim(), selection_type: newGroupType }) });
                              const created = await res.json();
                              if (created.id) {
                                setNewGroupName('');
                                // Auto-assign to this item
                                const newIds = [...assignedGroupIds, created.id];
                                setAssignedGroupIds(new Set(newIds));
                                await fetch(`/api/menu/${item.id}/modifier-groups`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ group_ids: newIds }) });
                                startEdit(item);
                              }
                            }} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white whitespace-nowrap">+ Create</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Save/Cancel */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleSaveEdit(item.id)} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Image thumbnail / upload */}
                    <div className="relative shrink-0">
                      {item.image ? (
                        <img src={`/uploads/${item.image}`} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 text-lg">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.setAttribute('capture', 'environment');
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleImageUpload(item.id, file);
                          };
                          input.click();
                        }}
                        disabled={uploading}
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]"
                      >
                        +
                      </button>
                    </div>

                    <div
                      className="flex-1 cursor-pointer hover:text-purple-300 transition-colors min-w-0"
                      onClick={() => startEdit(item)}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{item.name}</span>
                        {item.is_popular ? <span className="text-[10px]" title="Popular">&#11088;</span> : null}
                        {item.is_special ? <span className="text-[10px]" title="Special">&#127991;&#65039;</span> : null}
                        {item.is_alcohol ? <span className="text-[10px]" title="Alcohol">&#127863;</span> : null}
                      </div>
                      {item.price > 0 && <span className="text-green-400 text-sm">{currency}{item.price.toFixed(2)}</span>}
                      {item.variants && item.variants.length > 0 && (
                        <span className="text-blue-400 text-xs ml-1">({item.variants.length} sizes)</span>
                      )}
                      {item.description && <div className="text-xs text-slate-500 truncate">{item.description}</div>}
                      {item.tags && (
                        <div className="flex gap-1 mt-1">
                          {item.tags.split(',').filter(Boolean).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{tag.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggle86(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                        item.is_active
                          ? 'bg-green-700 text-green-200 hover:bg-green-600'
                          : 'bg-red-800 text-red-300 hover:bg-red-700'
                      }`}
                    >
                      {item.is_active ? 'Active' : "86'd"}
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 transition-colors shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
