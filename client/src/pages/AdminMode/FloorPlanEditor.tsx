import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../../hooks/useSettings';

const FLOOR_THEMES: { key: string; label: string; bg: string }[] = [
  { key: 'dark-wood', label: '🪵 Dark Wood', bg: `linear-gradient(90deg,rgba(30,20,12,0.5) 0%,transparent 50%,rgba(30,20,12,0.5) 100%),repeating-linear-gradient(90deg,#1c1510 0px,#1c1510 28px,#211a14 28px,#211a14 30px,#1e1612 30px,#1e1612 55px,#221c15 55px,#221c15 57px),#1a1410` },
  { key: 'light-wood', label: '🏠 Light Wood', bg: `linear-gradient(90deg,rgba(180,150,100,0.15) 0%,transparent 50%,rgba(180,150,100,0.15) 100%),repeating-linear-gradient(90deg,#d4b896 0px,#d4b896 28px,#c9a87e 28px,#c9a87e 30px,#d0b088 30px,#d0b088 55px,#c5a47a 55px,#c5a47a 57px),#c9a87e` },
  { key: 'dark', label: '🌙 Dark', bg: '#111827' },
  { key: 'concrete', label: '🏢 Concrete', bg: `linear-gradient(135deg,#374151,#1f2937,#374151)` },
  { key: 'marble', label: '🤍 Marble', bg: `linear-gradient(135deg,#f8f8f8 0%,#e8e8e8 25%,#f0f0f0 50%,#e5e5e5 75%,#f8f8f8 100%)` },
  { key: 'custom', label: '🖼 Custom Image', bg: '' },
];

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
  const { settings, updateSetting } = useSettings();
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [dragging, setDragging] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addType, setAddType] = useState('table');
  const [addLabel, setAddLabel] = useState('');
  const [addCap, setAddCap] = useState('4');
  const [saving, setSaving] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const floorTheme = settings.floor_theme || 'dark-wood';
  const floorBgImage = settings.floor_bg_image || '';
  const themeObj = FLOOR_THEMES.find(t => t.key === floorTheme) || FLOOR_THEMES[0];
  const canvasBg = floorTheme === 'custom' && floorBgImage ? undefined : themeObj.bg;

  const snap = (v: number) => snapToGrid ? Math.round(v / gridSize) * gridSize : v;

  const fetchTables = () => fetch('/api/floor-tables/all').then(r => r.json()).then(setTables);
  useEffect(() => { fetchTables(); }, []);

  // Auto-save positions after drag (debounced 800ms)
  const autoSavePositions = useCallback((currentTables: FloorTable[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await fetch('/api/floor-tables/positions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: currentTables.map(t => ({ id: t.id, x: t.x, y: t.y })) }),
      });
      setSaving(false);
    }, 800);
  }, []);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const handleAdd = async () => {
    if (!addLabel.trim()) return;
    const count = tables.length;
    const col = count % 6;
    const row = Math.floor(count / 6);
    const startX = 40 + col * 130;
    const startY = 40 + row * 120;
    await fetch('/api/floor-tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: addLabel.trim(), type: addType, capacity: parseInt(addCap) || 4, x: startX, y: startY }),
    });
    setAddLabel('');
    setShowAddPanel(false);
    fetchTables();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this table?')) return;
    await fetch(`/api/floor-tables/${id}`, { method: 'DELETE' });
    setSelected(null);
    fetchTables();
  };

  const handleUpdateTable = async (id: number, updates: Partial<FloorTable>) => {
    await fetch(`/api/floor-tables/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchTables();
  };

  const handleAutoArrange = async () => {
    if (tables.length === 0) return;
    const cols = Math.ceil(Math.sqrt(tables.length * 1.5));
    const gap = 20;
    const arranged = tables.map((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { ...t, x: 30 + col * (t.width + gap), y: 30 + row * (t.height + gap) };
    });
    setTables(arranged);
    setSaving(true);
    await fetch('/api/floor-tables/positions', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: arranged.map(t => ({ id: t.id, x: t.x, y: t.y })) }),
    });
    setSaving(false);
  };

  // ── Drag handlers (mouse + touch) ──────────────────────
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;

  const startDrag = (clientX: number, clientY: number, table: FloorTable) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ id: table.id, offsetX: clientX - rect.left - table.x, offsetY: clientY - rect.top - table.y });
    setSelected(table.id);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const d = draggingRef.current;
    if (!d || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(rect.width - 60, clientX - rect.left - d.offsetX));
    const rawY = Math.max(0, Math.min(rect.height - 60, clientY - rect.top - d.offsetY));
    setTables(prev => prev.map(t => t.id === d.id ? { ...t, x: snap(rawX), y: snap(rawY) } : t));
  };

  const endDrag = () => {
    if (draggingRef.current) {
      setTables(prev => { autoSavePositions(prev); return prev; });
    }
    setDragging(null);
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent, table: FloorTable) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX, e.clientY, table);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onUp = () => endDrag();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [autoSavePositions, snapToGrid, gridSize]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent, table: FloorTable) => {
    if (!editMode) return;
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY, table);
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault(); // Prevent scroll while dragging
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => endDrag();
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); };
  }, [autoSavePositions, snapToGrid, gridSize]);

  const selectedTable = tables.find(t => t.id === selected);
  const canvasHeight = Math.max(450, ...tables.map(t => t.y + t.height + 40));

  return (
    <div className="space-y-3 pb-48">
      {/* Toolbar — big touch-friendly buttons */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`px-5 py-3 rounded-xl text-sm font-bold transition-colors ${editMode ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}
        >
          {editMode ? '🔓 Done Editing' : '✏️ Edit Layout'}
        </button>
        <button
          onClick={() => setShowAddPanel(!showAddPanel)}
          className="px-5 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white"
        >
          ➕ Add Seating
        </button>
        {tables.length > 0 && (
          <button onClick={handleAutoArrange} className="px-5 py-3 rounded-xl text-sm font-bold bg-slate-700 text-slate-200">
            🔄 Auto-arrange
          </button>
        )}
        {editMode && (
          <>
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${snapToGrid ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              🧲 Snap {snapToGrid ? 'ON' : 'OFF'}
            </button>
            {snapToGrid && (
              <select
                value={gridSize}
                onChange={e => setGridSize(Number(e.target.value))}
                className="bg-slate-700 text-white text-sm rounded-xl px-4 py-3 outline-none font-semibold"
              >
                <option value={10}>10px grid</option>
                <option value={20}>20px grid</option>
                <option value={40}>40px grid</option>
              </select>
            )}
          </>
        )}
        {saving && <span className="text-sm text-emerald-400 font-semibold ml-2">Saving...</span>}
      </div>

      {/* Status bar */}
      <div className="flex gap-4 text-sm text-slate-400 px-1">
        {tableTypes.map(t => {
          const count = tables.filter(tb => tb.type === t.key).length;
          return count > 0 ? (
            <span key={t.key} className="flex items-center gap-1.5">
              <span className={`w-4 h-4 bg-gradient-to-b ${typeStyles[t.key].bg} ${typeStyles[t.key].shape} inline-block`} />
              {t.label}: {count}
            </span>
          ) : null;
        })}
        <span className="ml-auto text-slate-500">{tables.length} total</span>
      </div>

      {/* Floor theme selector */}
      <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-200 text-sm">Floor Background</h3>
        <div className="flex gap-2 flex-wrap">
          {FLOOR_THEMES.map(t => (
            <button
              key={t.key}
              onClick={() => updateSetting('floor_theme', t.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${floorTheme === t.key ? 'bg-blue-600 text-white scale-105' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {floorTheme === 'custom' && (
          <div className="flex items-center gap-3">
            {floorBgImage && <img src={`/uploads/${floorBgImage}`} alt="" className="w-16 h-10 rounded-lg object-cover" />}
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  const res = await fetch('/api/uploads', { method: 'POST', body: formData });
                  const data = await res.json();
                  if (data.filename) await updateSetting('floor_bg_image', data.filename);
                };
                input.click();
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold text-slate-300"
            >
              {floorBgImage ? 'Change Image' : 'Upload Image'}
            </button>
            {floorBgImage && (
              <button onClick={() => updateSetting('floor_bg_image', '')} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            )}
          </div>
        )}
      </div>

      {/* Add seating panel */}
      {showAddPanel && (
        <div className="bg-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-lg text-slate-200">Add New Seating</h3>
          <div className="grid grid-cols-4 gap-2">
            {tableTypes.map(t => (
              <button key={t.key} onClick={() => { setAddType(t.key); setAddCap(String(t.defaultCap)); }}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-xl text-sm font-semibold transition-all ${addType === t.key ? 'bg-blue-600 text-white scale-105' : 'bg-slate-700 text-slate-300'}`}>
                <span className="text-2xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="Label (e.g. T1, B3, Bar 1)"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-slate-700 rounded-xl px-4 py-3.5 text-white outline-none text-base" />
            <input value={addCap} onChange={e => setAddCap(e.target.value)} placeholder="Seats" type="number" min="1"
              className="w-20 bg-slate-700 rounded-xl px-4 py-3.5 text-white outline-none text-base text-center" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={!addLabel.trim()} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl px-4 py-3.5 text-base font-bold">
              Add {tableTypes.find(t => t.key === addType)?.label}
            </button>
            <button onClick={() => setShowAddPanel(false)} className="px-6 py-3.5 rounded-xl text-base font-semibold bg-slate-700 text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="bg-slate-800 rounded-2xl overflow-hidden">
        {editMode && (
          <div className="px-4 py-2.5 border-b border-slate-700/50 text-center">
            <span className="text-sm text-orange-400 font-semibold">
              ✏️ Edit mode — drag tables to move them
            </span>
          </div>
        )}

        <div
          ref={canvasRef}
          className="relative"
          style={{
            height: canvasHeight,
            touchAction: editMode ? 'none' : 'auto',
            background: canvasBg || '#1a1410',
          }}
          onClick={() => { if (!dragging) setSelected(null); }}
        >
          {/* Custom background image */}
          {floorTheme === 'custom' && floorBgImage && (
            <img src={`/uploads/${floorBgImage}`} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          )}

          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: editMode && snapToGrid ? 0.15 : 0.05 }}>
            <defs>
              <pattern id="grid" width={snapToGrid ? gridSize : 40} height={snapToGrid ? gridSize : 40} patternUnits="userSpaceOnUse">
                <path d={`M ${snapToGrid ? gridSize : 40} 0 L 0 0 0 ${snapToGrid ? gridSize : 40}`} fill="none" stroke="#475569" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-4">🪑</div>
                <p className="text-lg text-slate-400 font-semibold">No tables yet</p>
                <p className="text-sm text-slate-500 mt-2">Tap "Add Seating" above to create tables, booths, bar seats, and patio seating</p>
              </div>
            </div>
          )}

          {tables.map(table => {
            const style = typeStyles[table.type] || typeStyles.table;
            const isSelected = selected === table.id;
            const isDragging = dragging?.id === table.id;
            return (
              <div
                key={table.id}
                onMouseDown={e => handleMouseDown(e, table)}
                onTouchStart={e => handleTouchStart(e, table)}
                onClick={e => { e.stopPropagation(); setSelected(table.id); }}
                className={`absolute flex flex-col items-center justify-center select-none
                  bg-gradient-to-b ${style.bg} border-2 ${style.border} ${style.shape}
                  transition-shadow
                  ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                  ${isSelected ? 'ring-2 ring-white/60 shadow-xl z-10' : 'shadow-md'}
                  ${isDragging ? 'opacity-80 scale-110 z-20' : ''}`}
                style={{
                  left: table.x, top: table.y,
                  width: table.width, height: table.height,
                  transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
                  touchAction: editMode ? 'none' : 'auto',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                <span className="text-base font-black leading-none" style={{ color: '#fff' }}>{table.label}</span>
                <span className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{table.capacity} seats</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected table editor — fixed bottom panel on tablet */}
      {selectedTable && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t-2 border-slate-600 shadow-2xl p-4 safe-bottom" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-white">
                {tableTypes.find(t => t.key === selectedTable.type)?.icon} {selectedTable.label}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(selectedTable.id)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600/80 text-white">
                  🗑 Delete
                </button>
                <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-700 text-slate-300">
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-semibold">Label</label>
                <input
                  key={`label-${selectedTable.id}`}
                  defaultValue={selectedTable.label}
                  onBlur={e => handleUpdateTable(selectedTable.id, { label: e.target.value })}
                  className="w-full bg-slate-700 rounded-xl px-4 py-3 text-white outline-none text-base"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-semibold">Type</label>
                <select
                  key={`type-${selectedTable.id}`}
                  defaultValue={selectedTable.type}
                  onChange={e => handleUpdateTable(selectedTable.id, { type: e.target.value })}
                  className="w-full bg-slate-700 rounded-xl px-4 py-3 text-white outline-none text-base"
                >
                  {tableTypes.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-semibold">Seats</label>
                <input
                  key={`cap-${selectedTable.id}`}
                  type="number" min="1" defaultValue={selectedTable.capacity}
                  onBlur={e => handleUpdateTable(selectedTable.id, { capacity: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 rounded-xl px-4 py-3 text-white outline-none text-base"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-semibold">Size (W × H)</label>
                <div className="flex gap-2">
                  <input
                    key={`w-${selectedTable.id}`}
                    type="number" defaultValue={Math.round(selectedTable.width)} placeholder="W"
                    onBlur={e => handleUpdateTable(selectedTable.id, { width: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 rounded-xl px-3 py-3 text-white outline-none text-base"
                  />
                  <input
                    key={`h-${selectedTable.id}`}
                    type="number" defaultValue={Math.round(selectedTable.height)} placeholder="H"
                    onBlur={e => handleUpdateTable(selectedTable.id, { height: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 rounded-xl px-3 py-3 text-white outline-none text-base"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
