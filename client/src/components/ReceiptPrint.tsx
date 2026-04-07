import { useState, useEffect, useRef } from 'react';

interface Props {
  tableNumber: string;
  onClose: () => void;
}

interface ReceiptData {
  restaurant_name: string;
  table_number: string;
  items: { item_name: string; variant_name: string; quantity: number; item_price: number; notes: string }[];
  subtotal: number;
  order_count: number;
  date: string;
}

export default function ReceiptPrint({ tableNumber, onClose }: Props) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reports/receipt/${encodeURIComponent(tableNumber)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [tableNumber]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 4mm;
            font-size: 12px;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .big { font-size: 16px; }
          .small { font-size: 10px; }
          .line { border-top: 1px dashed #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .notes { font-size: 10px; color: #666; padding-left: 12px; }
          .total-row { font-size: 14px; font-weight: bold; }
          @media print {
            body { width: 100%; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Preview */}
        <div className="flex-1 overflow-auto p-4">
          <div ref={printRef}>
            <div className="center bold big" style={{ marginBottom: '4px' }}>{data.restaurant_name}</div>
            <div className="center small" style={{ marginBottom: '8px' }}>{data.date}</div>
            <div className="line" />
            <div className="row bold" style={{ padding: '4px 0' }}>
              <span>Table {data.table_number}</span>
              <span>{data.order_count} order{data.order_count !== 1 ? 's' : ''}</span>
            </div>
            <div className="line" />
            {data.items.map((item, idx) => (
              <div key={idx}>
                <div className="row">
                  <span>
                    {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.item_name}
                    {item.variant_name ? ` (${item.variant_name})` : ''}
                  </span>
                  <span>${(item.item_price * item.quantity).toFixed(2)}</span>
                </div>
                {item.notes && <div className="notes">{item.notes}</div>}
              </div>
            ))}
            <div className="line" />
            <div className="row total-row">
              <span>TOTAL</span>
              <span>${data.subtotal.toFixed(2)}</span>
            </div>
            <div className="line" />
            <div className="center small" style={{ marginTop: '8px' }}>Thank you for dining with us!</div>
            <div className="center small">Powered by World Menu</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-600">
            Close
          </button>
          <button onClick={handlePrint} className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-900 text-white">
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
