import { useState, useEffect } from 'react';
import type { Category } from '../../hooks/useMenu';

interface Modifier {
  id: number;
  group_id: number;
  name: string;
  extra_price: number;
  default_on: number;
  sort_order: number;
}

interface ModifierGroup {
  id: number;
  category_id: number;
  name: string;
  selection_type: string;
  required: number;
  sort_order: number;
  modifiers: Modifier[];
}

interface Props {
  categories: Category[];
}

const typeInfo: Record<string, { label: string; desc: string; color: string }> = {
  single: { label: 'Pick One', desc: 'Customer picks exactly one option', color: 'bg-blue-700 text-blue-200' },
  multi: { label: 'Pick Many', desc: 'Customer picks one or more options', color: 'bg-purple-700 text-purple-200' },
  toggle: { label: 'On/Off Toggles', desc: 'All start ON, customer unchecks to remove', color: 'bg-green-700 text-green-200' },
};

export default function ModifierManager({ categories }: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [selectedCat, setSelectedCat] = useState<number>(categories[0]?.id ?? 0);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('multi');
  const [newModName, setNewModName] = useState('');
  const [newModPrice, setNewModPrice] = useState('0');
  const [newModDefault, setNewModDefault] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null);

  const fetchGroups = async () => {
    const res = await fetch('/api/modifier-groups');
    setGroups(await res.json());
  };

  useEffect(() => { fetchGroups(); }, []);

  const catGroups = groups.filter(g => g.category_id === selectedCat);
  const selectedCatName = categories.find(c => c.id === selectedCat)?.name || '';

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    await fetch('/api/modifier-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: selectedCat, name: newGroupName.trim(), selection_type: newGroupType, sort_order: catGroups.length }),
    });
    setNewGroupName('');
    fetchGroups();
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('Delete this step and all its options?')) return;
    await fetch(`/api/modifier-groups/${id}`, { method: 'DELETE' });
    fetchGroups();
  };

  const handleChangeType = async (group: ModifierGroup, newType: string) => {
    await fetch(`/api/modifier-groups/${group.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selection_type: newType }),
    });
    fetchGroups();
  };

  const handleToggleRequired = async (group: ModifierGroup) => {
    await fetch(`/api/modifier-groups/${group.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ required: !group.required }),
    });
    fetchGroups();
  };

  const handleAddModifier = async (groupId: number) => {
    if (!newModName.trim()) return;
    await fetch('/api/modifiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, name: newModName.trim(), extra_price: parseFloat(newModPrice) || 0, default_on: newModDefault }),
    });
    setNewModName('');
    setNewModPrice('0');
    setNewModDefault(false);
    setAddingToGroup(null);
    fetchGroups();
  };

  const handleDeleteModifier = async (id: number) => {
    await fetch(`/api/modifiers/${id}`, { method: 'DELETE' });
    fetchGroups();
  };

  const handleToggleDefault = async (mod: Modifier) => {
    await fetch(`/api/modifiers/${mod.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_on: !mod.default_on }),
    });
    fetchGroups();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm text-slate-200">How item builder steps work</h3>
        <p className="text-xs text-slate-400">
          Builder steps turn a simple tap into a guided customization flow. When a server taps an item
          from a category that has builder steps, they'll walk through each step in order.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(typeInfo).map(([key, info]) => (
            <div key={key} className="bg-slate-900/50 rounded-lg p-2.5">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${info.color}`}>{info.label}</span>
              <p className="text-xs text-slate-500 leading-relaxed">{info.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category picker */}
      <div>
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Select a category to configure</label>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(c => {
            const groupCount = groups.filter(g => g.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCat === c.id ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {c.name}
                {groupCount > 0 && <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{groupCount}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {catGroups.length === 0 ? (
        <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-400 font-medium mb-1">No builder steps for "{selectedCatName}"</p>
          <p className="text-sm text-slate-500">Items will be added with a single tap. Add steps below to enable customization.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          When a server taps a <span className="text-white font-medium">{selectedCatName}</span> item, they'll walk through {catGroups.length} step{catGroups.length !== 1 ? 's' : ''}:
        </p>
      )}

      {catGroups.map((group, gi) => {
        const info = typeInfo[group.selection_type] || typeInfo.multi;
        return (
          <div key={group.id} className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-700">
              <span className="bg-slate-600 text-slate-200 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{gi + 1}</span>
              <div className="flex-1">
                <span className="font-bold">{group.name}</span>
              </div>
              <select
                value={group.selection_type}
                onChange={(e) => handleChangeType(group, e.target.value)}
                className={`px-2 py-1 rounded text-xs font-medium outline-none cursor-pointer ${info.color}`}
              >
                <option value="single">Pick One</option>
                <option value="multi">Pick Many</option>
                <option value="toggle">On/Off Toggles</option>
              </select>
              <button
                onClick={() => handleToggleRequired(group)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  group.required ? 'bg-yellow-700 text-yellow-200' : 'bg-slate-600 text-slate-400'
                }`}
              >
                {group.required ? 'Required' : 'Optional'}
              </button>
              <button onClick={() => handleDeleteGroup(group.id)} className="text-red-400 hover:text-red-300 text-sm px-2">Delete</button>
            </div>

            <div className="p-3 space-y-1.5">
              {group.modifiers.length === 0 && <p className="text-slate-500 text-sm text-center py-2">No options yet.</p>}
              {group.modifiers.map(mod => (
                <div key={mod.id} className="flex items-center gap-3 bg-slate-700 rounded-lg px-3 py-2">
                  <div className="flex-1">
                    <span className="font-medium text-sm">{mod.name}</span>
                  </div>
                  {mod.extra_price > 0 && <span className="text-yellow-400 text-sm font-medium">+${mod.extra_price.toFixed(2)}</span>}
                  {group.selection_type === 'toggle' && (
                    <button
                      onClick={() => handleToggleDefault(mod)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        mod.default_on ? 'bg-green-700 text-green-200' : 'bg-slate-600 text-slate-400'
                      }`}
                    >
                      {mod.default_on ? 'ON' : 'OFF'}
                    </button>
                  )}
                  <button onClick={() => handleDeleteModifier(mod.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                </div>
              ))}

              {addingToGroup === group.id ? (
                <div className="flex gap-2 items-center mt-2">
                  <input
                    value={newModName}
                    onChange={e => setNewModName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddModifier(group.id)}
                    placeholder="Option name"
                    className="flex-1 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                    style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0' }}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-sm">+$</span>
                    <input value={newModPrice} onChange={e => setNewModPrice(e.target.value)} className="w-14 rounded px-2 py-2 text-sm outline-none" style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0' }} type="number" step="0.5" min="0" />
                  </div>
                  {group.selection_type === 'toggle' && (
                    <button onClick={() => setNewModDefault(!newModDefault)} className={`px-2 py-1.5 rounded text-xs font-medium ${newModDefault ? 'bg-green-700 text-green-200' : 'bg-slate-600 text-slate-400'}`}>
                      {newModDefault ? 'ON' : 'OFF'}
                    </button>
                  )}
                  <button onClick={() => handleAddModifier(group.id)} className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded text-sm font-medium">Add</button>
                  <button onClick={() => setAddingToGroup(null)} className="text-slate-400 px-2 text-sm">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingToGroup(group.id); setNewModName(''); setNewModPrice('0'); setNewModDefault(group.selection_type === 'toggle'); }}
                  className="w-full text-center text-slate-500 hover:text-slate-300 py-2 border border-dashed border-slate-600 rounded-lg text-sm mt-1"
                >
                  + Add Option
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add step */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
        <label className="text-sm font-medium text-slate-300">Add a new step to "{selectedCatName}"</label>
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
            placeholder="Step name"
            className="flex-1 rounded-lg px-4 py-3 placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
            style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0' }}
          />
          <select value={newGroupType} onChange={e => setNewGroupType(e.target.value)} className="rounded-lg px-3 py-3 outline-none" style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0' }}>
            <option value="single">Pick One</option>
            <option value="multi">Pick Many</option>
            <option value="toggle">On/Off Toggles</option>
          </select>
          <button onClick={handleAddGroup} className="bg-purple-600 hover:bg-purple-500 px-5 rounded-lg font-medium">Add Step</button>
        </div>
      </div>
    </div>
  );
}
