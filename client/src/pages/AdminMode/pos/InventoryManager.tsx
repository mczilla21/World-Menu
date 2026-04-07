import { useState, useEffect } from 'react';

interface InvItem { menu_item_id: number; item_name: string; category_name: string; stock_count: number; low_stock_threshold: number; auto_86: number; is_active: number; }

export default function InventoryManager() {
  const [items, setItems] = useState<InvItem[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const fetch_ = async () => {
    const [inv, menu] = await Promise.all([
      fetch('/api/inventory').then(r => r.json()).catch(() => []),
      fetch('/api/menu').then(r => r.json()),
    ]);
    setItems(inv); setMenuItems(menu);
  };
  useEffect(() => { fetch_(); }, []);

  const handleUpdate = async (menuItemId: number, stockCount: number) => {
    await fetch(`/api/inventory/${menuItemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_count: stockCount }) });
    fetch_();
  };

  const trackedIds = new Set(items.map(i => i.menu_item_id));
  const untracked = menuItems.filter(m => !trackedIds.has(m.id));

  const enableTracking = async (menuItemId: number) => {
    await fetch(`/api/inventory/${menuItemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_count: 50, low_stock_threshold: 5 }) });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Tracked Items ({items.length})</h3>
        {items.length === 0 && <p className="text-xs text-slate-500">No items tracked. Enable tracking below.</p>}
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.menu_item_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
              item.stock_count === 0 ? 'bg-red-900/20 border border-red-500/30' :
              item.stock_count <= item.low_stock_threshold ? 'bg-amber-900/20 border border-amber-500/30' : 'bg-slate-700/50'
            }`}>
              <div className="flex-1">
                <span className="text-sm font-medium text-white">{item.item_name}</span>
                <span className="text-xs text-slate-400 ml-2">{item.category_name}</span>
              </div>
              {item.stock_count === 0 && <span className="text-xs font-bold text-red-400">86'd</span>}
              {item.stock_count > 0 && item.stock_count <= item.low_stock_threshold && <span className="text-xs font-bold text-amber-400">Low</span>}
              <div className="flex items-center gap-1">
                <button onClick={() => handleUpdate(item.menu_item_id, Math.max(0, item.stock_count - 1))} className="w-7 h-7 rounded bg-slate-600 text-white text-sm font-bold">-</button>
                <span className="w-10 text-center font-bold text-white">{item.stock_count}</span>
                <button onClick={() => handleUpdate(item.menu_item_id, item.stock_count + 1)} className="w-7 h-7 rounded bg-slate-600 text-white text-sm font-bold">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {untracked.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-semibold text-slate-200 mb-3">Enable Tracking</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {untracked.map(item => (
              <button key={item.id} onClick={() => enableTracking(item.id)}
                className="px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-sm text-white text-left">
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
