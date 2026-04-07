import { useState } from 'react';
import type { Combo, Category } from '../../hooks/useMenu';
import { useSettings } from '../../hooks/useSettings';

interface Props {
  combos: Combo[];
  categories: Category[];
  onUpdate: () => void;
}

export default function ComboManager({ combos, categories, onUpdate }: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  // Slot add
  const [slotCatId, setSlotCatId] = useState<number>(categories[0]?.id ?? 0);
  const [slotLabel, setSlotLabel] = useState('');
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  const handleCreate = async () => {
    if (!name.trim()) return;
    await fetch('/api/combos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), price: parseFloat(price) || 0, description: description.trim() }),
    });
    setName('');
    setPrice('');
    setDescription('');
    onUpdate();
  };

  const handleSaveEdit = async (id: number) => {
    await fetch(`/api/combos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), price: parseFloat(editPrice) || 0, description: editDesc.trim() }),
    });
    setEditingId(null);
    onUpdate();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this combo?')) return;
    await fetch(`/api/combos/${id}`, { method: 'DELETE' });
    onUpdate();
  };

  const handleToggle = async (combo: Combo) => {
    await fetch(`/api/combos/${combo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: combo.is_active ? 0 : 1 }),
    });
    onUpdate();
  };

  const addSlot = async (comboId: number) => {
    if (!slotLabel.trim() || !slotCatId) return;
    await fetch(`/api/combos/${comboId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: slotCatId, label: slotLabel.trim() }),
    });
    setSlotLabel('');
    onUpdate();
  };

  const deleteSlot = async (slotId: number) => {
    await fetch(`/api/combo-slots/${slotId}`, { method: 'DELETE' });
    onUpdate();
  };

  const handleImageUpload = async (comboId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.filename) {
        await fetch(`/api/combos/${comboId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: data.filename }),
        });
        onUpdate();
      }
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-sm text-slate-200">Combo Meals</h3>
        <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
          <li>Create combo meals that bundle items from different categories</li>
          <li>Each "slot" lets the customer pick one item from a category</li>
          <li>Example: "Lunch Combo" with slots for Main, Side, and Drink</li>
        </ul>
      </div>

      {/* Create new combo */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Combo name"
            className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            type="number"
            step="0.01"
            className="w-24 bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-500 px-5 rounded-lg font-medium transition-colors">Add</button>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Combo list */}
      {combos.length === 0 && (
        <p className="text-slate-600 text-sm text-center py-4">No combos yet — create one above</p>
      )}

      {combos.map(combo => (
        <div key={combo.id} className={`bg-slate-800 rounded-xl p-4 space-y-3 ${!combo.is_active ? 'opacity-40' : ''}`}>
          {editingId === combo.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="flex-1 bg-slate-700 rounded px-3 py-1.5 text-white outline-none" autoFocus />
                <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Price" type="number" step="0.01" className="w-20 bg-slate-700 rounded px-3 py-1.5 text-white outline-none" />
              </div>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="w-full bg-slate-700 rounded px-3 py-1.5 text-white outline-none" />
              <div className="flex gap-2">
                <button onClick={() => handleSaveEdit(combo.id)} className="text-green-400 text-sm px-2">Save</button>
                <button onClick={() => setEditingId(null)} className="text-slate-400 text-sm px-2">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {/* Image */}
              <div className="relative shrink-0">
                {combo.image ? (
                  <img src={`/uploads/${combo.image}`} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-2xl">
                    &#127860;
                  </div>
                )}
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleImageUpload(combo.id, file);
                    };
                    input.click();
                  }}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]"
                >
                  +
                </button>
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingId(combo.id); setEditName(combo.name); setEditPrice(String(combo.price)); setEditDesc(combo.description || ''); }}>
                <div className="font-medium">{combo.name}</div>
                <div className="text-green-400 text-sm">{currency}{combo.price.toFixed(2)}</div>
                {combo.description && <div className="text-xs text-slate-500 truncate">{combo.description}</div>}
              </div>
              <button onClick={() => handleToggle(combo)} className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 ${combo.is_active ? 'bg-green-700 text-green-200' : 'bg-red-800 text-red-300'}`}>
                {combo.is_active ? 'Active' : 'Off'}
              </button>
              <button onClick={() => handleDelete(combo.id)} className="text-red-400 hover:text-red-300 text-sm shrink-0">Delete</button>
            </div>
          )}

          {/* Slots */}
          <div className="border-t border-slate-700 pt-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Slots ({combo.slots?.length || 0})
            </div>
            {combo.slots?.map((slot, idx) => (
              <div key={slot.id} className="flex items-center gap-2 py-1.5">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                <span className="text-sm text-white flex-1">{slot.label}</span>
                <span className="text-xs text-slate-500">from: {slot.category_name || `Cat #${slot.category_id}`}</span>
                <button onClick={() => deleteSlot(slot.id)} className="text-red-400 hover:text-red-300 text-xs">&#10005;</button>
              </div>
            ))}
            {/* Add slot */}
            <div className="flex gap-2 mt-2">
              <select
                value={slotCatId}
                onChange={(e) => setSlotCatId(Number(e.target.value))}
                className="bg-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                placeholder="Slot label (e.g. Pick a Side)"
                className="flex-1 bg-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none"
              />
              <button
                onClick={() => addSlot(combo.id)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
              >
                Add Slot
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
