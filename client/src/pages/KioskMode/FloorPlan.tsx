import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../hooks/useTheme';

const FLOOR_THEMES: Record<string, string> = {
  'dark-wood': `linear-gradient(90deg,rgba(30,20,12,0.5) 0%,transparent 50%,rgba(30,20,12,0.5) 100%),repeating-linear-gradient(90deg,#1c1510 0px,#1c1510 28px,#211a14 28px,#211a14 30px,#1e1612 30px,#1e1612 55px,#221c15 55px,#221c15 57px),#1a1410`,
  'light-wood': `linear-gradient(90deg,rgba(180,150,100,0.15) 0%,transparent 50%,rgba(180,150,100,0.15) 100%),repeating-linear-gradient(90deg,#d4b896 0px,#d4b896 28px,#c9a87e 28px,#c9a87e 30px,#d0b088 30px,#d0b088 55px,#c5a47a 55px,#c5a47a 57px),#c9a87e`,
  'dark': '#111827',
  'concrete': 'linear-gradient(135deg,#374151,#1f2937,#374151)',
  'marble': 'linear-gradient(135deg,#f8f8f8 0%,#e8e8e8 25%,#f0f0f0 50%,#e5e5e5 75%,#f8f8f8 100%)',
};

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
  showTotals?: boolean;
}

// Premium dark color scheme
const statusColors: Record<string, { bg: string; border: string; text: string; label: string; labelBg: string; glow: string }> = {
  empty:    { bg: 'linear-gradient(135deg, #1a3a2a, #1e4d35)', border: '#2dd4bf40', text: '#5eead4', label: 'Open', labelBg: '#0d9488', glow: 'none' },
  ordering: { bg: 'linear-gradient(135deg, #1e2a4a, #1e3a6e)', border: '#60a5fa50', text: '#93c5fd', label: 'Ordering', labelBg: '#2563eb', glow: '0 0 12px rgba(59,130,246,0.2)' },
  eating:   { bg: 'linear-gradient(135deg, #3a2a10, #4a3518)', border: '#fbbf2450', text: '#fcd34d', label: 'Eating', labelBg: '#d97706', glow: '0 0 12px rgba(251,191,36,0.15)' },
  check:    { bg: 'linear-gradient(135deg, #4a1515, #5c1a1a)', border: '#f8717150', text: '#fca5a5', label: 'Check!', labelBg: '#dc2626', glow: '0 0 16px rgba(239,68,68,0.3)' },
  seated:   { bg: 'linear-gradient(135deg, #1e1a3a, #2a2050)', border: '#a78bfa40', text: '#c4b5fd', label: 'Seated', labelBg: '#7c3aed', glow: '0 0 10px rgba(167,139,250,0.15)' },
  paid:     { bg: 'linear-gradient(135deg, #1a1a1a, #252525)', border: '#52525240', text: '#a3a3a3', label: 'Paid', labelBg: '#525252', glow: 'none' },
};

// Chair SVG shapes for different table types
function TableChairs({ type, width, height }: { type: string; width: number; height: number }) {
  const chairColor = 'rgba(255,255,255,0.15)';
  const chairSize = 5;
  if (type === 'bar' || type === 'patio') return null;
  if (type === 'booth') {
    // Bench seats on top and bottom
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <rect x={width * 0.15} y={-2} width={width * 0.7} height={6} rx={3} fill={chairColor} />
        <rect x={width * 0.15} y={height - 4} width={width * 0.7} height={6} rx={3} fill={chairColor} />
      </svg>
    );
  }
  // Default table — 4 chairs
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <circle cx={width/2} cy={-1} r={chairSize} fill={chairColor} />
      <circle cx={width/2} cy={height + 1} r={chairSize} fill={chairColor} />
      <circle cx={-1} cy={height/2} r={chairSize} fill={chairColor} />
      <circle cx={width + 1} cy={height/2} r={chairSize} fill={chairColor} />
    </svg>
  );
}

export default function FloorPlan({ onSelectTable, selectedTable, showTotals = false }: Props) {
  const [floorTables, setFloorTables] = useState<FloorTable[]>([]);
  const [tableStatus, setTableStatus] = useState<Record<string, TableData>>({});
  const { settings } = useSettings();
  const thm = useTheme();

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
      // Filter out orders waiting for approval — they shouldn't affect table status yet
      const approvedOrders = activeRes.filter((o: any) => !o.needs_approval);
      for (const order of approvedOrders) {
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
    const radius = type === 'bar' ? '50%' : type === 'patio' ? 16 : type === 'booth' ? '8px 8px 18px 18px' : 10;

    return (
      <button
        key={label}
        onClick={() => onSelectTable(s || { number: label, status: 'empty', guests: 0, elapsed: 0, total: 0, orderCount: 0 })}
        style={{
          ...style,
          width: w, height: h,
          background: colors.bg,
          border: `2px solid ${isSelected ? '#fff' : colors.border}`,
          color: colors.text,
          borderRadius: radius,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          transition: 'all 0.2s',
          boxShadow: isSelected
            ? '0 0 0 3px rgba(255,255,255,0.4), 0 4px 20px rgba(0,0,0,0.4)'
            : `${colors.glow}, 0 4px 12px rgba(0,0,0,0.3)`,
          position: style.position || 'relative' as const,
          overflow: 'visible',
        }}
        className={`active:scale-95 hover:brightness-125 ${status === 'check' ? 'animate-pulse' : ''}`}
      >
        <TableChairs type={type} width={w} height={h} />
        <span style={{ fontSize: type === 'bar' ? 11 : 15, fontWeight: 800, position: 'relative', zIndex: 1, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{label}</span>
        {status !== 'empty' && (
          <span style={{ fontSize: 8, fontWeight: 700, background: colors.labelBg, color: '#fff', padding: '2px 6px', borderRadius: 4, position: 'relative', zIndex: 1, marginTop: 2, letterSpacing: 0.5 }}>
            {colors.label.toUpperCase()}
          </span>
        )}
        {showTotals && s && s.total > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, position: 'relative', zIndex: 1, marginTop: 1 }}>
            ${s.total.toFixed(2)}
          </span>
        )}
        {s && s.elapsed > 0 && status !== 'empty' && (
          <span style={{ fontSize: 8, position: 'relative', zIndex: 1, opacity: 0.6, color: s.elapsed >= 30 ? '#fca5a5' : colors.text }}>
            {s.elapsed}m
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#111' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5" style={{ background: thm.bgCard, borderBottom: `1px solid ${thm.border}` }}>
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold" style={{ color: thm.text }}>Floor Plan</h2>
          <div className="flex gap-3 text-xs">
            {[['empty', 'Open'], ['ordering', 'Ordering'], ['eating', 'Eating'], ['check', 'Check']].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[k].labelBg, display: 'inline-block', boxShadow: `0 0 6px ${statusColors[k].labelBg}60` }} />
                <span style={{ color: thm.textMuted }}>{l}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-5 text-xs" style={{ color: thm.textMuted }}>
          <span>Open <b style={{ color: '#2dd4bf' }}>{counts.open}</b></span>
          <span>Occupied <b style={{ color: '#60a5fa' }}>{counts.occupied}</b></span>
          {counts.attention > 0 && <span className="animate-pulse">Attention <b style={{ color: '#f87171' }}>{counts.attention}</b></span>}
          {showTotals && <span>Total <b style={{ color: '#34d399' }}>${counts.total.toFixed(2)}</b></span>}
        </div>
      </div>

      {/* Floor area */}
      <div ref={containerRef} className="flex-1 overflow-auto relative" style={{
        background: settings.floor_theme === 'custom' ? '#1a1410' : (FLOOR_THEMES[settings.floor_theme || 'dark-wood'] || FLOOR_THEMES['dark-wood']),
      }}>
        {/* Custom background image */}
        {settings.floor_theme === 'custom' && settings.floor_bg_image && (
          <img src={`/uploads/${settings.floor_bg_image}`} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        )}

        {useGrid ? (
          <div className="p-6">
            {floorTables.length === 0 && (
              <p className="text-center text-sm mb-4" style={{ color: thm.textMuted }}>
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
