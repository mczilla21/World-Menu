import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';

interface TaxReport {
  restaurant_name: string;
  period: { start: string; end: string; label: string };
  summary: {
    gross_sales: number; net_sales: number; tax_rate: number; tax_collected: number;
    total_with_tax: number; discounts: number; refunds: number; tips: number;
    labor_cost: number; order_count: number; item_count: number; avg_order: number;
  };
  by_category: Record<string, { count: number; revenue: number }>;
  by_order_type: Record<string, { count: number; revenue: number }>;
  by_day: Record<string, { orders: number; revenue: number; tax: number }>;
  by_payment: Record<string, { count: number; amount: number }>;
  top_items: { name: string; qty: number; revenue: number }[];
}

export default function TaxReports() {
  const [report, setReport] = useState<TaxReport | null>(null);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [adjustNotes, setAdjustNotes] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const { settings } = useSettings();
  const currency = settings.currency_symbol || '$';

  const adjust = (key: string, value: number) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  };

  const getAdjusted = (key: string, original: number) => {
    return adjustments[key] !== undefined ? adjustments[key] : original;
  };

  const fetchReport = async (p?: string) => {
    setLoading(true);
    const usePeriod = p || period;
    let url = `/api/reports/tax?period=${usePeriod}`;
    if (usePeriod === 'custom' && customStart && customEnd) {
      url = `/api/reports/tax?start=${customStart}&end=${customEnd}`;
    }
    const res = await fetch(url);
    setReport(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, []);

  const printPDF = () => {
    if (!report) return;
    const r = report;
    const s = {
      ...r.summary,
      gross_sales: getAdjusted('gross_sales', r.summary.gross_sales),
      tax_collected: getAdjusted('tax_collected', r.summary.tax_collected),
      discounts: getAdjusted('discounts', r.summary.discounts),
      refunds: getAdjusted('refunds', r.summary.refunds),
      tips: getAdjusted('tips', r.summary.tips),
      labor_cost: getAdjusted('labor_cost', r.summary.labor_cost),
      total_with_tax: getAdjusted('gross_sales', r.summary.gross_sales) + getAdjusted('tax_collected', r.summary.tax_collected),
    };

    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) return;

    let html = `<!DOCTYPE html><html><head><title>Tax Report - ${r.restaurant_name}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; padding: 40px; font-size: 12px; color: #333; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
      h3 { font-size: 13px; margin: 12px 0 6px; color: #666; }
      .header { margin-bottom: 20px; }
      .period { font-size: 14px; color: #666; margin-bottom: 4px; }
      .grid { display: flex; gap: 20px; margin-bottom: 16px; }
      .box { flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
      .box-label { font-size: 10px; color: #999; text-transform: uppercase; }
      .box-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #eee; }
      th { background: #f5f5f5; font-weight: bold; font-size: 11px; text-transform: uppercase; }
      td.right, th.right { text-align: right; }
      .total-row { font-weight: bold; border-top: 2px solid #333; }
      .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;

    html += `<div class="header">
      <h1>${r.restaurant_name}</h1>
      <div class="period">Tax Report: ${r.period.start} to ${r.period.end}</div>
      <div class="period">Generated: ${new Date().toLocaleString()}</div>
    </div>`;

    // Summary boxes
    html += `<h2>Sales Summary</h2>
    <div class="grid">
      <div class="box"><div class="box-label">Gross Sales</div><div class="box-value">${currency}${s.gross_sales.toFixed(2)}</div></div>
      <div class="box"><div class="box-label">Tax Collected (${s.tax_rate}%)</div><div class="box-value">${currency}${s.tax_collected.toFixed(2)}</div></div>
      <div class="box"><div class="box-label">Total w/ Tax</div><div class="box-value">${currency}${s.total_with_tax.toFixed(2)}</div></div>
      <div class="box"><div class="box-label">Orders</div><div class="box-value">${s.order_count}</div></div>
    </div>
    <div class="grid">
      <div class="box"><div class="box-label">Discounts</div><div class="box-value">-${currency}${s.discounts.toFixed(2)}</div></div>
      <div class="box"><div class="box-label">Refunds</div><div class="box-value">-${currency}${s.refunds.toFixed(2)}</div></div>
      <div class="box"><div class="box-label">Tips</div><div class="box-value">${currency}${s.tips.toFixed(2)}</div></div>
      <div class="box"><div class="box-label">Avg Order</div><div class="box-value">${currency}${s.avg_order.toFixed(2)}</div></div>
    </div>`;

    // Daily breakdown
    const days = Object.entries(r.by_day).sort((a, b) => a[0].localeCompare(b[0]));
    if (days.length > 0) {
      html += `<h2>Daily Breakdown</h2><table>
        <tr><th>Date</th><th class="right">Orders</th><th class="right">Revenue</th><th class="right">Tax</th><th class="right">Total</th></tr>`;
      let totalRev = 0, totalTax = 0, totalOrders = 0;
      for (const [date, data] of days) {
        totalRev += data.revenue; totalTax += data.tax; totalOrders += data.orders;
        html += `<tr><td>${date}</td><td class="right">${data.orders}</td><td class="right">${currency}${data.revenue.toFixed(2)}</td><td class="right">${currency}${data.tax.toFixed(2)}</td><td class="right">${currency}${(data.revenue + data.tax).toFixed(2)}</td></tr>`;
      }
      html += `<tr class="total-row"><td>TOTAL</td><td class="right">${totalOrders}</td><td class="right">${currency}${totalRev.toFixed(2)}</td><td class="right">${currency}${totalTax.toFixed(2)}</td><td class="right">${currency}${(totalRev + totalTax).toFixed(2)}</td></tr></table>`;
    }

    // Category breakdown
    const cats = Object.entries(r.by_category);
    if (cats.length > 0) {
      html += `<h2>Sales by Category</h2><table>
        <tr><th>Category</th><th class="right">Items Sold</th><th class="right">Revenue</th></tr>`;
      for (const [name, data] of cats) {
        html += `<tr><td>${name}</td><td class="right">${data.count}</td><td class="right">${currency}${data.revenue.toFixed(2)}</td></tr>`;
      }
      html += `</table>`;
    }

    // Order type breakdown
    const types = Object.entries(r.by_order_type);
    if (types.length > 0) {
      html += `<h2>Sales by Order Type</h2><table>
        <tr><th>Type</th><th class="right">Orders</th><th class="right">Revenue</th></tr>`;
      for (const [type, data] of types) {
        html += `<tr><td>${type.replace('_', ' ').toUpperCase()}</td><td class="right">${data.count}</td><td class="right">${currency}${data.revenue.toFixed(2)}</td></tr>`;
      }
      html += `</table>`;
    }

    // Top items
    if (r.top_items.length > 0) {
      html += `<h2>Top Selling Items</h2><table>
        <tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Revenue</th></tr>`;
      r.top_items.forEach((item, i) => {
        html += `<tr><td>${i + 1}</td><td>${item.name}</td><td class="right">${item.qty}</td><td class="right">${currency}${item.revenue.toFixed(2)}</td></tr>`;
      });
      html += `</table>`;
    }

    if (adjustNotes.trim()) {
      html += `<h2>Notes</h2><p style="font-size:12px;color:#666;white-space:pre-wrap;">${adjustNotes}</p>`;
    }
    if (Object.keys(adjustments).length > 0) {
      html += `<p style="font-size:10px;color:#999;margin-top:8px;">* Report includes owner adjustments</p>`;
    }
    html += `<div class="footer">Generated by World Menu POS | ${r.restaurant_name} | ${new Date().toLocaleDateString()}</div>`;
    html += `<script>window.onload=function(){window.print()}<\/script></body></html>`;

    win.document.write(html);
    win.document.close();
  };

  const downloadCSV = async () => {
    const start = customStart || report?.period.start || '';
    const end = customEnd || report?.period.end || '';
    const res = await fetch(`/api/reports/transactions?start=${start}&end=${end}`);
    const data = await res.json();

    let csv = 'Date,Order #,Table,Type,Item,Variant,Qty,Price,Total,Notes,Source\n';
    for (const t of data.transactions) {
      csv += `"${t.created_at}","${t.order_number}","${t.table_number}","${t.order_type}","${t.item_name}","${t.variant_name || ''}",${t.quantity},${t.item_price},${(t.item_price * t.quantity).toFixed(2)},"${(t.notes || '').replace(/"/g, '""')}","${t.source}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report && loading) return <div style={{ color: '#64748b', padding: 20 }}>Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['quarter', 'This Quarter'], ['year', 'This Year']].map(([key, label]) => (
            <button key={key} onClick={() => { setPeriod(key); fetchReport(key); }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: period === key ? '#3b82f6' : '#f1f5f9', color: period === key ? '#fff' : '#334155' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b' }} />
          <span style={{ color: '#94a3b8' }}>to</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b' }} />
          <button onClick={() => { setPeriod('custom'); fetchReport('custom'); }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: '#3b82f6', color: '#fff' }}>Go</button>
        </div>
      </div>

      {report && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              ['Gross Sales', report.summary.gross_sales, '#059669'],
              ['Tax Collected', report.summary.tax_collected, '#2563eb'],
              ['Total w/ Tax', report.summary.total_with_tax, '#0f172a'],
              ['Orders', report.summary.order_count, '#7c3aed'],
            ].map(([label, value, color]) => (
              <div key={label as string} className="bg-slate-800 rounded-xl p-4">
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>{label as string}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: color as string, marginTop: 4 }}>
                  {typeof value === 'number' && label !== 'Orders' ? `${currency}${value.toFixed(2)}` : value as number}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              ['Discounts', `-${currency}${report.summary.discounts.toFixed(2)}`],
              ['Refunds', `-${currency}${report.summary.refunds.toFixed(2)}`],
              ['Tips', `${currency}${report.summary.tips.toFixed(2)}`],
              ['Avg Order', `${currency}${report.summary.avg_order.toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-800 rounded-xl p-3">
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Adjustments panel */}
          <div className="bg-slate-800 rounded-xl p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAdjust ? 12 : 0 }}>
              <h3 style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Owner Adjustments</h3>
              <button onClick={() => setShowAdjust(!showAdjust)} style={{ background: '#f1f5f9', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155' }}>
                {showAdjust ? 'Hide' : 'Edit'}
              </button>
            </div>
            {showAdjust && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['gross_sales', 'Gross Sales'],
                  ['tax_collected', 'Tax Collected'],
                  ['discounts', 'Discounts'],
                  ['refunds', 'Refunds'],
                  ['tips', 'Tips'],
                  ['labor_cost', 'Labor Cost'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: '#64748b' }}>{label}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={getAdjusted(key, (report.summary as any)[key]).toFixed(2)}
                      onChange={e => adjust(key, parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontWeight: 600, color: '#1e293b' }}
                    />
                  </div>
                ))}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 11, color: '#64748b' }}>Adjustment Notes</label>
                  <textarea
                    value={adjustNotes}
                    onChange={e => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Corrected employee clock-out time, removed test orders..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', minHeight: 60, resize: 'vertical' }}
                  />
                </div>
                <button onClick={() => { setAdjustments({}); setAdjustNotes(''); }} style={{ padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, background: '#fee2e2', color: '#dc2626' }}>
                  Reset All
                </button>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={printPDF} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: '#0f172a', color: '#fff' }}>
              Print / Save PDF
            </button>
            <button onClick={downloadCSV} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: '#059669', color: '#fff' }}>
              Download CSV (Excel)
            </button>
          </div>

          {/* Daily breakdown */}
          {Object.keys(report.by_day).length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Daily Breakdown</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b' }}>Date</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>Orders</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>Revenue</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.by_day).sort((a, b) => a[0].localeCompare(b[0])).map(([date, data]) => (
                    <tr key={date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', color: '#1e293b' }}>{date}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155' }}>{data.orders}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{currency}{data.revenue.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#2563eb' }}>{currency}{data.tax.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top items */}
          {report.top_items.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Top Items</h3>
              {report.top_items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <span style={{ color: '#1e293b' }}>{i + 1}. {item.name}</span>
                  <span style={{ color: '#64748b' }}>{item.qty}x — <b style={{ color: '#059669' }}>{currency}{item.revenue.toFixed(2)}</b></span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
