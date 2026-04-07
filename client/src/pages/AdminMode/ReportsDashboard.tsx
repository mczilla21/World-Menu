import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';

interface TodayStats {
  date: string;
  order_count: number;
  item_count: number;
  total_revenue: number;
  top_items: { item_name: string; total_qty: number; total_price: number }[];
  hourly: Record<number, { orders: number; revenue: number }>;
  active_count: number;
  finished_count: number;
}

interface DailyLog {
  id: number;
  date: string;
  order_count: number;
  item_count: number;
  total_revenue: number;
  top_items: string;
}

export default function ReportsDashboard() {
  const [today, setToday] = useState<TodayStats | null>(null);
  const [history, setHistory] = useState<DailyLog[]>([]);
  const [view, setView] = useState<'today' | 'history'>('today');
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  useEffect(() => {
    fetch('/api/reports/today').then(r => r.json()).then(setToday).catch(() => {});
    fetch('/api/reports/history').then(r => r.json()).then(setHistory).catch(() => {});
  }, []);

  const refreshToday = () => {
    fetch('/api/reports/today').then(r => r.json()).then(setToday).catch(() => {});
  };

  // Build hourly chart data (6am - 11pm)
  const hourlyData = [];
  if (today?.hourly) {
    for (let h = 6; h <= 23; h++) {
      hourlyData.push({
        hour: h,
        label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
        orders: today.hourly[h]?.orders || 0,
        revenue: today.hourly[h]?.revenue || 0,
      });
    }
  }
  const maxHourlyOrders = Math.max(...hourlyData.map(h => h.orders), 1);

  // History chart
  const historyReversed = [...history].reverse();
  const maxHistoryRevenue = Math.max(...historyReversed.map(h => h.total_revenue), 1);

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setView('today'); refreshToday(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'today' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Today (Live)
        </button>
        <button
          onClick={() => setView('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'history' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Past Days
        </button>
      </div>

      {view === 'today' && today && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Revenue" value={`${currency}${today.total_revenue.toFixed(2)}`} color="text-emerald-400" />
            <StatCard label="Orders" value={String(today.order_count)} color="text-blue-400" />
            <StatCard label="Items Sold" value={String(today.item_count)} color="text-amber-400" />
            <StatCard label="Active Now" value={String(today.active_count)} color="text-purple-400" />
          </div>

          {/* Hourly chart */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Orders by Hour</h3>
            {hourlyData.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {hourlyData.map(h => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                      <div
                        className={`w-full rounded-t transition-all ${
                          h.orders === 0 ? 'bg-slate-700' : 'bg-blue-500'
                        }`}
                        style={{ height: `${Math.max(2, (h.orders / maxHourlyOrders) * 100)}px` }}
                        title={`${h.orders} orders, ${currency}${h.revenue.toFixed(2)}`}
                      />
                    </div>
                    <span className="text-[9px] text-slate-500">{h.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No orders yet today</p>
            )}
          </div>

          {/* Top items */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Selling Items</h3>
            {today.top_items.length > 0 ? (
              <div className="space-y-2">
                {today.top_items.map((item, idx) => {
                  const maxQty = today.top_items[0]?.total_qty || 1;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-5 text-right text-xs text-slate-500 font-bold">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm text-white truncate">{item.item_name}</span>
                          <span className="text-xs text-slate-400 shrink-0 ml-2">
                            {item.total_qty}x · {currency}{item.total_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${(item.total_qty / maxQty) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No items sold yet</p>
            )}
          </div>
        </>
      )}

      {view === 'today' && !today && (
        <div className="text-center text-slate-500 py-8">Loading...</div>
      )}

      {view === 'history' && (
        <>
          {/* Revenue chart */}
          {historyReversed.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Daily Revenue</h3>
              <div className="flex items-end gap-1 h-32">
                {historyReversed.map(day => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                      <div
                        className="w-full bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${Math.max(2, (day.total_revenue / maxHistoryRevenue) * 100)}px` }}
                        title={`${day.date}: ${currency}${day.total_revenue.toFixed(2)}`}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 truncate w-full text-center">
                      {day.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily log list */}
          <div className="space-y-2">
            {history.length === 0 && (
              <p className="text-center text-slate-500 py-8">No daily logs yet. Use "Close Day" in Settings to save a day's report.</p>
            )}
            {history.map(log => {
              const topItems = JSON.parse(log.top_items || '[]');
              return (
                <div key={log.id} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-white">{log.date}</span>
                    <span className="text-lg font-black text-emerald-400">{currency}{log.total_revenue.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-400 mb-2">
                    <span>{log.order_count} orders</span>
                    <span>{log.item_count} items</span>
                    <span>Avg {currency}{log.order_count > 0 ? (log.total_revenue / log.order_count).toFixed(2) : '0.00'}/order</span>
                  </div>
                  {topItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {topItems.slice(0, 5).map((item: any, i: number) => (
                        <span key={i} className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                          {item.name} ({item.qty})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
    </div>
  );
}
