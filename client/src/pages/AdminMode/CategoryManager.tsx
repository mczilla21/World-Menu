import { useState } from 'react';
import type { Category } from '../../hooks/useMenu';

interface Props {
  categories: Category[];
  onUpdate: () => void;
}

export default function CategoryManager({ categories, onUpdate }: Props) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), sort_order: categories.length }),
    });
    setName('');
    onUpdate();
  };

  const handleToggleKitchen = async (cat: Category) => {
    await fetch(`/api/categories/${cat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_in_kitchen: !cat.show_in_kitchen }),
    });
    onUpdate();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this category?')) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) alert(data.error);
    onUpdate();
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    onUpdate();
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-sm text-slate-200">How categories work</h3>
        <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
          <li>Categories are the <span className="text-white">tabs</span> servers see when building an order</li>
          <li>Names are in the restaurant's <span className="text-white">native language</span></li>
          <li>Translations for customers can be added via the translations system</li>
          <li><span className="text-green-400">Show in Kitchen</span> = orders appear on kitchen display</li>
        </ul>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Category name (native language)"
          className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-500 px-5 rounded-lg font-medium transition-colors">Add</button>
      </div>

      {categories.length === 0 && (
        <p className="text-center text-slate-500 py-6">No categories yet. Add one above to get started.</p>
      )}

      {categories.map((cat, i) => (
        <div key={cat.id} className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm font-mono w-6 text-center shrink-0">{i + 1}</span>

            {editingId === cat.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(cat.id)}
                  placeholder="Name"
                  className="flex-1 bg-slate-700 rounded px-3 py-1.5 text-white outline-none"
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(cat.id)} className="text-green-400 text-sm px-2">Save</button>
                <button onClick={() => setEditingId(null)} className="text-slate-400 text-sm px-2">Cancel</button>
              </div>
            ) : (
              <div
                className="flex-1 cursor-pointer hover:text-purple-300 transition-colors"
                onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
              >
                <span className="font-medium">{cat.name}</span>
              </div>
            )}

            <button
              onClick={() => handleToggleKitchen(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                cat.show_in_kitchen
                  ? 'bg-green-700 text-green-200 hover:bg-green-600'
                  : 'bg-slate-600 text-slate-400 hover:bg-slate-500'
              }`}
            >
              {cat.show_in_kitchen ? 'Kitchen' : 'Hidden'}
            </button>

            <button
              onClick={() => handleDelete(cat.id)}
              className="text-red-400 hover:text-red-300 text-sm px-2 transition-colors shrink-0"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
