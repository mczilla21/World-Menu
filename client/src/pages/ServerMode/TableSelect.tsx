import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../../hooks/useSettings';
import ReceiptPrint from '../../components/ReceiptPrint';

interface TableStatus {
  hasActive: boolean;
  hasFinished: boolean;
}

interface Props {
  onSelect: (t: string) => void;
  onCloseTable: (t: string) => Promise<void>;
  refreshKey?: number;
}

export default function TableSelect({ onSelect, onCloseTable, refreshKey = 0 }: Props) {
  const [tableStatus, setTableStatus] = useState<Record<string, TableStatus>>({});
  const [closingTable, setClosingTable] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [viewingTable, setViewingTable] = useState<string | null>(null);
  const [viewingItems, setViewingItems] = useState<any[]>([]);
  const [printingTable, setPrintingTable] = useState<string | null>(null);
  const [undoTable, setUndoTable] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { settings } = useSettings();

  const tableCount = parseInt(settings.table_count) || 20;
  const tables = Array.from({ length: tableCount }, (_, i) => String(i + 1));

  const fetchStatus = () => {
    Promise.all([
      fetch('/api/orders/active').then(r => r.json()).catch(() => []),
      fetch('/api/orders/finished').then(r => r.json()).catch(() => []),
    ]).then(([active, finished]) => {
      const status: Record<string, TableStatus> = {};
      for (const o of active) {
        const t = String(o.table_number);
        status[t] = { hasActive: true, hasFinished: false };
      }
      const today = new Date().toISOString().slice(0, 10);
      for (const o of finished) {
        const t = String(o.table_number);
        const orderDate = (o.created_at || '').slice(0, 10);
        if (orderDate === today) {
          if (!status[t]) status[t] = { hasActive: false, hasFinished: true };
          else status[t].hasFinished = true;
        }
      }
      setTableStatus(status);
    });
  };

  useEffect(() => {
    fetchStatus();
  }, [refreshKey]);

  useEffect(() => {
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, []);

  const handleViewOrder = async (t: string) => {
    try {
      const res = await fetch(`/api/orders/table/${encodeURIComponent(t)}/bill`);
      if (res.ok) {
        const data = await res.json();
        const allItems: any[] = [];
        for (const order of data.orders) {
          for (const item of (order.items || [])) {
            allItems.push({ ...item, order_number: order.order_number, order_status: order.status });
          }
        }
        setViewingItems(allItems);
        setViewingTable(t);
        setSelectedTable(null);
      }
    } catch {}
  };

  const handleSettleTable = async (t: string) => {
    setClosingTable(t);
    setSelectedTable(null);
    await onCloseTable(t);
    fetchStatus();
    setClosingTable(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoTable(t);
    undoTimer.current = setTimeout(() => setUndoTable(null), 6000);
  };

  const handleUndo = async () => {
    if (!undoTable) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const t = undoTable;
    setUndoTable(null);
    await fetch(`/api/tables/${encodeURIComponent(t)}/reopen`, { method: 'POST' });
    fetchStatus();
  };

  const handleTableTap = (t: string) => {
    const s = tableStatus[t];
    const hasOrders = s?.hasActive || (s?.hasFinished && !s?.hasActive);
    if (hasOrders) {
      setSelectedTable(t);
    } else {
      onSelect(t);
    }
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-4 gap-2.5 max-w-md mx-auto">
        {tables.map((t) => {
          const s = tableStatus[t];
          const hasActive = s?.hasActive;
          const hasFinished = s?.hasFinished && !s?.hasActive;
          return (
            <button
              key={t}
              onClick={() => handleTableTap(t)}
              disabled={closingTable === t}
              className={`w-full relative rounded-xl py-5 text-lg font-semibold transition-all active:scale-95 ${
                hasActive
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                  : hasFinished
                    ? 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
              }`}
            >
              {t}
              {hasActive && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
              {hasFinished && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => {
          const custom = prompt('Table name/number:');
          if (custom?.trim()) onSelect(custom.trim());
        }}
        className="mt-5 w-full max-w-md mx-auto block text-center text-slate-500 py-3 border border-dashed border-slate-700 rounded-xl hover:border-slate-500 hover:text-slate-400 transition-colors text-sm"
      >
        + Custom Table
      </button>

      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedTable(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md mx-4 mb-6 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/50">
              <div className="px-4 py-3 border-b border-slate-700/50 text-center">
                <span className="text-sm font-medium text-slate-400">Table {selectedTable}</span>
              </div>
              {(tableStatus[selectedTable]?.hasActive || tableStatus[selectedTable]?.hasFinished) && (
                <button
                  onClick={() => handleViewOrder(selectedTable)}
                  className="w-full px-4 py-4 text-center text-white font-semibold text-base hover:bg-slate-700/50 transition-colors border-b border-slate-700/50"
                >
                  View Current Order
                </button>
              )}
              <button
                onClick={() => { setSelectedTable(null); onSelect(selectedTable); }}
                className="w-full px-4 py-4 text-center text-blue-400 font-semibold text-base hover:bg-slate-700/50 transition-colors border-b border-slate-700/50"
              >
                {(tableStatus[selectedTable]?.hasActive || tableStatus[selectedTable]?.hasFinished) ? 'Add to Order' : 'New Order'}
              </button>
              <button
                onClick={() => handleSettleTable(selectedTable)}
                className="w-full px-4 py-4 text-center text-red-400 font-semibold text-base hover:bg-slate-700/50 transition-colors"
              >
                Settle & Clear Table
              </button>
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="w-full bg-slate-800 rounded-2xl px-4 py-4 text-center text-slate-300 font-semibold text-base hover:bg-slate-700 transition-colors border border-slate-700/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* View order detail */}
      {viewingTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setViewingTable(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Table {viewingTable}</h3>
                <p className="text-xs text-slate-400">{viewingItems.length} item{viewingItems.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setViewingTable(null)} className="text-slate-500 hover:text-white text-sm">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-1">
              {viewingItems.length === 0 && (
                <p className="text-center text-slate-500 py-8">No items found</p>
              )}
              {viewingItems.map((item, idx) => (
                <div key={idx} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  item.is_done ? 'bg-emerald-900/20' : 'bg-slate-700/50'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${item.is_done ? 'text-emerald-300/70 line-through' : 'text-white'}`}>
                        {item.item_name}
                        {item.variant_name && <span className="text-blue-300 ml-1">({item.variant_name})</span>}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-amber-400 font-bold text-sm">x{item.quantity}</span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-slate-400 mt-0.5">{item.notes}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div className="text-xs text-slate-400">${(item.item_price * item.quantity).toFixed(2)}</div>
                      {item.is_done ? (
                        <span className="text-[10px] text-emerald-400">Done</span>
                      ) : (
                        <span className="text-[10px] text-amber-400">Pending</span>
                      )}
                    </div>
                    {!item.is_done && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove "${item.item_name}"?`)) return;
                          await fetch(`/api/order-items/${item.id}`, { method: 'DELETE' });
                          setViewingItems(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="w-6 h-6 rounded-full bg-red-900/50 hover:bg-red-700 text-red-400 text-xs flex items-center justify-center"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Total</span>
                <button
                  onClick={() => { setViewingTable(null); setPrintingTable(viewingTable); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300"
                >
                  Print Receipt
                </button>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                ${viewingItems.reduce((s: number, i: any) => s + (i.item_price * i.quantity), 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Receipt print */}
      {printingTable && (
        <ReceiptPrint tableNumber={printingTable} onClose={() => setPrintingTable(null)} />
      )}

      {undoTable && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-xl px-5 py-3 flex items-center gap-4 shadow-2xl z-50">
          <span className="text-sm text-slate-300">Table {undoTable} settled</span>
          <button onClick={handleUndo} className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors">
            UNDO
          </button>
        </div>
      )}
    </div>
  );
}
