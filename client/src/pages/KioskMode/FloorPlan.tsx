import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useWebSocket } from '../../hooks/useWebSocket';

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

interface TableData {
  number: string;
  status: 'empty' | 'seated' | 'ordering' | 'eating' | 'check' | 'paid';
  guests: number;
  elapsed: number;
  total: number;
  orderCount: number;
}

interface Props {
  onSelectTable: (table: TableData) => void;
  selectedTable: string | null;
}

// Friendly POS color scheme
const statusColors: Record<string, { bg: string; border: string; text: string; label: string; labelBg: string }> = {
  empty:    { bg: '#dcfce7', border: '#86efac', text: '#166534', label: 'Open', labelBg: '#bbf7d0' },
  ordering: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', label: 'Ordering', labelBg: '#bfdbfe' },
  eating:   { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Eating', labelBg: '#fde68a' },
  check:    { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', label: 'Check!', labelBg: '#fecaca' },
  seated:   { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3', label: 'Seated', labelBg: '#c7d2fe' },
  paid:     { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: 'Paid', labelBg: '#e2e8f0' },
};

// Table shape renderers
function TableShape({ type, width, height }: { type: string; width: number; height: number }) {
  if (type === 'bar') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={width/2} cy={height/2} r={Math.min(width, height)/2 - 2} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      </svg>
    );
  }
  if (type === 'booth') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect x="2" y="2" width={width-4} height={height-4} rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        {/* Booth back */}
        <rect x="0" y="0" width={width} height="8" rx="4" fill="currentColor" opacity="0.15" />
      </svg>
    );
  }
  if (type === 'patio') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect x="2" y="2" width={width-4} height={height-4} rx="16" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 3" opacity="0.3" />
      </svg>
    );
  }
  // Default table — rounded rect with "chairs"
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      <rect x="8" y="8" width={width-16} height={height-16} rx="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      {/* Chair dots */}
      <circle cx={width/2} cy="4" r="3" fill="currentColor" opacity="0.2" />
      <circle cx={width/2} cy={height-4} r="3" fill="currentColor" opacity="0.2" />
      <circle cx="4" cy={height/2} r="3" fill="currentColor" opacity="0.2" />
      <circle cx={width-4} cy={height/2} r="3" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

export default function FloorPlan({ onSelectTable, selectedTable }: Props) {
  const [floorTables, setFloorTables] = useState<FloorTable[]>([]);
  const [tableStatus, setTableStatus] = useState<Record<string, TableData>>({});
  const { settings } = useSettings();

  const fetchFloor = useCallback(async () => {
    const tables = await fetch('/api/floor-tables').then(r => r.json()).catch(() => []);
    setFloorTables(tables);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const [activeRes, finishedRes, callsRes] = await Promise.all([
        fetch('/api/orders/active').then(r => r.json()).catch(() => []),
        fetch('/api/orders/finished').then(r => r.json()).catch(() => []),
        fetch('/api/service/calls').then(r => r.json()).catch(() => []),
      ]);

      const checkTables = new Set<string>(
        callsRes.filter((c: any) => c.call_type === 'check_requested').map((c: any) => String(c.table_number))
      );

      const status: Record<string, TableData> = {};
      for (const order of activeRes) {
        const t = String(order.table_number);
        const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
        const itemTotal = (order.items || []).reduce((s: number, i: any) => s + i.item_price * i.quantity, 0);
        const allDone = (order.items || []).every((i: any) => i.is_done);
        const existing = status[t] || { number: t, status: 'empty' as const, guests: 0, elapsed: 0, total: 0, orderCount: 0 };
        status[t] = {
          ...existing,
          status: checkTables.has(t) ? 'check' : allDone ? 'eating' : 'ordering',
          elapsed: Math.max(existing.elapsed, elapsed),
          total: existing.total + itemTotal,
          orderCount: existing.orderCount + 1,
        };
      }
      for (const order of finishedRes) {
        const t = String(order.table_number);
        if (!status[t]) {
          const itemTotal = (order.items || []).reduce((s: number, i: any) => s + i.item_price * i.quantity, 0);
          status[t] = { number: t, status: 'eating', guests: 0, elapsed: 0, total: itemTotal, orderCount: 1 };
        }
      }
      for (const t of checkTables) { if (status[t]) status[t].status = 'check'; }
      setTableStatus(status);
    } catch {}
  }, []);

  useEffect(() => { fetchFloor(); fetchStatus(); }, [fetchFloor, fetchStatus]);
  useEffect(() => { const i = setInterval(fetchStatus, 8000); return () => clearInterval(i); }, [fetchStatus]);

  const handleWs = useCallback((msg: any) => {
    if (['NEW_ORDER', 'ORDER_FINISHED', 'ORDER_UPDATED', 'TABLE_CLOSED', 'WAITER_CALLED', 'CALL_RESOLVED'].includes(msg.type)) fetchStatus();
  }, [fetchStatus]);
  useWebSocket('server', handleWs);

  const counts = {
    open: floorTables.filter(t => !tableStatus[t.label] || tableStatus[t.label].status === 'empty').length,
    occupied: floorTables.filter(t => tableStatus[t.label] && tableStatus[t.label].status !== 'empty').length,
    attention: floorTables.filter(t => tableStatus[t.label]?.status === 'check').length,
    total: Object.values(tableStatus).reduce((s, t) => s + t.total, 0),
  };

  // Fallback grid if no floor plan
  const tableCount = parseInt(settings.table_count) || 15;
  const useGrid = floorTables.length === 0;
  const gridCols = tableCount <= 8 ? 4 : tableCount <= 15 ? 5 : 6;

  // Auto-scale custom floor plan to fit container
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Scale the admin layout to fit the display container
  const floorLayout = (() => {
    if (useGrid || floorTables.length === 0) return null;
    const maxX = Math.max(...floorTables.map(t => t.x + t.width));
    const maxY = Math.max(...floorTables.map(t => t.y + t.height));
    const availW = containerSize.w - 40;
    const availH = containerSize.h - 40;
    const scale = Math.min(availW / maxX, availH / maxY, 2);
    const scaledW = maxX * scale;
    const scaledH = maxY * scale;
    // Center offset
    const offsetX = Math.max(0, (availW - scaledW) / 2) + 20;
    const offsetY = Math.max(0, (availH - scaledH) / 2) + 20;
    return { scale, offsetX, offsetY };
  })();

  const renderTable = (label: string, type: string, style: React.CSSProperties, w: number, h: number) => {
    const s = tableStatus[label];
    const status = s?.status || 'empty';
    const colors = statusColors[status];
    const isSelected = selectedTable === label;

    return (
      <button
        key={label}
        onClick={() => onSelectTable(s || { number: label, status: 'empty', guests: 0, elapsed: 0, total: 0, orderCount: 0 })}
        style={{
          ...style,
          width: w, height: h,
          background: colors.bg,
          borderWidth: isSelected ? 3 : 2,
          borderStyle: 'solid',
          borderColor: isSelected ? '#3b82f6' : colors.border,
          color: colors.text,
          borderRadius: type === 'bar' ? '50%' : type === 'patio' ? 16 : type === 'booth' ? '8px 8px 20px 20px' : 12,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          transition: 'all 0.15s',
          boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.3)' : status === 'check' ? '0 0 12px rgba(239,68,68,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
          position: style.position || 'relative' as const,
        }}
        className={`active:scale-95 ${status === 'check' ? 'animate-pulse' : ''}`}
      >
        <TableShape type={type} width={w} height={h} />
        <span style={{ fontSize: type === 'bar' ? 11 : 15, fontWeight: 800, position: 'relative', zIndex: 1 }}>{label}</span>
        {status !== 'empty' && (
          <span style={{ fontSize: 9, fontWeight: 700, background: colors.labelBg, padding: '1px 6px', borderRadius: 4, position: 'relative', zIndex: 1, marginTop: 2 }}>
            {colors.label}
          </span>
        )}
        {s && s.total > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, position: 'relative', zIndex: 1, marginTop: 1, opacity: 0.7 }}>
            ${s.total.toFixed(2)}
          </span>
        )}
        {s && s.elapsed > 0 && status !== 'empty' && (
          <span style={{ fontSize: 9, position: 'relative', zIndex: 1, opacity: 0.5, color: s.elapsed >= 30 ? '#dc2626' : colors.text }}>
            {s.elapsed}m
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-4">
          <h2 className="text-base font-bold" style={{ color: '#1e293b' }}>Floor Plan</h2>
          <div className="flex gap-3 text-xs">
            {[['empty', 'Open'], ['ordering', 'Ordering'], ['eating', 'Eating'], ['check', 'Check']].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: statusColors[k].bg, border: `2px solid ${statusColors[k].border}`, display: 'inline-block' }} />
                <span style={{ color: '#64748b' }}>{l}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-5 text-xs" style={{ color: '#64748b' }}>
          <span>Open <b style={{ color: '#16a34a' }}>{counts.open}</b></span>
          <span>Occupied <b style={{ color: '#2563eb' }}>{counts.occupied}</b></span>
          {counts.attention > 0 && <span>Attention <b style={{ color: '#dc2626' }}>{counts.attention}</b></span>}
          <span>Total <b style={{ color: '#059669' }}>${counts.total.toFixed(2)}</b></span>
        </div>
      </div>

      {/* Floor area */}
      <div ref={containerRef} className="flex-1 overflow-auto relative" style={{ background: '#f1f5f9' }}>
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
          <defs>
            <pattern id="pos-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pos-grid)" />
        </svg>

        {useGrid ? (
          <div className="p-6">
            {floorTables.length === 0 && (
              <p className="text-center text-sm mb-4" style={{ color: '#94a3b8' }}>
                No floor plan set up. Go to Admin → Floor Plan to create your layout.
              </p>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, maxWidth: 600, margin: '0 auto' }}>
              {Array.from({ length: tableCount }, (_, i) => {
                const label = String(i + 1);
                return renderTable(label, 'table', { position: 'relative' } as any, 90, 90);
              })}
            </div>
          </div>
        ) : floorLayout ? (
          // Custom floor plan — exact mirror of admin editor, scaled to fit
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: 400,
          }}>
            <div style={{
              transform: `scale(${floorLayout.scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: floorLayout.offsetY,
              left: floorLayout.offsetX,
            }}>
              {floorTables.map(ft => renderTable(
                ft.label, ft.type,
                { position: 'absolute', left: ft.x, top: ft.y } as any,
                ft.width, ft.height
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
