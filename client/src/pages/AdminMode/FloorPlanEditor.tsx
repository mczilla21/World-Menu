import { useState, useEffect, useRef, useCallback } from 'react';

interface FloorTable {
  id: number;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
}

const tableTypes = [
  { key: 'table', label: 'Table', icon: '⬜', defaultCap: 4 },
  { key: 'booth', label: 'Booth', icon: '🟫', defaultCap: 4 },
  { key: 'bar', label: 'Bar Seat', icon: '🔵', defaultCap: 1 },
  { key: 'patio', label: 'Patio', icon: '🟢', defaultCap: 4 },
];

const typeStyles: Record<string, { bg: string; border: string; shape: string }> = {
  table: { bg: 'from-slate-600 to-slate-700', border: 'border-slate-500', shape: 'rounded-xl' },
  booth: { bg: 'from-amber-800 to-amber-900', border: 'border-amber-600', shape: 'rounded-lg rounded-t-3xl' },
  bar: { bg: 'from-blue-700 to-blue-800', border: 'border-blue-500', shape: 'rounded-full' },
  patio: { bg: 'from-emerald-700 to-emerald-800', border: 'border-emerald-500', shape: 'rounded-2xl' },
};

export default function FloorPlanEditor() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [dragging, setDragging] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [addType, setAddType] = useState('table');
  const [addLabel, setAddLabel] = useState('');
  const [addCap, setAddCap] = useState('4');
  const [dirty, setDirty] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchTables = () => fetch('/api/floor-tables/all').then(r => r.json()).then(setTables);
  useEffect(() => { fetchTables(); }, []);

  const handleAdd = async () => {
    if (!addLabel.trim()) return;
    await fetch('/api/floor-tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: addLabel.trim(), type: addType, capacity: parseInt(addCap) || 4 }),
    });
    setAddLabel('');
    fetchTables();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this table?')) return;
    await fetch(`/api/floor-tables/${id}`, { method: 'DELETE' });
    setSelected(null);
    fetchTables();
  };

  const handleSavePositions = async () => {
    await fetch('/api/floor-tables/positions', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: tables.map(t => ({ id: t.id, x: t.x, y: t.y })) }),
    });
    setDirty(false);
  };

  const handleUpdateTable = async (id: number, updates: Partial<FloorTable>) => {
    await fetch(`/api/floor-tables/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchTables();
  };

  // Drag handlers — use mouse events for reliable PC dragging
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;

  const handleMouseDown = (e: React.MouseEvent, table: FloorTable) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ id: table.id, offsetX: e.clientX - rect.left - table.x, offsetY: e.clientY - rect.top - table.y });
    setSelected(table.id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.max(0, Math.min(rect.width - 60, e.clientX - rect.left - d.offsetX));
      const newY = Math.max(0, Math.min(rect.height - 60, e.clientY - rect.top - d.offsetY));
      setTables(prev => prev.map(t => t.id === d.id ? { ...t, x: newX, y: newY } : t));
      setDirty(true);
    };

    const handleMouseUp = () => { setDragging(null); };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const selectedTable = tables.find(t => t.id === selected);

  return (
    <div className="space-y-4">
      {/* Add bar */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Add Seating</h3>
        <div className="flex gap-2 flex-wrap">
          {tableTypes.map(t => (
            <button key={t.key} onClick={() => { setAddType(t.key); setAddCap(String(t.defaultCap)); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${addType === t.key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {t.icon} {t.label}
            </button>
          ))}
          <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="Label (e.g. T1, B3, Bar 2)"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm w-36" />
          <input value={addCap} onChange={e => setAddCap(e.target.value)} placeholder="Seats" type="number" min="1"
            className="bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm w-16" />
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm font-medium">Add</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
          <span className="text-xs text-slate-400">Drag tables to position them. Tap to select.</span>
          <div className="flex gap-2">
            {dirty && (
              <button onClick={handleSavePositions} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white">
                Save Layout
              </button>
            )}
            <div className="flex gap-2 text-[10px] text-slate-500">
              {tableTypes.map(t => (
                <span key={t.key} className="flex items-center gap-1">
                  <span className={`w-3 h-3 bg-gradient-to-b ${typeStyles[t.key].bg} ${typeStyles[t.key].shape} inline-block`} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="relative border-2 border-dashed border-slate-700/30"
          style={{ height: '500px', touchAction: 'none', background: '#f1f5f9' }}
          onClick={() => setSelected(null)}
        >
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#475569" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {tables.map(table => {
            const style = typeStyles[table.type] || typeStyles.table;
            const isSelected = selected === table.id;
            return (
              <div
                key={table.id}
                onMouseDown={e => handleMouseDown(e, table)}
                onClick={e => { e.stopPropagation(); setSelected(table.id); }}
                className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing
                  bg-gradient-to-b ${style.bg} border-2 ${style.border} ${style.shape}
                  transition-shadow select-none
                  ${isSelected ? 'ring-2 ring-white/50 shadow-xl z-10' : 'shadow-md hover:shadow-lg'}
                  ${dragging?.id === table.id ? 'opacity-80 scale-105' : ''}`}
                style={{
                  left: table.x, top: table.y,
                  width: table.width, height: table.height,
                  transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                <span className="text-sm font-black leading-none" style={{ color: '#fff' }}>{table.label}</span>
                <span className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{table.capacity} seats</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected table editor */}
      {selectedTable && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-200">Edit: {selectedTable.label}</h3>
            <button onClick={() => handleDelete(selectedTable.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Label</label>
              <input defaultValue={selectedTable.label} onBlur={e => handleUpdateTable(selectedTable.id, { label: e.target.value })}
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <select defaultValue={selectedTable.type} onChange={e => handleUpdateTable(selectedTable.id, { type: e.target.value })}
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm">
                {tableTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Seats</label>
              <input type="number" min="1" defaultValue={selectedTable.capacity} onBlur={e => handleUpdateTable(selectedTable.id, { capacity: parseInt(e.target.value) })}
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Size</label>
              <div className="flex gap-1">
                <input type="number" defaultValue={Math.round(selectedTable.width)} placeholder="W" onBlur={e => handleUpdateTable(selectedTable.id, { width: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 rounded-lg px-2 py-2 text-white outline-none text-sm" />
                <input type="number" defaultValue={Math.round(selectedTable.height)} placeholder="H" onBlur={e => handleUpdateTable(selectedTable.id, { height: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 rounded-lg px-2 py-2 text-white outline-none text-sm" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
