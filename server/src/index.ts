import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fs from 'fs';
import { config } from './config.js';
import { getDb } from './db/connection.js';
import { broadcastToAll } from './ws/broadcast.js';
import { runMigrations } from './db/migrate.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerMenuRoutes } from './routes/menu.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerModifierRoutes } from './routes/modifiers.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerTranslationRoutes } from './routes/translations.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { registerComboRoutes } from './routes/combos.js';
import { registerServiceRoutes } from './routes/service.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerPaymentRoutes } from './routes/payments.js';
import { registerPrinterRoutes } from './routes/printer.js';
import { registerBackupRoutes } from './routes/backup.js';
import { registerPosRoutes } from './routes/pos.js';
import { registerDeliveryRoutes } from './routes/delivery.js';
import { registerFloorPlanRoutes } from './routes/floorplan.js';
import { registerTaxReportRoutes } from './routes/tax-reports.js';
import { registerWebSocket } from './ws/handler.js';
import { runDailyReset } from './daily-reset.js';
import { startAutoDailyLog } from './auto-daylog.js';
import { checkForUpdate, downloadAndApplyUpdate, startUpdateChecker } from './auto-update.js';

const app = Fastify({ logger: false });

async function start() {
  // Plugins
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Serve uploaded images
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Serve client in production
  if (fs.existsSync(config.clientDist)) {
    await app.register(fastifyStatic, {
      root: config.clientDist,
      prefix: '/',
      wildcard: false,
      maxAge: '0',
    });

    app.get('/sw.js', (req, reply) => {
      reply.header('Content-Type', 'application/javascript');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.send(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.map(c=>caches.delete(c)))).then(()=>self.registration.unregister()).then(()=>self.clients.matchAll()).then(cl=>cl.forEach(c=>c.navigate(c.url))))});`);
    });

    app.addHook('onSend', (req, reply, payload, done) => {
      if (req.url === '/index.html' || req.url === '/') {
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      done();
    });

    // SPA fallback
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.sendFile('index.html');
    });
  }

  // Database
  runMigrations();
  // Log DB info for debugging
  try {
    const dbName = (getDb().prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get() as any)?.value;
    console.log(`  Database: ${config.dbPath}`);
    console.log(`  Restaurant: ${dbName || '(not set)'}`);
  } catch {}

  // Routes
  registerCategoryRoutes(app);
  registerMenuRoutes(app);
  registerOrderRoutes(app);
  registerModifierRoutes(app);
  registerSettingsRoutes(app);
  registerTranslationRoutes(app);
  registerUploadRoutes(app);
  registerComboRoutes(app);
  registerServiceRoutes(app);
  registerReportRoutes(app);
  registerPaymentRoutes(app);
  registerPrinterRoutes(app);
  registerBackupRoutes(app);
  registerPosRoutes(app);
  registerDeliveryRoutes(app);
  registerFloorPlanRoutes(app);
  registerTaxReportRoutes(app);
  registerWebSocket(app);

  // Version & update check
  app.get('/api/version', async () => {
    const fs = await import('fs');
    const path = await import('path');
    try {
      const vFile = path.join(config.clientDist, '..', '..', 'version.json');
      const local = JSON.parse(fs.readFileSync(vFile, 'utf8'));
      return local;
    } catch {
      return { version: '1.0.0', build: 1 };
    }
  });

  app.get('/api/check-update', async () => {
    return checkForUpdate();
  });

  app.post('/api/apply-update', async () => {
    return downloadAndApplyUpdate();
  });

  // Server network info (for tablet connection URLs)
  app.get('/api/server-info', async () => {
    const os = await import('os');
    let localIp = 'localhost';
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) { localIp = addr.address; break; }
      }
      if (localIp !== 'localhost') break;
    }
    return { ip: localIp, port: config.port, url: `http://${localIp}:${config.port}` };
  });

  // Daily log routes
  app.get('/api/daily-logs', () => {
    return getDb().prepare('SELECT * FROM daily_logs ORDER BY date DESC LIMIT 30').all();
  });

  app.post('/api/daily-reset', () => {
    runDailyReset();
    return { ok: true };
  });

  // Owner-only: wipe all financial/test data (keeps menu, employees, settings, floor plan)
  app.post('/api/reset-financial-data', () => {
    const db = getDb();
    db.exec('DELETE FROM order_items');
    db.exec('DELETE FROM orders');
    db.exec('DELETE FROM daily_logs');
    db.exec('DELETE FROM time_entries');
    db.exec('DELETE FROM service_calls');
    db.exec('DELETE FROM cash_drawer_log');
    db.exec('DELETE FROM refunds');
    broadcastToAll({ type: 'HISTORY_CLEARED' });
    return { ok: true, message: 'All financial data cleared' };
  });

  // Start
  await app.listen({ port: config.port, host: config.host });

  // Find real local IP for tablet connections
  const os = await import('os');
  let localIp = 'localhost';
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) { localIp = addr.address; break; }
    }
    if (localIp !== 'localhost') break;
  }

  // Advertise on local network via mDNS
  try {
    const { Bonjour } = await import('bonjour-service');
    const bonjour = new Bonjour();
    bonjour.publish({ name: 'World Menu POS', type: 'http', port: config.port, host: 'worldmenu.local' });
    console.log('');
    console.log('  World Menu POS is running!');
    console.log('');
    console.log(`  This computer:  http://localhost:${config.port}`);
    console.log(`  Tablets/Phones: http://${localIp}:${config.port}`);
    console.log(`  Network name:   http://worldmenu.local:${config.port}`);
    console.log('');
  } catch {
    console.log('');
    console.log('  World Menu POS is running!');
    console.log('');
    console.log(`  This computer:  http://localhost:${config.port}`);
    console.log(`  Tablets/Phones: http://${localIp}:${config.port}`);
    console.log('');
  }

  // Ensure essential settings exist
  try {
    const db = getDb();
    const ensure = (key: string, defaultVal: string) => {
      const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
      if (!existing) db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, defaultVal);
    };
    ensure('github_repo', 'mczilla21/World-Menu');
    ensure('sandbox_mode', '1');
    ensure('app_theme', 'warm-night');
    ensure('floor_theme', 'dark-wood');
    ensure('card_surcharge', '3');
  } catch {}

  // Auto-close stale orders older than 48 hours (runs on startup + every 6 hours)
  const closeStaleOrders = () => {
    try {
      const db = getDb();
      const stale = db.prepare(
        "UPDATE orders SET closed = 1, status = 'finished', finished_at = COALESCE(finished_at, datetime('now', 'localtime')) WHERE closed = 0 AND status = 'active' AND created_at < datetime('now', '-48 hours')"
      ).run();
      if (stale.changes > 0) console.log(`  Auto-closed ${stale.changes} stale order(s) older than 48 hours`);
    } catch {}
  };
  closeStaleOrders();
  setInterval(closeStaleOrders, 6 * 60 * 60 * 1000);

  // Start automatic daily log bookkeeping
  startAutoDailyLog();

  // Start update checker (checks twice a day)
  startUpdateChecker();
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await app.close();
  process.exit(0);
});

// Catch uncaught errors — log but don't crash
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
