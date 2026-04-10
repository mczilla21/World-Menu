import { useState, useEffect } from 'react';
import { useMenu } from '../../../hooks/useMenu';

interface Station {
  id: number;
  name: string;
  pin: string;
  category_ids: string;
  is_active: number;
}

export default function StationManager() {
  const { categories } = useMenu();
  const [stations, setStations] = useState<Station[]>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchStations = async () => {
    const res = await fetch('/api/stations/all').then(r => r.json());
    setStations(res);
  };
  useEffect(() => { fetchStations(); }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !pin.trim()) return;
    setError('');
    const catIds = [...selectedCats].join(',');
    const url = editingId ? `/api/stations/${editingId}` : '/api/stations';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), pin, category_ids: catIds }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error saving station');
      return;
    }
    setName(''); setPin(''); setSelectedCats(new Set()); setEditingId(null);
    fetchStations();
  };

  const handleEdit = (s: Station) => {
    setEditingId(s.id);
    setName(s.name);
    setPin(s.pin);
    const ids = s.category_ids ? s.category_ids.split(',').map(Number).filter(Boolean) : [];
    setSelectedCats(new Set(ids));
    setError('');
  };

  const handleCancel = () => {
    setEditingId(null); setName(''); setPin(''); setSelectedCats(new Set()); setError('');
  };

  const handleDelete = async (s: Station) => {
    if (!confirm(`Delete station "${s.name}"?`)) return;
    await fetch(`/api/stations/${s.id}`, { method: 'DELETE' });
    fetchStations();
  };

  const toggleActive = async (s: Station) => {
    await fetch(`/api/stations/${s.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: s.is_active ? 0 : 1 }),
    });
    fetchStations();
  };

  const toggleCat = (catId: number) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const getCatNames = (catIds: string) => {
    if (!catIds) return 'All Categories';
    const ids = catIds.split(',').map(Number).filter(Boolean);
    if (ids.length === 0) return 'All Categories';
    return ids.map(id => categories.find(c => c.id === id)?.name || `#${id}`).join(', ');
  };

  return (
    <div className="space-y-4">
      {/* Add / Edit station */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">{editingId ? 'Edit Station' : 'Add Station'}</h3>
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Station Name" className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN (4 digit)" maxLength={4} className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium text-white flex-1">
              {editingId ? 'Save' : 'Add'}
            </button>
            {editingId && (
              <button onClick={handleCancel} className="bg-slate-600 hover:bg-slate-500 rounded-lg px-3 py-2 text-sm font-medium text-white">
                Cancel
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1.5">Assigned Categories (empty = all):</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.filter(c => c.show_in_kitchen).map(cat => {
              const isOn = selectedCats.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isOn ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Station list */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Stations ({stations.length})</h3>
        {stations.length === 0 && <p className="text-xs text-slate-500">No stations yet. Add one above.</p>}
        <div className="space-y-1.5">
          {stations.map(s => (
            <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${s.is_active ? 'bg-slate-700/50' : 'bg-slate-700/20 opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{s.name}</span>
                <span className="text-xs text-slate-500 ml-2">PIN: {s.pin}</span>
                <div className="text-xs text-slate-400 truncate">{getCatNames(s.category_ids)}</div>
              </div>
              <button onClick={() => handleEdit(s)} className="text-xs px-2 py-1 rounded bg-blue-900/50 text-blue-400 hover:bg-blue-900/70">Edit</button>
              <button onClick={() => toggleActive(s)} className={`text-xs px-2 py-1 rounded ${s.is_active ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                {s.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => handleDelete(s)} className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-500 hover:bg-red-900/50">Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
