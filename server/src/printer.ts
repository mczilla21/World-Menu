import net from 'net';
import { getDb } from './db/connection.js';

const ESC = '\x1b';
const GS = '\x1d';

export function getPrinterSettings() {
  const db = getDb();
  const get = (key: string, def: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any)?.value || def;
  return {
    receipt_ip: get('printer_receipt_ip', ''),
    receipt_port: parseInt(get('printer_receipt_port', '9100')),
    kitchen_ip: get('printer_kitchen_ip', ''),
    kitchen_port: parseInt(get('printer_kitchen_port', '9100')),
    auto_print_kitchen: get('printer_auto_kitchen', '0') === '1',
  };
}

interface PrintData {
  restaurant_name: string;
  table_number?: string;
  order_number?: string;
  items: { item_name: string; variant_name?: string; quantity: number; item_price: number; notes?: string }[];
  subtotal: number;
  tax?: number;
  total?: number;
  type: 'receipt' | 'kitchen';
  date: string;
  qr_url?: string;
}

export async function printReceipt(ip: string, port: number, data: PrintData): Promise<boolean> {
  try {
    return await printWithLibrary(ip, port, data);
  } catch (err) {
    console.log('node-thermal-printer not available, using raw TCP fallback');
    return await printRawTCP(ip, port, data);
  }
}

async function printWithLibrary(ip: string, port: number, data: PrintData): Promise<boolean> {
  const { ThermalPrinter, PrinterTypes, CharacterSet } = await import('node-thermal-printer');

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${ip}:${port}`,
    options: { timeout: 5000 },
    width: 42,
    characterSet: CharacterSet.WPC1252,
  });

  const connected = await printer.isPrinterConnected();
  if (!connected) return false;

  if (data.type === 'receipt') {
    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println(data.restaurant_name);
    printer.bold(false);
    printer.setTextNormal();
    printer.println(data.date);
    printer.newLine();
    printer.drawLine();
    printer.alignLeft();
    if (data.table_number) printer.println('Table: ' + data.table_number);
    if (data.order_number) printer.println('Order: ' + data.order_number);
    printer.drawLine();

    for (const item of data.items) {
      const name = item.variant_name ? item.item_name + ' (' + item.variant_name + ')' : item.item_name;
      const qty = item.quantity > 1 ? item.quantity + 'x ' : '';
      printer.leftRight(qty + name, '$' + (item.item_price * item.quantity).toFixed(2));
      if (item.notes) printer.println('  >> ' + item.notes);
    }

    printer.drawLine();
    if (data.subtotal !== undefined) printer.leftRight('Subtotal', '$' + data.subtotal.toFixed(2));
    if (data.tax && data.tax > 0) printer.leftRight('Tax', '$' + data.tax.toFixed(2));
    if (data.total !== undefined) {
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.leftRight('TOTAL', '$' + data.total.toFixed(2));
      printer.setTextNormal();
      printer.bold(false);
    }
    printer.drawLine();

    if (data.qr_url) {
      printer.newLine();
      printer.alignCenter();
      printer.println('Scan to order online:');
      printer.printQR(data.qr_url, { cellSize: 6, correction: 'M', model: 2 });
      printer.newLine();
    }

    printer.alignCenter();
    printer.println('Thank you for dining with us!');
    printer.println('Powered by World Menu');
    printer.openCashDrawer();

  } else {
    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println('** KITCHEN **');
    printer.bold(false);
    printer.setTextNormal();
    printer.println(data.date);
    printer.drawLine();
    printer.alignLeft();

    if (data.table_number) {
      printer.setTextSize(1, 1);
      printer.bold(true);
      printer.println('TABLE: ' + data.table_number);
      printer.setTextNormal();
      printer.bold(false);
    }
    if (data.order_number) printer.println('ORDER: ' + data.order_number);
    printer.drawLine();

    for (const item of data.items) {
      printer.setTextSize(1, 0);
      printer.bold(true);
      const qty = item.quantity > 1 ? item.quantity + 'x ' : '';
      const name = item.variant_name ? item.item_name + ' (' + item.variant_name + ')' : item.item_name;
      printer.println(qty + name);
      printer.bold(false);
      printer.setTextNormal();
      if (item.notes) {
        printer.invert(true);
        printer.println(' *** ' + item.notes + ' *** ');
        printer.invert(false);
      }
    }
    printer.drawLine();
  }

  printer.newLine();
  printer.newLine();
  printer.cut();
  await printer.execute();
  return true;
}

async function printRawTCP(ip: string, port: number, data: PrintData): Promise<boolean> {
  const lines: string[] = [];
  lines.push(ESC + '@');

  if (data.type === 'receipt') {
    lines.push(ESC + 'a\x01');
    lines.push(ESC + '!\x10');
    lines.push(data.restaurant_name);
    lines.push(ESC + '!\x00');
    lines.push(data.date);
    lines.push('--------------------------------');
    lines.push(ESC + 'a\x00');
    if (data.table_number) lines.push('Table: ' + data.table_number);
    lines.push('--------------------------------');

    for (const item of data.items) {
      const name = item.variant_name ? item.item_name + ' (' + item.variant_name + ')' : item.item_name;
      const qty = item.quantity > 1 ? item.quantity + 'x ' : '';
      const price = '$' + (item.item_price * item.quantity).toFixed(2);
      const pad = Math.max(1, 32 - (qty + name).length - price.length);
      lines.push(qty + name + ' '.repeat(pad) + price);
      if (item.notes) lines.push('  >> ' + item.notes);
    }

    lines.push('--------------------------------');
    if (data.total) lines.push(ESC + '!\x10\nTOTAL          $' + data.total.toFixed(2) + '\n' + ESC + '!\x00');
    lines.push('--------------------------------');
    lines.push(ESC + 'a\x01');
    lines.push('Thank you!');
    lines.push('\n\n\n');
    lines.push(GS + 'V\x41\x03');
    lines.push(ESC + 'p\x00\x19\xfa');
  } else {
    lines.push(ESC + 'a\x01');
    lines.push(ESC + '!\x30');
    lines.push('** KITCHEN **');
    lines.push(ESC + '!\x00');
    lines.push(data.date);
    lines.push('================================');
    lines.push(ESC + 'a\x00');
    if (data.table_number) lines.push(ESC + '!\x10\nTABLE: ' + data.table_number + '\n' + ESC + '!\x00');
    if (data.order_number) lines.push('ORDER: ' + data.order_number);
    lines.push('================================');

    for (const item of data.items) {
      const qty = item.quantity > 1 ? item.quantity + 'x ' : '';
      const name = item.variant_name ? item.item_name + ' (' + item.variant_name + ')' : item.item_name;
      lines.push(ESC + '!\x10\n' + qty + name + '\n' + ESC + '!\x00');
      if (item.notes) lines.push('  *** ' + item.notes + ' ***');
    }

    lines.push('================================');
    lines.push('\n\n\n');
    lines.push(GS + 'V\x41\x03');
  }

  const buffer = Buffer.from(lines.join('\n'), 'latin1');

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(port, ip, () => { socket.write(buffer, () => { socket.end(); resolve(true); }); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

export async function scanForPrinters(): Promise<{ ip: string; port: number; name: string }[]> {
  const os = await import('os');
  const interfaces = os.networkInterfaces();
  let baseIp = '';

  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        baseIp = addr.address.split('.').slice(0, 3).join('.');
        break;
      }
    }
    if (baseIp) break;
  }
  if (!baseIp) return [];

  const found: { ip: string; port: number; name: string }[] = [];
  for (let batch = 0; batch < 6; batch++) {
    const start = batch * 50 + 1;
    const end = Math.min(start + 49, 254);
    const promises: Promise<void>[] = [];
    for (let i = start; i <= end; i++) {
      const ip = baseIp + '.' + i;
      promises.push(new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);
        socket.connect(9100, ip, () => { found.push({ ip, port: 9100, name: 'Printer at ' + ip }); socket.destroy(); resolve(); });
        socket.on('error', () => { socket.destroy(); resolve(); });
        socket.on('timeout', () => { socket.destroy(); resolve(); });
      }));
    }
    await Promise.all(promises);
  }
  return found;
}

// Legacy compat
export function buildReceipt(data: PrintData): Buffer { return Buffer.from('', 'utf8'); }
export async function printToNetwork(ip: string, port: number, data: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(port, ip, () => { socket.write(data, () => { socket.end(); resolve(true); }); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}
