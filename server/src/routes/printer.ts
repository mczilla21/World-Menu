import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { scanForPrinters, printReceipt, getPrinterSettings } from '../printer.js';

function getSettingValue(key: string, def: string = ''): string {
  return (getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as any)?.value || def;
}

interface ReceiptRequestBody {
  table_number: string;
  order_id: number;
  type: 'merchant' | 'customer' | 'both';
  payment_method: 'card' | 'cash' | 'gift_card';
  amount_paid: number;
  tip_amount: number;
  card_surcharge: number;
}

function generateReceiptHtml(opts: {
  restaurantName: string;
  date: string;
  tableNumber: string;
  orderNumber: string;
  items: { item_name: string; variant_name?: string; quantity: number; item_price: number; notes?: string }[];
  subtotal: number;
  tax: number;
  taxRate: number;
  cardSurcharge: number;
  tipAmount: number;
  total: number;
  paymentMethod: string;
  copyType: 'merchant' | 'customer';
}): string {
  const { restaurantName, date, tableNumber, orderNumber, items, subtotal, tax, taxRate,
    cardSurcharge, tipAmount, total, paymentMethod, copyType } = opts;
  const payLabel = paymentMethod === 'card' ? 'CARD' : paymentMethod === 'cash' ? 'CASH' : 'GIFT CARD';

  let itemsHtml = '';
  for (const item of items) {
    const name = item.variant_name ? `${item.item_name} (${item.variant_name})` : item.item_name;
    const lineTotal = (item.item_price * item.quantity).toFixed(2);
    itemsHtml += `<tr><td style="text-align:left">${name}</td><td style="text-align:center">${item.quantity} x $${item.item_price.toFixed(2)}</td><td style="text-align:right">$${lineTotal}</td></tr>\n`;
    if (item.notes) {
      itemsHtml += `<tr><td colspan="3" style="text-align:left;padding-left:12px;font-style:italic;color:#666;font-size:11px">${item.notes}</td></tr>\n`;
    }
  }

  const signatureBlock = copyType === 'merchant'
    ? `<div style="margin:16px 0;text-align:center;font-weight:bold">MERCHANT COPY &mdash; SIGNATURE REQUIRED</div>
       <div style="margin:16px 24px;text-align:center">X<span style="display:inline-block;width:200px;border-bottom:1px solid #000">&nbsp;</span></div>`
    : `<div style="margin:16px 0;text-align:center;font-weight:bold">CUSTOMER COPY</div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt</title>
<style>
  body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 16px; font-size: 13px; color: #000; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .double-divider { border-top: 2px solid #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .total-row td { font-weight: bold; font-size: 15px; }
  .center { text-align: center; }
  @media print { body { width: 100%; } }
</style></head><body>
  <div class="double-divider"></div>
  <div class="center" style="font-size:16px;font-weight:bold;margin:8px 0">${restaurantName}</div>
  <div class="center" style="font-size:11px;margin-bottom:8px">${date}</div>
  <div class="double-divider"></div>
  <div style="display:flex;justify-content:space-between;margin:8px 0">
    <span>Table: ${tableNumber}</span><span>Order: ${orderNumber}</span>
  </div>
  <div class="divider"></div>
  <table>${itemsHtml}</table>
  <div class="divider"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">$${subtotal.toFixed(2)}</td></tr>
    <tr><td>Tax (${taxRate}%)</td><td style="text-align:right">$${tax.toFixed(2)}</td></tr>
    ${cardSurcharge > 0 ? `<tr><td>Card Processing</td><td style="text-align:right">$${cardSurcharge.toFixed(2)}</td></tr>` : ''}
    ${tipAmount > 0 ? `<tr><td>Tip</td><td style="text-align:right">$${tipAmount.toFixed(2)}</td></tr>` : ''}
  </table>
  <div class="divider"></div>
  <table><tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${total.toFixed(2)}</td></tr></table>
  <div style="margin:8px 0">Payment: ${payLabel}</div>
  <div class="double-divider"></div>
  ${signatureBlock}
  <div class="double-divider"></div>
  <div class="center" style="margin:12px 0;font-size:12px">Thank you for dining with us!<br>worldmenu.local</div>
  <div class="double-divider"></div>
</body></html>`;
}

export function registerPrinterRoutes(app: FastifyInstance) {
  // Scan network for printers
  app.post('/api/printer/scan', async () => {
    const printers = await scanForPrinters();
    return { printers };
  });

  // Test print
  app.post<{ Body: { ip: string; port?: number } }>('/api/printer/test', async (req) => {
    const ok = await printReceipt(req.body.ip, req.body.port || 9100, {
      restaurant_name: getSettingValue('restaurant_name', 'World Menu'),
      items: [{ item_name: 'Test Print - SUCCESS', quantity: 1, item_price: 0 }],
      subtotal: 0,
      total: 0,
      type: 'receipt',
      date: new Date().toLocaleString(),
      qr_url: 'https://worldmenu.app',
    });
    return { ok };
  });

  // Print payment receipt (merchant/customer/both)
  app.post<{ Body: ReceiptRequestBody }>('/api/printer/receipt', async (req) => {
    const db = getDb();
    const { table_number, order_id, type, payment_method, amount_paid, tip_amount, card_surcharge } = req.body;

    const restaurantName = getSettingValue('restaurant_name', 'Restaurant');

    // Fetch the order
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as any;
    // If no order found by id, fetch by table
    const orders = order
      ? [order]
      : (db.prepare(
          "SELECT * FROM orders WHERE table_number = ? AND closed = 0 AND is_archived = 0 ORDER BY created_at ASC"
        ).all(table_number) as any[]);

    const allItems: { item_name: string; variant_name?: string; quantity: number; item_price: number; notes?: string }[] = [];
    let subtotal = 0;
    let orderNumber = '';
    for (const o of orders) {
      if (!orderNumber) orderNumber = o.order_number || String(o.id);
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) as any[];
      for (const item of items) {
        allItems.push({
          item_name: item.item_name,
          variant_name: item.variant_name || undefined,
          quantity: item.quantity,
          item_price: item.item_price,
          notes: item.notes || undefined,
        });
        subtotal += item.item_price * item.quantity;
      }
    }

    // Get tax rate
    let taxRate = 7;
    try {
      const rates = db.prepare('SELECT * FROM tax_rates WHERE is_active = 1').all() as any[];
      if (rates.length > 0) taxRate = rates[0].rate;
    } catch {}
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax + (card_surcharge || 0) + (tip_amount || 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

    const receiptBase = {
      restaurantName,
      date: dateStr,
      tableNumber: table_number,
      orderNumber,
      items: allItems,
      subtotal,
      tax,
      taxRate,
      cardSurcharge: card_surcharge || 0,
      tipAmount: tip_amount || 0,
      total,
      paymentMethod: payment_method,
    };

    // Try to send to thermal printer
    const ps = getPrinterSettings();
    let printOk = false;
    if (ps.receipt_ip) {
      const printData = {
        restaurant_name: restaurantName,
        table_number,
        order_number: orderNumber,
        items: allItems,
        subtotal,
        tax,
        total,
        type: 'receipt' as const,
        date: dateStr,
      };
      if (type === 'merchant' || type === 'both') {
        printOk = await printReceipt(ps.receipt_ip, ps.receipt_port, printData);
      }
      if (type === 'customer' || type === 'both') {
        printOk = await printReceipt(ps.receipt_ip, ps.receipt_port, printData);
      }
    }

    // Generate HTML for browser display/print
    const htmlParts: string[] = [];
    if (type === 'merchant' || type === 'both') {
      htmlParts.push(generateReceiptHtml({ ...receiptBase, copyType: 'merchant' }));
    }
    if (type === 'customer' || type === 'both') {
      htmlParts.push(generateReceiptHtml({ ...receiptBase, copyType: 'customer' }));
    }

    return {
      ok: true,
      printed: printOk,
      html: htmlParts.join('\n<!-- PAGE BREAK -->\n'),
    };
  });

  // Print kitchen ticket
  app.post<{ Body: { order_id: number } }>('/api/printer/kitchen', async (req) => {
    const db = getDb();
    const ps = getPrinterSettings();
    if (!ps.kitchen_ip) return { error: 'No kitchen printer configured' };

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id) as any;
    if (!order) return { error: 'Order not found' };

    const restaurantName = getSettingValue('restaurant_name', 'Restaurant');
    const items = db.prepare(
      'SELECT * FROM order_items WHERE order_id = ? AND show_in_kitchen = 1'
    ).all(order.id) as any[];

    const ok = await printReceipt(ps.kitchen_ip, ps.kitchen_port, {
      restaurant_name: restaurantName,
      table_number: order.table_number,
      order_number: order.order_number,
      items,
      subtotal: 0,
      type: 'kitchen',
      date: new Date().toLocaleString(),
    });
    return { ok };
  });

  // Open cash drawer manually
  app.post('/api/printer/open-drawer', async () => {
    const ps = getPrinterSettings();
    if (!ps.receipt_ip) return { error: 'No receipt printer configured' };

    // Send just the cash drawer kick command
    const ok = await printReceipt(ps.receipt_ip, ps.receipt_port, {
      restaurant_name: '',
      items: [],
      subtotal: 0,
      type: 'receipt',
      date: '',
    });
    return { ok };
  });
}
